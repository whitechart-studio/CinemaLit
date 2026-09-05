-- CinemaLit Studio: ClickHouse Memory Schema & Initial Seed Data

CREATE DATABASE IF NOT EXISTS cinemalit;

USE cinemalit;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id       String,
    email         String,
    password_hash String,
    name          String,
    role          String,
    avatar_url    String,
    created_at    DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY email;

-- 2. Scenes Table
CREATE TABLE IF NOT EXISTS scenes (
    scene_id     UInt32,
    scene_number String,
    int_ext      LowCardinality(String),
    location     String,
    time_of_day  LowCardinality(String),
    page_count   Float32,
    shoot_day    UInt8,
    status       LowCardinality(String),
    description  String
) ENGINE = MergeTree()
PRIMARY KEY scene_id
ORDER BY scene_id;

-- 3. Cast Members Table
CREATE TABLE IF NOT EXISTS cast_members (
    cast_id        UInt32,
    character_name String,
    actor_name     String,
    role_type      LowCardinality(String),
    day_rate_usd   Float64,
    total_days     UInt8
) ENGINE = MergeTree()
PRIMARY KEY cast_id
ORDER BY cast_id;

-- 4. Scene Cast Mapping Table
CREATE TABLE IF NOT EXISTS scene_cast (
    scene_id UInt32,
    cast_id  UInt32
) ENGINE = MergeTree()
ORDER BY (scene_id, cast_id);

-- 5. Budget Items Table
CREATE TABLE IF NOT EXISTS budget_items (
    item_id       UInt32,
    category      LowCardinality(String),
    sub_category  String,
    description   String,
    budgeted_usd  Float64,
    actual_usd    Float64,
    vendor        String
) ENGINE = MergeTree()
PRIMARY KEY item_id
ORDER BY item_id;

-- 6. Elements Table
CREATE TABLE IF NOT EXISTS elements (
    element_id   UInt32,
    scene_id     UInt32,
    element_type LowCardinality(String),
    name         String,
    cost_usd     Float64,
    vendor       String,
    status       LowCardinality(String)
) ENGINE = MergeTree()
PRIMARY KEY element_id
ORDER BY element_id;

-- 7. Shots Table
CREATE TABLE IF NOT EXISTS shots (
    shot_id     UInt32,
    scene_id    UInt32,
    shot_code   String,
    lens_mm     UInt16,
    movement    String,
    framing     LowCardinality(String),
    description String,
    status      LowCardinality(String)
) ENGINE = MergeTree()
PRIMARY KEY shot_id
ORDER BY shot_id;

