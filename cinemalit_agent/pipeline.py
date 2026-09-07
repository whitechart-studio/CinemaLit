"""
Agent-orchestrated project ingest pipeline.

The root Director Agent owns the whole flow — the web app never calls Gemini
directly for this. It asks the agent to ingest a project; the agent calls
`ingest_project_script`, which:

  1. splits the screenplay into scenes (regex, free — no tokens),
  2. groups scenes into character-budget batches (_batch_scenes) and fans
     each batch out to `breakdown_agent` for the AI breakdown,
  3. writes scenes / cast / elements / shots / budget straight into ClickHouse,
  4. keeps the `jobs` row updated so the UI can show real progress.

`generate_project_storyboards` is the same shape for storyboard frames
(still one call per scene — storyboard frames need the full generated image
per frame, so there is nothing to gain by batching them).

Why two extra agents instead of doing it all on the root agent: the root
agent carries 20 tool declarations on every turn, and breakdown needs zero
of them — the scene text is already in hand and the output shape is fixed.
`breakdown_agent` / `storyboard_agent` are ADK agents with an `output_schema`
and no tools, so a call costs one small structured response instead of a
20-tool multi-turn loop.

Breakdown used to be one call per scene — at a couple hundred scenes with a
handful of concurrent workers, that meant a couple hundred chances to hit a
rate limit or timeout, and a failed scene came back completely empty (no
cast, no elements, nothing). Batching by a character budget (not a fixed
scene count, so one oversized scene can't blow out a batch) cuts the call
count roughly in proportion to batch size, and cast now has a zero-AI floor
(see `_merge_heuristic_cast`) so a scene is never fully empty even if its
whole batch fails outright.

`include_contents="none"` keeps every batch call independent — batch 12 must
not carry batches 1-11 in its context.
"""

import asyncio
import concurrent.futures
import json
import os
import re
import threading
import time
import urllib.parse
import urllib.request
import uuid
import zlib
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from google.adk.agents import Agent
from google.adk.runners import InMemoryRunner
from google.genai import types as genai_types
from pydantic import BaseModel, Field

from cinemalit.crews.story import StoryCrew
from web.db import CH_DB, ch_query

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")

_SAFE_PATH_COMPONENT = re.compile(r"^[A-Za-z0-9_-]+$")

# How many breakdown batches (see _batch_scenes) — or, for storyboards, how
# many scenes — to process concurrently. Raise for speed, lower if the model
# endpoint starts returning 429s.
MAX_WORKERS = int(os.environ.get("PIPELINE_WORKERS", "6"))

# ponytail: crc32 for deterministic ids — replaces the old
# `SELECT MAX(id)+1` pattern, which raced whenever two ingests overlapped.
# Collisions are ~0 at a few thousand rows per project; if a project ever
# grows past that, switch to a UInt64 id column and cityHash64.
def _id(*parts: Any) -> int:
    return zlib.crc32(":".join(str(p) for p in parts).encode()) or 1


@dataclass
class SceneRow:
    """The stub scene row, carried through the fan-out so the enriched
    re-INSERT can preserve the columns the breakdown does not produce."""

    scene_id: int
    scene_number: str
    location: str
    scene_text: str
    # Cue-line character detection from StoryCrew.parse_script — zero-cost,
    # no AI, ~100% reliable for standard screenplay formatting. Carried
    # alongside the AI breakdown as a floor: see _merge_heuristic_cast and
    # _save_heuristic_only below.
    characters: List[str]


# ── Structured output schemas ──────────────────────────────────────────────

class CastSpec(BaseModel):
    character_name: str
    role_type: str = Field(description="Lead, Supporting, Day Player, or Background")
    day_rate_usd: float = Field(description="Realistic day rate for this role tier")


class ElementSpec(BaseModel):
    element_type: str = Field(description="prop, wardrobe, vfx, sfx, stunt, vehicle, or animal")
    name: str
    cost_usd: float
    vendor: str


class ShotSpec(BaseModel):
    shot_code: str = Field(description="e.g. SC-001-A")
    lens_mm: int
    movement: str = Field(description="Static, Dolly In, Handheld, Steadicam, Crane, Drone, Pan")
    framing: str = Field(description="WS, MS, CU, ECU, OTS, POV, or INSERT")
    description: str


class SceneBreakdown(BaseModel):
    scene_number: str = Field(description="Echo back exactly the scene label given for this entry, e.g. SC-003")
    synopsis: str = Field(description="One or two sentences on what happens in this scene")
    int_ext: str = Field(description="INT, EXT, or INT/EXT")
    time_of_day: str = Field(description="DAY, NIGHT, DAWN, or DUSK")
    page_count: float
    shoot_day: int = Field(description="Which shoot day this scene should fall on, starting at 1")
    risk_level: str = Field(description="low, med, or high")
    risk_note: str
    status: str = Field(description="scheduled or vfx_required")
    cast: List[CastSpec]
    elements: List[ElementSpec]
    shots: List[ShotSpec]


class SceneBreakdownBatch(BaseModel):
    """One AI call now covers several scenes at once (see _batch_scenes) —
    the model returns one SceneBreakdown per scene it was given, tagged with
    scene_number so the fan-out can match each entry back to the right row
    regardless of response ordering."""

    scenes: List[SceneBreakdown]


