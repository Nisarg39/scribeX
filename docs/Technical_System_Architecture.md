# Technical System Architecture: ScribeX - Friday (Iron man style Personal Assistant)

## 1. Architectural Overview & Core Design Principles

This document defines the production technical architecture for ScribeX - Friday (Iron man style Personal Assistant) & Note-Taking Platform. It is designed to be handed directly to an AI coding assistant to scaffold and implement the system.

### Core Architectural Pillars
0. **User Journey Starts with Friction-Free Manual Note Taking First, AI Assistant Second:** The foundation of ScribeX is a world-class, local-first note-taking experience that works with zero friction and zero mandatory AI setup. The user can immediately capture ideas, organize folders, tag items, write rich blocks, track tasks, and link notes with sub-5ms local SQLite speed. The AI assistant ("Friday") is layered on top of this rock-solid note engine as an intelligent companion rather than an intrusive gatekeeper.
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
  * **Operational Core: Embedded SQLite (`aiosqlite` in `WAL` mode + `FTS5`):** Serves as the high-throughput operational core on the VPS. Handles the real-time multi-entity device sync ledger (`sync_changelog` with monotonically increasing `sync_rev`), active notes with composable block AST (`notes`), unified task entities (`tasks`), binary media ledger (`assets`), knowledge graph relationships (`entity_relations`), and the Temporal Identity timeline ("Versions of Me").
  * **Projected Document Layer: Git-Backed Markdown Vault (`GitPython`):** Asynchronously projected from SQLite changes on the VPS. Every note and profile document is maintained as a human-readable Extended Markdown AST `.md` file with YAML frontmatter inside a local Git repository, serving as the version-controlled document archive, off-site backup, and the primary source for the manual edit diff-learning pipeline and Remote PC CLI agents.
  * **Semantic Memory: LanceDB (Embedded Disk Mode):** Serverless, file-based vector database stored on the VPS disk for semantic chunk search across notes and uploaded files.
* **Document & Audio Ingestion:** `MarkItDown` / `PyMuPDF` + Vision LLM pipeline for documents, spreadsheets, and images, paired with a lightweight audio transcription pipeline (`faster-whisper` / Whisper API) for persistent voice note capture.
* **Proactive Background Engine:** `APScheduler` (AsyncIOScheduler) running inside FastAPI for daily priority recalculation, morning briefings, and periodic "sleep-cycle" memory consolidation.

---

## 5. Hybrid Local-First Storage & Real-Time Multi-Device Delta Sync

To allow you to use your phone, tablet, and desktop web browser **concurrently** with instant local speed, offline resilience, and zero data loss, the platform uses an **Operational Block SQLite Delta Sync + Canonical Markdown AST Projection Protocol**.

### 5.1. Architecture of Truth: Decoupled Operational & Projection Layers
To ensure maximum speed without file-locking bottlenecks:
1. **Operational Layer (Device-to-Device Sync):** The central **SQLite database on the VPS** (and the local `expo-sqlite` replica on each client) serves as the authoritative real-time operational state. All client devices sync directly against this SQLite core. High-frequency updates (typing blocks, checking off tasks, updating priorities, creating folders, tagging) occur as atomic SQLite transactions.
   * `folders`: Stores hierarchical project containers with recursive `parent_id` and physical vault directory paths.
   * `tags` & `note_tags`: Stores multi-dimensional classification tags and many-to-many note associations.
   * `notes`: Stores `content_markdown` along with cached `blocks_json` for instant UI rendering across all 20 composable block types, plus folder and tag links.
   * `tasks`: Stores single-source-of-truth task entities shared between embedded note blocks and the global task engine.
   * `assets`: Tracks binary media (audio, PDFs, images, vector sketches) with processing states and extracted OCR/Whisper text.
   * `entity_relations`: Stores bidirectional knowledge graph edges (`related_to`, `part_of`, `derived_from`, `contradicts`, `supersedes`).
   * `sync_changelog`: Event-sourced change ledger tracking monotonic `sync_rev` deltas for all operational entities.
