import os

from dotenv import load_dotenv

# Must run before anything below imports agent.py (which reads GEMINI_MODEL /
# GOOGLE_* from the environment at import time) — importing ANY submodule of
# this package (bridge, tools, crew_tools, agent) always runs this __init__
# first, so this is the one place that's guaranteed to load before agent.py
# does, regardless of which submodule was imported first.
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

from cinemalit_agent.agent import root_agent

__all__ = ["root_agent"]
