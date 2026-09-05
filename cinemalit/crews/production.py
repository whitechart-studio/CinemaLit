"""
Production Crew module for CinemaLit Studio.
Extracts department breakdown items (props, cast, locations, gear, stunts)
and generates the Production Risk Radar.
"""

import uuid
from typing import List, Dict, Any, Tuple
from cinemalit.core.models import ProjectState, ProductionItem, RiskItem

class ProductionCrew:
    @staticmethod
    def breakdown(state: ProjectState) -> Tuple[List[ProductionItem], List[RiskItem]]:
        """
        Scans scenes and extracts production items and risk flags.
        """
        prod_items: List[ProductionItem] = []
        risks: List[RiskItem] = []

        # Common prop/gear keyword heuristics
        prop_keywords = {
            "gun": ("PROP", "HIGH", "Prop weapon / firearms master required"),
            "knife": ("PROP", "MEDIUM", "Rubber prop blade required"),
            "coffee": ("PROP", "LOW", "Hot beverages & reusable cups"),
            "car": ("LOCATION/GEAR", "HIGH", "Picture vehicle & driving permit"),
            "neon": ("GEAR", "MEDIUM", "Specialty neon lighting rig"),
            "rain": ("VFX", "HIGH", "Practical rain machine / water safety"),
            "blood": ("MAKEUP/FX", "MEDIUM", "Special effects makeup & wardrobe doubles"),
            "explosion": ("STUNT", "CRITICAL", "Pyro license & fire safety marshal"),
            "drone": ("GEAR", "HIGH", "FAA drone operator certification"),
        }

        for scene in state.scenes:
            # 1. Cast items
            for char in scene.characters:
                prod_items.append(ProductionItem(
                    id=f"prod-{uuid.uuid4().hex[:6]}",
                    scene_id=scene.id,
                    category="CAST",
                    name=char,
                    quantity=1,
                    complexity="LOW",
                    notes=f"Cast member in {scene.id}"
                ))

            # 2. Location item
            prod_items.append(ProductionItem(
                id=f"prod-{uuid.uuid4().hex[:6]}",
                scene_id=scene.id,
                category="LOCATION",
                name=scene.location,
                quantity=1,
                complexity="HIGH" if scene.setting == "EXT" and scene.time_of_day == "NIGHT" else "MEDIUM",
                notes=f"{scene.setting} / {scene.time_of_day} permit needed"
            ))

            # 3. Prop & FX Keyword breakdown from scene synopsis & header
            full_text = (scene.header + " " + scene.synopsis + " " + scene.dialog_snippet).lower()
            for kw, (cat, complexity, note) in prop_keywords.items():
                if kw in full_text:
                    prod_items.append(ProductionItem(
                        id=f"prod-{uuid.uuid4().hex[:6]}",
                        scene_id=scene.id,
                        category=cat,
                        name=kw.capitalize(),
                        quantity=1,
                        complexity=complexity,
                        notes=note
                    ))
                    # Add risk flag if complexity is HIGH or CRITICAL
                    if complexity in ["HIGH", "CRITICAL"]:
                        risks.append(RiskItem(
                            id=f"risk-{uuid.uuid4().hex[:6]}",
                            department="PRODUCTION",
                            title=f"Specialized Requirement: {kw.capitalize()}",
                            severity="HIGH" if complexity == "HIGH" else "CRITICAL",
                            description=f"Scene {scene.id} contains '{kw}' requiring {note}.",
                            mitigation=f"Hire certified specialist or substitute with practical low-cost alternative.",
                            scene_ids=[scene.id]
                        ))

            # 4. Night Exterior Risk Flag
            if scene.setting == "EXT" and scene.time_of_day == "NIGHT":
                risks.append(RiskItem(
                    id=f"risk-{uuid.uuid4().hex[:6]}",
                    department="PRODUCTION",
                    title=f"Night Exterior Lighting & Permit Risk ({scene.id})",
                    severity="HIGH",
                    description=f"{scene.id} at {scene.location} requires generator power, permits, and night lighting.",
                    mitigation="Consolidate with other night scenes or shoot during dusk with LED panels.",
                    scene_ids=[scene.id]
                ))

        # Deduplicate risks by title
        unique_risks: Dict[str, RiskItem] = {}
        for r in risks:
            if r.title not in unique_risks:
                unique_risks[r.title] = r
            else:
                unique_risks[r.title].scene_ids.extend(r.scene_ids)

        return prod_items, list(unique_risks.values())
