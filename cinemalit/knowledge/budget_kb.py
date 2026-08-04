"""
Budget Crew Knowledge Base: ATL vs BTL, Top Sheet Standards, and Microbudget Guidelines.
"""

BUDGET_KNOWLEDGE = {
    "structure": {
        "above_the_line": ["Story Acquisition", "Screenwriter", "Director", "Producers", "Lead Cast"],
        "below_the_line": ["Production Crew", "Equipment Rental", "Locations & Permits", "Catering & Crafty", "Art Dept & Props", "Post-Production"],
        "contingency_buffer": "10% mandatory reserve of total direct production cost"
    },
    "microbudget_target_allocation": {
        "target_budget": 5000.0,
        "recommended_breakdown": {
            "Cast": 1250.0,            # 25%
            "Locations & Permits": 1250.0, # 25%
            "Camera & Lighting Gear": 1000.0, # 20%
            "Catering & Crafty": 750.0, # 15%
            "Post & Contingency": 750.0  # 15%
        }
    },
    "savings_strategies": [
        {
            "category": "Locations",
            "tactic": "Single Location Redressing",
            "desc": "Consolidate multiple script locations into 1 primary shooting venue with distinct camera angles and set dressings."
        },
        {
            "category": "Lighting/Gear",
            "tactic": "Battery LED Rig",
            "desc": "Replace heavy gas-powered generators and HMI lights with fast prime lenses and high-CRI battery LED panels."
        },
        {
            "category": "Cast",
            "tactic": "Featured Extra Consolidation",
            "desc": "Combine minor non-essential speaking parts into featured background extras or a single key supporting actor."
        }
    ]
}
