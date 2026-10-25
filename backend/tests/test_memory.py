"""Automated Test Suite for Step 5: Cognitive Memory Engine (Layers 1 & 2)."""

import pytest
import shutil
from pathlib import Path

from app.storage.paths import ensure_tenant_directories, get_vault_path
from app.storage.sqlite_db import init_db, save_note, add_edge
from app.storage.lancedb_store import index_note_chunks
from app.storage.sync_projector import save_and_project_note
from app.memory.layer1_identity import (
    CoreProfile,
    save_core_profile,
    load_core_profile,
    build_layer1_prompt,
    invalidate_layer1_cache,
)
from app.memory.layer2_vault import retrieve_hybrid_context

TEST_MEM_USER = "test_memory_user"


@pytest.fixture(autouse=True)
async def setup_and_teardown_memory():
    """Ensure clean test environment and SQLite database for memory tests."""
    paths = ensure_tenant_directories(TEST_MEM_USER)
    await init_db(TEST_MEM_USER)
    invalidate_layer1_cache(TEST_MEM_USER)
    yield
    if paths["base_root"].exists() and TEST_MEM_USER in str(paths["base_root"]):
        shutil.rmtree(paths["base_root"])
    invalidate_layer1_cache(TEST_MEM_USER)


@pytest.mark.asyncio
async def test_layer1_core_profile_and_prompt_generation():
    """Verify Layer 1 core profile saving, loading, and compact prompt generation."""
    profile = CoreProfile(
        full_name="Tony Stark",
        role_and_mindset="Innovator & Systems Engineer",
        career_journey="Defense tech to clean energy and autonomous intelligence.",
        long_term_vision="Create an autonomous global defensive intelligence network.",
        short_term_goals=["Build Friday AI Assistant", "Deploy clean energy reactor"],
        core_values=["Extreme velocity", "Zero blind assumptions", "User manual control"],
        daily_routines=["Morning lab standup", "Systems telemetry audit"],
    )

    # 1. Save profile to _core/identity.md
    file_path = save_core_profile(TEST_MEM_USER, profile, author_type="ai")
    assert file_path.exists()

    # 2. Load profile
    loaded = load_core_profile(TEST_MEM_USER)
    assert loaded.full_name == "Tony Stark"
    assert loaded.role_and_mindset == "Innovator & Systems Engineer"
    assert len(loaded.short_term_goals) == 2
    assert "Build Friday AI Assistant" in loaded.short_term_goals

    # 3. Add sample high-priority notes in SQLite to verify index integration
    await save_note(
        user_id=TEST_MEM_USER,
        group_name="Mark L Armor",
        title="Nanotech Thrusters",
        content_markdown="Thruster specifications",
        priority_score=0.98,
    )

    # 4. Build prompt
    prompt = await build_layer1_prompt(TEST_MEM_USER)
    assert "=== SCRIBEX LAYER 1" in prompt
    assert "User: Tony Stark" in prompt
    assert "Nanotech Thrusters" in prompt
    assert "Mark L Armor" in prompt

    # 5. Verify RAM cache returns identical prompt on second call
    cached_prompt = await build_layer1_prompt(TEST_MEM_USER)
    assert cached_prompt == prompt


@pytest.mark.asyncio
async def test_layer2_hybrid_context_retrieval():
    """Verify Layer 2 triple hybrid retrieval (Keyword FTS5 + LanceDB Vector + Graph Edges)."""
    # 1. Create a project note and a goal note
    project_note = await save_and_project_note(
        user_id=TEST_MEM_USER,
        group_name="Projects",
        title="Neural Interface Subsystem",
        content_markdown="Developing low-latency brain-computer telemetry bridge for Friday assistant.",
        priority_score=0.92,
        tags=["neural", "friday"],
    )

    goal_note = await save_and_project_note(
        user_id=TEST_MEM_USER,
        group_name="Goals",
        title="Master Autonomous Agents",
        content_markdown="Complete mastery of local-first agentic execution.",
        priority_score=0.99,
        tags=["agents", "vision"],
    )

    # 2. Index vector chunks into LanceDB
    index_note_chunks(
        user_id=TEST_MEM_USER,
        note_id=project_note["id"],
        text=project_note["content_markdown"],
        metadata={"group": "Projects"},
    )

    # 3. Add graph edge connecting project to goal
    await add_edge(
        user_id=TEST_MEM_USER,
        source_id=project_note["id"],
        relation_type="SERVES_GOAL",
        target_id=goal_note["id"],
    )

    # 4. Execute hybrid retrieval for "neural telemetry bridge"
    context_bundle = await retrieve_hybrid_context(
        user_id=TEST_MEM_USER,
        query="neural telemetry bridge",
        limit=3,
    )

    assert len(context_bundle["matched_notes"]) >= 1
    top_note = context_bundle["matched_notes"][0]
    assert top_note["id"] == project_note["id"]
    assert top_note["title"] == "Neural Interface Subsystem"

    # Verify graph edge expansion
    assert len(top_note["connected_edges"]) == 1
    assert top_note["connected_edges"][0]["relation_type"] == "SERVES_GOAL"
    assert top_note["connected_edges"][0]["target_id"] == goal_note["id"]

    # Verify formatted context prompt
    prompt = context_bundle["formatted_context"]
    assert "Neural Interface Subsystem" in prompt
    assert "SERVES_GOAL" in prompt
    assert goal_note["id"] in prompt


@pytest.mark.asyncio
async def test_layer2_empty_query():
    """Verify that an empty query returns clean empty context without error."""
    bundle = await retrieve_hybrid_context(TEST_MEM_USER, query="")
    assert bundle["matched_notes"] == []
    assert bundle["formatted_context"] == ""
