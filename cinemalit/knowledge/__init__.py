"""
CinemaLit Studio Knowledge Base: Film Industry Standards & Guidelines.
Stores deep domain expertise for script breakdown, Movie Magic categories,
DOOD stripboard scheduling, below-the-line budgeting, call sheets, and studio greenlight gates.
"""

from .story_kb import STORY_KNOWLEDGE
from .production_kb import PRODUCTION_KNOWLEDGE
from .budget_kb import BUDGET_KNOWLEDGE
from .schedule_kb import SCHEDULE_KNOWLEDGE
from .ops_kb import OPS_KNOWLEDGE
from .governance_kb import GOVERNANCE_KNOWLEDGE

__all__ = [
    "STORY_KNOWLEDGE",
    "PRODUCTION_KNOWLEDGE",
    "BUDGET_KNOWLEDGE",
    "SCHEDULE_KNOWLEDGE",
    "OPS_KNOWLEDGE",
    "GOVERNANCE_KNOWLEDGE"
]
