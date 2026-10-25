"""Layer 1: Core Identity & Always-Active Index Memory.

Maintains the user's living profile summary, active goals, high-priority tasks,
and note group index cached in RAM (~1,500 tokens) to be injected into the
system prompt of every ScribeX AI decision and intake evaluation.
"""

from pathlib import Path
from typing import Any
import json
import logging
import time
from pydantic import BaseModel, Field

from app.core.config import settings
from app.storage.paths import get_vault_path
from app.storage.git_vault import get_vault_repo, parse_frontmatter_markdown, AI_ACTOR, USER_ACTOR
from app.storage.sqlite_db import get_db_connection

logger = logging.getLogger("scribex.layer1_identity")

# In-memory RAM cache: user_id -> (timestamp_cached, prompt_string)
_IDENTITY_RAM_CACHE: dict[str, tuple[float, str]] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes default TTL, invalidated on updates


class CoreProfile(BaseModel):
    """Structured representation of the user's foundational living profile."""

    full_name: str = "User"
    role_and_mindset: str = "Knowledge Worker"
    career_journey: str = ""
    long_term_vision: str = ""
    short_term_goals: list[str] = Field(default_factory=list)
    core_values: list[str] = Field(default_factory=list)
    daily_routines: list[str] = Field(default_factory=list)


def get_identity_file_path(user_id: str = settings.default_user_id) -> Path:
    """Return the physical path to _core/identity.md in the tenant's Git vault."""
    vault_dir = get_vault_path(user_id)
    core_dir = vault_dir / "_core"
    core_dir.mkdir(parents=True, exist_ok=True)
    return core_dir / "identity.md"


def invalidate_layer1_cache(user_id: str | None = None) -> None:
    """Invalidate in-memory RAM cache for a specific user or globally."""
    if user_id:
        _IDENTITY_RAM_CACHE.pop(user_id, None)
        logger.debug(f"Invalidated Layer 1 RAM cache for user '{user_id}'.")
    else:
        _IDENTITY_RAM_CACHE.clear()
        logger.debug("Invalidated all Layer 1 RAM caches.")


def save_core_profile(
    user_id: str,
    profile: CoreProfile,
    author_type: str = "ai",
) -> Path:
    """Save or update the core profile in _core/identity.md and commit to Git."""
    file_path = get_identity_file_path(user_id)
    repo = get_vault_repo(user_id)
    vault_dir = Path(repo.working_dir)

    goals_yaml = "[" + ", ".join(f'"{g}"' for g in profile.short_term_goals) + "]"
    values_yaml = "[" + ", ".join(f'"{v}"' for v in profile.core_values) + "]"
    routines_yaml = "[" + ", ".join(f'"{r}"' for r in profile.daily_routines) + "]"

    content = (
        "---\n"
        f"full_name: \"{profile.full_name}\"\n"
        f"role_and_mindset: \"{profile.role_and_mindset}\"\n"
        f"short_term_goals: {goals_yaml}\n"
        f"core_values: {values_yaml}\n"
        f"daily_routines: {routines_yaml}\n"
        "---\n\n"
        f"# Identity & Master Profile: {profile.full_name}\n\n"
        f"## 1. Role & Mindset\n{profile.role_and_mindset}\n\n"
        f"## 2. Career Journey\n{profile.career_journey}\n\n"
        f"## 3. Long-Term Vision\n{profile.long_term_vision}\n\n"
        f"## 4. Active Short-Term Goals\n"
        + "\n".join(f"- {g}" for g in profile.short_term_goals)
        + "\n\n## 5. Daily Routines & Habits\n"
        + "\n".join(f"- {r}" for r in profile.daily_routines)
        + "\n"
    )

    file_path.write_text(content, encoding="utf-8")

    vault_dir = Path(repo.working_dir).resolve()
    rel_path = str(file_path.resolve().relative_to(vault_dir))
    repo.index.add([rel_path])

    actor = USER_ACTOR if author_type == "user" else AI_ACTOR
    prefix = "[User]" if author_type == "user" else "[AI]"
    repo.index.commit(f"{prefix} Updated core identity profile (_core/identity.md)", author=actor, committer=actor)

    invalidate_layer1_cache(user_id)
    logger.info(f"Saved and committed core profile for user '{user_id}'.")
    return file_path


