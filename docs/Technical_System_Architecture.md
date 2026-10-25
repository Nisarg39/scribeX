# Technical System Architecture: ScribeX - Friday (Iron man style Personal Assistant)

## 1. Architectural Overview & Core Design Principles

This document defines the production technical architecture for ScribeX - Friday (Iron man style Personal Assistant) & Note-Taking Platform. It is designed to be handed directly to an AI coding assistant to scaffold and implement the system.

### Core Architectural Pillars
1. **Zero-Downtime 24/7 Availability (Lightweight Cloud VPS):** The core FastAPI backend and embedded memory engine run on an always-on lightweight Linux VPS. The assistant remains $100\%$ operational for note-taking, context retrieval, daily briefings, and planning even when the user's personal PC is powered off.
2. **Sub-Millisecond AI Context Retrieval (Embedded VPS Storage):** Instead of making slow network hops to external cloud databases, the VPS stores the Markdown Context Vault, Vector Index, and Temporal Knowledge Graph directly on its local NVMe SSD. FastAPI retrieves context in $< 5\text{ ms}$.
3. **True Local-First Multi-Device Concurrency (SQLite Operational Core + Resilient Sync):** Every client device (iOS, Android, Desktop Web) maintains a local SQLite replica (`expo-sqlite` with OPFS on Web). The app opens instantly ($0\text{ ms}$ network wait) and writes optimistically. Real-time syncing uses an event-sourced revision protocol (`sync_rev`) over WebSockets as an instant push notification ('doorbell'), backed by guaranteed revision catch-up upon reconnection and an HTTP REST fallback endpoint. The central SQLite database serves as the operational synchronization engine, which asynchronously projects updates to the Git Markdown Vault.
4. **Decoupled Remote PC Agentic Execution:** The user's personal PC runs a lightweight background daemon that connects outbound to the Cloud VPS over an encrypted WebSocket tunnel. When the PC is online, it executes tasks via any configured CLI AI agent (Claude Code, Gemini CLI, Codex CLI, Aider, Goose, OpenCode). If the PC is offline, tasks are queued safely on the VPS until the PC comes online.
5. **Day-1 SaaS-Ready Architecture (Zero-Rewrite Commercial Path):** Although initially implemented and deployed for a single user, all database schemas, sync logs, and filesystem vault paths strictly enforce a parameterized `user_id` convention (defaulting to `'default_user'`). This guarantees that transitioning to a multi-tenant commercial SaaS (detailed in `docs/SaaS_Architecture_and_Integration_Plan.md`) requires zero code or schema rewrites.

---

## 2. High-Level System Topology

```
+-----------------------------------------------------------------------------------+
|                        UNIVERSAL EXPO CLIENTS (Local-First)                       |
|                                                                                   |
|  +-------------------------+  +-------------------------+  +-------------------+  |
|  |   Expo iOS / Android    |  |    Expo Desktop Web     |  |   Personal PC     |  |
|  | (Voice, Share Sheet,    |  | (3-Pane IDE, Diff View, |  | Local Vault Mirror|  |
|  |  Push Approvals, Notes) |  |  Manual Context Control)|  |                   |  |
|  +------------+------------+  +------------+------------+  +---------+---------+  |
|               |                            |                         |            |
|  [Local SQLite + MMKV Cache]  [IndexedDB / OPFS SQLite]   [Local Git Workspace]   |
+---------------+----------------------------+-------------------------+------------+
                |                            |                         |
                +----------------------------+-------------------------+
                                             |
                      Bidirectional WSS (Real-Time Delta Sync & RPC)
                                             |
+--------------------------------------------v--------------------------------------+
|                     24/7 LIGHTWEIGHT CLOUD VPS (FastAPI Core)                     |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                        FastAPI Async Application Server                     |  |
|  |  - Universal Intake & Clarification Router   - Multi-Device Delta Sync Hub  |  |
|  |  - 4-Layer Memory Retrieval Orchestrator     - Manual Edit Diff Learner     |  |
|  |  - Proactive Scheduler (APScheduler)         - Remote PC Task Dispatcher    |  |
|  +------+------------------------------+------------------------------+--------+  |
|         | (< 5ms Local SSD Read)       | (< 5ms Local SSD Read)       |           |
|  +------v---------------+    +---------v--------------+    +----------v--------+  |
|  | Git-Backed Markdown  |    |   Embedded SQLite DB   |    | Embedded LanceDB  |  |
|  |    Context Vault     |    | (WAL Mode: Temporal    |    | (Vector Semantic  |  |
|  | (Notes, Profile,     |    |  Identity Graph, Tasks,|    |  Search & Hybrid  |  |
|  |  Commit Diff History)|    |  Behavioral Ledger)    |    |  BM25 Index)      |  |
|  +----------------------+    +------------------------+    +-------------------+  |
+--------------------------------------------+--------------------------------------+
                                             |
                  Encrypted Outbound WSS Tunnel (or Tailscale Mesh)
                                             |
+--------------------------------------------v--------------------------------------+
|                      USER'S PERSONAL PC (Worker Agent Host)                       |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                    Local Python Bridge Daemon (Agent Runner)                |  |
|  |  - Pluggable CLI Adapter Registry (YAML)   - Pre-Task Git Checkpoint Hook   |  |
|  |  - Headless Subprocess PTY/Stream Manager  - Deterministic Verifier Engine  |  |
|  +------+--------------------+--------------------+--------------------+-------+  |
|         |                    |                    |                    |          |
|  +------v------+      +------v------+      +------v------+      +------v------+   |
|  | Claude Code |      | Gemini CLI  |      |  Codex CLI  |      | Aider/Goose |   |
|  +-------------+      +-------------+      +-------------+      +-------------+   |
+-----------------------------------------------------------------------------------+
```

