# ScribeX Implementation Plan — Fix Deleted Note Block (Contact Element) Still Appearing on Web

> **Status:** Awaiting User Approval  
> **Branch:** `feat/backend-integration`  
> **Target Supabase Project:** `Scribex` (`gbpyfhrcofwsfklzweqo`)

## Root Cause Analysis

Investigation across live Supabase Postgres and client source confirmed a combination of 4 interconnected bugs:

1. **Supabase Cloud State Mismatch (`note-1794224464963`):**
   - Live query confirmed `public.notes` has `blocks_json = []` while `content_markdown` still contains `"<!-- scribex:block type=contact data=... -->\n👤 **Contact: Nisarg**"`.
   - This happened when the note was pushed in a dehydrated cache state (`blocks_json == '[]'`) while `content_markdown` retained the old serialized block preview.
2. **Editor Resurrection Fallback (`useEditorState.ts` lines 150–161):**
   - When the Web editor opens with `note.blocks = []`, `useEditorState` evaluates:
     `note.blocks.length > 0 ? note.blocks : note.contentMarkdown ? parseMarkdownToBlocks(note.contentMarkdown)`.
   - Because `contentMarkdown` in cloud still had the serialized contact markdown, `parseMarkdownToBlocks` recreated the contact block and displayed it in the editor.
3. **Incoming CDC Delta & Pull Suppression (`syncEngine.ts` lines 1549–1550 & `useEditorState.ts` line 260):**
   - In `syncEngine.applyNoteDelta`:
     `blocks_json = CASE WHEN excluded.blocks_json != '[]' THEN excluded.blocks_json ELSE notes.blocks_json END`
     `content_markdown = CASE WHEN excluded.content_markdown != '' THEN excluded.content_markdown ELSE notes.content_markdown END`
     If a note's blocks or content are cleared to `[]` or `""`, SQLite explicitly ignored the remote update and preserved the old local contact block.
   - In `useEditorState.ts`: incoming CDC deltas checked `if (Array.isArray(incomingBlocks) && incomingBlocks.length > 0)`. When all blocks were deleted or reduced to an empty paragraph, the live editor skipped updating.
4. **`blocksRef.current` Lag on Delete (`useEditorState.ts` lines 812–843):**
   - In `handleDeleteBlock`, `blocksRef.current` was never updated synchronously when `setBlocks(emptyBlock)` or `setBlocks(nextBlocks)` was called. Any immediate flush or exit action used the stale reference containing the deleted contact block.

---

## Proposed Changes

### 1. Live Supabase Data Fix
- Update `public.notes` for `note-1794224464963` on `gbpyfhrcofwsfklzweqo`:
  Clear `content_markdown = ''` and `blocks_json = '[]'::jsonb` to match the deleted state from the mobile app.

### 2. Editor Block State & Deletion Hardening (`frontend/src/components/editor/hooks/useEditorState.ts`)
- In `handleDeleteBlock`:
  - Synchronously update `blocksRef.current = emptyBlock` / `blocksRef.current = nextBlocks` before calling `setBlocks` and `persistChanges`.
- In `useEditorState` initial block initialization:
  - When `note.isDehydrated` is false (or `blocks` is explicitly provided as `[]`), do NOT resurrect deleted blocks from stale `contentMarkdown`.
- In realtime CDC listener (`syncEngine.subscribe`):
  - Handle `Array.isArray(incomingBlocks)` even when `incomingBlocks.length === 0` (or 1 empty paragraph) so remote deletions reflect immediately without requiring a page refresh.

### 3. SyncEngine CDC Ingestion Hardening (`frontend/src/services/sync/syncEngine.ts`)
- In `applyNoteDelta`:
  - Use `hasKey('blocks_json')` and `hasKey('content_markdown')` to govern whether `excluded.blocks_json` and `excluded.content_markdown` overwrite SQLite, instead of checking `!= '[]'` and `!= ''`. This ensures emptying or deleting all blocks syncs cleanly across all devices.

### 4. Push Dehydrated Note Guard (`frontend/src/services/sync/syncEngine.ts`)
- In `pushCreateNote` and `pushSingleDeltaToSupabase`:
  - If a note is dehydrated (`blocks_json == '[]'`), do NOT push stale `content_markdown` block comments to cloud; ensure `p_content_markdown` and `p_blocks_json` reflect the authoritative hydrated note state.

### 5. Verification & Testing
- Run test suites:
  - `cd frontend && npx tsc --noEmit`
  - `node scripts/test_multi_device_sync_parity.mjs`
  - `node scripts/test_phase2_sync_and_rpc.mjs`
- Verify live Supabase row `note-1794224464963` reflects the cleared block state.

---

## Recommended Execution

| Command | Fit Assessment |
| :--- | :--- |
| **`approve`** | **Best fit.** Root cause is fully verified across live Postgres and the 3 editor/sync files. The fix is deterministic and bounded. |
| `/plan` | Optional if you want to inspect detailed code diffs before applying. |
| `/boost` / `/swarm` / `/teamwork` | Overkill for a single editor block deletion and CDC sync fix. |

**Recommendation:** Reply **`approve`** to apply the fix, clean up the note in live Postgres, and run validation tests.
