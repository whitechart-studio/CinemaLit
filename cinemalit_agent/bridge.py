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
import contextlib
import os
import threading

from google.adk.runners import InMemoryRunner

from cinemalit_agent.agent import root_agent  # triggers cinemalit_agent/__init__.py's .env load

_runner = InMemoryRunner(agent=root_agent, app_name="cinemalit_web")

# Prints each tool call/response and the final answer — off (quiet) by
# default so it doesn't spam a production-ish run; set
# ADK_AGENT_VERBOSE=false to go back to silent.
_VERBOSE = os.environ.get("ADK_AGENT_VERBOSE", "true").lower() in ("1", "true", "yes")

# Optional: redirect that verbose output to its own file instead of the same
# console web/server.py's HTTP request log lines print to — set
# ADK_AGENT_LOG_FILE=cinemalit_agent.log, then in a second terminal:
#   Get-Content -Wait cinemalit_agent.log   (PowerShell)
#   tail -f cinemalit_agent.log             (bash)
# to watch only the agent's activity, separate from the app's own log.
_LOG_FILE = os.environ.get("ADK_AGENT_LOG_FILE", "").strip()


def ask_agent(message: str, session_id: str = "web_default", user_id: str = "web_user") -> str:
    """Sends one message to the Director Agent and returns its final text reply.

    Callers should pass a session_id scoped to the signed-in user (and, for
    project work, the project) — the default is shared, so every caller that
    falls back to it lands in ONE conversation whose history grows without
    bound and is visible to everyone.
    """

    async def _run():
        return await _runner.run_debug(
            message,
            user_id=user_id,
            session_id=session_id,
            quiet=not _VERBOSE,
            verbose=_VERBOSE,
        )

    # asyncio.run() refuses to nest, and this is called from background worker
    # threads as well as request threads — give every call its own loop.
    box = {}

    def _target():
        try:
            if _VERBOSE and _LOG_FILE:
                with open(_LOG_FILE, "a", encoding="utf-8") as f, contextlib.redirect_stdout(f):
                    box["events"] = asyncio.run(_run())
            else:
                box["events"] = asyncio.run(_run())
        except Exception as exc:  # noqa: BLE001 — re-raised on the calling thread
            box["error"] = exc

    thread = threading.Thread(target=_target, daemon=True)
    thread.start()
    thread.join()
    if "error" in box:
        raise box["error"]
    events = box.get("events", [])
    reply_parts = []
    for event in events:
        if event.content and event.content.parts:
            for part in event.content.parts:
                if getattr(part, "text", None):
                    reply_parts.append(part.text)
    return "\n".join(reply_parts) if reply_parts else "The agent did not return a response."
