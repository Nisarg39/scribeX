"""Binary Asset Ingestion & Lifecycle API.

Handles multipart file/audio uploads, writes to vault/_assets/, extracts content
via OCR/Whisper/parsers, and broadcasts the WebSocket 'ASSET_PROCESSED' event.
"""

import hashlib
import os
from pathlib import Path
from typing import Any
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.api.deps import get_current_user_id
from app.api.sync_ws import ws_manager
from app.storage.file_parser import parse_uploaded_file
from app.storage.paths import get_vault_path
from app.storage.sqlite_db import get_asset_record, save_asset_record, update_asset_status

router = APIRouter(prefix="/api/v1/assets", tags=["Assets"])


class AssetResponse(BaseModel):
    id: str
    file_name: str
    mime_type: str
    size_bytes: int
    storage_key: str
    processing_status: str
    extracted_text: str | None = None
    created_at: str | None = None


@router.post("/upload", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
async def upload_asset(
    file: UploadFile = File(...),
    note_id: str | None = Form(default=None),
    block_id: str | None = Form(default=None),
    user_id: str = Depends(get_current_user_id),
) -> AssetResponse:
    """Upload a binary asset (image, PDF, audio, document) to the tenant's Git Vault.

    1. Stores binary in vault/_assets/{asset_id}_{filename}.
    2. Computes SHA256 checksum and size.
    3. Triggers text extraction (PDF, TXT, CSV, MD) synchronously.
    4. Records asset in the operational SQLite database.
    5. Broadcasts the 'ASSET_PROCESSED' event to all active client sockets.
    """
    asset_id = f"ast_{uuid.uuid4().hex[:10]}"
    safe_name = (file.filename or "upload.bin").replace(" ", "_")
    storage_key = f"_assets/{asset_id}_{safe_name}"

    vault_dir = get_vault_path(user_id)
    assets_dir = vault_dir / "_assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    dest_file = assets_dir / f"{asset_id}_{safe_name}"

    # Write file to disk and compute hash
    hasher = hashlib.sha256()
    size_bytes = 0

    try:
        with open(dest_file, "wb") as f:
            while chunk := await file.read(64 * 1024):
                f.write(chunk)
                hasher.update(chunk)
                size_bytes += len(chunk)
    except Exception as e:
        if dest_file.exists():
            os.remove(dest_file)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write asset to disk: {e}",
        )

    sha256_hash = hasher.hexdigest()
    mime_type = file.content_type or "application/octet-stream"

    # Extract text if supported document format (PDF, TXT, CSV, MD, JSON)
    extracted_text = None
    processing_status = "completed"

    ext = Path(safe_name).suffix.lower()
    from app.storage.file_parser import IMAGE_EXTENSIONS, AUDIO_EXTENSIONS, VIDEO_EXTENSIONS
    if ext not in (IMAGE_EXTENSIONS | AUDIO_EXTENSIONS | VIDEO_EXTENSIONS):
        try:
            parsed = parse_uploaded_file(dest_file, filename=safe_name)
            extracted_text = parsed.get("content_markdown") or None
        except Exception:
            # Non-text binary asset (e.g. image/audio) or unparsable
            pass

    # Save asset record in operational SQLite
    record = await save_asset_record(
        user_id=user_id,
        asset_id=asset_id,
        storage_key=storage_key,
        file_name=file.filename or safe_name,
        mime_type=mime_type,
        size_bytes=size_bytes,
        sha256_hash=sha256_hash,
        processing_status=processing_status,
        extracted_text=extracted_text,
    )

    # Broadcast ASSET_PROCESSED WebSocket event to all tenant devices
    await ws_manager.broadcast_event(
        user_id=user_id,
        data={
            "type": "ASSET_PROCESSED",
            "asset_id": asset_id,
            "note_id": note_id,
            "block_id": block_id,
            "file_name": file.filename or safe_name,
            "storage_key": storage_key,
            "extracted_text": extracted_text,
            "mime_type": mime_type,
            "size_bytes": size_bytes,
        },
    )

    return AssetResponse(
        id=record["id"],
        file_name=record["file_name"],
        mime_type=record["mime_type"],
        size_bytes=record["size_bytes"],
        storage_key=record["storage_key"],
        processing_status=record["processing_status"],
        extracted_text=record["extracted_text"],
    )


@router.get("/{asset_id}/status", response_model=AssetResponse)
async def get_asset_status(
    asset_id: str,
    user_id: str = Depends(get_current_user_id),
) -> AssetResponse:
    """Retrieve status and metadata for a specific uploaded asset."""
    record = await get_asset_record(user_id=user_id, asset_id=asset_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset '{asset_id}' not found.",
        )

    return AssetResponse(
        id=record["id"],
        file_name=record["file_name"],
        mime_type=record["mime_type"],
        size_bytes=record["size_bytes"],
        storage_key=record["storage_key"],
        processing_status=record["processing_status"],
        extracted_text=record.get("extracted_text"),
        created_at=record.get("created_at"),
    )


@router.get("/{asset_id}/file")
async def download_asset_file(
    asset_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Serve the raw binary file for an asset from the tenant's Git Vault."""
    import mimetypes
    from app.core.config import settings

    record = await get_asset_record(user_id=user_id, asset_id=asset_id)
    file_path = None
    mime_type = "application/octet-stream"
    filename = "download"

    if record:
        vault_dir = get_vault_path(user_id)
        candidate = vault_dir / record["storage_key"]
        if candidate.exists():
            file_path = candidate
            mime_type = record.get("mime_type") or "application/octet-stream"
            filename = record.get("file_name") or "download"

    # Fallback if unauthenticated GET (e.g. from <img> tags or RN <Image source={{ uri }} />)
    if not file_path or not file_path.exists():
        matches = list(settings.data_dir.resolve().glob(f"**/_assets/{asset_id}_*"))
        if matches:
            file_path = matches[0]
            guessed_mime, _ = mimetypes.guess_type(file_path.name)
            mime_type = guessed_mime or "application/octet-stream"
            filename = file_path.name.split(f"{asset_id}_", 1)[-1]

    if not file_path or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset '{asset_id}' not found.",
        )

    return FileResponse(
        path=str(file_path),
        media_type=mime_type,
        filename=filename,
    )
