"""JWT and password helpers for CinemaLit Studio web auth."""

import base64
import datetime
import hashlib
import hmac
import json
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional

JWT_SECRET = os.getenv("JWT_SECRET", "")
if not JWT_SECRET:
    JWT_SECRET = secrets.token_hex(32)
    print("⚠️  JWT_SECRET not set — using ephemeral secret (tokens invalid after restart).")

PBKDF2_ITERATIONS = 100_000


def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS
    ).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    if not stored or "$" not in stored:
        # Legacy SHA256 hashes (pre-migration)
        return hashlib.sha256(password.encode()).hexdigest() == stored
    salt, expected = stored.split("$", 1)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS
    ).hex()
    return hmac.compare_digest(digest, expected)


def create_jwt(user_id: str, email: str, name: str, role: str) -> str:
    header = base64.urlsafe_b64encode(
        json.dumps({"alg": "HS256", "typ": "JWT"}).encode()
    ).decode().rstrip("=")
    exp = int((utc_now() + datetime.timedelta(days=7)).timestamp())
    payload_data = {"sub": user_id, "email": email, "name": name, "role": role, "exp": exp}
    payload = base64.urlsafe_b64encode(json.dumps(payload_data).encode()).decode().rstrip("=")
    signature = hmac.new(
        JWT_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256
    ).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{header}.{payload}.{sig_b64}"


def verify_jwt(token: str) -> dict:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return {}
        header, payload, sig = parts
        expected_sig = base64.urlsafe_b64encode(
            hmac.new(
                JWT_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256
            ).digest()
        ).decode().rstrip("=")
        if not hmac.compare_digest(sig, expected_sig):
            return {}
        padding = "=" * (4 - len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload + padding).decode())
        if data.get("exp", 0) < utc_now().timestamp():
            return {}
        return data
    except Exception:
        return {}


def verify_google_id_token(id_token: str) -> Optional[Dict[str, Any]]:
    """Verify Google OAuth ID token via tokeninfo endpoint."""
    if not id_token:
        return None
    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={urllib.parse.quote(id_token)}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if data.get("email_verified") not in (True, "true"):
            return None
        return {
            "email": data.get("email", "").lower(),
            "name": data.get("name", "Executive Producer"),
            "picture": data.get("picture", ""),
            "sub": data.get("sub", ""),
        }
    except (urllib.error.URLError, json.JSONDecodeError, KeyError):
        return None
