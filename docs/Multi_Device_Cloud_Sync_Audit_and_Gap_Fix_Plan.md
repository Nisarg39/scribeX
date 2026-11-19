# ScribeX Multi-Device Cloud Sync Audit & Gap-Fix Implementation Plan

> **Purpose:** Authoritative living record of every action across Notes, Folders, Media, Security, Tasks, Reminders, and Secondary Entities — documenting **(1) what is already fully cloud-synced across devices** and **(2) the detailed implementation plan to close every remaining multi-device sync gap**.  
> **Architecture:** Local-First SQLite Outbox (`sync_changelog`) ↔ Supabase PostgreSQL RPCs & Realtime CDC ↔ Google Drive Media Vault (`ScribeX_Vault/`)  
> **Last Audited:** November 19, 2026 (`feat/backend-integration`)

---

## 1. Existing Synced Actions Registry (Verified Across All 4 Legs)

> **4-Leg Multi-Device Sync Standard:**  
> **Leg 1:** Local SQLite write + `sync_changelog` insert + `syncEngine.schedulePush()`  
> **Leg 2:** Outbox push via `syncEngine.pushSingleDeltaToSupabase()`  
> **Leg 3:** Supabase PostgreSQL RPC persistence + Cloud `sync_changelog` emission  
> **Leg 4:** Device B ingestion via Realtime CDC (`apply*Delta`) & Cold-Start Pull (`pullWorkspaceMetadataFromCloud` / `fetchPaginatedNotesFromCloud` / `fetchFullNoteFromCloud`)

### 1.1 Notes Actions
| Status | Action | Local Repo / Entrypoint | Push RPC (`002_core_rpcs.sql`) | Device B Receive |
| :---: | :--- | :--- | :--- | :--- |
| `[x]` | Create Note (Manual, Template, Inbound Share) | `notesRepo.createNote` | `rpc_create_note` (with cross-tenant PK collision re-mint) | `applyNoteDelta` + `fetchPaginatedNotesFromCloud` |
| `[x]` | Edit Title, Markdown & 42 Composable Blocks | `notesRepo.updateNote` / `updateNoteBlocks` | `rpc_update_note` (1.5s debounce + `flushNow()` on close/background) | `applyNoteDelta` + CDC non-focused block merge (`useEditorState`) + on-demand `fetchFullNoteFromCloud` |
| `[x]` | Change Note Color Token | `notesRepo.updateNote` | `rpc_update_note` | `applyNoteDelta` + Page 1 cache |
| `[x]` | Toggle Favorite / Toggle Pin | `notesRepo.updateNote` / `batchTogglePinNotes` | `rpc_update_note` | `applyNoteDelta` + Page 1 cache |
| `[x]` | Move Note(s) to Folder or Back to Root (`General`) | `notesRepo.updateNote` / `batchMoveNotesToFolder` / `useNotesStore.moveNoteToFolder` | `rpc_update_note` (`p_clear_folder_id`, auto-syncs missing parent folder on `23503`) | `applyNoteDelta` + Page 1 cache |
| `[x]` | Archive / Unarchive Note(s) | `notesRepo.updateNote` / `batchArchiveNotes` | `rpc_update_note` (`p_status`) | `applyNoteDelta` + filtered cloud pagination |
| `[x]` | Soft-Delete (Move to Trash) / Restore Note(s) | `notesRepo.softDeleteNote` / `restoreNote` / `batchSoftDeleteNotes` / `batchRestoreNotes` | `rpc_update_note` (`status = 'trashed' \| 'active'`) | `applyNoteDelta` + cloud status query |
| `[x]` | Permanently Delete Note(s) / Empty Trash | `notesRepo.permanentlyDeleteNote` / `batchPermanentlyDeleteNotes` / `emptyTrashCascade` | `rpc_delete_entity('note')` + Google Drive asset & `assets` table cascade cleanup | `applyNoteDelta('delete')` removes note, `note_tags` & `entity_relations` from SQLite & RAM |
| `[x]` | Toggle AI Context Exclusion (`ai_context_excluded`) | `notesRepo.updateNote` | `rpc_update_note` | `applyNoteDelta` + Page 1 cache |
| `[x]` | Bidirectional Note Tags (Add, Edit & Clear All `[]`) | `notesRepo.createNote` / `updateNote` (`tagsRepo.setNoteTags`) | `rpc_create_note` / `rpc_update_note` (`p_tags` + emits `tags` in `sync_changelog`) | `applyNoteDelta` + `leanCacheManager.cachePageOnePreviews` + `hydrateNoteForEditing` |

