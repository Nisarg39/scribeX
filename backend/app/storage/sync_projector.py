"""Unified Write Pipeline & Projector.

Coordinates SQLite operational commits with Git Vault file projections:
1. Saves note in operational SQLite (atomic transaction + monotonic sync_rev).
2. Projects Markdown file to Git repository with YAML frontmatter.
3. Tags author ('ScribeX-AI' vs 'User') to power the Diff Learning Loop.
"""

from typing import Any
import logging

from app.core.config import settings
from app.storage.sqlite_db import save_note, delete_note
from app.storage.git_vault import project_note_to_vault, delete_note_from_vault

logger = logging.getLogger("scribex.sync_projector")


async def save_and_project_note(
    user_id: str,
    group_name: str,
    title: str,
    content_markdown: str,
    priority_score: float = 0.5,
    tags: list[str] | None = None,
    author_type: str = "ai",  # 'ai' or 'user'
    note_id: str | None = None,
    commit_message: str | None = None,
) -> dict[str, Any]:
    """Execute unified write: commit to SQLite first, then project to Git Markdown Vault."""
    # 1. Operational SQLite commit
    sqlite_note = await save_note(
        user_id=user_id,
        group_name=group_name,
        title=title,
        content_markdown=content_markdown,
        priority_score=priority_score,
        note_id=note_id,
    )

    # 2. Git Vault projection
    git_result = project_note_to_vault(
        user_id=user_id,
        note_id=sqlite_note["id"],
        group_name=group_name,
        title=title,
        content_markdown=content_markdown,
        priority_score=priority_score,
        sync_rev=sqlite_note["sync_rev"],
        tags=tags,
        author_type=author_type,
        commit_message=commit_message,
    )

    combined = {**sqlite_note, **git_result}
    return combined


async def delete_and_project_note(
    user_id: str,
    note_id: str,
    group_name: str,
    title: str,
    author_type: str = "user",
) -> bool:
    """Execute unified delete: remove from SQLite and commit removal in Git."""
    deleted_sqlite = await delete_note(user_id=user_id, note_id=note_id)
    if deleted_sqlite:
        delete_note_from_vault(
            user_id=user_id,
            group_name=group_name,
            title=title,
            author_type=author_type,
        )
    return deleted_sqlite
