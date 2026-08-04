"""
End-to-end integration test runner for CinemaLit Studio.
Verifies full pipeline execution from script ingest to director prompt,
governance approvals, and MCP tool responses.
"""

import sys
import os
import shutil

# Ensure cinemalit package is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from cinemalit.core.state import StateManager
from cinemalit.core.engine import DirectorEngine
from cinemalit.crews.story import StoryCrew
from cinemalit.mcp.server import CinemaLitMCPServer

def test_full_director_workflow():
    test_dir = os.path.abspath("test_workspace")
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)
    os.makedirs(test_dir, exist_ok=True)
    os.chdir(test_dir)

    print("🚀 STEP 1: Initialize CinemaLit Workspace")
    mgr = StateManager(test_dir)
    state = mgr.init_project("Neon Echoes Short Film")
    assert state.name == "Neon Echoes Short Film"
    print("  ✓ State initialized.")

    print("🚀 STEP 2: Ingest Fountain Screenplay")
    sample_script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "sample_script.fountain"))
    with open(sample_script_path, "r", encoding="utf-8") as f:
        script_text = f.read()

    scenes = StoryCrew.parse_script(script_text)
    assert len(scenes) == 5, f"Expected 5 scenes, got {len(scenes)}"
    state.script_path = sample_script_path
    state.scenes = scenes
    mgr.save_state(state)
    print(f"  ✓ Screenplay parsed successfully ({len(scenes)} scenes).")

    print("🚀 STEP 3: Execute Director Intent")
    engine = DirectorEngine(mgr)
    intent = "Turn this short-film script into a 2-day shoot plan under $5k"
    final_state = engine.direct(intent)

    # Validate state attributes
    assert final_state.director_intent == intent
    assert len(final_state.scenes) == 5
    assert len(final_state.risks) >= 2, f"Expected at least 2 risk items, got {len(final_state.risks)}"
    assert final_state.schedule.total_days == 2, f"Expected 2 shoot days, got {final_state.schedule.total_days}"
    assert final_state.budget.max_target == 5000.0
    assert len(final_state.tasks) > 0
    assert len(final_state.approvals) == 3
    print("  ✓ Director engine orchestrated all crew sub-systems.")

    print("🚀 STEP 4: Test Director Approval Gate")
    gate_id = final_state.approvals[0].id
    approved_gate = mgr.approve_action(gate_id, "Approved by Director in test")
    assert approved_gate is not None
    assert approved_gate.status == "APPROVED"
    print(f"  ✓ Governance gate '{approved_gate.gate_name}' approved.")

    print("🚀 STEP 5: Test MCP Server Tool Calls")
    mcp_server = CinemaLitMCPServer(test_dir)
    
    # Tool 1: list scenes
    res_scenes = mcp_server.handle_tool_call("story.list_scenes", {})
    assert len(res_scenes["scenes"]) == 5

    # Tool 2: budget pressure
    res_budget = mcp_server.handle_tool_call("budget.estimate_pressure", {"target_budget": 5000.0})
    assert "total_estimated" in res_budget

    # Tool 3: studio memory query
    res_mem = mcp_server.handle_tool_call("studio.query_memory", {"query": "Find night exterior risks"})
    assert "results" in res_mem
    print("  ✓ MCP tool server returned valid responses.")

    # Cleanup test workspace
    os.chdir(os.path.dirname(test_dir))
    shutil.rmtree(test_dir)

    print("\n🎉 ALL E2E INTEGRATION TESTS PASSED PERFECTLY!\n")

if __name__ == "__main__":
    test_full_director_workflow()