class FrameSpec(BaseModel):
    frame_num: int
    title: str
    camera_spec: str = Field(description="e.g. '50mm Anamorphic · Dolly In'")
    start_sec: int
    end_sec: int
    prompt: str = Field(description="Vivid visual description for image generation")


class SceneStoryboard(BaseModel):
    frames: List[FrameSpec]
    estimated_duration_sec: int
    recommended_interval_sec: int


breakdown_agent = Agent(
    name="scene_breakdown_agent",
    model=GEMINI_MODEL,
    instruction=(
        "You are a 1st Assistant Director doing a script breakdown. You will be given several "
        "scenes at once, each prefixed with a line like '=== Scene: SC-003 ==='. For EACH scene, "
        "independently produce the complete production breakdown: every speaking character, "
        "every prop/wardrobe/VFX/SFX/stunt element with a realistic cost and a plausible vendor, "
        "and a shot list a DP could actually shoot. Estimate page count from the text length "
        "(roughly 55 lines per page). Flag stunts, weapons, water, fire, animals, children and "
        "night exteriors as elevated risk. Base everything on what is actually in that scene's "
        "own text — never invent characters who do not appear, and never let one scene's content "
        "bleed into another's breakdown. Return exactly one entry in `scenes` per scene given, in "
        "the same order, each with scene_number set to that scene's exact label."
    ),
    output_schema=SceneBreakdownBatch,
    include_contents="none",
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
)

storyboard_agent = Agent(
    name="storyboard_agent",
    model=GEMINI_MODEL,
    instruction=(
        "You are a storyboard artist and director of photography. Given a scene's screenplay "
        "text, its shot list and a target time interval, lay the scene out as a timed frame "
        "sequence covering its full duration. Each frame gets a camera spec and a vivid, "
        "concrete visual prompt describing what is in frame — lighting, weather, blocking, "
        "lens feel. Cover the whole scene duration with no gaps between frames."
    ),
    output_schema=SceneStoryboard,
    include_contents="none",
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
)


# ── Agent invocation ───────────────────────────────────────────────────────

def _run_agent_sync(agent: Agent, prompt: str) -> Optional[dict]:
    """Run a structured-output agent once and return its parsed JSON.

    Always runs on a private event loop in its own thread: this is called both
    from inside an ADK tool (already inside a running loop) and from worker
    threads in the fan-out pool, and asyncio.run() refuses to nest.
    """

    async def _go() -> str:
        runner = InMemoryRunner(agent=agent, app_name="cinemalit_pipeline")
        session_id = uuid.uuid4().hex
        await runner.session_service.create_session(
            app_name="cinemalit_pipeline", user_id="pipeline", session_id=session_id
        )
        chunks: List[str] = []
        async for event in runner.run_async(
            user_id="pipeline",
            session_id=session_id,
            new_message=genai_types.Content(
                role="user", parts=[genai_types.Part(text=prompt)]
            ),
        ):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if getattr(part, "text", None):
                        chunks.append(part.text)
        return "".join(chunks)

    box: Dict[str, Any] = {}

    def _target() -> None:
        try:
            box["text"] = asyncio.run(_go())
        except Exception as exc:  # noqa: BLE001 — surfaced to caller below
            box["error"] = exc

    thread = threading.Thread(target=_target, daemon=True)
    thread.start()
    thread.join()

    if "error" in box:
        raise box["error"]

    raw = (box.get("text") or "").strip()
    if not raw:
        return None
    # output_schema should give clean JSON, but a fenced block still shows up
    # occasionally — cheaper to strip it than to retry the call.
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


# ── Script splitting (regex, no tokens) ────────────────────────────────────

_HEADER = re.compile(r"^(INT\.|EXT\.|INT/EXT\.|EXT/INT\.|INT\s|EXT\s)", re.IGNORECASE)


def _split_scene_text(script_text: str) -> List[str]:
    """Slice raw script into per-scene bodies.

    Mirrors StoryCrew.parse_script's own blocking so the two line up
    positionally. parse_script gives the structured fields; this gives the
    full prose it throws away.
    """
    blocks: List[List[str]] = []
    current: Optional[List[str]] = None
    for line in script_text.splitlines():
        if _HEADER.match(line.strip()):
            if current is not None:
                blocks.append(current)
            current = [line.strip()]
        elif current is not None:
            current.append(line)
    if current is not None:
        blocks.append(current)
    if not blocks:
        blocks = [["INT. PRODUCTION STUDIO - DAY", *script_text.splitlines()]]
    return ["\n".join(b).strip() for b in blocks]


# ── Scene batching for the breakdown call ──────────────────────────────────
#
# One call per scene (the old design) meant a 209-scene script fired 209
# separate Gemini calls, and with a handful of concurrent workers hitting
# rate limits or timeouts on a chunk of them was close to guaranteed. Group
# scenes into one call per batch instead, sized by a character budget (a
# cheap stand-in for a token budget — no tokenizer dependency needed) rather
# than a fixed scene count, so a batch of short scenes and a batch with one
# unusually long scene both stay bounded. A batch never splits a scene: it
# always takes the next scene whole, even if that alone exceeds the budget
# (better one oversized solo batch than a truncated scene).
MAX_BATCH_CHARS = int(os.environ.get("PIPELINE_BATCH_CHARS", "9000"))


