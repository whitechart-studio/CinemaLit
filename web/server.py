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
import threading
import uuid
import zlib
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional

# Ensure emoji/Unicode symbols in startup banners don't crash on legacy console encodings (e.g. Windows cp1252)
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

# Ensure root package import
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv

load_dotenv(".env", override=True)
load_dotenv(os.path.expanduser("~/.env"))

from web.auth import (
    GOOGLE_CLIENT_ID,
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
# ON by default — the Director Agent is the orchestrator, so the AI handlers route
# through cinemalit_agent (ADK). Set USE_ADK_AGENT=false to fall back to this
# module's own direct genai_client calls (kept as an offline/debug path).
# Project ingest and storyboards always go through the agent regardless of this
# flag — they have no direct-call implementation.
USE_ADK_AGENT = os.getenv("USE_ADK_AGENT", "true").lower() in ("1", "true", "yes")
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


def _active_model() -> str:
    """The model that actually serves requests — the agent's when it is wired
    in, this module's own otherwise. They differ: cinemalit_agent/.env sets its
    own GEMINI_MODEL and overrides the root .env at import time."""
    if USE_ADK_AGENT:
        try:
            from cinemalit_agent.agent import GEMINI_MODEL as AGENT_MODEL
            return AGENT_MODEL
        except Exception:  # noqa: BLE001 — fall back rather than fail /api/status
            pass
    return GEMINI_MODEL


def ensure_storyboards_schema() -> None:
    """Add is_placeholder if the table predates it (safe on every startup) —
    lets the UI tell a real generated frame from a reused stock fallback."""
    if not ch_ping():
        return
    try:
        ch_query(f"ALTER TABLE {CH_DB}.storyboards ADD COLUMN IF NOT EXISTS is_placeholder UInt8 DEFAULT 0")
    except Exception as exc:
        print(f"⚠️  Could not ensure storyboards.is_placeholder column: {exc}")


def ensure_budget_items_schema() -> None:
    """Add scene_id if the table predates it (safe on every startup) — lets the
    topsheet filter by scene instead of showing every department line flat."""
    if not ch_ping():
        return
    try:
        ch_query(f"ALTER TABLE {CH_DB}.budget_items ADD COLUMN IF NOT EXISTS scene_id Nullable(UInt32)")
    except Exception as exc:
        print(f"⚠️  Could not ensure budget_items.scene_id column: {exc}")


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
    # Handlers put failure detail in the body only; without this a 500 is
    # invisible on the console and there is nothing left to debug from.
    if status >= 500:
        print(f"❌ {status} {handler.path}: {data.get('error')}")
    payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    handler.end_headers()
    handler.wfile.write(payload)

# Tables scoped by project_id — a SELECT that touches one of these without a
# `project_id = '...'` literal in it can read every project's data at once.
PROJECT_SCOPED_TABLES = (
    "scenes", "cast_members", "scene_cast", "budget_items", "elements",
    "shots", "storyboards", "jobs", "projects",
)
_PROJECT_ID_LITERAL = re.compile(r"project_id\s*=\s*'([^']+)'", re.IGNORECASE)


def _project_owner(project_id: str) -> Optional[str]:
    """The user_id that owns a project, or None if it doesn't exist."""
    rows = ch_query(
        f"SELECT user_id FROM {CH_DB}.projects FINAL WHERE project_id = {{p:String}} LIMIT 1",
        {"p": project_id},
    ).get("data", [])
    return str(rows[0][0]) if rows else None


def _scoped_select_error(sql: str) -> Optional[str]:
    """None if a SELECT is safe to run unscoped; an error message otherwise.

    A regex check, not a SQL parser — good enough to block the common case
    (a bare `SELECT * FROM budget_items` reading every project's rows) without
    trying to fully understand arbitrary SQL.
    """
    lowered = sql.lower()
    touches_scoped = any(re.search(rf"\b{t}\b", lowered) for t in PROJECT_SCOPED_TABLES)
    if not touches_scoped:
        return None
    if not _PROJECT_ID_LITERAL.search(sql):
        return (
            "Queries touching project data must filter by a specific project, e.g. "
            "WHERE project_id = '...' — unscoped queries would mix every project's rows together."
        )
    return None


# --- AGENT TOOLS ---
def query_production_db(sql_query: str) -> dict:
    """Executes a READ-ONLY SELECT query against the ClickHouse production database to retrieve raw data."""
    if not sql_query.strip().upper().startswith("SELECT"):
        return {"error": "Only SELECT queries are allowed via this tool."}
    scoping_error = _scoped_select_error(sql_query)
    if scoping_error:
        return {"error": scoping_error}
    try:
        res = ch_query(sql_query)
        return {"data": res.get("data", [])[:20]} # limit to 20 rows
    except Exception as e:
        return {"error": str(e)}

def get_scene_details(scene_number: str, project_id: str) -> dict:
    """Retrieves all details for a specific scene of a specific project, including cast members, elements, and shots. Always pass the active project_id."""
    try:
        p = {"sn": scene_number, "p": project_id}
        scene = ch_query(f"SELECT scene_id, int_ext, location, time_of_day, description, status FROM {CH_DB}.scenes FINAL WHERE scene_number = {{sn:String}} AND project_id = {{p:String}}", p).get("data", [])
        if not scene:
            return {"error": f"Scene {scene_number} not found in project {project_id}."}
        q = {"s_id": scene[0][0], "p": project_id}
        elements = ch_query(f"SELECT element_type, name, cost_usd, vendor, status FROM {CH_DB}.elements FINAL WHERE scene_id = {{s_id:UInt32}} AND project_id = {{p:String}}", q).get("data", [])
        cast = ch_query(f"SELECT c.character_name, c.actor_name, c.day_rate_usd FROM {CH_DB}.scene_cast AS sc FINAL JOIN {CH_DB}.cast_members AS c FINAL ON sc.cast_id = c.cast_id WHERE sc.scene_id = {{s_id:UInt32}} AND sc.project_id = {{p:String}}", q).get("data", [])
        shots = ch_query(f"SELECT shot_code, framing, description FROM {CH_DB}.shots FINAL WHERE scene_id = {{s_id:UInt32}} AND project_id = {{p:String}}", q).get("data", [])
        return {
            "scene_number": scene_number,
            "project_id": project_id,
            "scene_info": scene[0],
            "cast": cast,
            "elements": elements,
            "shots": shots
        }
    except Exception as e:
        return {"error": str(e)}

def add_scene_element(scene_number: str, element_type: str, name: str, cost_usd: float, vendor: str, project_id: str) -> dict:
    """Proactively adds a new breakdown element (e.g. vfx, sfx, prop, stunt, cast) to a scene in the database. Always pass the active project_id."""
    try:
        scene = ch_query(f"SELECT scene_id FROM {CH_DB}.scenes FINAL WHERE scene_number = {{sn:String}} AND project_id = {{p:String}}", {"sn": scene_number, "p": project_id}).get("data", [])
        if not scene:
            return {"error": f"Scene {scene_number} not found in project {project_id}."}
        s_id = scene[0][0]
        # Deterministic id — the old MAX(element_id)+1 raced between concurrent callers.
        new_id = zlib.crc32(f"{project_id}:{scene_number}:{name}".encode()) or 1
        ch_query(f"""
            INSERT INTO {CH_DB}.elements (project_id, element_id, scene_id, element_type, name, cost_usd, vendor, status)
            VALUES ({{p:String}}, {{e_id:UInt32}}, {{s_id:UInt32}}, {{type:String}}, {{name:String}}, {{cost:Float64}}, {{vendor:String}}, 'planned')
        """, {"p": project_id, "e_id": new_id, "s_id": s_id, "type": element_type, "name": name, "cost": cost_usd, "vendor": vendor})
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
        self._auth_user = self._require_auth()
        if self._auth_user is None:
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
        elif path == "/api/projects":
            self._handle_create_project()
        elif path == "/api/projects/storyboards":
            self._handle_project_storyboards()
        elif path == "/api/ai/generate-storyboard":
            self._handle_generate_storyboard()
        else:
            self.send_error(404, "Endpoint not found")

    _STORYBOARD_PATH = re.compile(
        r"^/storyboards/([A-Za-z0-9_-]+)/scene_(\d{2})/(frame_\d{2}\.(?:jpg|jpeg|png))$"
    )

    def do_GET(self):
        path = self._path()

        # Intercept dynamic storyboard images and serve them directly from disk.
        # Path shape is validated with a strict regex (project_id/scene/frame) —
        # earlier this joined the raw URL onto a filesystem path unchecked,
        # which let "/storyboards/../server.py" walk out of the storyboards dir.
        if path.startswith("/storyboards/"):
            m = self._STORYBOARD_PATH.match(path)
            if not m:
                self.send_error(404, "Storyboard image not found")
                return
            project_id, scene_num, file_name = m.groups()
            root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            local_path = os.path.join(root, "storyboards", project_id, f"scene_{scene_num}", file_name)
            if os.path.exists(local_path) and os.path.isfile(local_path):
                self.send_response(200)
                if local_path.lower().endswith(".png"):
                    self.send_header("Content-Type", "image/png")
                else:
                    self.send_header("Content-Type", "image/jpeg")
                self.end_headers()
                with open(local_path, "rb") as f:
                    self.wfile.write(f.read())
                return
            else:
                self.send_error(404, "Storyboard image not found")
                return

        if path.startswith("/api/") and path not in PUBLIC_API_PATHS:
            self._auth_user = self._require_auth()
            if self._auth_user is None:
                return

        if path == "/api/auth/me":
            self._handle_auth_me()
        elif path == "/api/status":
            self._handle_status()
        elif path == "/api/clickhouse/ping":
            self._handle_ch_ping()
        elif path == "/api/clickhouse/schema":
            self._handle_ch_schema()
        elif path == "/api/projects":
            self._handle_list_projects()
        elif path == "/api/jobs":
            self._handle_job_status()
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

    # ── Project handlers ──────────────────────────────────────────────────

    def _query_param(self, name: str, default: str = "") -> str:
        parsed = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        return parsed.get(name, [default])[0]

    def _agent_session(self, user: dict, suffix: str = "chat") -> str:
        """One ADK session per user (and purpose). The bridge's shared default
        would otherwise put every user in one ever-growing conversation."""
        return f"{user.get('sub') or user.get('email') or 'anon'}:{suffix}"

    def _require_project_id_param(self) -> Optional[str]:
        """projectId from the query string — no silent default. Falling back
        to a fixed project id (the old behavior) meant a client that forgot
        to send one got routed into someone else's data instead of a clear
        error."""
        project_id = self._query_param("projectId")
        if not project_id:
            json_resp(self, {"status": "error", "error": "projectId required"}, 400)
            return None
        return project_id

    def _require_project_access(self, project_id: str, write: bool = False) -> bool:
        """Enforce that the signed-in user actually owns this project.

        The seeded demo project (user_id 'demo') stays readable by everyone —
        it exists so a new account has something to look at — but nobody
        other than its actual owner can mutate it, so one user's "regenerate
        storyboards" or "sync script" can't clobber what every other account
        sees as the shared example.
        """
        owner = _project_owner(project_id)
        if owner is None:
            json_resp(self, {"status": "error", "error": f"Unknown project {project_id}"}, 404)
            return False
        user = getattr(self, "_auth_user", None) or {}
        user_id = str(user.get("sub") or user.get("email") or "")
        if owner == user_id:
            return True
        if owner == "demo" and not write:
            return True
        json_resp(self, {"status": "error", "error": "You do not have access to this project"}, 403)
        return False

    def _handle_create_project(self):
        """Create a project, then hand the screenplay to the Director Agent.

        Returns as soon as the row is written — the agent's ingest runs in the
        background and the client polls /api/jobs for progress. A synchronous
        response would mean holding an HTTP connection open for minutes.
        """
        user = self._require_auth()
        if user is None:
            return
        data = self._read_json()
        name = (data.get("name") or "").strip() or "Untitled Production"
        script_text = data.get("scriptText") or ""
        if not script_text.strip():
            json_resp(self, {"status": "error", "error": "No script text provided"}, 400)
            return

        project_id = f"p{uuid.uuid4().hex[:12]}"
        user_id = str(user.get("sub") or user.get("email") or "anon")
        agents = data.get("selectedAgents") or []
        agents_sql = "[" + ",".join(f"'{ch_escape(str(a))}'" for a in agents) + "]"
        try:
            ch_query(
                f"INSERT INTO {CH_DB}.projects (project_id, user_id, name, format, genre, "
                f"budget_cap, shoot_days, union_scale, selected_agents, script_file, "
                f"script_text, status) VALUES ({{p:String}}, {{u:String}}, {{n:String}}, "
                f"{{f:String}}, {{g:String}}, {{b:Float64}}, {{d:UInt8}}, {{us:String}}, "
                f"{agents_sql}, {{sf:String}}, {{txt:String}}, 'ingesting')",
                {
                    "p": project_id,
                    "u": user_id,
                    "n": name,
                    "f": str(data.get("format") or "Short Film"),
                    "g": str(data.get("genre") or "Drama"),
                    "b": float(data.get("budgetCap") or 5000),
                    "d": max(1, min(255, int(data.get("shootDays") or 1))),
                    "us": str(data.get("unionScale") or ""),
                    "sf": str(data.get("scriptFile") or f"{name}.fountain"),
                    "txt": script_text,
                },
            )
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)
            return

        want_storyboards = bool(data.get("generateStoryboards"))
        prompt = (
            f"A new project has been created with project_id '{project_id}' "
            f"(\"{name}\"). Ingest its uploaded screenplay: call "
            f"ingest_project_script with project_id '{project_id}'."
        )
        if want_storyboards:
            prompt += (
                f" When that finishes, call generate_project_storyboards with "
                f"project_id '{project_id}'."
            )
        prompt += " Then report how many scenes you created."

        self._spawn_agent_job(prompt, self._agent_session(user, f"ingest:{project_id}"))
        json_resp(self, {"status": "ok", "projectId": project_id, "name": name}, 202)

    def _handle_project_storyboards(self):
        user = self._require_auth()
        if user is None:
            return
        data = self._read_json()
        project_id = str(data.get("projectId") or "")
        if not project_id:
            json_resp(self, {"status": "error", "error": "projectId required"}, 400)
            return
        if not self._require_project_access(project_id, write=True):
            return
        interval = int(data.get("intervalSec") or 5)
        self._spawn_agent_job(
            f"Call generate_project_storyboards with project_id '{project_id}' and "
            f"interval_sec {interval}, then report how many frames were generated.",
            self._agent_session(user, f"storyboard:{project_id}"),
        )
        json_resp(self, {"status": "ok", "projectId": project_id}, 202)

    @staticmethod
    def _spawn_agent_job(prompt: str, session_id: str):
        """Run one agent turn on a background thread. Progress lands in the
        jobs table via the pipeline tools, so nothing is lost if the client
        disconnects."""

        def _target():
            try:
                from cinemalit_agent.bridge import ask_agent
                ask_agent(prompt, session_id=session_id)
            except Exception as exc:  # noqa: BLE001
                print(f"⚠️  Agent job failed: {exc}")

        threading.Thread(target=_target, daemon=True).start()

    def _handle_list_projects(self):
        user = self._require_auth()
        if user is None:
            return
        user_id = str(user.get("sub") or user.get("email") or "anon")

        def _fetch(owner_filter: str, params: dict) -> list:
            return ch_query(
                f"SELECT p.project_id, p.name, p.format, p.genre, p.budget_cap, p.shoot_days, "
                f"p.script_file, p.status, p.updated_at, s.cnt, p.user_id "
                f"FROM (SELECT * FROM {CH_DB}.projects FINAL WHERE {owner_filter}) AS p "
                f"LEFT JOIN (SELECT project_id, count() AS cnt FROM {CH_DB}.scenes FINAL "
                f"           GROUP BY project_id) AS s ON p.project_id = s.project_id "
                f"ORDER BY p.updated_at DESC",
                params,
            ).get("data", [])

        try:
            # Own projects only, by default — the seeded demo project used to
            # be mixed into every account's list via `OR user_id = 'demo'`,
            # which made it look like shared/merged state. It now only shows
            # up as a one-time example for an account with nothing of its own
            # yet, clearly tagged isDemo so it can't be mistaken for real data.
            rows = _fetch("user_id = {u:String}", {"u": user_id})
            if not rows:
                rows = _fetch("user_id = 'demo'", {})
            projects = [
                {
                    "id": r[0],
                    "name": r[1],
                    "format": r[2],
                    "genre": r[3],
                    "budgetCap": float(r[4]),
                    "shootDays": int(r[5]),
                    "scriptFile": r[6],
                    "status": "development" if r[7] == "ingesting" else "active",
                    "phase": "Development" if r[7] == "ingesting" else "Pre-Production",
                    "updatedAt": str(r[8]),
                    "scenesCount": int(r[9]),
                    "estimatedCost": 0,
                    "isDemo": str(r[10]) == "demo",
                }
                for r in rows
            ]
            json_resp(self, {"status": "ok", "projects": projects})
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_job_status(self):
        """Latest job for a project, so the client never has to hold a job id."""
        if self._require_auth() is None:
            return
        project_id = self._query_param("projectId")
        kind = self._query_param("kind", "ingest")
        if not project_id:
            json_resp(self, {"status": "error", "error": "projectId required"}, 400)
            return
        if not self._require_project_access(project_id):
            return
        try:
            rows = ch_query(
                f"SELECT status, total, done, message, error FROM {CH_DB}.jobs FINAL "
                f"WHERE project_id = {{p:String}} AND kind = {{k:String}} "
                f"ORDER BY updated_at DESC LIMIT 1",
                {"p": project_id, "k": kind},
            ).get("data", [])
            if not rows:
                json_resp(self, {"status": "ok", "job": {"status": "pending", "total": 0, "done": 0, "message": "Waiting for the agent…"}})
                return
            status, total, done, message, error = rows[0]
            json_resp(
                self,
                {
                    "status": "ok",
                    "job": {
                        "status": status,
                        "total": int(total),
                        "done": int(done),
                        "message": message,
                        "error": error,
                    },
                },
            )
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    # ── AI handlers ───────────────────────────────────────────────────────

    def _handle_ai_chat(self):
        user = self._require_auth()
        if user is None:
            return
        data = self._read_json()
        user_msg = data.get("message", "")
        project_id = str(data.get("projectId") or "")
        if not project_id:
            json_resp(self, {"status": "error", "error": "projectId required"}, 400)
            return
        if not self._require_project_access(project_id):
            return
        try:
            if USE_ADK_AGENT:
                from cinemalit_agent.bridge import ask_agent
                reply_text = ask_agent(
                    f"[Active project: {project_id}] {user_msg}",
                    session_id=self._agent_session(user, f"chat:{project_id}"),
                )
                from cinemalit_agent.agent import GEMINI_MODEL as AGENT_MODEL
                source = f"{AGENT_MODEL} (ADK Agent)"
            elif genai_client:
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
            prompt = (
                "Analyze this Fountain screenplay script. Identify: high-risk scenes "
                "(stunts, weather, pyro, night exteriors), key props, VFX needs, "
                "budget watch items, and scheduling risks.\n\n"
                f"Screenplay:\n{script_text[:2000]}"
            )
            if USE_ADK_AGENT:
                from cinemalit_agent.bridge import ask_agent
                # Explicit session id — ask_agent()'s own default is one
                # shared, ever-growing conversation across every caller that
                # forgets to pass one, which is exactly what was happening here.
                analysis = ask_agent(
                    prompt, session_id=self._agent_session(self._auth_user, "analyze-script")
                )
            elif genai_client:
                response = genai_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
                analysis = response.text.strip()
            else:
                analysis = "Gemini offline — configure GOOGLE_API_KEY. Heuristic: check night exteriors and rain FX."
            json_resp(self, {"status": "ok", "analysis": analysis})
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_ask_data(self):
        user = self._require_auth()
        if user is None:
            return
        data = self._read_json()
        question = data.get("question", "")
        project_id = str(data.get("projectId") or "")
        if not project_id:
            json_resp(self, {"status": "error", "error": "projectId required"}, 400)
            return
        if not self._require_project_access(project_id):
            return
        try:
            if USE_ADK_AGENT:
                from cinemalit_agent.bridge import ask_agent
                interpretation = ask_agent(
                    f"[Active project: {project_id}] A film producer asked: '{question}'. Use your "
                    "ClickHouse tools — scoped to this project — to find the real answer, then give "
                    "concise professional film production insight with specific numbers.",
                    session_id=self._agent_session(user, f"askdata:{project_id}"),
                )
                json_resp(
                    self,
                    {
                        "status": "ok",
                        "question": question,
                        "sql": "",
                        "data": [],
                        "meta": [],
                        "interpretation": interpretation,
                    },
                )
                return
            if genai_client:
                sql_prompt = (
                    f"You are a ClickHouse SQL expert for film production database '{CH_DB}'. "
                    "Tables: scenes, cast_members, scene_cast, budget_items, elements, shots — "
                    "every one of them holds rows for MANY projects, distinguished only by their "
                    f"project_id column. This question is about project_id = '{project_id}' ONLY.\n"
                    f"Write ONE valid ClickHouse SQL SELECT query (no markdown) to answer: {question}\n"
                    f"The query MUST include `project_id = '{project_id}'` in its WHERE clause "
                    "(or a JOIN condition carrying the same filter) — never return rows from any "
                    "other project."
                )
                sql_response = genai_client.models.generate_content(model=GEMINI_MODEL, contents=sql_prompt)
                generated_sql = sql_response.text.strip().strip("```sql").strip("```").strip()
                if not generated_sql.upper().lstrip().startswith("SELECT"):
                    raise ValueError("Gemini returned a non-SELECT query")
                scoping_error = _scoped_select_error(generated_sql)
                if scoping_error or f"'{project_id}'" not in generated_sql:
                    raise ValueError(f"Generated SQL was not scoped to project {project_id}: {generated_sql}")

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
                generated_sql = f"SELECT * FROM {CH_DB}.budget_items WHERE project_id = {{p:String}} LIMIT 5"
                result = ch_query(generated_sql, {"p": project_id})
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
        """Re-ingest the active project from an edited screenplay.

        Stores the new script on the project, then asks the agent to run the
        same full ingest the wizard does — so an edited script produces the
        same depth of breakdown as a freshly uploaded one, instead of the old
        shallow scene-row insert.
        """
        user = self._require_auth()
        if user is None:
            return
        data = self._read_json()
        script_text = data.get("scriptText", "")
        project_id = str(data.get("projectId") or "")
        if not project_id:
            json_resp(self, {"status": "error", "error": "projectId required"}, 400)
            return
        if not script_text or not script_text.strip():
            json_resp(self, {"status": "error", "error": "No script text provided"}, 400)
            return
        if not self._require_project_access(project_id, write=True):
            return

        try:
            ch_query(
                f"ALTER TABLE {CH_DB}.projects UPDATE script_text = {{t:String}}, "
                f"updated_at = now() WHERE project_id = {{p:String}}",
                {"t": script_text, "p": project_id},
            )
            self._spawn_agent_job(
                f"The screenplay for project '{project_id}' has been updated. Re-ingest it: "
                f"call ingest_project_script with project_id '{project_id}', then report how "
                f"many scenes you created.",
                self._agent_session(user, f"ingest:{project_id}"),
            )
            json_resp(
                self,
                {
                    "status": "ok",
                    "projectId": project_id,
                    "message": "Director Agent is re-ingesting the script — watch the progress bar.",
                },
                202,
            )
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_dga_check(self):
        try:
            data = self._read_json()
            project_id = self._query_param("projectId") or str(data.get("projectId") or "")
            if not project_id:
                json_resp(self, {"status": "error", "error": "projectId required"}, 400)
                return
            if not self._require_project_access(project_id):
                return
            schedule_data = ch_query(
                f"SELECT shoot_day, groupArray(scene_number), sum(page_count) "
                f"FROM {CH_DB}.scenes FINAL WHERE project_id = {{p:String}} "
                f"GROUP BY shoot_day ORDER BY shoot_day",
                {"p": project_id},
            )
            audit_prompt = (
                "You are a DGA 1st AD Audit Agent. Audit this schedule against DGA rules "
                "(max 12h turnarounds, max 4.5 pages/day, night exterior turnarounds):\n"
                f"{json.dumps(schedule_data.get('data', []))}"
            )
            if USE_ADK_AGENT:
                from cinemalit_agent.bridge import ask_agent
                audit_text = ask_agent(
                    audit_prompt,
                    session_id=self._agent_session(self._auth_user, f"dga:{project_id}"),
                )
            elif genai_client:
                resp = genai_client.models.generate_content(model=GEMINI_MODEL, contents=audit_prompt)
                audit_text = resp.text.strip()
            else:
                audit_text = "Gemini offline — schedule data returned without AI audit."

            json_resp(self, {"status": "ok", "schedule": schedule_data.get("data", []), "audit": audit_text})
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_generate_storyboard(self):
        """Regenerate one scene's storyboard through the Director Agent.

        Replaces the old inline path, which called a third-party image API
        (pollinations.ai) directly and slept 2s between frames. Frames, camera
        specs and images now all come from the agent pipeline.
        """
        data = self._read_json()
        project_id = str(data.get("projectId") or "")
        if not project_id:
            json_resp(self, {"status": "error", "error": "projectId required"}, 400)
            return
        if not self._require_project_access(project_id, write=True):
            return
        scene_num = re.sub(r"[^0-9]", "", str(data.get("sceneNum", "01"))) or "01"
        interval_sec = int(data.get("intervalSec", 5))
        try:
            scene_row = ch_query(
                f"SELECT scene_number FROM {CH_DB}.scenes FINAL WHERE project_id = {{p:String}} "
                f"AND toUInt32OrZero(extract(scene_number, '([0-9]+)')) = {{n:UInt32}} LIMIT 1",
                {"p": project_id, "n": int(scene_num)},
            ).get("data", [])
            if not scene_row:
                json_resp(self, {"status": "error", "error": f"Scene {scene_num} not found"}, 404)
                return

            from cinemalit_agent.pipeline import generate_project_storyboards

            result = generate_project_storyboards(
                project_id, interval_sec=interval_sec, scene_number=scene_row[0][0]
            )
            if result.get("error"):
                json_resp(self, {"status": "error", "error": result["error"]}, 500)
                return

            frames = ch_query(
                f"SELECT frame_num, title, camera_spec, start_sec, end_sec, prompt, img_url, is_placeholder "
                f"FROM {CH_DB}.storyboards FINAL WHERE project_id = {{p:String}} "
                f"AND scene_num = {{s:String}} ORDER BY frame_num",
                {"p": project_id, "s": scene_num.zfill(2)[-2:]},
            ).get("data", [])
            payload = [
                {
                    "frameNum": int(f[0]),
                    "title": f[1],
                    "cameraSpec": f[2],
                    "startSec": int(f[3]),
                    "endSec": int(f[4]),
                    "prompt": f[5],
                    "imgUrl": f"{f[6]}?t={int(time.time())}",
                    "isPlaceholder": bool(f[7]) if len(f) > 7 else False,
                }
                for f in frames
            ]
            json_resp(
                self,
                {
                    "status": "ok",
                    "sceneNum": scene_num,
                    "duration": max((p["endSec"] for p in payload), default=15),
                    "interval": interval_sec,
                    "frames": payload,
                    "imagesReal": result.get("images_real", 0),
                    "imagesPlaceholder": result.get("images_placeholder", 0),
                    "imageError": result.get("image_error", ""),
                },
            )
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
        scoping_error = _scoped_select_error(sql)
        if scoping_error:
            json_resp(self, {"status": "error", "error": scoping_error}, 403)
            return
        project_match = _PROJECT_ID_LITERAL.search(sql)
        if project_match and not self._require_project_access(project_match.group(1)):
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
                # Report the model that actually answers. GEMINI_MODEL here is
                # web/server.py's own legacy direct-call model; when the agent
                # is in the loop the agent's model is the real one.
                "model": _active_model() if genai_client else "offline",
                "agent": USE_ADK_AGENT,
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
        """Full per-scene payload for a project: breakdown elements, cast,
        shot count, risk and any saved storyboard frames. Backs the canvas,
        breakdown, stripboard and storyboard views."""
        proj_id = self._require_project_id_param()
        if proj_id is None:
            return
        if not self._require_project_access(proj_id):
            return
        try:
            params = {"p": proj_id}

            result = ch_query(
                f"SELECT scene_number, int_ext, location, time_of_day, page_count, shoot_day, "
                f"status, description, scene_text FROM {CH_DB}.scenes FINAL "
                f"WHERE project_id = {{p:String}} ORDER BY scene_number",
                params,
            )

            def _by_scene(sql):
                out = {}
                for row in ch_query(sql, params).get("data", []):
                    out.setdefault(str(row[0]), []).append(row[1:])
                return out

            cast_by_scene = _by_scene(
                f"SELECT sc2.scene_number, cm.character_name "
                f"FROM (SELECT * FROM {CH_DB}.scene_cast FINAL WHERE project_id = {{p:String}}) AS sc "
                f"JOIN (SELECT scene_id, scene_number FROM {CH_DB}.scenes FINAL "
                f"      WHERE project_id = {{p:String}}) AS sc2 ON sc.scene_id = sc2.scene_id "
                f"JOIN (SELECT cast_id, character_name FROM {CH_DB}.cast_members FINAL "
                f"      WHERE project_id = {{p:String}}) AS cm ON sc.cast_id = cm.cast_id"
            )
            elements_by_scene = _by_scene(
                f"SELECT sc.scene_number, e.element_type, e.name, e.cost_usd "
                f"FROM (SELECT * FROM {CH_DB}.elements FINAL WHERE project_id = {{p:String}}) AS e "
                f"JOIN (SELECT scene_id, scene_number FROM {CH_DB}.scenes FINAL "
                f"      WHERE project_id = {{p:String}}) AS sc ON e.scene_id = sc.scene_id"
            )
            shots_by_scene = _by_scene(
                f"SELECT sc.scene_number, sh.shot_code "
                f"FROM (SELECT * FROM {CH_DB}.shots FINAL WHERE project_id = {{p:String}}) AS sh "
                f"JOIN (SELECT scene_id, scene_number FROM {CH_DB}.scenes FINAL "
                f"      WHERE project_id = {{p:String}}) AS sc ON sh.scene_id = sc.scene_id"
            )

            saved_sbs = {}
            for row in ch_query(
                f"SELECT scene_num, frame_num, title, camera_spec, start_sec, end_sec, prompt, img_url, is_placeholder "
                f"FROM {CH_DB}.storyboards FINAL WHERE project_id = {{p:String}} "
                f"ORDER BY scene_num, frame_num",
                params,
            ).get("data", []):
                saved_sbs.setdefault(str(row[0]), []).append(
                    {
                        "id": f"f-{row[0]}-{row[1]}",
                        "frameNum": int(row[1]),
                        "title": row[2],
                        "cameraSpec": row[3],
                        "startSec": int(row[4]),
                        "endSec": int(row[5]),
                        "prompt": row[6],
                        "imgUrl": row[7],
                        "isPlaceholder": bool(row[8]) if len(row) > 8 else False,
                        "timing": f"{int(row[4]) // 60:02d}:{int(row[4]) % 60:02d} - "
                                  f"{int(row[5]) // 60:02d}:{int(row[5]) % 60:02d}",
                    }
                )

            scenes = []
            for r in result.get("data", []):
                scene_number = str(r[0])
                num = scene_number.replace("SC-", "").replace("SCENE ", "")
                short = (re.sub(r"\D", "", num) or "1").zfill(2)[-2:]
                int_ext, loc, tod, pg = r[1], r[2], r[3], float(r[4])
                status = r[6]

                elements = elements_by_scene.get(scene_number, [])
                buckets = {"prop": [], "wardrobe": [], "vfx": [], "sfx": []}
                risky = 0.0
                for etype, name, cost in elements:
                    key = str(etype).lower()
                    if key in ("stunt", "vehicle", "animal"):
                        risky += float(cost or 0)
                        key = "prop"
                    buckets.setdefault(key if key in buckets else "prop", []).append(str(name))
                    if key in ("vfx", "sfx"):
                        risky += float(cost or 0)

                if status == "vfx_required" or risky > 5000:
                    risk, risk_note = "high", f"${risky:,.0f} in VFX/SFX/stunt elements"
                elif risky > 500 or (int_ext == "EXT" and tod == "NIGHT"):
                    risk, risk_note = "med", "Night exterior or paid effects work"
                else:
                    risk, risk_note = "low", "No risk flags"

                scenes.append(
                    {
                        "sceneNum": short,
                        "sceneNumber": scene_number,
                        "slugline": f"{int_ext}. {str(loc).upper()} — {tod}",
                        "desc": r[7] if len(r) > 7 and r[7] else f"Scene {num} in {loc}",
                        "pageCount": pg,
                        "shootDay": int(r[5] or 1),
                        "status": status,
                        "risk": risk,
                        "riskNote": risk_note,
                        "cast": [c[0] for c in cast_by_scene.get(scene_number, [])],
                        "props": buckets["prop"],
                        "ward": buckets["wardrobe"],
                        "vfx": buckets["vfx"],
                        "sfx": buckets["sfx"],
                        "shotCount": len(shots_by_scene.get(scene_number, [])),
                        "sceneText": r[8] if len(r) > 8 else "",
                        "totalDurationSec": int(pg * 60) if pg > 0 else 18,
                        "recommendedIntervalSec": 5 if pg <= 0.5 else 8,
                        "frames": saved_sbs.get(short, []),
                    }
                )
            json_resp(self, {"status": "ok", "scenes": scenes})
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_ch_shots(self):
        proj_id = self._require_project_id_param()
        if proj_id is None:
            return
        if not self._require_project_access(proj_id):
            return
        try:
            result = ch_query(
                f"SELECT sh.shot_code, sh.scene_id, sh.framing, sh.movement, sh.lens_mm, "
                f"sh.description, sh.status, sc.scene_number "
                f"FROM (SELECT * FROM {CH_DB}.shots FINAL WHERE project_id = {{p:String}}) AS sh "
                f"LEFT JOIN (SELECT scene_id, scene_number FROM {CH_DB}.scenes FINAL "
                f"           WHERE project_id = {{p:String}}) AS sc ON sh.scene_id = sc.scene_id "
                f"ORDER BY sc.scene_number, sh.shot_code",
                params={"p": proj_id},
            )
            shots = []
            for idx, r in enumerate(result.get("data", []), start=1):
                code = str(r[0])
                digits = re.sub(r"\D", "", str(r[7]) if len(r) > 7 and r[7] else code)
                scene_num = (digits or "1").zfill(2)[-2:]
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
        proj_id = self._require_project_id_param()
        if proj_id is None:
            return
        if not self._require_project_access(proj_id):
            return
        try:
            result = ch_query(
                f"SELECT b.item_id, b.category, b.description, b.budgeted_usd, b.actual_usd, "
                f"s.scene_number "
                f"FROM (SELECT * FROM {CH_DB}.budget_items FINAL WHERE project_id = {{p:String}}) AS b "
                f"LEFT JOIN (SELECT scene_id, scene_number FROM {CH_DB}.scenes FINAL "
                f"           WHERE project_id = {{p:String}}) AS s ON b.scene_id = s.scene_id "
                f"ORDER BY b.category, b.item_id",
                params={"p": proj_id},
            )
            items = []
            for r in result.get("data", []):
                budgeted = float(r[3])
                actual = float(r[4]) if len(r) > 4 else 0.0
                scene_number = str(r[5]) if len(r) > 5 and r[5] else None
                items.append(
                    {
                        "id": f"b{r[0]}",
                        "acct": f"{1000 + int(r[0])}",
                        "category": str(r[1]),
                        "desc": str(r[2]),
                        "estimated": actual if actual > 0 else budgeted,
                        "cap": budgeted,
                        "status": "over" if actual > budgeted else "ok",
                        "sceneNumber": scene_number,
                    }
                )
            # Full scene list, not just the numbers that happen to have a budget
            # row today — a scene with zero AI-derived cost lines still needs to
            # be pickable in the frontend's scene filter.
            scene_rows = ch_query(
                f"SELECT scene_number FROM {CH_DB}.scenes FINAL WHERE project_id = {{p:String}} "
                f"ORDER BY scene_number",
                params={"p": proj_id},
            ).get("data", [])
            all_scenes = [str(r[0]) for r in scene_rows]
            json_resp(self, {"status": "ok", "budget": items, "scenes": all_scenes})
        except Exception as exc:
            json_resp(self, {"status": "error", "error": str(exc)}, 500)

    def _handle_ch_stats(self):
        proj_id = self._require_project_id_param()
        if proj_id is None:
            return
        if not self._require_project_access(proj_id):
            return
        try:
            stats = {}
            proj = {"p": proj_id}
            scoped = f"FINAL WHERE project_id = {{p:String}}"
            r1 = ch_query(
                f"SELECT sum(budgeted_usd), sum(actual_usd) FROM {CH_DB}.budget_items {scoped}", proj
            )
            stats["total_budgeted"] = r1["data"][0][0] if r1["data"] else 0
            stats["total_actual"] = r1["data"][0][1] if r1["data"] else 0

            r2 = ch_query(f"SELECT count() FROM {CH_DB}.scenes {scoped}", proj)
            stats["total_scenes"] = r2["data"][0][0] if r2["data"] else 0

            r3 = ch_query(f"SELECT count() FROM {CH_DB}.cast_members {scoped}", proj)
            stats["total_cast"] = r3["data"][0][0] if r3["data"] else 0

            r4 = ch_query(f"SELECT count() FROM {CH_DB}.shots {scoped}", proj)
            stats["total_shots"] = r4["data"][0][0] if r4["data"] else 0

            r5 = ch_query(
                f"SELECT category, sum(budgeted_usd) AS spend FROM {CH_DB}.budget_items {scoped} "
                f"GROUP BY category ORDER BY spend DESC",
                proj,
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
    ensure_storyboards_schema()
    ensure_budget_items_schema()
    ch_live = ch_ping()
    # Threaded: an agent ingest can run for minutes on a background thread while
    # the browser polls /api/jobs. A single-threaded server would block the poll
    # behind the very work it is polling for.
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    socketserver.ThreadingTCPServer.daemon_threads = True
    with socketserver.ThreadingTCPServer(("", PORT), StudioRequestHandler) as httpd:
        print("\n🎬 CinemaLit Studio — AI-Native Command Center")
        print(f"   👉  http://localhost:{PORT}")
        print(f"   🤖  Gemini API:   {'CONNECTED (' + _active_model() + ')' if genai_client else 'OFFLINE'}")
        print(f"   🎬  Director Agent: {'ON (ADK)' if USE_ADK_AGENT else 'OFF (direct Gemini calls)'}")
        print(f"   🗄️   ClickHouse:   {'CONNECTED — ' + CH_DB if ch_live else 'OFFLINE (run: docker compose up -d)'}")
        print(f"   🔑  Google Client ID: {'…' + GOOGLE_CLIENT_ID[-16:] if GOOGLE_CLIENT_ID else 'NOT SET (Google sign-in disabled)'}")
        print("   🎯  Hackathon:    Agentic Cinema — ClickHouse Track\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")


if __name__ == "__main__":
    main()
