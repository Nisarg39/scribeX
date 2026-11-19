# ScribeX Implementation Plan — Full Multi-Device Cloud Sync Parity (All 8 Gaps)

> **Status:** Implemented & Verified (Phases A–F complete; live migration `004_multi_device_sync_parity.sql` applied to `Scribex`)  
> **Detailed Spec & Synced Actions Registry:** [`docs/Multi_Device_Cloud_Sync_Audit_and_Gap_Fix_Plan.md`](docs/Multi_Device_Cloud_Sync_Audit_and_Gap_Fix_Plan.md)  
> **Branch:** `feat/backend-integration`

## Architecture & Scope Summary

Close all **4 P0 High-Impact** and **4 P1/P2 Secondary** multi-device sync gaps documented in [`docs/Multi_Device_Cloud_Sync_Audit_and_Gap_Fix_Plan.md`](docs/Multi_Device_Cloud_Sync_Audit_and_Gap_Fix_Plan.md) so every note, folder, tag, backup restore, notification, search history, and graph relation action synchronizes reliably across multiple devices on the same Google account.

## Implementation Steps & Required Files

1. **Phase A — Supabase SQL Migration (`004_multi_device_sync_parity.sql`)**
   - **[NEW]** `supabase/migrations/004_multi_device_sync_parity.sql`:
     - Update `rpc_create_note` & `rpc_update_note`: include `tags` in cloud `sync_changelog.delta_payload` and add `p_clear_folder_id` / `p_clear_reminder_at` boolean flags to clear nullable columns cleanly.
     - Add server-side folder cascade RPCs (`rpc_cascade_folder_path_change`, `rpc_delete_folder_cascade`) so Lean-Cache-evicted cloud notes also update atomically.
     - Add secondary-entity RPCs for `in_app_notifications`, `search_history`, and `entity_relations`.
     - Apply live to `Scribex (gbpyfhrcofwsfklzweqo)`.
2. **Phase B — Folder Cascade Sync (`foldersRepo.ts`)**
   - **[MODIFY]** `frontend/src/db/foldersRepo.ts`: Queue `sync_changelog` deltas for affected/cloned notes in `renameFolderCascade`, `moveFolderCascade`, `deleteFolderCascade`, and `duplicateFolderCascade`, and attach cascade metadata for server-side propagation.
3. **Phase C — Bidirectional Tags, Clear Flags & Repo Hygiene**
   - **[MODIFY]** `frontend/src/db/leanCacheManager.ts`: Sync `tags` in `cachePageOnePreviews()` and always sync empty `tags: []` in `hydrateNoteForEditing()`.
   - **[MODIFY]** `frontend/src/db/tagsRepo.ts`: Pass active `userId` instead of hardcoded `'user-default'`.
   - **[MODIFY]** `frontend/src/db/notesRepo.ts`: Emit `clearFolderId` / `clearReminderAt` flags on intentional `null` updates and wrap batch operations in `dbClient.withTransaction()`.
4. **Phase D — `SyncEngine` Full Dispatch & Device B Ingestion**
   - **[MODIFY]** `frontend/src/services/sync/syncTypes.ts` & `frontend/src/services/sync/syncEngine.ts`: Wire `p_clear_*`, remote tag syncing in `applyNoteDelta`, server/local folder cascades in `pushSingleDeltaToSupabase` & `applyFolderDelta`, plus push/receive/pull handlers for `in_app_notification`, `search_history`, and `relation`.
5. **Phase E — Backup Restore Sync & Secondary Repos**
   - **[MODIFY]** `frontend/src/services/workspaceBackupService.ts`: Enqueue `sync_changelog` deltas and call `syncEngine.schedulePush()` on `.json` backup restore.
   - **[MODIFY]** `frontend/src/db/notificationsRepo.ts`, `frontend/src/db/searchHistoryRepo.ts`: Call `syncEngine.schedulePush()` after outbox writes.
   - **[MODIFY]** `frontend/src/db/remindersRepo.ts`: Stop logging device-local OS `notification_id` to `sync_changelog`.
6. **Phase F — Automated Verification & Docs Update**
   - **[NEW]** `scripts/test_multi_device_sync_parity.mjs` + update `.agents/project-map.json` + check off completed items in `docs/Multi_Device_Cloud_Sync_Audit_and_Gap_Fix_Plan.md`.

## Verification Gates
- `cd frontend && npx tsc --noEmit`
- `node scripts/test_multi_device_sync_parity.mjs`
- `node scripts/test_phase2_sync_and_rpc.mjs`
- `node scripts/test_lean_cache_and_pagination.mjs`
- `node scripts/test_google_drive_vault.mjs`
- `node scripts/test_guest_vault_migration.mjs`
- `node scripts/test_offline_cloud_note_merge.mjs`

## Recommended Execution

| Command | Fit Assessment |
| :--- | :--- |
| **`/boost`** (or **`approve`**) | **Best fit.** This spans 5 coupled layers (Postgres RPC migration `004` deployed live → 6 SQLite repositories → `leanCacheManager` → `syncEngine` push/CDC/pull → backup restore → new test harness). `/boost` ensures deep verification across SQL + client CDC parity, or reply **`approve`** to execute phases A–F sequentially right away. |
| `/plan` | Already documented in full detail inside `docs/Multi_Device_Cloud_Sync_Audit_and_Gap_Fix_Plan.md`; only needed if you also want an interactive approval artifact. |
| `/teamwork` / `/swarm` | Medium fit — Phase A (SQL) and Phase D (`syncEngine.ts`) are tightly coupled shared contracts, so sequential or coordinated execution is safer than independent parallel edits. |
| `/goal` | Useful if you want an uninterrupted end-to-end run across all 6 phases + live migration deployment + all 7 test suites. |
| `/grill-me` | Unnecessary unless you want to exclude specific secondary entities (e.g., keep `search_history` device-local instead of cloud-synced). |
| `/run-workflow` | Not needed — sequential dependency chain rather than an identical fan-out. |
| `/compact` | Recommended after this task completes if the session continues further. |

**Recommendation:** Type **`/boost`** to execute all 6 phases with rigorous SQL + CDC cross-verification (or reply **`approve`** to proceed directly with sequential execution).
