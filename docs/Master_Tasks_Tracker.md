# ScribeX Master Tasks Tracker

> **Purpose:** High-level task management checklist tracking what is completed and what remains across the ScribeX architecture.  
> **Status:** Active Tracking Document  
> **Authoritative Specification:** [Unified_Backend_and_AI_Master_Specification.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Unified_Backend_and_AI_Master_Specification.md)  
> **Execution Strategy:** **User's Journey First**: Establish the comprehensive manual note canvas with all 42 input methods, local SQLite, folders, tags, and serverless reminders $\rightarrow$ Supabase Realtime CDC sync & direct RPCs $\rightarrow$ Client-Direct Friday AI & Universal MCP Connector.  
> **Last Updated:** November 9, 2026  

---

## Progress Overview

| Phase | Description | Status | Authoritative Blueprint |
| :---: | :--- | :---: | :--- |
| **Phase 1** | **Universal Manual Note Engine, Local SQLite & Serverless Reminders** | `[x] COMPLETED (100% AUDITED & VERIFIED)` | [Unified_Frontend_Master_Specification.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Unified_Frontend_Master_Specification.md) |
| **Phase 2** | **Supabase Realtime Sync, Direct RPCs & Google Drive Media Vault** | `[ ] NEXT IN QUEUE` | [Unified_Backend_and_AI_Master_Specification.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Unified_Backend_and_AI_Master_Specification.md#9-phased-delivery-roadmap) |
| **Phase 3** | **Cognitive Memory, Friday Client-Direct Assistant & Universal MCP Connector** | `[ ] PENDING` | [Unified_Backend_and_AI_Master_Specification.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Unified_Backend_and_AI_Master_Specification.md#4-the-4-layer-shared-cognitive-memory-model) |
| **Phase 4** | **Remote PC Bridge Daemon + Pluggable CLI Verification Loop** | `[ ] PENDING` | [Unified_Backend_and_AI_Master_Specification.md (Section 7)](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Unified_Backend_and_AI_Master_Specification.md#7-remote-pc-agentic-execution--pluggable-cli-daemon) |
| **Phase 5** | **SaaS Multi-Tenancy, Commercial Billing & Production Scaling** | `[ ] PENDING` | [Unified_Backend_and_AI_Master_Specification.md (Section 8)](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Unified_Backend_and_AI_Master_Specification.md#8-multi-tenancy-commercial-billing--security) |

---

## Completed Phase 1 Ledger: Universal Manual Note Engine & Local Canvas

> **Critical Design Constraint:** Strictly avoid generic cards, boxy components, and cookie-cutter SaaS widgets. Deliver a serene, soft minimalist editorial canvas with pastel note accents and circular action controls.

- [x] **Step 1: Frontend Scaffolding, NativeWind v4 Configuration & Pastel Design Tokens**
  - Universal Expo SDK 57 setup (`frontend/`).
  - NativeWind v4 + Tailwind CSS config with pastel note palette (`apricot`, `coral`, `lime`, `lavender`, `cyan`, `pink`, `sky`).
  - Fluid, non-generic workspace layout adhering strictly to `<RULE[user_global]>`.
- [x] **Step 2: Local-First Client SQLite Engine & Core Data Repositories**
  - SQLite DDL schemas: `folders`, `tags`, `notes`, `note_tags`, `tasks`, `reminders`, `assets`, `entity_relations`, `sync_changelog`.
  - Sub-2ms optimistic reads/writes, WAL mode auto-initialization, and event-sourced delta changelog tracking.
  - Strongly typed repositories: `notesRepo.ts`, `tasksRepo.ts`, `foldersRepo.ts`, `tagsRepo.ts`, `remindersRepo.ts`.
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
  - Unify all text and headings into a continuous editorial sheet.
  - Floating contextual formatting dock + slash command palette (`/`).
  - Resizable media controls (`33%`, `50%`, `75%`, `100%`) with alignment (`left`, `center`, `right`).
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
  - Sort modal supporting 6 orders (`updated_desc`, `updated_asc`, `created_desc`, `created_asc`, `title_asc`, `title_desc`).
- [x] **Step 13: Local Workspace Backup & Restore & Storage Settings**
  - Full workspace JSON backup export and validated schema restore (Merge vs Replace modes).
  - Database health metrics and permanent trash purge.
- [x] **Step 14: Serverless Local Push Notifications & Hardware Reminders (100% Certified)**
  - Mobile native `AlarmManager` (Android MAX-importance heads-up channel) and `UNUserNotificationCenter` (iOS).
  - Browser Notification API on web.
  - `ReminderPickerModal.tsx` preset selector and task/note bell integration.
  - Auto-cancellation on task completion and cascade cleanup on note/task deletion.
- [x] **Step 15: Quality Gate & Test Suite Certification**
  - 36/36 Block AST Lossless Roundtrip verification (`npm run audit:all`).
  - 30/30 Headless Interaction and 50-step deep undo/redo verification (`npm run test:interactions`).
  - 25/25 Headless Reminders and Hardware Notification tests passing (`node scripts/test_headless_reminders_and_notifications.mjs`).
  - 13/13 Cross-platform UI/UX consistency assertions passing (`npm run test:uiux`).

---

## Upcoming Phases Summary

### Phase 2: Supabase Realtime Sync, Direct RPCs & Google Drive Media Vault
- **Supabase Cloud Schema & RLS:** PostgreSQL migrations mirroring local SQLite schema with Row Level Security (`auth.uid() = user_id`).
- **Single Source of AI Orchestration (SSAO):** Direct Supabase PostgreSQL Stored Procedures (`create_note`, `update_note`, `create_task`, `toggle_task`, `schedule_reminder`, `search_vault`) executing in 40–80ms.
- **Client Delta Sync Protocol:** `@supabase/supabase-js` client in frontend subscribing to Postgres Realtime CDC channels with monotonic `sync_rev` reconciliation.
- **Hardware Push Notification Convergence:** Remote CDC events automatically register or cancel native OS alarms on mobile devices.
- **Zero-Cost Google Drive Media Vault:** Binary assets stream to user's Google Drive (`ScribeX_Vault/`), storing only lightweight metadata in `assets` table.
- **Next.js Serverless Micro-Routes (Vercel):** Route handlers for heavy external tasks (`/api/ai/transcribe` for Whisper, `/api/clip-webpage`, OAuth token exchange, Stripe webhooks).

### Phase 3: Cognitive Memory, Friday Client-Direct Assistant & Universal MCP Connector
- **Client-Direct BYOK AI:** In-app Friday assistant connects directly to cloud models (Gemini, Claude, OpenAI) using user's on-device API keys with zero server proxy.
- **Universal Invocation Platform Context (`PlatformContext`):** Metadata envelope (`mobile_native`, `web_browser`, `desktop_mcp`, `chatgpt_custom_action`) passed into all prompts and Supabase RPCs.
- **Ask-Before-Write Ambiguity Gate:** Pauses and requests clarification if `clarity_score < 0.85` or contradictions are detected.
- **4-Layer Cognitive Memory:** Layer 1 (Identity), Layer 2 (Living Vault & `pgvector`), Layer 3 (Versions of Me temporal timeline), Layer 4 (Behavioral Ledger & noise-filtered edit learner).
- **Universal AI Connector (`connector/`):** Standalone Node.js MCP server exposing identical tools and 4-layer context to external AIs (Claude Desktop, Cursor, ChatGPT).

### Phase 4: Remote PC Agent Bridge Daemon & Pluggable CLI Execution
- Outbound WebSocket tunnel daemon (`pc-agent-bridge`) running on personal PC.
- Configurable CLI Agent Provider Registry (`cli_agents.yaml`: Claude Code, Gemini CLI, Codex, Aider).
- 3-stage independent verification & self-correction loop (process telemetry, git diff, AI review).

### Phase 5: SaaS Multi-Tenancy, Commercial Billing & Production Scaling
- Production authentication & multi-tenant isolation.
- Stripe subscription billing & LiteLLM token spend quotas.
- Docker Compose deployment with Caddy reverse proxy.
