"""Embedded LanceDB Vector Engine for ScribeX.

Provides serverless on-disk vector storage and semantic similarity search
stored directly on the VPS NVMe SSD (data/lancedb) with sub-5ms latency.
"""

from pathlib import Path
from typing import Any
import hashlib
import json
import logging
import math
import os
import uuid
import lancedb
import pyarrow as pa

from app.core.config import settings
from app.storage.paths import get_lancedb_path

logger = logging.getLogger("scribex.lancedb")

TABLE_NAME = "note_chunks"
VECTOR_DIM = 1536  # Standard dimension for text-embedding-3-small


def get_lancedb(user_id: str = settings.default_user_id) -> lancedb.DBConnection:
    """Connect to the embedded LanceDB database on local disk."""
    db_path = get_lancedb_path(user_id)
    return lancedb.connect(str(db_path))


def _table_exists(db, name: str) -> bool:
    try:
        tables = db.list_tables()
        table_list = tables.tables if hasattr(tables, "tables") else list(tables)
        return name in table_list
    except Exception:
        return name in db.table_names()


def get_or_create_chunks_table(user_id: str = settings.default_user_id):
    """Retrieve or initialize the note_chunks vector table in LanceDB."""
    db = get_lancedb(user_id)
    if _table_exists(db, TABLE_NAME):
        return db.open_table(TABLE_NAME)

    # Define schema using PyArrow
    schema = pa.schema([
        pa.field("chunk_id", pa.string()),
        pa.field("user_id", pa.string()),
        pa.field("note_id", pa.string()),
        pa.field("text", pa.string()),
        pa.field("vector", pa.list_(pa.float32(), VECTOR_DIM)),
        pa.field("metadata_json", pa.string()),
    ])

    return db.create_table(TABLE_NAME, schema=schema)


def deterministic_fallback_embedding(text: str, dim: int = VECTOR_DIM) -> list[float]:
    """Generate a normalized deterministic pseudo-embedding vector.

    Used for unit tests and offline environments with zero network latency and $0 cost.
    """
    cleaned = text.lower().strip()
    vector = []
    for i in range(dim):
        seed_str = f"{cleaned}:{i}"
        val = int(hashlib.sha256(seed_str.encode("utf-8")).hexdigest()[:8], 16)
        # Normalize to float between -1.0 and 1.0
        normalized = (val / 0xFFFFFFFF) * 2.0 - 1.0
        vector.append(normalized)

    # L2 normalize vector
    magnitude = math.sqrt(sum(x * x for x in vector))
    if magnitude > 0:
        vector = [x / magnitude for x in vector]

    return vector


async def generate_embeddings(
    texts: list[str],
    model: str = "text-embedding-3-small",
    use_fallback: bool = False,
) -> list[list[float]]:
    """Generate vector embeddings using LiteLLM, with fallback support."""
    if not texts:
        return []

    # If fallback is explicitly requested or no API key is configured
    api_key = os.getenv("OPENAI_API_KEY") or settings.openai_api_key
    if use_fallback or not api_key:
        return [deterministic_fallback_embedding(t, VECTOR_DIM) for t in texts]

    try:
        import litellm
        response = await litellm.aembedding(model=model, input=texts)
        return [item["embedding"] for item in response.data]
    except Exception as e:
        logger.warning(f"Live embedding API call failed ({e}); using deterministic fallback embedding.")
        return [deterministic_fallback_embedding(t, VECTOR_DIM) for t in texts]


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into overlapping semantic chunks for vector indexing."""
    cleaned = text.strip()
    if not cleaned:
        return []

    # Split by paragraphs first
    paragraphs = [p.strip() for p in cleaned.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [cleaned]

    chunks: list[str] = []
    current_chunk = ""

    for p in paragraphs:
        if len(current_chunk) + len(p) <= chunk_size:
            current_chunk = f"{current_chunk}\n\n{p}".strip() if current_chunk else p
        else:
            if current_chunk:
                chunks.append(current_chunk)
            # If paragraph itself is larger than chunk_size, split by sentences/lines
            if len(p) > chunk_size:
                start = 0
                while start < len(p):
                    end = start + chunk_size
                    chunks.append(p[start:end].strip())
                    start += (chunk_size - overlap)
                current_chunk = ""
            else:
                current_chunk = p

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def index_note_chunks(
    user_id: str,
    note_id: str,
    text: str,
    vectors: list[list[float]] | None = None,
    metadata: dict[str, Any] | None = None,
) -> int:
    """Index a note's text chunks into LanceDB vector database."""
    table = get_or_create_chunks_table(user_id)

    # 1. Delete previous chunks for this note to prevent duplicates
    delete_note_chunks(user_id, note_id)

    chunks = chunk_text(text)
    if not chunks:
        return 0

    if not vectors or len(vectors) != len(chunks):
        vectors = [deterministic_fallback_embedding(c, VECTOR_DIM) for c in chunks]

    meta_json = json.dumps(metadata or {})
    records = []
    for i, (chunk, vec) in enumerate(zip(chunks, vectors)):
        records.append({
            "chunk_id": f"{note_id}_chunk_{i}_{uuid.uuid4().hex[:6]}",
            "user_id": user_id,
            "note_id": note_id,
            "text": chunk,
            "vector": vec,
            "metadata_json": meta_json,
        })

    table.add(records)
    logger.info(f"Indexed {len(records)} vector chunks for note '{note_id}' in LanceDB.")
    return len(records)


def delete_note_chunks(user_id: str, note_id: str) -> None:
    """Delete all vector chunks associated with a specific note."""
    db = get_lancedb(user_id)
    if not _table_exists(db, TABLE_NAME):
        return

    table = db.open_table(TABLE_NAME)
    # LanceDB delete syntax using SQL filter
    try:
        table.delete(f"user_id = '{user_id}' AND note_id = '{note_id}'")
    except Exception as e:
        logger.debug(f"Note delete filter in LanceDB: {e}")


def vector_search(
    user_id: str,
    query_vector: list[float],
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Perform fast cosine similarity search in LanceDB on local disk."""
    db = get_lancedb(user_id)
    if not _table_exists(db, TABLE_NAME):
        return []

    table = db.open_table(TABLE_NAME)
    results = (
        table.search(query_vector)
        .where(f"user_id = '{user_id}'")
        .limit(limit)
        .to_list()
    )

    formatted = []
    for r in results:
        formatted.append({
            "chunk_id": r["chunk_id"],
            "note_id": r["note_id"],
            "text": r["text"],
            "score": r.get("_distance", 0.0),
            "metadata": json.loads(r.get("metadata_json", "{}")),
        })

    return formatted
