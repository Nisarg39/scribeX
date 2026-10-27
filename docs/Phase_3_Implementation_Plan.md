# Phase 3: Step-by-Step Implementation Plan
## Cognitive Memory & Friday AI Assistant Integration

> **Document Status:** Architectural Implementation Blueprint  
> **Target Directories:** `backend/app/agents/`, `backend/app/memory/`, `frontend/src/screens/`  
> **Source of Truth Specifications:**  
> - [Technical_System_Architecture.md (Sections 4 & 6)](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md)  
> - [Learning_Storing_Retrieval_Strategy.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Learning_Storing_Retrieval_Strategy.md)  
> - [Universal_Note_Input_Structure_and_Relations.md (Section 4)](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Universal_Note_Input_Structure_and_Relations.md)  
> - [Master_Tasks_Tracker.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Master_Tasks_Tracker.md)  

---

## 1. Master Progress Tracker

Use this checklist to track execution. Every step must be implemented, tested, and verified before marking as completed and moving to the next step.

| Step | Milestone / Component | Primary Files | Status |
| :---: | :--- | :--- | :---: |
| **1** | [Friday Conversational Assistant Core & Proactive Daily Briefings](#step-1-friday-conversational-assistant-core--proactive-daily-briefings) | `backend/app/agents/orchestrator.py`, `frontend/src/screens/AssistantScreen.tsx` | `[ ] PENDING` |
| **2** | [User-Initiated Interactive Discovery Interview (Onboarding Flow)](#step-2-user-initiated-interactive-discovery-interview) | `backend/app/agents/onboarding_agent.py`, `frontend/src/screens/OnboardingScreen.tsx` | `[ ] PENDING` |
| **3** | [Universal Intake Router & Ask-Before-Write Ambiguity Gate](#step-3-universal-intake-router--ask-before-write-ambiguity-gate) | `backend/app/api/intake.py`, `backend/app/agents/intake_agent.py`, `frontend/src/components/intake/ClarificationModal.tsx` | `[ ] PENDING` |
| **4** | [Layer 1 Memory: Core Identity & Always-Active Context Index](#step-4-layer-1-memory-core-identity--always-active-context-index) | `backend/app/memory/layer1_identity.py`, `data/vault/{user_id}/_core/identity.md` | `[ ] PENDING` |
| **5** | [Layer 2 Memory: Living Notes & LanceDB Vector Semantic Store](#step-5-layer-2-memory-living-notes--lancedb-vector-semantic-store) | `backend/app/memory/layer2_vault.py`, `backend/app/storage/lancedb_store.py` | `[ ] PENDING` |
| **6** | [Layer 3 Memory: Temporal Identity Timeline ("Versions of Me") & Task Logs](#step-6-layer-3-memory-temporal-identity-timeline-versions-of-me--task-logs) | `backend/app/memory/layer3_temporal.py`, `frontend/src/screens/TimelineScreen.tsx` | `[ ] PENDING` |
| **7** | [Layer 4 Memory: Behavioral & Preference Ledger with Git Diff Learning](#step-7-layer-4-memory-behavioral--preference-ledger-with-git-diff-learning) | `backend/app/memory/layer4_learner.py`, `backend/app/storage/diff_analyzer.py` | `[ ] PENDING` |
| **8** | [Multi-Modal Background Extraction Pipeline (Whisper & Document OCR)](#step-8-multi-modal-background-extraction-pipeline) | `backend/app/storage/file_parser.py` | `[ ] PENDING` |
| **9** | [Proactive Background Scheduler & Sleep-Cycle Memory Consolidation](#step-9-proactive-background-scheduler--sleep-cycle-memory-consolidation) | `backend/app/agents/scheduler.py` | `[ ] PENDING` |
| **10** | [Phase 3 Master Verification Suite & Cognitive Integration Testing](#step-10-phase-3-master-verification-suite--cognitive-integration-testing) | `backend/tests/test_cognitive_integration.py` | `[ ] PENDING` |

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
  * User confirmation commits the update atomically to SQLite, Git Vault, and LanceDB.

---

### Step 4: Layer 1 Memory: Core Identity & Always-Active Context Index
* **Objective:** Always-in-RAM compact summary ($\sim 1,500$ tokens) injected into every AI prompt so Friday never forgets who the user is, their top goals, or existing note categories.

---

### Step 5: Layer 2 Memory: Living Notes & LanceDB Vector Semantic Store
* **Objective:** Hybrid search combining BM25 keyword matching and dense vector embeddings (via serverless embedded LanceDB on the VPS disk) for $< 5$ms semantic retrieval across all notes and documents.

---

### Step 6: Layer 3 Memory: Temporal Identity Timeline ("Versions of Me") & Task Logs
* **Objective:** Bi-temporal tracking of personal growth, mindset shifts, and task completion history.
* **Capabilities:**
  * Answers temporal questions: "How did my career focus evolve between 2024 and 2026?"
  * Preserves immutable historical snapshots without cluttering active notes.

---

### Step 7: Layer 4 Memory: Behavioral & Preference Ledger with Git Diff Learning
* **Objective:** Automatically learn the user's filing habits, formatting preferences, and communication style by comparing user manual edits against AI edits in the Git Vault.
* **Mechanism:**
  * Git commit author differentiation: `ScribeX-AI` vs. `User`.
  * Diff Analyzer extracts preferences (e.g., user prefers bullet lists over paragraphs for meeting summaries).
  * Auto-updates `_core/behavioral_ledger.md` to refine Friday's future actions.

---

### Step 8: Multi-Modal Background Extraction Pipeline
* **Objective:** Background workers transcribe voice notes with Whisper and extract structured text from PDFs, spreadsheets, and images using OCR and document parsers.

---

### Step 9: Proactive Background Scheduler & Sleep-Cycle Memory Consolidation
* **Objective:** Periodic APScheduler jobs running on the VPS to recalculate task priorities, detect duplicate notes, synthesize daily summaries, and archive completed tasks.

---

### Step 10: Phase 3 Master Verification Suite & Cognitive Integration Testing
* **Objective:** Automated test suite validating ambiguity gating, memory layer retrieval, diff learning, and conversational flow.
* **Verification Command:**
  ```bash
  cd backend && pytest tests/test_cognitive_integration.py -v
  ```