def _batch_scenes(scenes: List["SceneRow"], max_chars: int = MAX_BATCH_CHARS) -> List[List["SceneRow"]]:
    batches: List[List["SceneRow"]] = []
    current: List["SceneRow"] = []
    current_chars = 0
    for scene in scenes:
        size = len(scene.scene_text[:6000])
        if current and current_chars + size > max_chars:
            batches.append(current)
            current, current_chars = [], 0
        current.append(scene)
        current_chars += size
    if current:
        batches.append(current)
    return batches


def _build_batch_prompt(project_name: str, batch: List["SceneRow"]) -> str:
    parts = [
        f"Project: {project_name}\n\n"
        f"Break down each of the following {len(batch)} scenes. Return exactly one entry per "
        f"scene in the `scenes` array, in the same order, each with scene_number set to the "
        f"exact label shown before it.\n"
    ]
    for item in batch:
        parts.append(f"\n=== Scene: {item.scene_number} ===\n{item.scene_text[:6000]}\n")
    return "".join(parts)


# ── Zero-AI heuristics — cast floor + failure-only element fallback ────────
#
# Cast is heuristic-first: StoryCrew.parse_script's cue-line detection (an
# ALL-CAPS line before dialogue is a character) is a standard screenplay
# convention, not a guess, and costs no API call. It is folded into every
# scene's cast list (see _merge_heuristic_cast) whether or not the AI call
# succeeds, so a name is never missing just because a batch failed. The
# element/prop keyword pass below is not nearly as reliable — it only runs
# as a last resort for a scene the AI genuinely never returned, so a card
# shows *something* instead of nothing.
_HEURISTIC_PROP_WORDS = ("gun", "terminal", "case", "car", "phone", "key")


def _heuristic_elements(scene_text: str) -> List[Dict[str, Any]]:
    lower = scene_text.lower()
    found: List[Dict[str, Any]] = []
    seen: set = set()
    for word in _HEURISTIC_PROP_WORDS:
        if word in lower and word not in seen:
            seen.add(word)
            found.append({"element_type": "prop", "name": word.capitalize(), "cost_usd": 0, "vendor": ""})
    if "rain" in lower:
        found.append({"element_type": "sfx", "name": "Rain Practical", "cost_usd": 0, "vendor": ""})
    if "neon" in lower:
        found.append({"element_type": "vfx", "name": "Neon FX", "cost_usd": 0, "vendor": ""})
    if "screen" in lower or "monitor" in lower:
        found.append({"element_type": "vfx", "name": "Screen/Monitor FX", "cost_usd": 0, "vendor": ""})
    return found


def _merge_heuristic_cast(bd: dict, heuristic_names: List[str]) -> dict:
    existing = {str(c.get("character_name", "")).strip().upper() for c in bd.get("cast", [])}
    cast = list(bd.get("cast", []))
    for name in heuristic_names:
        if name.strip() and name.strip().upper() not in existing:
            cast.append({"character_name": name.strip(), "role_type": "Speaking Role", "day_rate_usd": 0})
    bd["cast"] = cast
    return bd


def _save_heuristic_only(project_id: str, scene: "SceneRow", written: Dict[str, set]) -> None:
    """No AI breakdown at all for this scene — the whole batch failed, or the
    model dropped this scene from its response. The scenes row itself is
    left untouched (the stub insert already has correct location/int-ext/
    day-night from StoryCrew.parse_script — a synthesized guess would only
    make that worse); only cast (heuristic) and a keyword element pass get
    written, so the scene has something rather than nothing."""
    scene_id, scene_number = scene.scene_id, scene.scene_number
    for name in scene.characters:
        name = name.strip()
        if not name:
            continue
        cast_id = _id(project_id, name.upper())
        ch_query(
            f"INSERT INTO {CH_DB}.cast_members "
            f"(project_id, cast_id, character_name, actor_name, role_type, day_rate_usd, total_days) "
            f"VALUES ({{p:String}}, {{c:UInt32}}, {{n:String}}, '', 'Speaking Role', 0, 1)",
            {"p": project_id, "c": cast_id, "n": name},
        )
        ch_query(
            f"INSERT INTO {CH_DB}.scene_cast (project_id, scene_id, cast_id) "
            f"VALUES ({{p:String}}, {{s:UInt32}}, {{c:UInt32}})",
            {"p": project_id, "s": scene_id, "c": cast_id},
        )
        written["cast_members"].add(cast_id)
        written["scene_cast"].add(scene_id)

    for idx, element in enumerate(_heuristic_elements(scene.scene_text), start=1):
        element_id = _id(project_id, scene_number, "hel", idx)
        written["elements"].add(element_id)
        ch_query(
            f"INSERT INTO {CH_DB}.elements "
            f"(project_id, element_id, scene_id, element_type, name, cost_usd, vendor, status) "
            f"VALUES ({{p:String}}, {{e:UInt32}}, {{s:UInt32}}, {{t:String}}, {{n:String}}, "
            f"{{c:Float64}}, {{v:String}}, 'needs_review')",
            {
                "p": project_id, "e": element_id, "s": scene_id,
                "t": element["element_type"], "n": element["name"],
                "c": element["cost_usd"], "v": element["vendor"],
            },
        )


