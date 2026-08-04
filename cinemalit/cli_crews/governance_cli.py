"""
Department CLI: Governance Crew (cinemalit-governance)
"""

import sys
import argparse
from cinemalit.core.state import StateManager

def main():
    parser = argparse.ArgumentParser(prog="cinemalit-governance", description="CinemaLit Governance Crew CLI")
    subparsers = parser.add_subparsers(dest="command")

    p_app = subparsers.add_parser("approvals", help="List studio greenlight approval gates")
    p_app.add_argument("project_id", nargs="?", help="Project ID or active directory state")

    args = parser.parse_args()

    if args.command == "approvals":
        mgr = StateManager()
        if not mgr.is_initialized():
            print("Error: No CinemaLit project initialized.")
            sys.exit(1)
        state = mgr.load_state()
        print(f"🛡️ GOVERNANCE CREW APPROVAL GATES ({len(state.approvals)} gates)")
        print("-" * 50)
        for g in state.approvals:
            print(f"  • [{g.status}] {g.gate_name} (ID: {g.id})")
            print(f"    └ {g.rationale}")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
