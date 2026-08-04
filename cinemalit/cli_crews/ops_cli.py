"""
Department CLI: Ops Crew (cinemalit-ops)
"""

import sys
import argparse
from cinemalit.core.state import StateManager

def main():
    parser = argparse.ArgumentParser(prog="cinemalit-ops", description="CinemaLit Ops Crew CLI")
    subparsers = parser.add_subparsers(dest="command")

    p_tasks = subparsers.add_parser("tasks", help="List actionable production tasks")
    p_tasks.add_argument("project_id", nargs="?", help="Project ID or active directory state")

    args = parser.parse_args()

    if args.command == "tasks":
        mgr = StateManager()
        if not mgr.is_initialized():
            print("Error: No CinemaLit project initialized.")
            sys.exit(1)
        state = mgr.load_state()
        print(f"📋 OPS CREW PRODUCTION TASKS ({len(state.tasks)} tasks)")
        print("-" * 50)
        for t in state.tasks:
            print(f"  • [{t.priority}] [{t.department}] {t.title} -> {t.assignee} ({t.status})")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
