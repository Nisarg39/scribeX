# Technical System Architecture: ScribeX - Friday (Iron man style Personal Assistant)

## 1. Architectural Overview & Core Design Principles

This document defines the production technical architecture for ScribeX - Friday (Iron man style Personal Assistant) & Note-Taking Platform. It is designed to be handed directly to an AI coding assistant to scaffold and implement the system.

### Core Architectural Pillars
0. **User Journey Starts with Friction-Free Manual Note Taking First, AI Assistant Second:** The foundation of ScribeX is a world-class, local-first note-taking experience that works with zero friction and zero mandatory AI setup. The user can immediately capture ideas, organize folders, tag items, write rich blocks, track tasks, and link notes with sub-5ms local SQLite speed. The AI assistant ("Friday") is layered on top of this rock-solid note engine as an intelligent companion rather than an intrusive gatekeeper.
1. **Zero-Cost Serverless Cloud Architecture (Supabase + Vercel):** The cloud operational core runs on Supabase (PostgreSQL with Realtime CDC subscriptions, Supabase Auth, and Row-Level Security), while AI orchestration and API routing execute on Next.js hosted on Vercel's free serverless tier. This delivers 24/7 high availability, instant autoscaling, and zero hosting expenses.
2. **True Local-First Performance (< 5ms SQLite Writes) + Real-Time Cloud Mirroring:** The client device (iOS, Android, Desktop Web) operates directly against its local SQLite database (`expo-sqlite` on native, Wasm + IndexedDB on Web) for zero-latency UI response. When online, Supabase Realtime synchronization streams deltas bi-directionally via an event-sourced `sync_changelog` with monotonic `sync_rev` revision tracking.
3. **Zero-Cost Media Vault via Google Drive API:** Rather than incurring expensive object storage or server disk bills, media assets (audio memos, camera scans, drawings, PDF attachments, images) are stored directly on the user's personal Google Drive via Google Drive API v3. Supabase and local SQLite tables store only lightweight asset links, file IDs, and extracted metadata.
4. **Decoupled Remote PC Agentic Execution:** The user's personal PC runs a lightweight background daemon (`pc-agent-bridge`) that communicates with the Next.js API and Supabase Realtime channel. When the PC is online, it executes tasks via any configured CLI AI agent (Claude Code, Gemini CLI, Codex CLI, Aider, Goose, OpenCode) with an independent 3-stage verification loop.
5. **Day-1 SaaS-Ready Architecture (Zero-Rewrite Commercial Path):** All database schemas, sync logs, and RLS policies enforce a parameterized `user_id` convention (tied to `auth.uid()`). This guarantees that transitioning to a multi-tenant commercial SaaS requires zero schema rewrites.

---

## 2. High-Level System Topology

