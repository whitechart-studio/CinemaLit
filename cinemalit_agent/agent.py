"""
CinemaLit Studio Director Agent — ADK definition.

Carries 17 direct tools (3 original web-app tools + 12 ported crew tools +
2 project-ingest pipeline tools), flat on one agent. The pipeline tools
(pipeline.py) are the agent's entry point for turning an uploaded screenplay
into a populated production database; they fan each scene out to two small
schema-constrained sub-agents rather than doing the work on this agent, so
per-scene calls don't carry all 17 tool declarations. The 3-tool ClickHouse Cloud remote MCP toolset
(mcp_tools.py) is deliberately NOT included here — its tools all require a
serviceId the API key we have access to can't successfully use yet (every
call returns "Service not found... or your credentials do not grant access
to it" even with Service API Reader + Basic Service API Reader roles
granted; likely a separate services/scope selector on the key we couldn't
pin down — see agents.md). Decided not to chase it further: the 12 crew
tools already give full ClickHouse data access with none of that permission
complexity, so nothing is actually lost. mcp_tools.py is kept, not deleted —
re-add `clickhouse_mcp_toolset` to the tools list below if the permission
issue ever gets resolved.
"""

import os

from google.adk.agents import Agent

from cinemalit_agent.crew_tools import CREW_TOOLS
from cinemalit_agent.pipeline import PIPELINE_TOOLS
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
    "add_scene_element. "
    "\n\nEvery tool takes a required project_id — always pass the active project_id given to "
    "you in the user's message. Never omit it and never guess or reuse a project_id from a "
    "previous conversation turn: two different projects must never share data, and passing "
    "the wrong project_id silently corrupts the wrong production's records. If you are not "
    "told which project is active, ask instead of assuming one. "
    "\n\nProject ingest: when asked to ingest, set up or break down a newly created "
    "project, call ingest_project_script(project_id) — it splits that project's uploaded "
    "screenplay into scenes and runs the full AI production breakdown on every scene, "
    "writing scenes, cast, elements, shots and budget into the database. Then call "
    "generate_project_storyboards(project_id) if storyboards were requested. Prefer "
    "these over analyze_script, which only does a shallow regex scene split with no "
    "project scoping. "
    "Answer concisely with professional film industry insight."
)

root_agent = Agent(
    name="cinemalit_director",
    model=GEMINI_MODEL,
    instruction=INSTRUCTION,
    tools=[*CINEMALIT_TOOLS, *CREW_TOOLS, *PIPELINE_TOOLS],
)
