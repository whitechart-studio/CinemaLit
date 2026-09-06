# CinemaLit Director Agent (ADK)

Replaces `web/server.py`'s direct `google.genai` chat calls with an ADK agent,
without changing any other part of the app. See `agents.md` at the repo root
for the full migration plan and rollout phases.

Folder is named `cinemalit_agent`, not `agent` — naming it `agent` (matching
the required `agent.py` filename inside) caused a real, reproduced import
collision in both a plain Python invocation and ADK's own agent loader. Keep
it named differently from `agent.py` if you ever rename it again.

## What's here

- `agent.py` — the ADK `Agent` definition (single agent, flat tool list, 20
  tools total)
- `tools.py` — imports the 3 tools the web chat already uses
  (`query_production_db`, `get_scene_details`, `add_scene_element` from
  `web/server.py`) — not reimplemented, reused as-is
- `crew_tools.py` — ClickHouse-backed ports of 11 of the original 12 CLI/local
  MCP crew tools (`cinemalit/mcp/server.py`) — same unchanged crew logic
  (`cinemalit/crews/*.py`), but sourced from/persisted to the live ClickHouse
  database instead of the CLI's local `.cinemalit/state.json` file, so the
  agent (not just the CLI) can use them. `studio.ask_gemini` wasn't ported —
  redundant once the agent itself is Gemini. Adds 2 new ClickHouse tables
  (`governance_gates`, `agent_audit_log`) for the 2 genuinely write-capable
  tools (`request_gate_approval`, `analyze_script`); also mirrored into
  `scripts/setup_clickhouse_schema.sql` for documentation.
- `mcp_tools.py` — wires in the official ClickHouse MCP server
  (`mcp-clickhouse`), run in isolation via `uvx` so its dependencies never
  conflict with this project's own `mcp<2` pin
- `test_tools_standalone.py` — sanity-checks the 3 direct tools and the agent's
  structural wiring against the live ClickHouse instance, with **no Gemini API
  key required**. Verified passing (8/8 checks, 3 consecutive runs).

## Setup

From the repo root (not inside `cinemalit_agent/`):

```bash
.venv/Scripts/python.exe -m pip install -r cinemalit_agent/requirements.txt
pip install uv   # provides uvx, used to run mcp-clickhouse in isolation
cp cinemalit_agent/.env.example cinemalit_agent/.env   # then fill in real values
```

## What needs a real API key vs. what doesn't

- **Writing and structurally testing the agent** (imports, tool wiring,
  ClickHouse connectivity) — no key needed. Run:
  `PYTHONPATH=. .venv/Scripts/python.exe -m cinemalit_agent.test_tools_standalone`
- **Actually chatting with the agent** (`adk run` / `adk web`) — needs a real
  `GOOGLE_API_KEY` in `cinemalit_agent/.env` with
  `GOOGLE_GENAI_USE_VERTEXAI=FALSE`. This is the *same kind* of key already in
  the root `.env` — no GCP project, billing, or `gcloud` login required for
  this step.
- **Deploying to Agent Engine** — needs a real GCP project with billing,
  Vertex AI API enabled, and `gcloud auth application-default login`. Not
  needed for local development, only for the later deploy phase.

## Running locally (once a real API key is in `cinemalit_agent/.env`)

From the repo root, with the project root on `PYTHONPATH` (needed because
`tools.py` imports `web.server`), with the venv's `Scripts/` on `PATH` (for
`adk` and `uvx`):

```bash
export PATH="$PWD/.venv/Scripts:$PATH"
PYTHONPATH=. adk run cinemalit_agent "What is the total budget?"
```

or for an interactive local chat UI:

```bash
PYTHONPATH=. adk web --port 8080 .
```

(`--port 8080` avoids colliding with `web/server.py`'s port 8000; point it at
`.` from the repo root, or at `cinemalit_agent` directly for a single-agent
view.) First run prompts to opt in/out of ADK's anonymous telemetry — answer
either way, it only affects usage reporting to Google, not agent behavior.

Both commands currently load and run correctly through every step except the
final Gemini call itself, which fails with an auth error until a real
`GOOGLE_API_KEY` replaces the placeholder — expected, and itself confirms the
agent, its tools, and the ClickHouse MCP toolset are all wired correctly.