# ── Job bookkeeping ────────────────────────────────────────────────────────

def _job_update(job_id: str, **fields: Any) -> None:
    if not job_id:
        return
    row = ch_query(
        f"SELECT project_id, kind, status, total, done, message, error FROM {CH_DB}.jobs FINAL "
        f"WHERE job_id = {{j:String}} ORDER BY updated_at DESC LIMIT 1",
        {"j": job_id},
    ).get("data", [])
    if not row:
        return
    project_id, kind, status, total, done, message, error = row[0]
    merged = {
        "status": status, "total": total, "done": done,
        "message": message, "error": error, **fields,
    }
    ch_query(
        f"INSERT INTO {CH_DB}.jobs (job_id, project_id, kind, status, total, done, message, error) "
        f"VALUES ({{j:String}}, {{p:String}}, {{k:String}}, {{s:String}}, "
        f"{{t:UInt16}}, {{d:UInt16}}, {{m:String}}, {{e:String}})",
        {
            "j": job_id, "p": project_id, "k": kind,
            "s": merged["status"], "t": merged["total"], "d": merged["done"],
            "m": merged["message"], "e": merged["error"],
        },
    )


def create_job(project_id: str, kind: str, total: int = 0) -> str:
    job_id = uuid.uuid4().hex
    ch_query(
        f"INSERT INTO {CH_DB}.jobs (job_id, project_id, kind, status, total, done, message, error) "
        f"VALUES ({{j:String}}, {{p:String}}, {{k:String}}, 'running', {{t:UInt16}}, 0, '', '')",
        {"j": job_id, "p": project_id, "k": kind, "t": total},
    )
    return job_id


# ── Persistence ────────────────────────────────────────────────────────────

def _sweep_stale_rows(project_id: str, written: Dict[str, set]) -> None:
    """Drop rows left over from a previous, longer ingest of the same project.

    Deliberately runs AFTER every insert, never before. ClickHouse applies a
    lightweight DELETE as an async mutation that can still swallow rows
    inserted while it is in flight — a delete-then-reinsert ordering silently
    loses scenes (reproduced against ClickHouse Cloud, ~2 runs in 3). Since
    every id here is a deterministic hash of (project_id, scene_number, ...),
    a re-ingest overwrites its own rows via ReplacingMergeTree; the only thing
    left to remove is whatever the new script no longer contains.
    """
    for table, column in (
        ("scenes", "scene_id"),
        ("shots", "shot_id"),
        ("elements", "element_id"),
        ("scene_cast", "scene_id"),
        ("cast_members", "cast_id"),
        ("budget_items", "item_id"),
    ):
        keep = written.get(table, set())
        keep_list = ",".join(str(int(i)) for i in keep) or "0"
        try:
            ch_query(
                f"DELETE FROM {CH_DB}.{table} "
                f"WHERE project_id = {{p:String}} AND {column} NOT IN ({keep_list})",
                {"p": project_id},
            )
        except Exception as exc:  # noqa: BLE001 — stale rows are cosmetic, a failed
            # sweep must not fail an otherwise-good ingest
            print(f"⚠️  Could not sweep stale {table} rows: {exc}")


