# ScribeX Implementation Plan — Fix `seedInitialDefaults` SQL Column-Count Mismatch (`client.web.ts` & `client.native.ts`)

> **Status:** Awaiting User Approval  
> **Branch:** `feat/backend-integration`  
> **Build Policy:** **No Android APK build** (verify via `tsc` + Node SQLite/seed checks only).

## Root Cause Analysis

In `seedInitialDefaults()` in both [client.web.ts](frontend/src/db/client.web.ts#L402-L434) and [client.native.ts](frontend/src/db/client.native.ts#L208-L240):
- The `INSERT INTO tasks (...)` statement declares **10 columns** (`id, user_id, note_id, note_title, note_color_token, block_id, title, is_completed, priority, due_date`).
- `starter-task-1`, `starter-task-2`, `starter-task-3`, and `task-1` supply 10 values, **but `task-2`, `task-3`, and `task-4` omit `block_id` and supply only 9 values**.
- SQLite throws `table tasks has 10 columns but 9 values were supplied`, causing `initDatabase()` to fail in `seedInitialDefaults -> migrateLegacyDataOrSeed -> initDatabase` (and fail a second time inside the `catch` fallback).

## Proposed Changes

1. **[frontend/src/db/client.web.ts](frontend/src/db/client.web.ts) & [frontend/src/db/client.native.ts](frontend/src/db/client.native.ts):**
   - Supply `block_id` for `task-2` (`'b1-3'`), `task-3` (`NULL`), and `task-4` (`NULL`) so every row matches the 10 declared columns.
   - Use `INSERT OR IGNORE INTO notes` and `INSERT OR IGNORE INTO tasks` in `seedInitialDefaults` so repeated/fallback calls remain idempotent.
2. **Verify (No APK build):**
   - Run `cd frontend && npx tsc --noEmit`.
   - Run `node scripts/test_guest_vault_migration.mjs` and `node scripts/test_lean_cache_and_pagination.mjs` (or a direct `sql.js` verification of `seedInitialDefaults` SQL) to confirm clean DB initialization.

## Recommended Execution

| Command | Fit | Reason |
| :--- | :--- | :--- |
| `/plan` | **Best Fit** | Small, deterministic 2-file SQL seed fix (`client.web.ts` & `client.native.ts`) + TypeScript & DB verification without building any APK. |
| `/grill-me` | Not Needed | Exact SQL column-count bug is confirmed. |
| `/swarm`, `/teamwork`, `/run-workflow` | Not Needed | Identical 10-line fix in two files. |
| `/boost`, `/goal` | Not Needed | Bounded SQL seed bugfix. |
| `/compact` | Not Needed | Context is manageable. |
