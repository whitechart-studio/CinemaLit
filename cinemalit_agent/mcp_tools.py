"""
ClickHouse MCP tool wiring for CinemaLit Studio's Director Agent.

Runs the official ClickHouse MCP server (https://github.com/ClickHouse/mcp-clickhouse)
as an isolated subprocess via `uvx` — it is NOT installed into this project's own
venv. uvx resolves and runs it in its own throwaway environment, so its dependency
versions (it pulls in a newer `mcp` SDK via fastmcp) never conflict with the
`mcp<2` version google-adk itself requires. Requires the `uv` tool to be
installed and on PATH wherever this agent runs (`pip install uv` is sufficient).

Read-only by default (CLICKHOUSE_ALLOW_WRITE_ACCESS=false) — matches the existing
web SQL console's SELECT-only rule (web/server.py's _handle_ch_query). Writes, if
ever needed, should go through the narrow, purpose-built add_scene_element tool
in tools.py instead of opening general write access here.
"""

import os

from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset
from mcp import StdioServerParameters

clickhouse_mcp_toolset = MCPToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command="uvx",
            args=["mcp-clickhouse"],
            env={
                "CLICKHOUSE_HOST": os.environ.get("CLICKHOUSE_HOST", "localhost"),
                "CLICKHOUSE_PORT": os.environ.get("CLICKHOUSE_PORT", "8123"),
                "CLICKHOUSE_USER": os.environ.get("CLICKHOUSE_USER", "default"),
                "CLICKHOUSE_PASSWORD": os.environ.get("CLICKHOUSE_PASSWORD", ""),
                "CLICKHOUSE_DATABASE": os.environ.get("CLICKHOUSE_DATABASE", "cinemalit"),
                "CLICKHOUSE_ALLOW_WRITE_ACCESS": "false",
            },
        ),
        timeout=30,
    ),
)
