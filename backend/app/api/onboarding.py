"""ScribeX Onboarding API.

Provides endpoints for the interactive multi-turn interview flow that guides
new users through building their foundational personal profile and seed vault notes.
"""

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user_id
from app.agents.onboarding_agent import (
    start_onboarding_session,
    process_onboarding_turn,
    finalize_onboarding_session,
    get_active_session,
    PILLARS,
)

router = APIRouter(prefix="/api/v1/onboarding", tags=["Onboarding"])


class StartOnboardingResponse(BaseModel):
    """Response returned upon initializing onboarding."""

    session_id: str
    current_pillar_index: int
    current_pillar_name: str
    question: str
    is_complete: bool


class OnboardingTurnRequest(BaseModel):
    """Payload for submitting user answers during onboarding."""

    session_id: str = Field(..., description="Active onboarding interview session ID.")
    message: str = Field(..., description="User's conversational response to the current pillar.")


class OnboardingTurnResponse(BaseModel):
    """Response returned after processing an onboarding turn."""

    session_id: str
    current_pillar_index: int
    current_pillar_name: str
    question: str
    is_complete: bool


class FinalizeOnboardingRequest(BaseModel):
    """Payload to finalize and commit the onboarding profile."""

    session_id: str = Field(..., description="Active onboarding interview session ID.")


class FinalizeOnboardingResponse(BaseModel):
    """Result of profile synthesis and seed note creation."""

    status: str
    user_id: str
    identity_file: str
    profile: dict[str, Any]
    created_notes_count: int
    created_notes: list[dict[str, Any]]
    message: str


@router.post("/start", response_model=StartOnboardingResponse)
async def start_onboarding(
    user_id: str = Depends(get_current_user_id),
) -> StartOnboardingResponse:
    """Start an interactive onboarding interview session."""
    session, initial_question = start_onboarding_session(user_id=user_id)
    return StartOnboardingResponse(
        session_id=session.session_id,
        current_pillar_index=0,
        current_pillar_name=PILLARS[0]["name"],
        question=initial_question,
        is_complete=False,
    )


@router.post("/message", response_model=OnboardingTurnResponse)
async def submit_turn(
    payload: OnboardingTurnRequest,
) -> OnboardingTurnResponse:
    """Submit a response to the current pillar question and receive the next question."""
    try:
        session, next_question = await process_onboarding_turn(
            session_id=payload.session_id,
            user_message=payload.message,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    curr_idx = min(session.current_pillar_index, len(PILLARS) - 1)
    pillar_name = PILLARS[curr_idx]["name"] if not session.is_complete else "Completed"

    return OnboardingTurnResponse(
        session_id=session.session_id,
        current_pillar_index=session.current_pillar_index,
        current_pillar_name=pillar_name,
        question=next_question,
        is_complete=session.is_complete,
    )


@router.post("/finalize", response_model=FinalizeOnboardingResponse)
async def finalize_onboarding(
    payload: FinalizeOnboardingRequest,
) -> FinalizeOnboardingResponse:
    """Compile the onboarding interview into _core/identity.md and seed starter notes."""
    try:
        result = await finalize_onboarding_session(session_id=payload.session_id)
        return FinalizeOnboardingResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/session/{session_id}")
async def get_session_status(
    session_id: str,
) -> dict[str, Any]:
    """Retrieve the current state and answer draft of an ongoing onboarding session."""
    session = get_active_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found.",
        )
    return session.model_dump()
