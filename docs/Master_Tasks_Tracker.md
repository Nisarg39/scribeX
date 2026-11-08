# ScribeX Master Tasks Tracker

> **Purpose:** High-level task management checklist tracking what is completed and what remains across the ScribeX architecture.  
> **Status:** Active Tracking Document  
> **Execution Strategy:** Build from the **User's Journey First**: Establish the comprehensive manual note-taking engine with all 42 input methods, local SQLite storage, folders, tags, and relations, followed by client-server delta sync, and then the Friday AI assistant.  
> **Last Updated:** November 8, 2026  

---

## Progress Overview

| Phase | Description | Status | Reference Doc |
| :---: | :--- | :---: | :--- |
| **Phase 1** | **Universal Manual Note Engine & Local-First Canvas (Core User Journey)** | `[x] COMPLETED (100% AUDITED & VERIFIED)` | [Universal_Note_Input_Structure_and_Relations.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Universal_Note_Input_Structure_and_Relations.md) |
| **Phase 2** | **Supabase Realtime Sync, Next.js Serverless AI (Vercel) & Google Drive Media Vault** | `[ ] NEXT IN QUEUE` | [Phase_2_Cloud_Sync_and_Backend_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Phase_2_Cloud_Sync_and_Backend_Plan.md) |
| **Phase 3** | **Cognitive Memory & Friday AI Assistant Integration** | `[ ] PENDING` | [Technical_System_Architecture.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md#6-cognitive-memory-architecture-4-layer-engine) |
| **Phase 4** | **Remote PC Bridge Daemon + Pluggable CLI Verification Loop** | `[ ] PENDING` | [Technical_System_Architecture.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md#7-remote-pc-agentic-execution--pluggable-cli-daemon) |
| **Phase 5** | **SaaS Multi-Tenancy, Commercial Billing & Production Scaling** | `[ ] PENDING` | [SaaS_Architecture_and_Integration_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/SaaS_Architecture_and_Integration_Plan.md) |

---

## Completed Phase 1 Ledger: Universal Manual Note Engine & Local-First Canvas

> **Source of Truth:** [Universal_Note_Input_Structure_and_Relations.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Universal_Note_Input_Structure_and_Relations.md)  
> **Critical Design Constraint:** Strictly avoid generic cards, boxy components, and cookie-cutter SaaS widgets. Deliver a serene, soft minimalist editorial canvas with pastel note accents and circular action controls.

- [x] **Step 1: Frontend Scaffolding, NativeWind v4 Configuration & Pastel Design Tokens**
  - Universal Expo SDK 52 setup upgraded to Expo SDK 57 (`frontend/`).
  - NativeWind v4 + Tailwind CSS config with pastel note palette (`apricot`, `coral`, `lime`, `lavender`, `cyan`, `pink`, `sky`).
  - Fluid, non-generic workspace layout adhering strictly to `<RULE[user_global]>`.
- [x] **Step 2: Local-First Client SQLite Engine & Core Data Repositories**
  - SQLite DDL schemas: `folders`, `tags`, `notes`, `note_tags`, `tasks`, `assets`, `entity_relations`, `sync_changelog`.
  - Sub-5ms optimistic reads/writes, WAL mode auto-initialization, and event-sourced delta changelog tracking.
  - Strongly typed repositories: `notesRepo.ts`, `tasksRepo.ts`, `foldersRepo.ts`, `tagsRepo.ts`.
- [x] **Step 3: Composable Block Editor Engine & Standard AST Renderers**
  - Polymorphic block manager: paragraph, headings (H1–H4), bulleted list, numbered list.
  - Interactive block manipulation: insert, reorder, delete, Enter/Backspace split/merge.
  - Canonical Extended Markdown AST serializer (`NoteBlock[]` $\leftrightarrow$ `.md` round-tripping).
- [x] **Step 4: Structured Data Blocks: Tables, Code Blocks, LaTeX & Callouts**
  - Interactive tabular grid with row/column insertion and CSV paste.
  - Monospace code blocks with syntax highlighting and one-click copy.
  - Inline and display KaTeX LaTeX mathematical formulas.
  - Visual callout alert blocks (`info`, `warning`, `success`, `quote`).
- [x] **Step 5: Multi-Modal Media & File Capture (Drawings, Audio, Attachments, Bookmarks)**
  - Vector sketch pad with freehand pen, eraser, color palette, and SVG path persistence.
  - Audio voice recorder with waveform visualizer and scrub bar.
  - Document attachments (PDFs, spreadsheets) with preview cards.
  - Web bookmark preview cards with OpenGraph metadata scraping.
- [x] **Step 6: Unified Task Engine (Embedded Checklists $\leftrightarrow$ Global Task View)**
  - Single-source-of-truth task entity linking note checklist blocks to global task records.
  - Reactive completion toggle, priority weights (`low`, `medium`, `high`, `urgent`), and due dates.
- [x] **Step 7: Invisible Editorial Canvas Refactor (Blog Editor Flow & Resizable Media)**
  - Strip outer cards, borders, and per-block header strips from `BlockRenderer.tsx`.
  - Unify all text and headings into a continuous editorial sheet (Medium / Substack / Notion style).
  - Implement single floating contextual formatting dock + slash command palette (`/`).
  - Add inline resizable media controls (`33%`, `50%`, `75%`, `100%`) with alignment (`left`, `center`, `right`).
- [x] **Step 8: Hierarchical Folders & Lifecycle Actions**
  - Nested project subfolders with recursive parent paths.
  - Folder Rename, Delete (with preserve vs trash cascade), Move/Reparent, and subfolder creation.
  - Drag/move note into folders and breadcrumb navigation.
- [x] **Step 9: Multi-Tags, Starred Favorites, Pinning, Archive & 30-Day Trash**
  - Non-exclusive `#tag` chips with fast tag filtering.
  - Top-of-canvas pinning and favorite starring.
  - Soft-delete 30-day trash with restore and permanent cascade purge.
- [x] **Step 10: Bidirectional Cross-Note Links (`[[Note Title]]`) & Relational Knowledge Graph**
  - Autocomplete trigger for `[[` typing.
  - Backlinks drawer displaying incoming connections.
  - `entity_relations` edge tracking (`related_to`, `part_of`, `derived_from`, `contradicts`, `supersedes`).
- [x] **Step 11: Fast Local Search (< 5ms via FTS5) & Search History**
  - SQLite FTS5 full-text indexing over note titles, blocks, and tags.
  - Recent search chips ledger and query debouncing.
- [x] **Step 12: Note Multi-Filter & Sorting UI**
  - Filter modal covering block types, note status scopes, folder scopes, and tag filters.
  - Sort modal supporting 6 orders (`updated_desc`, `updated_asc`, `created_desc`, `created_asc`, `title_asc`, `title_desc`) with AsyncStorage persistence.
- [x] **Step 13: Local Workspace Backup & Restore & Storage Settings**
  - Full workspace JSON backup export and validated schema restore (Merge vs Replace modes).
  - Database health metrics and permanent trash purge.
- [x] **Step 14: Quality Gate & Test Suite Certification**
  - 36/36 Block AST Lossless Roundtrip verification (`npm run audit:all`).
  - 30/30 Headless Interaction and 50-step deep undo/redo verification (`npm run test:interactions`).
  - 13/13 Cross-platform UI/UX consistency assertions passing (`npm run test:uiux`).

---

## Upcoming Phases Summary

### Phase 2: Supabase Realtime Sync, Next.js Serverless AI (Vercel) & Google Drive Media Vault
- **Supabase Cloud Database & Auth Core:**
  - Supabase PostgreSQL schema with tables mirroring local SQLite (`notes`, `folders`, `tags`, `tasks`, `assets`, `entity_relations`, `sync_changelog`).
  - Row Level Security (RLS) enforcing strict tenant isolation (`auth.uid() = user_id`) and Supabase Auth (Social / Magic Link).
- **Bidirectional Real-Time Delta Sync Engine:**
  - `@supabase/supabase-js` client in frontend subscribing to Postgres Realtime CDC (Change Data Capture) channels.
  - Event-sourced delta sync coordinating between local SQLite (`expo-sqlite` / Wasm) and Supabase (`sync_changelog` with monotonic `sync_rev`).
  - Sub-5ms optimistic local writes with automatic background push and offline reconnection catch-up.
- **Serverless AI Engine on Next.js (Hosted on Vercel - Free Tier):**
  - Next.js App Router Route Handlers (`/api/ai/*`) deployed on Vercel for zero-cost hosting.
  - LLM orchestration endpoints for universal intake, proactive briefings, and task synthesis.
  - Audio transcription proxy (Cloud Whisper STT) for mobile recordings and live dictation.
  - Inbound webhook receivers (Method 41 Email-to-Note parser and Method 42 External integrations).
- **Zero-Cost Media Vault via Google Drive API:**
  - Media files (camera scans, audio recordings, PDFs, drawings, images) uploaded directly to the user's Google Drive via Google Drive API v3.
  - Supabase & local SQLite `assets` table store only lightweight metadata, Google Drive file IDs, and secure web links.
  - Zero storage disk costs and zero cloud egress fees; leverages user's free 15GB Google Drive storage.

### Phase 3: Cognitive Memory & Friday AI Assistant Integration
- Friday conversational assistant interface & proactive morning briefings powered by Next.js Serverless Routes.
- User-initiated interactive discovery interview ("Everything About Me").
- Ask-Before-Write Ambiguity Gate & universal intake router.
- 4-layer cognitive memory: Layer 1 (Identity), Layer 2 (Living Vault & pgvector / semantic embeddings), Layer 3 (Versions of Me temporal timeline), Layer 4 (Behavioral Ledger & noise-filtered edit learner).
- **Universal AI Connector & MCP Server (Cross-AI Parity):** Standalone MCP server (stdio / SSE) and OpenAI/Anthropic REST proxy exposing identical 4-layer cognitive context, vault search, task execution, and reminder triggers to external AIs (Claude Desktop, Gemini, ChatGPT, Cursor) with full feature parity. *See [Universal_AI_Connector_and_MCP_Architecture.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Universal_AI_Connector_and_MCP_Architecture.md).*

### Phase 4: Remote PC Agent Bridge Daemon & Pluggable CLI Execution
- Outbound WebSocket tunnel daemon (`pc-agent-bridge`) running on personal PC.
- Configurable CLI Agent Provider Registry (`cli_agents.yaml`: Claude Code, Gemini CLI, Codex, Aider).
- 3-stage independent verification & self-correction loop (process telemetry, git diff, AI review).

### Phase 5: SaaS Multi-Tenancy, Commercial Billing & Production Scaling
- Multi-tenant isolated databases & parameterized `user_id` security boundaries.
- Production authentication (Clerk / Supabase Auth).
- Stripe subscription billing & LiteLLM token spend quotas.
- Docker Compose deployment with Caddy reverse proxy.
