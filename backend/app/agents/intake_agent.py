"""ScribeX Universal Intake Agent & Ask-Before-Write Ambiguity Gate.

Enforces the core ScribeX architectural tenet: 'Clarification Over Assumption'.
Evaluates incoming raw input against Layer 1 (Identity) and Layer 2 (Vault/Graph)
memory to assess clarity, detect ambiguity, suggest categorization, and generate
clarifying questions when the user's intent is underspecified.
"""

from typing import Literal, Any
import json
import logging
import re
from pydantic import BaseModel, Field
import litellm

from app.core.config import settings
from app.memory.layer1_identity import build_layer1_prompt
from app.memory.layer2_vault import retrieve_hybrid_context

logger = logging.getLogger("scribex.intake_agent")


class IntakeAnalysis(BaseModel):
    """Structured assessment produced by the Ask-Before-Write gate."""

    clarity_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score from 0.0 (vague/ambiguous) to 1.0 (crystal clear).",
    )
    ambiguity_detected: bool = Field(
        ...,
        description="True if input lacks critical specifics (e.g. target note, explicit details).",
    )
    clarifying_questions: list[str] = Field(
        default_factory=list,
        description="Targeted, proactive clarifying questions if ambiguity is detected.",
    )
    proposed_action: Literal["create_new_note", "update_existing_note", "add_task", "clarify"] = Field(
        ...,
        description="The recommended next action for the operational storage engine.",
    )
    target_note_id: str | None = Field(
        default=None,
        description="ID of the existing note to update, if applicable.",
    )
    suggested_group: str | None = Field(
        default="Inbox",
        description="Recommended note group or folder in the user's vault.",
    )
    extracted_title: str | None = Field(
        default="Untitled Note",
        description="Synthesized title for the note.",
    )
    refined_content: str | None = Field(
        default="",
        description="Polished markdown content ready for atomic vault projection.",
    )
    priority_score: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Estimated priority score based on urgency, goals, and user context.",
    )
    linked_goal_ids: list[str] = Field(
        default_factory=list,
        description="IDs of active goals or projects connected to this intake item.",
    )


def _rule_based_fallback(
    raw_input: str,
    layer2_bundle: dict[str, Any],
) -> IntakeAnalysis:
    """Deterministic fallback evaluator when LLM is unavailable or offline.
    
    Ensures zero downtime and reliable test execution by detecting common ambiguity patterns.
    """
    clean_text = raw_input.strip()
    lower_text = clean_text.lower()

    # Vague and ambiguous trigger patterns
    ambiguous_patterns = [
        r"^update the (project|specs|spec|code|docs|file|notes|doc)$",
        r"^update (it|this|that|specs)$",
        r"^add (that|this|something|it)$",
        r"^follow up (on that|with them|later)$",
        r"^check (it|specs|the progress)$",
        r"^fix (the bug|it)$",
    ]

    is_ambiguous = any(re.search(pat, lower_text) for pat in ambiguous_patterns)

    # If extremely short and without specifics
    if len(clean_text) < 30 and not any(k in lower_text for k in [":", "-", "http", "deadline", "by "]):
        for vword in ["update", "fix", "add", "change", "review", "check", "edit"]:
            if lower_text.startswith(vword) and len(lower_text.split()) <= 4:
                is_ambiguous = True
                break

    if is_ambiguous:
        return IntakeAnalysis(
            clarity_score=0.55,
            ambiguity_detected=True,
            clarifying_questions=[
                "Which specific project or note are you referring to?",
                "Could you provide more context on the changes or items you'd like to add?",
            ],
            proposed_action="clarify",
            target_note_id=None,
            suggested_group="Inbox",
            extracted_title="Pending Clarification",
            refined_content=clean_text,
            priority_score=0.5,
            linked_goal_ids=[],
        )

    # Check if this maps cleanly to an existing note in Layer 2 context
    matched_notes = layer2_bundle.get("matched_notes", [])
    target_id = None
    action: Literal["create_new_note", "update_existing_note", "add_task", "clarify"] = "create_new_note"
    group = "Inbox"

    if matched_notes:
        top_note = matched_notes[0]
        # If top note title matches words in query or query explicitly mentions update
        if top_note["title"].lower() in lower_text or "update" in lower_text:
            target_id = top_note["id"]
            action = "update_existing_note"
            group = top_note.get("group_name", "Inbox")

    # Detect suggested group based on keywords
    if not target_id:
        if any(w in lower_text for w in ["goal", "vision", "milestone"]):
            group = "Goals"
        elif any(w in lower_text for w in ["project", "spec", "architecture", "system", "feature"]):
            group = "Projects"
        elif any(w in lower_text for w in ["checklist", "daily", "routine", "habit"]):
            group = "Habits"
        elif any(w in lower_text for w in ["meeting", "interview", "call", "discussion"]):
            group = "Meetings"

    # Extract clean title from first line or summary
    first_line = clean_text.split("\n")[0].strip("# ").strip()
    extracted_title = first_line[:60] if first_line else "New Note"

    return IntakeAnalysis(
        clarity_score=0.95,
        ambiguity_detected=False,
        clarifying_questions=[],
        proposed_action=action,
        target_note_id=target_id,
        suggested_group=group,
        extracted_title=extracted_title,
        refined_content=clean_text,
        priority_score=0.75 if "urgent" in lower_text or "priority" in lower_text else 0.5,
        linked_goal_ids=[],
    )


