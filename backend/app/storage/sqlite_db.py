"""Operational SQLite Database Manager.

Operates in WAL (Write-Ahead Logging) mode on local NVMe SSD to provide:
1. Sub-millisecond reads and writes.
2. Atomic multi-table transactions for note updates and sync deltas.
3. FTS5 BM25 keyword search.
4. Complete isolation per tenant via paths.py.
"""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator
import json
import uuid
import aiosqlite
import logging

from app.core.config import settings
from app.storage.paths import get_sqlite_path

logger = logging.getLogger("scribex.sqlite_db")

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "db" / "schemas.sql"


@asynccontextmanager
async def get_db_connection(user_id: str = settings.default_user_id) -> AsyncGenerator[aiosqlite.Connection, None]:
    """Provide an async SQLite connection configured with WAL and busy timeout."""
    db_path = get_sqlite_path(user_id)
    async with aiosqlite.connect(str(db_path)) as conn:
        conn.row_factory = aiosqlite.Row
        # High-performance WAL Pragmas
        await conn.execute("PRAGMA journal_mode = WAL;")
        await conn.execute("PRAGMA synchronous = NORMAL;")
        await conn.execute("PRAGMA foreign_keys = ON;")
        await conn.execute("PRAGMA busy_timeout = 5000;")
        yield conn


async def init_db(user_id: str = settings.default_user_id) -> None:
    """Initialize all SQLite tables and triggers from schemas.sql for a tenant."""
    if not SCHEMA_PATH.exists():
        raise FileNotFoundError(f"Schema file not found at {SCHEMA_PATH}")

    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    async with get_db_connection(user_id) as conn:
        await conn.executescript(schema_sql)
        await conn.commit()
    logger.info(f"Initialized SQLite database for user '{user_id}' at: {get_sqlite_path(user_id)}")


# ==============================================================================
# Sync Revision Helper
# ==============================================================================


async def _increment_sync_rev(conn: aiosqlite.Connection, user_id: str) -> int:
    """Atomically increment and return the next sync_rev for a user."""
    cursor = await conn.execute(
        "SELECT current_sync_rev FROM user_sync_meta WHERE user_id = ?",
        (user_id,),
    )
    row = await cursor.fetchone()

    if row is None:
        new_rev = 1
        await conn.execute(
            "INSERT INTO user_sync_meta (user_id, current_sync_rev, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
            (user_id, new_rev),
        )
    else:
        new_rev = row["current_sync_rev"] + 1
        await conn.execute(
            "UPDATE user_sync_meta SET current_sync_rev = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
            (new_rev, user_id),
        )

    return new_rev


