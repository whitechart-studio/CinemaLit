"""
Department CLI: Production Crew (cinemalit-production)
"""

import sys
import argparse
import json
from cinemalit.core.state import StateManager

def main():
    parser = argparse.ArgumentParser(prog="cinemalit-production", description="CinemaLit Production Crew CLI")
    subparsers = parser.add_subparsers(dest="command")

    p_bd = subparsers.add_parser("breakdown", help="Breakdown production items and risks")
    p_bd.add_argument("project_id", nargs="?", help="Project ID or active directory state")

    args = parser.parse_args()

    if args.command == "breakdown":
        mgr = StateManager()
        if not mgr.is_initialized():
            print("Error: No CinemaLit project initialized.")
            sys.exit(1)
        state = mgr.load_state()
        print(f"🎥 PRODUCTION CREW BREAKDOWN ({len(state.production_items)} items, {len(state.risks)} risks)")
        print("-" * 50)
        print("PRODUCTION ITEMS:")
        for item in state.production_items[:10]:
            print(f"  • [{item.category}] {item.name} ({item.complexity}) - {item.notes}")
        print("\nRISK RADAR:")
        for risk in state.risks:
            print(f"  • [{risk.severity}] {risk.title}: {risk.description}")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
