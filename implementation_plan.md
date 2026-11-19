# ScribeX Implementation Plan — ID-Based Offline-to-Existing-Account Note Merge & Reconciliation

> **Status:** Awaiting User Approval
> **Branch:** `feat/backend-integration`

## Architecture & Goal

Ensure that when a user creates or edits notes in offline/guest mode and then signs into an **existing Google account** that already has cloud notes in Supabase, **every local note is reconciled against the existing cloud vault BEFORE pushing**:
- **If `note.id` already exists in the cloud account:** perform a deterministic, non-destructive **ID-based merge** (merging `blocks_json` by `block.id`, unioning tags, resolving scalar metadata by latest `updated_at` / non-empty fallback, skipping no-op writes for untouched seed notes) and push the merged result via `rpc_update_note`.
- **If `note.id` does not exist in the cloud account:** keep it as a **brand-new note** (with folder path/ID reconciliation and cross-tenant PK collision re-minting if another user owns a deterministic seed ID like `note-welcome-01`) and insert it cleanly via `rpc_create_note`.
- **Preserve all other pre-existing cloud notes:** pull workspace metadata and Page 1 cloud notes so the workspace displays both the existing cloud notes and the newly merged/added offline notes together.

## Implementation Steps & Files

1. **Deterministic Note Merge & Reconciliation Module**
   - **[NEW]** `frontend/src/services/sync/noteMergeReconciler.ts`:
     - Export pure helper `mergeLocalAndCloudNote(localNote, cloudNote)`:
       - Merges `blocks_json` by `block.id`: preserves cloud block ordering, resolves same-`block.id` differences using newer `updated_at` (never clobbering newer cloud edits with stale untouched guest seed blocks), and appends any offline-only `block.id`s (including newly added text or media blocks).
       - Re-serializes `content_markdown` via `serializeBlocksToMarkdown(mergedBlocks)`.
       - Merges tags as a deduplicated union (`localTags ∪ cloudTags`).
       - Resolves `title`, `color_token`, `folder_id`/`folder_path`, `status`, `reminder_at`, `is_locked`/`lock_*`, and `ai_context_excluded` deterministically via latest `updated_at` (with logical OR for `is_favorite`/`is_pinned` if local was starred/pinned offline).
       - Returns `{ mergedNote, mergedBlocks, mergedTags, hasChangesVsCloud }` so identical notes skip redundant writes.
     - Export `reconcileOfflineNotesWithCloud(userId)`:
       - Inspects all pending local notes (`sync_changelog` entries with `entity_type = 'note'` and `change_type IN ('insert', 'update')`) plus any local non-dehydrated notes for `userId`.
       - Fetches matching cloud notes (`supabase.from('notes').select('*').eq('user_id', userId).in('id', candidateIds)`), their tags (`note_tags` + `tags`), and existing cloud folders (`folders`) in one batched round-trip.
       - Re-maps local notes referencing a duplicate offline folder path (e.g. local `'General'`) to the existing cloud folder's `id` so no duplicate folders or FK failures occur.
       - **Case 1 (`note.id` exists in cloud):** Runs `mergeLocalAndCloudNote`, updates local SQLite `notes` + `note_tags`, and rewrites the note's `sync_changelog` row to `change_type = 'update'` with the merged payload (or deletes the changelog row if `hasChangesVsCloud === false`).
       - **Case 2 (`note.id` does not exist in cloud):** Ensures a clean `insert` entry exists in `sync_changelog` so it is added as a brand-new note.
2. **SyncEngine Reconciliation Hook & Cross-Tenant PK Collision Guard**
   - **[MODIFY]** `frontend/src/services/sync/syncEngine.ts`:
     - Expose `public async reconcileLocalVaultWithCloud(): Promise<{ mergedCount: number; newCount: number; skippedNoOpCount: number }>` delegating to `reconcileOfflineNotesWithCloud(this.config.userId)` (gated by `!this.isSyncGateBlocked()`).
     - In `pushCreateNote()`: if `rpc_create_note` returns `null` (which happens when a deterministic seed ID such as `note-welcome-01` is already owned by a *different* user in global Postgres `notes.id`), automatically re-mint a unique ID (`note-${Date.now()}-${rand}`), re-key local `notes` / `note_tags` / `tasks` / `reminders` / `sync_changelog`, and retry `rpc_create_note` cleanly as a new note.
3. **Store Bootstrap Ordering (`useNotesStore.tsx`)**
   - **[MODIFY]** `frontend/src/state/useNotesStore.tsx`:
     - When `isCloudSyncReady` unlocks in `bootstrapWorkspace()`, run the exact safe pipeline order:
       1. `googleDriveVaultService.backfillOfflineMediaToDrive(userId)` (upload offline local media to `gdrive://<id>` first so merged blocks carry cloud Drive URIs)
       2. `syncEngine.reconcileLocalVaultWithCloud()` (merge matching cloud `note.id`s + keep unmatched notes as new inserts)
       3. `syncEngine.flushNow()` (push merged updates and brand-new notes to Supabase)
       4. `syncEngine.pullWorkspaceMetadataFromCloud()` & `fetchPaginatedNotesFromCloud()` (hydrate all remaining pre-existing cloud notes/folders/tasks/reminders into the workspace)
4. **Automated Tests & Project Intelligence**
   - **[NEW]** `scripts/test_offline_cloud_note_merge.mjs`:
     - Tests pure `mergeLocalAndCloudNote` logic: matching `note.id` merges blocks by `block.id`, appends offline-only blocks & `gdrive://` image blocks without losing cloud blocks, unions tags, avoids clobbering edited cloud notes with untouched starter seed notes, and adds unmatched `note.id`s as brand-new notes.
     - Verifies static contracts across `noteMergeReconciler.ts`, `syncEngine.ts`, and `useNotesStore.tsx`.
   - **[MODIFY]** `.agents/project-map.json`: Index `noteMergeReconciler.ts` and `test_offline_cloud_note_merge.mjs`.

## Verification Gates
- `cd frontend && npx tsc --noEmit`
- `node scripts/test_offline_cloud_note_merge.mjs`
- `node scripts/test_guest_vault_migration.mjs`
- `node scripts/test_phase2_sync_and_rpc.mjs`
- `node scripts/test_google_drive_vault.mjs`
- `node scripts/test_lean_cache_and_pagination.mjs`

## Recommended Execution

| Command | Fit Assessment |
| :--- | :--- |
| **`/plan`** (or **`approve`**) | **Best fit.** This modifies the login sync pipeline (`backfill -> reconcile -> flush -> pull`) and introduces a merge algorithm for conflicting note IDs — `/plan` lets you inspect the exact merge rules and code diffs before coding, or reply **`approve`** to execute directly in one focused pass. |
| `/boost` | Optional if you want extra edge-case scrutiny on conflict resolution (e.g., locked notes or deleted-in-cloud tombstones), though the ID-based merge contract is cleanly bounded. |
| `/swarm` / `/teamwork` | Overkill — only 3 source files (`noteMergeReconciler.ts`, `syncEngine.ts`, `useNotesStore.tsx`) + 1 test file. |
| `/grill-me` | Unnecessary unless you want custom conflict UX (e.g., side-by-side manual conflict picker instead of automatic ID-based block merge). |
| `/goal` | Unnecessary — fast, bounded single-session task with deterministic Node tests. |
| `/run-workflow` | Not needed — sequential dependency chain, not a parallel fan-out. |
| `/compact` | Not needed right now. |

**Recommendation:** Give the user necessary command to implement this feature according to the antigravity slash commands that is listed