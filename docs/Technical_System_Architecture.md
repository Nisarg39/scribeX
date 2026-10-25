# Technical System Architecture: ScribeX - Friday (Iron man style Personal Assistant)

## 1. Architectural Overview & Core Design Principles

This document defines the production technical architecture for ScribeX - Friday (Iron man style Personal Assistant) & Note-Taking Platform. It is designed to be handed directly to an AI coding assistant to scaffold and implement the system.

### Core Architectural Pillars
1. **Zero-Downtime 24/7 Availability (Lightweight Cloud VPS):** The core FastAPI backend and embedded memory engine run on an always-on lightweight Linux VPS. The assistant remains $100\%$ operational for note-taking, context retrieval, daily briefings, and planning even when the user's personal PC is powered off.
2. **Sub-Millisecond AI Context Retrieval (Embedded VPS Storage):** Instead of making slow network hops to external cloud databases, the VPS stores the Markdown Context Vault, Vector Index, and Temporal Knowledge Graph directly on its local NVMe SSD. FastAPI retrieves context in $< 5\text{ ms}$.
3. **True Local-First Multi-Device Concurrency:** Every client device (iOS, Android, Desktop Web) maintains a local SQLite replica and file cache. The app opens instantly ($0\text{ ms}$ network wait), works offline, and uses **Real-Time WebSocket Delta Sync** so multiple devices can view and edit context concurrently without version conflicts.
4. **Decoupled Remote PC Agentic Execution:** The user's personal PC runs a lightweight background daemon that connects outbound to the Cloud VPS over an encrypted WebSocket tunnel. When the PC is online, it executes tasks via any configured CLI AI agent (Claude Code, Gemini CLI, Codex CLI, Aider, Goose, OpenCode). If the PC is offline, tasks are queued safely on the VPS until the PC comes online.

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
  * **Git-Backed Markdown Vault (`GitPython`):** Every note and core context document is stored as a physical `.md` file with YAML frontmatter inside a local Git repository on the VPS.
  * **SQLite (`aiosqlite` in `WAL` mode + `FTS5`):** Stores the Temporal Identity Graph, Episodic Version Logs, Task History, Sync Revision Ledger, and Full-Text Search (BM25) index.
  * **LanceDB (Embedded Disk Mode):** Serverless, file-based vector database stored on the VPS disk for semantic chunk search across notes and uploaded files.
* **Document & File Parsing:** `MarkItDown` / `PyMuPDF` + Vision LLM pipeline for converting uploaded PDFs, spreadsheets, and images into structured Markdown summaries linked to the vault.
* **Proactive Background Engine:** `APScheduler` (AsyncIOScheduler) running inside FastAPI for daily priority recalculation, morning briefings, and periodic "sleep-cycle" memory consolidation.

---

## 5. Hybrid Local-First Storage & Real-Time Multi-Device Delta Sync

To allow you to use your phone, tablet, and desktop web browser **concurrently** with instant local speed and zero data loss, the platform uses an **Event-Sourced Revision & Git Delta Sync Protocol**.

### 5.1. How Local-First Reading & Writing Works
1. **Instant Local Reads:** When you open the Expo app on any device, the UI renders immediately from the local `expo-sqlite` database.
2. **Optimistic Local Writes:** When you manually edit a context file or check off a task, the change is written immediately to your device's local SQLite storage with a `pending_sync` flag and transmitted to the FastAPI VPS via WebSocket.

### 5.2. Real-Time Delta Sync Protocol (`sync_rev`)
Every note, task, and context file tracks a monotonically increasing integer `sync_rev` (Sync Revision Number) and a `last_modified_by` tag (`user_manual` vs. `ai_assistant`).

1. **Client Connects / Reconnects:**
   * The Expo client sends its highest known `local_sync_rev` to `wss://vps-domain/api/v1/ws/sync`.
   * FastAPI queries the `sync_changelog` table in SQLite (`WHERE sync_rev > client_sync_rev`) and pushes only the changed records/deltas down to the device.
2. **Concurrent Multi-Device Broadcast:**
   * If you have your Desktop Web App and Mobile App open simultaneously and edit a note on Web, FastAPI commits the change to the VPS Git Vault, increments `sync_rev`, and broadcasts the delta payload over WebSocket to your Mobile App in $< 50\text{ ms}$.
