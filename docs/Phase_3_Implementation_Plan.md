# Phase 3: Step-by-Step Implementation Plan
## Cognitive Memory, Friday AI Assistant & Universal MCP Integration

> **Document Status:** Architectural Implementation Blueprint (Active Single Source of Truth)  
> **Target Directories:** `backend/app/api/ai/`, `backend/lib/ai/`, `frontend/src/screens/`, `connector/`  
> **Source of Truth Specifications:**  
> - [Technical_System_Architecture.md (Sections 4 & 6)](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Technical_System_Architecture.md)  
> - [Universal_AI_Connector_and_MCP_Architecture.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Universal_AI_Connector_and_MCP_Architecture.md)  
> - [Learning_Storing_Retrieval_Strategy.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Learning_Storing_Retrieval_Strategy.md)  
> - [Master_Tasks_Tracker.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Master_Tasks_Tracker.md)  

---

## 1. Master Progress Tracker

Use this checklist to track execution. Every step must be implemented, tested, and verified before marking as completed and moving to the next step.

| Step | Milestone / Component | Primary Files | Status |
| :---: | :--- | :--- | :---: |
| **1** | [Friday Conversational Assistant Core & Proactive Daily Briefings](#step-1-friday-conversational-assistant-core--proactive-daily-briefings) | `backend/lib/ai/FridayBrain.ts`, `backend/app/api/ai/chat/route.ts`, `frontend/src/screens/AssistantScreen.tsx` | `[ ] PENDING` |
| **2** | [User-Initiated Interactive Discovery Interview (Onboarding Flow)](#step-2-user-initiated-interactive-discovery-interview) | `backend/lib/ai/onboarding.ts`, `frontend/src/screens/OnboardingScreen.tsx` | `[ ] PENDING` |
| **3** | [Universal Intake Router & Ask-Before-Write Ambiguity Gate](#step-3-universal-intake-router--ask-before-write-ambiguity-gate) | `backend/app/api/ai/intake/route.ts`, `backend/lib/ai/ambiguityGate.ts`, `frontend/src/components/intake/ClarificationModal.tsx` | `[ ] PENDING` |
| **4** | [Layer 1 Memory: Core Identity & Always-Active Context Index](#step-4-layer-1-memory-core-identity--always-active-context-index) | `backend/lib/ai/memory/layer1Identity.ts`, Supabase `user_profile` table | `[ ] PENDING` |
| **5** | [Layer 2 Memory: Living Notes & pgvector Semantic Store](#step-5-layer-2-memory-living-notes--pgvector-semantic-store) | `backend/lib/ai/memory/layer2Vault.ts`, Supabase `pgvector` embeddings | `[ ] PENDING` |
| **6** | [Layer 3 Memory: Temporal Identity Timeline ("Versions of Me") & Task Logs](#step-6-layer-3-memory-temporal-identity-timeline-versions-of-me--task-logs) | `backend/lib/ai/memory/layer3Temporal.ts`, Supabase `identity_timeline` table | `[ ] PENDING` |
| **7** | [Layer 4 Memory: Behavioral & Preference Ledger with Edit Learning](#step-7-layer-4-memory-behavioral--preference-ledger-with-edit-learning) | `backend/lib/ai/memory/layer4Learner.ts`, Supabase `learned_preferences` table | `[ ] PENDING` |
| **8** | [Multi-Modal Background Extraction Pipeline (Cloud Whisper STT & Document OCR)](#step-8-multi-modal-background-extraction-pipeline) | `backend/app/api/ai/transcribe/route.ts`, `frontend/src/core/ocr/` | `[ ] PENDING` |
| **9** | [Proactive Background Scheduler & Sleep-Cycle Memory Consolidation](#step-9-proactive-background-scheduler--sleep-cycle-memory-consolidation) | Next.js Vercel Cron jobs (`vercel.json`), Supabase `pg_cron` | `[ ] PENDING` |
| **10** | [Phase 3 Master Verification Suite & Cognitive Integration Testing](#step-10-phase-3-master-verification-suite--cognitive-integration-testing) | `scripts/test_cognitive_integration.mjs` | `[ ] PENDING` |
| **11** | [Universal AI Connector & MCP Server (Cross-AI Context & Tool Parity)](#step-11-universal-ai-connector--mcp-server-cross-ai-context--tool-parity) | `connector/src/server.ts`, `connector/src/tools/`, `connector/src/rest/` | `[ ] PENDING` |

---

## 2. Detailed Step-by-Step Milestones

### Step 1: Friday Conversational Assistant Core & Proactive Daily Briefings
* **Objective:** Deploy Friday as an intelligent, context-aware companion with a fluid conversational chat surface in the client app.
* **Key Features:**
  * Context injection from Layer 1 (Identity) and Layer 2 (Active Projects & Notes).
  * Morning briefing generation analyzing high-priority tasks and calendar events.
  * Natural language query interface over the entire personal vault.

---

### Step 2: User-Initiated Interactive Discovery Interview (Onboarding Flow)
* **Objective:** Allow the user to introduce themselves to Friday whenever they choose, capturing foundational personal details without blocking note creation.
* **Captures:**
  * Personal background, core values, daily habits.
  * Career journey milestones and transitions.
  * Short-term priorities (next 30–90 days) and long-term vision.

---

### Step 3: Universal Intake Router & Ask-Before-Write Ambiguity Gate
* **Objective:** Ensure the AI never silently guesses, assumes, or hallucinates note destinations or file updates.
* **Mechanism:**
  * When input has ambiguous placement or conflicting facts, Friday evaluates `clarity_score`.
  * If `clarity_score < 0.85`, it holds the update in staging and prompts the user via a concise clarification modal (`ClarificationModal.tsx`).
  * User confirmation commits the update atomically to SQLite and Supabase PostgreSQL.

---

### Step 4: Layer 1 Memory: Core Identity & Always-Active Context Index
* **Objective:** Always-in-RAM compact summary ($\sim 1,500$ tokens) injected into every AI prompt so Friday never forgets who the user is, their top goals, or existing note categories.

---

### Step 5: Layer 2 Memory: Living Notes & pgvector Semantic Store
* **Objective:** Hybrid search combining full-text search and dense vector embeddings (via Supabase PostgreSQL `pgvector`) for sub-5ms semantic retrieval across all notes and documents.

---

### Step 6: Layer 3 Memory: Temporal Identity Timeline ("Versions of Me") & Task Logs
* **Objective:** Bi-temporal tracking of personal growth, mindset shifts, and task completion history.
* **Capabilities:**
  * Answers temporal questions: "How did my career focus evolve between 2024 and 2026?"
  * Preserves immutable historical snapshots without cluttering active notes.

---

### Step 7: Layer 4 Memory: Behavioral & Preference Ledger with Edit Learning
* **Objective:** Automatically learn the user's filing habits, formatting preferences, and communication style by comparing user manual edits against AI proposals.
* **Mechanism:**
  * Analyzes manual adjustments to learn filing preferences (e.g., user prefers bullet lists over paragraphs for meeting summaries).
  * Auto-updates Supabase `learned_preferences` to refine Friday's future actions.

---

### Step 8: Multi-Modal Background Extraction Pipeline
* **Objective:** Transcribe audio recordings via Cloud Whisper STT (`/api/ai/transcribe`) and extract structured text from camera scans and documents via client-side OCR (`frontend/src/core/ocr/`).

---

### Step 9: Proactive Background Scheduler & Sleep-Cycle Memory Consolidation
* **Objective:** Periodic Vercel Cron jobs (`vercel.json`) and Supabase `pg_cron` functions to recalculate task priorities, detect duplicate notes, synthesize daily summaries, and archive completed tasks.

---

### Step 10: Phase 3 Master Verification Suite & Cognitive Integration Testing
* **Objective:** Headless test suite validating ambiguity gating, memory layer retrieval, diff learning, and conversational flow.
* **Verification Command:**
  ```bash
  node scripts/test_cognitive_integration.mjs
  ```

---

### Step 11: Universal AI Connector & MCP Server (Cross-AI Context & Tool Parity)
* **Objective:** Bridge ScribeX's 4-layer cognitive memory, vault query engine, task ledger, and hardware push reminder scheduler to external AI clients (Claude Desktop, Google Gemini, OpenAI ChatGPT, Cursor, local Ollama) with 100% feature and context parity to the in-app Friday assistant.
* **Deliverables:**
  * **MCP Server (`connector/src/server.ts`):** Implements Model Context Protocol over `stdio` and SSE transports exposing vault resources (`scribex://vault/identity`, `scribex://tasks/today`, `scribex://notes/{id}`) and prompts (`daily-briefing`, `synthesize-meeting`).
  * **Unified Tool Handlers (`connector/src/tools/`):** Strongly typed agentic tools (`search_vault`, `read_note`, `create_note`, `update_note`, `create_task`, `toggle_task`, `schedule_reminder`).
  * **Hardware Push Alarm & Event-Sourcing Integration:** Any task or reminder scheduled by an external AI triggers the local device hardware alarm via `NotificationService` and records deltas into `sync_changelog` with monotonic `sync_rev`.
  * **OpenAI & Anthropic REST Gateway (`connector/src/rest/`):** `/v1/chat/completions` bridge enabling ChatGPT Custom Actions and external webhooks to use ScribeX context.
  * **Specification Reference:** [Universal_AI_Connector_and_MCP_Architecture.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Universal_AI_Connector_and_MCP_Architecture.md).
* **Verification Command:**
  ```bash
  node scripts/test_connector_headless.mjs
  ```
