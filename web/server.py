"""
Local Web Dashboard Server & Gemini AI + ClickHouse Endpoints for CinemaLit Studio.
Serves the React + TS Studio UI on http://localhost:8000 and provides live Gemini API
and ClickHouse Cloud query proxy endpoints.
"""

import http.server
import socketserver
import os
import sys
import json
import re
import uuid
import time
import urllib.error

# Ensure root package import
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv(os.path.expanduser("~/.env"))

from web.auth import (
    create_jwt,
    hash_password,
    utc_now,
    verify_google_id_token,
    verify_jwt,
    verify_password,
)
from web.db import CH_DB, CH_HOST, CH_PORT, ch_escape, ch_ping, ch_query

PORT = int(os.getenv("CINEMALIT_WEB_PORT", "8000"))
WEB_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "cinemalit-studio", "dist")
)

PUBLIC_API_PATHS = {
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/google",
    "/api/status",
    "/api/clickhouse/ping",
}

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
ALLOW_DEV_GOOGLE_AUTH = os.getenv("ALLOW_DEV_GOOGLE_AUTH", "").lower() in ("1", "true", "yes")
genai_client = None

if GOOGLE_API_KEY:
    try:
        from google import genai
        genai_client = genai.Client(api_key=GOOGLE_API_KEY)
        print(f"✅ Google Gemini API initialized via google.genai Client: {GEMINI_MODEL}")
    except Exception as exc:
        print(f"⚠️  Gemini API init error: {exc}")
else:
    print("⚠️  GOOGLE_API_KEY / GEMINI_API_KEY not found in environment.")


def ensure_users_table() -> None:
    """Create users table if missing (safe on every startup)."""
    if not ch_ping():
        return
    try:
        ch_query(
            f"""
            CREATE TABLE IF NOT EXISTS {CH_DB}.users (
                user_id       String,
                email         String,
                password_hash String,
                name          String,
                role          String,
                avatar_url    String,
                created_at    DateTime DEFAULT now()
            ) ENGINE = MergeTree()
            ORDER BY email
            """
        )
    except Exception as exc:
        print(f"⚠️  Could not ensure users table: {exc}")


def json_resp(handler, data: dict, status: int = 200):
    payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    handler.end_headers()
    handler.wfile.write(payload)

# --- AGENT TOOLS ---
def query_production_db(sql_query: str) -> dict:
    """Executes a READ-ONLY SELECT query against the ClickHouse production database to retrieve raw data."""
    if not sql_query.strip().upper().startswith("SELECT"):
        return {"error": "Only SELECT queries are allowed via this tool."}
    try:
        res = ch_query(sql_query)
        return {"data": res.get("data", [])[:20]} # limit to 20 rows
    except Exception as e:
        return {"error": str(e)}

def get_scene_details(scene_number: str) -> dict:
    """Retrieves all details for a specific scene, including cast members, elements, and shots."""
    try:
        scene = ch_query(f"SELECT scene_id, int_ext, location, time_of_day, description, status FROM {CH_DB}.scenes WHERE scene_number = {{sn:String}}", {"sn": scene_number}).get("data", [])
        if not scene:
            return {"error": f"Scene {scene_number} not found."}
        s_id = scene[0][0]
        elements = ch_query(f"SELECT element_type, name, cost_usd, vendor, status FROM {CH_DB}.elements WHERE scene_id = {{s_id:UInt32}}", {"s_id": s_id}).get("data", [])
        cast = ch_query(f"SELECT c.character_name, c.actor_name, c.day_rate_usd FROM {CH_DB}.scene_cast sc JOIN {CH_DB}.cast_members c ON sc.cast_id = c.cast_id WHERE sc.scene_id = {{s_id:UInt32}}", {"s_id": s_id}).get("data", [])
        shots = ch_query(f"SELECT shot_code, framing, description FROM {CH_DB}.shots WHERE scene_id = {{s_id:UInt32}}", {"s_id": s_id}).get("data", [])
        return {
            "scene_number": scene_number,
            "scene_info": scene[0],
            "cast": cast,
            "elements": elements,
            "shots": shots
        }
    except Exception as e:
        return {"error": str(e)}

def add_scene_element(scene_number: str, element_type: str, name: str, cost_usd: float, vendor: str) -> dict:
    """Proactively adds a new breakdown element (e.g. vfx, sfx, prop, stunt, cast) to a scene in the database."""
    try:
        scene = ch_query(f"SELECT scene_id FROM {CH_DB}.scenes WHERE scene_number = {{sn:String}}", {"sn": scene_number}).get("data", [])
        if not scene:
            return {"error": f"Scene {scene_number} not found."}
        s_id = scene[0][0]
        max_id = ch_query(f"SELECT MAX(element_id) FROM {CH_DB}.elements").get("data", [[0]])[0][0]
        new_id = int(max_id) + 1 if max_id else 1
        
        ch_query(f"""
            INSERT INTO {CH_DB}.elements (element_id, scene_id, element_type, name, cost_usd, vendor, status)
            VALUES ({{e_id:UInt32}}, {{s_id:UInt32}}, {{type:String}}, {{name:String}}, {{cost:Float64}}, {{vendor:String}}, 'planned')
        """, {"e_id": new_id, "s_id": s_id, "type": element_type, "name": name, "cost": cost_usd, "vendor": vendor})
        return {"status": "success", "message": f"Added {name} ({element_type}) to {scene_number} for ${cost_usd}"}
    except Exception as e:
        return {"error": str(e)}

