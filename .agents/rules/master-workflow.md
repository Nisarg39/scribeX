---
trigger: always_on
description: Mandatory 3-step Auto-Planning & Command Orchestration workflow before any implementation.
---

# Master Workflow Rule: Auto-Planning & Command Orchestration (Mandatory)

On **every prompt where the user assigns a task, feature, refactor, or bugfix** (even inside an existing conversation), **DO NOT begin implementation immediately** unless the user explicitly says to execute an already-approved plan. You MUST automatically execute this 3-step workflow first:

1. **Draft the Plan (File):** Create or update [`implementation_plan.md`](../../implementation_plan.md) in the workspace root. Briefly outline the architecture, steps, and required files.
2. **Command Analysis (File):** At the bottom of [`implementation_plan.md`](../../implementation_plan.md), evaluate the complexity of the task against all available Antigravity slash commands (`/swarm`, `/teamwork`, `/boost`, `/run-workflow`, `/plan`, `/grill-me`, `/goal`, etc.). Write a `## Recommended Execution` section stating which command fits best and why.
3. **Concise User Response (Chat):** Reply in the chat with a strictly short, 1–2 sentence summary of the approach. End your response by telling the user the exact slash command they should type next to trigger the execution efficiently.
