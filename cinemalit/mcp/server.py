"""
Unified Model Context Protocol (MCP) Server for CinemaLit Studio.
Exposes specialized crew tools (Story, Production, Budget, Schedule, Ops, Governance, Memory)
to Gemini agents over stdio JSON-RPC.
"""

import sys
import json
import os
from typing import Dict, Any, List
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from cinemalit.core.state import StateManager
from cinemalit.core.memory import StudioMemoryManager
from cinemalit.core.ai import GeminiClient
from cinemalit.crews.story import StoryCrew
from cinemalit.crews.production import ProductionCrew
from cinemalit.crews.budget import BudgetCrew
from cinemalit.crews.schedule import ScheduleCrew
from cinemalit.crews.ops import OpsCrew
from cinemalit.crews.governance import GovernanceCrew

TOOLS_MANIFEST = [
    {
        "name": "story.analyze_script",
        "description": "Analyze screenplay scenes, character count, location count, and page counts.",
        "inputSchema": {
            "type": "object",
            "properties": {"script_text": {"type": "string", "description": "Raw screenplay content"}}
        }
    },
    {
        "name": "story.list_scenes",
        "description": "List all scenes extracted from project screenplay.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "production.find_risks",
        "description": "Identify production risks (weapons, stunts, night exterior lighting, permits).",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "production.breakdown",
        "description": "Perform full departmental breakdown of props, cast, locations, gear, and FX.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "budget.estimate_pressure",
        "description": "Estimate departmental budget breakdown and cost pressures against target budget.",
        "inputSchema": {
            "type": "object",
            "properties": {"target_budget": {"type": "number", "default": 5000.0}}
        }
    },
    {
        "name": "budget.suggest_savings",
        "description": "Suggest tactical cost savings and scene trade-offs.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "schedule.generate_plan",
        "description": "Generate an optimized stripboard shoot plan (e.g. 2-day target schedule).",
        "inputSchema": {
            "type": "object",
            "properties": {"target_days": {"type": "integer", "default": 2}}
        }
    },
    {
        "name": "ops.create_tasks",
        "description": "Generate actionable production tasks and prep checklists.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "governance.request_approval",
        "description": "Request or submit Director approval for a gate action.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action_id": {"type": "string", "description": "Gate ID or name"},
                "rationale": {"type": "string", "description": "Approval rationale"}
            },
            "required": ["action_id"]
        }
    },
    {
        "name": "governance.audit_log",
        "description": "Retrieve project decision audit log.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "studio.query_memory",
        "description": "Query Studio Memory (ClickHouse structured project knowledge & historical decisions).",
        "inputSchema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Query or natural language search"}}
        }
    },
    {
        "name": "studio.ask_gemini",
        "description": "Directly query Google AI (Gemini) with current production context.",
        "inputSchema": {
            "type": "object",
            "properties": {"prompt": {"type": "string", "description": "Question or creative direction for Gemini AI"}}
        }
    }
]