async def analyze_intake(
    user_id: str,
    raw_input: str,
    source_type: str = "text",
    model: str | None = None,
) -> IntakeAnalysis:
    """Analyze incoming raw intake against Layer 1 & Layer 2 memory using LiteLLM."""
    clean_input = raw_input.strip()
    if not clean_input:
        return IntakeAnalysis(
            clarity_score=0.0,
            ambiguity_detected=True,
            clarifying_questions=["What would you like me to note or organize for you?"],
            proposed_action="clarify",
            target_note_id=None,
            suggested_group="Inbox",
            extracted_title="Empty Input",
            refined_content="",
            priority_score=0.0,
            linked_goal_ids=[],
        )

    # 1. Fetch Cognitive Memory Context
    layer1_prompt = await build_layer1_prompt(user_id=user_id)
    layer2_bundle = await retrieve_hybrid_context(user_id=user_id, query=clean_input, limit=4)
    layer2_prompt = layer2_bundle["formatted_context"]

    # 2. Prepare LLM system instructions
    system_prompt = f"""You are the ScribeX Universal Intake Agent ("Friday"), an ultra-sharp personal knowledge assistant.
Your job is to evaluate raw incoming user text/voice notes and decide whether to write directly to the vault or ask clarifying questions.

=== ARCHITECTURAL GOLDEN RULE: CLARIFICATION OVER ASSUMPTION ===
1. Ambiguity Detection:
   - If the user's intent is underspecified, vague, or references missing context (e.g. "update the specs", "add that thing", "follow up tomorrow" without saying which project/client/note), you MUST:
     * Set `ambiguity_detected = true`
     * Set `clarity_score` < 0.85 (e.g. 0.40 - 0.70)
     * Set `proposed_action = "clarify"`
     * Provide 1 to 3 polite, targeted `clarifying_questions`.
2. Clear Unambiguous Input & Documents:
   - If the input contains sufficient information (e.g. "Finished client onboarding checklist for Acme Corp", "Meeting with Sarah about Q3 budget: agreed on $50k allocation", or an uploaded document with headings and structured text), you MUST:
     * Set `ambiguity_detected = false`
     * Set `clarity_score` >= 0.85 (typically 0.90 to 1.0)
     * Decide if this updates an existing note found in Layer 2 context (`proposed_action = "update_existing_note"`, `target_note_id = "<id>"`) or starts a new note (`proposed_action = "create_new_note"`, `target_note_id = null`).
     * Set `suggested_group` (e.g. Projects, Goals, Habits, Meetings, Inbox, Archive).
     * Set `extracted_title` and format `refined_content` into clean, well-structured Markdown.
     * Estimate `priority_score` (0.0 to 1.0).

=== USER LAYER 1 COGNITIVE IDENTITY ===
{layer1_prompt}

=== USER LAYER 2 RETRIEVED NOTES & GRAPH CONTEXT ===
{layer2_prompt}

Output pure JSON matching the schema:
{{
  "clarity_score": float,
  "ambiguity_detected": boolean,
  "clarifying_questions": ["question1", ...],
  "proposed_action": "create_new_note" | "update_existing_note" | "add_task" | "clarify",
  "target_note_id": string | null,
  "suggested_group": string,
  "extracted_title": string,
  "refined_content": string,
  "priority_score": float,
  "linked_goal_ids": [string, ...]
}}
"""

    selected_model = model or settings.default_model

    try:
        response = await litellm.acompletion(
            model=selected_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Intake Source ({source_type}):\n{clean_input}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )

        content = response.choices[0].message.content
        data = json.loads(content)
        # Sanitize potentially null values
        data["suggested_group"] = data.get("suggested_group") or "Inbox"
        data["extracted_title"] = data.get("extracted_title") or "Untitled Note"
        data["refined_content"] = data.get("refined_content") or clean_input
        data["clarifying_questions"] = data.get("clarifying_questions") or []
        data["linked_goal_ids"] = data.get("linked_goal_ids") or []
        return IntakeAnalysis(**data)

    except Exception as e:
        logger.warning(f"LiteLLM intake evaluation failed or offline ({e}). Using deterministic rule-based fallback.")
        return _rule_based_fallback(clean_input, layer2_bundle)