2. **Projection Layer (Git Markdown Vault & LanceDB):** When a note transaction commits in the operational SQLite database, an asynchronous background task serializes the composable blocks into a clean **Extended Markdown AST** `.md` file in the Git Vault and refreshes the LanceDB vector chunks. This completely isolates live UI typing from disk-level Git commit overhead while ensuring:
   * The Git Vault remains 100% human-readable and mirrors the physical folder hierarchy (`data/vault/{user_id}/folders/...`).
   * Remote PC CLI agents (Claude Code, Gemini CLI) can read and edit notes natively using standard text tools.
   * Diff learning works reliably without proprietary file corruption.

### 5.2. Local-First Reading & Optimistic Writes
1. **Instant Local Reads ($0\text{ ms}$):** When you open the Expo app on any device, the UI renders immediately from the local `expo-sqlite` database replica.
2. **Optimistic Local Writes:** When you edit a block or check off a task, the change writes immediately to your device's local SQLite storage with a `pending_sync: true` flag and queues for transmission to the VPS.

### 5.3. Resilient Multi-Device Sync Protocol (`sync_rev`) & Multi-Entity Changelog
To guarantee that syncing is 100% reliable even when devices sleep, disconnect, or switch networks, the system decouples **data persistence** from the **transport connection**:

* **Event-Sourced Revision Counter (`sync_rev`):** Every operational row tracks a monotonically increasing integer `sync_rev`. The VPS maintains a `sync_changelog` table recording every incremental delta across entity types:
  * `entity_type: 'folder'`: Folder creation, renaming, nested hierarchy updates, and color tokens.
  * `entity_type: 'tag'`: Tag creation and metadata.
  * `entity_type: 'note'`: Document metadata, `content_markdown`, and `blocks_json`.
  * `entity_type: 'task'`: Title, completion status, priority, and due dates.
  * `entity_type: 'relation'`: Knowledge graph connections and confidence scores.
  * `entity_type: 'asset'`: Binary attachment processing state and extracted text.
* **WebSocket as an Instant "Doorbell" Push:**
  * When devices are online and connected via WebSocket (`wss://vps-domain/api/v1/ws/sync`), changes broadcast across devices in $< 50\text{ ms}$.
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
* **Tasks & Metadata (Field-Level LWW):** For priority changes, tag updates, and task completions, SQLite uses field-level Last-Write-Wins (LWW) based on NTP-synchronized UTC timestamps (`updated_at`).
* **Unified Task Model Synchronization:** Checking off a task embedded inside a meeting note immediately updates the `tasks` table and emits a `task` delta. The background projector simultaneously updates the `- [x]` marker in the note's `.md` file, keeping both views in perfect sync.
* **Note Body Text (3-Way Merge & AI Reconciliation):** If two devices simultaneously edit blocks of the same note while offline, FastAPI detects the concurrent revision and runs a 3-way text merge (`diff3` / `git merge-file`) on the Markdown AST. If non-overlapping lines/blocks were edited, they merge cleanly. If conflicting edits overlap, both versions are preserved in a conflict block (`<<<<<<< LOCAL / >>>>>>> REMOTE`) and the Main AI assistant immediately prompts the user via a quick mobile notification or chat prompt to choose or synthesize the final text.

### 5.5. Manual Edit Diff Learning Pipeline (Noise-Filtered)
Because the VPS asynchronously projects all accepted note edits into the Markdown Git Vault:
* **AI Edits** are committed to Git with author: `ScribeX-AI <ai@assistant.local>`.
* **Manual User Edits** are committed to Git with author: `User <user@assistant.local>`.
* **Diff Learning Trigger:** Whenever a `user_manual` commit modifies a note previously created or organized by the AI, the **Diff Analyzer Worker** runs `git diff HEAD~1 HEAD`.
* **Noise Filtered Semantic Analysis:** The Diff Analyzer filters out raw binary hashes and SVG drawing paths, focusing strictly on:
  1. *Filing preferences:* Moving notes from `_inbox/` to specific project folders.
  2. *Tone and conciseness:* Shortening verbose summaries into bullet lists or structured tables.
  3. *Priority & Task reweighting:* Elevating deadlines or tagging action items as urgent.
* The extracted organizational rationale is recorded as a permanent preference rule into **Layer 4 (Behavioral & Preference Ledger)**.