---

## 3. Frontend Architecture: Universal Expo Application

A single **Expo (React Native)** codebase targets **iOS, Android, and Desktop/Mobile Web** using `Expo Router` and `React Native for Web`.

### 3.1. Frontend Tech Stack
* **Framework:** Expo SDK 52+ with **Expo Router** (file-based universal routing).
* **Styling:** **NativeWind (v4)** (Tailwind CSS for React Native & Web) for responsive layouts across mobile screens and large desktop monitors.
* **Local-First Client Database:** **`expo-sqlite`** (uses native SQLite on iOS/Android and WASM + Origin Private File System `OPFS` on Web) paired with **`react-native-mmkv`** for instant UI state and auth token storage.
* **State & Sync Management:** **Zustand** (UI state) + **TanStack Query** + Custom WebSocket Delta Sync Client.
* **Markdown & Diff Editor:**
  * *Web:* Monaco Editor / CodeMirror 6 wrapper for side-by-side `git diff` inspection and rich Markdown editing.
  * *Mobile:* Native-optimized Markdown editor with quick-action formatting bar.

### 3.2. Adaptive Surface Design (Single Codebase, Tailored UX)
* **Mobile Surface (iOS & Android):**
  * **Zero-Friction Universal Input Bar:** Persistent bottom bar supporting text, file attachments, and instant voice recording (streamed to FastAPI for transcription and intake).
  * **Native OS Share Extension (`expo-share-intent`):** Allows sharing PDFs, screenshots, voice memos, or URLs directly from any mobile app into the assistant.
  * **Actionable Push Notifications (`expo-notifications`):** Interactive notification buttons (`[Approve]`, `[Reject]`, `[Reply]`) for answering the AI's clarifying questions or approving sensitive Remote PC CLI actions without opening the full app.
* **Desktop Web Surface:**
  * **3-Pane Command Center Layout:**
    * *Left Pane:* Context Vault File Tree, Dynamic Note Groups, Priority Queue, and Version History Timeline.
    * *Center Pane:* Full Markdown Note Editor, Side-by-Side Diff Viewer (comparing manual edits vs. AI edits), and Onboarding/Profile Dashboard.
    * *Right Pane:* Conversational AI Assistant & Live Remote PC CLI Terminal Stream.

---

## 4. Backend Architecture: FastAPI on Lightweight Cloud VPS

### 4.1. VPS Specifications & Co-Located Storage Advantage
* **Target Hosting:** Any lightweight Linux VPS ($2\text{ vCPU}$, $4\text{ GB RAM}$, $40\text{ GB NVMe SSD}$ — e.g., Hetzner, DigitalOcean, Linode, or AWS Lightsail).
* **Why Co-Located Storage on the VPS:** By storing the Git Markdown Vault, SQLite database, and LanceDB vector index on the VPS's local NVMe filesystem rather than a separate cloud database server, FastAPI performs multi-step hybrid retrieval in $< 5\text{ ms}$ with zero network overhead.