### 1.2 Folders Actions
| Status | Action | Local Repo / Entrypoint | Push RPC (`002_core_rpcs.sql` + `004_multi_device_sync_parity.sql`) | Device B Receive |
| :---: | :--- | :--- | :--- | :--- |
| `[x]` | Create Folder (Root or Nested) | `foldersRepo.createFolder` | `rpc_upsert_folder` (recursive parent-first ordering via `ensureFolderSyncedToSupabase`) | `applyFolderDelta` + `pullWorkspaceMetadataFromCloud` |
| `[x]` | Update Folder Color / Icon | `foldersRepo.updateFolderColor` / `updateFolderIcon` | `rpc_upsert_folder` | `applyFolderDelta` + `pullWorkspaceMetadataFromCloud` |
| `[x]` | Toggle Folder Favorite / Pin | `foldersRepo.toggleFolderFavorite` / `toggleFolderPin` | `rpc_upsert_folder` | `applyFolderDelta` + `pullWorkspaceMetadataFromCloud` |
| `[x]` | Toggle Folder AI Context Exclusion | `foldersRepo.toggleFolderAiContextExcluded` | `rpc_upsert_folder` | `applyFolderDelta` + `pullWorkspaceMetadataFromCloud` |
| `[x]` | Archive / Unarchive Folder (with Lean-Cache Server & Note Cascade) | `foldersRepo.archiveFolderContained` / `unarchiveFolderContained` | `rpc_upsert_folder` + `rpc_cascade_folder_archive_change` + `rpc_update_note` | `applyFolderDelta` (`cascade_archive`) + `applyNoteDelta` |
| `[x]` | Rename / Move / Delete / Duplicate Folder (with Full Child-Note & Server Cascade) | `foldersRepo.renameFolderCascade` / `moveFolderCascade` / `deleteFolderCascade` / `duplicateFolderCascade` | `rpc_upsert_folder` + `rpc_cascade_folder_path_change` / `rpc_delete_folder_cascade` / `rpc_duplicate_folder_cascade` / `rpc_create_note` | `applyFolderDelta` (`cascade_path` / delete cascade) + `applyNoteDelta` |

### 1.3 Google Drive Media Vault & Permanent Connection
| Status | Action | Implementation | Multi-Device Behavior |
| :---: | :--- | :--- | :--- |
| `[x]` | Upload Image/Audio/Video/File/Scan to `ScribeX_Vault/` | `googleDriveVaultService.uploadNoteMediaAttachments` | Rewrites block URI to `gdrive://<fileId>`, upserts `assets` in SQLite + Supabase, deletes local native binary immediately |
| `[x]` | On-Demand Media Hydration & Exit Purge | `app/note/[id].tsx` (`hydrateNoteMediaToTempCache` / `purgeNoteTempCache`) | Downloads `gdrive://<fileId>` on Device B when opened; purges temp cache on exit |
| `[x]` | Delete Drive File on Block Replace / Block Delete / Trash Purge | `BlockRenderer`, `useEditorState` (`collectMediaRefs` diff), `notesRepo` (`cleanupMediaForDeletedNotes`) | Permanently removes file from Google Drive & `assets` table |
| `[x]` | Mandatory Google Drive Gate & Sync Pause | `AuthContext`, `signin.tsx`, `syncEngine.isSyncGateBlocked()`, `useNotesStore` | Blocks sync (`drive_required`) until Drive is verified; pauses sync immediately on disconnect/revocation |
| `[x]` | Permanent Silent Refresh Token Auto-Refresh | `003_google_drive_refresh_tokens.sql`, `supabase/functions/google-drive-token` | Encrypts Google `refresh_token` (AES-256-GCM) server-side; auto-mints fresh 1-hour access tokens silently & retries once on `401` |
| `[x]` | Pre-Login Offline Media Backfill | `googleDriveVaultService.backfillOfflineMediaToDrive` | Uploads guest `local_media/` & Web `data:` images to Drive automatically upon sign-in before flushing notes |

