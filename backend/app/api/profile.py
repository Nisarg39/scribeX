"""ScribeX Layer 1 Core Identity & Profile API.

Provides endpoints to view and update the living cognitive identity profile
stored in the Git Vault (_core/identity.md) and inspect the identity timeline.
"""

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user_id
from app.memory.layer1_identity import (
    CoreProfile,
    load_core_profile,
    save_core_profile,
    build_layer1_prompt,
)
from app.storage.sqlite_db import get_timeline, record_timeline_event

router = APIRouter(prefix="/api/v1/profile", tags=["Profile"])


class UpdateProfileRequest(BaseModel):
    full_name: str | None = None
    role_and_mindset: str | None = None
    career_journey: str | None = None
    long_term_vision: str | None = None
    short_term_goals: list[str] | None = None
    core_values: list[str] | None = None
    daily_routines: list[str] | None = None
    change_reason: str | None = "Manual profile update from UI"


class ProfileOverviewResponse(BaseModel):
    profile: CoreProfile
    layer1_prompt: str
    identity_file: str = "_core/identity.md"


@router.get("", response_model=ProfileOverviewResponse)
async def get_profile(
    user_id: str = Depends(get_current_user_id),
) -> ProfileOverviewResponse:
    """Retrieve the current living core profile and compiled Layer 1 RAM prompt."""
    profile = load_core_profile(user_id)
    prompt = await build_layer1_prompt(user_id=user_id, bypass_cache=True)

    return ProfileOverviewResponse(
        profile=profile,
        layer1_prompt=prompt,
    )


@router.put("", response_model=ProfileOverviewResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    user_id: str = Depends(get_current_user_id),
) -> ProfileOverviewResponse:
    """Update core profile attributes, commit changes to Git vault, and record in timeline."""
    existing = load_core_profile(user_id)

    updated = CoreProfile(
        full_name=payload.full_name if payload.full_name is not None else existing.full_name,
        role_and_mindset=payload.role_and_mindset if payload.role_and_mindset is not None else existing.role_and_mindset,
        career_journey=payload.career_journey if payload.career_journey is not None else existing.career_journey,
        long_term_vision=payload.long_term_vision if payload.long_term_vision is not None else existing.long_term_vision,
        short_term_goals=payload.short_term_goals if payload.short_term_goals is not None else existing.short_term_goals,
        core_values=payload.core_values if payload.core_values is not None else existing.core_values,
        daily_routines=payload.daily_routines if payload.daily_routines is not None else existing.daily_routines,
    )

    # Save to Git Vault
    save_core_profile(user_id=user_id, profile=updated, author_type="user")

    # Log to identity_timeline if role or vision changed
    if payload.role_and_mindset and payload.role_and_mindset != existing.role_and_mindset:
        await record_timeline_event(
            user_id=user_id,
            attribute="role_and_mindset",
            old_value=existing.role_and_mindset,
            new_value=payload.role_and_mindset,
            change_reason=payload.change_reason or "User edited role & mindset",
        )

    prompt = await build_layer1_prompt(user_id=user_id, bypass_cache=True)

    return ProfileOverviewResponse(
        profile=updated,
        layer1_prompt=prompt,
    )


@router.get("/timeline", response_model=list[dict[str, Any]])
async def get_identity_evolution_timeline(
    attribute: str | None = None,
    limit: int = 50,
    user_id: str = Depends(get_current_user_id),
) -> list[dict[str, Any]]:
    """Retrieve historical evolution log for the user's cognitive profile."""
    return await get_timeline(user_id=user_id, attribute=attribute, limit=limit)
