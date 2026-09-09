"""
ClickHouse-backed ports of the original 12 CLI/local-MCP crew tools
(cinemalit/mcp/server.py), so the Director Agent — not just the CLI or an
external MCP client — can use them.

The CLI/local MCP server's tools all read/write a local `.cinemalit/state.json`
file, which doesn't exist anywhere in the agent's (hosted, ClickHouse-backed)
world. These versions run the exact same, unchanged crew logic
(cinemalit/crews/*.py) but source their input from — and, where the tool is
genuinely a write, persist to — the live ClickHouse `cinemalit` database
instead, the same one every other part of the web app already uses.

`studio.ask_gemini` is intentionally NOT ported — redundant once the agent
itself IS Gemini.

Read/write split (mirrors the CLI's own, verified by testing there):
  - Pure reads / fresh recompute over live data: analyze_script (read + write,
    see below), list_scenes, find_risks, production_breakdown,
    estimate_budget_pressure, suggest_budget_savings, generate_schedule,
    create_production_tasks, query_studio_memory.
  - Genuine writes: analyze_script (inserts newly parsed scenes),
    request_gate_approval (persists an approval decision).
"""

import zlib
from typing import List

from dotenv import load_dotenv

load_dotenv(".env")

from web.db import ch_query
from cinemalit.core.models import ProjectState, Scene
from cinemalit.crews.story import StoryCrew
from cinemalit.crews.production import ProductionCrew
from cinemalit.crews.budget import BudgetCrew
from cinemalit.crews.schedule import ScheduleCrew
from cinemalit.crews.ops import OpsCrew

def _ensure_tables() -> None:
    """Create the two new tables these tools need, if they don't exist yet.
    Same on-demand, non-fatal pattern web/server.py uses for its users table
    (ensure_users_table) — a transient network hiccup here shouldn't crash
    the whole agent import, especially since these tables already exist after
    the first successful run anyway."""
    try:
        ch_query(
            """
            CREATE TABLE IF NOT EXISTS cinemalit.governance_gates (
                project_id String,
                gate_id    String,
                gate_name  String,
                status     LowCardinality(String),
                rationale  String,
                updated_at DateTime DEFAULT now()
            ) ENGINE = MergeTree()
            ORDER BY (project_id, gate_id)
            """
        )
        ch_query(
            """
            CREATE TABLE IF NOT EXISTS cinemalit.agent_audit_log (
                project_id String,
                timestamp  DateTime DEFAULT now(),
                actor      String,
                action     String,
                details    String
            ) ENGINE = MergeTree()
            ORDER BY (project_id, timestamp)
            """
        )
    except Exception as exc:
        print(f"⚠️  Could not ensure governance_gates/agent_audit_log tables: {exc}")


_ensure_tables()


def _log_audit(actor: str, action: str, details: str, project_id: str) -> None:
    ch_query(
        "INSERT INTO cinemalit.agent_audit_log (project_id, actor, action, details) "
        "VALUES ({p:String}, {a:String}, {ac:String}, {d:String})",
        {"p": project_id, "a": actor, "ac": action, "d": details},
    )


def _load_scenes_from_clickhouse(project_id: str) -> List[Scene]:
    """Reconstructs Scene objects from the live ClickHouse tables (scenes +
    scene_cast + cast_members) for ONE project, so the unchanged crew logic can
    run against them exactly as it would against a locally-ingested script."""
    scenes_result = ch_query(
        "SELECT scene_id, scene_number, int_ext, location, time_of_day, page_count, description "
        "FROM cinemalit.scenes FINAL WHERE project_id = {p:String} ORDER BY scene_number",
        {"p": project_id},
    )
    cast_result = ch_query(
        "SELECT sc.scene_id, cm.character_name "
        "FROM cinemalit.scene_cast AS sc FINAL "
        "JOIN cinemalit.cast_members AS cm FINAL ON sc.cast_id = cm.cast_id "
        "WHERE sc.project_id = {p:String}",
        {"p": project_id},
    )
    characters_by_scene = {}
    for scene_id, character_name in cast_result.get("data", []):
        characters_by_scene.setdefault(scene_id, []).append(character_name)

    scenes = []
    for scene_id, scene_number, int_ext, location, time_of_day, page_count, description in scenes_result.get("data", []):
        scenes.append(
            Scene(
                id=str(scene_id),
                number=scene_number,
                header=f"{int_ext}. {location} — {time_of_day}",
                location=location,
                setting=int_ext,
                time_of_day=time_of_day,
                page_count=float(page_count),
                synopsis=description,
                characters=characters_by_scene.get(scene_id, []),
            )
        )
    return scenes


