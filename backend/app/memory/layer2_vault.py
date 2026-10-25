"""Layer 2: Living Structured Notes & Semantic Graph Memory.

Implements the Triple Hybrid Context Retrieval strategy:
1. Keyword/Exact Retrieval (SQLite FTS5 BM25).
2. Semantic Vector Retrieval (Embedded LanceDB).
3. Graph Edge Expansion (SQLite entity_edges relationship graph).
"""

from typing import Any
import logging

from app.core.config import settings
from app.storage.sqlite_db import (
    get_note_by_id,
    search_notes_fts,
    get_connected_edges,
)
from app.storage.lancedb_store import (
    vector_search,
    generate_embeddings,
    deterministic_fallback_embedding,
)

logger = logging.getLogger("scribex.layer2_vault")


async def retrieve_hybrid_context(
    user_id: str = settings.default_user_id,
    query: str = "",
    limit: int = 5,
) -> dict[str, Any]:
    """Execute triple hybrid retrieval combining FTS5, LanceDB vectors, and Graph edges."""
    if not query.strip():
        return {
            "matched_notes": [],
            "semantic_chunks": [],
            "graph_edges": [],
            "formatted_context": "",
        }

    # 1. Keyword search via SQLite FTS5 (BM25)
    fts_results = await search_notes_fts(user_id=user_id, query_term=query, limit=limit)

    # 2. Semantic search via LanceDB
    query_vectors = await generate_embeddings([query])
    query_vec = query_vectors[0] if query_vectors else deterministic_fallback_embedding(query)
    vector_chunks = vector_search(user_id=user_id, query_vector=query_vec, limit=limit)

    # 3. Collect unique note IDs across both searches
    seen_note_ids: set[str] = set()
    for item in fts_results:
        seen_note_ids.add(item["id"])
    for chunk in vector_chunks:
        if chunk.get("note_id"):
            seen_note_ids.add(chunk["note_id"])

    # 4. Fetch full notes and expand graph edges
    matched_notes: list[dict[str, Any]] = []
    all_edges: list[dict[str, Any]] = []

    for nid in seen_note_ids:
        note = await get_note_by_id(user_id=user_id, note_id=nid)
        if note:
            # Query graph connections
            edges = await get_connected_edges(user_id=user_id, entity_id=nid)
            note["connected_edges"] = edges
            matched_notes.append(note)
            all_edges.extend(edges)

    # Sort matched notes by priority score descending
    matched_notes.sort(key=lambda n: n.get("priority_score", 0.5), reverse=True)

    # 5. Build clean, compact formatted context block for LLM prompt injection
    context_lines = ["=== SCRIBEX LAYER 2: RELEVANT NOTES & GRAPH CONTEXT ==="]

    if not matched_notes and not vector_chunks:
        context_lines.append("*(No existing notes directly matched this query)*")
    else:
        for n in matched_notes[:limit]:
            context_lines.append(
                f"[Note: {n['title']} | ID: {n['id']} | Group: `{n['group_name']}` | Priority: {n['priority_score']:.2f}]"
            )
            # Add truncated snippet or body
            body_preview = n["content_markdown"].strip()[:400]
            context_lines.append(body_preview)

            if n.get("connected_edges"):
                edge_strs = [f"{e['relation_type']} -> `{e['target_id']}`" for e in n["connected_edges"]]
                context_lines.append(f"  * Relations: {', '.join(edge_strs)}")
            context_lines.append("--------------------------------------------------")

        if vector_chunks:
            context_lines.append("\n[Semantic Memory Excerpts]")
            for c in vector_chunks[:3]:
                context_lines.append(f"- (Relevance Score: {c['score']:.3f}): {c['text'][:200]}...")

    context_lines.append("======================================================")
    formatted_context = "\n".join(context_lines)

    return {
        "matched_notes": matched_notes,
        "semantic_chunks": vector_chunks,
        "graph_edges": all_edges,
        "formatted_context": formatted_context,
    }
