"""Automated Test Suite for Step 4: Embedded LanceDB Vector Engine & File Parser."""

import pytest
import shutil
from pathlib import Path
import pymupdf

from app.storage.paths import ensure_tenant_directories, get_lancedb_path
from app.storage.lancedb_store import (
    get_or_create_chunks_table,
    index_note_chunks,
    delete_note_chunks,
    vector_search,
    chunk_text,
    deterministic_fallback_embedding,
    generate_embeddings,
)
from app.storage.file_parser import (
    parse_file_bytes,
    parse_pdf_bytes,
    parse_csv_bytes,
    extract_title_from_text_or_filename,
)

TEST_VECTOR_USER = "test_vector_user"


@pytest.fixture(autouse=True)
def setup_and_teardown_vector_db():
    """Ensure clean test vector directory before and after tests."""
    paths = ensure_tenant_directories(TEST_VECTOR_USER)
    yield
    if paths["base_root"].exists() and TEST_VECTOR_USER in str(paths["base_root"]):
        shutil.rmtree(paths["base_root"])


def test_chunk_text():
    """Verify semantic text chunking with paragraph preservation."""
    sample_text = (
        "Paragraph 1: Introduction to ScribeX architecture.\n\n"
        "Paragraph 2: Detailed 4-layer memory model explaining Layer 1 through Layer 4.\n\n"
        "Paragraph 3: Operational SQLite WAL mode and LanceDB disk storage."
    )
    chunks = chunk_text(sample_text, chunk_size=100)
    assert len(chunks) >= 3
    assert "Paragraph 1" in chunks[0]


def test_lancedb_indexing_and_similarity_search():
    """Verify indexing note chunks in LanceDB and running similarity search."""
    # 1. Index Note A (AI Assistant topic)
    note_a_text = (
        "ScribeX is an intelligent autonomous note-taking platform and proactive personal assistant. "
        "It uses a 4-layer cognitive memory architecture to maintain a living user profile."
    )
    count_a = index_note_chunks(
        user_id=TEST_VECTOR_USER,
        note_id="note_ai_101",
        text=note_a_text,
        metadata={"group": "Architecture", "priority": 0.9},
    )
    assert count_a >= 1

    # 2. Index Note B (Cooking recipe topic)
    note_b_text = (
        "Homemade Italian pasta recipe: flour, farm fresh eggs, extra virgin olive oil, and sea salt. "
        "Knead the dough for 10 minutes then roll thin."
    )
    count_b = index_note_chunks(
        user_id=TEST_VECTOR_USER,
        note_id="note_recipe_202",
        text=note_b_text,
        metadata={"group": "Cooking", "priority": 0.3},
    )
    assert count_b >= 1

    # 3. Search using vector related to "cognitive memory personal assistant"
    query_vec = deterministic_fallback_embedding("cognitive memory personal assistant")
    results = vector_search(TEST_VECTOR_USER, query_vec, limit=2)

    assert len(results) == 2
    # First result should match Note A
    assert results[0]["note_id"] == "note_ai_101"
    assert "4-layer cognitive memory" in results[0]["text"]
    assert results[0]["metadata"]["group"] == "Architecture"


def test_delete_note_chunks_from_lancedb():
    """Verify deleting a note clears its chunks from the vector database."""
    index_note_chunks(
        user_id=TEST_VECTOR_USER,
        note_id="note_to_remove",
        text="Temporary vector content to be wiped out.",
    )

    delete_note_chunks(TEST_VECTOR_USER, "note_to_remove")

    query_vec = deterministic_fallback_embedding("temporary vector content")
    results = vector_search(TEST_VECTOR_USER, query_vec, limit=5)

    matching = [r for r in results if r["note_id"] == "note_to_remove"]
    assert len(matching) == 0


@pytest.mark.asyncio
async def test_generate_embeddings_fallback():
    """Verify embedding generator returns normalized float vectors."""
    vectors = await generate_embeddings(["Test query 1", "Test query 2"], use_fallback=True)
    assert len(vectors) == 2
    assert len(vectors[0]) == 1536
    # Vector should be normalized (magnitude ~ 1.0)
    mag = sum(x * x for x in vectors[0])
    assert pytest.approx(mag, 0.01) == 1.0


def test_file_parser_markdown_and_text():
    """Verify parsing plain text and Markdown with title extraction."""
    md_content = b"# Quarterly Goals 2026\n\n- Scale ScribeX platform\n- Build universal mobile client"
    res = parse_file_bytes(md_content, "goals.md")

    assert res["file_type"] == "markdown"
    assert res["title_suggestion"] == "Quarterly Goals 2026"
    assert "Scale ScribeX" in res["text"]


def test_file_parser_csv():
    """Verify CSV parsing converts into a clean Markdown table."""
    csv_content = b"Task,Priority,Status\nSetup Database,High,Completed\nDeploy Backend,Critical,Pending"
    res = parse_file_bytes(csv_content, "tasks.csv")

    assert res["file_type"] == "csv"
    assert "| Task | Priority | Status |" in res["text"]
    assert "| Setup Database | High | Completed |" in res["text"]


def test_file_parser_pdf():
    """Verify in-memory PDF parsing with PyMuPDF."""
    # Create sample PDF in memory
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((50, 72), "ScribeX Technical Specification Document\nSub-5ms context retrieval engine.")
    pdf_bytes = doc.tobytes()
    doc.close()

    res = parse_file_bytes(pdf_bytes, "scribex_spec.pdf")
    assert res["file_type"] == "pdf"
    assert res["page_count"] == 1
    assert "ScribeX Technical Specification Document" in res["text"]
    assert res["title_suggestion"] == "Scribex Spec"
