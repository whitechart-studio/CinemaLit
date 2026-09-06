"""
Studio Memory engine for CinemaLit Studio.
Provides structured in-memory & ClickHouse-compatible querying of script intelligence,
scene breakdowns, cost pressures, risk metrics, and audit logs.
"""

import json
import os
import urllib.request
import urllib.parse
from typing import Dict, Any, List, Optional
from cinemalit.core.models import ProjectState
from cinemalit.knowledge import (
    STORY_KNOWLEDGE,
    PRODUCTION_KNOWLEDGE,
    BUDGET_KNOWLEDGE,
    SCHEDULE_KNOWLEDGE,
    OPS_KNOWLEDGE,
    GOVERNANCE_KNOWLEDGE
)

class ClickHouseAdapter:
    """
    ClickHouse Client Adapter for CinemaLit Studio Memory.
    Supports Native TCP & HTTP connections (Local Docker & ClickHouse Cloud).
    """
    def __init__(self, host: Optional[str] = None, port: int = 8123, user: str = "cinemalit", password: str = ""):
        self.host = host or os.environ.get("CLICKHOUSE_HOST", "localhost")
        self.port = port or int(os.environ.get("CLICKHOUSE_PORT", "8123"))
        self.user = user or os.environ.get("CLICKHOUSE_USER", "cinemalit")
        self.password = password or os.environ.get("CLICKHOUSE_PASSWORD", "")
        self.database = os.environ.get("CLICKHOUSE_DATABASE") or os.environ.get("CLICKHOUSE_DB", "cinemalit")
        self.mcp_server_cmd = "mcp-clickhouse"

    def execute_sql(self, sql_query: str) -> Optional[List[Dict[str, Any]]]:
        """Executes a SQL query against ClickHouse using web.db helper."""
        from web.db import ch_query
        try:
            res = ch_query(sql_query)
            if res.get("status") == "ok" and "data" in res:
                data = res.get("data", [])
                meta = res.get("meta", [])
                if meta and isinstance(data, list) and len(data) > 0 and isinstance(data[0], list):
                    # Format as dict list matching ClickHouse JSON output
                    col_names = [m["name"] for m in meta]
                    return [dict(zip(col_names, row)) for row in data]
                return data
            return None
        except Exception:
            return None

