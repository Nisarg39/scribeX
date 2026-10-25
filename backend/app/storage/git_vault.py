"""Git-Backed Markdown Vault Projector.

Projects SQLite note changes asynchronously into physical Markdown files
inside a local Git repository. Manages commit author attribution
('ScribeX-AI' vs 'User') to power the Manual Edit Diff Learning Loop.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import logging
import re
import git
from git import Repo, Actor

from app.core.config import settings
from app.storage.paths import get_vault_path

logger = logging.getLogger("scribex.git_vault")

AI_ACTOR = Actor("ScribeX-AI", "ai@assistant.local")
USER_ACTOR = Actor("User", "user@assistant.local")


def sanitize_name(name: str) -> str:
    """Sanitize titles and folder names for safe cross-platform filesystem paths."""
    cleaned = re.sub(r"[^\w\s-]", "", name).strip()
    slug = re.sub(r"[-\s]+", "_", cleaned).lower()
    return slug[:60] if slug else "untitled"


def get_vault_repo(user_id: str = settings.default_user_id) -> Repo:
    """Get or initialize the Git repository for a tenant's vault."""
    vault_dir = get_vault_path(user_id)
    git_dir = vault_dir / ".git"

    if not git_dir.exists():
        logger.info(f"Initializing new Git Vault repository at: {vault_dir}")
        repo = Repo.init(vault_dir)
        readme_file = vault_dir / "README.md"
        if not readme_file.exists():
            readme_file.write_text(
                f"# ScribeX Context Vault\n\nTenant: `{user_id}`\nInitialized: {datetime.now(timezone.utc).isoformat()}\n",
                encoding="utf-8",
            )
            repo.index.add(["README.md"])
            repo.index.commit("Initial ScribeX vault commit", author=AI_ACTOR, committer=AI_ACTOR)
        return repo

    return Repo(vault_dir)


def format_markdown_with_frontmatter(
    note_id: str,
    group_name: str,
    title: str,
    content_markdown: str,
    priority_score: float = 0.5,
    sync_rev: int = 1,
    tags: list[str] | None = None,
    updated_at: str | None = None,
) -> str:
    """Format note into human-readable Markdown with structured YAML frontmatter."""
    if not updated_at:
        updated_at = datetime.now(timezone.utc).isoformat()
    if tags is None:
        tags = []

    tags_str = "[" + ", ".join(f'"{t}"' for t in tags) + "]"

    frontmatter = (
        "---\n"
        f"id: \"{note_id}\"\n"
        f"group: \"{group_name}\"\n"
        f"priority: {priority_score}\n"
        f"sync_rev: {sync_rev}\n"
        f"tags: {tags_str}\n"
        f"updated_at: \"{updated_at}\"\n"
        "---\n\n"
        f"# {title}\n\n"
        f"{content_markdown.strip()}\n"
    )
    return frontmatter