async def get_current_sync_rev(user_id: str = settings.default_user_id) -> int:
    """Return the current sync_rev for a user without incrementing."""
    async with get_db_connection(user_id) as conn:
        cursor = await conn.execute(
            "SELECT current_sync_rev FROM user_sync_meta WHERE user_id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
        return row["current_sync_rev"] if row else 0


# ==============================================================================
# Note CRUD Operations (Atomic with sync_changelog)
# ==============================================================================


async def save_note(
    user_id: str,
    group_name: str,
    title: str,
    content_markdown: str,
    priority_score: float = 0.5,
    note_id: str | None = None,
) -> dict[str, Any]:
    """Create or update a note in an atomic transaction that logs an incremental sync delta."""
    if not note_id:
        note_id = f"note_{uuid.uuid4().hex[:12]}"

    async with get_db_connection(user_id) as conn:
        # Check if note already exists
        cursor = await conn.execute(
            "SELECT id, sync_rev FROM notes WHERE id = ? AND user_id = ?",
            (note_id, user_id),
        )
        existing_note = await cursor.fetchone()

        new_rev = await _increment_sync_rev(conn, user_id)
        change_type = "UPDATE" if existing_note else "INSERT"

        if existing_note:
            await conn.execute(
                """
                UPDATE notes
                SET group_name = ?, title = ?, content_markdown = ?, priority_score = ?, sync_rev = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
                """,
                (group_name, title, content_markdown, priority_score, new_rev, note_id, user_id),
            )
        else:
            await conn.execute(
                """
                INSERT INTO notes (id, user_id, group_name, title, content_markdown, priority_score, sync_rev, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (note_id, user_id, group_name, title, content_markdown, priority_score, new_rev),
            )

        # Record event in sync_changelog
        delta_payload = {
            "id": note_id,
            "group_name": group_name,
            "title": title,
            "content_markdown": content_markdown,
            "priority_score": priority_score,
            "sync_rev": new_rev,
        }

        await conn.execute(
            """
            INSERT INTO sync_changelog (user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
            VALUES (?, ?, 'note', ?, ?, ?)
            """,
            (user_id, new_rev, note_id, change_type, json.dumps(delta_payload)),
        )

        await conn.commit()

        # Fetch created/updated note
        cursor = await conn.execute(
            "SELECT * FROM notes WHERE id = ? AND user_id = ?",
            (note_id, user_id),
        )
        row = await cursor.fetchone()
        return dict(row) if row else delta_payload


async def get_note_by_id(user_id: str, note_id: str) -> dict[str, Any] | None:
    """Retrieve a single note by ID for a specific user."""
    async with get_db_connection(user_id) as conn:
        cursor = await conn.execute(
            "SELECT * FROM notes WHERE id = ? AND user_id = ?",
            (note_id, user_id),
        )
        row = await cursor.fetchone()
        return dict(row) if row else None


async def list_notes(
    user_id: str,
    group_name: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """List notes for a user, optionally filtered by group_name, sorted by priority."""
    async with get_db_connection(user_id) as conn:
        if group_name:
            cursor = await conn.execute(
                "SELECT * FROM notes WHERE user_id = ? AND group_name = ? ORDER BY priority_score DESC, updated_at DESC LIMIT ?",
                (user_id, group_name, limit),
            )
        else:
            cursor = await conn.execute(
                "SELECT * FROM notes WHERE user_id = ? ORDER BY priority_score DESC, updated_at DESC LIMIT ?",
                (user_id, limit),
            )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def delete_note(user_id: str, note_id: str) -> bool:
    """Delete a note and record the deletion in sync_changelog."""
    async with get_db_connection(user_id) as conn:
        cursor = await conn.execute(
            "SELECT id FROM notes WHERE id = ? AND user_id = ?",
            (note_id, user_id),
        )
        existing = await cursor.fetchone()
        if not existing:
            return False

        new_rev = await _increment_sync_rev(conn, user_id)

        await conn.execute(
            "DELETE FROM notes WHERE id = ? AND user_id = ?",
            (note_id, user_id),
        )

        await conn.execute(
            """
            INSERT INTO sync_changelog (user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
            VALUES (?, ?, 'note', ?, 'DELETE', ?)
            """,
            (user_id, new_rev, note_id, json.dumps({"id": note_id, "deleted": True})),
        )

        await conn.commit()
        return True


# ==============================================================================
# Delta Sync Changelog Retrieval
# ==============================================================================


async def get_deltas_since(user_id: str, since_rev: int) -> list[dict[str, Any]]:
    """Fetch all changelog deltas for a user where sync_rev > since_rev."""
    async with get_db_connection(user_id) as conn:
        cursor = await conn.execute(
            """
            SELECT id, sync_rev, entity_type, entity_id, change_type, delta_payload, created_at
            FROM sync_changelog
            WHERE user_id = ? AND sync_rev > ?
            ORDER BY sync_rev ASC
            """,
            (user_id, since_rev),
        )
        rows = await cursor.fetchall()
        deltas = []
        for r in rows:
            d = dict(r)
            d["delta_payload"] = json.loads(d["delta_payload"])
            deltas.append(d)
        return deltas


# ==============================================================================
# Entity Relationship Graph (Layer 2 Memory)
# ==============================================================================


async def add_edge(
    user_id: str,
    source_id: str,
    relation_type: str,
    target_id: str,
    edge_id: str | None = None,
) -> dict[str, Any]:
    """Add a bidirectional or directional semantic connection between two entities."""
    if not edge_id:
        edge_id = f"edge_{uuid.uuid4().hex[:12]}"

    async with get_db_connection(user_id) as conn:
        await conn.execute(
            """
            INSERT INTO entity_edges (id, user_id, source_id, relation_type, target_id, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (edge_id, user_id, source_id, relation_type, target_id),
        )
        await conn.commit()

        cursor = await conn.execute(
            "SELECT * FROM entity_edges WHERE id = ? AND user_id = ?",
            (edge_id, user_id),
        )
        row = await cursor.fetchone()
        return dict(row)


async def get_connected_edges(user_id: str, entity_id: str) -> list[dict[str, Any]]:
    """Retrieve all graph edges where entity_id is either source or target."""
    async with get_db_connection(user_id) as conn:
        cursor = await conn.execute(
            """
            SELECT * FROM entity_edges
            WHERE user_id = ? AND (source_id = ? OR target_id = ?)
            ORDER BY created_at DESC
            """,
            (user_id, entity_id, entity_id),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


# ==============================================================================
# Temporal Timeline (Layer 3 "Versions of Me")
# ==============================================================================


async def record_timeline_event(
    user_id: str,
    attribute: str,
    old_value: str | None,
    new_value: str,
    change_reason: str | None = None,
    git_commit_sha: str | None = None,
    event_id: str | None = None,
) -> dict[str, Any]:
    """Log an evolution milestone or personal transition into the immutable timeline."""
    if not event_id:
        event_id = f"time_{uuid.uuid4().hex[:12]}"

    async with get_db_connection(user_id) as conn:
        await conn.execute(
            """
            INSERT INTO identity_timeline (id, user_id, attribute, old_value, new_value, change_reason, git_commit_sha, valid_from)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (event_id, user_id, attribute, old_value, new_value, change_reason, git_commit_sha),
        )
        await conn.commit()

        cursor = await conn.execute(
            "SELECT * FROM identity_timeline WHERE id = ? AND user_id = ?",
            (event_id, user_id),
        )
        row = await cursor.fetchone()
        return dict(row)


async def get_timeline(
    user_id: str,
    attribute: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Retrieve historical evolution log for a user, optionally filtered by attribute."""
    async with get_db_connection(user_id) as conn:
        if attribute:
            cursor = await conn.execute(
                "SELECT * FROM identity_timeline WHERE user_id = ? AND attribute = ? ORDER BY valid_from DESC LIMIT ?",
                (user_id, attribute, limit),
            )
        else:
            cursor = await conn.execute(
                "SELECT * FROM identity_timeline WHERE user_id = ? ORDER BY valid_from DESC LIMIT ?",
                (user_id, limit),
            )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


# ==============================================================================
# Full-Text Search (FTS5 BM25 Keyword Search)
# ==============================================================================


async def search_notes_fts(
    user_id: str,
    query_term: str,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Search notes using SQLite FTS5 BM25 ranking."""
    # Clean query term for FTS5 (avoid syntax errors with special chars)
    sanitized = "".join(c for c in query_term if c.isalnum() or c.isspace()).strip()
    if not sanitized:
        return []

    fts_query = f"{sanitized}*"

    async with get_db_connection(user_id) as conn:
        cursor = await conn.execute(
            """
            SELECT n.id, n.group_name, n.title, n.content_markdown, n.priority_score, n.updated_at,
                   bm25(notes_fts) as rank,
                   snippet(notes_fts, 3, '<b>', '</b>', '...', 15) as snippet
            FROM notes_fts f
            JOIN notes n ON f.note_id = n.id AND f.user_id = n.user_id
            WHERE notes_fts MATCH ? AND f.user_id = ?
            ORDER BY rank
            LIMIT ?
            """,
            (fts_query, user_id, limit),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


# ==============================================================================
# Staging Intake (Ambiguity Gate Staging Table)
# ==============================================================================


async def save_staging_intake(
    user_id: str,
    raw_input: str,
    clarity_score: float,
    clarifying_questions: list[str],
    proposed_action: str | None = None,
    status: str = "PENDING_CLARIFICATION",
    staging_id: str | None = None,
) -> dict[str, Any]:
    """Save an ambiguous raw input into the staging intake table."""
    sid = staging_id or str(uuid.uuid4())
    questions_json = json.dumps(clarifying_questions)

    async with get_db_connection(user_id) as conn:
        await conn.execute(
            """
            INSERT INTO staging_intake (id, user_id, raw_input, clarity_score, clarifying_questions, proposed_action, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                raw_input = excluded.raw_input,
                clarity_score = excluded.clarity_score,
                clarifying_questions = excluded.clarifying_questions,
                proposed_action = excluded.proposed_action,
                status = excluded.status
            """,
            (sid, user_id, raw_input, clarity_score, questions_json, proposed_action, status),
        )
        await conn.commit()

        cursor = await conn.execute(
            "SELECT * FROM staging_intake WHERE id = ? AND user_id = ?",
            (sid, user_id),
        )
        row = await cursor.fetchone()
        res = dict(row)
        res["clarifying_questions"] = json.loads(res["clarifying_questions"])
        return res


async def get_staging_intake(user_id: str, staging_id: str) -> dict[str, Any] | None:
    """Retrieve a staged ambiguous intake item by ID."""
    async with get_db_connection(user_id) as conn:
        cursor = await conn.execute(
            "SELECT * FROM staging_intake WHERE id = ? AND user_id = ?",
            (staging_id, user_id),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        res = dict(row)
        res["clarifying_questions"] = json.loads(res["clarifying_questions"])
        return res


async def update_staging_status(
    user_id: str,
    staging_id: str,
    status: str,
) -> bool:
    """Update status of a staged intake item (e.g. 'RESOLVED', 'DISCARDED')."""
    async with get_db_connection(user_id) as conn:
        cursor = await conn.execute(
            "UPDATE staging_intake SET status = ? WHERE id = ? AND user_id = ?",
            (status, staging_id, user_id),
        )
        await conn.commit()
        return cursor.rowcount > 0


async def list_staging_intakes(
    user_id: str,
    status: str = "PENDING_CLARIFICATION",
    limit: int = 20,
) -> list[dict[str, Any]]:
    """List staged intake records filtered by status."""
    async with get_db_connection(user_id) as conn:
        cursor = await conn.execute(
            """
            SELECT * FROM staging_intake
            WHERE user_id = ? AND status = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (user_id, status, limit),
        )
        rows = await cursor.fetchall()
        result = []
        for r in rows:
            item = dict(r)
            item["clarifying_questions"] = json.loads(item["clarifying_questions"])
            result.append(item)
        return result
