# ScribeX Implementation Plan — Multi-Device Sync Edge-Case Hardening (3 Remaining Items)

> **Status:** Awaiting User Approval  
> **Branch:** `feat/backend-integration`  
> **Target Supabase Project:** `Scribex` (`gbpyfhrcofwsfklzweqo`)

## Architecture & Goal

Resolve the 3 remaining non-blocking edge cases identified during the multi-device sync verification pass:

1. **Recursive Subfolder Tree Duplication (`duplicateFolderCascade` + `rpc_duplicate_folder_cascade`):**
   - Currently both `foldersRepo.duplicateFolderCascade` and `rpc_duplicate_folder_cascade` only duplicate direct notes in the selected folder and do not clone descendant subfolders or their notes.
   - **Fix:**
     - **Postgres (`supabase/migrations/005_sync_edge_case_hardening.sql`):** Update `rpc_duplicate_folder_cascade` to walk the entire descendant folder tree (`path = v_clean_source OR path LIKE ...` with exact prefix matching `left(path, length(v_clean_source) + 1) = v_clean_source || '/'`), ordered shallow-to-deep (`length(path) ASC`), creating mapped `new_folder_id`s with proper `parent_id` and `path` rewrites (`v_target_path || substr(path, length(v_clean_source) + 1)`), cloning all non-trashed notes in the root and every descendant subfolder (including full `blocks_json` & `note_tags`), emitting `sync_changelog` entries for every cloned folder and note, and returning `{ folder, folders, notes, duplicatedNotesCount }`.
     - **Client (`frontend/src/db/foldersRepo.ts` & `frontend/src/services/sync/syncEngine.ts`):** Update `duplicateFolderCascadeInCloud()` to upsert all returned cloned folders & notes into local SQLite cleanly, and update the local offline fallback in `foldersRepo.duplicateFolderCascade()` to also recursively clone descendant subfolders and their notes (with `sync_changelog` deltas).
2. **Prevent Duplicate Reminder Rows on Task Updates (`rpc_create_task`):**
   - Currently `rpc_create_task` in `002_core_rpcs.sql` unconditionally runs `INSERT INTO reminders (...)` whenever `p_reminder_at IS NOT NULL`, creating duplicate reminder rows in Postgres whenever a task with an existing reminder has its title, priority, or due date updated.
   - **Fix (`supabase/migrations/005_sync_edge_case_hardening.sql`):** Redefine `rpc_create_task` so when `p_reminder_at IS NOT NULL`, it updates the existing active reminder row for `target_type = 'task' AND target_id = v_task_id AND user_id = v_user_id AND is_dismissed = FALSE` if one exists, and only inserts a new `reminders` row if none exists (also guarding cross-tenant PK collisions with `IF NOT FOUND THEN RETURN NULL; END IF;`).
   - Update `syncEngine.ts` task push to re-mint `task.id` if `rpc_create_task` returns `NULL` on cross-tenant PK collision.
3. **Cross-Tenant Seed Folder ID Collision Recovery (`rpc_upsert_folder` + `ensureFolderSyncedToSupabase`):**
   - Currently `rpc_upsert_folder` in `002_core_rpcs.sql` can silently skip updating another tenant's row when a deterministic seed folder ID (`folder-work`, `folder-general`, `folder-research`) collides globally across users in Postgres `folders.id`, returning `NULL` without notifying the caller.
   - **Fix:**
     - **Postgres (`supabase/migrations/005_sync_edge_case_hardening.sql`):** Add `IF NOT FOUND THEN RETURN NULL; END IF;` before emitting `sync_changelog` in `rpc_upsert_folder` so cross-tenant collisions never emit phantom changelog entries and clearly signal `NULL` to the client.
     - **Client (`frontend/src/services/sync/syncEngine.ts`):** Add `rekeyLocalFolderId(oldId, newId)` (atomically updating `folders.id`, `folders.parent_id`, `notes.folder_id`, and `sync_changelog.entity_id`) and call it inside `ensureFolderSyncedToSupabase()` when `rpc_upsert_folder` returns `NULL` (or throws `23505`), then retry once with the fresh UUID.

## Required Files
- **[NEW]** `supabase/migrations/005_sync_edge_case_hardening.sql` (and apply live to `gbpyfhrcofwsfklzweqo`)
- **[MODIFY]** `frontend/src/services/sync/syncEngine.ts`
- **[MODIFY]** `frontend/src/db/foldersRepo.ts`
- **[MODIFY]** `scripts/test_multi_device_sync_parity.mjs` (add assertions & SQLite tests for recursive subfolder duplication, task reminder dedup, and folder seed-ID collision recovery)
- **[MODIFY]** `.agents/project-map.json` (index `005_sync_edge_case_hardening.sql`)

## Verification Gates
- Live rolled-back `authenticated` JWT Postgres test on `gbpyfhrcofwsfklzweqo`
- `cd frontend && npx tsc --noEmit`
- `node scripts/test_multi_device_sync_parity.mjs`
- `node scripts/test_phase2_sync_and_rpc.mjs`

## Recommended Execution

| Command | Fit Assessment |
| :--- | :--- |
| **`approve`** (or **`/plan`**) | **Best fit.** This is a tightly scoped, well-defined 4-file change (1 SQL migration + `syncEngine.ts` + `foldersRepo.ts` + tests) with zero architectural ambiguity. Reply **`approve`** to implement, deploy live, and verify directly, or **`/plan`** if you want a full SQL/diff review artifact first. |
| `/boost` | Optional, though unnecessary for 3 bounded fixes whose exact locations and root causes are already verified. |
| `/swarm` / `/teamwork` | Overkill — SQL migration `005` and `syncEngine.ts` / `foldersRepo.ts` share a single sequential contract. |
| `/grill-me` / `/goal` / `/run-workflow` / `/compact` | Not needed for this focused pass. |

**Recommendation:** Reply **`approve`** to implement, deploy migration `005`, and run all verification suites directly (or type **`/plan`** to review the detailed SQL/code diffs first).
