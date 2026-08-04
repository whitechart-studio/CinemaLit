"""
Governance Crew Knowledge Base: Studio Greenlight Gates, Clearances & Audit Log Standards.
"""

GOVERNANCE_KNOWLEDGE = {
    "greenlight_gates": [
        {
            "id": "gate-creative-approval",
            "name": "Creative & Script Approval Gate",
            "criteria": "Finalized production draft script ingested with scene breakdown complete."
        },
        {
            "id": "gate-budget-cap",
            "name": "Budget Target & Financial Validation Gate",
            "criteria": "Budget top sheet matches target budget cap with 10% contingency reserve."
        },
        {
            "id": "gate-risk-threshold",
            "name": "Production Risk & Safety Gate",
            "criteria": "All high/critical risk items (firearms, rain, night ext) have logged mitigations and safety releases."
        },
        {
            "id": "gate-schedule-feasibility",
            "name": "Schedule Feasibility Gate",
            "criteria": "Stripboard shoot plan respects max shoot days and minimizes company moves."
        }
    ],
    "completion_bond_requirements": [
        "Finalized bonded budget with 10% contingency floor",
        "Finalized stripboard schedule",
        "Fully executed key crew & cast agreements",
        "Certificate of Insurance (COI) covering general liability and equipment"
    ]
}
