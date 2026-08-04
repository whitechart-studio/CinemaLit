"""
Ops Crew module for CinemaLit Studio.
Generates actionable tasks, prep checklists, call sheet summaries, and deliverables.
"""

import uuid
from typing import List, Dict, Any
from cinemalit.core.models import ProjectState, TaskItem

class OpsCrew:
    @staticmethod
    def create_tasks(state: ProjectState) -> List[TaskItem]:
        """
        Generates actionable production tasks across departments based on project state.
        """
        tasks: List[TaskItem] = []

        # 1. Location & Permitting Tasks
        locations = set(s.location for s in state.scenes)
        for loc in locations:
            tasks.append(TaskItem(
                id=f"task-{uuid.uuid4().hex[:6]}",
                department="Locations",
                title=f"Secure permit & site agreement: {loc}",
                description=f"Obtain written location release form and check power supply for {loc}.",
                priority="HIGH",
                assignee="Location Manager",
                status="PENDING"
            ))

        # 2. Risk Mitigation Tasks
        for risk in state.risks:
            tasks.append(TaskItem(
                id=f"task-{uuid.uuid4().hex[:6]}",
                department=risk.department,
                title=f"Mitigate Risk: {risk.title}",
                description=f"{risk.description} Solution: {risk.mitigation}",
                priority="HIGH" if risk.severity in ["HIGH", "CRITICAL"] else "MEDIUM",
                assignee="Producer / AD",
                status="PENDING"
            ))

        # 3. Schedule Prep Tasks
        for day in state.schedule.days:
            tasks.append(TaskItem(
                id=f"task-{uuid.uuid4().hex[:6]}",
                department="Schedule/AD",
                title=f"Draft Day {day.day_number} Call Sheet",
                description=f"Confirm call times for cast ({', '.join(day.cast_required[:3])}) and crew for {day.title}.",
                priority="MEDIUM",
                assignee="1st AD",
                status="PENDING"
            ))

        # 4. Budget / Catering Tasks
        tasks.append(TaskItem(
            id=f"task-{uuid.uuid4().hex[:6]}",
            department="Production",
            title="Book Catering & Craft Services",
            description="Arrange lunch & coffee for 2 shooting days under budget cap.",
            priority="HIGH",
            assignee="Production Coordinator",
            status="PENDING"
        ))

        return tasks