### 1.4 Locks, Security & Auth / Reconciliation
| Status | Action | Implementation | Multi-Device Behavior |
| :---: | :--- | :--- | :--- |
| `[x]` | Workspace Master PIN / Password & Auto-Relock | `securityRepo` (`setMasterCredential`, `setAppLockEnabled`, `setAutoRelockSeconds`) | Syncs hash/salt/hint via `rpc_upsert_workspace_security`; **strictly excludes `biometrics_enabled`** (device-local) |
| `[x]` | Lock / Unlock Note (Single & Batch) | `securityRepo.lockNoteRecord` / `unlockNoteRecord` / `batchLockNoteRecords` / `batchUnlockNoteRecords` | Syncs all lock columns via `rpc_update_note` → `applyNoteDelta` |
| `[x]` | Lock / Unlock Folder | `securityRepo.lockFolderRecord` / `unlockFolderRecord` | Syncs all lock columns via `rpc_upsert_folder` → `applyFolderDelta` |
| `[x]` | Lossless Guest-to-Account Vault Migration | `vaultMigration.migrateGuestVaultToUser` | Atomically reassigns `'user-default'` rows to `auth.uid()` after Drive is verified |
| `[x]` | ID-Based Offline-to-Existing-Account Note Merge | `noteMergeReconciler.reconcileOfflineNotesWithCloud` | Merges matching `note.id`s by `block.id` + tag union; keeps unmatched offline notes as brand-new inserts; protects untouched default seed notes |

### 1.5 Tasks & Reminders
| Status | Action | Local Repo / Entrypoint | Push RPC (`002_core_rpcs.sql`) | Device B Receive |
| :---: | :--- | :--- | :--- | :--- |
| `[x]` | Create / Edit / Toggle / Delete Task | `tasksRepo.createTask` / `toggleTask` / `updateTask` / `deleteTask` / `syncNoteChecklists` | `rpc_create_task` / `rpc_toggle_task` / `rpc_delete_entity('task')` | `applyTaskDelta` + `pullWorkspaceMetadataFromCloud` |
| `[x]` | Create / Dismiss / Delete Reminder | `remindersRepo.createReminder` / `dismissReminder` / `deleteReminder` | `rpc_schedule_reminder` / `rpc_dismiss_reminder` / `rpc_delete_entity('reminder')` | `applyReminderDelta` + OS alarm scheduling/cancellation via `NotificationService` |

---

## 2. Outstanding Multi-Device Sync Gaps Ledger (Resolved via Migration `004` & Client Phases B–F)

### P0 — High-Impact Multi-Device Gaps
- `[x]` **Gap 1 — Folder Cascade Note Sync (Rename, Move, Delete, Duplicate & Lean-Cache Server Cascade):**
  - `foldersRepo.renameFolderCascade`, `moveFolderCascade`, `deleteFolderCascade`, and `duplicateFolderCascade` now increment `sync_rev` and queue `sync_changelog` rows for affected/cloned notes (including cloned `note_tags` and locked-folder metadata), and emit cascade metadata driving server-side Postgres RPCs (`rpc_cascade_folder_path_change`, `rpc_delete_folder_cascade`, `rpc_cascade_folder_archive_change`) plus Device B mirroring in `applyFolderDelta`.
- `[x]` **Gap 2 — Full Bidirectional Note Tag Sync (Realtime CDC, Page-1 Card Cache, & Empty-Tag Clear):**
  - `rpc_create_note` and `rpc_update_note` now emit resolved `tags` arrays inside `sync_changelog.delta_payload`; `syncEngine.applyNoteDelta()` syncs `note_tags` on Device B; `leanCacheManager.cachePageOnePreviews()` hydrates `note_tags` for Page-1 cards; `hydrateNoteForEditing()` unconditionally calls `tagsRepo.setNoteTags()` even when `mapped.tags` is empty `[]`.
