"""
Cognitive Director Engine for CinemaLit Studio.
Orchestrates multi-direction studio crew reasoning across Story, Production, Budget,
Schedule, Ops, Governance, and Studio Memory.
"""

import os
import re
from typing import Dict, Any, Optional
from cinemalit.core.models import ProjectState
from cinemalit.core.state import StateManager
from cinemalit.core.memory import StudioMemoryManager
from cinemalit.core.ai import GeminiClient
from cinemalit.crews.story import StoryCrew
from cinemalit.crews.production import ProductionCrew
from cinemalit.crews.budget import BudgetCrew
from cinemalit.crews.schedule import ScheduleCrew
from cinemalit.crews.ops import OpsCrew
from cinemalit.crews.governance import GovernanceCrew

class DirectorEngine:
    def __init__(self, state_mgr: StateManager):
        self.state_mgr = state_mgr

    def direct(self, intent: str) -> ProjectState:
        """
        Main entry point for `cinemalit direct "<intent>"`.
        Executes multi-direction production thinking.
        """
        state = self.state_mgr.load_state()
        state.director_intent = intent
        self.state_mgr.log_audit("DIRECTOR", "DIRECT_INTENT", {"intent": intent})

        # 1. Breakdown thinking (Story Crew)
        if not state.scenes and state.script_path and os.path.exists(state.script_path):
            with open(state.script_path, "r", encoding="utf-8") as f:
                content = f.read()
            state.scenes = StoryCrew.parse_script(content)
            self.state_mgr.log_audit("STORY_CREW", "EXTRACT_SCENES", {"scene_count": len(state.scenes)})

        # 2. Risk thinking (Production Crew)
        prod_items, risks = ProductionCrew.breakdown(state)
        state.production_items = prod_items
        state.risks = risks
        self.state_mgr.log_audit("PRODUCTION_CREW", "GENERATE_RISK_RADAR", {"risk_count": len(risks)})

        # 3. Planning & Tradeoff thinking (Schedule & Budget Crew)
        target_budget = 5000.0
        b_match = re.search(r'(?:\$|budget|under|cost|cap)\s*\$?(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|thousand)?|(\d+)\s*(k|thousand)', intent, re.IGNORECASE)
        if b_match:
            val_str = b_match.group(1) or b_match.group(3)
            unit = (b_match.group(2) or b_match.group(4) or "").lower()
            if val_str:
                try:
                    val = float(val_str.replace(",", ""))
                    if unit in ["k", "thousand"]:
                        val *= 1000.0
                    if val > 0:
                        target_budget = val
                except ValueError:
                    pass

        target_days = 2
        days_match = re.search(r'(\d+)\s*(-|\s*)day', intent, re.IGNORECASE)
        if days_match:
            try:
                d_val = int(days_match.group(1))
                if d_val > 0:
                    target_days = d_val
            except ValueError:
                pass

        # Generate schedule plan
        state.schedule = ScheduleCrew.generate_plan(state, target_days=target_days)
        self.state_mgr.log_audit("SCHEDULE_CREW", "GENERATE_SCHEDULE", {"total_days": state.schedule.total_days})

        # Calculate budget pressure
        state.budget = BudgetCrew.calculate_budget(state, target_budget=target_budget)
        self.state_mgr.log_audit("BUDGET_CREW", "ESTIMATE_PRESSURE", {
            "total_estimated": state.budget.total_estimated,
            "status": state.budget.status
        })

        # 4. Action thinking (Ops Crew)
        state.tasks = OpsCrew.create_tasks(state)
        self.state_mgr.log_audit("OPS_CREW", "CREATE_TASKS", {"task_count": len(state.tasks)})

        # 5. Governance thinking (Governance Crew)
        state.approvals = GovernanceCrew.evaluate_gates(state)
        self.state_mgr.log_audit("GOVERNANCE_CREW", "EVALUATE_GATES", {"gate_count": len(state.approvals)})

        # 6. Memory thinking (Studio Memory)
        memory_mgr = StudioMemoryManager(state)
        state.studio_memory = memory_mgr.get_structured_summary()
        self.state_mgr.log_audit("STUDIO_MEMORY", "UPDATE_KNOWLEDGE_BASE", {"memory_keys": list(state.studio_memory.keys())})

        # 7. Gemini AI Reasoning (if GOOGLE_API_KEY is configured)
        ai_client = GeminiClient()
        if ai_client.is_available():
            ai_note = ai_client.generate_text(
                f"Evaluate director intent '{intent}' for script with {len(state.scenes)} scenes. Provide 2 bullet points of executive advice.",
                system_instruction="You are an Executive Producer and Director's AI Advisor."
            )
            if ai_note:
                self.state_mgr.log_audit("GEMINI_AI", "EXECUTIVE_ADVICE", {"advice": ai_note})

        # Save complete state
        self.state_mgr.save_state(state)
        return state