def _save_breakdown(project_id: str, scene: "SceneRow", bd: dict, written: Dict[str, set]) -> None:
    """Write one scene's AI breakdown across scenes/cast/elements/shots/budget."""
    # scenes is a ReplacingMergeTree keyed on (project_id, scene_id), so the
    # enriched row is re-INSERTed over the stub rather than ALTER ... UPDATEd.
    # A mutation per scene would mean 90 mutations per feature-length ingest;
    # readers use FINAL to collapse the duplicate before the next merge.
    ch_query(
        f"INSERT INTO {CH_DB}.scenes (project_id, scene_id, scene_number, int_ext, location, "
        f"time_of_day, page_count, shoot_day, status, description, scene_text) "
        f"VALUES ({{p:String}}, {{sid:UInt32}}, {{sn:String}}, {{ie:String}}, {{loc:String}}, "
        f"{{tod:String}}, {{pc:Float32}}, {{sd:UInt8}}, {{st:String}}, {{desc:String}}, {{txt:String}})",
        {
            "p": project_id,
            "sid": scene.scene_id,
            "sn": scene.scene_number,
            "ie": bd.get("int_ext", "INT"),
            "loc": scene.location,
            "tod": bd.get("time_of_day", "DAY"),
            "pc": float(bd.get("page_count") or 0.25),
            "sd": max(1, min(255, int(bd.get("shoot_day") or 1))),
            "st": bd.get("status", "scheduled"),
            "desc": bd.get("synopsis", "")[:2000],
            "txt": scene.scene_text[:20000],
        },
    )

    scene_id, scene_number = scene.scene_id, scene.scene_number
    written["scenes"].add(scene_id)

    for member in bd.get("cast", []):
        name = str(member.get("character_name", "")).strip()
        if not name:
            continue
        cast_id = _id(project_id, name.upper())
        ch_query(
            f"INSERT INTO {CH_DB}.cast_members "
            f"(project_id, cast_id, character_name, actor_name, role_type, day_rate_usd, total_days) "
            f"VALUES ({{p:String}}, {{c:UInt32}}, {{n:String}}, '', {{r:String}}, {{d:Float64}}, 1)",
            {
                "p": project_id, "c": cast_id, "n": name,
                "r": str(member.get("role_type", "Supporting")),
                "d": float(member.get("day_rate_usd") or 0),
            },
        )
        ch_query(
            f"INSERT INTO {CH_DB}.scene_cast (project_id, scene_id, cast_id) "
            f"VALUES ({{p:String}}, {{s:UInt32}}, {{c:UInt32}})",
            {"p": project_id, "s": scene_id, "c": cast_id},
        )
        written["cast_members"].add(cast_id)
        written["scene_cast"].add(scene_id)

    for idx, element in enumerate(bd.get("elements", []), start=1):
        name = str(element.get("name", "")).strip()
        if not name:
            continue
        cost = float(element.get("cost_usd") or 0)
        etype = str(element.get("element_type", "prop"))
        vendor = str(element.get("vendor", ""))
        element_id = _id(project_id, scene_number, "el", idx)
        written["elements"].add(element_id)
        ch_query(
            f"INSERT INTO {CH_DB}.elements "
            f"(project_id, element_id, scene_id, element_type, name, cost_usd, vendor, status) "
            f"VALUES ({{p:String}}, {{e:UInt32}}, {{s:UInt32}}, {{t:String}}, {{n:String}}, "
            f"{{c:Float64}}, {{v:String}}, 'planned')",
            {
                "p": project_id, "e": element_id,
                "s": scene_id, "t": etype, "n": name, "c": cost, "v": vendor,
            },
        )
        # Budget lines are derived from the breakdown, not asked for separately —
        # one less thing for the model to invent, and they always reconcile.
        if cost > 0:
            written["budget_items"].add(_id(project_id, scene_number, "bi", idx))
            ch_query(
                f"INSERT INTO {CH_DB}.budget_items (project_id, item_id, category, sub_category, "
                f"description, budgeted_usd, actual_usd, vendor, scene_id) "
                f"VALUES ({{p:String}}, {{i:UInt32}}, {{cat:String}}, {{sub:String}}, "
                f"{{d:String}}, {{b:Float64}}, 0, {{v:String}}, {{s:UInt32}})",
                {
                    "p": project_id, "i": _id(project_id, scene_number, "bi", idx),
                    "cat": "VFX" if etype in ("vfx", "sfx") else "Production",
                    "sub": etype.upper(), "d": f"{scene_number} — {name}",
                    "b": cost, "v": vendor, "s": scene_id,
                },
            )

    for idx, shot in enumerate(bd.get("shots", []), start=1):
        code = str(shot.get("shot_code") or f"{scene_number}-{chr(64 + idx)}")
        written["shots"].add(_id(project_id, code))
        ch_query(
            f"INSERT INTO {CH_DB}.shots "
            f"(project_id, shot_id, scene_id, shot_code, lens_mm, movement, framing, description, status) "
            f"VALUES ({{p:String}}, {{sh:UInt32}}, {{s:UInt32}}, {{c:String}}, {{l:UInt16}}, "
            f"{{m:String}}, {{f:String}}, {{d:String}}, 'planned')",
            {
                "p": project_id, "sh": _id(project_id, code), "s": scene_id, "c": code,
                "l": max(8, min(1000, int(shot.get("lens_mm") or 50))),
                "m": str(shot.get("movement", "Static")),
                "f": str(shot.get("framing", "WS"))[:12],
                "d": str(shot.get("description", ""))[:1000],
            },
        )


def _assign_shoot_days(project_id: str) -> None:
    """Pack scenes into shoot days, company-move-aware.

    The breakdown agent has no visibility into the shoot's overall day count
    or other scenes' locations, so every scene comes back with its own
    guess at a shoot day — scheduling is inherently a whole-project decision. Grouping by
    location and time of day (so the unit shoots out a location before moving)
    and filling each day to the project's page target is standard 1st AD
    practice and needs no model call.
    """
    rows = ch_query(
        f"SELECT scene_id, location, time_of_day, page_count FROM {CH_DB}.scenes FINAL "
        f"WHERE project_id = {{p:String}}",
        {"p": project_id},
    ).get("data", [])
    if not rows:
        return
    target = ch_query(
        f"SELECT shoot_days FROM {CH_DB}.projects FINAL WHERE project_id = {{p:String}} LIMIT 1",
        {"p": project_id},
    ).get("data", [[1]])
    target_days = max(1, int(target[0][0] or 1))

    total_pages = sum(float(r[3] or 0) for r in rows) or 1.0
    pages_per_day = total_pages / target_days

    rows.sort(key=lambda r: (str(r[1]), str(r[2])))
    day, used = 1, 0.0
    ids: List[int] = []
    days: List[int] = []
    for scene_id, _loc, _tod, page_count in rows:
        pages = float(page_count or 0.25)
        # `used > 0` guard: a single scene longer than the daily page target
        # must still start on day 1, not push itself onto day 2.
        if used > 0 and used + pages > pages_per_day and day < target_days:
            day += 1
            used = 0.0
        used += pages
        ids.append(int(scene_id))
        days.append(min(255, day))

    # One mutation for the whole project, not one per scene — ClickHouse
    # mutations are expensive and a feature runs to ~90 scenes.
    ch_query(
        f"ALTER TABLE {CH_DB}.scenes UPDATE shoot_day = transform(scene_id, "
        f"[{','.join(str(i) for i in ids)}], [{','.join(str(d) for d in days)}], shoot_day) "
        f"WHERE project_id = {{p:String}}",
        {"p": project_id},
    )