- `[x]` **Gap 3 — Clearing Nullable Note Fields (`folder_id = NULL`, `reminder_at = NULL`) in `rpc_update_note`:**
  - `rpc_update_note` now accepts `p_clear_folder_id` and `p_clear_reminder_at` boolean flags (after cleanly dropping the legacy 21-arg overload); `notesRepo.updateNote`, `notesRepo.batchMoveNotesToFolder`, and `useNotesStore.moveNoteToFolder` emit explicit clear flags; `SyncEngine.applyNoteDelta` clears `folder_id`/`reminder_at` to `NULL` when present while preserving existing values on partial deltas.
- `[x]` **Gap 4 — Workspace JSON Backup Restore Cloud Sync Propagation:**
  - `workspaceBackupService.restoreBackup()` now resolves the active authenticated `userId`, enqueues `sync_changelog` deltas for restored `folders`, `notes` (with tags), `tasks`, `entity_relations`, and `workspace_security`, runs `googleDriveVaultService.backfillOfflineMediaToDrive()` for restored local/data URIs when Drive is connected, and calls `syncEngine.schedulePush()`.

### P1 / P2 — Secondary Entities & Hygiene Gaps
- `[x]` **Gap 5 — In-App Notifications (`in_app_notifications`) Sync Pipeline:**
  - Added `rpc_upsert_in_app_notification`, `rpc_mark_notifications_read`, and `rpc_delete_in_app_notification`; wired push/CDC/cold-start pull in `SyncEngine` (`applyNotificationDelta`) and `syncEngine.schedulePush()` across all `notificationsRepo` mutations (including `clearAll` and `deleteNotificationByTarget`).
- `[x]` **Gap 6 — Search History (`search_history`) Sync Pipeline:**
  - Added `rpc_upsert_search_history` (with case-insensitive dedup) and `rpc_delete_search_history`; wired push/CDC/cold-start pull in `SyncEngine` (`applySearchHistoryDelta`) and `syncEngine.schedulePush()` across all `searchHistoryRepo` mutations.
- `[x]` **Gap 7 — Entity Relations (`entity_relations` / Knowledge Graph Links) Sync Pipeline:**
  - Added `rpc_upsert_entity_relation` and `rpc_delete_entity_relation`; wired push/CDC/cold-start pull in `SyncEngine` (`applyRelationDelta`).
- `[x]` **Gap 8 — Minor Repo Hygiene (`tagsRepo` `user_id`, `notesRepo` batch transactions, `remindersRepo.updateNotificationId`):**
  - `tagsRepo.createTag()` & `setNoteTags()` accept active `userId`; all 6 `notesRepo` batch operations run atomically inside `dbClient.withTransaction()`; `remindersRepo.updateNotificationId()` no longer logs device-local OS `notification_id` to `sync_changelog` (and `SyncEngine` now uses `rpc_dismiss_reminder` for dismissed reminders).

---

## 3. Detailed Implementation Plan to Fix All Gaps

### Phase A — Supabase Migration (`004_multi_device_sync_parity.sql`) [P0 + P1]

#### [NEW] `supabase/migrations/004_multi_device_sync_parity.sql`

1. **Fix Gap 2 & Gap 3 inside `rpc_create_note` and `rpc_update_note`:**
   - Add explicit boolean clear flags to `rpc_update_note` (default `FALSE` so existing callers remain 100% backwards-compatible):
     - `p_clear_folder_id BOOLEAN DEFAULT FALSE` → `folder_id = CASE WHEN p_clear_folder_id THEN NULL ELSE COALESCE(p_folder_id, folder_id) END`
     - `p_clear_reminder_at BOOLEAN DEFAULT FALSE` → `reminder_at = CASE WHEN p_clear_reminder_at THEN NULL ELSE COALESCE(p_reminder_at, reminder_at) END`
   - Include `'tags'` (resolved JSON array of tag names from `note_tags JOIN tags`) inside the `sync_changelog.delta_payload` emitted by BOTH `rpc_create_note` and `rpc_update_note`.
