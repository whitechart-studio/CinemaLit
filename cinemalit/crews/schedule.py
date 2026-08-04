"""
Schedule Crew module for CinemaLit Studio.
Generates an optimized stripboard shooting order targetting a 2-day shoot schedule
grouped by location and time-of-day to minimize company moves.
"""

from typing import List, Dict, Any
from cinemalit.core.models import ProjectState, SchedulePlan, ScheduleDay, Scene

class ScheduleCrew:
    @staticmethod
    def generate_plan(state: ProjectState, target_days: int = 2) -> SchedulePlan:
        """
        Groups scenes by location and time of day, distributing them into target_days.
        """
        scenes = state.scenes
        if not scenes:
            return SchedulePlan(total_days=target_days, days=[], location_moves=0, efficiency_score=100.0)

        # Sort scenes by Location first, then Time of Day (DAY before NIGHT)
        sorted_scenes = sorted(
            scenes,
            key=lambda s: (s.location, 0 if s.time_of_day in ["DAY", "DAWN"] else 1)
        )

        total_pages = sum(s.page_count for s in scenes)
        target_pages_per_day = total_pages / float(target_days)

        days: List[ScheduleDay] = []
        current_day_scenes: List[Scene] = []
        current_pages = 0.0
        current_day_num = 1

        for scene in sorted_scenes:
            current_day_scenes.append(scene)
            current_pages += scene.page_count

            # If reached page threshold or last scene, close the day
            if (current_pages >= target_pages_per_day and current_day_num < target_days) or scene == sorted_scenes[-1]:
                sc_ids = [s.id for s in current_day_scenes]
                sc_locs = sorted(list(set(s.location for s in current_day_scenes)))
                sc_cast = sorted(list(set(c for s in current_day_scenes for c in s.characters)))
                day_title = f"Day {current_day_num}: {', '.join(sc_locs[:2])}"

                days.append(ScheduleDay(
                    day_number=current_day_num,
                    title=day_title,
                    scene_ids=sc_ids,
                    total_pages=round(current_pages, 2),
                    locations=sc_locs,
                    cast_required=sc_cast,
                    estimated_hours=min(12.0, max(8.0, round(current_pages * 2.2, 1))),
                    notes=f"Shooting {len(sc_ids)} scenes across {len(sc_locs)} location(s)."
                ))

                current_day_num += 1
                current_day_scenes = []
                current_pages = 0.0

        # Calculate company moves (location transitions between consecutive scenes across days)
        location_moves = len(set(loc for d in days for loc in d.locations)) - 1
        location_moves = max(0, location_moves)

        efficiency = max(50.0, 100.0 - (location_moves * 10.0))

        return SchedulePlan(
            total_days=len(days),
            days=days,
            location_moves=location_moves,
            efficiency_score=efficiency
        )
