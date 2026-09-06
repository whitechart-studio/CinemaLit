"""
Bridge for calling the Director Agent in-process from web/server.py, without
needing it deployed to Agent Engine yet.

This is a LOCAL/pre-deployment bridge — once actually deployed to Agent
Engine, the right integration is calling the hosted endpoint's API instead
(same call site in web/server.py, different implementation here). Uses
InMemoryRunner.run_debug(), which ADK's own docs mark "for debugging and
experimentation only, not production" — acceptable here because this whole
module IS the pre-deployment local bridge; swap to explicit session
management + run_async() (or the deployed-endpoint call) before this is
treated as the real production path.
"""

import asyncio
import os

from google.adk.runners import InMemoryRunner

from cinemalit_agent.agent import root_agent  # triggers cinemalit_agent/__init__.py's .env load

_runner = InMemoryRunner(agent=root_agent, app_name="cinemalit_web")

# Prints each tool call/response and the final answer to the console running
# web/server.py — off (quiet) by default so it doesn't spam a production-ish
# run; set ADK_AGENT_VERBOSE=false to go back to silent.
_VERBOSE = os.environ.get("ADK_AGENT_VERBOSE", "true").lower() in ("1", "true", "yes")


def ask_agent(message: str, session_id: str = "web_default") -> str:
    """Sends one message to the Director Agent and returns its final text reply."""
    events = asyncio.run(
        _runner.run_debug(
            message,
            user_id="web_user",
            session_id=session_id,
            quiet=not _VERBOSE,
            verbose=_VERBOSE,
        )
    )
    reply_parts = []
    for event in events:
        if event.content and event.content.parts:
            for part in event.content.parts:
                if getattr(part, "text", None):
                    reply_parts.append(part.text)
    return "\n".join(reply_parts) if reply_parts else "The agent did not return a response."
