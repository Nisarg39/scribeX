"""ScribeX Onboarding Agent & Conversational Interview Engine.

Guides a new user through the 6 foundational profile pillars:
1. Personal Identity & Mindset
2. Career Journey & Past Milestones
3. Long-Term Life Vision
4. Short-Term Active Goals (3-6 months)
5. Current Active Projects & Obligations
6. Daily Checklists & Habits

Synthesizes conversation history into _core/identity.md (Layer 1)
and starter structured notes and graph edges in SQLite & Git Vault (Layer 2).
"""

from typing import Any
import uuid
import logging
import json
import re
from pydantic import BaseModel, Field
import litellm

from app.core.config import settings
from app.memory.layer1_identity import CoreProfile, save_core_profile
from app.storage.sync_projector import save_and_project_note
from app.storage.lancedb_store import index_note_chunks
from app.storage.sqlite_db import add_edge

logger = logging.getLogger("scribex.onboarding_agent")

PILLARS = [
    {
        "index": 0,
        "name": "Personal Identity & Mindset",
        "default_question": (
            "Welcome to ScribeX. I'm Friday, your proactive personal assistant. "
            "To begin organizing your world, let's align on who you are. "
            "What is your full name, your primary role or focus, and what mindset drives you every day?"
        ),
    },
    {
        "index": 1,
        "name": "Career Journey & Milestones",
        "default_question": (
            "Thank you. Now let's explore your background. "
            "Could you share a brief overview of your career journey, key milestones, or defining experiences?"
        ),
    },
    {
        "index": 2,
        "name": "Long-Term Life Vision",
        "default_question": (
            "Understood. Looking forward 5 to 10 years, what is your ultimate life vision? "
            "What legacy, major breakthroughs, or lifestyle are you working toward?"
        ),
    },
    {
        "index": 3,
        "name": "Short-Term Active Goals",
        "default_question": (
            "Inspiring vision. To bridge that vision into reality, what are your top 2 or 3 active goals "
            "for the next 3 to 6 months?"
        ),
    },
    {
        "index": 4,
        "name": "Current Active Projects & Obligations",
        "default_question": (
            "Excellent. What specific active projects, deliverables, or major commitments are currently on your plate right now?"
        ),
    },
    {
        "index": 5,
        "name": "Daily Checklists & Habits",
        "default_question": (
            "Almost done. What are your non-negotiable daily routines, rituals, or habits that keep you sharp and on track?"
        ),
    },
]


class OnboardingSession(BaseModel):
    """In-memory state machine tracking the user's multi-turn onboarding interview."""

    session_id: str
    user_id: str
    current_pillar_index: int = 0
    is_complete: bool = False
    history: list[dict[str, str]] = Field(default_factory=list)
    answers: dict[str, str] = Field(default_factory=dict)
    extracted_projects: list[str] = Field(default_factory=list)
    extracted_goals: list[str] = Field(default_factory=list)


# In-memory session registry (user_id -> OnboardingSession)
_ACTIVE_SESSIONS: dict[str, OnboardingSession] = {}


def get_active_session(session_id: str) -> OnboardingSession | None:
    """Retrieve an active onboarding session by session ID."""
    return _ACTIVE_SESSIONS.get(session_id)


def start_onboarding_session(user_id: str = settings.default_user_id) -> tuple[OnboardingSession, str]:
    """Initialize a fresh onboarding interview session for the user."""
    session_id = str(uuid.uuid4())
    initial_question = PILLARS[0]["default_question"]

    session = OnboardingSession(
        session_id=session_id,
        user_id=user_id,
        current_pillar_index=0,
        is_complete=False,
        history=[{"role": "assistant", "content": initial_question}],
        answers={},
    )

    _ACTIVE_SESSIONS[session_id] = session
    logger.info(f"Initialized onboarding session '{session_id}' for user '{user_id}'.")
    return session, initial_question


