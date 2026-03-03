"""
DB-backed QA failure tracking — replaces GitHub issues as signal mechanism.

All functions read DATABASE_URL from os.environ.
psycopg2 is used for direct Postgres access (no ORM).
All functions are best-effort: catch exceptions, print warning, return safe default.
"""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone

try:
    import psycopg2
    import psycopg2.extras
    _PSYCOPG2_AVAILABLE = True
except ImportError:
    _PSYCOPG2_AVAILABLE = False


def _connect():
    if not _PSYCOPG2_AVAILABLE:
        print("[db_failures] psycopg2 not available")
        return None
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("[db_failures] DATABASE_URL not set")
        return None
    try:
        conn = psycopg2.connect(url)
        conn.autocommit = True
        return conn
    except Exception as e:
        print(f"[db_failures] connection failed: {e}")
        return None


def create_failure(scenario_id: str, spec_file: str, cycle: int, error: str | None) -> str | None:
    conn = _connect()
    if conn is None:
        return None
    try:
        failure_id = "c" + secrets.token_hex(11)
        now = datetime.now(timezone.utc)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO "QaFailure"
                    (id, "scenarioId", "specFile", cycle, "lastError", status, "fixAttempts", "createdAt", "updatedAt")
                VALUES
                    (%s, %s, %s, %s, %s, 'open', 0, %s, %s)
                """,
                (failure_id, scenario_id, spec_file, cycle, error, now, now),
            )
        return failure_id
    except Exception as e:
        print(f"[db_failures] create_failure failed: {e}")
        return None
    finally:
        conn.close()


def close_failure(failure_id: str, comment: str | None = None) -> bool:
    conn = _connect()
    if conn is None:
        return False
    try:
        now = datetime.now(timezone.utc)
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE "QaFailure"
                SET status='fixed', "updatedAt"=%s
                WHERE id=%s
                """,
                (now, failure_id),
            )
        return True
    except Exception as e:
        print(f"[db_failures] close_failure failed: {e}")
        return False
    finally:
        conn.close()


def get_open_failures() -> list[dict]:
    conn = _connect()
    if conn is None:
        return []
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, "scenarioId", "specFile", cycle, "lastError", "fixAttempts", "createdAt"
                FROM "QaFailure"
                WHERE status IN ('open', 'fixing')
                ORDER BY "createdAt" ASC
                """
            )
            rows = cur.fetchall()
        result = []
        for row in rows:
            result.append({
                "id": row["id"],
                "scenarioId": row["scenarioId"],
                "specFile": row["specFile"],
                "cycle": row["cycle"],
                "lastError": row["lastError"],
                "fixAttempts": row["fixAttempts"],
                "createdAt": row["createdAt"].isoformat() if row["createdAt"] else None,
            })
        return result
    except Exception as e:
        print(f"[db_failures] get_open_failures failed: {e}")
        return []
    finally:
        conn.close()


def mark_fixing(failure_id: str) -> bool:
    conn = _connect()
    if conn is None:
        return False
    try:
        now = datetime.now(timezone.utc)
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE "QaFailure"
                SET status='fixing', "updatedAt"=%s
                WHERE id=%s
                """,
                (now, failure_id),
            )
        return True
    except Exception as e:
        print(f"[db_failures] mark_fixing failed: {e}")
        return False
    finally:
        conn.close()


def update_fix_attempt(failure_id: str, branch: str | None = None, pr_url: str | None = None) -> bool:
    conn = _connect()
    if conn is None:
        return False
    try:
        now = datetime.now(timezone.utc)
        parts = ['"fixAttempts"="fixAttempts"+1', '"updatedAt"=%s']
        params: list = [now]
        if branch is not None:
            parts.append("branch=%s")
            params.append(branch)
        if pr_url is not None:
            parts.append('"prUrl"=%s')
            params.append(pr_url)
        params.append(failure_id)
        sql = f'UPDATE "QaFailure" SET {", ".join(parts)} WHERE id=%s'
        with conn.cursor() as cur:
            cur.execute(sql, params)
        return True
    except Exception as e:
        print(f"[db_failures] update_fix_attempt failed: {e}")
        return False
    finally:
        conn.close()


def mark_escalated(failure_id: str) -> bool:
    conn = _connect()
    if conn is None:
        return False
    try:
        now = datetime.now(timezone.utc)
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE "QaFailure"
                SET status='escalated', "updatedAt"=%s
                WHERE id=%s
                """,
                (now, failure_id),
            )
        return True
    except Exception as e:
        print(f"[db_failures] mark_escalated failed: {e}")
        return False
    finally:
        conn.close()


def get_failure_by_scenario(scenario_id: str) -> dict | None:
    conn = _connect()
    if conn is None:
        return None
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, "scenarioId", "specFile", cycle, "lastError", "fixAttempts", "createdAt"
                FROM "QaFailure"
                WHERE "scenarioId"=%s AND status IN ('open', 'fixing')
                ORDER BY "createdAt" DESC
                LIMIT 1
                """,
                (scenario_id,),
            )
            row = cur.fetchone()
        if row is None:
            return None
        return {
            "id": row["id"],
            "scenarioId": row["scenarioId"],
            "specFile": row["specFile"],
            "cycle": row["cycle"],
            "lastError": row["lastError"],
            "fixAttempts": row["fixAttempts"],
            "createdAt": row["createdAt"].isoformat() if row["createdAt"] else None,
        }
    except Exception as e:
        print(f"[db_failures] get_failure_by_scenario failed: {e}")
        return None
    finally:
        conn.close()