### 4.2. Core Backend Tech Stack
* **API Framework:** **FastAPI** (Python 3.12+, Uvicorn with ASGI workers, native `asyncio` and `WebSockets`).
* **AI Orchestration & Structured Outputs:** **PydanticAI** or **LangGraph** + **LiteLLM** (allowing seamless switching between Gemini, Claude, and OpenAI models for the Main AI brain).
* **Embedded Databases (Zero External DB Maintenance):**
  * **Operational Core: Embedded SQLite (`aiosqlite` in `WAL` mode + `FTS5`):** Serves as the high-throughput operational core on the VPS. Handles the real-time device sync ledger (`sync_changelog` with monotonically increasing `sync_rev`), active notes, checklists, graph relationships (`entity_edges`), and the Temporal Identity timeline ("Versions of Me").
  * **Projected Document Layer: Git-Backed Markdown Vault (`GitPython`):** Asynchronously projected from SQLite changes on the VPS. Every note and profile document is maintained as a human-readable `.md` file with YAML frontmatter inside a local Git repository, serving as the version-controlled document archive, off-site backup, and the primary source for the manual edit diff-learning pipeline.
  * **Semantic Memory: LanceDB (Embedded Disk Mode):** Serverless, file-based vector database stored on the VPS disk for semantic chunk search across notes and uploaded files.
* **Document & Audio Ingestion:** `MarkItDown` / `PyMuPDF` + Vision LLM pipeline for documents, spreadsheets, and images, paired with a lightweight audio transcription pipeline (`faster-whisper` / Whisper API) for persistent voice note capture.
* **Proactive Background Engine:** `APScheduler` (AsyncIOScheduler) running inside FastAPI for daily priority recalculation, morning briefings, and periodic "sleep-cycle" memory consolidation.

---

## 5. Hybrid Local-First Storage & Real-Time Multi-Device Delta Sync

To allow you to use your phone, tablet, and desktop web browser **concurrently** with instant local speed, offline resilience, and zero data loss, the platform uses an **Operational SQLite Delta Sync + Projected Git Markdown Protocol**.

### 5.1. Architecture of Truth: Decoupled Operational & Projection Layers
To ensure maximum speed without file-locking bottlenecks:
1. **Operational Layer (Device-to-Device Sync):** The central **SQLite database on the VPS** serves as the authoritative real-time operational state. All client devices (`expo-sqlite`) sync directly against this SQLite operational core. High-frequency updates (typing notes, checking off tasks, updating priorities) happen as atomic SQLite transactions.
2. **Projection Layer (Git Markdown Vault & LanceDB):** When a note transaction is committed in the operational SQLite database on the VPS, an asynchronous background task projects the update into the physical `.md` file inside the Git Vault and refreshes the LanceDB vector chunks. This completely isolates live typing sync from disk-level Git commit overhead while preserving full Git history, human readability, and diff learning.

### 5.2. Local-First Reading & Optimistic Writes
1. **Instant Local Reads ($0\text{ ms}$):** When you open the Expo app on any device, the UI renders immediately from the local `expo-sqlite` database.
2. **Optimistic Local Writes:** When you edit a note or check off a task, the change is written immediately to your device's local SQLite storage with a `pending_sync: true` flag and queued for immediate transmission to the VPS.

### 5.3. Resilient Multi-Device Sync Protocol (`sync_rev`) & Transport Architecture
To guarantee that syncing is 100% reliable even when devices sleep, disconnect, or switch networks, the system decouples **data persistence** from the **transport connection**:

* **Event-Sourced Revision Counter (`sync_rev`):** Every row in SQLite tracks a monotonically increasing integer `sync_rev`. The VPS maintains a `sync_changelog` table recording every incremental delta.
* **WebSocket as an Instant "Doorbell" Push:**
  * When devices are online and connected via WebSocket (`wss://vps-domain/api/v1/ws/sync`), changes are broadcast across devices in $< 50\text{ ms}$.
  * The WebSocket does *not* need to be permanently reliable. If a device drops Wi-Fi or goes into background sleep, the WebSocket simply disconnects without losing data.
* **Guaranteed Reconnection Catch-Up (State Reconciliation):**
  * When a device reconnects (or wakes up from sleep), the client sends a handshake message with its highest known `local_sync_rev`.
  * FastAPI queries `SELECT * FROM sync_changelog WHERE sync_rev > :local_sync_rev ORDER BY sync_rev ASC` and streams only the missing deltas down to the client.
  * The client applies these deltas inside a local SQLite transaction and pushes any queued `pending_sync` local edits up to the VPS.
* **HTTP REST Sync Fallback:**
  * For environments where WebSockets are blocked by restrictive firewalls or corporate proxies, the client automatically falls back to standard HTTP endpoints:
    * `POST /api/v1/sync/push` (upload local deltas)
    * `POST /api/v1/sync/pull` (fetch deltas since `local_sync_rev`)

