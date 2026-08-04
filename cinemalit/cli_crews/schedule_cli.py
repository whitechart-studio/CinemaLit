"""
Department CLI: Schedule Crew (cinemalit-schedule)
"""

import sys
import argparse
from cinemalit.core.state import StateManager

def main():
    parser = argparse.ArgumentParser(prog="cinemalit-schedule", description="CinemaLit Schedule Crew CLI")
    subparsers = parser.add_subparsers(dest="command")

    p_plan = subparsers.add_parser("plan", help="View schedule stripboard plan")
    p_plan.add_argument("project_id", nargs="?", help="Project ID or active directory state")

    args = parser.parse_args()

    if args.command == "plan":
        mgr = StateManager()
        if not mgr.is_initialized():
            print("Error: No CinemaLit project initialized.")
            sys.exit(1)
        state = mgr.load_state()
        s = state.schedule
        print(f"📅 SCHEDULE CREW PLAN ({s.total_days} Shoot Days, {s.location_moves} Location Moves)")
        print("-" * 50)
        for day in s.days:
            print(f"[{day.title}] - {day.total_pages} Pages")
            print(f"  └ Scenes: {', '.join(day.scene_ids)}")
            print(f"  └ Cast: {', '.join(day.cast_required)}")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
