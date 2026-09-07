"""
Schema migration v1 -> v2: multi-project support.

DESTRUCTIVE. Drops and recreates the 6 demo tables (scenes, cast_members,
scene_cast, budget_items, elements, shots) because v2 changes their sorting
key to lead with project_id, and ClickHouse cannot ALTER an existing sorting
key prefix. users / storyboards / governance_gates / agent_audit_log are NOT
dropped -- they hold real accumulated state.

What v2 adds:
  * projects table      -- projects stop living only in browser localStorage
  * jobs table          -- progress tracking for async agent ingest runs
  * project_id column   -- on all 6 demo tables, so two projects stop sharing
                           one global scene list
  * scenes.scene_text   -- full per-scene prose, so the agent can break a
                           scene down from what actually happens in it rather
                           than a 120-char truncated first action line

Run once:  python scripts/migrate_v2.py
Add --yes to skip the confirmation prompt.
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Same guard web/server.py uses — emoji in the output crashes legacy consoles (cp1252).
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from web.db import CH_DB, ch_ping, ch_query

DEMO_TABLES = ["scenes", "cast_members", "scene_cast", "budget_items", "elements", "shots"]

# storyboards keeps its rows but changes engine: regenerating a scene's frames
# re-inserts the same (project_id, scene_num, frame_num) keys, which needs
# ReplacingMergeTree. Plain MergeTree would stack duplicates, and deleting
# first is not an option — a lightweight DELETE masks that key for later
# inserts too.
STORYBOARDS_DDL = """
CREATE TABLE IF NOT EXISTS {db}.storyboards_v2 (
    project_id String,
    scene_num  String,
    frame_num  UInt8,
    title      String,
    camera_spec String,
    start_sec  Int32,
    end_sec    Int32,
    prompt     String,
    img_url    String,
    created_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(created_at)
ORDER BY (project_id, scene_num, frame_num)
"""

DDL = [
    # ── New in v2 ──────────────────────────────────────────────────────────
    f"""
    CREATE TABLE IF NOT EXISTS {CH_DB}.projects (
        project_id      String,
        user_id         String,
        name            String,
        format          String,
        genre           String,
        budget_cap      Float64,
        shoot_days      UInt8,
        union_scale     String,
        selected_agents Array(String),
        script_file     String,
        script_text     String,
        status          LowCardinality(String),
        created_at      DateTime DEFAULT now(),
        updated_at      DateTime DEFAULT now()
    ) ENGINE = ReplacingMergeTree(updated_at)
    ORDER BY (user_id, project_id)
    """,
    f"""
    CREATE TABLE IF NOT EXISTS {CH_DB}.jobs (
        job_id     String,
        project_id String,
        kind       LowCardinality(String),
        status     LowCardinality(String),
        total      UInt16,
        done       UInt16,
        message    String,
        error      String,
        updated_at DateTime DEFAULT now()
    ) ENGINE = ReplacingMergeTree(updated_at)
    ORDER BY job_id
    """,
    # ── Recreated with project_id ──────────────────────────────────────────
    f"""
    CREATE TABLE {CH_DB}.scenes (
        project_id   String,
        scene_id     UInt32,
        scene_number String,
        int_ext      LowCardinality(String),
        location     String,
        time_of_day  LowCardinality(String),
        page_count   Float32,
        shoot_day    UInt8,
        status       LowCardinality(String),
        description  String,
        scene_text   String
    ) ENGINE = ReplacingMergeTree()
    ORDER BY (project_id, scene_id)
    """,
    f"""
    CREATE TABLE {CH_DB}.cast_members (
        project_id     String,
        cast_id        UInt32,
        character_name String,
        actor_name     String,
        role_type      LowCardinality(String),
        day_rate_usd   Float64,
        total_days     UInt8
    ) ENGINE = ReplacingMergeTree()
    ORDER BY (project_id, cast_id)
    """,
    f"""
    CREATE TABLE {CH_DB}.scene_cast (
        project_id String,
        scene_id   UInt32,
        cast_id    UInt32
    ) ENGINE = ReplacingMergeTree()
    ORDER BY (project_id, scene_id, cast_id)
    """,
    f"""
    CREATE TABLE {CH_DB}.budget_items (
        project_id   String,
        item_id      UInt32,
        category     LowCardinality(String),
        sub_category String,
        description  String,
        budgeted_usd Float64,
        actual_usd   Float64,
        vendor       String
    ) ENGINE = ReplacingMergeTree()
    ORDER BY (project_id, item_id)
    """,
    f"""
    CREATE TABLE {CH_DB}.elements (
        project_id   String,
        element_id   UInt32,
        scene_id     UInt32,
        element_type LowCardinality(String),
        name         String,
        cost_usd     Float64,
        vendor       String,
        status       LowCardinality(String)
    ) ENGINE = ReplacingMergeTree()
    ORDER BY (project_id, element_id)
    """,
    f"""
    CREATE TABLE {CH_DB}.shots (
        project_id  String,
        shot_id     UInt32,
        scene_id    UInt32,
        shot_code   String,
        lens_mm     UInt16,
        movement    String,
        framing     LowCardinality(String),
        description String,
        status      LowCardinality(String)
    ) ENGINE = ReplacingMergeTree()
    ORDER BY (project_id, shot_id)
    """,
]

# Demo seed, now tagged to project p1. Kept so the existing UI still has
# something to show before anyone uploads a script.
SEED = [
    f"""INSERT INTO {CH_DB}.projects
        (project_id, user_id, name, format, genre, budget_cap, shoot_days, union_scale,
         selected_agents, script_file, script_text, status) VALUES
        ('p1', 'demo', 'Neon Echoes', 'Short Film', 'Sci-Fi Thriller', 5000, 2,
         'SAG-AFTRA Ultra Low Budget', ['Director Agent'], 'Neon_Echoes_v3.fountain', '', 'active'),
        ('p2', 'demo', 'Cyberpunk Odyssey', 'Feature Film', 'Action Sci-Fi', 50000, 10,
         'SAG-AFTRA Moderate Low Budget', ['Director Agent'], 'Odyssey_Treatment.fdx', '', 'development'),
        ('p3', 'demo', 'Solaris Protocol', 'TV Pilot', 'Mystery Thriller', 25000, 5,
         'DGA Low Budget Agreement', ['Director Agent'], 'Solaris_Pilot.pdf', '', 'active')
    """,
    f"""INSERT INTO {CH_DB}.scenes
        (project_id, scene_id, scene_number, int_ext, location, time_of_day,
         page_count, shoot_day, status, description, scene_text) VALUES
        ('p1',101,'SC-001','EXT','Rooftop Overlook','NIGHT',1.5,1,'scheduled','Marcus overlooks city skyline in heavy rain. Establish tone.',''),
        ('p1',102,'SC-002','INT','Underground Jazz Club','NIGHT',2.0,1,'scheduled','Elena sings at the piano. Marcus watches from corner booth.',''),
        ('p1',103,'SC-003','EXT','Rainy Alleyway','NIGHT',1.0,1,'vfx_required','High speed foot chase through wet neon alley with lightning.',''),
        ('p1',104,'SC-004','INT','Marcus Apartment','DAY',2.5,2,'scheduled','Confrontation over stolen drive. Tension mounts.',''),
        ('p1',105,'SC-005','INT','Police Interrogation Room','DAY',3.0,2,'scheduled','Detective Cross interrogates Marcus. Psychological battle.',''),
        ('p1',106,'SC-006','EXT','Harbor Docks','DAWN',1.8,2,'scheduled','Drop-off meeting at foggy docks. Gunfire erupts.',''),
        ('p1',107,'SC-007','INT','Abandoned Warehouse','NIGHT',2.2,3,'vfx_required','Final showdown with Victor. Fire and explosions.',''),
        ('p1',108,'SC-008','INT','Hospital Room','DAY',1.2,3,'scheduled','Aftermath. Marcus wakes up, Elena by bedside.',''),
        ('p1',109,'SC-009','EXT','City Bridge','DAWN',0.8,3,'scheduled','Final shot — walking into sunrise over the bay.','')
    """,
    f"""INSERT INTO {CH_DB}.cast_members
        (project_id, cast_id, character_name, actor_name, role_type, day_rate_usd, total_days) VALUES
        ('p1',1,'Marcus Vance','James Harrow','Lead',4500.0,30),
        ('p1',2,'Elena Rostova','Sofia Delacroix','Lead',3400.0,28),
        ('p1',3,'Detective Cross','Marcus Sterling','Supporting',2200.0,15),
        ('p1',4,'Victor Kroll','Anton Varga','Supporting',2800.0,12),
        ('p1',5,'Dr. Aris','Helen Mirrenkov','Day Player',1200.0,3)
    """,
    f"""INSERT INTO {CH_DB}.scene_cast (project_id, scene_id, cast_id) VALUES
        ('p1',101,1),('p1',102,1),('p1',102,2),('p1',103,1),('p1',103,4),
        ('p1',104,1),('p1',104,2),('p1',105,1),('p1',105,3),('p1',106,1),
        ('p1',106,2),('p1',106,4),('p1',107,1),('p1',107,2),('p1',107,4),
        ('p1',108,1),('p1',108,2),('p1',108,5),('p1',109,1)
    """,
    f"""INSERT INTO {CH_DB}.budget_items
        (project_id, item_id, category, sub_category, description, budgeted_usd, actual_usd, vendor) VALUES
        ('p1',1,'Above-the-Line','Cast','James Harrow — Lead Actor',135000.0,135000.0,'Talent Agency X'),
        ('p1',2,'Above-the-Line','Cast','Sofia Delacroix — Lead Actress',95200.0,95200.0,'Talent Agency Y'),
        ('p1',3,'Above-the-Line','Cast','Supporting Cast Package',40000.0,38500.0,'Casting Director Inc'),
        ('p1',4,'Above-the-Line','Director','David Mirrenkov — Director Fee',200000.0,200000.0,'Director Guild'),
        ('p1',5,'Above-the-Line','Writer','Original Screenplay Rights',45000.0,45000.0,'WGA Member'),
        ('p1',6,'Production','Camera','Arri Package — 3 week rental',28000.0,31200.0,'Panavision NY'),
        ('p1',7,'Production','Camera','ARRI Alexa 35 — 3 camera pkg',42000.0,42000.0,'Otto Nemenz'),
        ('p1',8,'Production','Location','Jazz Club Practical Location',15000.0,16800.0,'Blue Note Club'),
        ('p1',9,'Production','Location','Rooftop + Warehouse + Bridge',22000.0,22000.0,'City Film Commission'),
        ('p1',10,'Production','Special Effects','Rain machine + water tankers',8500.0,11200.0,'FX Unlimited'),
        ('p1',11,'Production','Special Effects','Fog machines — Harbor + Alley',3200.0,3200.0,'FX Unlimited'),
        ('p1',12,'VFX','CGI','Lightning VFX — SC-003',25000.0,24500.0,'Pixomondo'),
        ('p1',13,'VFX','CGI','Fire & Explosion — SC-007',38000.0,38000.0,'Framestore'),
        ('p1',14,'Post','Editorial','Avid Suite — 6 weeks',18000.0,18000.0,'PostWorks NY'),
        ('p1',15,'Post','Music','Original Jazz Score',35000.0,33000.0,'Abbey Road'),
        ('p1',16,'Post','Sound','Dolby Atmos Mix — 2 weeks',12000.0,12000.0,'Soundfirm'),
        ('p1',17,'Production','Catering','On-set catering — 25 shoot days',9500.0,9800.0,'Hollywood Catering'),
        ('p1',18,'Production','Transport','Cast & Crew transport package',11000.0,10500.0,'Star Fleet'),
        ('p1',19,'Marketing','Trailer','Teaser + full trailer cut',20000.0,18000.0,'Trailer Park'),
        ('p1',20,'Production','Contingency','10% Production Contingency',43920.0,31000.0,'Production Bank')
    """,
    f"""INSERT INTO {CH_DB}.elements
        (project_id, element_id, scene_id, element_type, name, cost_usd, vendor, status) VALUES
        ('p1',1,101,'vfx','City Skyline Extension',15000.0,'Industrial Light & Magic','planned'),
        ('p1',2,103,'sfx','Rain Machine Unit',8500.0,'FX Unlimited','approved'),
        ('p1',3,107,'stunt','Pyrotechnic Fire Rig',22000.0,'Action Stunts Co','planned')
    """,
    f"""INSERT INTO {CH_DB}.shots
        (project_id, shot_id, scene_id, shot_code, lens_mm, movement, framing, description, status) VALUES
        ('p1',1,101,'SC-001-A',85,'Static','WS','Rooftop wide — city below, Marcus silhouette','planned'),
        ('p1',2,101,'SC-001-B',50,'Dolly In','MS','Slow push in on Marcus face — rain hits frame','planned'),
        ('p1',3,101,'SC-001-C',135,'Handheld','CU','Extreme close on eyes — neon light reflection','planned'),
        ('p1',4,102,'SC-002-A',35,'Crane','WS','Crane off stage height down to crowd level','setup'),
        ('p1',5,102,'SC-002-B',85,'Static','OTS','Over Elena shoulder to audience','planned'),
        ('p1',6,103,'SC-003-A',24,'Handheld','MS','Chase — handheld run through alley with rain','planned'),
        ('p1',7,103,'SC-003-B',18,'Steadicam','WS','Steadicam pursuit shot — wide alley with lightning','planned'),
        ('p1',8,107,'SC-007-A',50,'Static','WS','Warehouse wide — fire BG, confrontation FG','planned'),
        ('p1',9,107,'SC-007-B',135,'Handheld','CU','Tight on hands — gun drawn close-up','planned'),
        ('p1',10,109,'SC-009-A',21,'Drone','WS','Aerial drone — Marcus walks bridge at sunrise','planned')
    """,
]


def main() -> int:
    if not ch_ping():
        print("❌ ClickHouse unreachable — check CLICKHOUSE_* in .env")
        return 1

    print(f"Target: {CH_DB}")
    print(f"Will DROP and recreate: {', '.join(DEMO_TABLES)}")
    print("Will leave alone: users, storyboards, governance_gates, agent_audit_log")

    if "--yes" not in sys.argv:
        if input("\nType 'migrate' to proceed: ").strip() != "migrate":
            print("Aborted.")
            return 1

    for table in DEMO_TABLES:
        ch_query(f"DROP TABLE IF EXISTS {CH_DB}.{table}")
        print(f"  dropped {table}")

    for stmt in DDL:
        ch_query(stmt)
    print(f"  created {len(DDL)} tables")

    for stmt in SEED:
        ch_query(stmt)
    print(f"  seeded {len(SEED)} tables (project p1)")

    # storyboards: swap engine in place, keeping existing frames.
    engine = ch_query(
        f"SELECT engine FROM system.tables WHERE database = '{CH_DB}' AND name = 'storyboards'"
    ).get("data", [])
    if engine and "Replacing" not in str(engine[0][0]):
        ch_query(STORYBOARDS_DDL.format(db=CH_DB))
        ch_query(f"INSERT INTO {CH_DB}.storyboards_v2 SELECT * FROM {CH_DB}.storyboards")
        # Shared (Cloud) databases reject multi-table RENAME, so do it one at a time.
        ch_query(f"RENAME TABLE {CH_DB}.storyboards TO {CH_DB}.storyboards_old")
        ch_query(f"RENAME TABLE {CH_DB}.storyboards_v2 TO {CH_DB}.storyboards")
        ch_query(f"DROP TABLE IF EXISTS {CH_DB}.storyboards_old")
        print("  storyboards -> ReplacingMergeTree (frames preserved)")
    else:
        print("  storyboards already ReplacingMergeTree")

    rows = ch_query(
        f"SELECT name FROM system.tables WHERE database = '{CH_DB}' ORDER BY name"
    ).get("data", [])
    print(f"\n✅ Migration complete. {len(rows)} tables: {', '.join(r[0] for r in rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