2. **Fix Gap 1 (Server-Side Lean-Cache-Safe Folder Cascades):**
   - Add `rpc_cascade_folder_path_change(p_old_path TEXT, p_new_path TEXT, p_caller_platform TEXT DEFAULT 'local_client')`:
     - Atomically updates `notes.folder_path` (and `folders.path` for any descendants) where `user_id = v_user_id AND (folder_path = p_old_path OR folder_path LIKE p_old_path || '/%')` on the server — covering **all** notes even if they were evicted from Device A's 20-note lean cache!
     - Emits a lightweight `sync_changelog` event (`entity_type = 'folder'`, `change_type = 'update'`, payload `{ action: 'cascade_path', old_path, new_path }`) so Device B immediately updates its cached notes' `folder_path` too.
   - Add `rpc_delete_folder_cascade(p_folder_id TEXT, p_folder_path TEXT, p_note_action TEXT DEFAULT 'moveToGeneral', p_caller_platform TEXT DEFAULT 'local_client')`:
     - Server-side atomically updates ALL cloud notes in `p_folder_path` / descendants (`moveToGeneral` → `folder_path = 'General', folder_id = NULL`; `moveToTrash` → `status = 'trashed', trashed_at = NOW()`), deletes the folder + descendant folders, and emits a `sync_changelog` `delete` delta containing `{ id, deleted_path, note_action }` so Device B mirrors the exact cascade locally.
3. **Fix Gap 5, Gap 6 & Gap 7 (Secondary Entity RPCs):**
   - `rpc_upsert_in_app_notification(...)` & `rpc_mark_notifications_read(p_id TEXT DEFAULT NULL, p_caller_platform TEXT DEFAULT 'local_client')` & `rpc_delete_in_app_notification(p_id TEXT DEFAULT NULL, ...)` → persists to `public.in_app_notifications` and emits `entity_type = 'in_app_notification'` to `sync_changelog`.
   - `rpc_upsert_search_history(p_query_text TEXT, p_source TEXT, p_filter_snapshot JSONB, ...)` & `rpc_delete_search_history(p_query_text TEXT DEFAULT NULL, ...)` → persists to `public.search_history` and emits `entity_type = 'search_history'` to `sync_changelog`.
   - `rpc_upsert_entity_relation(p_id TEXT, p_source_id TEXT, p_target_id TEXT, p_relation_type TEXT, p_metadata JSONB, ...)` & `rpc_delete_entity_relation(p_id TEXT, ...)` → persists to `public.entity_relations` and emits `entity_type = 'relation'` to `sync_changelog`.
4. **Live Deployment:** Apply `004_multi_device_sync_parity.sql` to `Scribex (gbpyfhrcofwsfklzweqo)` via `supabase db query --remote=gbpyfhrcofwsfklzweqo --yes --file ...`.

---

### Phase B — Folder Cascade Sync & Cloned Notes (`foldersRepo.ts`) [Gap 1]

#### [MODIFY] `frontend/src/db/foldersRepo.ts`

1. **`renameFolderCascade()` & `moveFolderCascade()`:**
   - Capture affected local notes before updating `folder_path`; increment their `sync_rev` and insert `sync_changelog` `update` deltas for each affected note AND attach `{ action: 'cascade_path', oldPath: cleanOldPath, newPath: cleanNewPath }` onto the root folder's `sync_changelog` payload so `SyncEngine` invokes `rpc_cascade_folder_path_change()` on Supabase (covering non-cached cloud notes too!).
2. **`deleteFolderCascade()`:**
   - For every locally affected note (`moveToGeneral` or `moveToTrash`), increment `sync_rev` and record a `sync_changelog` `update` delta (with `clearFolderId: true` when `moveToGeneral`), AND include `{ deletedPath: cleanPath, noteAction }` on the root folder's delete tombstone so `SyncEngine` invokes `rpc_delete_folder_cascade()` on Supabase.
