"""JWT and password helpers for CinemaLit Studio web auth."""

import base64
import datetime
import hashlib
import hmac
import json
import os
import secrets
import sys
from typing import Any, Dict, Optional

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

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


GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


def verify_google_id_token(credential: str) -> Optional[Dict[str, Any]]:
    """Verify a Google Sign-In ID token: signature, issuer, expiry, and audience."""
    if not credential or not GOOGLE_CLIENT_ID:
        return None
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    try:
        data = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), audience=GOOGLE_CLIENT_ID
        )
        if data.get("email_verified") not in (True, "true"):
            return None
        return {
            "email": data.get("email", "").lower(),
            "name": data.get("name", "Executive Producer"),
            "picture": data.get("picture", ""),
            "sub": data.get("sub", ""),
        }
    except Exception as exc:
        print(f"⚠️  Google ID token verification failed: {exc}")
        return None
