"""
ADK tool wrappers for CinemaLit Studio.

These are NOT reimplementations — they import and reuse the exact same functions
the web dashboard's chat feature already calls today (web/server.py's AGENT_TOOLS),
so the agent has identical ClickHouse read/write behavior to what's already live.
"""

from web.server import query_production_db, get_scene_details, add_scene_element

# ADK discovers a tool's name/description from the function's own name and
# docstring, so no extra wrapping is needed — these are usable as ADK
# FunctionTools exactly as imported.
CINEMALIT_TOOLS = [query_production_db, get_scene_details, add_scene_element]
