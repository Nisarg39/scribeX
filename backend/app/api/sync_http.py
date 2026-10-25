"""HTTP REST Delta Sync Endpoints (Push & Pull Catch-Up).

Provides:
1. GET /api/v1/sync/deltas?since_rev=X: Ordered array of changelog deltas where sync_rev > X.
2. POST /api/v1/sync/pull: JSON body variant for state reconciliation.
3. POST /api/v1/sync/push: Ingests client-originated offline mutations, writes to SQLite,
   projects to Markdown Git Vault, indexes in LanceDB, and broadcasts the WebSocket Doorbell SYNC_PING.
"""

from typing import Any, Literal
import logging
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.api.deps import get_current_user_id
from app.api.sync_ws import ws_manager
from app.storage.sqlite_db import get_current_sync_rev, get_deltas_since
from app.storage.sync_projector import save_and_project_note, delete_and_project_note
from app.storage.lancedb_store import index_note_chunks

logger = logging.getLogger("scribex.sync_http")

router = APIRouter(prefix="/api/v1/sync", tags=["Sync"])


# ==============================================================================
# Pydantic Schemas
# ==============================================================================


class DeltaItem(BaseModel):
    """Serialized changelog entry."""

    id: int
    sync_rev: int
    entity_type: str
    entity_id: str
    change_type: str
    delta_payload: dict[str, Any]
    created_at: str


class SyncDeltasResponse(BaseModel):
    """Response returned when fetching incremental sync deltas."""

    user_id: str
    since_rev: int
    current_sync_rev: int
    delta_count: int
    deltas: list[dict[str, Any]]


class SyncPullRequest(BaseModel):
    """Request payload for pulling deltas."""

    since_rev: int = Field(default=0, ge=0, description="Highest known local sync revision.")
    limit: int = Field(default=100, ge=1, le=1000, description="Maximum deltas to return.")


class ClientMutation(BaseModel):
    """A single mutation originated offline on a client device."""

    entity_type: str = Field(default="note", description="Target entity type, e.g. 'note'.")
    entity_id: str = Field(..., description="Unique client entity ID.")
    change_type: Literal["INSERT", "UPDATE", "DELETE"] = Field(
        ...,
        description="Type of operation performed by the client.",
    )
    payload: dict[str, Any] = Field(
        default_factory=dict,
        description="Entity attributes (title, content_markdown, group_name, priority_score, tags).",
    )
    client_timestamp: str | None = Field(
        default=None,
        description="ISO timestamp when mutation occurred locally on device.",
    )


class SyncPushRequest(BaseModel):
    """Batch of client-originated mutations queued while offline."""

    mutations: list[ClientMutation] = Field(
        ...,
        min_length=1,
        description="List of offline mutations to commit and project.",
    )


class SyncPushResponse(BaseModel):
    """Response returned after processing client mutations."""

    status: str = "success"
    applied_count: int
    current_sync_rev: int
    applied_note_ids: list[str]


# ==============================================================================
# HTTP Endpoints
# ==============================================================================


@router.get("/deltas", response_model=SyncDeltasResponse)
async def get_sync_deltas(
    since_rev: int = Query(default=0, ge=0, description="Highest known local sync revision."),
    limit: int = Query(default=100, ge=1, le=1000, description="Max deltas to retrieve."),
    user_id: str = Depends(get_current_user_id),
) -> SyncDeltasResponse:
    """Retrieve ordered array of changelog deltas where sync_rev > since_rev.

    Used by client devices upon reconnection or after receiving a SYNC_PING doorbell.
    """
    current_rev = await get_current_sync_rev(user_id)
    deltas = await get_deltas_since(user_id=user_id, since_rev=since_rev)

    if limit and len(deltas) > limit:
        deltas = deltas[:limit]

    return SyncDeltasResponse(
        user_id=user_id,
        since_rev=since_rev,
        current_sync_rev=current_rev,
        delta_count=len(deltas),
        deltas=deltas,
    )


@router.post("/pull", response_model=SyncDeltasResponse)
async def pull_sync_deltas(
    body: SyncPullRequest,
    user_id: str = Depends(get_current_user_id),
) -> SyncDeltasResponse:
    """POST variant of delta catch-up for clients with restrictive HTTP proxies."""
    return await get_sync_deltas(since_rev=body.since_rev, limit=body.limit, user_id=user_id)


