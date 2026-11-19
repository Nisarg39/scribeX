# Implementation Plan: Cascade-Delete Google Drive & Local Media Assets When Notes Are Permanently Deleted from Trash

## 1. Root Cause Identified
Currently, [`notesRepo.ts`](frontend/src/db/notesRepo.ts) (`permanentlyDeleteNote`, `emptyTrashCascade`, and `batchPermanentlyDeleteNotes`) deletes note rows from SQLite and queues `rpc_delete_entity` tombstones to Supabase, **without** deleting the note's `gdrive://<fileId>` files from Google Drive `ScribeX_Vault/`, `assets` metadata rows, or Guest `local_media/` files.

Moreover, in Logged-In Lean Cache mode, trashed notes on-device may be dehydrated (`blocks_json = '[]'`), so cleanup must check both local blocks and Supabase `notes.blocks_json` (before `rpc_delete_entity` purges the cloud note row).

---

## 2. Planned Changes
- **[`frontend/src/services/drive/googleDriveVaultService.ts`](frontend/src/services/drive/googleDriveVaultService.ts):**
  - Add `cleanupMediaForDeletedNotes(notesToPurge: Array<{ id: string; userId: string; blocksJson?: string; contentMarkdown?: string }>): Promise<void>`:
    1. Extracts `driveFileId` / `gdrive://<id>` and `local_media/` URIs from each note's local `blocksJson` and `contentMarkdown`.
    2. For authenticated notes (`userId !== 'user-default'`), if local `blocksJson` is empty/dehydrated (`'[]'`), queries `supabase.from('notes').select('id, blocks_json').in('id', cloudIds)` **before** the `rpc_delete_entity` tombstone executes so no `gdrive://` IDs are missed.
    3. Calls `deleteDriveAssetById(driveFileId, userId)` for every Drive file found (deleting from Google Drive `ScribeX_Vault/`, local SQLite `assets`, and Supabase `assets`), calls `purgeNoteTempCache(noteId)`, and calls `deleteLocalMediaIfManaged(uri)` for any local-only Guest files.
- **[`frontend/src/db/notesRepo.ts`](frontend/src/db/notesRepo.ts):**
  - Before deleting rows or scheduling `delete` tombstones in:
    1. `permanentlyDeleteNote(id)`
    2. `emptyTrashCascade()`
    3. `batchPermanentlyDeleteNotes(ids)`
    await `googleDriveVaultService.cleanupMediaForDeletedNotes(...)` so Drive files and `assets` rows are removed cleanly before `rpc_delete_entity` purges the note row in Postgres.
- **[`scripts/test_google_drive_vault.mjs`](scripts/test_google_drive_vault.mjs):**
  - Add assertions verifying `cleanupMediaForDeletedNotes` in `googleDriveVaultService.ts` and its invocation across `permanentlyDeleteNote`, `emptyTrashCascade`, and `batchPermanentlyDeleteNotes` in `notesRepo.ts`.

---

## 3. Verification Gates
- `cd frontend && npx tsc --noEmit` (0 errors)
- `node scripts/test_google_drive_vault.mjs`
- `node scripts/test_lean_cache_and_pagination.mjs`
- `node scripts/test_phase2_sync_and_rpc.mjs`

---

## Recommended Execution

| Command | Fit | Reasoning |
| :--- | :--- | :--- |
| `/plan` | **Best Fit** | Clean 2-file implementation (`googleDriveVaultService.ts` + `notesRepo.ts`) + test assertions covering all 3 Trash purge paths. |
| `/boost` | Low | Overkill for this focused cascade cleanup. |
| `/teamwork` / `/swarm` | Low | Only `googleDriveVaultService.ts` and `notesRepo.ts` are touched. |
| `/compact` | Optional | Not needed unless freeing context tokens. |