### 5.4. Conflict Resolution Strategy
* **Metadata & Checklists (Field-Level LWW):** For priority changes, tag updates, and task completions, SQLite uses field-level Last-Write-Wins (LWW) based on NTP-synchronized UTC timestamps (`updated_at`).
* **Note Body Text (3-Way Merge & AI Reconciliation):** If two devices simultaneously edit the body text of the same note while offline, FastAPI detects the concurrent revision and runs a 3-way text merge (`diff3` / `git merge-file`). If non-overlapping lines were edited, they merge cleanly. If conflicting edits overlap, both versions are preserved in a conflict block (`<<<<<<< LOCAL / >>>>>>> REMOTE`) and the Main AI assistant immediately prompts the user via a quick mobile notification or chat prompt to choose or synthesize the final text.

### 5.5. Manual Edit Diff Learning Pipeline
Because the VPS asynchronously projects all accepted note edits into the Markdown Git Vault:
* **AI Edits** are committed to Git with author: `ScribeX-AI <ai@assistant.local>`.
* **Manual User Edits** are committed to Git with author: `User <user@assistant.local>`.
* **Diff Learning Trigger:** Whenever a `user_manual` commit modifies a note previously created or organized by the AI, the **Diff Analyzer Worker** runs `git diff HEAD~1 HEAD`.
* The Diff Analyzer extracts the organizational rationale (e.g., *"User grouped API keys under 'Project X/Config' instead of 'General Reference' and set priority to P2"*) and records a permanent preference rule into **Layer 4 (Behavioral & Preference Ledger)**.

### 5.6. Automated Off-Site Cloud Backup
* Every commit to the VPS Git Vault and hourly SQLite snapshot (via `Litestream` or `rclone`) is automatically pushed to a **Private Git Repository (GitHub/GitLab)** and/or **Encrypted S3-Compatible Storage (Cloudflare R2 / Backblaze B2)**. If you ever migrate to a new VPS or new device, your entire life history restores in one command.

---

## 6. Technical Implementation of the 4-Layer Cognitive Memory

| Memory Layer | Storage Medium on VPS | Technical Schema & Role |
| :--- | :--- | :--- |
| **Layer 1: Core Identity & Vault Index (Always-Active)** | `_core/identity.md` + `_core/vault_index.json` (Cached in FastAPI RAM) | Injected into the system prompt of every Main AI call ($\sim 1,500\text{ tokens}$). Contains your current profile summary, active short/long-term goals, top priorities, and the directory map of all existing note groups. |
| **Layer 2: Living Notes & Semantic Graph** | Markdown Vault (`.md` files with YAML frontmatter) + SQLite `entity_edges` + LanceDB | Each `.md` file contains `id`, `group`, `priority_score` ($0.0 - 1.0$), `linked_goals`, and `linked_notes`. SQLite stores bidirectional graph edges (`source_id`, `relation_type`, `target_id`) so retrieval always pulls connected context. |
| **Layer 3: Temporal Identity & Version Logs ("Versions of Me")** | SQLite `identity_timeline` + `task_history` + Git Commit Log | Bi-temporal table storing (`attribute`, `old_value`, `new_value`, `valid_from`, `valid_to`, `change_reason`, `git_commit_sha`). Tracks every evolution of your career, goals, mindset, and past tasks without overwriting history. |
| **Layer 4: Behavioral & Preference Ledger** | `_core/behavioral_ledger.md` + SQLite `learned_preferences` | Stores structured rules learned from your response patterns and manual edit diffs (`category`, `preference_rule`, `confidence_score`, `source_diff_sha`). Dynamically shapes the AI's persona, questioning threshold, and filing logic. |

### The Ask-Before-Write Ambiguity Gate
When you submit a new raw note or file to `POST /api/v1/intake`:
1. The Main AI evaluates the input against **Layer 1** and **Layer 2** and returns a structured Pydantic schema:
   ```json
   {
     "clarity_score": 0.62,
     "ambiguity_detected": true,
     "clarifying_questions": [
       "Should this API update be added to the 'Client Portal' project note or start a new microservice note?"
     ],
     "proposed_actions": []
   }
   ```
2. If `clarity_score < 0.85` or contradictions exist, FastAPI holds the note in a `staging_intake` state and pushes the clarifying question to your Expo app. Only after you reply does it commit the file update.

---

## 7. Remote PC Agentic Execution & Pluggable CLI Daemon

Because the FastAPI backend runs on a 24/7 Cloud VPS and your Personal PC is on your home/office network, the PC runs a lightweight Python service called the **`pc-agent-bridge`**.

