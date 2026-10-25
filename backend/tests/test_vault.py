"""Automated Test Suite for Step 3: Git-Backed Markdown Vault Projector."""

import pytest
import shutil
from pathlib import Path

from app.storage.paths import ensure_tenant_directories, get_vault_path
from app.storage.git_vault import (
    get_vault_repo,
    project_note_to_vault,
    delete_note_from_vault,
    get_git_diff,
    get_file_history,
    parse_frontmatter_markdown,
    AI_ACTOR,
    USER_ACTOR,
)

TEST_VAULT_USER = "test_vault_user"


@pytest.fixture(autouse=True)
def setup_and_teardown_vault():
    """Ensure clean test vault directory before and after tests."""
    paths = ensure_tenant_directories(TEST_VAULT_USER)
    yield
    if paths["base_root"].exists() and TEST_VAULT_USER in str(paths["base_root"]):
        shutil.rmtree(paths["base_root"])


def test_init_git_vault():
    """Verify Git repository initialization and initial commit."""
    repo = get_vault_repo(TEST_VAULT_USER)
    vault_dir = Path(repo.working_dir)

    assert (vault_dir / ".git").exists()
    assert (vault_dir / "README.md").exists()

    commits = list(repo.iter_commits())
    assert len(commits) == 1
    assert commits[0].author.name == AI_ACTOR.name


def test_project_note_with_ai_author():
    """Verify projecting a note created by AI creates file with YAML frontmatter and AI commit author."""
    result = project_note_to_vault(
        user_id=TEST_VAULT_USER,
        note_id="note_test_101",
        group_name="Career Vision",
        title="AI Assistant Strategy",
        content_markdown="Build a proactive, self-learning personal assistant platform.",
        priority_score=0.9,
        sync_rev=1,
        tags=["ai", "career", "strategy"],
        author_type="ai",
    )

    file_path = Path(result["file_path"])
    assert file_path.exists()
    assert file_path.name == "ai_assistant_strategy.md"
    assert result["author"] == AI_ACTOR.name

    # Check content and frontmatter
    raw_content = file_path.read_text(encoding="utf-8")
    meta, body = parse_frontmatter_markdown(raw_content)

    assert meta["id"] == "note_test_101"
    assert meta["group"] == "Career Vision"
    assert meta["priority"] == 0.9
    assert meta["sync_rev"] == 1
    assert "Build a proactive" in body


def test_project_note_user_edit_and_git_diff():
    """Verify that a manual user edit commits with User author and generates a clean git diff for learning."""
    # 1. First commit by AI
    project_note_to_vault(
        user_id=TEST_VAULT_USER,
        note_id="note_test_202",
        group_name="Projects",
        title="Client Portal",
        content_markdown="- [ ] Initial setup\n- [ ] Database schema\n- [ ] Priority: Low",
        priority_score=0.3,
        sync_rev=1,
        author_type="ai",
    )

    # 2. User manually edits the note (raises priority, adds tasks)
    edit_result = project_note_to_vault(
        user_id=TEST_VAULT_USER,
        note_id="note_test_202",
        group_name="Projects",
        title="Client Portal",
        content_markdown="- [x] Initial setup\n- [x] Database schema\n- [ ] Priority: High Urgent\n- [ ] User testing",
        priority_score=0.95,
        sync_rev=2,
        author_type="user",
        commit_message="[User] Escalated Client Portal to High Priority",
    )

    assert edit_result["author"] == USER_ACTOR.name

    # 3. Extract git diff between the two commits
    diff = get_git_diff(TEST_VAULT_USER, edit_result["commit_sha"])

    assert "- [ ] Initial setup" in diff or "- [ ] Priority: Low" in diff
    assert "+- [x] Initial setup" in diff or "+- [ ] Priority: High Urgent" in diff


def test_file_commit_history():
    """Verify historical commits for a specific note file."""
    res1 = project_note_to_vault(
        user_id=TEST_VAULT_USER,
        note_id="note_test_303",
        group_name="Checklists",
        title="Daily Tasks",
        content_markdown="Morning check-in",
        author_type="ai",
    )

    res2 = project_note_to_vault(
        user_id=TEST_VAULT_USER,
        note_id="note_test_303",
        group_name="Checklists",
        title="Daily Tasks",
        content_markdown="Morning check-in\nEvening review",
        author_type="user",
    )

    history = get_file_history(TEST_VAULT_USER, res2["rel_path"])
    assert len(history) == 2
    assert history[0]["sha"] == res2["commit_sha"]
    assert history[0]["author"] == USER_ACTOR.name
    assert history[1]["sha"] == res1["commit_sha"]
    assert history[1]["author"] == AI_ACTOR.name


def test_delete_note_from_vault():
    """Verify deleting a note removes the Markdown file and commits removal."""
    project_note_to_vault(
        user_id=TEST_VAULT_USER,
        note_id="note_test_404",
        group_name="Temp",
        title="Temporary Scratchpad",
        content_markdown="Temporary notes to discard",
    )

    del_result = delete_note_from_vault(
        user_id=TEST_VAULT_USER,
        group_name="Temp",
        title="Temporary Scratchpad",
        author_type="user",
    )

    assert del_result is not None
    assert del_result["author"] == USER_ACTOR.name

    vault_dir = get_vault_path(TEST_VAULT_USER)
    assert not (vault_dir / "temp" / "temporary_scratchpad.md").exists()


@pytest.mark.asyncio
async def test_unified_save_and_project_pipeline():
    """Verify unified pipeline commits to SQLite and projects to Git in a single call."""
    from app.storage.sqlite_db import init_db, get_note_by_id
    from app.storage.sync_projector import save_and_project_note, delete_and_project_note

    await init_db(TEST_VAULT_USER)

    # Save and project
    result = await save_and_project_note(
        user_id=TEST_VAULT_USER,
        group_name="Initiatives",
        title="Autonomous Agent Sync",
        content_markdown="Coordinating multi-device states via WebSockets.",
        priority_score=0.88,
        tags=["websockets", "sync"],
        author_type="ai",
    )

    note_id = result["id"]
    assert result["sync_rev"] >= 1
    assert result["author"] == AI_ACTOR.name
    assert Path(result["file_path"]).exists()

    # Verify SQLite record exists
    sqlite_note = await get_note_by_id(TEST_VAULT_USER, note_id)
    assert sqlite_note is not None
    assert sqlite_note["title"] == "Autonomous Agent Sync"

    # Delete and project
    success = await delete_and_project_note(
        user_id=TEST_VAULT_USER,
        note_id=note_id,
        group_name="Initiatives",
        title="Autonomous Agent Sync",
        author_type="user",
    )
    assert success is True
    assert not Path(result["file_path"]).exists()
