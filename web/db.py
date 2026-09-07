"""ClickHouse client helpers with parameterized queries."""

import base64
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional

CH_HOST = os.getenv("CLICKHOUSE_HOST", "localhost")
# Same convention as the official mcp-clickhouse server: secure defaults false
# for local Docker (unchanged behavior); set CLICKHOUSE_SECURE=true for
# ClickHouse Cloud or any other HTTPS-only endpoint. Port follows the same
# default-by-security convention mcp-clickhouse uses (8443 secure, 8123 not),
# but an explicit CLICKHOUSE_PORT always wins.
CH_SECURE = os.getenv("CLICKHOUSE_SECURE", "false").lower() in ("1", "true", "yes")
CH_PORT = int(os.getenv("CLICKHOUSE_PORT") or (8443 if CH_SECURE else 8123))
CH_USER = os.getenv("CLICKHOUSE_USER", "default")
CH_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "")
CH_DB = os.getenv("CLICKHOUSE_DATABASE") or os.getenv("CLICKHOUSE_DB", "cinemalit")
CH_BASE_URL = f"{'https' if CH_SECURE else 'http'}://{CH_HOST}:{CH_PORT}"


def _auth_header() -> str:
    creds = base64.b64encode(f"{CH_USER}:{CH_PASSWORD}".encode()).decode()
    return f"Basic {creds}"


# ClickHouse reads {name:Type} query parameters in its Escaped format, where a
# raw newline or tab ENDS the value — a multi-line string silently truncates
# (or errors with BAD_QUERY_PARAMETER), and a lone backslash eats the next
# character. Escape them on the way out; ClickHouse unescapes on the way in.
_PARAM_ESCAPES = str.maketrans(
    {"\\": "\\\\", "\n": "\\n", "\t": "\\t", "\r": "\\r", "\0": "\\0"}
)


def _escape_param(value: Any) -> str:
    if isinstance(value, str):
        return value.translate(_PARAM_ESCAPES)
    return str(value)


def ch_post_query(sql: str) -> dict:
    req = urllib.request.Request(
        f"{CH_BASE_URL}/?database={urllib.parse.quote(CH_DB)}",
        data=sql.encode("utf-8"),
        headers={"Authorization": _auth_header()},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return {"status": "ok", "raw": resp.read().decode("utf-8")}


def _urlopen_retry(req, attempts: int = 3) -> str:
    """ClickHouse Cloud suspends when idle; the first queries after a resume
    come back 5xx or time out. Retry those — a client error (4xx) is ours and
    never retried."""
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            if exc.code < 500 or attempt == attempts - 1:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == attempts - 1:
                raise
        time.sleep(2 * (attempt + 1))
    raise RuntimeError("unreachable")


def ch_query(sql: str, params: Optional[Dict[str, Any]] = None, fmt: str = "JSONCompact") -> dict:
    """Execute ClickHouse SQL. Use {name:Type} placeholders + params dict for safe queries."""
    stripped = sql.strip()
    query_params: Dict[str, Any] = {
        "database": CH_DB,
        "output_format_json_quote_64bit_integers": 0,
    }
    # Statements that return no result set must not get a FORMAT clause appended.
    if not stripped.upper().startswith(
        ("INSERT", "CREATE", "ALTER", "DROP", "DELETE", "TRUNCATE", "OPTIMIZE", "RENAME")
    ):
        query_params["query"] = stripped
        post_data = None
    else:
        post_data = stripped.encode("utf-8")

    if params:
        for k, v in params.items():
            query_params[f"param_{k}"] = _escape_param(v)

    if not post_data and not stripped.upper().endswith(f"FORMAT {fmt}"):
        query_params["query"] = f"{stripped} FORMAT {fmt}"

    url = f"{CH_BASE_URL}/?" + urllib.parse.urlencode(query_params)
    req = urllib.request.Request(
        url,
        data=post_data,
        headers={"Authorization": _auth_header()},
    )
    try:
        body = _urlopen_retry(req)
    except urllib.error.HTTPError as exc:
        # ClickHouse puts the actual reason in the response body; without this
        # every failure surfaces to callers as a bare "HTTP Error 500".
        detail = exc.read().decode("utf-8", "replace").strip()
        raise urllib.error.HTTPError(
            exc.url, exc.code, f"{exc.reason}: {detail[:800]}", exc.headers, None
        ) from None

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
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception:
        return False


def ch_escape(value: str) -> str:
    """Escape string literals for legacy INSERT statements."""
    return value.replace("\\", "\\\\").replace("'", "\\'")