async def process_onboarding_turn(
    session_id: str,
    user_message: str,
    model: str | None = None,
) -> tuple[OnboardingSession, str]:
    """Process a turn in the onboarding interview and advance through the 6 pillars."""
    session = _ACTIVE_SESSIONS.get(session_id)
    if not session:
        raise ValueError(f"Onboarding session '{session_id}' not found.")

    if session.is_complete:
        return session, "Your onboarding interview is already complete. You can finalize your profile."

    curr_idx = session.current_pillar_index
    curr_pillar = PILLARS[curr_idx]
    pillar_name = curr_pillar["name"]

    # Record user message
    session.history.append({"role": "user", "content": user_message})
    session.answers[pillar_name] = user_message

    # Rule-based / extraction heuristics for goals and projects
    if curr_idx == 3:  # Short-Term Goals
        # Extract individual goals by splitting on newlines, bullets, or commas
        goals = [g.strip("- *").strip() for g in user_message.split("\n") if g.strip()]
        if not goals or len(goals) == 1:
            goals = [g.strip() for g in user_message.split(",") if g.strip()]
        session.extracted_goals = [g for g in goals if len(g) > 3][:5]

    elif curr_idx == 4:  # Current Projects
        projects = [p.strip("- *").strip() for p in user_message.split("\n") if p.strip()]
        if not projects or len(projects) == 1:
            projects = [p.strip() for p in user_message.split(",") if p.strip()]
        session.extracted_projects = [p for p in projects if len(p) > 3][:5]

    # Advance to next pillar
    next_idx = curr_idx + 1

    if next_idx >= len(PILLARS):
        session.is_complete = True
        session.current_pillar_index = len(PILLARS)
        completion_msg = (
            "Brilliant! We've covered all 6 foundational pillars of your personal profile. "
            "I'm now ready to synthesize your living profile into your Git vault and initialize your workspace."
        )
        session.history.append({"role": "assistant", "content": completion_msg})
        return session, completion_msg

    session.current_pillar_index = next_idx
    next_pillar = PILLARS[next_idx]
    next_question = next_pillar["default_question"]

    # If LLM is available, craft a contextual, conversational transition
    selected_model = model or settings.default_model
    try:
        transition_prompt = (
            f"You are Friday, an elite personal executive AI assistant. "
            f"The user just answered pillar '{pillar_name}' with: '{user_message}'. "
            f"Acknowledge their answer with brevity, warmth, and sharpness (1 sentence), "
            f"then transition naturally to ask the next pillar's question:\n'{next_question}'"
        )
        resp = await litellm.acompletion(
            model=selected_model,
            messages=[{"role": "user", "content": transition_prompt}],
            temperature=0.3,
            max_tokens=200,
        )
        conversational_question = resp.choices[0].message.content.strip()
    except Exception as e:
        logger.debug(f"LLM transition unavailable ({e}), using default pillar question.")
        conversational_question = next_question

    session.history.append({"role": "assistant", "content": conversational_question})
    return session, conversational_question


