"""
Story Crew module for CinemaLit Studio.
Extracts scenes, characters, locations, tone, continuity, dialogue, and page counts.
"""

import re
from typing import List, Dict, Any, Tuple
from cinemalit.core.models import Scene, ProjectState

class StoryCrew:
    @staticmethod
    def parse_script(script_text: str) -> List[Scene]:
        """
        Parses a screenplay (Fountain format or standard text/markdown script).
        Recognizes scene headers (INT., EXT., INT./EXT., DAY, NIGHT, etc.)
        """
        scenes: List[Scene] = []
        lines = script_text.splitlines()
        
        current_header = ""
        current_lines: List[str] = []
        scene_count = 0

        # Pattern for scene headers
        header_pattern = re.compile(
            r'^(INT\.|EXT\.|INT/EXT\.|EXT/INT\.|INT\s|EXT\s)',
            re.IGNORECASE
        )

        blocks: List[Tuple[str, List[str]]] = []
        temp_header = ""
        temp_lines = []

        for line in lines:
            stripped = line.strip()
            if header_pattern.match(stripped):
                if temp_header or temp_lines:
                    blocks.append((temp_header, temp_lines))
                temp_header = stripped
                temp_lines = []
            else:
                if temp_header:
                    temp_lines.append(line)

        if temp_header or temp_lines:
            blocks.append((temp_header, temp_lines))

        # If no standard scene headers found, create a fallback single scene
        if not blocks:
            blocks = [("INT. PRODUCTION STUDIO - DAY", lines)]

        for idx, (hdr, block_lines) in enumerate(blocks, start=1):
            scene_id = f"SCENE_{idx:02d}"
            
            # Parse setting & time of day
            setting = "INT"
            if "EXT." in hdr.upper() or "EXT " in hdr.upper():
                setting = "EXT"
            elif "INT/EXT" in hdr.upper() or "EXT/INT" in hdr.upper():
                setting = "INT/EXT"

            time_of_day = "DAY"
            if "NIGHT" in hdr.upper():
                time_of_day = "NIGHT"
            elif "DAWN" in hdr.upper():
                time_of_day = "DAWN"
            elif "DUSK" in hdr.upper():
                time_of_day = "DUSK"

            # Parse location from header
            header_clean = hdr.upper()
            location = header_clean
            for prefix in ["INT./EXT.", "EXT./INT.", "INT.", "EXT."]:
                if header_clean.startswith(prefix):
                    header_clean = header_clean[len(prefix):].strip()
                    break
            
            # Remove time of day from location name
            for tod in ["- NIGHT", "- DAY", "- DAWN", "- DUSK", "NIGHT", "DAY"]:
                if header_clean.endswith(tod):
                    header_clean = header_clean[:-len(tod)].strip(" -")
                    break

            location = header_clean if header_clean else "LOCATION UNKNOWN"

            # Extract character names (UPPERCASE single lines surrounded by text)
            characters = set()
            dialogue_snippets = []
            block_text = "\n".join(block_lines)

            for line in block_lines:
                s_line = line.strip()
                if s_line.isupper() and 2 <= len(s_line) <= 25 and not header_pattern.match(s_line):
                    # Exclude transitions like CUT TO:, FADE OUT.
                    if not s_line.endswith(":") and s_line not in ["CUT TO", "FADE OUT", "FADE IN"]:
                        characters.add(s_line)
                elif len(s_line) > 10 and not s_line.isupper():
                    if len(dialogue_snippets) < 2:
                        dialogue_snippets.append(s_line)

            # Estimate page count (roughly 55 lines per screenplay page)
            page_count = max(0.25, round(len(block_lines) / 45.0, 2))

            # Synopsis from first non-empty action line
            synopsis = ""
            for l in block_lines:
                if l.strip() and not l.strip().isupper():
                    synopsis = l.strip()[:120]
                    break
            if not synopsis:
                synopsis = f"Scene taking place at {location}."

            scene = Scene(
                id=scene_id,
                number=str(idx),
                header=hdr,
                location=location,
                setting=setting,
                time_of_day=time_of_day,
                page_count=page_count,
                synopsis=synopsis,
                characters=sorted(list(characters)),
                dialog_snippet=" / ".join(dialogue_snippets[:2])
            )
            scenes.append(scene)

        return scenes

    @staticmethod
    def analyze(state: ProjectState) -> Dict[str, Any]:
        """Runs Story Crew analysis over extracted scenes."""
        total_pages = sum(s.page_count for s in state.scenes)
        all_chars = set()
        all_locs = set()
        night_scenes = []

        for s in state.scenes:
            all_chars.update(s.characters)
            all_locs.add(s.location)
            if s.time_of_day == "NIGHT":
                night_scenes.append(s.id)

        return {
            "total_scenes": len(state.scenes),
            "total_pages": round(total_pages, 2),
            "unique_characters": sorted(list(all_chars)),
            "unique_locations": sorted(list(all_locs)),
            "night_scene_count": len(night_scenes),
            "continuity_flags": [
                f"{len(night_scenes)} night scenes require evening crew setup and lighting package."
            ] if night_scenes else []
        }
