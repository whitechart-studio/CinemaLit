"""
Main Director CLI for CinemaLit Studio.
Provides the primary interface for human directors and orchestrates crew tools.
"""

import sys
import os
import argparse
import json
from cinemalit.core.state import StateManager
from cinemalit.core.engine import DirectorEngine
from cinemalit.crews.story import StoryCrew
from cinemalit.mcp.server import main as mcp_main

# ANSI Terminal Color Helpers
BOLD = "\033[1m"
RESET = "\033[0m"
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
MAGENTA = "\033[35m"
BLUE = "\033[34m"
GRAY = "\033[90m"

def print_banner():
    banner = f"""
{CYAN}{BOLD}====================================================================={RESET}
{MAGENTA}{BOLD}       🎬 CINEMALIT STUDIO: DIRECTOR-LED AGENTIC PRODUCTION SYSTEM    {RESET}
{CYAN}{BOLD}====================================================================={RESET}
"""
    print(banner)

def init_cmd(name: str):
    mgr = StateManager()
    state = mgr.init_project(name)
    print(f"\n{GREEN}✓ CinemaLit Project '{name}' initialized!{RESET}")
    print(f"  Project ID : {CYAN}{state.project_id}{RESET}")
    print(f"  Workspace  : {GRAY}{mgr.state_dir}{RESET}\n")

def ingest_cmd(script_path: str):
    mgr = StateManager()
    if not mgr.is_initialized():
        print(f"{RED}Error: CinemaLit project not initialized. Run 'cinemalit init <name>' first.{RESET}")
        sys.exit(1)

    if not os.path.exists(script_path):
        print(f"{RED}Error: Script file '{script_path}' not found.{RESET}")
        sys.exit(1)

    with open(script_path, "r", encoding="utf-8") as f:
        content = f.read()

    scenes = StoryCrew.parse_script(content)
    state = mgr.load_state()
    state.script_path = os.path.abspath(script_path)
    state.scenes = scenes
    mgr.save_state(state)
    mgr.log_audit("DIRECTOR", "INGEST_SCRIPT", {"script_path": script_path, "scenes_parsed": len(scenes)})

    print(f"\n{GREEN}✓ Script ingested successfully!{RESET}")
    print(f"  File   : {CYAN}{script_path}{RESET}")
    print(f"  Scenes : {YELLOW}{len(scenes)} scenes parsed{RESET}\n")

def direct_cmd(intent: str):
    mgr = StateManager()
    if not mgr.is_initialized():
        print(f"{RED}Error: CinemaLit project not initialized. Run 'cinemalit init <name>' first.{RESET}")
        sys.exit(1)

    engine = DirectorEngine(mgr)
    print(f"\n{MAGENTA}{BOLD}🤖 CinemaLit Studio Crew Coordinating...{RESET}")
    print(f"{GRAY}Director Intent: \"{intent}\"{RESET}\n")

    state = engine.direct(intent)
    
    print(f"{GREEN}{BOLD}✓ Production Package Generated!{RESET}\n")

    # Render Summary Cards
    status_cmd()

