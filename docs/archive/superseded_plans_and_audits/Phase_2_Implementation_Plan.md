# ScribeX Phase 2: Supabase Realtime Sync, Direct RPCs & Google Drive Media Vault
## Step-by-Step Implementation Blueprint

> **Document Status:** Active Implementation Blueprint (Next in Queue)  
> **Authoritative Source of Truth:** [Unified_Backend_and_AI_Master_Specification.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Unified_Backend_and_AI_Master_Specification.md)  
> **Prerequisites:** Phase 1 (Universal Manual Note Engine, Local SQLite, Serverless Reminders) 100% Certified.  
> **Target Directories:** `supabase/migrations/`, `frontend/src/services/sync/`, `frontend/src/services/media/`, `backend/app/api/`  

---

## 1. Master Progress Tracker

Every step must be implemented, tested, and verified before marking complete and advancing.

| Step | Milestone / Component | Primary Files | Status |
| :---: | :--- | :--- | :---: |
| **1** | [Supabase PostgreSQL Schema & Tenant Isolation (RLS)](#step-1-supabase-postgresql-schema--tenant-isolation-rls) | `supabase/migrations/001_initial_schema.sql` | `[ ] PENDING` |
| **2** | [Core Supabase PostgreSQL Stored Procedures (RPCs)](#step-2-core-supabase-postgresql-stored-procedures-rpcs) | `supabase/migrations/002_core_rpcs.sql` | `[ ] PENDING` |
| **3** | [Client Bidirectional Sync Engine & Realtime CDC Listener](#step-3-client-bidirectional-sync-engine--realtime-cdc-listener) | `frontend/src/services/sync/syncEngine.ts`, `frontend/src/services/sync/syncTypes.ts` | `[ ] PENDING` |
| **4** | [Hardware Notification Remote Alarm Convergence](#step-4-hardware-notification-remote-alarm-convergence) | `frontend/src/services/notifications/NotificationService.ts` | `[ ] PENDING` |
| **5** | [Google Drive API Media Vault Integration](#step-5-google-drive-api-media-vault-integration) | `frontend/src/services/media/googleDriveService.ts`, `frontend/src/services/media/mediaTypes.ts` | `[ ] PENDING` |
| **6** | [Next.js Serverless Micro-Routes Scaffolding (Vercel)](#step-6-nextjs-serverless-micro-routes-scaffolding-vercel) | `backend/app/api/ai/transcribe/route.ts`, `backend/app/api/clip-webpage/route.ts` | `[ ] PENDING` |
| **7** | [Phase 2 Headless Verification Suite](#step-7-phase-2-headless-verification-suite) | `scripts/test_phase2_sync_and_rpc.mjs` | `[ ] PENDING` |

---

## 2. Detailed Milestone Specifications

### Step 1: Supabase PostgreSQL Schema & Tenant Isolation (RLS)
* **Objective:** Mirror the certified local SQLite schema into cloud PostgreSQL with Row-Level Security (`RLS`) enforcing tenant isolation.
* **Tables Created:**
  * `folders` (`id`, `user_id`, `name`, `parent_id`, `path`, `color_token`, `icon`, `sync_rev`, `created_at`, `updated_at`)
  * `tags` (`id`, `user_id`, `name`, `color_token`, `created_at`)
  * `notes` (`id`, `user_id`, `folder_id`, `folder_path`, `group_name`, `title`, `content_markdown`, `blocks_json`, `color_token`, `is_favorite`, `is_pinned`, `status`, `priority_score`, `reminder_at`, `sync_rev`, `created_at`, `updated_at`, `trashed_at`)
  * `note_tags` (`note_id`, `tag_id`, composite primary key)
  * `tasks` (`id`, `user_id`, `note_id`, `note_title`, `note_color_token`, `block_id`, `title`, `is_completed`, `priority`, `due_date`, `reminder_at`, `sync_rev`, `created_at`, `updated_at`)
  * `reminders` (`id`, `user_id`, `target_type`, `target_id`, `trigger_at`, `title`, `body`, `is_dismissed`, `sync_rev`, `created_at`, `updated_at`)
  * `assets` (`id`, `user_id`, `storage_key`, `drive_file_id`, `file_name`, `mime_type`, `size_bytes`, `sha256_hash`, `processing_status`, `extracted_text`, `created_at`)
  * `entity_relations` (`id`, `user_id`, `source_id`, `target_id`, `relation_type`, `created_at`)
  * `sync_changelog` (`id`, `user_id`, `entity_type`, `entity_id`, `operation`, `delta_payload`, `caller_platform`, `sync_rev`, `created_at`)
* **RLS Invariant:**
  ```sql
  ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Tenant notes isolation" ON notes FOR ALL USING (auth.uid() = user_id);
  ```
* **Realtime Publication:**
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE notes, folders, tasks, reminders, sync_changelog;
  ```

---

### Step 2: Core Supabase PostgreSQL Stored Procedures (RPCs)
* **Objective:** Build the Single Source of AI Orchestration (SSAO) tool layer executing directly in PostgreSQL in 40–80ms.
* **Procedures Implemented:**
  1. `rpc_create_note(p_title, p_content_markdown, p_folder_id, p_tags, p_color_token, p_reminder_at, p_caller_platform)`:
     * Validates block structure, inserts into `notes`, links tags in `note_tags`.
     * Atomically appends insert record to `sync_changelog` with incremented `sync_rev`.
  2. `rpc_update_note(p_note_id, p_title, p_append_markdown, p_tags, p_reminder_at, p_caller_platform)`:
     * Appends content, updates timestamp, logs update delta to `sync_changelog`.
  3. `rpc_create_task(p_title, p_priority, p_due_date, p_reminder_at, p_note_id, p_caller_platform)`:
     * Inserts into `tasks`, schedules reminder in `reminders` if `p_reminder_at` is set.
     * Logs delta to `sync_changelog`.
  4. `rpc_toggle_task(p_task_id, p_is_completed, p_caller_platform)`:
     * Updates `tasks.is_completed`.
     * If `p_is_completed = true`, atomically updates `reminders` setting `is_dismissed = true` for matching `target_id`.
     * Appends delta to `sync_changelog`.
  5. `rpc_schedule_reminder(p_target_type, p_target_id, p_trigger_at, p_title, p_body, p_caller_platform)`:
     * Upserts into `reminders`, appends delta to `sync_changelog`.
  6. `rpc_search_vault(p_query, p_folder_path, p_tags, p_limit)`:
     * Performs full-text search (`tsvector`) and semantic cosine similarity (`pgvector`).

---

### Step 3: Client Bidirectional Sync Engine & Realtime CDC Listener
* **Objective:** Connect local SQLite to Supabase Realtime CDC for instant multi-device synchronization without blocking the UI.
* **Mechanism:**
  * **Push Cycle (Local $\rightarrow$ Cloud):** Reads uncommitted entries from local `sync_changelog`, batches them to Supabase, updates local `last_pushed_rev`.
  * **Pull Cycle (Cloud $\rightarrow$ Local):** Subscribes to Supabase Realtime WebSocket channel for `sync_changelog`. On incoming delta:
    1. Executes transactional SQLite upsert in <2ms.
    2. Updates in-memory store (`useNotesStore.setState()`).
    3. Triggers UI re-render on active screens.
  * **Offline Resilience:** App continues writing to local SQLite when disconnected. Sync flushes automatically on network reconnect via `@react-native-community/netinfo`.

---

### Step 4: Hardware Notification Remote Alarm Convergence
* **Objective:** Ensure reminders created from external chatbots (Claude Desktop MCP, ChatGPT) or other devices ring reliably on physical mobile devices.
* **Mechanism:**
  * When an incoming CDC delta has `entity_type = 'reminder'`:
    * If `operation = 'INSERT'` or `operation = 'UPDATE'`: The mobile app's local `NotificationService` calls `NativeNotificationProvider.scheduleReminder()`, registering the alarm with Android `AlarmManager` (MAX-importance heads-up channel) or iOS `UNUserNotificationCenter`.
    * If `operation = 'DISMISS'` (or task completed): `NotificationService.cancelReminder()` removes the pending OS notification.

---

### Step 5: Google Drive API Media Vault Integration
* **Objective:** Zero-cost user-owned media storage utilizing each user's free 15 GB Google Drive quota.
* **Implementation:**
  * Client Google OAuth2 integration with scoped permissions (`https://www.googleapis.com/auth/drive.file`).
  * Dedicated app folder: `ScribeX_Vault/`.
  * Binary asset uploads: Audio recordings, camera snapshots, sketch canvases, and document attachments stream directly from device to Google Drive.
  * Only file metadata, SHA-256 hash, and Drive file ID are recorded in `assets` table.

---

### Step 6: Next.js Serverless Micro-Routes Scaffolding (Vercel)
* **Objective:** Scaffold the 10% heavy external micro-services on Vercel ($0 free tier hosting).
* **Routes Implemented:**
  * `POST /api/ai/transcribe`: Ingests multipart audio bytes, calls OpenAI Whisper API, formats transcript into block JSON, commits via `rpc_create_note`.
  * `POST /api/clip-webpage`: Fetches external URL, parses readability markdown with Mozilla Readability, converts to extended markdown blocks, commits via `rpc_create_note`.
  * `POST /api/auth/google-drive`: Exchanges OAuth authorization code for refresh token without exposing client secret to devices.
  * `POST /api/webhooks/stripe`: Cryptographically verifies HMAC signatures for billing webhooks.

---

### Step 7: Phase 2 Headless Verification Suite
* **Script:** `scripts/test_phase2_sync_and_rpc.mjs`
* **Test Gates:**
  1. **Schema Match Gate:** Compares SQLite schema columns with PostgreSQL migrations.
  2. **RPC Atomicity Gate:** Confirms `toggle_task` simultaneously updates task and marks reminder dismissed in `sync_changelog`.
  3. **Multi-Device Convergence Simulation:** Simulates Device A and Device B exchanging deltas through a mock Supabase CDC broker.
  4. **Offline Catch-Up Test:** Verifies offline queue replay commits without duplicate primary keys.
