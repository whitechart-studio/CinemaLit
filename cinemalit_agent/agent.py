"""
CinemaLit Studio Director Agent — ADK definition.

Phase 1 (current): a single agent with all tools attached directly (the
"multi-tool agent" pattern), matching the flat tool list web/server.py's chat
handler already uses today, plus the ClickHouse partner MCP server as an
additional, generic read-only data-access tool. Kept intentionally flat rather
than split into sub-agents — tool count is well under the ~10-15 threshold
where ADK's own docs say single-agent instruction-following starts degrading,
and a flat agent is the fastest correct thing to ship first.
"""

import os

from google.adk.agents import Agent

from cinemalit_agent.mcp_tools import clickhouse_mcp_toolset
from cinemalit_agent.tools import CINEMALIT_TOOLS

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")

# Same persona/instructions as the existing web chat's system prompt
# (web/server.py's _handle_ai_chat), preserved verbatim for behavioral parity.
INSTRUCTION = (
    "You are the CinemaLit Director AI Agent — an autonomous Hollywood production agent. "
    "You have direct access to the ClickHouse production database via tools. "
    "When a user asks about budgets, elements, or schedules, USE YOUR TOOLS to find the answers! "
    "If asked to break down a scene, use get_scene_details and add_scene_element. "
    "Answer concisely with professional film industry insight."
)

root_agent = Agent(
    name="cinemalit_director",
    model=GEMINI_MODEL,
    instruction=INSTRUCTION,
    tools=[*CINEMALIT_TOOLS, clickhouse_mcp_toolset],
)