### 7.1. Connectivity & Offline Resilience
* **Zero Open Ports on PC:** The `pc-agent-bridge` initiates an outbound persistent WebSocket connection (`wss://vps-domain/api/v1/ws/pc-bridge`) authenticated with a long-lived Ed25519/JWT machine token (or connects over a private **Tailscale** mesh network).
* **PC Offline Task Queueing:** If you assign a PC task from your phone while your PC is turned off or asleep:
  * FastAPI saves the Context-Enriched Execution Spec in the SQLite `pc_task_queue` table with status `QUEUED_WAITING_FOR_PC`.
  * The moment your PC boots up and `pc-agent-bridge` connects, FastAPI automatically dispatches the queued task (or sends a push notification asking if you want to start it now).
* **Automatic Vault Mirroring:** Whenever the PC is online, the `pc-agent-bridge` keeps a local mirror of your Markdown Vault in sync so local CLI agents can directly read any reference file or note on disk.

### 7.2. Universal Pluggable CLI Adapter Configuration (`cli_agents.yaml`)
On your PC, you can configure, add, or switch between any CLI AI agent by editing `cli_agents.yaml` (or toggling it from the Expo app UI):

```yaml
default_agent: claude_code
allowed_workspaces:
  - "~/Projects"
  - "~/Documents/AI-Workspace"

agents:
  claude_code:
    binary: "claude"
    headless_args: ["-p", "{prompt}", "--output-format", "json", "--dangerously-skip-permissions"]
    resume_args: ["--resume", "{session_id}"]
    supports_json_stream: true

  gemini_cli:
    binary: "gemini"
    headless_args: ["-p", "{prompt}", "--yolo", "--output-format", "json"]
    resume_args: []
    supports_json_stream: true

  codex_cli:
    binary: "codex"
    headless_args: ["exec", "{prompt}", "--full-auto"]
    resume_args: []
    supports_json_stream: false

  aider:
    binary: "aider"
    headless_args: ["--message", "{prompt}", "--yes-always"]
    resume_args: ["--restore-chat-history"]
    supports_json_stream: false

  goose:
    binary: "goose"
    headless_args: ["run", "--text", "{prompt}"]
    resume_args: ["--session", "{session_id}"]
    supports_json_stream: false
```

### 7.3. The 3-Layer Independent Verification & Self-Correction Loop
When the Main AI on the VPS dispatches a task to the `pc-agent-bridge`:

1. **Pre-Execution Safety Checkpoint:**
   * The `pc-agent-bridge` verifies the target directory is inside `allowed_workspaces`.
   * If the directory is a Git repository, it records the pre-task `HEAD` hash and creates a safety snapshot (`git stash create`) so any failed execution can be rolled back cleanly.
2. **Headless CLI Execution & Live Streaming:**
   * The bridge spawns the selected CLI agent subprocess, streams live stdout/JSON events over WebSocket to FastAPI (visible in your Expo app), and intercepts any high-risk permission requests to trigger a mobile/web approval prompt.
3. **3-Stage Verification Pipeline (Zero Blind Trust):**
   * **Stage 1 (Process Telemetry):** Captures process exit code, execution duration, and CLI agent output summary.
   * **Stage 2 (Deterministic Environment Proof):** The bridge runs independent verification commands *outside* the CLI agent:
     * `git status --porcelain` and `git diff` (proving exact lines changed).
     * File existence, checksums, and byte sizes for non-code tasks.
     * Custom verification command specified by the Main AI (e.g., `pytest`, `npm run build`, `ruff check`).
   * **Stage 3 (Main AI Acceptance Review):** The bridge sends the deterministic proof bundle back to FastAPI. The Main AI compares the actual `git diff` and test results against your original task requirements.
     * **If verification fails:** FastAPI automatically dispatches a corrective prompt back to the CLI agent (up to `max_retries = 3`).
     * **If verification passes:** FastAPI marks the checklist item complete, logs the execution summary and diff in **Layer 3 (Task History)**, updates the relevant project notes in **Layer 2**, and notifies your Expo app.

---

## 8. Monorepo Folder Structure (For Your AI Coding Assistant)

Provide this folder structure to your AI coding assistant to initialize the project cleanly:

```text
scribex/
├── frontend/
│   └── expo-universal/                 # Universal Expo App (iOS, Android, Web)
│       ├── app/                        # Expo Router screens
│       │   ├── (tabs)/
│       │   │   ├── index.tsx           # Universal Intake, Chat & Daily Briefing
│       │   │   ├── vault.tsx           # 3-Pane Context Vault & Manual Editor
│       │   │   ├── timeline.tsx        # "Versions of Me" & Manual Diff History
│       │   │   └── agents.tsx          # Remote PC CLI Agent Monitor & Config
│       │   └── onboarding.tsx          # Interactive Discovery Interview
│       ├── components/
│       │   ├── desktop/                # 3-Pane IDE & Side-by-Side Diff Viewer
│       │   └── mobile/                 # Voice Capture, Share Target, Push Cards
│       ├── db/
│       │   ├── schema.ts               # Local expo-sqlite schema
│       │   └── syncEngine.ts           # Real-time WebSocket Delta Sync client
│       └── package.json
│
├── backend/                            # 24/7 Cloud VPS FastAPI Backend (Phase 1 Implemented)
│   ├── app/
│   │   ├── main.py                     # FastAPI entry point & lifespan directory setup
│   │   ├── core/
│   │   │   └── config.py               # Pydantic Settings (.env, models, CORS, data dirs)
│   │   ├── api/
│   │   │   ├── deps.py                 # get_current_user_id() SaaS dependency
│   │   │   ├── intake.py               # Universal intake endpoint & Ask-Before-Write gate
│   │   │   ├── onboarding.py           # 6-pillar multi-turn onboarding interview API
│   │   │   ├── sync_ws.py              # (Phase 2) Real-time delta sync WebSocket (Doorbell)
│   │   │   ├── sync_http.py            # (Phase 2) HTTP REST delta sync fallback (Push/Pull)
│   │   │   └── pc_bridge_ws.py         # (Phase 4) Remote PC daemon WebSocket controller
│   │   ├── memory/
│   │   │   ├── layer1_identity.py      # Core Identity RAM Cache & System Prompt Builder
│   │   │   ├── layer2_vault.py         # Triple Hybrid Context Retriever (FTS5 + LanceDB + Graph)
│   │   │   ├── layer3_temporal.py      # (Phase 3) Bi-temporal "Versions of Me" & Task Logs
│   │   │   └── layer4_learner.py       # (Phase 3) Behavioral Ledger & Manual Git Diff Learner
│   │   ├── agents/
│   │   │   ├── intake_agent.py         # Ambiguity Evaluator (LiteLLM + deterministic fallback)
│   │   │   ├── onboarding_agent.py     # 6-pillar interview state machine & synthesis
│   │   │   ├── orchestrator.py         # (Phase 4) Main ScribeX Brain (Friday Assistant)
│   │   │   ├── verifier.py             # (Phase 4) Independent Remote PC Work Reviewer
│   │   │   └── scheduler.py            # (Phase 4) Proactive briefings & sleep consolidation
│   │   ├── storage/
│   │   │   ├── paths.py                # Tenant-isolated & flat path resolver
│   │   │   ├── sqlite_db.py            # Embedded SQLite WAL + FTS5 manager + staging
│   │   │   ├── git_vault.py            # GitPython commit, merge & diff engine
│   │   │   ├── sync_projector.py       # Unified write pipeline (SQLite commit -> Git projection)
│   │   │   ├── lancedb_store.py        # Embedded LanceDB vector table & cosine search
│   │   │   └── file_parser.py          # PyMuPDF, CSV, JSON, Markdown document ingestion
│   │   └── db/
│   │       └── schemas.sql             # Complete WAL schemas & FTS5 triggers
│   ├── tests/                          # Automated Pytest Suite (33 tests, 100% green)
│   │   ├── test_scaffolding.py         # Path resolution, config & health check tests
│   │   ├── test_storage.py             # SQLite WAL operations, concurrent writes & sync_rev
│   │   ├── test_vault.py               # Git projection, commit logs, author tagging & diffs
│   │   ├── test_vector_and_parser.py   # LanceDB vector search & multi-format parser tests
│   │   ├── test_memory.py              # Layer 1 prompt generation & Layer 2 hybrid search
│   │   ├── test_intake.py              # Ambiguity gate triggers & clarification resolution
│   │   ├── test_onboarding.py          # 6-pillar onboarding interview flow synthesis
│   │   └── test_e2e_integration.py     # Master end-to-end user lifecycle test
│   ├── data/                           # Mounted persistent NVMe volume on VPS
│   │   ├── vault/                      # Git-backed Markdown Context Files
│   │   ├── sqlite/                     # scribex.db (WAL mode operational core)
│   │   ├── lancedb/                    # Embedded vector index tables
│   │   └── tenants/                    # (Phase 5) Isolated multi-tenant storage
│   ├── pyproject.toml                  # Modern Python 3.11 packaging
│   └── .env.example
│
├── pc-agent-bridge/                    # Lightweight Daemon installed on Personal PC
│   ├── bridge/
│   │   ├── daemon.py                   # Outbound WebSocket client & heartbeat
│   │   ├── cli_adapter.py              # Pluggable CLI runner (Claude, Gemini, etc.)
│   │   ├── verifier_hooks.py           # Deterministic git diff, test & file verifier
│   │   └── vault_mirror.py             # Local mirror of Markdown context files
│   ├── cli_agents.yaml                 # Configurable CLI Agent Provider Registry
│   └── pyproject.toml
│
└── docker-compose.vps.yml              # One-command deployment for Cloud VPS (FastAPI + Caddy HTTPS)
```