AGENT_TOOLS = [query_production_db, get_scene_details, add_scene_element]


class StudioRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def log_message(self, format, *args):
        try:
            super().log_message(format, *args)
        except Exception:
            pass

    def _path(self) -> str:
        return self.path.split("?", 1)[0]

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            return json.loads(body.decode("utf-8"))
        except Exception:
            return {}

    def _bearer_token(self) -> str:
        auth_hdr = self.headers.get("Authorization", "")
        if auth_hdr.startswith("Bearer "):
            return auth_hdr[7:].strip()
        return ""

    def _require_auth(self):
        """Return JWT payload, {} for public routes, or None if unauthorized."""
        path = self._path()
        if not path.startswith("/api/") or path in PUBLIC_API_PATHS:
            return {}
        user = verify_jwt(self._bearer_token())
        if not user:
            json_resp(self, {"status": "error", "error": "Unauthorized — sign in required"}, 401)
            return None
        return user

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_POST(self):
        if self._require_auth() is None:
            return
        path = self._path()

        if path == "/api/auth/register":
            self._handle_register()
        elif path == "/api/auth/login":
            self._handle_login()
        elif path == "/api/auth/google":
            self._handle_google()
        elif path == "/api/ai/chat":
            self._handle_ai_chat()
        elif path == "/api/ai/analyze-script":
            self._handle_analyze_script()
        elif path == "/api/clickhouse/query":
            self._handle_ch_query()
        elif path == "/api/ai/ask-data":
            self._handle_ask_data()
        elif path == "/api/ai/sync-script-to-db":
            self._handle_sync_script()
        elif path == "/api/ai/dga-check":
            self._handle_dga_check()
        elif path == "/api/ai/generate-storyboard":
            self._handle_generate_storyboard()
        else:
            self.send_error(404, "Endpoint not found")

    def do_GET(self):
        path = self._path()
        
        # Intercept dynamic storyboard images and serve them directly from disk
        if path.startswith("/storyboards/"):
            # Maps /storyboards/scene_01/frame.jpg -> ../storyboards/scene_01/frame.jpg
            local_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", path.lstrip("/")))
            if os.path.exists(local_path) and os.path.isfile(local_path):
                self.send_response(200)
                if local_path.lower().endswith(".jpg") or local_path.lower().endswith(".jpeg"):
                    self.send_header("Content-Type", "image/jpeg")
                elif local_path.lower().endswith(".png"):
                    self.send_header("Content-Type", "image/png")
                self.end_headers()
                with open(local_path, "rb") as f:
                    self.wfile.write(f.read())
                return
            else:
                self.send_error(404, "Storyboard image not found")
                return

        if path.startswith("/api/") and path not in PUBLIC_API_PATHS:
            if self._require_auth() is None:
                return

        if path == "/api/auth/me":
            self._handle_auth_me()
        elif path == "/api/status":
            self._handle_status()
        elif path == "/api/clickhouse/ping":
            self._handle_ch_ping()
        elif path == "/api/clickhouse/schema":
            self._handle_ch_schema()
        elif path == "/api/clickhouse/scenes":
            self._handle_ch_scenes()
        elif path == "/api/clickhouse/shots":
            self._handle_ch_shots()
        elif path == "/api/clickhouse/budget":
            self._handle_ch_budget()
        elif path == "/api/clickhouse/stats":
            self._handle_ch_stats()
        else:
            super().do_GET()

    # ── Auth handlers ─────────────────────────────────────────────────────

    def _handle_register(self):
        data = self._read_json()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()
        name = data.get("name", "").strip() or email.split("@")[0]
        role = data.get("role", "Director")

        if not email or not password:
            json_resp(self, {"status": "error", "error": "Email and password required"}, 400)
            return
        if len(password) < 8:
            json_resp(self, {"status": "error", "error": "Password must be at least 8 characters"}, 400)
            return

        try:
            existing = ch_query(
                f"SELECT email FROM {CH_DB}.users WHERE email = {{email:String}}",
                params={"email": email},
            )
            if existing.get("data"):
                json_resp(self, {"status": "error", "error": "User with this email already exists"}, 400)
                return

            user_id = str(uuid.uuid4())
            pwd_hash = hash_password(password)
            created_at = utc_now().strftime("%Y-%m-%d %H:%M:%S")
            avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={email}"

            ch_query(
                f"INSERT INTO {CH_DB}.users (user_id, email, password_hash, name, role, avatar_url, created_at) "
                f"VALUES ({{user_id:String}}, {{email:String}}, {{pwd:String}}, {{name:String}}, "
                f"{{role:String}}, {{avatar:String}}, {{created_at:String}})",
                params={
                    "user_id": user_id,
                    "email": email,
                    "pwd": pwd_hash,
                    "name": name,
                    "role": role,
                    "avatar": avatar,
                    "created_at": created_at,
                },
            )

            token = create_jwt(user_id, email, name, role)
            json_resp(
                self,
                {
                    "status": "ok",
                    "token": token,
                    "user": {"id": user_id, "email": email, "name": name, "role": role, "avatar": avatar},
                },
            )
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_login(self):
        data = self._read_json()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()

        if not email or not password:
            json_resp(self, {"status": "error", "error": "Email and password required"}, 400)
            return

        try:
            res = ch_query(
                f"SELECT user_id, name, role, avatar_url, password_hash FROM {CH_DB}.users "
                f"WHERE email = {{email:String}}",
                params={"email": email},
            )
            rows = res.get("data", [])
            if not rows or not verify_password(password, rows[0][4]):
                json_resp(self, {"status": "error", "error": "Invalid email or password"}, 401)
                return

            user_id, name, role, avatar = rows[0][0], rows[0][1], rows[0][2], rows[0][3]
            token = create_jwt(user_id, email, name, role)
            json_resp(
                self,
                {
                    "status": "ok",
                    "token": token,
                    "user": {"id": user_id, "email": email, "name": name, "role": role, "avatar": avatar},
                },
            )
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_google(self):
        data = self._read_json()
        google_token = data.get("credential", "") or data.get("token", "")

        profile = verify_google_id_token(google_token) if google_token else None
        if not profile and ALLOW_DEV_GOOGLE_AUTH:
            email = data.get("email", "").strip().lower()
            if not email:
                json_resp(self, {"status": "error", "error": "Email required for dev Google auth"}, 400)
                return
            profile = {
                "email": email,
                "name": data.get("name", "").strip() or "Executive Producer",
                "picture": data.get("picture", "") or f"https://api.dicebear.com/7.x/avataaars/svg?seed={email}",
            }
        elif not profile:
            json_resp(
                self,
                {"status": "error", "error": "Valid Google credential token required"},
                401,
            )
            return

        email = profile["email"]
        name = profile.get("name", "Executive Producer")
        avatar = profile.get("picture") or f"https://api.dicebear.com/7.x/avataaars/svg?seed={email}"
        role = "Executive Producer"

        try:
            res = ch_query(
                f"SELECT user_id, name, role, avatar_url FROM {CH_DB}.users WHERE email = {{email:String}}",
                params={"email": email},
            )
            rows = res.get("data", [])
            if rows:
                user_id, name, role, avatar = rows[0][0], rows[0][1], rows[0][2], rows[0][3]
            else:
                user_id = str(uuid.uuid4())
                pwd_hash = hash_password(uuid.uuid4().hex)
                created_at = utc_now().strftime("%Y-%m-%d %H:%M:%S")
                ch_query(
                    f"INSERT INTO {CH_DB}.users (user_id, email, password_hash, name, role, avatar_url, created_at) "
                    f"VALUES ({{user_id:String}}, {{email:String}}, {{pwd:String}}, {{name:String}}, "
                    f"{{role:String}}, {{avatar:String}}, {{created_at:String}})",
                    params={
                        "user_id": user_id,
                        "email": email,
                        "pwd": pwd_hash,
                        "name": name,
                        "role": role,
                        "avatar": avatar,
                        "created_at": created_at,
                    },
                )

            token = create_jwt(user_id, email, name, role)
            json_resp(
                self,
                {
                    "status": "ok",
                    "token": token,
                    "user": {"id": user_id, "email": email, "name": name, "role": role, "avatar": avatar},
                },
            )
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_auth_me(self):
        user_data = verify_jwt(self._bearer_token())
        if not user_data:
            json_resp(self, {"status": "error", "error": "Invalid or expired JWT token"}, 401)
            return

        email = user_data.get("email")
        try:
            res = ch_query(
                f"SELECT user_id, name, role, avatar_url FROM {CH_DB}.users WHERE email = {{email:String}}",
                params={"email": email},
            )
            rows = res.get("data", [])
            if rows:
                u = rows[0]
                json_resp(
                    self,
                    {"status": "ok", "user": {"id": u[0], "email": email, "name": u[1], "role": u[2], "avatar": u[3]}},
                )
            else:
                json_resp(
                    self,
                    {
                        "status": "ok",
                        "user": {
                            "id": user_data.get("sub"),
                            "email": email,
                            "name": user_data.get("name"),
                            "role": user_data.get("role"),
                            "avatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={email}",
                        },
                    },
                )
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    # ── AI handlers ───────────────────────────────────────────────────────

    def _handle_ai_chat(self):
        data = self._read_json()
        user_msg = data.get("message", "")
        try:
            if genai_client:
                from google.genai import types
                
                system_prompt = (
                    "You are the CinemaLit Director AI Agent — an autonomous Hollywood production agent. "
                    "You have direct access to the ClickHouse production database via tools. "
                    "When a user asks about budgets, elements, or schedules, USE YOUR TOOLS to find the answers! "
                    "If asked to break down a scene, use get_scene_details and add_scene_element. "
                    "Answer concisely with professional film industry insight."
                )
                
                chat = genai_client.chats.create(
                    model=GEMINI_MODEL,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        tools=AGENT_TOOLS,
                        temperature=0.1
                    )
                )
                
                response = chat.send_message(user_msg)
                reply_text = response.text.strip()
                source = f"{GEMINI_MODEL} (Agentic)"
            else:
                reply_text = f"AI Agent (offline): '{user_msg}' — configure GOOGLE_API_KEY to enable Gemini."
                source = "offline"
            json_resp(self, {"status": "ok", "reply": reply_text, "source": source})
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_analyze_script(self):
        data = self._read_json()
        script_text = data.get("scriptText", "")
        try:
            if genai_client:
                prompt = (
                    "Analyze this Fountain screenplay script. Identify: high-risk scenes "
                    "(stunts, weather, pyro, night exteriors), key props, VFX needs, "
                    "budget watch items, and scheduling risks.\n\n"
                    f"Screenplay:\n{script_text[:2000]}"
                )
                response = genai_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
                analysis = response.text.strip()
            else:
                analysis = "Gemini offline — configure GOOGLE_API_KEY. Heuristic: check night exteriors and rain FX."
            json_resp(self, {"status": "ok", "analysis": analysis})
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_ask_data(self):
        data = self._read_json()
        question = data.get("question", "")
        try:
            if genai_client:
                sql_prompt = (
                    f"You are a ClickHouse SQL expert for film production database '{CH_DB}'. "
                    "Tables: scenes, cast_members, scene_cast, budget_items, elements, shots.\n"
                    f"Write ONE valid ClickHouse SQL SELECT query (no markdown) to answer: {question}"
                )
                sql_response = genai_client.models.generate_content(model=GEMINI_MODEL, contents=sql_prompt)
                generated_sql = sql_response.text.strip().strip("```sql").strip("```").strip()
                if not generated_sql.upper().lstrip().startswith("SELECT"):
                    raise ValueError("Gemini returned a non-SELECT query")

                result = ch_query(generated_sql)
                interpret_prompt = (
                    f"A film producer asked: '{question}'\n"
                    f"Results: {json.dumps(result.get('data', []))}\n"
                    f"Columns: {[m['name'] for m in result.get('meta', [])]}\n"
                    "Give concise professional film production insight with specific numbers."
                )
                interpret_response = genai_client.models.generate_content(model=GEMINI_MODEL, contents=interpret_prompt)
                interpretation = interpret_response.text.strip()
            else:
                generated_sql = f"SELECT * FROM {CH_DB}.budget_items LIMIT 5"
                result = ch_query(generated_sql)
                interpretation = "AI offline — raw data returned."

            json_resp(
                self,
                {
                    "status": "ok",
                    "question": question,
                    "sql": generated_sql,
                    "data": result.get("data", []),
                    "meta": result.get("meta", []),
                    "interpretation": interpretation,
                },
            )
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_sync_script(self):
        data = self._read_json()
        script_text = data.get("scriptText", "")
        if not script_text or not script_text.strip():
            json_resp(self, {"status": "error", "error": "No script text provided"}, 400)
            return

        try:
            if genai_client:
                prompt = (
                    "Extract structured JSON from this Fountain screenplay. Return ONLY valid JSON:\n"
                    '{"scenes":[{"scene_number":"SC-001","int_ext":"EXT","location":"Rooftop",'
                    '"time_of_day":"NIGHT","page_count":1.5,"description":"...","risk_level":"scheduled"}]}\n\n'
                    f"Screenplay:\n{script_text[:3000]}"
                )
                resp = genai_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
                clean_text = resp.text.strip().strip("```json").strip("```").strip()
                parsed = json.loads(clean_text)

                scenes_synced = 0
                for idx, sc in enumerate(parsed.get("scenes", []), start=100):
                    ch_query(
                        f"INSERT INTO {CH_DB}.scenes VALUES ("
                        f"{idx}, '{ch_escape(str(sc.get('scene_number', 'SC-NEW')))}', "
                        f"'{ch_escape(str(sc.get('int_ext', 'INT')))}', "
                        f"'{ch_escape(str(sc.get('location', 'Set')))}', "
                        f"'{ch_escape(str(sc.get('time_of_day', 'DAY')))}', "
                        f"{float(sc.get('page_count', 1.0))}, 1, "
                        f"'{ch_escape(str(sc.get('risk_level', 'scheduled')))}', "
                        f"'{ch_escape(str(sc.get('description', '')))}')"
                    )
                    scenes_synced += 1

                json_resp(
                    self,
                    {
                        "status": "ok",
                        "message": f"Successfully parsed and synced {scenes_synced} scenes into ClickHouse!",
                        "parsed": parsed,
                    },
                )
            else:
                json_resp(self, {"status": "error", "error": "Gemini offline — cannot sync script"}, 503)
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_dga_check(self):
        try:
            schedule_data = ch_query(
                f"SELECT shoot_day, groupArray(scene_number), sum(page_count) "
                f"FROM {CH_DB}.scenes GROUP BY shoot_day ORDER BY shoot_day"
            )
            if genai_client:
                audit_prompt = (
                    "You are a DGA 1st AD Audit Agent. Audit this schedule against DGA rules "
                    "(max 12h turnarounds, max 4.5 pages/day, night exterior turnarounds):\n"
                    f"{json.dumps(schedule_data.get('data', []))}"
                )
                resp = genai_client.models.generate_content(model=GEMINI_MODEL, contents=audit_prompt)
                audit_text = resp.text.strip()
            else:
                audit_text = "Gemini offline — schedule data returned without AI audit."

            json_resp(self, {"status": "ok", "schedule": schedule_data.get("data", []), "audit": audit_text})
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_generate_storyboard(self):
        data = self._read_json()
        scene_num = re.sub(r"[^0-9]", "", str(data.get("sceneNum", "01"))) or "01"
        script_snippet = data.get("scriptSnippet", "")
        interval_sec = int(data.get("intervalSec", 5))

        ch_shots = ch_query(
            f"SELECT shot_code, lens_mm, movement, framing, description FROM {CH_DB}.shots "
            f"WHERE scene_id IN ("
            f"SELECT scene_id FROM {CH_DB}.scenes WHERE scene_number LIKE {{pattern:String}})",
            params={"pattern": f"%{scene_num}%"},
        )
        shot_rows = ch_shots.get("data", [])

        try:
            if genai_client:
                try:
                    prompt = (
                        "Generate storyboard frames matching shot list. Return ONLY valid JSON with "
                        'frames[{frameNum,title,cameraSpec,startSec,endSec,prompt}], '
                        "estimated_duration_sec, recommended_interval_sec.\n\n"
                        f"Screenplay:\n{script_snippet[:1500]}\n\n"
                        f"Shots: {json.dumps(shot_rows)}"
                    )
                    resp = genai_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
                    clean_text = resp.text.strip().strip("```json").strip("```").strip()
                    parsed = json.loads(clean_text)
                    raw_frames = parsed.get("frames", [])
                    est_dur = parsed.get("estimated_duration_sec", 15)
                    rec_int = parsed.get("recommended_interval_sec", interval_sec)
                except Exception as api_err:
                    print(f"⚠️ Gemini error ({api_err}) — using ClickHouse shot list fallback.")
                    raw_frames = []
            else:
                raw_frames = []

            if not raw_frames:
                for idx, srow in enumerate(shot_rows, start=1):
                    raw_frames.append(
                        {
                            "frameNum": idx,
                            "title": f"Frame {idx:02d} — Shot {srow[0]} ({srow[3] if len(srow) > 3 else 'WS'})",
                            "cameraSpec": f"{srow[1]}mm · {srow[2]}",
                            "startSec": (idx - 1) * interval_sec,
                            "endSec": idx * interval_sec,
                            "prompt": str(srow[4]) if len(srow) > 4 else f"Shot {idx}",
                        }
                    )
                est_dur = max(18, len(raw_frames) * interval_sec)
                rec_int = interval_sec

            scene_png_map = {
                "01": ["/sc1_f1.jpg", "/sc1_f2.jpg", "/sc1_f3.jpg"],
                "02": ["/storyboard_sc2.jpg", "/sc1_f1.jpg"],
                "03": ["/storyboard_sc3.jpg", "/sc1_f3.jpg"],
                "04": ["/sc4_apartment.jpg"],
                "05": ["/sc5_interrogation.jpg"],
                "06": ["/sc6_docks.jpg"],
                "07": ["/storyboard_sc3.jpg"],
                "08": ["/sc4_apartment.jpg"],
                "09": ["/sc6_docks.jpg"],
            }
            scene_imgs = scene_png_map.get(scene_num, ["/sc1_f1.jpg"])
            
            # Ensure local scene folder exists
            scene_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "storyboards", f"scene_{scene_num.zfill(2)}"))
            os.makedirs(scene_dir, exist_ok=True)
            public_scene_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "cinemalit-studio", "public", "storyboards", f"scene_{scene_num.zfill(2)}"))
            os.makedirs(public_scene_dir, exist_ok=True)

            scene_png_map = {
                "01": ["/sc1_f1.jpg", "/sc1_f2.jpg", "/sc1_f3.jpg"],
                "02": ["/storyboard_sc2.jpg", "/sc1_f1.jpg"],
                "03": ["/storyboard_sc3.jpg", "/sc1_f3.jpg"],
                "04": ["/sc4_apartment.jpg"],
                "05": ["/sc5_interrogation.jpg"],
                "06": ["/sc6_docks.jpg"],
            }
            scene_imgs = scene_png_map.get(scene_num, ["/sc1_f1.jpg"])

            processed_frames = []
            for idx, fr in enumerate(raw_frames, start=1):
                import time
                if idx > 1:
                    time.sleep(2.0) # Avoid rate limits from image APIs
                    
                dest_file_name = f"frame_{str(idx).zfill(2)}.jpg"
                dest_local_path = os.path.join(scene_dir, dest_file_name)
                dest_public_path = os.path.join(public_scene_dir, dest_file_name)

                # Attempt dynamic image generation via Pollinations / Picsum API
                prompt_text = fr.get("prompt", f"Scene {scene_num} Keyframe {idx}")
                img_data = None

                try:
                    # 1. Try Pollinations dynamic text-to-image API
                    base_prompt = re.sub(r"[^\w\s]", "", prompt_text)[:120]
                    clean_prompt = f"Cinematic film still, photorealistic, 8k resolution, highly detailed, movie scene: {base_prompt}"
                    poll_url = f"https://image.pollinations.ai/prompt/{urllib.parse.quote(clean_prompt)}?width=512&height=512&seed={idx+int(scene_num)}"
                    req = urllib.request.Request(poll_url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req, timeout=25) as resp:
                        img_data = resp.read()
                except Exception as p_err:
                    print(f"⚠️ Pollinations API ({p_err}) — trying dummyimage fallback...")
                    try:
                        short_p = urllib.parse.quote(base_prompt[:120])
                        pic_url = f"https://placehold.co/512x512/222222/cccccc.png?text={short_p}"
                        req2 = urllib.request.Request(pic_url, headers={"User-Agent": "Mozilla/5.0"})
                        with urllib.request.urlopen(req2, timeout=5) as r2:
                            img_data = r2.read()
                    except Exception as pic_err:
                        print(f"⚠️ Dummyimage API ({pic_err}) — copying local asset fallback.")

                # Fallback to local image copy if network API is unreachable
                if not img_data:
                    src_img_rel = scene_imgs[(idx - 1) % len(scene_imgs)]
                    src_full_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "cinemalit-studio", "public", src_img_rel.lstrip("/")))
                    if os.path.exists(src_full_path):
                        with open(src_full_path, "rb") as sf:
                            img_data = sf.read()

                if img_data:
                    with open(dest_local_path, "wb") as df:
                        df.write(img_data)
                    with open(dest_public_path, "wb") as pf:
                        pf.write(img_data)

                processed_frames.append(
                    {
                        "frameNum": idx,
                        "title": fr.get("title", f"Frame {idx:02d}"),
                        "cameraSpec": fr.get("cameraSpec", "50mm Anamorphic"),
                        "startSec": fr.get("startSec", (idx - 1) * interval_sec),
                        "endSec": fr.get("endSec", idx * interval_sec),
                        "prompt": prompt_text,
                        "imgUrl": f"/storyboards/scene_{scene_num.zfill(2)}/{dest_file_name}?t={int(time.time())}",
                    }
                )

            json_resp(
                self,
                {
                    "status": "ok",
                    "sceneNum": scene_num,
                    "duration": est_dur,
                    "interval": rec_int,
                    "frames": processed_frames,
                },
            )

            # Persist the newly generated frames in ClickHouse
            try:
                # First delete any existing frames for this scene/project
                ch_query(f"ALTER TABLE {CH_DB}.storyboards DELETE WHERE project_id = {{proj:String}} AND scene_num = {{sn:String}}", params={"proj": proj_id, "sn": scene_num})
                # Insert the new frames
                for fr in processed_frames:
                    ch_query(
                        f"INSERT INTO {CH_DB}.storyboards "
                        f"(project_id, scene_num, frame_num, title, camera_spec, start_sec, end_sec, prompt, img_url) "
                        f"VALUES ({{p:String}}, {{sn:String}}, {{fn:UInt8}}, {{t:String}}, {{cs:String}}, {{ss:Int32}}, {{es:Int32}}, {{pr:String}}, {{iu:String}})",
                        params={
                            "p": proj_id,
                            "sn": scene_num,
                            "fn": fr.get("frameNum", 1),
                            "t": fr.get("title", ""),
                            "cs": fr.get("cameraSpec", ""),
                            "ss": fr.get("startSec", 0),
                            "es": fr.get("endSec", 0),
                            "pr": fr.get("prompt", ""),
                            "iu": fr.get("imgUrl", ""),
                        }
                    )
            except Exception as e:
                print(f"Failed to persist storyboards to DB: {e}")


        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    # ── ClickHouse handlers ───────────────────────────────────────────────

    def _handle_ch_query(self):
        data = self._read_json()
        sql = data.get("sql", "").strip()
        if not sql:
            json_resp(self, {"status": "error", "error": "No SQL provided"}, 400)
            return
        if not sql.upper().lstrip().startswith("SELECT"):
            json_resp(self, {"status": "error", "error": "Only SELECT queries are allowed via the UI console."}, 403)
            return
        try:
            result = ch_query(sql)
            json_resp(
                self,
                {
                    "status": "ok",
                    "meta": result.get("meta", []),
                    "data": result.get("data", []),
                    "rows": result.get("rows", 0),
                    "statistics": result.get("statistics", {}),
                },
            )
        except urllib.error.URLError as exc:
            json_resp(self, {"status": "error", "error": f"ClickHouse unreachable: {exc.reason}"}, 503)
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_status(self):
        ch_live = ch_ping()
        json_resp(
            self,
            {
                "gemini_api": bool(genai_client),
                "model": f"{GEMINI_MODEL}" if genai_client else "offline",
                "clickhouse": "connected" if ch_live else "offline",
                "clickhouse_host": f"{CH_HOST}:{CH_PORT}",
                "clickhouse_db": CH_DB,
            },
        )

    def _handle_ch_ping(self):
        ch_live = ch_ping()
        json_resp(
            self,
            {
                "status": "ok" if ch_live else "error",
                "connected": ch_live,
                "host": f"{CH_HOST}:{CH_PORT}",
                "database": CH_DB,
            },
        )

    def _handle_ch_schema(self):
        try:
            tables_result = ch_query(
                f"SELECT table, name, type FROM system.columns "
                f"WHERE database = {{db:String}} ORDER BY table, position",
                params={"db": CH_DB},
            )
            schema = {}
            for row in tables_result.get("data", []):
                tbl, col, typ = row
                schema.setdefault(tbl, []).append({"column": col, "type": typ})
            json_resp(self, {"status": "ok", "schema": schema})
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_ch_scenes(self):
        try:
            url_parts = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(url_parts.query)
            proj_id = query_params.get("projectId", ["p1"])[0]

            result = ch_query(
                f"SELECT scene_number, int_ext, location, time_of_day, page_count, shoot_day, status, description "
                f"FROM {CH_DB}.scenes ORDER BY scene_number"
            )
            scenes = []
            
            # Project specific artwork mapping
            if proj_id == 'p2':
                img_map = {
                    "01": "/sc_cyberpunk.jpg",
                    "02": "/sc6_docks.jpg",
                    "03": "/sc1_f1.jpg",
                    "04": "/sc4_apartment.jpg",
                }
            elif proj_id == 'p3':
                img_map = {
                    "01": "/sc_solaris.jpg",
                    "02": "/sc5_interrogation.jpg",
                    "03": "/sc4_apartment.jpg",
                }
            else:
                img_map = {
                    "01": "/sc1_f1.jpg",
                    "02": "/storyboard_sc2.jpg",
                    "03": "/storyboard_sc3.jpg",
                    "04": "/sc4_apartment.jpg",
                    "05": "/sc5_interrogation.jpg",
                    "06": "/sc6_docks.jpg",
                    "07": "/storyboard_sc3.jpg",
                    "08": "/sc4_apartment.jpg",
                    "09": "/sc6_docks.jpg",
                }

            # Fetch saved storyboards
            sb_result = ch_query(
                f"SELECT scene_num, frame_num, title, camera_spec, start_sec, end_sec, prompt, img_url "
                f"FROM {CH_DB}.storyboards WHERE project_id = {{proj:String}} ORDER BY scene_num, frame_num",
                params={"proj": proj_id}
            )
            saved_sbs = {}
            for row in sb_result.get("data", []):
                sn = row[0]
                saved_sbs.setdefault(sn, []).append({
                    "id": f"f-{sn}-{row[1]}",
                    "frameNum": int(row[1]),
                    "title": row[2],
                    "cameraSpec": row[3],
                    "startSec": int(row[4]),
                    "endSec": int(row[5]),
                    "prompt": row[6],
                    "imgUrl": row[7],
                    "timing": f"00:{int(row[4]):02d} - 00:{int(row[5]):02d}",
                })

            for r in result.get("data", []):
                num = str(r[0]).replace("SC-", "").replace("SCENE ", "")
                int_ext, loc, tod, pg = r[1], r[2], r[3], float(r[4])
                
                if num in saved_sbs and len(saved_sbs[num]) > 0:
                    frames = saved_sbs[num]
                else:
                    frames = [
                        {
                            "id": f"f-{num}-1",
                            "frameNum": 1,
                            "title": f"Frame 01 — Establishing {loc}",
                            "imgUrl": img_map.get(num, "/sc1_f1.jpg"),
                            "prompt": f"{int_ext} {loc} {tod} cinematic establishing shot",
                            "cameraSpec": "35mm Prime · Static Wide",
                            "startSec": 0,
                            "endSec": 5,
                            "timing": "00:00 - 00:05 (5s interval)",
                        }
                    ]
                    
                scenes.append(
                    {
                        "sceneNum": num,
                        "slugline": f"{int_ext}. {loc.upper()} — {tod}",
                        "desc": r[7] if len(r) > 7 and r[7] else f"Scene {num} in {loc}",
                        "totalDurationSec": int(pg * 60) if pg > 0 else 18,
                        "recommendedIntervalSec": 5 if pg <= 0.5 else 8,
                        "frames": frames,
                    }
                )
            json_resp(self, {"status": "ok", "scenes": scenes})
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_ch_shots(self):
        try:
            result = ch_query(
                f"SELECT shot_code, scene_id, framing, movement, lens_mm, description, status "
                f"FROM {CH_DB}.shots ORDER BY shot_id"
            )
            shots = []
            for idx, r in enumerate(result.get("data", []), start=1):
                code = str(r[0])
                parts = code.split("-")
                scene_num = f"{int(parts[1]):02d}" if len(parts) >= 2 and parts[1].isdigit() else "01"
                shots.append(
                    {
                        "id": f"sh-{idx}",
                        "label": code,
                        "sceneNum": scene_num,
                        "type": r[2] or "WS",
                        "angle": "Eye Level",
                        "movement": r[3] or "Static",
                        "lens": f"{r[4]}mm" if str(r[4]).isdigit() else str(r[4]),
                        "desc": r[5] or f"Camera setup {code}",
                        "status": r[6] if r[6] in ("planned", "setup", "shot", "approved") else "planned",
                    }
                )
            json_resp(self, {"status": "ok", "shots": shots})
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_ch_budget(self):
        try:
            result = ch_query(
                f"SELECT item_id, category, description, budgeted_usd, actual_usd "
                f"FROM {CH_DB}.budget_items ORDER BY item_id"
            )
            items = []
            for r in result.get("data", []):
                budgeted = float(r[3])
                actual = float(r[4]) if len(r) > 4 else 0.0
                items.append(
                    {
                        "id": f"b{r[0]}",
                        "acct": f"{1000 + int(r[0])}",
                        "category": str(r[1]),
                        "desc": str(r[2]),
                        "estimated": actual if actual > 0 else budgeted,
                        "cap": budgeted,
                        "status": "over" if actual > budgeted else "ok",
                    }
                )
            json_resp(self, {"status": "ok", "budget": items})
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_ch_stats(self):
        try:
            stats = {}
            r1 = ch_query(f"SELECT sum(budgeted_usd), sum(actual_usd) FROM {CH_DB}.budget_items")
            stats["total_budgeted"] = r1["data"][0][0] if r1["data"] else 0
            stats["total_actual"] = r1["data"][0][1] if r1["data"] else 0

            r2 = ch_query(f"SELECT count() FROM {CH_DB}.scenes")
            stats["total_scenes"] = r2["data"][0][0] if r2["data"] else 0

            r3 = ch_query(f"SELECT count() FROM {CH_DB}.cast_members")
            stats["total_cast"] = r3["data"][0][0] if r3["data"] else 0

            r4 = ch_query(f"SELECT count() FROM {CH_DB}.shots")
            stats["total_shots"] = r4["data"][0][0] if r4["data"] else 0

            r5 = ch_query(
                f"SELECT category, sum(budgeted_usd) AS spend FROM {CH_DB}.budget_items "
                f"GROUP BY category ORDER BY spend DESC"
            )
            stats["budget_by_category"] = [{"category": row[0], "amount": row[1]} for row in r5.get("data", [])]
            json_resp(self, {"status": "ok", "stats": stats})
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)


def main():
    if not os.path.isdir(WEB_DIR):
        print(f"⚠️  Frontend build not found at {WEB_DIR}")
        print("   Run: cd cinemalit-studio && npm install && npm run build")
        print("   Or:  cinemalit web  (auto-builds if dist/ is missing)\n")

    os.chdir(WEB_DIR)
    ensure_users_table()
    ch_live = ch_ping()
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), StudioRequestHandler) as httpd:
        print("\n🎬 CinemaLit Studio — AI-Native Command Center")
        print(f"   👉  http://localhost:{PORT}")
        print(f"   🤖  Gemini API:   {'CONNECTED (' + GEMINI_MODEL + ')' if genai_client else 'OFFLINE'}")
        print(f"   🗄️   ClickHouse:   {'CONNECTED — ' + CH_DB if ch_live else 'OFFLINE (run: docker compose up -d)'}")
        print("   🎯  Hackathon:    Agentic Cinema — ClickHouse Track\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")


if __name__ == "__main__":
    main()
