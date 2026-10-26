"""ScribeX Universal Intake API.

Provides the single universal entry point for raw thoughts, voice transcripts,
and document uploads, guarded by the 'Ask-Before-Write' Ambiguity Gate.
"""

from typing import Literal, Any
import os
import shutil
import tempfile
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.api.deps import get_current_user_id
from app.agents.intake_agent import analyze_intake, IntakeAnalysis
from app.storage.sqlite_db import (
    save_staging_intake,
    get_staging_intake,
    update_staging_status,
    list_staging_intakes,
    get_note_by_id,
    add_edge,
)
from app.storage.sync_projector import save_and_project_note
from app.storage.lancedb_store import index_note_chunks
from app.storage.file_parser import parse_uploaded_file
from app.api.sync_ws import ws_manager

router = APIRouter(prefix="/api/v1/intake", tags=["Intake"])


class IntakeRequest(BaseModel):
    """Payload for submitting raw text or voice transcript to ScribeX."""

    raw_input: str = Field(..., description="Raw thought, note content, or voice transcript.")
    source_type: Literal["text", "voice", "file"] = Field(
        default="text",
        description="Origin source type of the input.",
    )
    staging_id: str | None = Field(
        default=None,
        description="Optional staging ID if this input is resolving a previous clarification.",
    )


class ClarificationAnswerRequest(BaseModel):
    """Payload for answering clarifying questions for a staged intake."""

    answers: str = Field(..., description="User's clarifying response or additional instructions.")


class IntakeResponse(BaseModel):
    """Standardized response from the universal intake gate."""

    status: Literal["PROCESSED", "NEEDS_CLARIFICATION"]
    message: str
    clarity_score: float
    staging_id: str | None = None
    clarifying_questions: list[str] = Field(default_factory=list)
    note: dict[str, Any] | None = None
    analysis: IntakeAnalysis


async def _execute_intake_write(
    user_id: str,
    analysis: IntakeAnalysis,
    staging_id: str | None = None,
) -> dict[str, Any]:
    """Execute atomic 3-way write: SQLite -> Git Vault -> LanceDB vector store."""
    final_content = analysis.refined_content
    note_id = analysis.target_note_id
    group_name = analysis.suggested_group
    title = analysis.extracted_title

    # If updating an existing note, load previous content and append
    if analysis.proposed_action == "update_existing_note" and note_id:
        existing = await get_note_by_id(user_id=user_id, note_id=note_id)
        if existing:
            group_name = existing["group_name"]
            title = existing["title"]
            # Append new content with a clean separator
            final_content = f"{existing['content_markdown'].rstrip()}\n\n---\n### Update\n{analysis.refined_content.strip()}"

    # 1. Atomic write to SQLite + Git Vault projection
    note_result = await save_and_project_note(
        user_id=user_id,
        group_name=group_name,
        title=title,
        content_markdown=final_content,
        priority_score=analysis.priority_score,
        author_type="ai",
        note_id=note_id,
        commit_message=f"[AI] Intake: {title}",
    )

    actual_note_id = note_result["id"]

    # 2. Vector indexing into LanceDB
    index_note_chunks(
        user_id=user_id,
        note_id=actual_note_id,
        text=final_content,
        metadata={
            "group": group_name,
            "title": title,
            "priority": str(analysis.priority_score),
        },
    )

    # 3. Connect graph edges if linked goals exist
    for goal_id in analysis.linked_goal_ids:
        await add_edge(
            user_id=user_id,
            source_id=actual_note_id,
            relation_type="SERVES_GOAL",
            target_id=goal_id,
        )

    # 4. If this resolved a staged intake, update status
    if staging_id:
        await update_staging_status(user_id=user_id, staging_id=staging_id, status="RESOLVED")

    # 5. Broadcast instant WebSocket doorbell ping to all active devices
    latest_rev = note_result.get("sync_rev")
    if latest_rev:
        try:
            await ws_manager.broadcast_ping(user_id=user_id, latest_sync_rev=latest_rev)
        except Exception:
            pass

    return note_result


@router.post("", response_model=IntakeResponse)
async def process_intake(
    payload: IntakeRequest,
    user_id: str = Depends(get_current_user_id),
) -> IntakeResponse:
    """Universal intake endpoint.
    
    Evaluates raw input against Layer 1 & 2 memory. If clarity is below 0.85
    or ambiguity is detected, holds input in staging and returns clarifying questions.
    Otherwise, commits atomically to SQLite, Git Vault, and LanceDB.
    """
    # Run through the Ask-Before-Write Ambiguity Gate
    analysis = await analyze_intake(
        user_id=user_id,
        raw_input=payload.raw_input,
        source_type=payload.source_type,
    )

    # Ambiguity Gate Rule: clarity_score < 0.85 or ambiguity_detected == True
    if analysis.clarity_score < 0.85 or analysis.ambiguity_detected:
        staging_record = await save_staging_intake(
            user_id=user_id,
            raw_input=payload.raw_input,
            clarity_score=analysis.clarity_score,
            clarifying_questions=analysis.clarifying_questions,
            proposed_action=analysis.proposed_action,
            status="PENDING_CLARIFICATION",
            staging_id=payload.staging_id,
        )

        return IntakeResponse(
            status="NEEDS_CLARIFICATION",
            message="Clarification required before committing to your vault.",
            clarity_score=analysis.clarity_score,
            staging_id=staging_record["id"],
            clarifying_questions=analysis.clarifying_questions,
            note=None,
            analysis=analysis,
        )

    # Clear input: execute atomic write
    note = await _execute_intake_write(
        user_id=user_id,
        analysis=analysis,
        staging_id=payload.staging_id,
    )

    return IntakeResponse(
        status="PROCESSED",
        message="Input successfully processed, committed to Git vault, and indexed.",
        clarity_score=analysis.clarity_score,
        staging_id=None,
        clarifying_questions=[],
        note=note,
        analysis=analysis,
    )


