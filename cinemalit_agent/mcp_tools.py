"""
ClickHouse MCP tool wiring for CinemaLit Studio's Director Agent.

Uses ClickHouse Cloud's own hosted, remote MCP server
(https://mcp.clickhouse.cloud/mcp) over Streamable HTTP — NOT a locally
spawned `uvx mcp-clickhouse` subprocess. This matters for the eventual cloud
deployment: Agent Engine can't spawn local subprocesses, but it can make the
same outbound HTTPS call this makes today, so nothing changes at deploy time.

That remote server is ClickHouse Cloud's CONTROL-PLANE MCP server — it also
exposes organization/billing/service/backup-management tools (get_organization_cost,
list_service_backups, etc.) that have nothing to do with querying our
production data and shouldn't be handed to an LLM agent. `tool_filter` scopes
the agent down to only the 3 tools that matter: list_databases, list_tables,
run_select_query (confirmed read-only by its own name/description — no write
tool is exposed by this server at all, unlike the self-hosted mcp-clickhouse
package which has an opt-in write mode).

Auth: same ClickHouse username/password as everything else, via HTTP Basic
Auth header — confirmed working directly against the endpoint before wiring
this in.
"""

import base64
import os

from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset

_user = os.environ.get("CLICKHOUSE_USER", "default")
_password = os.environ.get("CLICKHOUSE_PASSWORD", "")
_basic_auth = base64.b64encode(f"{_user}:{_password}".encode()).decode()

clickhouse_mcp_toolset = McpToolset(
    connection_params=StreamableHTTPConnectionParams(
        url="https://mcp.clickhouse.cloud/mcp",
        headers={"Authorization": f"Basic {_basic_auth}"},
    ),
    tool_filter=["list_databases", "list_tables", "run_select_query"],
)
