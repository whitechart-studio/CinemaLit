"""
Department CLI: Story Crew (cinemalit-story)
"""

import sys
import os
import argparse
import json
from cinemalit.crews.story import StoryCrew

def main():
    parser = argparse.ArgumentParser(prog="cinemalit-story", description="CinemaLit Story Crew CLI")
    subparsers = parser.add_subparsers(dest="command")

    p_analyze = subparsers.add_parser("analyze", help="Analyze screenplay script")
    p_analyze.add_argument("script_file", help="Path to screenplay file")

    args = parser.parse_args()

    if args.command == "analyze":
        if not os.path.exists(args.script_file):
            print(f"Error: Script file '{args.script_file}' not found.")
            sys.exit(1)
        with open(args.script_file, "r", encoding="utf-8") as f:
            content = f.read()
        scenes = StoryCrew.parse_script(content)
        print(f"📖 STORY CREW ANALYSIS ({len(scenes)} scenes parsed)")
        print("-" * 50)
        for s in scenes:
            print(f"[{s.id}] {s.header} | Page: {s.page_count} | Cast: {', '.join(s.characters)}")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