async def finalize_onboarding_session(
    session_id: str,
) -> dict[str, Any]:
    """Compile interview answers into _core/identity.md and seed initial project/goal notes."""
    session = _ACTIVE_SESSIONS.get(session_id)
    if not session:
        raise ValueError(f"Onboarding session '{session_id}' not found.")

    user_id = session.user_id
    answers = session.answers

    # 1. Synthesize CoreProfile
    # Extract identity & mindset
    identity_raw = answers.get("Personal Identity & Mindset", "User")
    name_match = re.search(r"(?:name is|i am|i'm|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", identity_raw, re.IGNORECASE)
    full_name = name_match.group(1) if name_match else identity_raw.split(",")[0].split(".")[0].strip()[:40]
    if not full_name:
        full_name = "User"

    career_raw = answers.get("Career Journey & Milestones", "")
    vision_raw = answers.get("Long-Term Life Vision", "")
    goals_list = session.extracted_goals or ["Build high-impact projects", "Master personal knowledge workflows"]
    projects_list = session.extracted_projects or ["ScribeX Assistant Setup"]
    routines_raw = answers.get("Daily Checklists & Habits", "Morning routine, evening review")
    routines_list = [r.strip("- *").strip() for r in routines_raw.split("\n") if r.strip()]
    if not routines_list or len(routines_list) == 1:
        routines_list = [r.strip() for r in routines_raw.split(",") if r.strip()]

    profile = CoreProfile(
        full_name=full_name,
        role_and_mindset=identity_raw,
        career_journey=career_raw,
        long_term_vision=vision_raw,
        short_term_goals=goals_list,
        core_values=["Proactive execution", "Zero blind assumptions", "Continuous mastery"],
        daily_routines=routines_list[:5],
    )

    # 2. Save Layer 1 identity profile (_core/identity.md committed to Git)
    identity_file = save_core_profile(user_id=user_id, profile=profile, author_type="ai")

    # 3. Seed initial starter notes for Goals (Layer 2)
    created_notes: list[dict[str, Any]] = []
    goal_note_ids: list[str] = []

    for idx, goal_text in enumerate(goals_list[:3]):
        goal_title = f"Goal: {goal_text[:50]}"
        note = await save_and_project_note(
            user_id=user_id,
            group_name="Goals",
            title=goal_title,
            content_markdown=f"# {goal_title}\n\n**Target Horizon:** 3-6 Months\n\n### Objective\n{goal_text}\n\n### Milestones\n- [ ] Define initial requirements\n- [ ] Execute sprint 1\n- [ ] Review progress",
            priority_score=0.95 - (idx * 0.05),
            tags=["goal", "active"],
            author_type="ai",
            commit_message=f"[AI] Onboarding: Seeded goal note '{goal_title}'",
        )
        index_note_chunks(
            user_id=user_id,
            note_id=note["id"],
            text=note["content_markdown"],
            metadata={"group": "Goals", "title": goal_title},
        )
        created_notes.append(note)
        goal_note_ids.append(note["id"])

    # 4. Seed initial starter notes for Projects (Layer 2) and link to Goals
    for idx, proj_text in enumerate(projects_list[:3]):
        proj_title = f"Project: {proj_text[:50]}"
        note = await save_and_project_note(
            user_id=user_id,
            group_name="Projects",
            title=proj_title,
            content_markdown=f"# {proj_title}\n\n**Status:** Active\n\n### Overview\n{proj_text}\n\n### Key Deliverables\n- [ ] Architecture design\n- [ ] Implementation\n- [ ] Deployment",
            priority_score=0.90 - (idx * 0.05),
            tags=["project", "active"],
            author_type="ai",
            commit_message=f"[AI] Onboarding: Seeded project note '{proj_title}'",
        )
        index_note_chunks(
            user_id=user_id,
            note_id=note["id"],
            text=note["content_markdown"],
            metadata={"group": "Projects", "title": proj_title},
        )
        created_notes.append(note)

        # Connect graph edge to first goal if available
        if goal_note_ids:
            await add_edge(
                user_id=user_id,
                source_id=note["id"],
                relation_type="SERVES_GOAL",
                target_id=goal_note_ids[0],
            )

    logger.info(f"Finalized onboarding for user '{user_id}'. Seeded {len(created_notes)} starter notes.")

    # Clean up active session
    _ACTIVE_SESSIONS.pop(session_id, None)

    return {
        "status": "ONBOARDING_COMPLETED",
        "user_id": user_id,
        "identity_file": str(identity_file),
        "profile": profile.model_dump(),
        "created_notes_count": len(created_notes),
        "created_notes": created_notes,
        "message": f"Welcome aboard, {profile.full_name}! Your cognitive identity and vault are fully initialized.",
    }
