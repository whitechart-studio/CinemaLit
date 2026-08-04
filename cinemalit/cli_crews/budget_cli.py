"""
Department CLI: Budget Crew (cinemalit-budget)
"""

import sys
import argparse
from cinemalit.core.state import StateManager

def main():
    parser = argparse.ArgumentParser(prog="cinemalit-budget", description="CinemaLit Budget Crew CLI")
    subparsers = parser.add_subparsers(dest="command")

    p_risks = subparsers.add_parser("risks", help="Analyze budget risks and savings")
    p_risks.add_argument("project_id", nargs="?", help="Project ID or active directory state")

    args = parser.parse_args()

    if args.command == "risks":
        mgr = StateManager()
        if not mgr.is_initialized():
            print("Error: No CinemaLit project initialized.")
            sys.exit(1)
        state = mgr.load_state()
        b = state.budget
        print(f"💰 BUDGET CREW RISKS (${b.total_estimated:.2f} / Target: ${b.max_target:.2f})")
        print("-" * 50)
        print("DEPARTMENT BREAKDOWN:")
        for dept, cost in b.department_breakdown.items():
            print(f"  • {dept:<28}: ${cost:.2f}")
        print("\nSAVINGS PROPOSALS:")
        for p in b.savings_proposals:
            print(f"  • [{p['department']}] {p['action']} (Save ${p['estimated_savings']:.2f})")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