3. **`duplicateFolderCascade()`:**
   - If the source folder was locked, queue a `sync_changelog` `update` delta for `newFolder` after copying lock metadata.
   - For every cloned note inserted into `notes`, also clone its `note_tags` and insert a `sync_changelog` `insert` delta (`entity_type = 'note'`) and call `syncEngine.schedulePush()`.

---

### Phase C — Bidirectional Tags, Nullable Clear Flags & Lean Cache (`leanCacheManager.ts`, `notesRepo.ts`, `tagsRepo.ts`) [Gaps 2, 3, 8]

#### [MODIFY] `frontend/src/db/leanCacheManager.ts`
- **`cachePageOnePreviews()`:** When caching each clean Page-1 preview card from `rpc_list_notes_paginated` (which already returns `tags` as a JSON array!), sync its tags into SQLite via `tagsRepo.setNoteTags(c.id, Array.isArray(c.tags) ? c.tags : [], authenticatedUserId)`.
- **`hydrateNoteForEditing()`:** Always call `tagsRepo.setNoteTags(mapped.id, mapped.tags || [], mapped.userId)` even when `mapped.tags.length === 0`, so removing all tags on Device A clears stale tags on Device B!

#### [MODIFY] `frontend/src/db/tagsRepo.ts`
- Accept optional `userId: string = 'user-default'` in `createTag()` and `setNoteTags()` instead of hardcoding `'user-default'`.

#### [MODIFY] `frontend/src/db/notesRepo.ts`
- In `updateNote()`, explicitly record `clearFolderId: dto.folderId === null` and `clearReminderAt: dto.reminderAt === null` inside the `sync_changelog` `delta_payload` so `SyncEngine` knows when a `null` is an intentional clear vs. an omitted field.
- Wrap batch methods (`batchSoftDeleteNotes`, `batchMoveNotesToFolder`, `batchTogglePinNotes`, `batchArchiveNotes`, `batchRestoreNotes`, `batchPermanentlyDeleteNotes`) inside `dbClient.withTransaction(...)` for atomic outbox writes (Gap 8).

---

### Phase D — SyncEngine Full Dispatch & Device B Ingestion (`syncEngine.ts`, `syncTypes.ts`) [Gaps 1, 2, 3, 5, 6, 7]

#### [MODIFY] `frontend/src/services/sync/syncTypes.ts`
- Extend `SyncEntityType` with `'in_app_notification' | 'search_history'`.

#### [MODIFY] `frontend/src/services/sync/syncEngine.ts`
1. **Notes Push (`pushSingleDeltaToSupabase`, `case 'note'`):**
   - Pass `p_clear_folder_id: Boolean(delta.deltaPayload?.clearFolderId)` and `p_clear_reminder_at: Boolean(delta.deltaPayload?.clearReminderAt)` to `rpc_update_note`.
2. **Notes Receive (`applyNoteDelta`):**
   - When `Array.isArray(p.tags)` is present on an incoming remote note delta, sync `tagsRepo.setNoteTags(delta.entityId, p.tags, delta.userId || this.config.userId)` on Device B immediately.
   - Allow `folder_id` and `reminder_at` to clear to `NULL` on Device B (`folder_id = excluded.folder_id`, `reminder_at = excluded.reminder_at` when present in delta payload).
3. **Folders Push & Receive (`case 'folder'`, `delete`, `applyFolderDelta`):**
   - On folder `update` delta with `deltaPayload.action === 'cascade_path'`: after `ensureFolderSyncedToSupabase()`, call `rpc_cascade_folder_path_change(oldPath, newPath)`.
   - On folder `delete` delta with `deltaPayload.deletedPath`: call `rpc_delete_folder_cascade(delta.entityId, deletedPath, noteAction)` instead of bare `rpc_delete_entity('folder')`.
   - In `applyFolderDelta()`: when receiving `action === 'cascade_path'` or a folder delete with `note_action`, mirror the path/status update on locally cached Device B notes immediately!