class StudioMemoryManager:
    def __init__(self, state: ProjectState):
        self.state = state
        self.clickhouse = ClickHouseAdapter()
        self.knowledge_base = {
            "story": STORY_KNOWLEDGE,
            "production": PRODUCTION_KNOWLEDGE,
            "budget": BUDGET_KNOWLEDGE,
            "schedule": SCHEDULE_KNOWLEDGE,
            "ops": OPS_KNOWLEDGE,
            "governance": GOVERNANCE_KNOWLEDGE
        }

    def get_structured_summary(self) -> Dict[str, Any]:
        """Builds a structured studio memory representation for query and export."""
        return {
            "project_id": self.state.project_id,
            "name": self.state.name,
            "total_scenes": len(self.state.scenes),
            "scenes": [
                {
                    "id": s.id,
                    "header": s.header,
                    "setting": s.setting,
                    "time_of_day": s.time_of_day,
                    "location": s.location,
                    "page_count": s.page_count,
                    "characters": s.characters,
                    "props": s.props,
                    "risks": s.risks
                }
                for s in self.state.scenes
            ],
            "risks": [
                {
                    "id": r.id,
                    "department": r.department,
                    "title": r.title,
                    "severity": r.severity,
                    "mitigation": r.mitigation
                }
                for r in self.state.risks
            ],
            "budget": {
                "total_estimated": self.state.budget.total_estimated,
                "max_target": self.state.budget.max_target,
                "status": self.state.budget.status,
                "savings_proposals": self.state.budget.savings_proposals
            },
            "schedule": {
                "total_days": self.state.schedule.total_days,
                "location_moves": self.state.schedule.location_moves,
                "days": [
                    {
                        "day_number": d.day_number,
                        "title": d.title,
                        "scene_ids": d.scene_ids,
                        "total_pages": d.total_pages,
                        "locations": d.locations
                    }
                    for d in self.state.schedule.days
                ]
            },
            "pending_approvals": [
                a.gate_name for a in self.state.approvals if a.status == "PENDING"
            ]
        }

    def query(self, query_text: str) -> List[Dict[str, Any]]:
        """
        Executes natural language / ClickHouse structured queries against Studio Memory
        and Industry Knowledge Base.
        """
        query_text_lower = query_text.lower()
        results = []

        # Knowledge Base queries (e.g. "movie magic", "dood", "atl", "contingency", "call sheet")
        if "category" in query_text_lower or "movie magic" in query_text_lower or "breakdown" in query_text_lower:
            results.append({
                "type": "industry_knowledge",
                "topic": "Movie Magic Breakdown Categories",
                "content": PRODUCTION_KNOWLEDGE["movie_magic_categories"]
            })

        if "dood" in query_text_lower or "stripboard" in query_text_lower or "status code" in query_text_lower:
            results.append({
                "type": "industry_knowledge",
                "topic": "Day Out of Days (DOOD) Status Codes & Rules",
                "content": SCHEDULE_KNOWLEDGE
            })

        if "atl" in query_text_lower or "btl" in query_text_lower or "contingency" in query_text_lower or "top sheet" in query_text_lower:
            results.append({
                "type": "industry_knowledge",
                "topic": "Film Budgeting Standards & Top Sheet Structure",
                "content": BUDGET_KNOWLEDGE
            })

        if "call sheet" in query_text_lower or "hospital" in query_text_lower or "dga" in query_text_lower:
            results.append({
                "type": "industry_knowledge",
                "topic": "DGA Call Sheet Standards & Prep Deliverables",
                "content": OPS_KNOWLEDGE
            })

        if "bond" in query_text_lower or "greenlight" in query_text_lower or "clearance" in query_text_lower:
            results.append({
                "type": "industry_knowledge",
                "topic": "Studio Greenlight Gates & Completion Bond Requirements",
                "content": GOVERNANCE_KNOWLEDGE
            })

        # Project state queries
        if "night" in query_text_lower and ("ext" in query_text_lower or "exterior" in query_text_lower or "risk" in query_text_lower):
            for scene in self.state.scenes:
                if scene.setting in ["EXT", "INT/EXT"] and scene.time_of_day in ["NIGHT", "DUSK"]:
                    results.append({
                        "type": "scene_query_match",
                        "scene_id": scene.id,
                        "header": scene.header,
                        "location": scene.location,
                        "risks": scene.risks,
                        "page_count": scene.page_count
                    })

        elif "group" in query_text_lower or "location" in query_text_lower:
            loc_map: Dict[str, List[str]] = {}
            for scene in self.state.scenes:
                loc_map.setdefault(scene.location, []).append(scene.id)
            results.append({
                "type": "location_grouping",
                "location_count": len(loc_map),
                "locations": loc_map
            })

        elif "blocker" in query_text_lower or "approval" in query_text_lower or "greenlight" in query_text_lower:
            pending = [a for a in self.state.approvals if a.status == "PENDING"]
            results.append({
                "type": "approval_blockers",
                "pending_count": len(pending),
                "blockers": [{"id": a.id, "gate": a.gate_name, "rationale": a.rationale} for a in pending]
            })

        elif "budget" in query_text_lower or "constraint" in query_text_lower or "$5k" in query_text_lower or "cost" in query_text_lower:
            results.append({
                "type": "budget_comparison",
                "estimated": self.state.budget.total_estimated,
                "target": self.state.budget.max_target,
                "variance": self.state.budget.total_estimated - self.state.budget.max_target,
                "status": self.state.budget.status,
                "cost_pressures": [cp.department for cp in self.state.budget.cost_pressures],
                "savings_proposals": self.state.budget.savings_proposals
            })

        if not results:
            for s in self.state.scenes:
                if any(w in s.header.lower() or w in s.synopsis.lower() for w in query_text_lower.split()):
                    results.append({
                        "type": "keyword_match",
                        "scene_id": s.id,
                        "header": s.header,
                        "synopsis": s.synopsis
                    })

        return results
