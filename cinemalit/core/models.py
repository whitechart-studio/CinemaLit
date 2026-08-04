"""
Data models for CinemaLit Studio.
Uses Python dataclasses for lightweight, zero-dependency serialization.
"""

import json
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional

@dataclass
class Scene:
    id: str
    number: str
    header: str
    location: str
    setting: str  # INT / EXT / INT/EXT
    time_of_day: str  # DAY / NIGHT / DAWN / DUSK
    page_count: float
    synopsis: str
    characters: List[str] = field(default_factory=list)
    props: List[str] = field(default_factory=list)
    risks: List[str] = field(default_factory=list)
    dialog_snippet: str = ""

@dataclass
class ProductionItem:
    id: str
    scene_id: str
    category: str  # PROP, CAST, LOCATION, GEAR, STUNT, VFX
    name: str
    quantity: int = 1
    complexity: str = "LOW"  # LOW, MEDIUM, HIGH
    notes: str = ""

@dataclass
class RiskItem:
    id: str
    department: str  # STORY, PRODUCTION, BUDGET, SCHEDULE, SAFETY
    title: str
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    description: str
    mitigation: str
    scene_ids: List[str] = field(default_factory=list)

@dataclass
class BudgetItem:
    department: str
    estimated_cost: float
    pressure_point: bool = False
    suggestion: str = ""

@dataclass
class BudgetSummary:
    total_estimated: float = 0.0
    max_target: float = 5000.0
    status: str = "UNDER_BUDGET"  # UNDER_BUDGET, AT_RISK, OVER_BUDGET
    department_breakdown: Dict[str, float] = field(default_factory=dict)
    cost_pressures: List[BudgetItem] = field(default_factory=list)
    savings_proposals: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class ScheduleDay:
    day_number: int
    title: str
    scene_ids: List[str] = field(default_factory=list)
    total_pages: float = 0.0
    locations: List[str] = field(default_factory=list)
    cast_required: List[str] = field(default_factory=list)
    estimated_hours: float = 10.0
    notes: str = ""

@dataclass
class SchedulePlan:
    total_days: int = 2
    days: List[ScheduleDay] = field(default_factory=list)
    location_moves: int = 0
    efficiency_score: float = 100.0

@dataclass
class TaskItem:
    id: str
    department: str
    title: str
    description: str
    priority: str = "MEDIUM"  # LOW, MEDIUM, HIGH
    assignee: str = "Unassigned"
    status: str = "PENDING"  # PENDING, IN_PROGRESS, COMPLETED

@dataclass
class ApprovalGate:
    id: str
    gate_name: str
    status: str = "PENDING"  # PENDING, APPROVED, REJECTED
    rationale: str = ""
    required_role: str = "Director"
    timestamp: str = ""

@dataclass
class AuditLogEntry:
    id: str
    timestamp: str
    actor: str  # Director, Gemini_Agent, Story_Crew, etc.
    action: str
    details: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ProjectState:
    project_id: str
    name: str
    script_path: str = ""
    created_at: str = ""
    director_intent: str = ""
    scenes: List[Scene] = field(default_factory=list)
    production_items: List[ProductionItem] = field(default_factory=list)
    risks: List[RiskItem] = field(default_factory=list)
    budget: BudgetSummary = field(default_factory=BudgetSummary)
    schedule: SchedulePlan = field(default_factory=SchedulePlan)
    tasks: List[TaskItem] = field(default_factory=list)
    approvals: List[ApprovalGate] = field(default_factory=list)
    audit_logs: List[AuditLogEntry] = field(default_factory=list)
    studio_memory: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProjectState":
        scenes = [Scene(**s) for s in data.get("scenes", [])]
        prod_items = [ProductionItem(**p) for p in data.get("production_items", [])]
        risks = [RiskItem(**r) for r in data.get("risks", [])]

        b_data = data.get("budget", {})
        cost_pressures = [BudgetItem(**cp) for cp in b_data.get("cost_pressures", [])]
        budget = BudgetSummary(
            total_estimated=b_data.get("total_estimated", 0.0),
            max_target=b_data.get("max_target", 5000.0),
            status=b_data.get("status", "UNDER_BUDGET"),
            department_breakdown=b_data.get("department_breakdown", {}),
            cost_pressures=cost_pressures,
            savings_proposals=b_data.get("savings_proposals", [])
        )

        s_data = data.get("schedule", {})
        days = [ScheduleDay(**d) for d in s_data.get("days", [])]
        schedule = SchedulePlan(
            total_days=s_data.get("total_days", 2),
            days=days,
            location_moves=s_data.get("location_moves", 0),
            efficiency_score=s_data.get("efficiency_score", 100.0)
        )

        tasks = [TaskItem(**t) for t in data.get("tasks", [])]
        approvals = [ApprovalGate(**a) for a in data.get("approvals", [])]
        audit_logs = [AuditLogEntry(**al) for al in data.get("audit_logs", [])]

        return cls(
            project_id=data.get("project_id", "project-001"),
            name=data.get("name", "Untitled Project"),
            script_path=data.get("script_path", ""),
            created_at=data.get("created_at", ""),
            director_intent=data.get("director_intent", ""),
            scenes=scenes,
            production_items=prod_items,
            risks=risks,
            budget=budget,
            schedule=schedule,
            tasks=tasks,
            approvals=approvals,
            audit_logs=audit_logs,
            studio_memory=data.get("studio_memory", {})
        )