@router.post("/push", response_model=SyncPushResponse)
async def push_sync_mutations(
    body: SyncPushRequest,
    user_id: str = Depends(get_current_user_id),
) -> SyncPushResponse:
    """Accept client-originated offline mutations.

    For each mutation:
    1. Executes atomic SQLite transaction logging the new sync_rev in sync_changelog.
    2. Projects the Markdown note into the local Git Vault with author_type='user'.
    3. Indexes the updated text chunks in LanceDB for hybrid semantic search.
    4. Broadcasts SYNC_PING doorbell across all active WebSocket client devices of the user.
    """
    applied_ids: list[str] = []

    for mutation in body.mutations:
        entity_id = mutation.entity_id
        change_type = mutation.change_type
        payload = mutation.payload

        if mutation.entity_type == "note":
            if change_type in ("INSERT", "UPDATE"):
                title = payload.get("title", "Untitled Note")
                content_markdown = payload.get("content_markdown", "")
                group_name = payload.get("group_name", "General Reference")
                priority_score = float(payload.get("priority_score", 0.5))
                tags = payload.get("tags")
                if isinstance(tags, str):
                    tags = [t.strip() for t in tags.split(",") if t.strip()]

                saved_note = await save_and_project_note(
                    user_id=user_id,
                    note_id=entity_id,
                    group_name=group_name,
                    title=title,
                    content_markdown=content_markdown,
                    priority_score=priority_score,
                    tags=tags,
                    author_type="user",
                    commit_message=f"sync: client offline {change_type.lower()} note '{title}'",
                )

                # Update vector chunks in LanceDB
                try:
                    index_note_chunks(
                        user_id=user_id,
                        note_id=entity_id,
                        text=content_markdown,
                        metadata={
                            "group": group_name,
                            "title": title,
                            "priority": str(priority_score),
                        },
                    )
                except Exception as e:
                    logger.warning(f"LanceDB indexing warning during sync push: {e}")

                applied_ids.append(entity_id)

            elif change_type == "DELETE":
                group_name = payload.get("group_name", "General Reference")
                title = payload.get("title", entity_id)

                await delete_and_project_note(
                    user_id=user_id,
                    note_id=entity_id,
                    group_name=group_name,
                    title=title,
                    author_type="user",
                )
                applied_ids.append(entity_id)

    # Fetch newest sync_rev after all mutations are committed
    current_rev = await get_current_sync_rev(user_id)

    # Broadcast WebSocket doorbell ping to all active devices of this user (< 20ms)
    notified = await ws_manager.broadcast_ping(user_id=user_id, latest_sync_rev=current_rev)
    logger.info(
        f"Processed sync push of {len(body.mutations)} mutations for user '{user_id}'. "
        f"Current sync_rev: {current_rev}. Notified {notified} active sockets."
    )

    return SyncPushResponse(
        status="success",
        applied_count=len(applied_ids),
        current_sync_rev=current_rev,
        applied_note_ids=applied_ids,
    )


@router.post("/reset")
async def reset_user_notes(user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    """Wipe all notes, changelogs, and staged intakes for the current user."""
    import os
    from app.storage.sqlite_db import get_sqlite_connection
    from app.storage.paths import get_vault_path

    async with get_sqlite_connection(user_id) as conn:
        tables = [r[0] for r in await (await conn.execute("SELECT name FROM sqlite_master WHERE type='table';")).fetchall()]
        for t in ["notes", "notes_fts", "sync_changelog", "staging_intake", "entity_edges"]:
            if t in tables:
                await conn.execute(f"DELETE FROM {t};")
        if "user_sync_meta" in tables:
            await conn.execute("UPDATE user_sync_meta SET current_sync_rev = 0 WHERE user_id = ?;", (user_id,))
        await conn.commit()

    # Clear vault files (except .git)
    vault_path = get_vault_path(user_id)
    if vault_path.exists():
        for root, dirs, files in os.walk(vault_path):
            if ".git" in root:
                continue
            for f in files:
                if f.endswith(".md") and not f.startswith("."):
                    try:
                        os.remove(os.path.join(root, f))
                    except Exception:
                        pass

    # Broadcast reset to all connected client devices
    await ws_manager.broadcast_ping(user_id=user_id, latest_sync_rev=0)
    return {"status": "success", "message": f"All notes wiped for user {user_id}"}

