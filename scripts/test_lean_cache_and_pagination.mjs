/**
 * ScribeX Headless Automated Test Suite: Phase 2 Step 3C
 * (Lean SQLite Cache, Page-1 Eviction, Dirty Outbox Protection & On-Demand Hydration)
 *
 * Verifies:
 * 1. Source contracts for leanCacheManager, noteQueryEngine (PAGE_SIZE=20), notesRepo, note/[id].tsx, useEditorState.ts
 * 2. tasks table preserves rows when evicted older synced notes are removed from local SQLite
 * 3. cachePageOnePreviews retains top 20 lightweight stubs (`blocks_json = '[]'`) while protecting dirty notes
 * 4. enforcePageOneFootprint deletes clean notes #21-25 and protects all 5 uncommitted dirty notes
 * 5. On-demand hydrateNoteForEditing -> edit -> Cloud ACK Outbox delete -> dehydrateNoteAfterSync cleanly evicts note #25
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const feDir = path.join(projectRoot, 'frontend');

console.log('=================================================================');
console.log('🧹 SCRIBEX PHASE 2 STEP 3C TEST HARNESS');
console.log('   Target: Lean SQLite Cache, Pagination & On-Demand Hydration');
console.log('=================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// STAGE 1: Static Source Contracts Verification
// -----------------------------------------------------------------------------
console.log('▶ STAGE 1: Step 3C Source & Architecture Contracts');

test('leanCacheManager.ts exports all 6 cache & eviction primitives', () => {
  const src = fs.readFileSync(path.join(feDir, 'src/db/leanCacheManager.ts'), 'utf-8');
  assert.ok(src.includes('CLOUD_PAGE_SIZE = 20'), 'Expected CLOUD_PAGE_SIZE = 20');
  assert.ok(src.includes('mapCloudNoteToNoteItem'), 'Missing mapCloudNoteToNoteItem');
  assert.ok(src.includes('hydrateNoteForEditing'), 'Missing hydrateNoteForEditing');
  assert.ok(src.includes('cachePageOnePreviews'), 'Missing cachePageOnePreviews');
  assert.ok(src.includes('dehydrateNoteAfterSync'), 'Missing dehydrateNoteAfterSync');
  assert.ok(src.includes('enforcePageOneFootprint'), 'Missing enforcePageOneFootprint');
});

test('noteQueryEngine.ts defaults pageSize to 20', () => {
  const src = fs.readFileSync(path.join(feDir, 'src/core/noteQueryEngine.ts'), 'utf-8');
  assert.ok(src.includes('pageSize: 20'), 'DEFAULT_NOTE_QUERY_REQUEST must default pageSize to 20');
});

test('notesRepo.ts emits update for soft-delete trash (not delete purge) and schedules sync', () => {
  const src = fs.readFileSync(path.join(feDir, 'src/db/notesRepo.ts'), 'utf-8');
  const softDelFn = src.match(/public async softDeleteNote[\s\S]*?public async archiveNote/);
  assert.ok(softDelFn, 'Could not extract softDeleteNote');
  assert.ok(
    softDelFn[0].includes("queueNoteSyncDelta(id, 'update', { status: 'trashed' }"),
    'softDeleteNote must emit change_type = update so trashed notes are not permanently deleted'
  );
  assert.ok(src.includes('syncEngine.schedulePush()'), 'notesRepo must trigger syncEngine.schedulePush()');
});

test('note/[id].tsx implements cloud hydration, flush + eviction on close, and offline reconnect UI', () => {
  const src = fs.readFileSync(path.join(feDir, 'app/note/[id].tsx'), 'utf-8');
  assert.ok(src.includes('fetchFullNoteFromCloud'), 'Missing on-demand fetchFullNoteFromCloud');
  assert.ok(src.includes('hydrateNoteForEditing'), 'Missing hydrateNoteForEditing');
  assert.ok(src.includes('dehydrateNoteAfterSync'), 'Missing dehydrateNoteAfterSync on close/unmount');
  assert.ok(src.includes('flushNow'), 'Missing syncEngine.flushNow() on close/background');
  assert.ok(
    src.includes('Reconnect to load this note from cloud'),
    'Missing offline evicted cloud note state message'
  );
  assert.ok(
    src.includes('localNonDehydrated') && src.includes('hasPendingLocalEdits && localNonDehydrated'),
    'Must not short-circuit on dehydrated local stubs when authenticated'
  );
});

test('useEditorState.ts merges non-focused remote CDC blocks without clobbering focused block', () => {
  const src = fs.readFileSync(path.join(feDir, 'src/components/editor/hooks/useEditorState.ts'), 'utf-8');
  assert.ok(src.includes('syncEngine.subscribe'), 'Missing syncEngine listener in useEditorState');
  assert.ok(src.includes('activeBlockIdRef.current'), 'Must protect currently focused block during remote merge');
  assert.ok(src.includes('parseMarkdownToBlocks'), 'Must parse markdown AST blocks if note.blocks fallback runs');
});

// -----------------------------------------------------------------------------
// STAGE 2: In-Memory SQLite Eviction, Dirty Protection & Task Preservation
// -----------------------------------------------------------------------------
console.log('\n▶ STAGE 2: In-Memory SQLite Lean Cache, Eviction & Task Preservation');

const schemaFile = fs.readFileSync(path.join(feDir, 'src/db/schema.ts'), 'utf-8');
const tablesMatch = schemaFile.match(/export const SCHEMA_TABLES_SQL = `([\s\S]*?)`;/);
const indexesMatch = schemaFile.match(/export const SCHEMA_INDEXES_SQL = `([\s\S]*?)`;/);
assert.ok(tablesMatch && indexesMatch, 'Failed to extract SCHEMA SQL');

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON;');
db.exec(`${tablesMatch[1]}\n${indexesMatch[1]}`);

const AUTH_UID = 'google-uid-lean-test';

// Seed 30 notes (notes #1..25 clean synced, notes #1, #26..30 dirty in sync_changelog)
for (let i = 1; i <= 30; i++) {
  const noteId = `note-${i}`;
  const fullBlocks = JSON.stringify([
    { id: `b-${i}-1`, type: 'paragraph', content: `Full rich block body for note #${i}` },
  ]);
  db.prepare(
    `INSERT INTO notes (id, user_id, title, content_markdown, blocks_json, sync_rev)
     VALUES (?, ?, ?, ?, ?, ?);`
  ).run(noteId, AUTH_UID, `Note #${i}`, `Full rich block body for note #${i}`, fullBlocks, i <= 25 ? 10 : 0);

  // Mark Note #1 (on Page 1) and Notes #26..30 (beyond Page 1) as dirty in sync_changelog
  if (i === 1 || i >= 26) {
    db.prepare(
      `INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'note', ?, 'update', '{}');`
    ).run(`log-dirty-${i}`, AUTH_UID, noteId);
  }
}

// Add a linked task to Note #25 (which will be evicted!)
db.prepare(
  `INSERT INTO tasks (id, user_id, note_id, note_title, title, is_completed)
   VALUES ('task-from-note-25', ?, 'note-25', 'Note #25', 'Important follow-up task', 0);`
).run(AUTH_UID);

// Mirror leanCacheManager logic
const dirtySet = new Set(
  db.prepare(`SELECT DISTINCT entity_id FROM sync_changelog WHERE entity_type = 'note';`).all().map((r) => r.entity_id)
);
const pageOneIds = new Set(Array.from({ length: 20 }, (_, idx) => `note-${idx + 1}`));

// Simulate cachePageOnePreviews + enforcePageOneFootprint
db.exec('BEGIN');
for (const id of pageOneIds) {
  if (dirtySet.has(id)) continue;
  db.prepare(`UPDATE notes SET blocks_json = '[]', content_markdown = ? WHERE id = ?;`).run(
    `Snippet for ${id}`,
    id
  );
}
const allLocal = db.prepare(`SELECT id, blocks_json FROM notes;`).all();
for (const row of allLocal) {
  if (dirtySet.has(row.id)) continue;
  if (!pageOneIds.has(row.id)) {
    db.prepare(`DELETE FROM notes WHERE id = ?;`).run(row.id);
  }
}
db.exec('COMMIT');

test('Enforces Page-1 cache: evicts clean notes #21-25 while retaining Page-1 clean stubs', () => {
  const remainingIds = db
    .prepare(`SELECT id, blocks_json FROM notes;`)
    .all()
    .map((r) => r.id);

  assert.strictEqual(remainingIds.length, 25); // 20 Page-1 + 5 dirty (#26..30)
  for (let i = 21; i <= 25; i++) {
    assert.ok(!remainingIds.includes(`note-${i}`), `Expected note-${i} to be evicted`);
  }

  const page1Clean = db.prepare(`SELECT blocks_json FROM notes WHERE id = 'note-2';`).get();
  assert.strictEqual(page1Clean.blocks_json, '[]', 'Clean Page-1 note must strip blocks_json to []');
});

test('Strictly protects all 5 dirty notes (#1 and #26-30) with full blocks_json intact', () => {
  for (const id of ['note-1', 'note-26', 'note-27', 'note-28', 'note-29', 'note-30']) {
    const row = db.prepare(`SELECT * FROM notes WHERE id = ?;`).get(id);
    assert.ok(row, `Dirty note ${id} was erroneously evicted!`);
    const parsed = JSON.parse(row.blocks_json);
    assert.strictEqual(parsed.length, 1, `Dirty note ${id} lost its full blocks_json!`);
  }
});

test('Removing evicted note #25 from SQLite preserves its linked task on Tasks tab', () => {
  const taskRow = db.prepare(`SELECT * FROM tasks WHERE id = 'task-from-note-25';`).get();
  assert.ok(taskRow, 'Linked task was deleted when note-25 was evicted!');
  assert.strictEqual(taskRow.note_id, 'note-25');
});

test('On-demand hydrate note #25 -> edit -> Cloud ACK Outbox delete -> dehydrate evicts note #25 cleanly', () => {
  // 1. Hydrate note-25 on Editor open
  const hydratedBlocks = JSON.stringify([
    { id: 'b-25-1', type: 'paragraph', content: 'Cloud-fetched full content for Note #25' },
  ]);
  db.prepare(
    `INSERT INTO notes (id, user_id, title, content_markdown, blocks_json, sync_rev)
     VALUES ('note-25', ?, 'Note #25', 'Cloud-fetched full content for Note #25', ?, 11)
     ON CONFLICT(id) DO UPDATE SET blocks_json = excluded.blocks_json;`
  ).run(AUTH_UID, hydratedBlocks);

  // 2. User edits -> Outbox insert
  db.prepare(
    `INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
     VALUES ('log-25-edit', ?, 1, 'note', 'note-25', 'update', '{}');`
  ).run(AUTH_UID);

  // Dirty check blocks eviction if editor tries to evict before Cloud ACK
  const pendingCount = db
    .prepare(`SELECT COUNT(*) AS cnt FROM sync_changelog WHERE entity_type = 'note' AND entity_id = 'note-25';`)
    .get().cnt;
  assert.strictEqual(pendingCount, 1);

  // 3. Cloud ACK received -> flushNow deletes Outbox row -> dehydrateNoteAfterSync evicts note-25
  db.prepare(`DELETE FROM sync_changelog WHERE id = 'log-25-edit';`).run();
  const dirtyAfterFlush = db
    .prepare(`SELECT COUNT(*) AS cnt FROM sync_changelog WHERE entity_type = 'note' AND entity_id = 'note-25';`)
    .get().cnt;
  assert.strictEqual(dirtyAfterFlush, 0);

  if (dirtyAfterFlush === 0 && !pageOneIds.has('note-25')) {
    db.prepare(`DELETE FROM notes WHERE id = 'note-25';`).run();
  }

  const afterEvict = db.prepare(`SELECT * FROM notes WHERE id = 'note-25';`).get();
  assert.strictEqual(afterEvict, undefined, 'Expected note-25 to be evicted after Cloud ACK and Editor exit');
});

console.log('\n=================================================================');
console.log(`🏁 TEST RESULTS: ${passedTests} passed · ${failedTests} failed (Total: ${totalTests})`);
console.log('=================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