def status_cmd():
    mgr = StateManager()
    if not mgr.is_initialized():
        print(f"{RED}Error: CinemaLit project not initialized.{RESET}")
        sys.exit(1)

    state = mgr.load_state()
    print_banner()

    print(f"{BOLD}PROJECT:{RESET} {CYAN}{state.name}{RESET} ({GRAY}{state.project_id}{RESET})")
    print(f"{BOLD}DIRECTOR INTENT:{RESET} {YELLOW}\"{state.director_intent or 'None specified'}\"{RESET}\n")

    # 1. Story Overview
    print(f"{BLUE}{BOLD}--- 📖 STORY CREW OVERVIEW ---{RESET}")
    print(f"  Total Scenes     : {len(state.scenes)}")
    print(f"  Total Pages      : {sum(s.page_count for s in state.scenes):.2f} pages")
    print(f"  Unique Locations : {len(set(s.location for s in state.scenes))}")
    print(f"  Unique Characters: {len(set(c for s in state.scenes for c in s.characters))}\n")

    # 2. Risk Radar
    print(f"{RED}{BOLD}--- ⚠️ PRODUCTION RISK RADAR ---{RESET}")
    if not state.risks:
        print(f"  {GRAY}No active production risks flagged.{RESET}")
    else:
        for r in state.risks:
            sev_color = RED if r.severity in ["HIGH", "CRITICAL"] else YELLOW
            print(f"  [{sev_color}{r.severity}{RESET}] {BOLD}{r.title}{RESET}")
            print(f"    └ {r.description}")
            print(f"    └ {CYAN}Mitigation:{RESET} {r.mitigation}")
    print()

    # 3. Budget Pressure
    print(f"{GREEN}{BOLD}--- 💰 BUDGET CREW PRESSURE SUMMARY ---{RESET}")
    b = state.budget
    b_color = GREEN if b.status == "UNDER_BUDGET" else RED
    print(f"  Total Estimated Cost : {b_color}${b.total_estimated:.2f}{RESET}")
    print(f"  Target Budget Cap    : ${b.max_target:.2f}")
    print(f"  Budget Status        : {b_color}{b.status}{RESET}")
    
    if b.savings_proposals:
        print(f"\n  {YELLOW}{BOLD}Suggested Savings Proposals:{RESET}")
        for p in b.savings_proposals:
            print(f"    • [{p['department']}] {p['action']} ({GREEN}Save ${p['estimated_savings']:.2f}{RESET})")
    print()

    # 4. Schedule Plan
    print(f"{MAGENTA}{BOLD}--- 📅 SCHEDULE CREW (STRIPBOARD PLAN) ---{RESET}")
    s = state.schedule
    print(f"  Total Shoot Duration : {BOLD}{s.total_days} Days{RESET}")
    print(f"  Location Moves       : {s.location_moves}")
    print(f"  Efficiency Rating    : {GREEN}{s.efficiency_score:.0f}%{RESET}")
    for day in s.days:
        print(f"    • {BOLD}{day.title}{RESET} ({day.total_pages} pages, {len(day.scene_ids)} scenes)")
    print()

    # 5. Governance Gates
    print(f"{CYAN}{BOLD}--- 🛡️ GOVERNANCE CREW GATES & APPROVALS ---{RESET}")
    for g in state.approvals:
        st_color = GREEN if g.status == "APPROVED" else YELLOW
        print(f"  [{st_color}{g.status}{RESET}] {BOLD}{g.gate_name}{RESET} (ID: {g.id})")
        print(f"    └ {g.rationale}")
    print()

def approve_cmd(action_id: str):
    mgr = StateManager()
    if not mgr.is_initialized():
        print(f"{RED}Error: CinemaLit project not initialized.{RESET}")
        sys.exit(1)

    gate = mgr.approve_action(action_id)
    if gate:
        print(f"\n{GREEN}✓ Approval Granted for Gate '{gate.gate_name}' ({gate.id})!{RESET}\n")
    else:
        print(f"\n{RED}Error: Gate ID '{action_id}' not found in pending approvals.{RESET}\n")

def crew_list_cmd():
    print_banner()
    crews = [
        ("Story Crew", "Extracts scenes, characters, locations, tone, and continuity issues."),
        ("Production Crew", "Identifies props, cast, gear, stunts, and generates Risk Radar."),
        ("Budget Crew", "Flags cost pressure points and suggests tactical savings."),
        ("Schedule Crew", "Proposes optimized stripboard shoot order (e.g. 2-day target)."),
        ("Ops Crew", "Creates actionable tasks, prep checklists, and call sheets."),
        ("Governance Crew", "Manages Studio Greenlight approval gates and audit logs."),
        ("Studio Memory", "Stores and queries structured project knowledge via ClickHouse.")
    ]
    print(f"{BOLD}SPECIALIZED CINEMALIT CREWS:{RESET}\n")
    for name, desc in crews:
        print(f"  {CYAN}{BOLD}• {name:<20}{RESET} {desc}")
    print()