```
+-----------------------------------------------------------------------------------+
|                        UNIVERSAL EXPO CLIENTS (Local-First)                       |
|                                                                                   |
|  +-------------------------+  +-------------------------+  +-------------------+  |
|  |   Expo iOS / Android    |  |    Expo Desktop Web     |  |   Personal PC     |  |
|  | (Voice, Camera Scan,    |  | (3-Pane Workspace,      |  | Local Vault Mirror|  |
|  |  Multi-Select, Notes)   |  |  Manual Context Control)|  |                   |  |
|  +------------+------------+  +------------+------------+  +---------+---------+  |
|               |                            |                         |            |
|  [Local SQLite + MMKV Cache]  [IndexedDB / Wasm SQLite]   [Local Git Workspace]   |
+---------------+----------------------------+-------------------------+------------+
                |                            |                         |
                +----------------------------+-------------------------+
                                             |
              HTTPS REST & Supabase Realtime WebSocket Subscriptions
                                             |
+--------------------------------------------v--------------------------------------+
|             SERVERLESS CLOUD ARCHITECTURE (Zero Hosting Cost Model)               |
|                                                                                   |
|  +-------------------------------------+  +------------------------------------+  |
|  |   SUPABASE REALTIME CLOUD CORE      |  |    NEXT.JS SERVERLESS AI ENGINE    |  |
|  |   (PostgreSQL 15+ & Realtime CDC)   |  |    (Hosted on Vercel - $0/mo Free) |  |
|  |  - notes, tasks, folders, tags, rels|  |  - Friday Multi-Modal Intake & RAG |  |
|  |  - sync_changelog (delta ledger)    |  |  - Cloud Whisper STT Audio Proxy   |  |
|  |  - Supabase Auth + Row-Level Sec    |  |  - Inbound Email & External Hooks  |  |
|  |  - pgvector Semantic Embeddings     |  |  - Remote PC Task Dispatcher       |  |
|  +------------------+------------------+  +------------------+-----------------+  |
|                     |                                        |                    |
|                     +--------------------+-------------------+                    |
|                                          |                                        |
|                          +---------------v---------------+                        |
|                          |    GOOGLE DRIVE MEDIA VAULT   |                        |
|                          |     (Google Drive API v3)     |                        |
|                          |  - Zero-Cost Binary Storage   |                        |
|                          |  - Camera Scans, Audio Memos  |                        |
|                          |  - PDFs, Images & Attachments |                        |
|                          |  - Secure Tokenized Web Links |                        |
|                          +-------------------------------+                        |
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
  * **Zero-Friction Universal Input Bar:** Persistent bottom bar supporting text, file attachments, and instant voice recording (streamed to Next.js API for transcription and intake).
  * **Native OS Share Extension (`expo-share-intent`):** Allows sharing PDFs, screenshots, voice memos, or URLs directly from any mobile app into the assistant.
  * **Actionable Push Notifications (`expo-notifications`):** Interactive notification buttons (`[Approve]`, `[Reject]`, `[Reply]`) for answering the AI's clarifying questions or approving sensitive Remote PC CLI actions without opening the full app.
* **Desktop Web Surface:**
  * **3-Pane Command Center Layout:**
    * *Left Pane:* Context Vault File Tree, Dynamic Note Groups, Priority Queue, and Version History Timeline.
    * *Center Pane:* Full Markdown Note Editor, Side-by-Side Diff Viewer (comparing manual edits vs. AI edits), and Onboarding/Profile Dashboard.
    * *Right Pane:* Conversational AI Assistant & Live Remote PC CLI Terminal Stream.

---

## 4. Backend Architecture: Supabase Realtime Database, Next.js Serverless AI (Vercel), & Google Drive Media Vault

### 4.1. Zero-Cost Serverless & Cloud Infrastructure Advantage
Rather than maintaining an expensive dedicated Linux VPS server ($20–$50/mo), the production architecture adopts a **Zero-Cost Serverless Cloud Architecture** coordinating three specialized cloud tiers on their generous free offerings:
1. **Supabase Cloud (PostgreSQL 15+ & Realtime CDC):** Authoritative operational store, instant WebSocket real-time change broadcasting, secure authentication, and granular Row-Level Security (`RLS`).
2. **Next.js on Vercel (Hobby Serverless Tier — $0/mo):** Hosts serverless AI API orchestration routes (`/api/ai/*`), Friday cognitive workflows, Cloud Whisper STT proxy, and external inbound webhook receivers.
3. **Google Drive Media Vault (Google Drive API v3):** Provides zero-cost, persistent media storage for audio recordings, camera scans, drawings, and documents, leveraging each user's free 15GB Google Drive storage. Note records and the `assets` table only store lightweight metadata and authenticated file links.

### 4.2. Core Backend Tech Stack
* **Cloud Database & Realtime Sync Hub:** **Supabase** (PostgreSQL 15+, Supabase Realtime via PostgreSQL CDC, Row-Level Security, Supabase Auth).
  * Stores operational tables: `notes`, `folders`, `tags`, `note_tags`, `tasks`, `assets`, `entity_relations`, and `sync_changelog`.
  * Built-in vector support via **`pgvector`** for semantic search embeddings across note content.
* **Serverless AI & API Gateway:** **Next.js (App Router)** hosted on **Vercel**:
  * Edge & Node.js Serverless Route Handlers (`/api/ai/intake`, `/api/ai/chat`, `/api/ai/briefing`, `/api/ai/transcribe`, `/api/webhooks/*`).
  * LLM Orchestration via Vercel AI SDK or direct provider SDKs (Gemini 1.5 Pro, Claude 3.5 Sonnet, GPT-4o) with structured JSON outputs.
  * Audio transcription proxy (Cloud Whisper STT) for mobile recordings and live dictation.
* **Media & Asset Vault:** **Google Drive API v3**:
  * User-authorized OAuth 2.0 or service account upload.
  * Files stored in an isolated folder (`ScribeX_Vault/assets/`) on the user's personal Google Drive.
  * Zero hosting disk costs, zero cloud egress fees; note records store Google Drive file IDs and web URLs.
* **Client Database (Local-First):** `expo-sqlite` (native SQLite on iOS/Android, `sql.js` + IndexedDB on Web) maintaining instant sub-5ms local reads and writes.

---

## 5. Hybrid Local-First Storage & Real-Time Multi-Device Delta Sync

To allow you to use your phone, tablet, and desktop web browser **concurrently** with instant local speed, offline resilience, and zero data loss, the platform uses a **Local SQLite Operational Core + Supabase Realtime Delta Sync + Google Drive Media Vault Protocol**.

### 5.1. Architecture of Truth: Decoupled Local Operational & Cloud Sync Layers
To ensure maximum speed without network blocking:
1. **Local Operational Layer (Zero-Latency Core):** The client device writes immediately to local SQLite (`expo-sqlite` on native, `sql.js` + IndexedDB on Web) with sub-5ms latency. High-frequency operations (typing blocks, checking off tasks, updating priorities, creating folders, tagging) occur as atomic local SQLite transactions.
   * `folders`: Hierarchical project containers with recursive `parent_id`.
   * `tags` & `note_tags`: Multi-dimensional classification tags and many-to-many note associations.
   * `notes`: Stores `content_markdown` along with cached `blocks_json` for instant UI rendering across all composable block types.
   * `tasks`: Single-source-of-truth task entities shared between embedded note blocks and the global task engine.
   * `assets`: Tracks binary media metadata (Google Drive file IDs, web URLs, processing states, and extracted OCR/Whisper text).
   * `entity_relations`: Bidirectional knowledge graph edges (`related_to`, `part_of`, `derived_from`, `contradicts`, `supersedes`).
   * `sync_changelog`: Event-sourced change ledger tracking monotonic `sync_rev` deltas for all operational entities.
2. **Cloud Operational Layer (Supabase PostgreSQL + Realtime CDC):** When online, local deltas are pushed to Supabase PostgreSQL, and Supabase Realtime broadcasts change-data-capture (CDC) events to all connected tenant devices.
3. **Media Vault Layer (Google Drive API):** When a user attaches a photo, scan, audio note, or PDF, the file binary is sent to Google Drive. The returned Google Drive file ID and web view link are saved in Supabase and local SQLite `assets` table. No heavy binaries ever hit Supabase database storage.

### 5.2. Local-First Reading & Optimistic Writes
1. **Instant Local Reads ($0\text{ ms}$):** When you open the Expo app on any device, the UI renders immediately from the local SQLite database replica.
2. **Optimistic Local Writes:** When you edit a block or check off a task, the change writes immediately to your device's local SQLite storage with a `pending_sync: true` flag and queues for transmission to Supabase.

### 5.3. Resilient Multi-Device Sync Protocol (`sync_rev`) & Multi-Entity Changelog
To guarantee that syncing is 100% reliable even when devices sleep, disconnect, or switch networks:

* **Event-Sourced Revision Counter (`sync_rev`):** Every operational row tracks a monotonically increasing integer `sync_rev`. The `sync_changelog` table records every incremental delta across entity types (`folder`, `tag`, `note`, `task`, `relation`, `asset`).
* **Supabase Realtime Subscriptions (Instant Push):**
  * When devices are online, they subscribe to Supabase Realtime channels (`supabase.channel('user-sync')`). Changes broadcast across devices in $< 50\text{ ms}$.
  * If a device disconnects or goes into background sleep, the WebSocket simply disconnects without losing data.
* **Guaranteed Reconnection Catch-Up (State Reconciliation):**
  * When a device reconnects, the client queries Supabase: `SELECT * FROM sync_changelog WHERE sync_rev > :local_sync_rev ORDER BY sync_rev ASC`.
  * The client applies these deltas inside a local SQLite transaction and pushes any queued `pending_sync` local edits up to Supabase.
* **HTTPS REST Sync Fallback:**
  * If Realtime WebSockets are blocked by restrictive firewalls, standard Supabase REST API queries (`/rest/v1/sync_changelog`) fetch deltas seamlessly.

### 5.4. Conflict Resolution Strategy
* **Tasks & Metadata (Field-Level LWW):** For priority changes, tag updates, and task completions, SQLite uses field-level Last-Write-Wins (LWW) based on NTP-synchronized UTC timestamps (`updated_at`).
* **Unified Task Model Synchronization:** Checking off a task embedded inside a meeting note immediately updates the `tasks` table and emits a `task` delta. The background projector simultaneously updates the `- [x]` marker in the note's `.md` file, keeping both views in perfect sync.
* **Note Body Text (3-Way Merge & AI Reconciliation):** If two devices simultaneously edit blocks of the same note while offline, Next.js / Supabase detects the concurrent revision and runs a 3-way text merge (`diff3` / AST merge) on the Markdown AST. If non-overlapping lines/blocks were edited, they merge cleanly. If conflicting edits overlap, both versions are preserved in a conflict block (`<<<<<<< LOCAL / >>>>>>> REMOTE`) and the Main AI assistant immediately prompts the user via a quick mobile notification or chat prompt to choose or synthesize the final text.

### 5.5. Manual Edit Diff Learning Pipeline (Noise-Filtered)
Because the system synchronizes all accepted note edits into the Markdown context store:
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
* All notes and tables in Supabase are continuously backed up via point-in-time recovery (PITR) and automated daily snapshots. Media files are safeguarded by Google's native Drive redundancy. If you ever migrate to a new device, your entire vault restores in seconds from Supabase and Google Drive.

---

## 6. Technical Implementation of the 4-Layer Cognitive Memory

| Memory Layer | Storage Medium | Technical Schema & Role |
| :--- | :--- | :--- |
| **Layer 1: Core Identity & Vault Index (Always-Active)** | Supabase `user_profile` table + `_core/identity.md` (Cached in Next.js Serverless runtime) | Injected into the system prompt of every Main AI call ($\sim 1,500\text{ tokens}$). Contains your current profile summary, active short/long-term goals, top priorities, and the directory map of all existing note groups. |
| **Layer 2: Living Notes & Semantic Graph** | Supabase PostgreSQL (`notes`, `entity_relations`, `tasks`) + `pgvector` semantic embeddings | Notes store composable blocks projected to Markdown. PostgreSQL stores bidirectional graph edges (`related_to`, `part_of`, `derived_from`, `contradicts`, `supersedes`) and unified task entities so retrieval always pulls connected context. |
| **Layer 3: Temporal Identity & Version Logs ("Versions of Me")** | Supabase `identity_timeline` + `task_history` table | Bi-temporal table storing (`attribute`, `old_value`, `new_value`, `valid_from`, `valid_to`, `change_reason`). Tracks every evolution of your career, goals, mindset, and past tasks without overwriting history. |
| **Layer 4: Behavioral & Preference Ledger** | Supabase `learned_preferences` table + `_core/behavioral_ledger.md` | Stores structured rules learned from your response patterns and noise-filtered manual edit diffs (`category`, `preference_rule`, `confidence_score`). Dynamically shapes the AI's persona, questioning threshold, and filing logic. |

### The Ask-Before-Write Ambiguity Gate
When you submit a new raw note or file to `POST /api/ai/intake` (Next.js App Router endpoint on Vercel):
1. The Main AI evaluates the input against **Layer 1** and **Layer 2** and returns a structured schema:
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
2. If `clarity_score < 0.85` or contradictions exist, Next.js holds the note in a `staging_intake` record in Supabase and pushes the clarifying question to your Expo app. Only after you reply does it commit the note update.

---

## 7. Remote PC Agentic Execution & Pluggable CLI Daemon

Because the Next.js and Supabase backend runs 24/7 in the cloud and your Personal PC is on your home/office network, the PC runs a lightweight Python service called the **`pc-agent-bridge`**.

### 7.1. Connectivity & Offline Resilience
* **Zero Open Ports on PC:** The `pc-agent-bridge` initiates an outbound persistent connection / WebSocket authenticated with a machine token.
* **PC Offline Task Queueing:** If you assign a PC task from your phone while your PC is turned off or asleep:
  * Next.js saves the Context-Enriched Execution Spec in the Supabase `pc_task_queue` table with status `QUEUED_WAITING_FOR_PC`.
  * The moment your PC boots up and `pc-agent-bridge` connects, the queued task is automatically dispatched (or a push notification is sent asking if you want to start it now).
* **Automatic Vault Mirroring:** Whenever the PC is online, the `pc-agent-bridge` keeps a local mirror of your Markdown context files in sync so local CLI agents can directly read any reference file or note on disk.

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
When the Main AI dispatches a task to the `pc-agent-bridge`:

1. **Pre-Execution Safety Checkpoint:**
   * The `pc-agent-bridge` verifies the target directory is inside `allowed_workspaces`.
   * If the directory is a Git repository, it records the pre-task `HEAD` hash and creates a safety snapshot (`git stash create`) so any failed execution can be rolled back cleanly.
2. **Headless CLI Execution & Live Streaming:**
   * The bridge spawns the selected CLI agent subprocess, streams live stdout/JSON events over WebSocket / REST to Next.js and Supabase (visible in your Expo app), and intercepts any high-risk permission requests to trigger a mobile/web approval prompt.
3. **3-Stage Verification Pipeline (Zero Blind Trust):**
   * **Stage 1 (Process Telemetry):** Captures process exit code, execution duration, and CLI agent output summary.
   * **Stage 2 (Deterministic Environment Proof):** The bridge runs independent verification commands *outside* the CLI agent:
     * `git status --porcelain` and `git diff` (proving exact lines changed).
     * File existence, checksums, and byte sizes for non-code tasks.
     * Custom verification command specified by the Main AI (e.g., `pytest`, `npm run build`, `ruff check`).
   * **Stage 3 (Main AI Acceptance Review):** The bridge sends the deterministic proof bundle back to Next.js. The Main AI compares the actual `git diff` and test results against your original task requirements.
     * **If verification fails:** Next.js automatically dispatches a corrective prompt back to the CLI agent (up to `max_retries = 3`).
     * **If verification passes:** Next.js marks the checklist item complete in Supabase, logs the execution summary and diff in **Layer 3 (Task History)**, updates the relevant project notes in **Layer 2**, and notifies your Expo app.

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
├── backend/                            # Next.js Serverless AI & API Gateway (Phase 2 & 3 - Vercel)
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/
│   │   │   │   ├── intake/route.ts     # Friday universal intake & ambiguity gate
│   │   │   │   ├── chat/route.ts       # Friday conversational assistant & tool-calling
│   │   │   │   ├── briefing/route.ts   # Proactive morning briefings & priority recalculation
│   │   │   │   └── transcribe/route.ts # Whisper STT audio proxy for mobile recordings
│   │   │   ├── gdrive/
│   │   │   │   ├── auth/route.ts       # Google Drive OAuth 2.0 flow
│   │   │   │   └── upload/route.ts     # Google Drive file upload & permission generator
│   │   │   └── webhooks/
│   │   │       ├── email/route.ts      # Method 41: Inbound Email-to-Note parser
│   │   │       └── integrations/route.ts # Method 42: External GitHub/GCal webhooks
│   │   └── page.tsx                    # Optional web dashboard / status
│   ├── lib/
│   │   ├── supabaseAdmin.ts            # Supabase service role client
│   │   ├── gdrive.ts                   # Google Drive API client
│   │   └── ai/
│   │       ├── FridayBrain.ts          # Cognitive orchestrator & prompt templates
│   │       ├── memory.ts               # pgvector / semantic search retrieval
│   │       └── ambiguityGate.ts        # Ask-Before-Write evaluation logic
│   ├── supabase/
│   │   └── migrations/
│   │       ├── 001_initial_schema.sql  # notes, folders, tags, tasks, assets, relations
│   │       ├── 002_rls_policies.sql    # Row-Level Security rules (auth.uid() = user_id)
│   │       └── 003_realtime_setup.sql  # Supabase Realtime publication for sync_changelog
│   ├── package.json                    # Next.js, Vercel AI SDK, @supabase/supabase-js, googleapis
│   └── vercel.json                     # Vercel deployment & cron configurations
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
└── package.json                        # Root monorepo workspace configuration
```

---

## 9. Recommended Implementation Phases for Your Coding Assistant

To build and test this systematically without getting overwhelmed, instruct your AI coding assistant to follow these phases starting from the **user's core journey first**:

* **Phase 1: Universal Manual Note Engine & Local-First Canvas (Core User Journey) — `[x] COMPLETED (100% AUDITED)`:**  
  Built the client-side universal note application with sub-5ms local SQLite storage (`expo-sqlite` / OPFS / Wasm), soft minimalist pastel design tokens (strictly avoiding generic cards or boxy layouts), composable block editor engine supporting all 36 content blocks and manual input methods, hierarchical folders, multi-tags, starred favorites, pinning, 30-day recoverable trash, bidirectional cross-note links (`[[Note Title]]`), unified task engine (note checklist $\leftrightarrow$ global task board), multi-note selection with sticky contextual toolbar, and fast local search (< 5ms via FTS5).
* **Phase 2: Supabase Realtime Sync, Next.js Serverless AI (Vercel) & Google Drive Media Vault — `[ ] NEXT`:**  
  1. Provision Supabase PostgreSQL operational tables (`notes`, `folders`, `tags`, `note_tags`, `tasks`, `assets`, `entity_relations`, `sync_changelog`) with Supabase Auth and Row-Level Security (`RLS`).
  2. Implement bidirectional Realtime delta sync in the Expo frontend via `@supabase/supabase-js` subscribing to Postgres CDC channels and synchronizing local SQLite state.
  3. Deploy Next.js App Router API backend on Vercel ($0/mo free tier) for AI API endpoints (`/api/ai/*`), Friday cognitive workflows, Whisper STT proxy for audio blocks, and inbound webhook parsers (Methods 41 & 42).
  4. Integrate Google Drive API v3 for zero-cost media storage: photos, scans, audio recordings, and documents upload directly to the user's personal Google Drive folder (`ScribeX_Vault/assets/`), with secure web links and metadata persisted in Supabase and local SQLite.
* **Phase 3: Cognitive Memory & Friday AI Assistant Integration — `[ ] PENDING`:**  
  Integrate the Friday conversational assistant, interactive discovery onboarding interview, Ask-Before-Write Ambiguity Gate with universal multi-modal intake router, `pgvector` semantic embeddings in Supabase, and the 4-layer cognitive memory architecture (Layer 1 Identity, Layer 2 Living Notes & Graph, Layer 3 Temporal "Versions of Me", Layer 4 Behavioral Ledger & noise-filtered edit learner).
* **Phase 4: Remote PC Agent Bridge Daemon & Pluggable CLI Execution — `[ ] PENDING`:**  
  Deploy the `pc-agent-bridge` daemon on the user's personal PC with outbound WebSocket tunnel, configure `cli_agents.yaml` supporting any local CLI AI agent (Claude Code, Gemini CLI, Codex, Aider), and activate the 3-stage independent verification & self-correction loop.
* **Phase 5: SaaS Multi-Tenancy, Commercial Billing & Production Scaling — `[ ] PENDING`:**  
  Attach multi-tenant parameterized `user_id` security boundaries via Supabase Auth + RLS, Stripe subscription billing webhooks, LLM token spend quotas, and custom domain deployment. *See [SaaS_Architecture_and_Integration_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/SaaS_Architecture_and_Integration_Plan.md).*