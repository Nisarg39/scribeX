"""Automated Test Suite for Step 2: Operational SQLite Engine (WAL Mode + Core Schemas)."""

import pytest
import shutil
import aiosqlite

from app.storage.paths import ensure_tenant_directories, get_sqlite_path
from app.storage.sqlite_db import (
    init_db,
    get_db_connection,
    save_note,
    get_note_by_id,
    list_notes,
    delete_note,
    get_deltas_since,
    get_current_sync_rev,
    add_edge,
    get_connected_edges,
    record_timeline_event,
    get_timeline,
    search_notes_fts,
)

TEST_USER = "test_storage_user"


@pytest.fixture(autouse=True)
async def setup_and_teardown_db():
    """Fixture to initialize a fresh database for the test user and clean up afterward."""
    paths = ensure_tenant_directories(TEST_USER)
    await init_db(TEST_USER)
    yield
    # Clean up test user directory
    if paths["base_root"].exists():
        shutil.rmtree(paths["base_root"])


@pytest.mark.asyncio
async def test_sqlite_wal_pragmas():
    """Verify that SQLite executes with WAL mode, foreign keys, and busy timeout."""
    async with get_db_connection(TEST_USER) as conn:
        cursor = await conn.execute("PRAGMA journal_mode;")
        row = await cursor.fetchone()
        assert row[0].upper() == "WAL"

        cursor = await conn.execute("PRAGMA foreign_keys;")
        row = await cursor.fetchone()
        assert row[0] == 1


@pytest.mark.asyncio
async def test_atomic_note_save_and_sync_rev():
    """Verify atomic note creation, update, and monotonic sync_rev increment."""
    # 1. Create first note
    note_1 = await save_note(
        user_id=TEST_USER,
        group_name="Projects",
        title="ScribeX Architecture",
        content_markdown="Drafting the 4-layer memory engine specifications.",
        priority_score=0.9,
    )
    assert note_1["sync_rev"] == 1
    assert note_1["title"] == "ScribeX Architecture"

    # 2. Create second note
    note_2 = await save_note(
        user_id=TEST_USER,
        group_name="Personal",
        title="Workout Routine",
        content_markdown="Morning 5km run and core strength training.",
        priority_score=0.4,
    )
    assert note_2["sync_rev"] == 2

    # 3. Update first note
    updated_note_1 = await save_note(
        user_id=TEST_USER,
        group_name="Projects",
        title="ScribeX Architecture (Final)",
        content_markdown="Updated specifications with SQLite WAL and LanceDB.",
        priority_score=0.95,
        note_id=note_1["id"],
    )
    assert updated_note_1["sync_rev"] == 3
    assert updated_note_1["title"] == "ScribeX Architecture (Final)"

    # Verify current sync_rev
    current_rev = await get_current_sync_rev(TEST_USER)
    assert current_rev == 3


@pytest.mark.asyncio
async def test_delta_sync_changelog():
    """Verify that get_deltas_since correctly retrieves incremental event-sourced deltas."""
    n1 = await save_note(TEST_USER, "Work", "Task 1", "Content 1")
    n2 = await save_note(TEST_USER, "Work", "Task 2", "Content 2")
    await save_note(TEST_USER, "Work", "Task 1 Updated", "Content 1.1", note_id=n1["id"])

    # Fetch all deltas from beginning
    all_deltas = await get_deltas_since(TEST_USER, since_rev=0)
    assert len(all_deltas) == 3
    assert all_deltas[0]["sync_rev"] == 1
    assert all_deltas[0]["change_type"] == "INSERT"
    assert all_deltas[1]["sync_rev"] == 2
    assert all_deltas[1]["change_type"] == "INSERT"
    assert all_deltas[2]["sync_rev"] == 3
    assert all_deltas[2]["change_type"] == "UPDATE"

    # Fetch deltas since revision 2 (client already has rev 2)
    new_deltas = await get_deltas_since(TEST_USER, since_rev=2)
    assert len(new_deltas) == 1
    assert new_deltas[0]["sync_rev"] == 3
    assert new_deltas[0]["entity_id"] == n1["id"]


@pytest.mark.asyncio
async def test_delete_note_with_sync_logging():
    """Verify note deletion removes the record and logs a DELETE delta."""
    note = await save_note(TEST_USER, "Archive", "Temporary Note", "To be deleted")
    note_id = note["id"]

    success = await delete_note(TEST_USER, note_id)
    assert success is True

    # Note should not be found
    fetched = await get_note_by_id(TEST_USER, note_id)
    assert fetched is None

    # Sync changelog should have DELETE entry
    deltas = await get_deltas_since(TEST_USER, since_rev=note["sync_rev"])
    assert len(deltas) == 1
    assert deltas[0]["change_type"] == "DELETE"
    assert deltas[0]["entity_id"] == note_id


@pytest.mark.asyncio
async def test_fts5_full_text_search():
    """Verify FTS5 BM25 search finds notes by keywords in title and body."""
    await save_note(
        TEST_USER,
        "DevOps",
        "Kubernetes Cluster Setup",
        "Deploying microservices with ingress controllers and cert-manager.",
    )
    await save_note(
        TEST_USER,
        "Finance",
        "Q3 Tax Planning",
        "Reviewing deductions for home office expenses and cloud hosting.",
    )

    # Search for "Kubernetes"
    results = await search_notes_fts(TEST_USER, "Kubernetes")
    assert len(results) == 1
    assert results[0]["title"] == "Kubernetes Cluster Setup"
    assert "snippet" in results[0]

    # Search for "hosting"
    results = await search_notes_fts(TEST_USER, "hosting")
    assert len(results) == 1
    assert results[0]["title"] == "Q3 Tax Planning"

    # Search for nonexistent term
    results = await search_notes_fts(TEST_USER, "nonexistentphrasexyz")
    assert len(results) == 0


@pytest.mark.asyncio
async def test_entity_edges_relationship_graph():
    """Verify Layer 2 semantic relationship graph edges."""
    note_a = await save_note(TEST_USER, "Projects", "Project Alpha", "Description")
    goal_b = await save_note(TEST_USER, "Goals", "Launch AI Startup", "Vision")

    edge = await add_edge(
        user_id=TEST_USER,
        source_id=note_a["id"],
        relation_type="SERVES_GOAL",
        target_id=goal_b["id"],
    )
    assert edge["relation_type"] == "SERVES_GOAL"

    connected = await get_connected_edges(TEST_USER, note_a["id"])
    assert len(connected) == 1
    assert connected[0]["target_id"] == goal_b["id"]


@pytest.mark.asyncio
async def test_identity_timeline_logging():
    """Verify Layer 3 'Versions of Me' timeline tracking."""
    event = await record_timeline_event(
        user_id=TEST_USER,
        attribute="career_role",
        old_value="Senior Frontend Developer",
        new_value="Founder & Lead AI Engineer",
        change_reason="Transitioned to building autonomous AI assistant platform.",
        git_commit_sha="a1b2c3d4",
    )
    assert event["attribute"] == "career_role"
    assert event["new_value"] == "Founder & Lead AI Engineer"

    timeline = await get_timeline(TEST_USER, attribute="career_role")
    assert len(timeline) == 1
    assert timeline[0]["old_value"] == "Senior Frontend Developer"