### 5.6. Physical Vault Directory Structure & Cross-Boundary Traversal
To accommodate the Universal Inbox, non-exclusive multi-tagging, and knowledge graph links without filesystem conflicts, the Git Vault uses a structured layout:

```text
data/vault/{user_id}/
├── _inbox/                       # Fast-capture landing zone (unprocessed notes)
│   └── 01j9a_quick_thought.md
├── _assets/                      # Binary media vault (audio recordings, PDFs, images)
│   ├── rec_01j9b.m4a
│   └── doc_01j9c.pdf
├── _core/                        # Living Cognitive Identity & Core Rules
│   ├── identity.md
│   ├── behavioral_ledger.md
│   └── vault_index.json
└── folders/                      # Optional explicit folder hierarchy
    ├── Work/
    │   └── ScribeX/
    │       └── 01j9d_architecture.md
    └── Personal/
        └── 01j9e_daily_plan.md
```

Each note maintains rich YAML frontmatter:
```yaml
---
id: "01j9d"
title: "Architecture Blueprint"
group: "Core Engineering"
folder: "Work/ScribeX"
tags: ["#architecture", "#v1", "#critical"]
relations:
  - target: "01j9e"
    type: "relates_to"
  - target: "01j9f"
    type: "supersedes"
color: "lavender"
status: "active"
sync_rev: 142
---
```

### 5.7. Automated Off-Site Cloud Backup
* Every commit to the VPS Git Vault and hourly SQLite snapshot (via `Litestream` or `rclone`) is automatically pushed to a **Private Git Repository (GitHub/GitLab)** and/or **Encrypted S3-Compatible Storage (Cloudflare R2 / Backblaze B2)**. If you ever migrate to a new VPS or new device, your entire life history restores in one command.

---

## 6. Technical Implementation of the 4-Layer Cognitive Memory

