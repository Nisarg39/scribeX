# Phase 1: Step-by-Step Implementation Plan
## ScribeX VPS Backend Core, Operational Storage & 4-Layer Memory Engine

> **Document Status:** Active Tracking Document  
> **Target Directory:** `backend/`  
> **Architecture Alignment:** Fully adheres to [Technical_System_Architecture.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md) and [SaaS_Architecture_and_Integration_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/SaaS_Architecture_and_Integration_Plan.md).

---

## 1. Master Progress Tracker

Use this checklist to track execution. Every step must be implemented, tested, and verified before marking as completed and moving to the next step.

| Step | Milestone / Component | Primary Files | Status |
| :---: | :--- | :--- | :---: |
| **1** | [Backend Scaffolding, Config & SaaS Path Resolver](#step-1-backend-scaffolding-environment--saas-path-resolver) | `pyproject.toml`, `app/core/config.py`, `app/storage/paths.py`, `app/main.py` | `[x] COMPLETED` |
| **2** | [Operational SQLite Engine (WAL Mode + Core Schemas)](#step-2-operational-sqlite-engine-wal-mode--core-schemas) | `app/storage/sqlite_db.py`, `app/db/schemas.sql` | `[x] COMPLETED` |
| **3** | [Git-Backed Markdown Vault Projector (`GitPython`)](#step-3-git-backed-markdown-vault-projector-gitpython) | `app/storage/git_vault.py` | `[x] COMPLETED` |
| **4** | [Embedded LanceDB Vector Engine & Document Parser](#step-4-embedded-lancedb-vector-engine--file-parser) | `app/storage/lancedb_store.py`, `app/storage/file_parser.py` | `[x] COMPLETED` |
| **5** | [Cognitive Memory Layers (Layer 1 Identity & Layer 2 Graph)](#step-5-cognitive-memory-engine-layers-1--2) | `app/memory/layer1_identity.py`, `app/memory/layer2_vault.py` | `[x] COMPLETED` |
| **6** | [Universal Intake Router & Ask-Before-Write Ambiguity Gate](#step-6-universal-intake--ask-before-write-gate) | `app/api/intake.py`, `app/agents/intake_agent.py` | `[x] COMPLETED` |
| **7** | [Interactive Onboarding Interview Flow API](#step-7-interactive-onboarding-interview-flow-api) | `app/api/onboarding.py`, `app/agents/onboarding_agent.py` | `[ ] PENDING` |
| **8** | [Phase 1 Integration Test Suite & Verification](#step-8-phase-1-integration-test-suite--verification) | `tests/test_storage.py`, `tests/test_vault.py`, `tests/test_intake.py` | `[ ] PENDING` |

---

## 2. Detailed Step-by-Step Milestones

---

### Step 1: Backend Scaffolding, Environment & SaaS Path Resolver
* **Objective:** Establish the Python project structure, package dependencies, environment settings, and tenant-isolated directory resolver so all storage is SaaS-ready from Day 1.
* **Deliverables:**
  * `backend/pyproject.toml`: Modern packaging with dependencies:
    * `fastapi`, `uvicorn[standard]`, `pydantic`, `pydantic-settings`
    * `aiosqlite`, `GitPython`, `lancedb`, `pyarrow`
    * `litellm`, `pydantic-ai`
    * `markitdown`, `pymupdf`
    * `pytest`, `pytest-asyncio`, `httpx`
  * `backend/app/core/config.py`: Central settings managing API keys, data directories, default model IDs, and environment variables.
  * `backend/app/storage/paths.py`: Tenant path resolver implementing:
    * `get_tenant_dir(user_id: str = "default_user") -> Path`
    * `get_vault_path(user_id: str = "default_user") -> Path`
    * `get_sqlite_path(user_id: str = "default_user") -> Path`
    * `get_lancedb_path(user_id: str = "default_user") -> Path`
  * `backend/app/api/deps.py`: `get_current_user_id()` dependency defaulting to `"default_user"` for Phase 1.
  * `backend/app/main.py`: FastAPI application entry point with lifespan event handling directory creation and healthcheck endpoint (`GET /health`).
* **Verification Criteria:**
  * Running `uvicorn app.main:app` boots cleanly with zero errors.
  * `GET /health` returns `{"status": "healthy", "service": "ScribeX Core VPS"}`.
  * Test verifies `/data/tenants/default_user/{vault,sqlite,lancedb}` directories are created automatically.

---

### Step 2: Operational SQLite Engine (WAL Mode + Core Schemas)
* **Objective:** Create the central high-performance operational database engine in WAL mode with complete tables for notes, sync deltas, graph edges, and timelines.
* **Deliverables:**
  * `backend/app/storage/sqlite_db.py`: Async connection manager (`aiosqlite`) enforcing:
    * `PRAGMA journal_mode = WAL;`
    * `PRAGMA synchronous = NORMAL;`
    * `PRAGMA foreign_keys = ON;`
    * `PRAGMA busy_timeout = 5000;`
  * Core Schemas created on startup:
    1. `notes`: `id`, `user_id`, `group_name`, `title`, `content_markdown`, `priority_score`, `sync_rev`, `created_at`, `updated_at`.
    2. `sync_changelog`: `id`, `user_id`, `sync_rev`, `entity_type`, `entity_id`, `change_type`, `delta_payload`, `created_at`.
    3. `entity_edges`: `id`, `user_id`, `source_id`, `relation_type`, `target_id`, `created_at`.
    4. `identity_timeline`: `id`, `user_id`, `attribute`, `old_value`, `new_value`, `change_reason`, `git_commit_sha`, `valid_from`, `valid_to`.
    5. `learned_preferences`: `id`, `user_id`, `category`, `preference_rule`, `confidence_score`, `source_diff_sha`, `created_at`.
  * Helper functions for atomic note transactions and incrementing `sync_rev`.
* **Verification Criteria:**
  * SQLite WAL files (`-wal`, `-shm`) initialize properly on startup.
  * Note insert/update atomic transaction increments `sync_rev` monotonically.
  * Multi-concurrent async reads and writes pass under stress test with 0 database lock errors.

---

### Step 3: Git-Backed Markdown Vault Projector (`GitPython`)
* **Objective:** Build the projection engine that watches or accepts SQLite note commits and asynchronously writes them out as physical `.md` files in a local Git repository, with author attribution for diff learning.
* **Deliverables:**
  * `backend/app/storage/git_vault.py`:
    * Initializes Git repo in tenant vault directory if `.git` does not exist.
    * Method `project_note_to_vault(user_id, note_id, group, title, content, priority, tags, author_type)`:
      * Formats file with YAML frontmatter:
        ```markdown
        ---
        id: note_123
        group: Projects
        priority: 0.8
        tags: [frontend, ai]
        ---
        # Note Title
        Note content...
        ```
      * Writes to `{vault_dir}/{group}/{sanitized_title}.md`.
      * Stages and commits with author:
        * If `author_type == "ai"`: `ScribeX-AI <ai@assistant.local>`
        * If `author_type == "user"`: `User <user@assistant.local>`
    * Method `get_git_diff(user_id, commit_sha)` returning exact line-by-line diff.
    * Method `get_file_history(user_id, file_path)` returning historical commits for that note.
* **Verification Criteria:**
  * Projecting a note creates physical `.md` file on disk.
  * Git commit log registers the commit with exact author attribution.
  * Subsequent edit produces accurate `git diff` output through Python API.

---

### Step 4: Embedded LanceDB Vector Engine & File Parser
* **Objective:** Establish serverless on-disk vector search using LanceDB for semantic note search, plus file ingestion utilities.
* **Deliverables:**
  * `backend/app/storage/lancedb_store.py`:
    * Embedded LanceDB connection to tenant lancedb directory.
    * Vector table `note_chunks`: `chunk_id`, `user_id`, `note_id`, `text`, `vector`, `metadata`.
    * Methods:
      * `index_note_chunks(user_id, note_id, text_chunks, embeddings)`
      * `delete_note_chunks(user_id, note_id)`
      * `vector_search(user_id, query_vector, limit=5)`
  * `backend/app/storage/file_parser.py`:
    * Integration with `MarkItDown` / `PyMuPDF` to parse PDF, DOCX, TXT, and Markdown uploads into clean structured text.
* **Verification Criteria:**
  * Inserting 5 text chunks into LanceDB and running a cosine similarity search returns the correct top-ranking chunk in $< 5\text{ ms}$.
  * Parsing a sample PDF returns clean markdown text.

---

### Step 5: Cognitive Memory Engine (Layers 1 & 2)
* **Objective:** Implement Layer 1 (Always-Active Core Identity cached in RAM) and Layer 2 (Living Notes & Relationship Graph retrieval).
* **Deliverables:**
  * `backend/app/memory/layer1_identity.py`:
    * Reads `_core/identity.md` from the Git Vault.
    * Generates a compact system prompt injection ($\sim 1,500$ tokens) summarizing:
      * User identity & values
      * Current top 3 priorities & short-term goals
      * Directory map of all active note groups
    * Caches result in memory with an invalidation trigger on identity updates.
  * `backend/app/memory/layer2_vault.py`:
    * Hybrid Context Retriever:
      1. Keyword/Exact match (SQLite FTS5)
      2. Semantic match (LanceDB vector search)
      3. Graph connection expansion (pulling connected goals/projects from `entity_edges`)
* **Verification Criteria:**
  * Layer 1 generates a clean, token-bounded prompt string.
  * Layer 2 queries return synthesized context merging direct note content and connected graph relations.

---

### Step 6: Universal Intake & Ask-Before-Write Gate
* **Objective:** Build the single universal entry point endpoint (`POST /api/v1/intake`) that analyzes raw input against memory, evaluates ambiguity, and enforces the "Clarification Over Assumption" rule.
* **Deliverables:**
  * `backend/app/agents/intake_agent.py`:
    * Pydantic schemas:
      ```python
      class IntakeAnalysis(BaseModel):
          clarity_score: float  # 0.0 to 1.0
          ambiguity_detected: bool
          clarifying_questions: list[str]
          proposed_action: Literal["create_new_note", "update_existing_note", "add_task", "clarify"]
          target_note_id: str | None
          suggested_group: str
          extracted_title: str
          refined_content: str
          priority_score: float
          linked_goal_ids: list[str]
      ```
    * LiteLLM prompt orchestrator comparing input against Layer 1 & 2 context.
  * `backend/app/api/intake.py`:
    * `POST /api/v1/intake` (accepts raw text, voice transcript, or file upload).
    * Gate logic:
      * If `clarity_score < 0.85` or `ambiguity_detected == True`:
        * Stores raw input in `staging_intake` table.
        * Returns `status: "NEEDS_CLARIFICATION"` with `clarifying_questions`.
      * If clear (`clarity_score >= 0.85`):
        * Executes atomic write: SQLite commit $\rightarrow$ Git Vault projection $\rightarrow$ LanceDB vector indexing.
        * Returns `status: "PROCESSED"` with note details and suggested next actions.
* **Verification Criteria:**
  * Sending an ambiguous prompt (e.g. *"Update the project specs"*) triggers a clarifying question without touching the vault.
  * Sending an unambiguous note (e.g. *"Finished client onboarding checklist for Acme Corp"*) cleanly updates the right note and commits to Git.

---

### Step 7: Interactive Onboarding Interview Flow API
* **Objective:** Implement the multi-turn conversational interview engine that gathers the foundational personal profile for a new user.
* **Deliverables:**
  * `backend/app/agents/onboarding_agent.py`:
    * Guides user through the 6 profile pillars:
      1. Personal Identity & routines
      2. Career journey & past milestones
      3. Long-term life vision
      4. Short-term active goals
      5. Current active projects & obligations
      6. Daily checklists & habits
    * Synthesis engine that compiles conversation history into:
      * `_core/identity.md` (for Layer 1)
      * Initial note entries in SQLite (for Layer 2)
  * `backend/app/api/onboarding.py`:
    * `POST /api/v1/onboarding/start`: Initializes session.
    * `POST /api/v1/onboarding/message`: Accepts user turn, returns next intelligent question.
    * `POST /api/v1/onboarding/finalize`: Generates profile files, commits initial Git state, and activates the assistant.
* **Verification Criteria:**
  * Simulated multi-turn dialogue successfully produces a comprehensive `_core/identity.md` file.
  * Git vault receives initial onboarding commit authored by `ScribeX-AI`.

---

### Step 8: Phase 1 Integration Test Suite & Verification
* **Objective:** Run a full automated end-to-end test suite confirming all backend subsystems work together reliably.
* **Deliverables:**
  * `backend/tests/test_storage.py`: SQLite WAL operations, concurrent writes, `sync_rev` increments.
  * `backend/tests/test_vault.py`: Git projection, commit logs, author tagging, and diff extraction.
  * `backend/tests/test_memory.py`: Layer 1 prompt generation and Layer 2 hybrid context retrieval.
  * `backend/tests/test_intake.py`: Ambiguity gate triggers, clarifying questions, and clean note updates.
  * `backend/tests/test_onboarding.py`: Full onboarding flow synthesis.
* **Verification Criteria:**
  * `pytest` runs and all tests pass with $100\%$ green status.

---

## 3. How We Track and Execute

1. We work on **one step at a time**.
2. Before starting a step, we mark its status as `[ ] IN_PROGRESS` in this document.
3. Once the step's code is written and verified against its test criteria, we mark it as `[x] COMPLETED` and move to the next step.
4. Git commits will reference the specific step (e.g., `feat(phase1): step 1 - backend scaffolding and path resolver`).