-- 8. Storyboards Table
CREATE TABLE IF NOT EXISTS storyboards (
    project_id String,
    scene_num String,
    frame_num UInt8,
    title String,
    camera_spec String,
    start_sec Int32,
    end_sec Int32,
    prompt String,
    img_url String,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (project_id, scene_num, frame_num);

-- ─── SEED DATA ─────────────────────────────────────────────────────────────

INSERT INTO scenes VALUES
(101, 'SC-001', 'EXT', 'Rooftop Overlook', 'NIGHT', 1.5, 1, 'scheduled', 'Marcus overlooks city skyline in heavy rain. Establish tone.'),
(102, 'SC-002', 'INT', 'Underground Jazz Club', 'NIGHT', 2.0, 1, 'scheduled', 'Elena sings at the piano. Marcus watches from corner booth.'),
(103, 'SC-003', 'EXT', 'Rainy Alleyway', 'NIGHT', 1.0, 1, 'vfx_required', 'High speed foot chase through wet neon alley with lightning.'),
(104, 'SC-004', 'INT', 'Marcus Apartment', 'DAY', 2.5, 2, 'scheduled', 'Confrontation over stolen drive. Tension mounts.'),
(105, 'SC-005', 'INT', 'Police Interrogation Room', 'DAY', 3.0, 2, 'scheduled', 'Detective Cross interrogates Marcus. Psychological battle.'),
(106, 'SC-006', 'EXT', 'Harbor Docks', 'DAWN', 1.8, 2, 'scheduled', 'Drop-off meeting at foggy docks. Gunfire erupts.'),
(107, 'SC-007', 'INT', 'Abandoned Warehouse', 'NIGHT', 2.2, 3, 'vfx_required', 'Final showdown with Victor. Fire and explosions.'),
(108, 'SC-008', 'INT', 'Hospital Room', 'DAY', 1.2, 3, 'scheduled', 'Aftermath. Marcus wakes up, Elena by bedside.'),
(109, 'SC-009', 'EXT', 'City Bridge', 'DAWN', 0.8, 3, 'scheduled', 'Final shot — walking into sunrise over the bay.');

INSERT INTO cast_members VALUES
(1, 'Marcus Vance', 'James Harrow', 'Lead', 4500.0, 30),
(2, 'Elena Rostova', 'Sofia Delacroix', 'Lead', 3400.0, 28),
(3, 'Detective Cross', 'Marcus Sterling', 'Supporting', 2200.0, 15),
(4, 'Victor Kroll', 'Anton Varga', 'Supporting', 2800.0, 12),
(5, 'Dr. Aris', 'Helen Mirrenkov', 'Day Player', 1200.0, 3);

INSERT INTO scene_cast VALUES
(101, 1), (102, 1), (102, 2), (103, 1), (103, 4),
(104, 1), (104, 2), (105, 1), (105, 3), (106, 1),
(106, 2), (106, 4), (107, 1), (107, 2), (107, 4),
(108, 1), (108, 2), (108, 5), (109, 1);

INSERT INTO budget_items VALUES
(1, 'Above-the-Line', 'Cast', 'James Harrow — Lead Actor', 135000.0, 135000.0, 'Talent Agency X'),
(2, 'Above-the-Line', 'Cast', 'Sofia Delacroix — Lead Actress', 95200.0, 95200.0, 'Talent Agency Y'),
(3, 'Above-the-Line', 'Cast', 'Supporting Cast Package', 40000.0, 38500.0, 'Casting Director Inc'),
(4, 'Above-the-Line', 'Director', 'David Mirrenkov — Director Fee', 200000.0, 200000.0, 'Director Guild'),
(5, 'Above-the-Line', 'Writer', 'Original Screenplay Rights', 45000.0, 45000.0, 'WGA Member'),
(6, 'Production', 'Camera', 'Arri Package — 3 week rental', 28000.0, 31200.0, 'Panavision NY'),
(7, 'Production', 'Camera', 'ARRI Alexa 35 — 3 camera pkg', 42000.0, 42000.0, 'Otto Nemenz'),
(8, 'Production', 'Location', 'Jazz Club Practical Location', 15000.0, 16800.0, 'Blue Note Club'),
(9, 'Production', 'Location', 'Rooftop + Warehouse + Bridge', 22000.0, 22000.0, 'City Film Commission'),
(10, 'Production', 'Special Effects', 'Rain machine + water tankers', 8500.0, 11200.0, 'FX Unlimited'),
(11, 'Production', 'Special Effects', 'Fog machines — Harbor + Alley', 3200.0, 3200.0, 'FX Unlimited'),
(12, 'VFX', 'CGI', 'Lightning VFX — SC-003', 25000.0, 24500.0, 'Pixomondo'),
(13, 'VFX', 'CGI', 'Fire & Explosion — SC-007', 38000.0, 38000.0, 'Framestore'),
(14, 'Post', 'Editorial', 'Avid Suite — 6 weeks', 18000.0, 18000.0, 'PostWorks NY'),
(15, 'Post', 'Music', 'Original Jazz Score', 35000.0, 33000.0, 'Abbey Road'),
(16, 'Post', 'Sound', 'Dolby Atmos Mix — 2 weeks', 12000.0, 12000.0, 'Soundfirm'),
(17, 'Production', 'Catering', 'On-set catering — 25 shoot days', 9500.0, 9800.0, 'Hollywood Catering'),
(18, 'Production', 'Transport', 'Cast & Crew transport package', 11000.0, 10500.0, 'Star Fleet'),
(19, 'Marketing', 'Trailer', 'Teaser + full trailer cut', 20000.0, 18000.0, 'Trailer Park'),
(20, 'Production', 'Contingency', '10% Production Contingency', 43920.0, 31000.0, 'Production Bank');

INSERT INTO elements VALUES
(1, 101, 'vfx', 'City Skyline Extension', 15000.0, 'Industrial Light & Magic', 'planned'),
(2, 103, 'sfx', 'Rain Machine Unit', 8500.0, 'FX Unlimited', 'approved'),
(3, 107, 'stunt', 'Pyrotechnic Fire Rig', 22000.0, 'Action Stunts Co', 'planned');

INSERT INTO shots VALUES
(1, 101, 'SC-001-A', 85, 'Static', 'WS', 'Rooftop wide — city below, Marcus silhouette', 'planned'),
(2, 101, 'SC-001-B', 50, 'Dolly In', 'MS', 'Slow push in on Marcus face — rain hits frame', 'planned'),
(3, 101, 'SC-001-C', 135, 'Handheld', 'CU', 'Extreme close on eyes — neon light reflection', 'planned'),
(4, 102, 'SC-002-A', 35, 'Crane', 'WS', 'Crane off stage height down to crowd level', 'setup'),
(5, 102, 'SC-002-B', 85, 'Static', 'OTS', 'Over Elena shoulder to audience', 'planned'),
(6, 103, 'SC-003-A', 24, 'Handheld', 'MS', 'Chase — handheld run through alley with rain', 'planned'),
(7, 103, 'SC-003-B', 18, 'Steadicam', 'WS', 'Steadicam pursuit shot — wide alley with lightning', 'planned'),
(8, 107, 'SC-007-A', 50, 'Static', 'WS', 'Warehouse wide — fire BG, confrontation FG', 'planned'),
(9, 107, 'SC-007-B', 135, 'Handheld', 'CU', 'Tight on hands — gun drawn close-up', 'planned'),
(10, 109, 'SC-009-A', 21, 'Drone', 'WS', 'Aerial drone — Marcus walks bridge at sunrise', 'planned');