# ── Tool 1: ingest ─────────────────────────────────────────────────────────

def ingest_project_script(project_id: str) -> dict:
    """Split a project's uploaded screenplay into scenes and run the full AI
    production breakdown on every scene, writing scenes, cast, elements, shots
    and budget lines into ClickHouse. Use this when a new project's script has
    been uploaded and needs to be turned into a production database."""
    rows = ch_query(
        # FINAL: projects is a ReplacingMergeTree, so an edited script leaves the
        # old row in place until a merge. Without it a re-ingest can read the
        # superseded (or empty) script_text.
        f"SELECT script_text, name FROM {CH_DB}.projects FINAL WHERE project_id = {{p:String}} LIMIT 1",
        {"p": project_id},
    ).get("data", [])
    if not rows or not (rows[0][0] or "").strip():
        return {"error": f"Project {project_id} has no script text stored."}

    script_text, project_name = rows[0][0], rows[0][1]

    parsed = StoryCrew.parse_script(script_text)
    bodies = _split_scene_text(script_text)
    if len(bodies) != len(parsed):
        # Parsers disagreed — keep the structured scenes, lose only the prose.
        bodies = [""] * len(parsed)

    job_id = create_job(project_id, "ingest", total=len(parsed))
    written: Dict[str, set] = {
        t: set() for t in
        ("scenes", "shots", "elements", "cast_members", "scene_cast", "budget_items")
    }

    scenes: List[SceneRow] = []
    for idx, scene in enumerate(parsed):
        scene_number = f"SC-{idx + 1:03d}"
        scene_id = _id(project_id, scene_number)
        ch_query(
            f"INSERT INTO {CH_DB}.scenes (project_id, scene_id, scene_number, int_ext, location, "
            f"time_of_day, page_count, shoot_day, status, description, scene_text) "
            f"VALUES ({{p:String}}, {{sid:UInt32}}, {{sn:String}}, {{ie:String}}, {{loc:String}}, "
            f"{{tod:String}}, {{pc:Float32}}, 1, 'scheduled', {{desc:String}}, {{txt:String}})",
            {
                "p": project_id, "sid": scene_id, "sn": scene_number,
                "ie": scene.setting, "loc": scene.location, "tod": scene.time_of_day,
                "pc": float(scene.page_count), "desc": scene.synopsis,
                "txt": bodies[idx][:20000],
            },
        )
        written["scenes"].add(scene_id)
        scenes.append(
            SceneRow(
                scene_id=scene_id,
                scene_number=scene_number,
                location=scene.location,
                scene_text=bodies[idx] or scene.synopsis,
                characters=list(scene.characters),
            )
        )

    batches = _batch_scenes(scenes)
    _job_update(
        job_id,
        message=f"Split into {len(scenes)} scenes across {len(batches)} AI calls. Breaking down…",
    )

    done = threading.Lock()
    counters = {"ai_ok": 0, "heuristic_fallback": 0}

    def _norm(num: str) -> str:
        return re.sub(r"[^A-Z0-9]", "", num.upper())

    def _one_batch(batch: List[SceneRow]) -> None:
        prompt = _build_batch_prompt(project_name, batch)
        result = None
        for attempt in range(2):
            try:
                result = _run_agent_sync(breakdown_agent, prompt)
                if result and result.get("scenes"):
                    break
            except Exception as exc:  # noqa: BLE001
                if attempt == 1:
                    print(f"⚠️  batch of {len(batch)} scenes failed: {exc}")
                time.sleep(1.5)

        by_number = {}
        for bd in (result or {}).get("scenes", []):
            key = _norm(str(bd.get("scene_number", "")))
            if key:
                by_number[key] = bd

        with done:
            for scene in batch:
                bd = by_number.get(_norm(scene.scene_number))
                if bd:
                    try:
                        _merge_heuristic_cast(bd, scene.characters)
                        _save_breakdown(project_id, scene, bd, written)
                        counters["ai_ok"] += 1
                    except Exception as exc:  # noqa: BLE001
                        print(f"⚠️  {scene.scene_number} save failed, using heuristic fallback: {exc}")
                        _save_heuristic_only(project_id, scene, written)
                        counters["heuristic_fallback"] += 1
                else:
                    _save_heuristic_only(project_id, scene, written)
                    counters["heuristic_fallback"] += 1
                _job_update(
                    job_id,
                    done=counters["ai_ok"] + counters["heuristic_fallback"],
                    message=(
                        f"{counters['ai_ok']}/{len(scenes)} scenes broken down by AI, "
                        f"{counters['heuristic_fallback']} used the heuristic fallback"
                    ),
                )

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        list(pool.map(_one_batch, batches))

    _sweep_stale_rows(project_id, written)
    _assign_shoot_days(project_id)
    ch_query(
        f"ALTER TABLE {CH_DB}.projects UPDATE status = 'active' WHERE project_id = {{p:String}}",
        {"p": project_id},
    )
    _job_update(
        job_id,
        status="done" if counters["heuristic_fallback"] == 0 else "partial",
        done=len(scenes),
        message=f"{counters['ai_ok']} scenes broken down by AI, {counters['heuristic_fallback']} used heuristic fallback",
    )
    return {
        "project_id": project_id,
        "job_id": job_id,
        "scenes_created": len(scenes),
        "scenes_broken_down": counters["ai_ok"],
        "scenes_heuristic_fallback": counters["heuristic_fallback"],
    }