3. **Conflict Resolution:**
   * For concurrent edits to the same Markdown file, FastAPI performs a **3-way Git merge** (`git merge-file`) using the common ancestor commit in the VPS Git Vault. If a non-overlapping change occurred, it merges cleanly; if lines conflict, both versions are preserved and the AI asks you which to keep.

### 5.3. Manual Edit Diff Learning Pipeline
Because every change in the Markdown Vault is committed to the VPS Git repository:
* **AI Edits** are committed with author `ScribeX-AI <ai@assistant.local>`.
* **Manual User Edits** are committed with author `User <user@assistant.local>`.
* **Diff Learning Trigger:** Whenever FastAPI receives a `user_manual` edit on a file or folder that the AI previously created or organized, a background task runs `git diff HEAD~1 HEAD` and passes the diff to the **Diff Analyzer Worker**.
* The Diff Analyzer extracts the organizational lesson (e.g., *"User moved API credentials note out of 'General Reference' into 'Project X/Config' and lowered its priority from P1 to P3"*) and writes a permanent rule into **Layer 4 (Behavioral & Preference Ledger)**.

### 5.4. Automated Off-Site Cloud Backup
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
├── backend/                            # 24/7 Cloud VPS FastAPI Backend
│   ├── app/
│   │   ├── main.py                     # FastAPI entry point & lifespan events
│   │   ├── api/
│   │   │   ├── intake.py               # Universal note/file ingestion & clarification
│   │   │   ├── sync_ws.py              # Multi-device real-time delta sync WebSocket
│   │   │   └── pc_bridge_ws.py         # Remote PC daemon WebSocket controller
│   │   ├── memory/
│   │   │   ├── layer1_identity.py      # Core Identity & Always-Active Index
│   │   │   ├── layer2_vault.py         # Git Markdown Vault + LanceDB + Graph
│   │   │   ├── layer3_temporal.py      # Bi-temporal "Versions of Me" & Task Logs
│   │   │   └── layer4_learner.py       # Behavioral Ledger & Manual Git Diff Learner
│   │   ├── agents/
│   │   │   ├── orchestrator.py         # Main ScribeX Brain (Friday Assistant - Context + Routing)
│   │   │   ├── verifier.py             # Independent Remote PC Work Reviewer
│   │   │   └── scheduler.py            # Proactive briefings & sleep consolidation
│   │   └── storage/
│   │       ├── sqlite_db.py            # Embedded SQLite WAL + FTS5 manager
│   │       ├── git_vault.py            # GitPython commit, merge & diff engine
│   │       └── backup_sync.py          # Encrypted off-site Git/S3 backup worker
│   ├── data/                           # Mounted persistent NVMe volume on VPS
│   │   ├── vault/                      # Git-backed Markdown Context Files
│   │   ├── sqlite/                     # scribex_core.db
│   │   └── lancedb/                    # Embedded vector index
│   ├── Dockerfile
│   └── pyproject.toml
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

## 9. Recommended Implementation Phases for Your Coding Assistant

To build and test this systematically without getting overwhelmed, instruct your AI coding assistant to follow these four phases:

* **Phase 1: FastAPI Core + Git Vault + 4-Layer Memory (VPS Backend):** Set up the FastAPI server, the Git-backed Markdown Vault (`GitPython`), embedded SQLite + LanceDB, the interactive onboarding flow, and the Universal Intake endpoint with Ask-Before-Write clarification.
* **Phase 2: Universal Expo App + Local-First Delta Sync:** Build the Expo app (`iOS`, `Android`, `Web`) with `expo-sqlite` local caching and the WebSocket Delta Sync engine so notes, checklists, and manual edits sync concurrently in real time across devices.
* **Phase 3: Manual Edit Diff Learner + Temporal "Versions of Me":** Enable the background Git diff analyzer that compares `user_manual` commits against `ai_assistant` commits to populate Layer 4 (Behavioral Ledger) and Layer 3 (Identity Evolution Timeline).
* **Phase 4: Remote PC Bridge Daemon + Pluggable CLI Verification Loop:** Deploy the `pc-agent-bridge` script on your personal PC, connect it via WebSocket to FastAPI, configure `cli_agents.yaml`, and activate the 3-stage verification pipeline.