4. **Secondary Entities Push, Receive & Pull (Gaps 5, 6, 7):**
   - Add `case 'in_app_notification'`, `case 'search_history'`, and `case 'relation'` to `pushSingleDeltaToSupabase()` (calling the new Phase A RPCs instead of falling into `default: break`).
   - Add `applyNotificationDelta()`, `applySearchHistoryDelta()`, and `applyRelationDelta()` to `applyRemoteDelta()`.
   - Extend `pullWorkspaceMetadataFromCloud()` to also pull `in_app_notifications`, `search_history`, and `entity_relations` on cold start / new device sign-in.

---

### Phase E — Backup Restore Sync, Secondary Repos & Hygiene (`workspaceBackupService.ts`, `notificationsRepo.ts`, `searchHistoryRepo.ts`, `remindersRepo.ts`) [Gaps 4, 5, 6, 8]

#### [MODIFY] `frontend/src/services/workspaceBackupService.ts`
- Inside `restoreFromBackupJson()`: after inserting/replacing restored `folders`, `notes`, `tasks`, `entity_relations`, and `workspace_security`, enqueue `sync_changelog` `insert`/`update` deltas for each restored entity under the active `userId` and call `syncEngine.schedulePush()` (plus trigger `googleDriveVaultService.backfillOfflineMediaToDrive(userId)` if any restored notes carry local/data URIs).

#### [MODIFY] `frontend/src/db/notificationsRepo.ts` & `frontend/src/db/searchHistoryRepo.ts`
- Call `syncEngine.schedulePush()` after every `sync_changelog` write (`createNotification`, `markAsRead`, `markAllAsRead`, `clearNotification`, `clearAllNotifications`, `upsertSearchQuery`, `deleteSearchHistoryItem`, `clearAllSearchHistory`).

#### [MODIFY] `frontend/src/db/remindersRepo.ts`
- In `updateNotificationId()`: stop writing OS-local `notification_id` to `sync_changelog` (since iOS/Android/Web notification handles are strictly device-local and meaningless on Device B).

---

## 4. Verification Plan

### Automated Verification Suites
1. TypeScript compilation:
   ```bash
   cd frontend && npx tsc --noEmit
   ```
2. Existing regression suites:
   ```bash
   node scripts/test_phase2_sync_and_rpc.mjs
   node scripts/test_lean_cache_and_pagination.mjs
   node scripts/test_google_drive_vault.mjs
   node scripts/test_guest_vault_migration.mjs
   node scripts/test_offline_cloud_note_merge.mjs
   ```
3. **[NEW]** `scripts/test_multi_device_sync_parity.mjs`:
   - Verifies `004_multi_device_sync_parity.sql` SQL contracts (`p_clear_folder_id`, `p_clear_reminder_at`, `tags` in changelog payload, `rpc_cascade_folder_path_change`, `rpc_delete_folder_cascade`, notifications/search_history/relations RPCs).
   - Simulates folder rename/move/delete/duplicate cascading note deltas, tag clear (`tags: []`), nullable reminder/folder clear, backup restore outbox queuing, and secondary entity dispatch.

### Multi-Device Live Smoke Test Checklist
- [ ] **Folder Rename & Move:** Rename or move a folder with notes on Device A → verify folder AND all notes inside it update path on Device B immediately.
- [ ] **Folder Delete (`moveToGeneral` & `moveToTrash`):** Delete a folder on Device A → verify Device B removes the folder AND moves/trashes its notes identically.
- [ ] **Folder Duplicate:** Duplicate a folder on Device A → verify duplicated folder AND all cloned notes appear on Device B.
- [ ] **Tags Add & Clear All:** Add tags and later remove all tags from a note on Device A → verify Device B Home cards & tag filter chips update without opening the note.
- [ ] **Clear Reminder / Move to General:** Clear a note's reminder and move a note back to `General` on Device A → verify both clear cleanly in Supabase and on Device B.
- [ ] **Backup Restore:** Restore a `.json` backup on Device A → verify restored folders/notes/tasks sync automatically to Device B.
- [ ] **Notifications & Search History:** Read/clear a notification or add a search query on Device A → verify state syncs to Device B.
