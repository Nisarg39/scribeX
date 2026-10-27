# ScribeX Master Tasks Tracker

> **Purpose:** High-level task management checklist tracking what is completed and what remains across the ScribeX architecture.  
> **Status:** Active Tracking Document  
> **Execution Strategy:** Build from the **User's Journey First**: Establish the comprehensive manual note-taking engine with all 42 input methods, local SQLite storage, folders, tags, and relations, followed by client-server delta sync, and then the Friday AI assistant.  
> **Last Updated:** October 27, 2026  

---

## Progress Overview

| Phase | Description | Status | Reference Doc |
| :---: | :--- | :---: | :--- |
| **Phase 1** | **Universal Manual Note Engine & Local-First Canvas (Core User Journey)** | `[ ] ACTIVE FOUNDATION` | [Phase_1_Implementation_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Phase_1_Implementation_Plan.md) |
| **Phase 2** | **Resilient Client-Server Delta Sync & Multi-Device Vault Mirroring** | `[ ] NEXT` | [Phase_2_Implementation_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Phase_2_Implementation_Plan.md) |
| **Phase 3** | **Cognitive Memory & Friday AI Assistant Integration** | `[ ] PENDING` | [Phase_3_Implementation_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Phase_3_Implementation_Plan.md) |
| **Phase 4** | **Remote PC Bridge Daemon + Pluggable CLI Verification Loop** | `[ ] PENDING` | [Technical_System_Architecture.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md#7-remote-pc-agentic-execution--pluggable-cli-daemon) |
| **Phase 5** | **SaaS Multi-Tenancy, Commercial Billing & Production Scaling** | `[ ] PENDING` | [SaaS_Architecture_and_Integration_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/SaaS_Architecture_and_Integration_Plan.md) |

---

## Active Phase 1 Breakdown: Universal Manual Note Engine & Local-First Canvas

> **Source of Truth:** [Universal_Note_Input_Structure_and_Relations.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Universal_Note_Input_Structure_and_Relations.md) & [Phase_1_Implementation_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Phase_1_Implementation_Plan.md)  
> **Critical Design Constraint:** Strictly avoid generic cards, boxy components, and cookie-cutter SaaS widgets. Deliver a serene, soft minimalist editorial canvas with pastel note accents and circular action controls.

- [x] **Step 1: Frontend Scaffolding, NativeWind v4 Configuration & Pastel Design Tokens**
  - Universal Expo SDK 52 setup (`frontend/`).
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
- [ ] **Milestone 1.5: Invisible Editorial Canvas Refactor (Blog Editor Flow & Resizable Media)**
  - Strip outer cards, borders, and per-block header strips from `BlockRenderer.tsx`.
  - Unify all text and headings into a continuous editorial sheet (Medium / Substack / Notion style).
  - Implement single floating contextual formatting dock + slash command palette (`/`).
  - Add inline resizable media controls (`33%`, `50%`, `75%`, `100%`) with alignment (`left`, `center`, `right`).
  - Ensure Google Drive URL linking compatibility for zero-cost media storage with Firebase sync.
- [ ] **Step 7: Hierarchical Folders & Physical Vault Directory Mirroring**
  - Nested project subfolders with recursive parent paths.
  - Drag/move note into folders and breadcrumb navigation.
- [ ] **Step 8: Multi-Tags, Starred Favorites, Pinning, Archive & 30-Day Trash**
  - Non-exclusive `#tag` chips with fast tag filtering.
  - Top-of-canvas pinning and favorite starring.
  - Soft-delete 30-day trash with restore and permanent purge.
- [ ] **Step 9: Bidirectional Cross-Note Links (`[[Note Title]]`) & Relational Knowledge Graph**
  - Autocomplete trigger for `[[` typing.
  - Backlinks drawer displaying incoming connections.
  - `entity_relations` edge tracking (`related_to`, `part_of`, `derived_from`, `contradicts`, `supersedes`).
- [ ] **Step 10: Fast Local Search (< 5ms via FTS5) & Dynamic Smart Collections**
  - SQLite FTS5 full-text indexing over note titles, blocks, and tags.
  - Dynamic virtual views (e.g., `#meeting notes with pending tasks`).
  - Automated Phase 1 verification test suite.

---

## Upcoming Phases Summary

### Phase 2: Resilient Client-Server Delta Sync & Multi-Device Vault Mirroring
- Cloud VPS FastAPI operational core + SQLite WAL multi-tenant database.
- Event-sourced delta sync engine (`sync_changelog` with monotonic `sync_rev`).
- WebSocket doorbell push (< 50ms) + reconnection catch-up + HTTP REST fallback (`/push`, `/pull`).
- Binary asset upload API (`/assets/upload`) with disk vault storage.
- Asynchronous Git Vault projection committing Extended Markdown AST `.md` files to VPS disk.

### Phase 3: Cognitive Memory & Friday AI Assistant Integration
- Friday conversational assistant interface & proactive morning briefings.
- User-initiated interactive discovery interview ("Everything About Me").
- Ask-Before-Write Ambiguity Gate & universal intake router.
- 4-layer cognitive memory: Layer 1 (Identity), Layer 2 (Living Vault & LanceDB vector store), Layer 3 (Versions of Me temporal timeline), Layer 4 (Behavioral Ledger & noise-filtered Git diff learner).

### Phase 4: Remote PC Agent Bridge Daemon & Pluggable CLI Execution
- Outbound WebSocket tunnel daemon (`pc-agent-bridge`) running on personal PC.
- Configurable CLI Agent Provider Registry (`cli_agents.yaml`: Claude Code, Gemini CLI, Codex, Aider).
- 3-stage independent verification & self-correction loop (process telemetry, git diff, AI review).

### Phase 5: SaaS Multi-Tenancy, Commercial Billing & Production Scaling
- Multi-tenant isolated databases & parameterized `user_id` security boundaries.
- Production authentication (Clerk / Supabase Auth).
- Stripe subscription billing & LiteLLM token spend quotas.
- Docker Compose deployment with Caddy reverse proxy.