@router.post("/{staging_id}/clarify", response_model=IntakeResponse)
async def answer_clarification(
    staging_id: str,
    payload: ClarificationAnswerRequest,
    user_id: str = Depends(get_current_user_id),
) -> IntakeResponse:
    """Submit user answers to clarifying questions for a staged intake item."""
    staged = await get_staging_intake(user_id=user_id, staging_id=staging_id)
    if not staged:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Staging intake record '{staging_id}' not found.",
        )

    # Combine original raw input with user clarification
    combined_input = f"{staged['raw_input']}\n\nClarification:\n{payload.answers}"

    # Re-evaluate intake with the combined context
    analysis = await analyze_intake(
        user_id=user_id,
        raw_input=combined_input,
        source_type="text",
    )

    if analysis.clarity_score < 0.85 or analysis.ambiguity_detected:
        # Update staged record with latest questions
        await save_staging_intake(
            user_id=user_id,
            raw_input=combined_input,
            clarity_score=analysis.clarity_score,
            clarifying_questions=analysis.clarifying_questions,
            proposed_action=analysis.proposed_action,
            status="PENDING_CLARIFICATION",
            staging_id=staging_id,
        )

        return IntakeResponse(
            status="NEEDS_CLARIFICATION",
            message="Additional clarification still required.",
            clarity_score=analysis.clarity_score,
            staging_id=staging_id,
            clarifying_questions=analysis.clarifying_questions,
            note=None,
            analysis=analysis,
        )

    # Clear now: execute atomic write
    note = await _execute_intake_write(
        user_id=user_id,
        analysis=analysis,
        staging_id=staging_id,
    )

    return IntakeResponse(
        status="PROCESSED",
        message="Clarification accepted. Note successfully committed to Git vault and indexed.",
        clarity_score=analysis.clarity_score,
        staging_id=staging_id,
        clarifying_questions=[],
        note=note,
        analysis=analysis,
    )


@router.get("/staging", response_model=list[dict[str, Any]])
async def get_pending_staging_items(
    user_id: str = Depends(get_current_user_id),
) -> list[dict[str, Any]]:
    """List all staged intake items currently awaiting user clarification."""
    return await list_staging_intakes(user_id=user_id, status="PENDING_CLARIFICATION")


@router.delete("/{staging_id}")
async def discard_staging_item(
    staging_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, str]:
    """Discard a staged intake item."""
    await update_staging_status(user_id=user_id, staging_id=staging_id, status="DISCARDED")
    return {"status": "DISCARDED", "message": f"Staged intake {staging_id} discarded."}


@router.post("/upload", response_model=IntakeResponse)
async def upload_document_intake(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
) -> IntakeResponse:
    """Upload a document (PDF, TXT, MD, CSV, JSON) and route through the intake pipeline."""
    suffix = Path(file.filename or "doc.txt").suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    try:
        parsed = parse_uploaded_file(tmp_path, filename=file.filename or "uploaded_doc")
        raw_text = parsed["content_markdown"]

        # Run extracted text through intake analysis
        analysis = await analyze_intake(
            user_id=user_id,
            raw_input=raw_text,
            source_type="file",
        )

        # Override title if document parser provided an extracted title
        if parsed.get("extracted_title") and analysis.extracted_title == "Untitled Note":
            analysis.extracted_title = parsed["extracted_title"]

        if analysis.clarity_score < 0.85 or analysis.ambiguity_detected:
            staging_record = await save_staging_intake(
                user_id=user_id,
                raw_input=raw_text,
                clarity_score=analysis.clarity_score,
                clarifying_questions=analysis.clarifying_questions,
                proposed_action=analysis.proposed_action,
                status="PENDING_CLARIFICATION",
            )
            return IntakeResponse(
                status="NEEDS_CLARIFICATION",
                message="Clarification required for uploaded document before committing to vault.",
                clarity_score=analysis.clarity_score,
                staging_id=staging_record["id"],
                clarifying_questions=analysis.clarifying_questions,
                note=None,
                analysis=analysis,
            )

        note = await _execute_intake_write(user_id=user_id, analysis=analysis)
        return IntakeResponse(
            status="PROCESSED",
            message=f"Document '{file.filename}' parsed and saved to Git vault.",
            clarity_score=analysis.clarity_score,
            staging_id=None,
            clarifying_questions=[],
            note=note,
            analysis=analysis,
        )

    finally:
        if tmp_path.exists():
            os.remove(tmp_path)