# ── Tool 2: storyboards ────────────────────────────────────────────────────

# Free image generation via pollinations.ai (no key, no billing) — the flux
# model. Gemini's own image models (gemini-2.5-flash-image, imagen-*) need a
# billing-enabled Google Cloud project even at low volume (verified: a real,
# unrestricted AI Studio key still gets `limit: 0` on the free tier for
# every image model), so they are not usable here for free. Swap back to
# them later by pointing this at generate_content if that ever changes.
POLLINATIONS_MODEL = os.environ.get("POLLINATIONS_MODEL", "flux")

# pollinations.ai rate-limits anonymous requests per IP — the scene fan-out
# would otherwise fire MAX_WORKERS requests at once and collect 429s.
_IMAGE_SLOTS = threading.Semaphore(int(os.environ.get("PIPELINE_IMAGE_WORKERS", "2")))


def _generate_image(prompt: str) -> tuple[Optional[bytes], Optional[str]]:
    """Returns (image_bytes, error). error is None on success, so a caller can
    tell "really generated" apart from "fell back to a placeholder" instead of
    both looking identical, which is what made this look broken before."""
    full = (
        "Cinematic film still, photorealistic, dramatic lighting, "
        "anamorphic widescreen, highly detailed. " + prompt[:400]
    )
    url = (
        "https://image.pollinations.ai/prompt/" + urllib.parse.quote(full)
        + f"?width=1024&height=576&nologo=true&model={POLLINATIONS_MODEL}"
    )
    last_error = None
    for attempt in range(3):
        with _IMAGE_SLOTS:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "cinemalit-storyboard"})
                with urllib.request.urlopen(req, timeout=60) as resp:
                    data = resp.read()
                    if data:
                        return data, None
                    return None, "pollinations.ai returned an empty response."
            except Exception as exc:  # noqa: BLE001
                last_error = exc
        if attempt < 2 and "429" in str(last_error):
            time.sleep(8 * (attempt + 1))
        else:
            break
    error_msg = str(last_error)
    print(f"⚠️  Image generation failed ({error_msg}) — using placeholder.")
    return None, error_msg


def _placeholder_image(scene_num: str, frame_num: int) -> Optional[bytes]:
    """Reuse a bundled storyboard asset when image generation is unavailable."""
    assets = ["sc1_f1.jpg", "sc1_f2.jpg", "sc1_f3.jpg", "storyboard_sc2.jpg", "storyboard_sc3.jpg"]
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    pick = assets[(int(re.sub(r"\D", "", scene_num) or 0) + frame_num) % len(assets)]
    path = os.path.join(root, "cinemalit-studio", "public", pick)
    if os.path.exists(path):
        with open(path, "rb") as handle:
            return handle.read()
    return None


