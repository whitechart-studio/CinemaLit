"""
Standalone verification for the CinemaLit Director Agent — no Gemini API key needed.

Checks:
  1. The 3 ported tool functions work against the live ClickHouse instance,
     identically to how web/server.py's chat handler already uses them.
  2. The ADK Agent object constructs cleanly with all tools attached.
  3. The ClickHouse MCP toolset object constructs cleanly (isolation from the
     project's own `mcp<2` pin was already verified separately via `uvx`).

Run from the repo root:
    PYTHONPATH=. .venv/Scripts/python.exe -m cinemalit_agent.test_tools_standalone

Requires: the docker-compose ClickHouse container running and seeded
(scripts/setup_clickhouse_schema.sql). Does NOT require GOOGLE_API_KEY.
"""

import sys

from web.db import ch_query
from cinemalit_agent.tools import CINEMALIT_TOOLS, query_production_db, get_scene_details, add_scene_element

PASS = "PASS"
FAIL = "FAIL"


def check(label: str, condition: bool, detail: str = "") -> bool:
    status = PASS if condition else FAIL
    print(f"[{status}] {label}" + (f" — {detail}" if detail and not condition else ""))
    return condition


def main() -> int:
    all_ok = True

    # --- 1. query_production_db: real SELECT works ---
    result = query_production_db(f"SELECT scene_number, location FROM cinemalit.scenes ORDER BY scene_number LIMIT 3")
    all_ok &= check(
        "query_production_db returns rows for a real SELECT",
        "data" in result and len(result["data"]) > 0,
        str(result),
    )

    # --- 2. query_production_db: rejects non-SELECT (existing safety behavior) ---
    blocked = query_production_db("DELETE FROM cinemalit.scenes WHERE 1=1")
    all_ok &= check(
        "query_production_db still rejects non-SELECT queries",
        blocked.get("error") == "Only SELECT queries are allowed via this tool.",
        str(blocked),
    )

    # --- 3. get_scene_details: real scene lookup ---
    details = get_scene_details("SC-001")
    all_ok &= check(
        "get_scene_details returns scene_info/cast/elements/shots for SC-001",
        "scene_info" in details and "error" not in details,
        str(details),
    )

    # --- 4. get_scene_details: missing scene handled gracefully ---
    missing = get_scene_details("SC-999-DOES-NOT-EXIST")
    all_ok &= check(
        "get_scene_details handles a missing scene without crashing",
        "error" in missing,
        str(missing),
    )

    # --- 5. add_scene_element: real write, then clean up after ourselves ---
    TEST_NAME = "TEST_ELEMENT_VERIFY_STANDALONE"
    add_result = add_scene_element("SC-001", "prop", TEST_NAME, 1.23, "test-harness")
    all_ok &= check(
        "add_scene_element inserts a new element row",
        add_result.get("status") == "success",
        str(add_result),
    )
    ch_query(f"ALTER TABLE cinemalit.elements DELETE WHERE name = {{n:String}}", {"n": TEST_NAME})
    # ALTER ... DELETE is an async mutation in ClickHouse — poll briefly rather
    # than assuming it's applied immediately after the query returns.
    import time
    cleaned = False
    for _ in range(10):
        cleanup_check = ch_query(
            "SELECT count() FROM cinemalit.elements WHERE name = {n:String}", {"n": TEST_NAME}
        )
        if cleanup_check.get("data", [[1]])[0][0] == 0:
            cleaned = True
            break
        time.sleep(0.5)
    all_ok &= check(
        "test element cleaned up (idempotent re-runs)",
        cleaned,
        str(cleanup_check),
    )

    # --- 6. ADK Agent object constructs cleanly ---
    from cinemalit_agent.agent import root_agent
    all_ok &= check(
        "root_agent constructs with expected name",
        root_agent.name == "cinemalit_director",
    )
    all_ok &= check(
        "root_agent has all 3 direct tools + the ClickHouse MCP toolset attached",
        len(root_agent.tools) == len(CINEMALIT_TOOLS) + 1,
        f"tools={root_agent.tools}",
    )

    print()
    print("ALL CHECKS PASSED" if all_ok else "SOME CHECKS FAILED")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
