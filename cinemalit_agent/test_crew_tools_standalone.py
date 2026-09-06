"""
Standalone verification for the 11 ClickHouse-backed crew tools
(cinemalit_agent/crew_tools.py) — no Gemini API key needed.

Run from the repo root:
    PYTHONPATH=. .venv/Scripts/python.exe -m cinemalit_agent.test_crew_tools_standalone

Requires: the docker-compose ClickHouse container running and seeded
(scripts/setup_clickhouse_schema.sql).
"""

import sys
import time

from web.db import ch_query
from cinemalit_agent.crew_tools import (
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
    query_studio_memory,
)

PASS = "PASS"
FAIL = "FAIL"


def check(label: str, condition: bool, detail: str = "") -> bool:
    status = PASS if condition else FAIL
    print(f"[{status}] {label}" + (f" — {detail}" if detail and not condition else ""))
    return condition


def main() -> int:
    all_ok = True

    # --- list_scenes: reads live seeded scenes, cast attached ---
    scenes_result = list_scenes()
    all_ok &= check(
        "list_scenes returns the 9 seeded scenes with cast attached",
        len(scenes_result["scenes"]) == 9 and any(s["characters"] for s in scenes_result["scenes"]),
        str(scenes_result)[:300],
    )

    # --- find_risks: real risk radar computed from live scene data ---
    risks_result = find_risks()
    all_ok &= check(
        "find_risks computes real risks from live scene data (e.g. night exteriors)",
        len(risks_result["risks"]) > 0,
        str(risks_result)[:300],
    )

    # --- production_breakdown: real departmental items ---
    breakdown_result = production_breakdown()
    all_ok &= check(
        "production_breakdown computes real production items",
        len(breakdown_result["production_items"]) > 0,
        str(breakdown_result)[:300],
    )

    # --- estimate_budget_pressure: real numbers ---
    budget_result = estimate_budget_pressure(target_budget=5000.0)
    all_ok &= check(
        "estimate_budget_pressure computes a real total against the target cap",
        budget_result["total_estimated"] > 0 and budget_result["max_target"] == 5000.0,
        str(budget_result)[:300],
    )

    # --- suggest_budget_savings ---
    savings_result = suggest_budget_savings(target_budget=100.0)  # force OVER_BUDGET to guarantee proposals
    all_ok &= check(
        "suggest_budget_savings returns proposals when clearly over budget",
        len(savings_result["savings_proposals"]) > 0,
        str(savings_result)[:300],
    )

    # --- generate_schedule ---
    schedule_result = generate_schedule(target_days=2)
    all_ok &= check(
        "generate_schedule produces a real multi-day plan from live scenes",
        schedule_result["total_days"] > 0 and len(schedule_result["days"]) > 0,
        str(schedule_result)[:300],
    )

    # --- create_production_tasks ---
    tasks_result = create_production_tasks()
    all_ok &= check(
        "create_production_tasks generates real tasks from live scene/risk/schedule data",
        len(tasks_result["tasks"]) > 0,
        str(tasks_result)[:300],
    )

    # --- analyze_script: real write, then clean up ---
    TEST_SCRIPT = "INT. TEST STAGE - DAY\n\nA lone test scene for verification purposes only.\n"
    before_count = ch_query("SELECT count() FROM cinemalit.scenes").get("data", [[0]])[0][0]
    analyze_result = analyze_script(TEST_SCRIPT)
    after_count = ch_query("SELECT count() FROM cinemalit.scenes").get("data", [[0]])[0][0]
    all_ok &= check(
        "analyze_script parses and writes new scenes to ClickHouse",
        analyze_result["scenes_written"] == 1 and after_count == before_count + 1,
        f"before={before_count} after={after_count} result={analyze_result}",
    )
    # Clean up the test scene
    ch_query(
        "ALTER TABLE cinemalit.scenes DELETE WHERE description = {d:String}",
        {"d": "A lone test scene for verification purposes only."},
    )
    cleaned = False
    for _ in range(10):
        remaining = ch_query(
            "SELECT count() FROM cinemalit.scenes WHERE description = {d:String}",
            {"d": "A lone test scene for verification purposes only."},
        ).get("data", [[1]])[0][0]
        if remaining == 0:
            cleaned = True
            break
        time.sleep(0.5)
    all_ok &= check("test scene cleaned up (idempotent re-runs)", cleaned)

    # --- request_gate_approval: real write to governance_gates, then verify + clean up ---
    TEST_GATE_ID = "test-gate-verify-standalone"
    approve_result = request_gate_approval(TEST_GATE_ID, "Test Gate", "Verifying standalone")
    all_ok &= check(
        "request_gate_approval persists an approval decision",
        approve_result["status"] == "SUCCESS",
        str(approve_result),
    )
    stored_gate = ch_query(
        "SELECT status FROM cinemalit.governance_gates WHERE gate_id = {g:String} ORDER BY updated_at DESC LIMIT 1",
        {"g": TEST_GATE_ID},
    )
    all_ok &= check(
        "approved gate is actually readable back from ClickHouse",
        stored_gate.get("data") and stored_gate["data"][0][0] == "APPROVED",
        str(stored_gate),
    )
    ch_query(
        "ALTER TABLE cinemalit.governance_gates DELETE WHERE gate_id = {g:String}", {"g": TEST_GATE_ID}
    )

    # --- get_audit_log: confirm the analyze_script/approval actions above were logged ---
    audit_result = get_audit_log()
    all_ok &= check(
        "get_audit_log returns entries logged by the actions above",
        any(e["action"] == "APPROVE_GATE" for e in audit_result["audit_logs"]),
        str(audit_result)[:300],
    )

    # --- query_studio_memory: dispatches correctly by keyword ---
    mem_budget = query_studio_memory("what is our budget status")
    mem_risk = query_studio_memory("any risks I should know about")
    mem_default = query_studio_memory("tell me about the scenes")
    all_ok &= check(
        "query_studio_memory dispatches 'budget' queries to real budget data",
        "total_estimated" in mem_budget,
        str(mem_budget)[:200],
    )
    all_ok &= check(
        "query_studio_memory dispatches 'risk' queries to real risk data",
        "risks" in mem_risk,
        str(mem_risk)[:200],
    )
    all_ok &= check(
        "query_studio_memory falls back to scenes for unrecognized queries",
        "scenes" in mem_default,
        str(mem_default)[:200],
    )

    print()
    print("ALL CHECKS PASSED" if all_ok else "SOME CHECKS FAILED")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
