"""
Story Crew Knowledge Base & Industry Guidelines.
"""

STORY_KNOWLEDGE = {
    "page_measurement": {
        "unit": "Eighths of a page (1/8)",
        "standard_page_lines": 54,
        "description": "Standard screenplay formatting yields ~1 minute of screen time per full page. Scenes are measured in 1/8th increments."
    },
    "scene_headers": {
        "components": ["Setting (INT/EXT)", "Location Name", "Time of Day (DAY/NIGHT/DAWN/DUSK)"],
        "rules": [
            "INT = Interior (requires interior lighting package)",
            "EXT = Exterior (subject to weather, sun position, ambient noise)",
            "INT/EXT = Transitional (moving vehicle, doorway, porch)"
        ]
    },
    "coverage_guidelines": {
        "indie_short": "Target 2.0 - 3.5 pages per shoot day",
        "dialogue_heavy": "Budget 1.5 - 2.0 pages per shoot day due to coverage angles",
        "action_heavy": "Budget 0.5 - 1.5 pages per shoot day due to complex stunt & camera setups"
    }
}
