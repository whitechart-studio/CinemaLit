"""
Budget Crew module for CinemaLit Studio.
Estimates production department costs, flags cost pressures against Director target budget,
and suggests concrete savings & tradeoffs.
"""

from typing import List, Dict, Any
from cinemalit.core.models import ProjectState, BudgetSummary, BudgetItem

class BudgetCrew:
    @staticmethod
    def calculate_budget(state: ProjectState, target_budget: float = 5000.0) -> BudgetSummary:
        """
        Calculates department estimated costs based on script breakdown parameters.
        """
        num_scenes = len(state.scenes)
        total_pages = sum(s.page_count for s in state.scenes)
        num_locations = len(set(s.location for s in state.scenes))
        num_cast = len(set(c for s in state.scenes for c in s.characters))
        num_night = len([s for s in state.scenes if s.time_of_day == "NIGHT"])

        # Department cost estimates (standard micro-indie rates)
        cast_cost = num_cast * 250.0 * 2  # 2 days per actor @ $250/day
        location_cost = num_locations * 600.0  # Location fees / permits
        gear_cost = 1200.0 + (300.0 if num_night > 0 else 0.0)  # Camera/Lighting rental
        craft_cost = (num_cast + 5) * 45.0 * 2  # Crew & cast catering/crafty for 2 days
        post_cost = 800.0  # Edit & color grade

        department_breakdown = {
            "Cast": cast_cost,
            "Locations & Permits": location_cost,
            "Camera & Lighting Gear": gear_cost,
            "Catering & Craft Service": craft_cost,
            "Post-Production": post_cost
        }

        total_estimated = sum(department_breakdown.values())

        cost_pressures: List[BudgetItem] = []
        savings_proposals: List[Dict[str, Any]] = []

        # Cost pressure detection
        if location_cost > 1500.0:
            cost_pressures.append(BudgetItem(
                department="Locations & Permits",
                estimated_cost=location_cost,
                pressure_point=True,
                suggestion=f"Having {num_locations} distinct locations incurs ${location_cost:.0f} in location fees."
            ))
            savings_proposals.append({
                "department": "Locations",
                "action": "Consolidate scenes into 1 primary location with multi-angle redressing.",
                "estimated_savings": location_cost - 600.0
            })

        if gear_cost > 1200.0:
            cost_pressures.append(BudgetItem(
                department="Camera & Lighting Gear",
                estimated_cost=gear_cost,
                pressure_point=True,
                suggestion="Night shooting package increases camera/lighting rental cost."
            ))
            savings_proposals.append({
                "department": "Gear",
                "action": "Use fast prime lenses & portable LED battery lights instead of generator package.",
                "estimated_savings": 400.0
            })

        if cast_cost > 1000.0:
            cost_pressures.append(BudgetItem(
                department="Cast",
                estimated_cost=cast_cost,
                pressure_point=True,
                suggestion=f"Ensemble cast of {num_cast} actors drives up talent fees."
            ))
            savings_proposals.append({
                "department": "Cast",
                "action": "Combine non-essential speaking roles into background extras or single featured actor.",
                "estimated_savings": 500.0
            })

        # Calculate adjusted total if proposals applied
        potential_savings = sum(p["estimated_savings"] for p in savings_proposals)
        
        status = "UNDER_BUDGET"
        if total_estimated > target_budget:
            status = "OVER_BUDGET"
        elif total_estimated > (target_budget * 0.85):
            status = "AT_RISK"

        return BudgetSummary(
            total_estimated=total_estimated,
            max_target=target_budget,
            status=status,
            department_breakdown=department_breakdown,
            cost_pressures=cost_pressures,
            savings_proposals=savings_proposals
        )
