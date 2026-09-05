"""
CinemaLit MCP Stdio Client.
Manages JSON-RPC 2.0 communication over stdio with MCP servers,
discovers tools, handles tool execution, and converts MCP schemas to Gemini declarations.
"""

import sys
import os
import json
import subprocess
import threading
from typing import Dict, Any, List, Optional

class MCPStdioClient:
    """Client for communicating with an MCP server via stdio JSON-RPC 2.0."""
    def __init__(self, command: List[str], env: Optional[Dict[str, str]] = None, name: str = "default"):
        self.command = command
        self.env = env or os.environ.copy()
        self.name = name
        self.process: Optional[subprocess.Popen] = None
        self._request_id = 0
        self._lock = threading.Lock()
        self._initialized = False
        self._tools: List[Dict[str, Any]] = []

    def start(self) -> bool:
        """Starts the MCP server subprocess and performs initialization handshake."""
        try:
            self.process = subprocess.Popen(
                self.command,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=self.env,
                bufsize=1
            )
            
            # Send initialize request
            init_res = self.send_request("initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "CinemaLit-Host", "version": "1.0.0"}
            })

            # Send initialized notification if needed
            self.send_notification("notifications/initialized", {})
            self._initialized = True
            
            # Fetch tools
            self.refresh_tools()
            return True
        except Exception as e:
            print(f"[MCPClient:{self.name}] Failed to start MCP server: {e}", file=sys.stderr)
            return False

    def _next_id(self) -> int:
        with self._lock:
            self._request_id += 1
            return self._request_id

    def send_request(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Sends a synchronous JSON-RPC request and waits for response line."""
        if not self.process or self.process.poll() is not None:
            raise RuntimeError(f"[MCPClient:{self.name}] Subprocess is not running")

        req_id = self._next_id()
        payload = {
            "jsonrpc": "2.0",
            "id": req_id,
            "method": method
        }
        if params is not None:
            payload["params"] = params

        raw_req = json.dumps(payload) + "\n"
        with self._lock:
            self.process.stdin.write(raw_req)
            self.process.stdin.flush()

            # Read line from stdout
            line = self.process.stdout.readline()
            if not line:
                stderr_output = self.process.stderr.read() if self.process.stderr else ""
                raise RuntimeError(f"[MCPClient:{self.name}] Received EOF from MCP server. Stderr: {stderr_output}")

            try:
                res = json.loads(line)
                if "error" in res:
                    raise RuntimeError(f"[MCPClient:{self.name}] Error response ({res['error'].get('code')}): {res['error'].get('message')}")
                return res.get("result", {})
            except json.JSONDecodeError as err:
                raise RuntimeError(f"[MCPClient:{self.name}] Failed to parse JSON response: '{line}'. Error: {err}")

    def send_notification(self, method: str, params: Optional[Dict[str, Any]] = None):
        """Sends a JSON-RPC notification (no ID, no response expected)."""
        if not self.process or self.process.poll() is not None:
            return
        payload = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            payload["params"] = params

        raw_req = json.dumps(payload) + "\n"
        with self._lock:
            self.process.stdin.write(raw_req)
            self.process.stdin.flush()

    def refresh_tools(self) -> List[Dict[str, Any]]:
        """Queries the server for available tools via tools/list."""
        res = self.send_request("tools/list", {})
        self._tools = res.get("tools", [])
        return self._tools

    def get_tools(self) -> List[Dict[str, Any]]:
        return self._tools

    def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Executes a tool call via tools/call and returns parsed content or dict."""
        res = self.send_request("tools/call", {
            "name": tool_name,
            "arguments": arguments
        })
        content_list = res.get("content", [])
        if content_list and isinstance(content_list, list):
            first_item = content_list[0]
            if isinstance(first_item, dict) and first_item.get("type") == "text":
                text_val = first_item.get("text", "")
                try:
                    return json.loads(text_val)
                except Exception:
                    return text_val
        return res

    def close(self):
        """Terminates the MCP server process cleanly."""
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=2)
            except Exception:
                if self.process:
                    self.process.kill()
            self.process = None

    def to_gemini_tool_declarations(self) -> List[Dict[str, Any]]:
        """Converts MCP tool definitions to standard dict format suitable for Google GenAI / Gemini function calling."""
        declarations = []
        for tool in self._tools:
            name = tool.get("name")
            description = tool.get("description", "")
            input_schema = tool.get("inputSchema", {"type": "object", "properties": {}})
            
            # Convert dots to underscores for Gemini tool function names
            gemini_name = name.replace(".", "_")
            
            declaration = {
                "name": gemini_name,
                "description": f"[{self.name}] {description}",
                "parameters": input_schema
            }
            declarations.append(declaration)
        return declarations