class CinemaLitMCPServer:
    def __init__(self, root_dir: str = "."):
        self.state_mgr = StateManager(root_dir)

    def handle_tool_call(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        state = self.state_mgr.load_state() if self.state_mgr.is_initialized() else None

        if name == "story.analyze_script":
            script_text = args.get("script_text", "")
            if not script_text and state and state.script_path and os.path.exists(state.script_path):
                with open(state.script_path, "r", encoding="utf-8") as f:
                    script_text = f.read()
            scenes = StoryCrew.parse_script(script_text) if script_text else []
            return {"scenes_count": len(scenes), "scenes": [s.id for s in scenes]}

        elif name == "story.list_scenes":
            if not state:
                return {"error": "No project state loaded"}
            from dataclasses import asdict
            return {"scenes": [asdict(s) for s in state.scenes]}

        elif name == "production.find_risks":
            if not state:
                return {"error": "No project state loaded"}
            from dataclasses import asdict
            return {"risks": [asdict(r) for r in state.risks]}

        elif name == "production.breakdown":
            if not state:
                return {"error": "No project state loaded"}
            from dataclasses import asdict
            return {"production_items": [asdict(p) for p in state.production_items]}

        elif name == "budget.estimate_pressure":
            if not state:
                return {"error": "No project state loaded"}
            target = args.get("target_budget", 5000.0)
            summary = BudgetCrew.calculate_budget(state, target_budget=target)
            return summary.__dict__

        elif name == "budget.suggest_savings":
            if not state:
                return {"error": "No project state loaded"}
            return {"savings_proposals": state.budget.savings_proposals}

        elif name == "schedule.generate_plan":
            if not state:
                return {"error": "No project state loaded"}
            target_days = args.get("target_days", 2)
            plan = ScheduleCrew.generate_plan(state, target_days=target_days)
            return plan.__dict__

        elif name == "ops.create_tasks":
            if not state:
                return {"error": "No project state loaded"}
            from dataclasses import asdict
            return {"tasks": [asdict(t) for t in state.tasks]}

        elif name == "governance.request_approval":
            action_id = args.get("action_id", "")
            rationale = args.get("rationale", "Approved via MCP tool")
            from dataclasses import asdict
            gate = self.state_mgr.approve_action(action_id, rationale)
            return {"status": "SUCCESS" if gate else "NOT_FOUND", "gate": asdict(gate) if gate else None}

        elif name == "governance.audit_log":
            if not state:
                return {"error": "No project state loaded"}
            from dataclasses import asdict
            return {"audit_logs": [asdict(al) for al in state.audit_logs]}

        elif name == "studio.query_memory":
            if not state:
                return {"error": "No project state loaded"}
            query = args.get("query", "")
            mem = StudioMemoryManager(state)
            return {"query": query, "results": mem.query(query)}

        elif name == "studio.ask_gemini":
            prompt = args.get("prompt", "")
            ai_client = GeminiClient()
            if not ai_client.is_available():
                return {
                    "error": "Google AI API Key (GOOGLE_API_KEY) is not set in environment or .env file.",
                    "status": "UNCONFIGURED"
                }
            
            # Pass studio state context to Gemini prompt
            context = f"Project: {state.name if state else 'CinemaLit'}\n"
            if state:
                context += f"Director Intent: {state.director_intent}\n"
                context += f"Scenes: {len(state.scenes)}, Risks: {len(state.risks)}\n"

            response = ai_client.generate_text(prompt, system_instruction=f"You are the CinemaLit Studio AI Assistant.\nContext:\n{context}")
            return {
                "prompt": prompt,
                "model": ai_client.model,
                "response": response or "Failed to retrieve response from Gemini API."
            }

        return {"error": f"Unknown tool: {name}"}

    def run_stdio(self):
        """Runs JSON-RPC stdio MCP loop."""
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                req = json.loads(line)
                method = req.get("method")
                req_id = req.get("id")

                if method == "tools/list":
                    res = {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS_MANIFEST}}
                elif method == "tools/call":
                    params = req.get("params", {})
                    t_name = params.get("name")
                    t_args = params.get("arguments", {})
                    out = self.handle_tool_call(t_name, t_args)
                    res = {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": {"content": [{"type": "text", "text": json.dumps(out, indent=2)}]}
                    }
                else:
                    res = {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": "Method not found"}}

                sys.stdout.write(json.dumps(res) + "\n")
                sys.stdout.flush()
            except Exception as e:
                err_res = {"jsonrpc": "2.0", "id": None, "error": {"code": -32603, "message": str(e)}}
                sys.stdout.write(json.dumps(err_res) + "\n")
                sys.stdout.flush()

def main():
    if "--test" in sys.argv:
        server = CinemaLitMCPServer()
        print(f"CinemaLit MCP Server initialized successfully with {len(TOOLS_MANIFEST)} tools.")
        for t in TOOLS_MANIFEST:
            print(f"  - {t['name']}: {t['description']}")
        return

    server = CinemaLitMCPServer()
    server.run_stdio()

if __name__ == "__main__":
    main()
