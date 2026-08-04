"""ClickHouse client helpers with parameterized queries."""

import base64
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional

CH_HOST = os.getenv("CLICKHOUSE_HOST", "localhost")
CH_PORT = int(os.getenv("CLICKHOUSE_PORT", "8123"))
CH_USER = os.getenv("CLICKHOUSE_USER", "default")
CH_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "")
CH_DB = os.getenv("CLICKHOUSE_DATABASE") or os.getenv("CLICKHOUSE_DB", "cinemalit")
CH_BASE_URL = f"http://{CH_HOST}:{CH_PORT}"


def _auth_header() -> str:
    creds = base64.b64encode(f"{CH_USER}:{CH_PASSWORD}".encode()).decode()
    return f"Basic {creds}"


def ch_post_query(sql: str) -> dict:
    req = urllib.request.Request(
        f"{CH_BASE_URL}/?database={urllib.parse.quote(CH_DB)}",
        data=sql.encode("utf-8"),
        headers={"Authorization": _auth_header()},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return {"status": "ok", "raw": resp.read().decode("utf-8")}


def ch_query(sql: str, params: Optional[Dict[str, Any]] = None, fmt: str = "JSONCompact") -> dict:
    """Execute ClickHouse SQL. Use {name:Type} placeholders + params dict for safe queries."""
    stripped = sql.strip()
    query_params: Dict[str, Any] = {
        "database": CH_DB,
        "output_format_json_quote_64bit_integers": 0,
    }
    if not stripped.upper().startswith(("INSERT", "CREATE", "ALTER", "DROP")):
        query_params["query"] = stripped
        post_data = None
    else:
        post_data = stripped.encode("utf-8")

    if params:
        for k, v in params.items():
            query_params[f"param_{k}"] = str(v)

    if not post_data and not stripped.upper().endswith(f"FORMAT {fmt}"):
        query_params["query"] = f"{stripped} FORMAT {fmt}"

    url = f"{CH_BASE_URL}/?" + urllib.parse.urlencode(query_params)
    req = urllib.request.Request(
        url,
        data=post_data,
        headers={"Authorization": _auth_header()},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        body = resp.read().decode("utf-8")
        if not body.strip():
            return {"status": "ok", "data": [], "meta": [], "rows": 0}
        try:
            return json.loads(body)
        except Exception:
            return {"status": "ok", "raw": body}


def ch_ping() -> bool:
    try:
        req = urllib.request.Request(
            f"{CH_BASE_URL}/ping",
            headers={"Authorization": _auth_header()},
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False


def ch_escape(value: str) -> str:
    """Escape string literals for legacy INSERT statements."""
    return value.replace("\\", "\\\\").replace("'", "\\'")
