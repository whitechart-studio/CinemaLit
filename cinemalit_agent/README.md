# CinemaLit Director Agent (ADK)

Every AI-calling handler in `web/server.py` (chat, script analysis, ask-data,
sync-script-to-db, DGA check, storyboard generation) can route through this
agent instead of calling `google.genai` directly — behind `USE_ADK_AGENT`
(env flag, default `false` = original direct-Gemini behavior, completely
unchanged). See `agents.md` at the repo root for full status and rollout
history.

Folder is named `cinemalit_agent`, not `agent` — naming it `agent` (matching
the required `agent.py` filename inside) caused a real, reproduced import
collision in both a plain Python invocation and ADK's own agent loader. Keep
it named differently from `agent.py` if you ever rename it again.

## What's here

- `agent.py` — the ADK `Agent` definition (single agent, flat tool list, 15
  tools total: 3 web-app tools + 12 crew tools). The ClickHouse Cloud remote
  MCP toolset is NOT included — see `mcp_tools.py` below.
- `tools.py` — imports the 3 tools the web chat already uses
  (`query_production_db`, `get_scene_details`, `add_scene_element` from
  `web/server.py`) — not reimplemented, reused as-is
- `crew_tools.py` — ClickHouse-backed ports of all 12 original CLI/local-MCP
  crew tools (`cinemalit/mcp/server.py`), including `ask_gemini` (as
  `ask_gemini_direct` — a freeform bypass tool, distinct from the agent's own
  normal reasoning). Same unchanged crew logic (`cinemalit/crews/*.py`), but
  sourced from/persisted to the live ClickHouse database instead of the CLI's
  local `.cinemalit/state.json` file. Adds 2 new ClickHouse tables
  (`governance_gates`, `agent_audit_log`) for the 2 genuinely write-capable
  tools (`request_gate_approval`, `analyze_script`); also mirrored into
  `scripts/setup_clickhouse_schema.sql`.
- `mcp_tools.py` — wires in ClickHouse Cloud's own hosted, remote MCP server
  (`https://mcp.clickhouse.cloud/mcp`, Streamable HTTP) — NOT a local `uvx`
  subprocess. **Built but not wired into `agent.py`** — its 3 tools
  (`list_databases`, `list_tables`, `run_select_query`) all require a real
  `serviceId`, and every call fails with "Service not found... or your
  credentials do not grant access to it" even with an API key granted
  Service API Reader + Basic Service API Reader roles. Root cause not fully
  pinned down (possibly a separate services/scope selector on the key,
  distinct from its roles) — deprioritized since the 12 crew tools already
  give the agent full ClickHouse data access with none of this complexity.
  Kept, not deleted; re-add `clickhouse_mcp_toolset` to `agent.py`'s tools
  list if the permission issue ever gets resolved.
- `bridge.py` — calls the agent in-process via ADK's `InMemoryRunner`, used by
  `web/server.py` when `USE_ADK_AGENT=true`. Pre-deployment local bridge —
  swap for a call to the deployed Agent Engine endpoint once actually
  deployed.
- `test_tools_standalone.py` / `test_crew_tools_standalone.py` — verify every
  tool against the live ClickHouse instance, **no Gemini API key required**
  (23 checks total, all passing).

## Setup

From the repo root (not inside `cinemalit_agent/`):

```bash
.venv/Scripts/python.exe -m pip install -r cinemalit_agent/requirements.txt
cp cinemalit_agent/.env.example cinemalit_agent/.env   # then fill in real values
```

## What needs a real API key vs. what doesn't

- **Writing and structurally testing the agent** (imports, tool wiring,
  ClickHouse connectivity) — no key needed. Run:
  `PYTHONPATH=. .venv/Scripts/python.exe -m cinemalit_agent.test_tools_standalone`
  and `-m cinemalit_agent.test_crew_tools_standalone`
- **Actually chatting with the agent** (`adk run` / `adk web`, or the web app
  with `USE_ADK_AGENT=true`) — needs a real `GOOGLE_API_KEY` (or Vertex AI
  project access) in `cinemalit_agent/.env`.
- **Deploying to Agent Engine** — needs a real GCP project with billing,
  Vertex AI API enabled, and `gcloud auth application-default login`. Not
  needed for local development, only for the later deploy phase.

## Running locally

Standalone, via `adk run`/`adk web` (with the venv's `Scripts/` on `PATH`):

```bash
export PATH="$PWD/.venv/Scripts:$PATH"
PYTHONPATH=. adk run cinemalit_agent "What is the total budget?"
```

Or through the actual web app (recommended — exercises the real integration
point):

```bash
USE_ADK_AGENT=true .venv/Scripts/python.exe -m web.server
```

Then use the app normally (chat panel, "Sync to ClickHouse" button, DGA
check, storyboard generation, etc.) — all 6 routes through the agent.