def _build_state_from_clickhouse(project_id: str) -> ProjectState:
    state = ProjectState(project_id=project_id, name="CinemaLit Live Project")
    state.scenes = _load_scenes_from_clickhouse(project_id)
    return state


def analyze_script(script_text: str, project_id: str) -> dict:
    """Parse raw screenplay text into structured scenes and write them into
    the live ClickHouse scenes table, so they're immediately available to
    every other tool. Returns how many scenes were written and their data."""
    scenes = StoryCrew.parse_script(script_text)

    for idx, s in enumerate(scenes):
        # Deterministic per-project id — the old MAX(scene_id)+1 both raced and
        # ignored project scoping entirely.
        ch_query(
            "INSERT INTO cinemalit.scenes "
            "(project_id, scene_id, scene_number, int_ext, location, time_of_day, page_count, shoot_day, status, description) "
            "VALUES ({p:String}, {sid:UInt32}, {sn:String}, {ie:String}, {loc:String}, {tod:String}, {pc:Float32}, {sd:UInt8}, {st:String}, {desc:String})",
            {
                "p": project_id,
                "sid": zlib.crc32(f"{project_id}:{s.number}".encode()) or 1,
                "sn": s.number,
                "ie": s.setting,
                "loc": s.location,
                "tod": s.time_of_day,
                "pc": s.page_count,
                "sd": 1,
                "st": "scheduled",
                "desc": s.synopsis,
            },
        )
    _log_audit("DIRECTOR_AGENT", "ANALYZE_SCRIPT", f"Wrote {len(scenes)} scenes", project_id)
    return {"scenes_written": len(scenes), "scenes": [s.__dict__ for s in scenes]}


def list_scenes(project_id: str) -> dict:
    """List all scenes currently stored in ClickHouse, with cast attached."""
    state = _build_state_from_clickhouse(project_id)
    return {"scenes": [s.__dict__ for s in state.scenes]}


def find_risks(project_id: str) -> dict:
    """Compute the current production risk radar from live ClickHouse scene data."""
    state = _build_state_from_clickhouse(project_id)
    _, risks = ProductionCrew.breakdown(state)
    return {"risks": [r.__dict__ for r in risks]}


def production_breakdown(project_id: str) -> dict:
    """Compute the departmental production breakdown (props/cast/gear/etc) from live scene data."""
    state = _build_state_from_clickhouse(project_id)
    items, _ = ProductionCrew.breakdown(state)
    return {"production_items": [i.__dict__ for i in items]}


def estimate_budget_pressure(project_id: str, target_budget: float = 5000.0) -> dict:
    """Estimate budget pressure against a target cap, using live scene data."""
    state = _build_state_from_clickhouse(project_id)
    summary = BudgetCrew.calculate_budget(state, target_budget=target_budget)
    return summary.__dict__


def suggest_budget_savings(project_id: str, target_budget: float = 5000.0) -> dict:
    """Suggest tactical budget savings and trade-offs, using live scene data."""
    state = _build_state_from_clickhouse(project_id)
    summary = BudgetCrew.calculate_budget(state, target_budget=target_budget)
    return {"savings_proposals": summary.savings_proposals}


def generate_schedule(project_id: str, target_days: int = 2) -> dict:
    """Generate an optimized stripboard shoot schedule from live scene data, and PERSIST it —
    every scene's shoot_day is written to the database, so the Stripboard/Call Sheet tabs show
    the new plan immediately. This is a real reschedule, not just a preview."""
    state = _build_state_from_clickhouse(project_id)
    plan = ScheduleCrew.generate_plan(state, target_days=target_days)
    for day in plan.days:
        for scene_id in day.scene_ids:
            ch_query(
                "ALTER TABLE cinemalit.scenes UPDATE shoot_day = {d:UInt8} "
                "WHERE project_id = {p:String} AND scene_id = {s:UInt32}",
                {"p": project_id, "d": day.day_number, "s": int(scene_id)},
            )
    return plan.__dict__