def main():
    parser = argparse.ArgumentParser(prog="cinemalit", description="CinemaLit Studio: Director-led Agentic Production System")
    subparsers = parser.add_subparsers(dest="command")

    # init
    p_init = subparsers.add_parser("init", help="Initialize a CinemaLit project workspace")
    p_init.add_argument("name", help="Name of the film project")

    # ingest
    p_ingest = subparsers.add_parser("ingest", help="Ingest a screenplay (Fountain/Markdown format)")
    p_ingest.add_argument("script_file", help="Path to the screenplay file")

    # direct
    p_direct = subparsers.add_parser("direct", help="Direct the studio crew with intent prompt")
    p_direct.add_argument("intent", help="Director intent string (e.g. 'Can we shoot this in 2 days under $5k?')")

    # status
    subparsers.add_parser("status", help="Show current project state, risks, budget, schedule & greenlight gates")

    # approve
    p_approve = subparsers.add_parser("approve", help="Approve a pending governance gate action")
    p_approve.add_argument("action_id", help="Gate ID or name to approve")

    # crew list
    p_crew = subparsers.add_parser("crew", help="Manage studio crews")
    p_crew_sub = p_crew.add_subparsers(dest="crew_command")
    p_crew_sub.add_parser("list", help="List available studio crews and capabilities")

    # mcp
    p_mcp = subparsers.add_parser("mcp", help="Run MCP tool server")
    p_mcp_sub = p_mcp.add_subparsers(dest="mcp_command")
    p_mcp_sub.add_parser("serve-all", help="Start stdio MCP server for Gemini & agents")

    # web
    subparsers.add_parser("web", help="Launch the CinemaLit Studio Web Dashboard")

    # knowledge
    p_kb = subparsers.add_parser("knowledge", help="Query film industry guidelines & knowledge base")
    p_kb.add_argument("query", nargs="?", default="all", help="Topic to query (breakdown, dood, budget, call-sheet, gates, all)")

    # export
    p_exp = subparsers.add_parser("export", help="Export complete Studio Greenlight Package HTML binder")
    p_exp.add_argument("output", nargs="?", default="greenlight_package.html", help="Output file path (default: greenlight_package.html)")

    args = parser.parse_args()

    if args.command == "init":
        init_cmd(args.name)
    elif args.command == "ingest":
        ingest_cmd(args.script_file)
    elif args.command == "direct":
        direct_cmd(args.intent)
    elif args.command == "status":
        status_cmd()
    elif args.command == "approve":
        approve_cmd(args.action_id)
    elif args.command == "web":
        import subprocess
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        studio_dir = os.path.join(root, "cinemalit-studio")
        dist_index = os.path.join(studio_dir, "dist", "index.html")
        if not os.path.isfile(dist_index):
            print(f"{YELLOW}Building frontend (dist/ not found)...{RESET}")
            build = subprocess.run(
                ["npm", "run", "build"],
                cwd=studio_dir,
                capture_output=True,
                text=True,
            )
            if build.returncode != 0:
                print(f"{RED}Frontend build failed:{RESET}\n{build.stderr or build.stdout}")
                sys.exit(1)
            print(f"{GREEN}✓ Frontend built successfully.{RESET}\n")
        from web.server import main as web_main
        web_main()
    elif args.command == "export":
        from cinemalit.core.state import StateManager
        from cinemalit.core.exporter import GreenlightExporter
        mgr = StateManager()
        if not mgr.is_initialized():
            print(f"{RED}Error: CinemaLit project not initialized.{RESET}")
            sys.exit(1)
        state = mgr.load_state()
        out_file = GreenlightExporter.export_html(state, args.output)
        print(f"\n{GREEN}✓ Studio Greenlight Package Exported Successfully!{RESET}")
        print(f"  File : {CYAN}{out_file}{RESET}\n")
    elif args.command == "knowledge":
        from cinemalit.core.state import StateManager
        from cinemalit.core.memory import StudioMemoryManager
        mgr = StateManager()
        state = mgr.load_state() if mgr.is_initialized() else None
        if not state:
            from cinemalit.core.models import ProjectState
            state = ProjectState("kb-preview", "Knowledge Preview")
        mem = StudioMemoryManager(state)
        res = mem.query(args.query)
        print(f"\n{CYAN}{BOLD}🧠 CINEMALIT KNOWLEDGE BASE ({args.query}){RESET}")
        print(f"{CYAN}====================================================={RESET}\n")
        print(json.dumps(res, indent=2))
        print()
    elif args.command == "crew":
        if args.crew_command == "list":
            crew_list_cmd()
        else:
            p_crew.print_help()
    elif args.command == "mcp":
        if args.mcp_command == "serve-all":
            mcp_main()
        else:
            p_mcp.print_help()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