def generate_project_storyboards(
    project_id: str, interval_sec: int = 5, scene_number: str = ""
) -> dict:
    """Generate AI storyboard frames for a project — timed frame sequences with
    camera specs and generated images, saved to the storyboards table. Covers
    every scene by default; pass scene_number (e.g. 'SC-003') to redo just one.
    Use after a project's script has been ingested and broken down."""
    if not _SAFE_PATH_COMPONENT.match(project_id):
        # project_id becomes a directory name below — this tool is reachable
        # from freeform chat, so the model's chosen argument must be treated
        # as untrusted input before it touches the filesystem.
        return {"error": f"Invalid project_id {project_id!r}."}
    where = "project_id = {p:String}"
    params: Dict[str, Any] = {"p": project_id}
    if scene_number:
        where += " AND scene_number = {sn:String}"
        params["sn"] = scene_number
    scenes = ch_query(
        f"SELECT scene_id, scene_number, scene_text, description, page_count "
        f"FROM {CH_DB}.scenes FINAL WHERE {where} ORDER BY scene_id",
        params,
    ).get("data", [])
    if not scenes:
        return {"error": f"Project {project_id} has no matching scenes. Ingest the script first."}

    job_id = create_job(project_id, "storyboard", total=len(scenes))
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    counters = {"frames": 0, "done": 0, "failed": 0, "images_real": 0, "images_placeholder": 0}
    last_image_error: List[str] = []
    lock = threading.Lock()

    def _one(row: list) -> None:
        scene_id, scene_number, scene_text, description, page_count = row
        short_num = re.sub(r"\D", "", scene_number).zfill(2)[-2:] or "01"
        shots = ch_query(
            f"SELECT shot_code, lens_mm, movement, framing, description FROM {CH_DB}.shots FINAL "
            f"WHERE project_id = {{p:String}} AND scene_id = {{s:UInt32}}",
            {"p": project_id, "s": scene_id},
        ).get("data", [])

        prompt = (
            f"Scene {scene_number}. Target interval: {interval_sec} seconds per frame. "
            f"Estimated duration: {max(6, int(float(page_count or 0.5) * 60))} seconds.\n\n"
            f"Screenplay text:\n{(scene_text or description)[:4000]}\n\n"
            f"Existing shot list: {json.dumps(shots)}"
        )
        try:
            result = _run_agent_sync(storyboard_agent, prompt)
        except Exception as exc:  # noqa: BLE001
            print(f"⚠️  {scene_number} storyboard failed: {exc}")
            result = None

        if not result or not result.get("frames"):
            with lock:
                counters["failed"] += 1
                counters["done"] += 1
                _job_update(job_id, done=counters["done"])
            return

        # project_id must be part of the path — two projects both have a
        # "Scene 1", and scene_{short_num} alone collided across projects,
        # silently overwriting one project's frames with another's.
        scene_dir = os.path.join(root, "storyboards", project_id, f"scene_{short_num}")
        public_dir = os.path.join(
            root, "cinemalit-studio", "public", "storyboards", project_id, f"scene_{short_num}"
        )
        os.makedirs(scene_dir, exist_ok=True)
        os.makedirs(public_dir, exist_ok=True)

        for idx, frame in enumerate(result["frames"], start=1):
            frame_prompt = str(frame.get("prompt", ""))
            data, image_error = _generate_image(frame_prompt)
            with lock:
                if image_error:
                    counters["images_placeholder"] += 1
                    last_image_error.append(image_error)
                else:
                    counters["images_real"] += 1
            is_placeholder = data is None
            data = data or _placeholder_image(short_num, idx)
            file_name = f"frame_{idx:02d}.jpg"
            if data:
                for directory in (scene_dir, public_dir):
                    with open(os.path.join(directory, file_name), "wb") as handle:
                        handle.write(data)
            ch_query(
                f"INSERT INTO {CH_DB}.storyboards (project_id, scene_num, frame_num, title, "
                f"camera_spec, start_sec, end_sec, prompt, img_url, is_placeholder) "
                f"VALUES ({{p:String}}, {{s:String}}, {{f:UInt8}}, {{t:String}}, {{c:String}}, "
                f"{{ss:Int32}}, {{es:Int32}}, {{pr:String}}, {{iu:String}}, {{ph:UInt8}})",
                {
                    "p": project_id, "s": short_num, "f": min(255, idx),
                    "t": str(frame.get("title", f"Frame {idx:02d}")),
                    "c": str(frame.get("camera_spec", "50mm Anamorphic")),
                    "ss": int(frame.get("start_sec") or (idx - 1) * interval_sec),
                    "es": int(frame.get("end_sec") or idx * interval_sec),
                    "pr": frame_prompt,
                    "iu": f"/storyboards/{project_id}/scene_{short_num}/{file_name}",
                    "ph": 1 if is_placeholder else 0,
                },
            )
            with lock:
                counters["frames"] += 1

        # Trim frames left behind by a longer previous run. Swept AFTER the
        # inserts and only for frame numbers we did NOT just write: a
        # lightweight DELETE on a key masks later inserts of that same key,
        # so regenerating a scene must never delete the keys it re-adds.
        ch_query(
            f"DELETE FROM {CH_DB}.storyboards WHERE project_id = {{p:String}} "
            f"AND scene_num = {{s:String}} AND frame_num > {{n:UInt8}}",
            {"p": project_id, "s": short_num, "n": min(255, len(result["frames"]))},
        )

        with lock:
            counters["done"] += 1
            _job_update(
                job_id,
                done=counters["done"],
                message=f"{counters['frames']} frames across {counters['done']} scenes",
            )

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        list(pool.map(_one, scenes))

    image_error = last_image_error[-1] if last_image_error else ""
    message = f"{counters['frames']} frames generated ({counters['images_real']} AI, {counters['images_placeholder']} placeholder)"
    _job_update(
        job_id,
        status="done" if counters["failed"] == 0 else "partial",
        done=len(scenes),
        message=message,
        error=image_error if counters["images_real"] == 0 and counters["images_placeholder"] > 0 else "",
    )
    return {
        "project_id": project_id,
        "job_id": job_id,
        "scenes": len(scenes),
        "frames_generated": counters["frames"],
        "scenes_failed": counters["failed"],
        "images_real": counters["images_real"],
        "images_placeholder": counters["images_placeholder"],
        "image_error": image_error,
    }


PIPELINE_TOOLS = [ingest_project_script, generate_project_storyboards]