def create_production_tasks(project_id: str) -> dict:
    """Generate actionable production tasks/prep checklist from live scene, risk, and schedule data."""
    state = _build_state_from_clickhouse(project_id)
    _, state.risks = ProductionCrew.breakdown(state)
    state.schedule = ScheduleCrew.generate_plan(state)
    tasks = OpsCrew.create_tasks(state)
    return {"tasks": [t.__dict__ for t in tasks]}


def request_gate_approval(gate_id: str, gate_name: str, project_id: str, rationale: str = "Approved by Director") -> dict:
    """Approve a governance gate (e.g. a budget cap or risk threshold gate) and
    persist that decision to ClickHouse so it survives across sessions."""
    ch_query(
        "ALTER TABLE cinemalit.governance_gates DELETE WHERE project_id = {p:String} AND gate_id = {g:String}",
        {"p": project_id, "g": gate_id},
    )
    ch_query(
        "INSERT INTO cinemalit.governance_gates (project_id, gate_id, gate_name, status, rationale) "
        "VALUES ({p:String}, {g:String}, {n:String}, 'APPROVED', {r:String})",
        {"p": project_id, "g": gate_id, "n": gate_name, "r": rationale},
    )
    _log_audit("DIRECTOR_AGENT", "APPROVE_GATE", f"{gate_id}: {rationale}", project_id)
    return {"status": "SUCCESS", "gate_id": gate_id, "gate_name": gate_name}


def get_audit_log(project_id: str) -> dict:
    """Retrieve the project's decision audit trail from ClickHouse."""
    result = ch_query(
        "SELECT timestamp, actor, action, details FROM cinemalit.agent_audit_log "
        "WHERE project_id = {p:String} ORDER BY timestamp DESC LIMIT 50",
        {"p": project_id},
    )
    return {
        "audit_logs": [
            {"timestamp": str(r[0]), "actor": r[1], "action": r[2], "details": r[3]}
            for r in result.get("data", [])
        ]
    }


def ask_gemini_direct(prompt: str) -> dict:
    """Ask Gemini a direct, freeform creative/analytical question, bypassing
    normal tool-calling — for open-ended writing/brainstorming requests
    (e.g. "write an alternate ending") where forcing a specific tool doesn't
    fit. Note: since the agent itself already runs on Gemini, prefer letting
    it answer directly whenever a request doesn't need this bypass."""
    from cinemalit.core.ai import GeminiClient

    client = GeminiClient()
    if not client.is_available():
        return {"error": "GOOGLE_API_KEY is not configured.", "status": "UNCONFIGURED"}
    response = client.generate_text(prompt, system_instruction="You are the CinemaLit Studio AI Assistant.")
    return {"prompt": prompt, "response": response or "Failed to retrieve response from Gemini API."}


def query_studio_memory(query: str, project_id: str) -> dict:
    """Query structured studio knowledge — schedule, risk, or scene
    summaries — computed fresh from live ClickHouse data. For budget
    questions, use get_project_budget instead — it reads real budget_items
    figures rather than a formula estimate."""
    state = _build_state_from_clickhouse(project_id)
    query_lower = query.lower()
    if "budget" in query_lower:
        return {"error": "Use get_project_budget for real budget figures, not this tool."}
    if "risk" in query_lower:
        _, risks = ProductionCrew.breakdown(state)
        return {"risks": [r.__dict__ for r in risks]}
    if "schedule" in query_lower:
        return ScheduleCrew.generate_plan(state).__dict__
    return {"scenes": [s.__dict__ for s in state.scenes]}


CREW_TOOLS = [
    analyze_script,
    list_scenes,
    find_risks,
    production_breakdown,
    estimate_budget_pressure,
    suggest_budget_savings,
    generate_schedule,
    create_production_tasks,
    request_gate_approval,
    get_audit_log,
    ask_gemini_direct,
    query_studio_memory,
]