| Memory Layer | Storage Medium on VPS | Technical Schema & Role |
| :--- | :--- | :--- |
| **Layer 1: Core Identity & Vault Index (Always-Active)** | `_core/identity.md` + `_core/vault_index.json` (Cached in FastAPI RAM) | Injected into the system prompt of every Main AI call ($\sim 1,500\text{ tokens}$). Contains your current profile summary, active short/long-term goals, top priorities, and the directory map of all existing note groups. |
| **Layer 2: Living Notes & Semantic Graph** | Markdown Vault (`.md` files with Extended AST) + SQLite `entity_relations` + `tasks` + LanceDB | Notes store composable blocks projected to Markdown. SQLite stores bidirectional graph edges (`related_to`, `part_of`, `derived_from`, `contradicts`, `supersedes`) and unified task entities so retrieval always pulls connected context. |
| **Layer 3: Temporal Identity & Version Logs ("Versions of Me")** | SQLite `identity_timeline` + `task_history` + Git Commit Log | Bi-temporal table storing (`attribute`, `old_value`, `new_value`, `valid_from`, `valid_to`, `change_reason`, `git_commit_sha`). Tracks every evolution of your career, goals, mindset, and past tasks without overwriting history. |
| **Layer 4: Behavioral & Preference Ledger** | `_core/behavioral_ledger.md` + SQLite `learned_preferences` | Stores structured rules learned from your response patterns and noise-filtered manual edit diffs (`category`, `preference_rule`, `confidence_score`, `source_diff_sha`). Dynamically shapes the AI's persona, questioning threshold, and filing logic. |

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
├── frontend/                           # Universal Expo App (iOS, Android, Web)
│   ├── app/                            # Expo Router file-based screens
│   │   ├── _layout.tsx                 # Root layout (ThemeProvider, SQLiteProvider, Modals)
│   │   ├── index.tsx                   # Main Canvas (Friction-free Notes Surface)
│   │   ├── note/
│   │   │   └── [id].tsx                # Focused Deep Note View
│   │   ├── folders/                    # Folder Hierarchy & Navigation Tree
│   │   ├── search/                     # Fast Search & Smart Collections
│   │   └── settings/                   # User Preferences & Vault Settings
│   ├── src/
│   │   ├── components/                 # Fluid, non-generic UI (NativeWind v4)
│   │   │   ├── editor/                 # Composable Block Editor & AST Renderers
│   │   │   │   ├── BlockEditor.tsx     # Canvas container & interaction manager
│   │   │   │   ├── BlockRenderer.tsx   # Polymorphic block dispatcher
│   │   │   │   ├── BlockGutter.tsx     # Drag handles, type switchers, add buttons
│   │   │   │   └── blocks/             # 20 Content Blocks (Text, Table, Code, LaTeX, Audio, etc.)
│   │   │   ├── navigation/             # App Header, Folder Tree Drawer, Breadcrumbs
│   │   │   ├── relations/              # Bidirectional links, Graph Drawer & Backlinks
│   │   │   ├── media/                  # Audio Player, Lightbox, Document Viewer
│   │   │   └── ui/                     # Fluid buttons, chips, menus, modals (non-card!)
│   │   ├── db/                         # Local-First SQLite Engine (expo-sqlite / OPFS)
│   │   │   ├── schema.ts               # DDL for notes, folders, tags, tasks, assets, relations
│   │   │   ├── client.ts               # Database connection & WAL mode config
│   │   │   ├── notesRepo.ts            # Notes CRUD & atomic block operations
│   │   │   ├── foldersRepo.ts          # Nested folder operations & path resolution
│   │   │   ├── tagsRepo.ts             # Tag operations & associations
│   │   │   ├── tasksRepo.ts            # Unified task model CRUD & syncing
│   │   │   ├── relationsRepo.ts        # Graph edges & bidirectional backlinks
│   │   │   └── searchRepo.ts           # FTS5 full-text search & Smart Collections
│   │   ├── core/                       # AST Parsers & Markdown Serializers
│   │   │   ├── astSerializer.ts        # NoteBlock[] <-> Extended Markdown AST converter
│   │   │   ├── markdownParser.ts       # GFM parser with YAML frontmatter
│   │   │   └── types.ts                # TypeScript interfaces (Note, Folder, Tag, Block, Task)
│   │   ├── sync/                       # Delta Sync Client (Phase 2)
│   │   │   ├── syncEngine.ts           # Event-sourced changelog processor
│   │   │   ├── syncClient.ts           # WebSocket doorbell & REST fallback client
│   │   │   └── useSync.ts              # Reactive hook for sync state
│   │   └── theme/                      # Styling & Design Tokens
│   │       ├── tokens.ts               # Soft minimalist pastel & dark theme palette
│   │       └── ThemeProvider.tsx       # Theme state provider
│   ├── tailwind.config.js              # NativeWind v4 Tailwind configuration
│   ├── global.css                      # Base stylesheet & CSS variables
│   ├── babel.config.js                 # Expo + NativeWind + Worklets Babel config
│   ├── app.json                        # Expo configuration
│   └── package.json                    # Frontend dependencies
│
├── backend/                            # 24/7 Cloud VPS FastAPI Backend (Phase 2 & 3)
│   ├── app/
│   │   ├── main.py                     # FastAPI entry point & lifespan events
│   │   ├── core/
│   │   │   ├── config.py               # VPS environment settings & paths
│   │   │   └── security.py             # Auth & JWT verification
│   │   ├── api/
│   │   │   ├── sync_ws.py              # Multi-device WebSocket doorbell hub
│   │   │   ├── sync_http.py            # HTTP REST delta sync fallback (/push, /pull)
│   │   │   ├── assets.py               # Binary media upload & streaming (/assets/upload)
│   │   │   ├── intake.py               # Friday universal intake & ambiguity gate (Phase 3)
│   │   │   └── pc_bridge_ws.py         # Remote PC daemon WebSocket controller (Phase 4)
│   │   ├── db/
│   │   │   ├── schemas.sql             # Authoritative SQLite WAL schemas
│   │   │   └── sqlite_db.py            # Async SQLite manager (aiosqlite)
│   │   ├── storage/
│   │   │   ├── git_vault.py            # GitPython commit, merge & diff engine
│   │   │   ├── lancedb_store.py        # Embedded vector index (Phase 3)
│   │   │   └── file_parser.py          # Whisper & document text extraction
│   │   ├── agents/                     # Friday AI Brain & Multi-Agent Orchestrator (Phase 3)
│   │   │   ├── orchestrator.py         # Friday assistant core logic
│   │   │   ├── intake_agent.py         # Ask-Before-Write ambiguity gate
│   │   │   ├── onboarding_agent.py     # Interactive discovery interview
│   │   │   └── scheduler.py            # Daily briefings & memory consolidation
│   │   └── memory/                     # 4-Layer Cognitive Memory (Phase 3)
│   │       ├── layer1_identity.py      # Core Identity & Always-Active Index
│   │       ├── layer2_vault.py         # Git Markdown Vault + LanceDB + Graph
│   │       ├── layer3_temporal.py      # Bi-temporal "Versions of Me" & Task Logs
│   │       └── layer4_learner.py       # Behavioral Ledger & Manual Git Diff Learner
│   ├── data/                           # Mounted persistent NVMe volume on VPS
│   │   ├── vault/                      # Git-backed Markdown context files (mirroring folders)
│   │   ├── sqlite/                     # scribex_core.db
│   │   └── lancedb/                    # Embedded vector index
│   ├── Dockerfile
│   └── pyproject.toml
│
├── pc-agent-bridge/                    # Lightweight Daemon installed on Personal PC (Phase 4)
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

