"""
Governance Crew module for CinemaLit Studio.
Manages Greenlight Gates, Director approvals, risk thresholds, and auditability.
"""

import uuid
import time
from typing import List, Dict, Any
from cinemalit.core.models import ProjectState, ApprovalGate

class GovernanceCrew:
    @staticmethod
    def evaluate_gates(state: ProjectState) -> List[ApprovalGate]:
        """
        Evaluates project state against mandatory Studio Greenlight Gates.
        """
        gates: List[ApprovalGate] = []

        # Gate 1: Budget Cap Approval
        budget_status = state.budget.status
        budget_rationale = (
            f"Estimated budget is ${state.budget.total_estimated:.2f} vs ${state.budget.max_target:.2f} cap. "
            f"Status: {budget_status}."
        )
        gates.append(ApprovalGate(
            id="gate-budget-cap",
            gate_name="Budget Target Gate",
            status="APPROVED" if budget_status == "UNDER_BUDGET" else "PENDING",
            rationale=budget_rationale,
            required_role="Director",
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S")
        ))

        # Gate 2: Production Risk Threshold Gate
        critical_risks = [r for r in state.risks if r.severity in ["HIGH", "CRITICAL"]]
        risk_rationale = (
            f"Found {len(critical_risks)} high/critical risk items requiring director review."
            if critical_risks else "No high severity risks identified."
        )
        gates.append(ApprovalGate(
            id="gate-risk-threshold",
            gate_name="Production Risk Gate",
            status="PENDING" if critical_risks else "APPROVED",
            rationale=risk_rationale,
            required_role="Director",
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S")
        ))

        # Gate 3: 2-Day Shoot Feasibility Gate
        total_days = state.schedule.total_days
        schedule_rationale = f"Schedule planned for {total_days} shoot day(s) with {state.schedule.location_moves} company move(s)."
        gates.append(ApprovalGate(
            id="gate-schedule-feasibility",
            gate_name="2-Day Shoot Schedule Gate",
            status="APPROVED" if total_days <= 2 else "PENDING",
            rationale=schedule_rationale,
            required_role="Director",
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S")
        ))

        return gates