---

## 9. Implementation Phases & Detailed Build History

To build and test ScribeX systematically without getting overwhelmed, development follows these six phases.

### Phase 1: VPS Core Backend, Operational SQLite & 4-Layer Memory Engine — `[x] COMPLETED & VERIFIED`
*Full step-by-step implementation logs and test criteria in [Phase_1_Implementation_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Phase_1_Implementation_Plan.md).*

Phase 1 established the operational, version-controlled, and vector-indexed core on the VPS. All 8 planned milestones have been implemented and verified with a 100% green automated test suite (**33 passing tests**):

1. **Step 1: Backend Scaffolding, Environment & SaaS Path Resolver (`[x] COMPLETED`)**
   - Configured modern Python 3.11 project packaging in `backend/pyproject.toml`.
   - Built central settings management in `backend/app/core/config.py` handling CORS, API keys, and environment variables.
   - Built `backend/app/storage/paths.py` supporting both clean flat default storage paths (`data/vault`, `data/sqlite/scribex.db`, `data/lancedb`) and isolated multi-tenant directories (`data/tenants/{user_id}/`).
   - Implemented FastAPI application entry point in `backend/app/main.py` with automatic storage bootstrapping and `/health`.

2. **Step 2: Operational SQLite Engine in WAL Mode (`[x] COMPLETED`)**
   - Designed complete database schema in `backend/app/db/schemas.sql`: `notes`, `user_sync_meta`, `sync_changelog` (event-sourced deltas), `entity_edges` (graph relations), `identity_timeline` (Layer 3), `learned_preferences` (Layer 4), `staging_intake` (Ambiguity Gate), and `notes_fts` (FTS5 BM25 search).
   - Built async repository in `backend/app/storage/sqlite_db.py` enforcing `PRAGMA journal_mode = WAL` and monotonically increasing `sync_rev` revision counters.

3. **Step 3: Git-Backed Markdown Vault Projector (`[x] COMPLETED`)**
   - Created Git repository manager and Markdown frontmatter parser/serializer in `backend/app/storage/git_vault.py`.
   - Built unified write pipeline in `backend/app/storage/sync_projector.py` coordinating atomic SQLite transactions followed by Git vault projections with author tagging (`ScribeX-AI` vs. `User`).

4. **Step 4: Embedded LanceDB Vector Engine & Multi-Format Document Parser (`[x] COMPLETED`)**
   - Integrated serverless local LanceDB vector store in `backend/app/storage/lancedb_store.py` (`note_chunks` table, cosine similarity, and deterministic fallback embeddings).
   - Built document ingestion parser in `backend/app/storage/file_parser.py` converting PDF (`PyMuPDF`), Markdown, CSV (Markdown tables), JSON, and plain text into structured Markdown.

5. **Step 5: Cognitive Memory Layers 1 & 2 (`[x] COMPLETED`)**
   - Built Layer 1 always-active RAM memory in `backend/app/memory/layer1_identity.py` (`_core/identity.md` management, core profile, active goals, note group map, and top priorities compiled into a $\sim 1,500$-token prompt with instant cache invalidation).
   - Built Layer 2 Triple Hybrid Context Retriever in `backend/app/memory/layer2_vault.py` merging SQLite FTS5 (BM25 keyword search), LanceDB vector similarity, and SQLite `entity_edges` graph traversal.

6. **Step 6: Universal Intake Router & Ask-Before-Write Ambiguity Gate (`[x] COMPLETED`)**
   - Implemented `IntakeAnalysis` schema and LiteLLM ambiguity evaluator in `backend/app/agents/intake_agent.py` with deterministic fallback.
   - Built Universal Intake API in `backend/app/api/intake.py` (`POST /api/v1/intake`):
     - If `clarity_score < 0.85` or `ambiguity_detected == True`: stores raw input in `staging_intake` and returns clarifying questions without touching the vault.
     - If clear (`clarity_score >= 0.85`): atomically writes to SQLite, projects to Git vault, and indexes into LanceDB.
     - Added multi-turn clarification resolution (`POST /api/v1/intake/{staging_id}/clarify`), staging listing, and multipart document uploads (`POST /api/v1/intake/upload`).