To build and test this systematically without getting overwhelmed, instruct your AI coding assistant to follow these phases starting from the **user's core journey first**:

* **Phase 1: Universal Manual Note Engine & Local-First Canvas (Core User Journey) — `[ ] ACTIVE FOUNDATION`:**  
  Build the client-side universal note application with sub-5ms local SQLite storage (`expo-sqlite` / OPFS), soft minimalist pastel design tokens (strictly avoiding generic cards or boxy layouts), composable block editor engine supporting all 20 content blocks and 42 manual input methods, hierarchical folders (with physical vault directory mirroring), multi-tags, starred favorites, pinning, 30-day recoverable trash, bidirectional cross-note links (`[[Note Title]]`), unified task engine (note checklist $\leftrightarrow$ global task board), and fast local full-text search (< 5ms via FTS5). *See [Phase_1_Implementation_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Phase_1_Implementation_Plan.md) and [Universal_Note_Input_Structure_and_Relations.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Universal_Note_Input_Structure_and_Relations.md).*
* **Phase 2: Resilient Client-Server Delta Sync & Multi-Device Vault Mirroring — `[ ] NEXT`:**  
  Set up the 24/7 Cloud VPS FastAPI core with SQLite WAL operational tables (`sync_changelog`, `folders`, `tags`, `notes`, `tasks`, `assets`, `entity_relations`), real-time WebSocket doorbell push (< 50ms) with reconnection catch-up and HTTP REST fallback (`/push`, `/pull`), binary asset upload pipeline (`/api/v1/assets/upload`), and asynchronous Git Markdown Vault projection. *See [Phase_2_Implementation_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Phase_2_Implementation_Plan.md).*
* **Phase 3: Cognitive Memory & Friday AI Assistant Integration — `[ ] PENDING`:**  
  Integrate the Friday conversational assistant, interactive discovery onboarding interview, Ask-Before-Write Ambiguity Gate with universal multi-modal intake router, LanceDB embedded vector semantic search, and the 4-layer cognitive memory architecture (Layer 1 Identity, Layer 2 Living Notes & Graph, Layer 3 Temporal "Versions of Me", Layer 4 Behavioral Ledger & noise-filtered Git manual diff learner). *See [Phase_3_Implementation_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Phase_3_Implementation_Plan.md).*
* **Phase 4: Remote PC Agent Bridge Daemon & Pluggable CLI Execution — `[ ] PENDING`:**  
  Deploy the `pc-agent-bridge` daemon on the user's personal PC with outbound WebSocket tunnel, configure `cli_agents.yaml` supporting any local CLI AI agent (Claude Code, Gemini CLI, Codex, Aider), and activate the 3-stage independent verification & self-correction loop.
* **Phase 5: SaaS Multi-Tenancy, Commercial Billing & Production Scaling — `[ ] PENDING`:**  
  Attach multi-tenant parameterized `user_id` security boundaries, production authentication (Clerk / Supabase Auth), Stripe billing webhooks, LiteLLM token spend quotas, and Docker Compose deployment with automated Caddy HTTPS. *See [SaaS_Architecture_and_Integration_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/SaaS_Architecture_and_Integration_Plan.md).*