def parse_frontmatter_markdown(raw_content: str) -> tuple[dict[str, Any], str]:
    """Parse YAML frontmatter and main body content from a raw Markdown file string."""
    metadata: dict[str, Any] = {}
    body = raw_content

    if raw_content.startswith("---"):
        parts = raw_content.split("---", 2)
        if len(parts) >= 3:
            fm_text = parts[1].strip()
            body = parts[2].strip()
            for line in fm_text.splitlines():
                if ":" in line:
                    key, val = line.split(":", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key in ("priority", "sync_rev"):
                        try:
                            metadata[key] = float(val) if key == "priority" else int(val)
                        except ValueError:
                            metadata[key] = val
                    else:
                        metadata[key] = val

    return metadata, body


def project_note_to_vault(
    user_id: str,
    note_id: str,
    group_name: str,
    title: str,
    content_markdown: str,
    priority_score: float = 0.5,
    sync_rev: int = 1,
    tags: list[str] | None = None,
    author_type: str = "ai",  # 'ai' or 'user'
    commit_message: str | None = None,
) -> dict[str, Any]:
    """Project a note into the physical Git repository and commit the change."""
    repo = get_vault_repo(user_id)
    vault_dir = Path(repo.working_dir)

    sanitized_group = sanitize_name(group_name)
    group_dir = vault_dir / sanitized_group
    group_dir.mkdir(parents=True, exist_ok=True)

    sanitized_filename = f"{sanitize_name(title)}.md"
    file_path = group_dir / sanitized_filename
    rel_path = str(file_path.relative_to(vault_dir))

    # Format content
    file_content = format_markdown_with_frontmatter(
        note_id=note_id,
        group_name=group_name,
        title=title,
        content_markdown=content_markdown,
        priority_score=priority_score,
        sync_rev=sync_rev,
        tags=tags,
    )

    is_new = not file_path.exists()
    file_path.write_text(file_content, encoding="utf-8")

    # Git stage & commit
    repo.index.add([rel_path])

    actor = USER_ACTOR if author_type == "user" else AI_ACTOR
    prefix = "[User]" if author_type == "user" else "[AI]"
    action_str = "Created" if is_new else "Updated"

    if not commit_message:
        commit_message = f"{prefix} {action_str} note '{title}' (rev {sync_rev})"

    commit = repo.index.commit(commit_message, author=actor, committer=actor)
    logger.info(f"Committed note projection {rel_path} (SHA: {commit.hexsha[:8]}) by {actor.name}")

    return {
        "file_path": str(file_path),
        "rel_path": rel_path,
        "commit_sha": commit.hexsha,
        "author": actor.name,
        "commit_message": commit_message,
    }


def delete_note_from_vault(
    user_id: str,
    group_name: str,
    title: str,
    author_type: str = "user",
) -> dict[str, Any] | None:
    """Delete a note file from the vault and commit the removal."""
    repo = get_vault_repo(user_id)
    vault_dir = Path(repo.working_dir)

    sanitized_group = sanitize_name(group_name)
    sanitized_filename = f"{sanitize_name(title)}.md"
    file_path = vault_dir / sanitized_group / sanitized_filename

    if not file_path.exists():
        return None

    rel_path = str(file_path.relative_to(vault_dir))
    file_path.unlink()

    repo.index.remove([rel_path])

    actor = USER_ACTOR if author_type == "user" else AI_ACTOR
    prefix = "[User]" if author_type == "user" else "[AI]"
    msg = f"{prefix} Deleted note '{title}'"

    commit = repo.index.commit(msg, author=actor, committer=actor)
    return {
        "rel_path": rel_path,
        "commit_sha": commit.hexsha,
        "author": actor.name,
    }


def get_git_diff(
    user_id: str = settings.default_user_id,
    commit_sha: str | None = None,
) -> str:
    """Retrieve line-by-line diff for diff learning or historical inspection.

    If commit_sha is provided, diffs commit_sha~1 against commit_sha.
    Otherwise, diffs HEAD~1 against HEAD.
    """
    repo = get_vault_repo(user_id)

    if commit_sha:
        target_commit = repo.commit(commit_sha)
        if target_commit.parents:
            parent = target_commit.parents[0]
            diff_index = parent.diff(target_commit, create_patch=True)
        else:
            diff_index = target_commit.diff(git.NULL_TREE, create_patch=True)
    else:
        commits = list(repo.iter_commits(max_count=2))
        if len(commits) >= 2:
            diff_index = commits[1].diff(commits[0], create_patch=True)
        elif len(commits) == 1:
            diff_index = commits[0].diff(git.NULL_TREE, create_patch=True)
        else:
            return ""

    diff_lines = []
    for d in diff_index:
        if d.diff:
            diff_lines.append(f"--- a/{d.a_path}\n+++ b/{d.b_path}\n{d.diff.decode('utf-8', errors='replace')}")

    return "\n".join(diff_lines)


def get_file_history(
    user_id: str,
    rel_path: str,
    max_commits: int = 20,
) -> list[dict[str, Any]]:
    """Return historical commits for a specific note file."""
    repo = get_vault_repo(user_id)
    commits = list(repo.iter_commits(paths=rel_path, max_count=max_commits))
    history = []
    for c in commits:
        history.append({
            "sha": c.hexsha,
            "author": c.author.name,
            "email": c.author.email,
            "message": c.message.strip(),
            "committed_at": c.committed_datetime.isoformat(),
        })
    return history
