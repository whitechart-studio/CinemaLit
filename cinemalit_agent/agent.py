"""
CinemaLit Studio Director Agent — ADK definition.

Now carries 17 direct tools (6 original web-app tools + 11 ported crew tools)
plus the 3-tool ClickHouse MCP toolset = 20 tools total, all flat on one
agent. Worth flagging honestly: this is now well past the ~10-15 tool
threshold where ADK's own docs say single-agent instruction-following starts
degrading (see agents.md). Kept flat for now per explicit instruction to wire
everything in; splitting into sub-agents (e.g. a StoryAgent/BudgetAgent/
ScheduleAgent/GovernanceAgent under this root, as originally scoped in the
migration plan) is the natural next step if the agent starts picking wrong
tools or missing instructions in testing.
"""

import os

from google.adk.agents import Agent

from cinemalit_agent.crew_tools import CREW_TOOLS
from cinemalit_agent.mcp_tools import clickhouse_mcp_toolset
from cinemalit_agent.tools import CINEMALIT_TOOLS

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")

INSTRUCTION = (
    "You are the CinemaLit Director AI Agent — an autonomous Hollywood production agent. "
    "You have direct access to the ClickHouse production database via tools, plus a full "
    "suite of production crew tools: script analysis (analyze_script writes new scenes), "
    "risk radar (find_risks), departmental breakdown (production_breakdown), budget "
    "estimation (estimate_budget_pressure, suggest_budget_savings), scheduling "
    "(generate_schedule), task generation (create_production_tasks), governance gate "
    "approval (request_gate_approval), and the audit trail (get_audit_log). "
    "When a user asks about budgets, elements, risks, or schedules, USE YOUR TOOLS to find "
    "the answers — never guess. If asked to break down a scene, use get_scene_details and "
    "add_scene_element. If asked to ingest or analyze a new script, use analyze_script. "
    "Answer concisely with professional film industry insight."
)

root_agent = Agent(
    name="cinemalit_director",
    model=GEMINI_MODEL,
    instruction=INSTRUCTION,
    tools=[*CINEMALIT_TOOLS, *CREW_TOOLS, clickhouse_mcp_toolset],
)
