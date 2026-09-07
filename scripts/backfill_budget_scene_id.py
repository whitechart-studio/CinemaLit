"""
One-time backfill: budget_items rows written before the scene_id column
existed (see ensure_budget_items_schema in web/server.py) have scene_id NULL
even though the scene is right there in the description text — pipeline.py
writes element-derived lines as "SC-052 -- 1960s microfilm reader". This
parses that prefix back out, looks it up in `scenes`, and re-inserts the row
with scene_id filled in. budget_items is a ReplacingMergeTree keyed on
(project_id, item_id), so a re-INSERT of the same key collapses the old NULL
row on the next merge -- no ALTER ... UPDATE needed (same trick pipeline.py
already uses for the `scenes` table itself).

Rows with no "SC-NNN" prefix (above-the-line cast/director/writer fees,
department overhead) are left alone -- they're genuinely not scene-specific.

Run once per project, or with no args for every project that has budget rows:
    python scripts/backfill_budget_scene_id.py [project_id ...]
"""

import os
import re
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from web.db import CH_DB, ch_ping, ch_query

SCENE_PREFIX = re.compile(r"^\s*([A-Za-z]{1,10}-\d+)\b")


def backfill(project_id: str) -> None:
    scene_map = {
        str(sn): int(sid)
        for sid, sn in ch_query(
            f"SELECT scene_id, scene_number FROM {CH_DB}.scenes FINAL WHERE project_id = {{p:String}}",
            {"p": project_id},
        ).get("data", [])
    }

    rows = ch_query(
        f"SELECT item_id, category, sub_category, description, budgeted_usd, actual_usd, "
        f"vendor, scene_id FROM {CH_DB}.budget_items FINAL WHERE project_id = {{p:String}}",
        {"p": project_id},
    ).get("data", [])

    updated = 0
    for item_id, category, sub_category, description, budgeted, actual, vendor, scene_id in rows:
        if scene_id:
            continue
        match = SCENE_PREFIX.match(str(description))
        if not match:
            continue
        target_scene_id = scene_map.get(match.group(1))
        if target_scene_id is None:
            continue
        ch_query(
            f"INSERT INTO {CH_DB}.budget_items (project_id, item_id, category, sub_category, "
            f"description, budgeted_usd, actual_usd, vendor, scene_id) "
            f"VALUES ({{p:String}}, {{i:UInt32}}, {{cat:String}}, {{sub:String}}, {{d:String}}, "
            f"{{b:Float64}}, {{a:Float64}}, {{v:String}}, {{s:UInt32}})",
            {
                "p": project_id, "i": int(item_id), "cat": str(category), "sub": str(sub_category),
                "d": str(description), "b": float(budgeted), "a": float(actual),
                "v": str(vendor), "s": target_scene_id,
            },
        )
        updated += 1
    print(f"  {project_id}: backfilled {updated}/{len(rows)} rows")


def main() -> int:
    if not ch_ping():
        print("ClickHouse unreachable -- check CLICKHOUSE_* in .env")
        return 1

    project_ids = sys.argv[1:]
    if not project_ids:
        project_ids = [
            str(r[0])
            for r in ch_query(f"SELECT DISTINCT project_id FROM {CH_DB}.budget_items").get("data", [])
        ]

    print(f"Backfilling scene_id for: {', '.join(project_ids)}")
    for project_id in project_ids:
        backfill(project_id)
    print("Done. ClickHouse merges asynchronously -- FINAL reads reflect this immediately either way.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
