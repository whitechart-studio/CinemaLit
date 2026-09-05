import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from web.db import ch_query

ch_query('''
CREATE TABLE IF NOT EXISTS cinemalit.storyboards (
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
ORDER BY (project_id, scene_num, frame_num)
''')
print("Table created.")