7. **Step 7: Interactive Onboarding Interview Flow API (`[x] COMPLETED`)**
   - Implemented 6-pillar conversational interview state machine in `backend/app/agents/onboarding_agent.py` covering Personal Identity, Career Journey, Life Vision, Active Goals, Current Projects, and Daily Routines.
   - Built onboarding router in `backend/app/api/onboarding.py` (`/start`, `/message`, `/finalize`) synthesizing conversation history into `_core/identity.md`, seeding initial project/goal notes in SQLite and Git, and linking graph edges (`SERVES_GOAL`).

8. **Step 8: Master End-to-End Integration Test Suite & Verification (`[x] COMPLETED`)**
   - Created comprehensive end-to-end user lifecycle test in `backend/tests/test_e2e_integration.py` verifying onboarding, ambiguity gate triggers, clarification resolution, direct note commits, document uploads, hybrid retrieval, delta sync changelog, and Git commit logs.
   - All 33 automated tests across 8 test suites pass with 100% green status.

---

### Phase 2: Universal Expo App + Resilient Delta Sync — `[ ] UPCOMING (NEXT FOCUS)`
* **Objective:** Build the cross-platform Expo application (`iOS`, `Android`, `Web`) with local offline-first SQLite caching (`expo-sqlite`) and the resilient delta sync engine (WebSocket doorbell push + revision catch-up handshake + HTTP fallback) so notes, checklists, and manual edits sync concurrently in real time across devices.
* **Deliverables:**
  - Expo TypeScript frontend targeting mobile and web from a single codebase.
  - Local `expo-sqlite` replica for sub-5ms local reads and zero-spinner UI.
  - WebSocket delta sync client listening for `SYNC_PING` and pulling deltas via `GET /api/v1/sync/deltas?since_rev=X`.
  - Fast Markdown note editor and vault group tree navigator.
  - Interactive "Ask-Before-Write" modal UI for clarifying questions.
  - Conversational onboarding interview screens and Layer 1 personal profile view.

---

### Phase 3: Manual Edit Diff Learner + Temporal "Versions of Me" — `[ ] PLANNED`
* **Objective:** Enable the background Git diff analyzer that compares user manual commits against AI assistant commits to populate Layer 4 (Behavioral Ledger) and Layer 3 (Identity Evolution Timeline).
* **Deliverables:**
  - Background Git commit monitor extracting unified diffs between `[User]` and `[AI]` edits.
  - Layer 4 Behavioral Ledger engine (`learned_preferences` table) extracting formatting, tone, and filing rules.
  - Layer 3 Episodic Memory engine (`identity_timeline` table) tracking historical evolution of goals and vision.
  - Automated background reconciliation between SQLite/LanceDB and raw Markdown files.

---

### Phase 4: Remote PC Bridge Daemon + Pluggable CLI Verification Loop — `[ ] PLANNED`
* **Objective:** Deploy the `pc-agent-bridge` daemon on your personal PC, connect it via WebSocket to FastAPI, configure `cli_agents.yaml`, and activate the 3-stage verification pipeline.
* **Deliverables:**
  - Standalone `pc-agent-bridge` daemon connecting outward to VPS via persistent WebSocket.
  - Dynamic `cli_agents.yaml` registry supporting Claude Code CLI, Gemini CLI, and custom shell scripts.
  - 3-stage verification pipeline (pre-check safety blocklist, live stdout streaming, post-check git diff verification).
  - Autonomous task dispatcher projecting execution summaries and logs back into structured notes.

---

### Phase 5 & 6: Commercial SaaS Scaling, Multi-Tenancy & Billing — `[ ] PLANNED`
* **Objective:** When transitioning to commercial SaaS, attach the authentication provider (Clerk / Supabase Auth), machine pairing protocol, Stripe billing webhooks, and LiteLLM token spend quotas as specified in [SaaS_Architecture_and_Integration_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/SaaS_Architecture_and_Integration_Plan.md).
* **Deliverables:**
  - Injected `user_id` authentication replacing `"default_user"`.
  - Remote machine pairing protocol (`scribex pair` OTP challenge + Ed25519 tokens).
  - Stripe subscription checkout and webhook management.
  - LiteLLM monthly token budget metering, usage quotas, and encrypted BYO-Key support.
  - Automated encrypted nightly backup snapshots to S3 / Cloudflare R2.