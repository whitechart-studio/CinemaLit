"""
CinemaLit MCP Orchestrator.
Aggregates multiple MCP clients, handles tool discovery, and routes tool calls
from Gemini agents to the corresponding MCP server.
"""

import sys
import os
from typing import Dict, Any, List, Optional, Tuple
from cinemalit.mcp.client import MCPStdioClient

class MCPOrchestrator:
    """Orchestrates multi-server MCP connections and routes tool calls."""
    def __init__(self):
        self.clients: Dict[str, MCPStdioClient] = {}
        # Mapping from gemini_name (e.g. story_analyze_script) -> (client_name, mcp_tool_name)
        self.tool_routing: Dict[str, Tuple[str, str]] = {}

    def register_client(self, name: str, command: List[str], env: Optional[Dict[str, str]] = None) -> MCPStdioClient:
        """Registers a new MCP server configuration."""
        client = MCPStdioClient(command=command, env=env, name=name)
        self.clients[name] = client
        return client

    def start_all(self):
        """Starts all registered MCP clients and builds tool routing map."""
        self.tool_routing.clear()
        for c_name, client in self.clients.items():
            if client.start():
                tools = client.get_tools()
                for t in tools:
                    mcp_name = t.get("name")
                    gemini_name = mcp_name.replace(".", "_")
                    self.tool_routing[gemini_name] = (c_name, mcp_name)
                    self.tool_routing[mcp_name] = (c_name, mcp_name)
            else:
                print(f"[MCPOrchestrator] Warning: Failed to start MCP client '{c_name}'", file=sys.stderr)

    def get_all_tools(self) -> List[Dict[str, Any]]:
        """Returns all MCP tools aggregated from all active clients."""
        aggregated = []
        for c_name, client in self.clients.items():
            for t in client.get_tools():
                tool_copy = dict(t)
                tool_copy["server"] = c_name
                aggregated.append(tool_copy)
        return aggregated

    def get_gemini_tool_declarations(self) -> List[Dict[str, Any]]:
        """Returns tool declarations formatted for Google GenAI / Gemini API."""
        declarations = []
        for client in self.clients.values():
            declarations.extend(client.to_gemini_tool_declarations())
        return declarations

    def execute_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
        """Routes execution of tool call (using either gemini_name or mcp_name) to target client."""
        route = self.tool_routing.get(name)
        if not route:
            # Fallback search
            alt_name = name.replace("_", ".")
            route = self.tool_routing.get(alt_name)
            
        if not route:
            return {"error": f"Tool '{name}' not found in any registered MCP server."}

        client_name, mcp_tool_name = route
        client = self.clients.get(client_name)
        if not client:
            return {"error": f"MCP client '{client_name}' is no longer active."}

        try:
            return client.call_tool(mcp_tool_name, arguments)
        except Exception as e:
            return {"error": f"Execution of MCP tool '{mcp_tool_name}' failed on server '{client_name}': {str(e)}"}

    def close_all(self):
        """Closes all active MCP clients."""
        for client in self.clients.values():
            client.close()
        self.clients.clear()
        self.tool_routing.clear()
