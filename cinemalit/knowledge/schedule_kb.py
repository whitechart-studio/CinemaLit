"""
Schedule Crew Knowledge Base: Stripboard Scheduling, DOOD Codes & Location Move Optimization.
"""

SCHEDULE_KNOWLEDGE = {
    "dood_status_codes": {
        "SW": "Start Work - Talent's first day on set.",
        "W": "Work - Standard shooting day.",
        "WF": "Work Finish - Talent's final day on production.",
        "SWF": "Start-Work-Finish - Single-day talent call.",
        "H": "Hold - Standby day (actor paid daily rate to remain available).",
        "D": "Drop - Actor temporarily released from payroll during extended gap.",
        "P": "Pickup - Actor returns to payroll after a Drop period."
    },
    "stripboard_optimization_rules": [
        "Rule 1: Group scenes by Location first to eliminate company moves.",
        "Rule 2: Group by Light Condition (DAY vs NIGHT) to avoid mid-day lighting package tear-downs.",
        "Rule 3: Schedule demanding stunt or emotional scenes early in the day.",
        "Rule 4: Keep company moves under 1 per shoot day."
    ],
    "shooting_velocity": {
        "short_film_target": "2.0 - 3.0 pages per day",
        "feature_indie_target": "3.0 - 5.0 pages per day",
        "studio_blockbuster": "1.0 - 2.0 pages per day"
    }
}
