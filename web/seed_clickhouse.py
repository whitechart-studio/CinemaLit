#!/usr/bin/env python3
"""
Seed the ClickHouse cinemalit database with film production data.
Run once after starting the Docker container.
"""
import urllib.request
import urllib.parse
import base64
import sys

CH_HOST = "localhost"
CH_PORT = 8123
CH_USER = "cinemalit"
CH_PASS = "cinemagic2026"
CH_DB   = "cinemalit"

def execute(sql: str, label: str = ""):
    params = urllib.parse.urlencode({"database": CH_DB})
    url = f"http://{CH_HOST}:{CH_PORT}/?{params}"
    creds = base64.b64encode(f"{CH_USER}:{CH_PASS}".encode()).decode()
    req = urllib.request.Request(url, data=sql.encode("utf-8"), headers={
        "Authorization": f"Basic {creds}",
        "Content-Type": "text/plain",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode()
            print(f"  ✅ {label or 'OK'}")
            return body
    except urllib.request.HTTPError as e:
        err = e.read().decode()
        print(f"  ❌ {label}: {err[:200]}")
        sys.exit(1)

print("\n🎬 CinemaLit ClickHouse DB Seeder")
print("=" * 45)

# ── Create tables ──────────────────────────────────────────────────────────
print("\n[1/3] Creating tables...")

execute("""
CREATE TABLE IF NOT EXISTS cinemalit.scenes (
    scene_id     UInt32,
    scene_number String,
    int_ext      LowCardinality(String),
    location     String,
    time_of_day  LowCardinality(String),
    page_count   Float32,
    shoot_day    UInt8,
    status       LowCardinality(String),
    description  String,
    PRIMARY KEY (scene_id)
) ENGINE = MergeTree() ORDER BY scene_id
""", "scenes table")

execute("""
CREATE TABLE IF NOT EXISTS cinemalit.cast_members (
    cast_id        UInt32,
    character_name String,
    actor_name     String,
    role_type      LowCardinality(String),
    day_rate_usd   Float64,
    total_days     UInt16,
    PRIMARY KEY (cast_id)
) ENGINE = MergeTree() ORDER BY cast_id
""", "cast_members table")

execute("""
CREATE TABLE IF NOT EXISTS cinemalit.scene_cast (
    scene_id UInt32,
    cast_id  UInt32,
    status   LowCardinality(String)
) ENGINE = MergeTree() ORDER BY (scene_id, cast_id)
""", "scene_cast table")

execute("""
CREATE TABLE IF NOT EXISTS cinemalit.budget_items (
    item_id      UInt32,
    category     LowCardinality(String),
    sub_category String,
    description  String,
    budgeted_usd Float64,
    actual_usd   Float64,
    vendor       String,
    PRIMARY KEY (item_id)
) ENGINE = MergeTree() ORDER BY item_id
""", "budget_items table")

execute("""
CREATE TABLE IF NOT EXISTS cinemalit.elements (
    element_id   UInt32,
    element_type LowCardinality(String),
    name         String,
    description  String,
    scene_ids    Array(UInt32),
    cost_usd     Float64,
    vendor       String,
    status       LowCardinality(String),
    PRIMARY KEY (element_id)
) ENGINE = MergeTree() ORDER BY element_id
""", "elements table")

execute("""
CREATE TABLE IF NOT EXISTS cinemalit.shots (
    shot_id     UInt32,
    scene_id    UInt32,
    shot_code   String,
    lens_mm     UInt16,
    movement    String,
    framing     LowCardinality(String),
    description String,
    status      LowCardinality(String),
    PRIMARY KEY (shot_id)
) ENGINE = MergeTree() ORDER BY shot_id
""", "shots table")

# ── Insert data ────────────────────────────────────────────────────────────
print("\n[2/3] Seeding data...")

execute("""
INSERT INTO cinemalit.scenes VALUES
(1,'SC-001','EXT','Rooftop - Noir City','NIGHT',1.5,1,'locked','Marcus stands at the edge, rain pouring, neon signs reflected below'),
(2,'SC-002','INT','Jazz Club - Backstage','NIGHT',2.0,1,'locked','Elena performs, crowd mesmerised, Marcus watches from shadows'),
(3,'SC-003','EXT','City Alley - Rain Machine','NIGHT',1.0,2,'vfx_required','Chase sequence — rain machine + VFX lightning required'),
(4,'SC-004','INT','Marcus Apartment - Living Room','DAY',0.75,2,'locked','Marcus finds envelope under door, opens — blank except for lipstick mark'),
(5,'SC-005','EXT','Harbor - Fog Machine','DAWN',1.25,3,'scheduled','Elena disappears into fog, boat engine distant'),
(6,'SC-006','INT','Police Precinct - Interview','DAY',1.5,3,'locked','Detective Cole interviews Marcus under hard light'),
(7,'SC-007','EXT','Abandoned Warehouse - District','NIGHT',2.0,4,'vfx_required','Climax confrontation — pyrotechnics + VFX fire'),
(8,'SC-008','INT','Jazz Club - Stage','NIGHT',1.0,4,'locked','Final performance — Elena plays as truth is revealed'),
(9,'SC-009','EXT','City Bridge - Sunrise','DAWN',0.5,5,'scheduled','Denouement — Marcus walks alone across the bridge'),
(10,'SC-010','INT','Marcus Apartment - Bedroom','DAY',0.75,5,'scheduled','Epilogue — letter on the table, rain outside')
""", "scenes data")

execute("""
INSERT INTO cinemalit.cast_members VALUES
(1,'Marcus Vane','James Harrow','lead',7500.0,18),
(2,'Elena Sinclair','Sofia Delacroix','lead',6800.0,14),
(3,'Det. Cole','Raymond Okafor','supporting',3200.0,8),
(4,'Club Owner','Petra Vasquez','supporting',2400.0,4),
(5,'The Shadow','Unknown','supporting',1800.0,3),
(6,'Bartender','Jay Lindstrom','day_player',850.0,2),
(7,'Lookout','Kai Murakami','day_player',850.0,1)
""", "cast_members data")

execute("""
INSERT INTO cinemalit.scene_cast VALUES
(1,1,'W'),(1,2,'SW'),(1,5,'W'),
(2,2,'W'),(2,4,'W'),(2,6,'W'),
(3,1,'W'),(3,5,'W'),(3,7,'W'),
(4,1,'W'),
(5,2,'WF'),
(6,1,'W'),(6,3,'W'),
(7,1,'W'),(7,2,'W'),(7,3,'W'),(7,5,'W'),
(8,2,'W'),(8,4,'W'),(8,6,'W'),
(9,1,'WF'),
(10,1,'WF')
""", "scene_cast data")

execute("""
INSERT INTO cinemalit.budget_items VALUES
(1,'Above-the-Line','Cast','James Harrow — Lead Actor',135000,135000,'CAA'),
(2,'Above-the-Line','Cast','Sofia Delacroix — Lead Actress',95200,95200,'WME'),
(3,'Above-the-Line','Cast','Supporting Cast Package',40000,38500,'Various'),
(4,'Above-the-Line','Director','David Mirrenkov — Director Fee',200000,200000,'UTA'),
(5,'Above-the-Line','Writer','Original Screenplay Rights',45000,45000,'Self'),
(6,'Production','Lighting','Arri Package — 3 week rental',28000,31200,'BrightLine Rentals'),
(7,'Production','Camera','ARRI Alexa 35 — 3 camera pkg',42000,42000,'Panavision'),
(8,'Production','Locations','Jazz Club Practical Location',15000,16800,'Location Works'),
(9,'Production','Locations','Rooftop + Warehouse + Bridge',22000,22000,'Location Works'),
(10,'Production','Rain FX','Rain machine + water tankers',8500,11200,'FX Unlimited'),
(11,'Production','Fog FX','Fog machines — Harbor + Alley',3200,3200,'FX Unlimited'),
(12,'VFX','Compositing','Lightning VFX — SC-003',25000,24500,'PixelRift VFX'),
(13,'VFX','Pyrotechnics','Fire & Explosion — SC-007',38000,38000,'BlastLogic'),
(14,'Post','Edit','Avid Suite — 6 weeks',18000,18000,'PostHouse LA'),
(15,'Post','Score','Original Jazz Score',35000,33000,'Miles & Associates'),
(16,'Post','Mix','Dolby Atmos Mix — 2 weeks',12000,12000,'SoundWave Studios'),
(17,'Production','Catering','On-set catering — 25 shoot days',9500,9800,'Set Eats'),
(18,'Production','Transport','Cast & Crew transport package',11000,10500,'CineFleet'),
(19,'Marketing','Trailer','Teaser + full trailer cut',20000,18000,'Buzz Creative'),
(20,'Production','Contingency','10% Production Contingency',43920,31000,'N/A')
""", "budget_items data")

execute("""
INSERT INTO cinemalit.elements VALUES
(1,'prop','Leather Trench Coat','Marcus signature coat',[1,3,4,6,7],2800.0,'Prop House LA','confirmed'),
(2,'prop','Blank Envelope','Mystery envelope SC-004',[4],45.0,'In-house','confirmed'),
(3,'prop','Jazz Trumpet','Elena performance instrument',[2,8],3200.0,'Music Props Inc','confirmed'),
(4,'wardrobe','Elena Stage Dress','1940s noir style gown',[2,5,7,8],4500.0,'Costume Design LA','confirmed'),
(5,'wardrobe','Detective Cole Badge','LAPD period badge + holster',[6],380.0,'Props & More','booked'),
(6,'vfx','Lightning Compositing','CG lightning SC-003',[3],25000.0,'PixelRift VFX','confirmed'),
(7,'sfx','Rain Machine Rig','Full rain machine + tanker',[3],8500.0,'FX Unlimited','booked'),
(8,'sfx','Fog Machine Banks','Harbor + Alley fog systems',[3,5],3200.0,'FX Unlimited','confirmed'),
(9,'vfx','Fire & Pyro — SC-007','Practical + digital fire',[7],38000.0,'BlastLogic','confirmed'),
(10,'vehicle','Period Police Car','1940s Ford police cruiser',[3,6],6500.0,'Classic Cars LA','planned')
""", "elements data")

execute("""
INSERT INTO cinemalit.shots VALUES
(1,1,'SC-001-A',85,'Static','WS','Rooftop wide — city below, Marcus silhouette','complete'),
(2,1,'SC-001-B',50,'Dolly In','MS','Slow push in on Marcus face — rain hits frame','complete'),
(3,1,'SC-001-C',135,'Handheld','CU','Extreme close on eyes — neon light reflection','complete'),
(4,2,'SC-002-A',35,'Crane','WS','Crane off stage height down to crowd level','setup'),
(5,2,'SC-002-B',85,'Static','OTS','Over Elena shoulder to audience','planned'),
(6,3,'SC-003-A',24,'Handheld','MS','Chase — handheld run through alley with rain','planned'),
(7,3,'SC-003-B',18,'Steadicam','WS','Steadicam pursuit shot — wide alley with lightning','planned'),
(8,7,'SC-007-A',50,'Static','WS','Warehouse wide — fire BG, confrontation FG','planned'),
(9,7,'SC-007-B',135,'Handheld','CU','Tight on hands — gun drawn close-up','planned'),
(10,9,'SC-009-A',21,'Drone','WS','Aerial drone — Marcus walks bridge at sunrise','planned')
""", "shots data")

# ── Verify ─────────────────────────────────────────────────────────────────
print("\n[3/3] Verifying data...")

for table in ["scenes", "cast_members", "budget_items", "elements", "shots"]:
    result = execute(f"SELECT count() FROM cinemalit.{table}", f"  {table}")

print("\n✅ ClickHouse database seeded successfully!")
print(f"   → Host: localhost:8123  DB: cinemalit  User: cinemalit")
print(f"   → Try: curl -u cinemalit:cinemagic2026 'http://localhost:8123/?database=cinemalit' --data 'SELECT * FROM scenes LIMIT 3'")
print()
