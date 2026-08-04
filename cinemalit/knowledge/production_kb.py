"""
Production Crew Knowledge Base: Movie Magic Breakdown Categories & Risk Radar Guidelines.
"""

PRODUCTION_KNOWLEDGE = {
    "movie_magic_categories": [
        {"name": "Cast Members", "code": "CAST", "desc": "Principal actors with speaking roles"},
        {"name": "Background Actors", "code": "EXTRAS", "desc": "Atmosphere and non-speaking extra talent"},
        {"name": "Stunts", "code": "STUNT", "desc": "Specialized action requiring stunt coordinator & safety team"},
        {"name": "Vehicles", "code": "VEHICLE", "desc": "Picture cars, stunt vehicles, and transport"},
        {"name": "Props", "code": "PROP", "desc": "Handheld objects handled by actors"},
        {"name": "Wardrobe", "code": "COSTUME", "desc": "Costumes, period clothing, and outfit changes"},
        {"name": "Makeup/Hair", "code": "MAKEUP", "desc": "Special makeup, prosthetics, wounds, blood"},
        {"name": "Animals", "code": "ANIMAL", "desc": "Animals requiring licensed animal wrangler"},
        {"name": "Sound/Music", "code": "SOUND", "desc": "Playback tracks, live music, or specific SFX"},
        {"name": "Art Dept / Set Dressing", "code": "ART", "desc": "Furniture, set dressings, environmental decor"},
        {"name": "Greenery", "code": "GREEN", "desc": "Plants, trees, landscaping elements"},
        {"name": "Special Effects (SFX)", "code": "SFX", "desc": "Practical on-set effects (rain, fog, pyrotechnics)"},
        {"name": "Visual Effects (VFX)", "code": "VFX", "desc": "Green screen, CGI, plate shots, wire removals"},
        {"name": "Special Equipment", "code": "EQUIPMENT", "desc": "Camera cranes, dollies, steadicam, drone rigs"},
        {"name": "Additional Labor / Security", "code": "SECURITY", "desc": "Off-duty police, security, traffic control"}
    ],
    "risk_radar_rules": {
        "firearms_weapons": {
            "severity": "HIGH/CRITICAL",
            "mandate": "Licensed Armorer present on set. Prop weapons must be inert/rubber unless firing blanks under supervision.",
            "mitigation": "Substitute real weapons with high-quality prop replicas or adjust action."
        },
        "night_exteriors": {
            "severity": "HIGH",
            "mandate": "Requires city permits, street closure, generator power, and high-output lighting package.",
            "mitigation": "Shoot during golden hour/dusk or use portable high-output LED battery fixtures."
        },
        "water_rain_fx": {
            "severity": "HIGH",
            "mandate": "Water safety officer required; all electrical distribution (distro) GFCI protected.",
            "mitigation": "Use directional rain bar or simulate wet pavement with water truck pre-wet."
        }
    }
}
