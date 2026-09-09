"""
End-to-end check for the agent ingest pipeline.

Creates a throwaway project, has the Director Agent ingest a screenplay, and
asserts the breakdown actually landed across every table. Costs a handful of
real Gemini calls, so it is not a unit test — run it when the pipeline or the
schema changes.

    python scripts/test_pipeline_e2e.py

Add --storyboards to also exercise storyboard generation (slower).
"""

import os
import sys
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

from cinemalit_agent import pipeline
from web.db import CH_DB, ch_query

# Fresh id per run on purpose: ClickHouse lightweight deletes mask a key for
# LATER inserts too, so a test that reused one id would stop being able to
# recreate its own project after the first cleanup.
PROJECT_ID = f"test_e2e_{uuid.uuid4().hex[:8]}"

SCRIPT = """Title: Test Reel

INT. SERVER ROOM - NIGHT

Cold blue light. RAYA (30s) yanks a drive from a humming rack. Sparks spit
from a severed cable.

RAYA
Thirty seconds and this whole floor goes dark.

EXT. LOADING BAY - NIGHT

Rain sheets across concrete. Raya sprints for a waiting van as a SECURITY
DRONE swings its floodlight around.

RAYA
(breathless)
Go, go, go!
"""


def _count(table: str) -> int:
    return ch_query(
        f"SELECT count() FROM {CH_DB}.{table} FINAL WHERE project_id = {{p:String}}",
        {"p": PROJECT_ID},
    ).get("data", [[0]])[0][0]


def main() -> int:
    # No pre-delete: a lightweight DELETE is an async mutation that can still
    # swallow rows inserted right after it. projects is a ReplacingMergeTree,
    # so re-inserting the same key is enough, and the pipeline sweeps its own
    # stale rows after the ingest.
    ch_query(
        f"INSERT INTO {CH_DB}.projects (project_id, user_id, name, format, genre, budget_cap, "
        f"shoot_days, union_scale, selected_agents, script_file, script_text, status) "
        f"VALUES ({{p:String}}, 'test', 'Pipeline E2E', 'Short Film', 'Thriller', 5000, 2, "
        f"'ULB', [], 'test.fountain', {{t:String}}, 'ingesting')",
        {"p": PROJECT_ID, "t": SCRIPT},
    )

    print("Ingesting via the Director Agent…")
    result = pipeline.ingest_project_script(PROJECT_ID)
    print(" ", result)

    assert result.get("scenes_created") == 2, f"expected 2 scenes, got {result}"
    assert result.get("scenes_heuristic_fallback") == 0, f"breakdown failures: {result}"

    scenes = ch_query(
        f"SELECT scene_number, int_ext, time_of_day, shoot_day, length(scene_text) "
        f"FROM {CH_DB}.scenes FINAL WHERE project_id = {{p:String}} ORDER BY scene_id",
        {"p": PROJECT_ID},
    ).get("data", [])
    for row in scenes:
        print("  scene", row)
        assert row[4] > 0, f"{row[0]} lost its screenplay text"

    days = sorted({row[3] for row in scenes})
    assert days[0] == 1, f"first shoot day should be 1, got {days}"

    counts = {t: _count(t) for t in ("shots", "elements", "cast_members", "scene_cast")}
    print("  counts", counts)
    assert counts["shots"] > 0, "no shots written — Phase 2 breakdown did not persist"
    assert counts["cast_members"] > 0, "no cast written — scene_cast/cast_members still empty"
    assert counts["scene_cast"] > 0, "cast not linked to scenes"

    # Raya speaks in both scenes but must exist once, not twice.
    raya = ch_query(
        f"SELECT count() FROM {CH_DB}.cast_members FINAL WHERE project_id = {{p:String}} "
        f"AND upper(character_name) = 'RAYA'",
        {"p": PROJECT_ID},
    ).get("data", [[0]])[0][0]
    assert raya == 1, f"expected RAYA deduped to one cast row, got {raya}"

    if "--storyboards" in sys.argv:
        print("Generating storyboards…")
        sb = pipeline.generate_project_storyboards(PROJECT_ID, interval_sec=5)
        print(" ", sb)
        assert sb.get("frames_generated", 0) > 0, "no storyboard frames written"
        if sb.get("images_real", 0) == 0:
            print(f"  ⚠️  all frames used placeholder images — image_error: {sb.get('image_error')}")

    print("\n✅ Pipeline end-to-end check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
