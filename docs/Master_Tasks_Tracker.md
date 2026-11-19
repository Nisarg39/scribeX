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
| **Phase 2** | **Supabase Realtime Sync, Shared RPC Pipeline & Two-Tier Reminders** | `[ ] NEXT IN QUEUE` | [Unified_Backend_and_AI_Master_Specification.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Unified_Backend_and_AI_Master_Specification.md#9-phased-delivery-roadmap) |
| **Phase 3** | **Unified Backend AI Engine, Ephemeral BYOK & Universal MCP Connector** | `[ ] PENDING` | [Unified_Backend_and_AI_Master_Specification.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Unified_Backend_and_AI_Master_Specification.md#4-the-4-layer-shared-cognitive-memory-model) |
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

### Phase 2: Authenticated Supabase Realtime Sync, Shared RPC Pipeline & Two-Tier Reminders

#### Implementation Steps
- [x] **Step 1: Local SQLite & Cloud Schema Parity (`ai_context_excluded`)**
  - Added `ai_context_excluded INTEGER NOT NULL DEFAULT 0` and performance indexes to local SQLite `notes` and `folders` (`frontend/src/db/schema.ts`).
  - Added safe, non-destructive migration statements to `client.native.ts` and `client.web.ts`.
  - Updated TypeScript DTOs and interfaces (`DBFolder`, `DBNote`, `CreateNoteDTO`, `UpdateNoteDTO`, `CreateFolderDTO`, `FolderTreeNode`, `NoteItem`).
  - Integrated into `notesRepo.ts`, `foldersRepo.ts` (`toggleFolderAiContextExcluded`), and `workspaceBackupService.ts`.
  - Verified with 0 TypeScript errors and passing test suites.
- [x] **Step 2: Supabase Client, Google OAuth-Only Sign-In & Guest Vault Migration**
  - Created `frontend/src/services/supabase/supabaseClient.ts` with AsyncStorage session persistence, PKCE/auto-refresh, and safe placeholder fallback when env credentials are unconfigured.
  - Created `frontend/src/db/vaultMigration.ts` implementing atomic `migrateGuestVaultToUser(authenticatedUserId)` across all 10 user-scoped SQLite tables and queueing `sync_changelog` deltas without duplication.
  - Upgraded `frontend/src/context/AuthContext.tsx` to authenticate exclusively via Google OAuth (`signInWithGoogle`), handle Web & Native deep links (`scribex://auth/callback`), subscribe to `onAuthStateChange`, and trigger guest vault migration on login.
  - Updated `frontend/app/signin.tsx` with **Continue with Google**, **Skip & Use Offline Mode**, loading states, error banner, and Strict Auth Gate caption.
  - Verified with 0 TypeScript errors (`npx tsc --noEmit`), 13/13 Guest Migration harness tests (`scripts/test_guest_vault_migration.mjs`), 13/13 UI/UX audit checks, and 39/39 Reminder/Notification checks.
- [x] **Step 3A: Architecture Alignment on Lean Local Storage, Pagination, Realtime Editor Sync & Google Drive Account Picker**
  - Finalized 6 core rules in `Unified_Backend_and_AI_Master_Specification.md` (Section 3.2.1): Page-1-only lightweight local card cache (`PAGE_SIZE = 20`), on-demand Editor hydration + immediate `blocks_json` eviction on close, 1.5s debounced typing sync + ~50ms Realtime CDC convergence, onboarding + Settings Google Drive account selector (`prompt: select_account`), immediate local media file deletion after Drive upload with temp editor playback cache, and dirty-queue offline protection.
- [x] **Step 3B: Supabase Pagination/Hydration RPCs & Bidirectional `SyncEngine` (Notes, Folders, Tasks, Reminders, Master PIN)**
  - Added `rpc_list_notes_paginated`, `rpc_get_note_by_id`, and `rpc_delete_entity` (and expanded `rpc_create_note`, `rpc_update_note`, `rpc_upsert_folder`, `rpc_upsert_workspace_security` with full lock & metadata parity) in `supabase/migrations/002_core_rpcs.sql`.
  - Upgraded `frontend/src/services/sync/syncEngine.ts` with 1.5s typing debounce, `flushNow()`, `hasPendingChanges()`, Outbox queue cleanup (`DELETE FROM sync_changelog` on Cloud ACK), self-echo suppression (`deviceSessionId`), `fetchPaginatedNotesFromCloud()`, `fetchFullNoteFromCloud()`, and full Realtime CDC handlers (`applyNoteDelta`, `applyFolderDelta`, `applyTaskDelta`, `applyReminderDelta`, `applyWorkspaceSecurityDelta`).
  - Wired `frontend/src/db/securityRepo.ts` and `frontend/src/context/SecurityContext.tsx` to sync Master PIN/Password and auto-relock settings via `sync_changelog` while keeping `biometrics_enabled` strictly device-local.
  - Verified with 0 TypeScript errors (`npx tsc --noEmit`) and 66/66 assertions passing in `scripts/test_phase2_sync_and_rpc.mjs`.
- [x] **Step 3C: Lean SQLite Eviction Manager, Paginated Home Feed & On-Demand Editor Hydration**
  - Created `frontend/src/db/leanCacheManager.ts` (`CLOUD_PAGE_SIZE = 20`, `cachePageOnePreviews`, `hydrateNoteForEditing`, `dehydrateNoteAfterSync`, `enforcePageOneFootprint`) preserving uncommitted Outbox items and stripping clean `blocks_json` / non-Page-1 synced rows after Cloud ACK.
  - Safely detached `tasks` `ON DELETE CASCADE` FK in SQLite (`schema.ts`, `client.native.ts`, `client.web.ts`) so evicting older synced notes never deletes active tasks on the Tasks tab.
  - Upgraded `notesRepo.ts` (fixing `softDeleteNote` to emit `'update'` rather than `'delete'`), `foldersRepo.ts`, `tasksRepo.ts`, and `remindersRepo.ts` to auto-schedule debounced push sync; added `pullWorkspaceMetadataFromCloud()` in `syncEngine.ts`.
  - Wired `useAuth()` into `useNotesStore.tsx` for auth-gated 20-note cloud pagination (`rpc_list_notes_paginated`) + server-side search/folder/chip filtering while keeping Guest Mode 100% offline.
  - Upgraded `frontend/app/note/[id].tsx` & `useEditorState.ts` with on-demand `rpc_get_note_by_id` hydration, live non-focused block CDC merge, flush & eviction on exit/background, and an offline *"Reconnect to load this note from cloud"* fallback UI.
  - Verified with `npx tsc --noEmit` (0 errors) and 9/9 assertions passing in `scripts/test_lean_cache_and_pagination.mjs`.
- [x] **Step 3D: Google Drive Media Vault Account Selector (Onboarding + Settings), Upload & Temp Playback Cache**
  - Created `frontend/src/services/drive/googleDriveVaultService.ts` (`drive.file` scope, `prompt: 'select_account consent'`, `ScribeX_Vault/` folder management, multipart Drive upload + immediate `FileSystem.deleteAsync` local cleanup, `gdrive://` block URI helpers, `hydrateNoteMediaToTempCache`, `dehydrateTempUrisForPersistence`, and `purgeNoteTempCache`).
  - Added post-login Step 2 Google Drive Vault onboarding picker on `/signin` (`frontend/app/signin.tsx`), plus Auth-Gated **Cloud Sync & Google Drive Vault** controls in `SideNavbarModal.tsx`, `WorkspaceSettingsModal.tsx`, and `app/settings/index.tsx` (locked with Sign-In CTA for guests; live Sync / Switch Account / Disconnect controls for authenticated users).
  - Wired `app/note/[id].tsx` & `useEditorState.ts` so `gdrive://` media hydrates to `cacheDirectory/gdrive_temp/<noteId>/` on Editor open, dehydrates back to `gdrive://` before persisting edits, uploads new local media asynchronously in the background, and purges temp media on close/unmount.
  - Documented `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` & redirect URIs in `frontend/.env.example`; verified with `npx tsc --noEmit` (0 errors) and `9/9` assertions in `scripts/test_google_drive_vault.mjs`.

#### Architecture & Invariants
- **Google OAuth Only Sign-In (Dual Purpose: Auth + Media Sync):** Authentication uses **Google OAuth exclusively** (via Supabase Auth Google provider). Signing in with Google fulfills two critical functions:
  1. Authenticating user identity (`auth.uid()`) to unlock Supabase Realtime sync, cloud PIN sync, and backend AI features.
  2. Securing Google Drive OAuth scopes (`drive.file`) for personal Google Drive media synchronization (zero-cost storage for images, audio recordings, and videos).
- **Global UI & Runtime Auth Gate (No Sync or AI Until Logged In):** **Both Cloud Sync and all AI features are strictly disabled in the UI and runtime unless the user is logged in (`isAuthenticated === true`).** Users who skip sign-in during onboarding remain 100% manual and offline on-device (`isGuest`). Completing the Google OAuth sign-in flow atomically migrates existing local guest notes (`user-default` $\rightarrow$ `auth.uid()`) and unlocks Cloud Sync & AI features.
- **Master PIN Cloud Sync vs. Device-Only Biometrics:** Master PIN/Password credentials (`workspace_security` hash/salt/hint) and note/folder locks sync across devices via Supabase, while `biometrics_enabled` remains strictly device-local.
- **Full SQLite $\leftrightarrow$ Supabase Schema Parity & RLS:** PostgreSQL migrations mirroring all local SQLite columns (`folders` pin/fav/archive/cover/lock columns, `notes` lock columns, `tasks` recurrence, `reminders` title/body/recurrence, `in_app_notifications`, `workspace_security`, and `ai_context_excluded` privacy flags) with Row Level Security (`auth.uid() = user_id`).
- **Action Pipeline Symmetry (Shared Supabase RPC Pipeline):** Strongly typed Supabase PostgreSQL Stored Procedures (`rpc_create_note`, `rpc_update_note`, `rpc_create_task`, `rpc_toggle_task`, `rpc_schedule_reminder`, `rpc_search_vault`, `rpc_upsert_folder`, `rpc_upsert_workspace_security`) preserving client-generated IDs (`ON CONFLICT (id) DO UPDATE`) for both frontend direct client sync and backend AI tool execution.
- **Two-Tier Hardware Push Notifications:**
  - *Tier 1 (Logged-Out / Guest):* Reminders operate 100% locally on the device (saved in local SQLite, scheduled directly to native hardware `AlarmManager` / `UNUserNotificationCenter` / Web Notifications) with zero network calls and zero syncing.
  - *Tier 2 (Logged-In):* Reminders commit to Supabase `reminders` table and `sync_changelog`, broadcasting via Supabase Realtime CDC in ~50ms to ring hardware alarms across all user devices, with cross-device auto-cancellation on task completion.
- **Client Delta Sync Protocol:** `@supabase/supabase-js` client in frontend subscribing to Postgres Realtime CDC channels with monotonic `sync_rev` reconciliation.
- **Zero-Cost Google Drive Media Vault:** Binary assets stream to user's Google Drive (`ScribeX_Vault/`), storing only lightweight metadata in `assets` table.
- **Next.js Serverless Micro-Routes (Vercel):** Route handlers for heavy external tasks (`/api/ai/transcribe` for Whisper, `/api/clip-webpage`, OAuth token exchange, Stripe webhooks).

### Phase 3: Unified Backend AI Engine, In-Editor Co-Pilot, Scoped Multi-Agents & Universal MCP Connector
- **Unified Backend AI Engine:** Single backend gateway (`/api/ai/chat` & `/api/ai/agent` on Next.js / Edge Functions) powering Mobile Friday, Web Friday, Claude Desktop MCP, and ChatGPT Custom Actions with zero dual-codebase drift.
- **In-Editor AI Assistant (Canvas Co-Pilot):** Prompt-driven AI assistant inside the Note Editor capable of drafting, editing, summarizing, and restructuring blocks in the active note with full Undo/Redo support.
- **Scoped Multi-Agent Orchestration:** Main agent (Friday) can spawn specialized sub-agents assigned to a specific note or folder/group of notes with strictly scoped context access.
- **Note & Folder AI Context Exclusion (`ai_context_excluded`):** Per-note and per-folder toggle persisted in SQLite and Supabase that prevents Friday, sub-agents, and MCP clients from reading or indexing excluded notes/folders.
- **Frontend BYOK via Ephemeral Request Headers:** Users enter model keys in frontend UI (`SecureStore` on mobile, encrypted storage on web). Client sends key in ephemeral headers (`x-gemini-key`, `x-anthropic-key`, `x-openai-key`). Backend uses key in volatile memory and discards it immediately ($0 server token spend, zero backend `.env` key storage).
- **Universal Invocation Platform Context (`PlatformContext`):** Metadata envelope (`mobile_native`, `web_browser`, `desktop_mcp`, `chatgpt_custom_action`) passed into all prompts and Supabase RPCs.
- **Ask-Before-Write Ambiguity Gate:** Pauses and requests clarification if `clarity_score < 0.85` or contradictions are detected.
- **4-Layer Cognitive Memory:** Layer 1 (Identity), Layer 2 (Living Vault & `pgvector`), Layer 3 (Versions of Me temporal timeline), Layer 4 (Behavioral Ledger & noise-filtered edit learner).
- **Universal AI Connector (`connector/`):** Standalone Node.js MCP server exposing identical tools and 4-layer context to external AIs (Claude Desktop, Cursor, ChatGPT).

### Phase 4: External Connectors Hub, GitHub Integration, Outbound WhatsApp Reminders & PC Agent Bridge
- **Universal App & Service Connectors Hub:** In-app Connectors manager to authenticate and sync with external APIs and services.
- **GitHub Connector:** Manage repositories, issues, PRs, and commits directly from ScribeX notes and tasks.
- **Outbound WhatsApp Task/Note Reminders:** Scheduled via Supabase `pg_cron` & Edge Functions on reminder trigger, delivering interactive alerts to the user's WhatsApp number via Meta Cloud API.
- **Remote PC Bridge Daemon (`pc-agent-bridge`):** Outbound WebSocket tunnel daemon running on personal PC with Configurable CLI Agent Provider Registry (`cli_agents.yaml`: Claude Code, Gemini CLI, Codex, Aider) and 3-stage independent verification & self-correction loop.

### Phase 5: SaaS Multi-Tenancy, Commercial Billing & Production Scaling
- Production authentication & multi-tenant isolation.
- Stripe subscription billing & LiteLLM token spend quotas.
- Docker Compose deployment with Caddy reverse proxy.