def load_core_profile(user_id: str = settings.default_user_id) -> CoreProfile:
    """Load core profile from _core/identity.md or return baseline default."""
    file_path = get_identity_file_path(user_id)
    if not file_path.exists():
        return CoreProfile()

    raw_text = file_path.read_text(encoding="utf-8")
    meta, body = parse_frontmatter_markdown(raw_text)

    # Extract sections from markdown body
    journey = ""
    vision = ""

    if "## 2. Career Journey" in body:
        parts = body.split("## 2. Career Journey", 1)[1]
        journey = parts.split("## 3. Long-Term Vision", 1)[0].strip()

    if "## 3. Long-Term Vision" in body:
        parts = body.split("## 3. Long-Term Vision", 1)[1]
        vision = parts.split("## 4. Active Short-Term Goals", 1)[0].strip()

    def parse_list(val: Any) -> list[str]:
        if isinstance(val, list):
            return [str(x) for x in val]
        if isinstance(val, str) and val.startswith("[") and val.endswith("]"):
            try:
                return json.loads(val)
            except Exception:
                return []
        return []

    return CoreProfile(
        full_name=meta.get("full_name", "User"),
        role_and_mindset=meta.get("role_and_mindset", "Knowledge Worker"),
        career_journey=journey,
        long_term_vision=vision,
        short_term_goals=parse_list(meta.get("short_term_goals")),
        core_values=parse_list(meta.get("core_values")),
        daily_routines=parse_list(meta.get("daily_routines")),
    )


async def build_layer1_prompt(
    user_id: str = settings.default_user_id,
    bypass_cache: bool = False,
) -> str:
    """Build the compact Layer 1 memory prompt (~1,500 tokens) cached in RAM."""
    now = time.time()
    if not bypass_cache and user_id in _IDENTITY_RAM_CACHE:
        cached_time, cached_prompt = _IDENTITY_RAM_CACHE[user_id]
        if now - cached_time < CACHE_TTL_SECONDS:
            return cached_prompt

    # 1. Load Core Profile
    profile = load_core_profile(user_id)

    # 2. Query SQLite for active groups and high-priority notes
    async with get_db_connection(user_id) as conn:
        # Note Groups
        cursor = await conn.execute(
            "SELECT DISTINCT group_name FROM notes WHERE user_id = ? ORDER BY group_name",
            (user_id,),
        )
        group_rows = await cursor.fetchall()
        groups = [r["group_name"] for r in group_rows]

        # Top 5 highest priority active notes
        cursor = await conn.execute(
            """
            SELECT id, group_name, title, priority_score
            FROM notes
            WHERE user_id = ?
            ORDER BY priority_score DESC, updated_at DESC
            LIMIT 5
            """,
            (user_id,),
        )
        priority_rows = await cursor.fetchall()
        top_priorities = [dict(r) for r in priority_rows]

    # Format goals and values
    goals_text = "\n".join(f"  * {g}" for g in profile.short_term_goals) if profile.short_term_goals else "  * (None currently set)"
    values_text = ", ".join(profile.core_values) if profile.core_values else "(Standard proactive assistance)"
    groups_text = ", ".join(f"`{g}`" for g in groups) if groups else "*(No groups established yet)*"

    priorities_lines = []
    for p in top_priorities:
        priorities_lines.append(f"  * [P:{p['priority_score']:.2f}] {p['title']} (in group `{p['group_name']}`)")
    priorities_text = "\n".join(priorities_lines) if priorities_lines else "  * (No active high-priority items)"

    prompt = (
        "=== SCRIBEX LAYER 1: ALWAYS-ACTIVE IDENTITY & INDEX ===\n"
        f"User: {profile.full_name}\n"
        f"Current Role / Mindset: {profile.role_and_mindset}\n"
        f"Core Values: {values_text}\n\n"
        f"Long-Term Vision:\n{profile.long_term_vision or '(Not yet defined)'}\n\n"
        f"Active Short-Term Goals:\n{goals_text}\n\n"
        f"Current Top Priorities (from Vault):\n{priorities_text}\n\n"
        f"Existing Note Groups in Vault:\n[{groups_text}]\n"
        "======================================================"
    )

    # Cache in RAM
    _IDENTITY_RAM_CACHE[user_id] = (now, prompt)
    return prompt
