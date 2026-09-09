"""
Bridge for calling the Director Agent in-process from web/server.py, without
needing it deployed to Agent Engine yet.

This is a LOCAL/pre-deployment bridge — once actually deployed to Agent
Engine, the right integration is calling the hosted endpoint's API instead
(same call site in web/server.py, different implementation here). Uses
InMemoryRunner (an in-process, non-persistent session store) directly via
run_async() + manual session get-or-create — acceptable here because this
whole module IS the pre-deployment local bridge; swap to the deployed
endpoint's own API before this is treated as the real production path.
"""

import asyncio
import contextlib
import os
import threading
from typing import Optional

from google.adk.runners import InMemoryRunner, RunConfig, print_event
from google.genai import types

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


def ask_agent(
    message: str,
    session_id: str = "web_default",
    user_id: str = "web_user",
    file_bytes: Optional[bytes] = None,
    file_mime_type: Optional[str] = None,
) -> str:
    """Sends one message (optionally with one attached image or PDF) to the
    Director Agent and returns its final text reply.

    Callers should pass a session_id scoped to the signed-in user (and, for
    project work, the project) — the default is shared, so every caller that
    falls back to it lands in ONE conversation whose history grows without
    bound and is visible to everyone.

    file_bytes/file_mime_type let the user attach one image (png/jpeg/webp)
    or PDF to a chat turn — Gemini reads it natively (vision / native PDF
    layout understanding), no local text extraction needed. This bypasses
    InMemoryRunner.run_debug() (text-only by its own docstring) in favor of
    the session get-or-create + run_async() dance run_debug does internally,
    so a multi-part Content (text + inline_data) can be sent.
    """

    async def _run():
        run_config = RunConfig()
        session = await _runner.session_service.get_session(
            app_name=_runner.app_name, user_id=user_id, session_id=session_id,
        )
        if not session:
            session = await _runner.session_service.create_session(
                app_name=_runner.app_name, user_id=user_id, session_id=session_id,
            )

        parts = [types.Part(text=message)]
        if file_bytes is not None:
            parts.append(types.Part.from_bytes(data=file_bytes, mime_type=file_mime_type))

        events = []
        async with contextlib.aclosing(
            _runner.run_async(
                user_id=user_id,
                session_id=session.id,
                new_message=types.UserContent(parts=parts),
                run_config=run_config,
            )
        ) as agen:
            async for event in agen:
                if _VERBOSE:
                    print_event(event, verbose=True)
                events.append(event)
        return events

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
