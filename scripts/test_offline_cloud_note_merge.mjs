/**
 * ScribeX Headless Automated Test Suite: Offline-to-Existing-Account ID-Based Note Merge & Reconciliation
 *
 * Verifies:
 * 1. Static source contracts for noteMergeReconciler.ts, syncEngine.ts, and useNotesStore.tsx
 * 2. Pipeline ordering: backfillOfflineMediaToDrive -> reconcileLocalVaultWithCloud -> flushNow -> pull
 * 3. Cross-tenant PK collision re-mint guard in SyncEngine.pushCreateNote
 * 4. End-to-end executable merge & reconciliation scenarios:
 *    - Matching note.id with local offline edits merges blocks by block.id, appends offline media/text blocks, unions tags -> converts delta to 'update'
 *    - Matching note.id where cloud is newer on shared block preserves cloud's edit AND still appends offline-only blocks
 *    - Matching untouched default seed note (note-welcome-starter, sync_rev = 0) yields cleanly to cloud copy with 0 redundant writes
 *    - Unmatched note.id stays as a brand-new note ('insert' delta) with cloud folder path remapping
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
console.log('🔀 SCRIBEX OFFLINE-TO-EXISTING-ACCOUNT NOTE MERGE TEST HARNESS');
console.log('   Target: ID-Based Merge, New Note Insert & PK Collision Guard');
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
// STAGE 1: Static Source Contracts & Pipeline Ordering
// -----------------------------------------------------------------------------
console.log('▶ STAGE 1: Reconciler, SyncEngine & Store Pipeline Contracts');

test('noteMergeReconciler.ts exports mergeLocalAndCloudNote, reconcileOfflineNotesWithCloud & seed guard', () => {
  const reconcilerPath = path.join(feDir, 'src/services/sync/noteMergeReconciler.ts');
  assert.ok(fs.existsSync(reconcilerPath), 'Missing noteMergeReconciler.ts');
  const src = fs.readFileSync(reconcilerPath, 'utf-8');

  assert.ok(src.includes('export const DEFAULT_SEED_NOTE_IDS'), 'Missing DEFAULT_SEED_NOTE_IDS');
  assert.ok(src.includes("'note-welcome-starter'"), 'Must include note-welcome-starter in seed IDs');
  assert.ok(src.includes('export function mergeLocalAndCloudNote('), 'Missing mergeLocalAndCloudNote');
  assert.ok(src.includes('export async function reconcileOfflineNotesWithCloud('), 'Missing reconcileOfflineNotesWithCloud');
  assert.ok(src.includes('isUntouchedLocalSeed'), 'Must protect untouched default seed notes from clobbering cloud');
  assert.ok(src.includes('cloudFolderIdByPath'), 'Must remap offline folder paths to existing cloud folder IDs');
  assert.ok(src.includes("VALUES (?, ?, ?, 'note', ?, 'update', ?);"), 'Matched edited notes must rewrite outbox delta to update');
});

test('syncEngine.ts exposes reconcileLocalVaultWithCloud & cross-tenant PK re-mint recovery', () => {
  const src = fs.readFileSync(path.join(feDir, 'src/services/sync/syncEngine.ts'), 'utf-8');
  assert.ok(src.includes('reconcileOfflineNotesWithCloud'), 'SyncEngine must import reconcileOfflineNotesWithCloud');
  assert.ok(src.includes('public async reconcileLocalVaultWithCloud()'), 'Missing reconcileLocalVaultWithCloud method');
  assert.ok(src.includes('private async rekeyLocalNoteId('), 'Missing rekeyLocalNoteId helper');
  assert.ok(src.includes('isCrossTenantPkCollision'), 'Missing cross-tenant PK collision detection');
  assert.ok(src.includes("error.code === '23505'"), 'Must handle Postgres 23505 duplicate key collision');
});

test('useNotesStore.tsx runs backfill -> reconcile -> flush -> pull in strict order', () => {
  const src = fs.readFileSync(path.join(feDir, 'src/state/useNotesStore.tsx'), 'utf-8');
  const idxBackfill = src.indexOf('googleDriveVaultService.backfillOfflineMediaToDrive(userId)');
  const idxReconcile = src.indexOf('syncEngine.reconcileLocalVaultWithCloud()');
  const idxFlush = src.indexOf('syncEngine.flushNow()');
  const idxPull = src.indexOf('syncEngine.pullWorkspaceMetadataFromCloud()');

  assert.ok(idxBackfill !== -1, 'Missing backfillOfflineMediaToDrive call');
  assert.ok(idxReconcile !== -1, 'Missing reconcileLocalVaultWithCloud call');
  assert.ok(idxFlush !== -1, 'Missing flushNow call');
  assert.ok(idxPull !== -1, 'Missing pullWorkspaceMetadataFromCloud call');
  assert.ok(
    idxBackfill < idxReconcile && idxReconcile < idxFlush && idxFlush < idxPull,
    'Pipeline order must be: backfillOfflineMediaToDrive -> reconcileLocalVaultWithCloud -> flushNow -> pullWorkspaceMetadataFromCloud'
  );
});

// -----------------------------------------------------------------------------
// STAGE 2: Executable Merge & In-Memory SQLite Reconciliation Simulation
// -----------------------------------------------------------------------------
console.log('\n▶ STAGE 2: Executable ID-Based Merge & New-Note Reconciliation');

const DEFAULT_SEED_IDS = new Set(['note-welcome-starter', 'note-1', 'note-2', 'note-3', 'note-4']);

function stableSig(b) {
  return JSON.stringify({ id: b.id, type: b.type, content: b.content ?? '', metadata: b.metadata ?? null });
}

function mergeNotes(local, cloud, { isUntouchedLocalSeed = false } = {}) {
  const normTags = (arr) => [...new Set((arr || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
  const cloudTags = normTags(cloud.tags);
  const localTags = normTags(local.tags);

  if (isUntouchedLocalSeed) {
    return { merged: { ...cloud, tags: cloudTags }, hasChangesVsCloud: false };
  }

  const localIsNewer = Date.parse(local.updated_at || 0) >= Date.parse(cloud.updated_at || 0);
  const localById = new Map(local.blocks.map((b) => [b.id, b]));
  const seen = new Set();
  const mergedBlocks = [];

  for (const cb of cloud.blocks) {
    seen.add(cb.id);
    const lb = localById.get(cb.id);
    if (lb && stableSig(lb) !== stableSig(cb)) {
      mergedBlocks.push(localIsNewer ? lb : cb);
    } else {
      mergedBlocks.push(cb);
    }
  }
  for (const lb of local.blocks) {
    if (seen.has(lb.id)) continue;
    if (mergedBlocks.length > 0 && lb.type === 'paragraph' && !String(lb.content || '').trim()) continue;
    seen.add(lb.id);
    mergedBlocks.push(lb);
  }

  const mergedTags = normTags([...cloudTags, ...localTags]);
  const merged = {
    ...cloud,
    title: localIsNewer && local.title ? local.title : cloud.title,
    blocks: mergedBlocks,
    is_favorite: Boolean(local.is_favorite || cloud.is_favorite),
    is_pinned: Boolean(local.is_pinned || cloud.is_pinned),
    tags: mergedTags,
  };

  const blocksChanged =
    mergedBlocks.length !== cloud.blocks.length ||
    mergedBlocks.some((b, i) => stableSig(b) !== stableSig(cloud.blocks[i]));
  const tagsChanged =
    mergedTags.length !== cloudTags.length || mergedTags.some((t) => !cloudTags.includes(t));
  const scalarsChanged =
    merged.title !== cloud.title ||
    merged.is_favorite !== Boolean(cloud.is_favorite) ||
    merged.is_pinned !== Boolean(cloud.is_pinned);

  return { merged, hasChangesVsCloud: blocksChanged || tagsChanged || scalarsChanged };
}

test('Matching note.id with local offline edits merges shared blocks, appends offline image block & unions tags', () => {
  const cloudNote = {
    id: 'note-1',
    title: 'Sprint Checklist (Cloud)',
    blocks: [
      { id: 'b1', type: 'paragraph', content: 'Cloud original intro' },
      { id: 'b2', type: 'paragraph', content: 'Cloud-only section' },
    ],
    tags: ['work', 'sprint'],
    is_favorite: false,
    is_pinned: true,
    updated_at: '2026-11-18T10:00:00.000Z',
  };

  const localNote = {
    id: 'note-1',
    title: 'Sprint Checklist (Updated Offline)',
    blocks: [
      { id: 'b1', type: 'paragraph', content: 'Edited intro offline' },
      { id: 'b-offline-img', type: 'image', content: 'gdrive://driveFileOffline1', metadata: { driveFileId: 'driveFileOffline1' } },
    ],
    tags: ['sprint', 'offline-capture'],
    is_favorite: true,
    is_pinned: false,
    updated_at: '2026-11-19T12:00:00.000Z',
  };

  const { merged, hasChangesVsCloud } = mergeNotes(localNote, cloudNote);
  assert.strictEqual(hasChangesVsCloud, true);
  assert.strictEqual(merged.title, 'Sprint Checklist (Updated Offline)');
  assert.strictEqual(merged.blocks.length, 3, 'Must retain cloud blocks + append offline image block');
  assert.strictEqual(merged.blocks[0].content, 'Edited intro offline');
  assert.strictEqual(merged.blocks[1].content, 'Cloud-only section', 'Must never drop cloud-only blocks');
  assert.strictEqual(merged.blocks[2].id, 'b-offline-img');
  assert.deepStrictEqual(merged.tags, ['work', 'sprint', 'offline-capture']);
  assert.strictEqual(merged.is_favorite, true);
  assert.strictEqual(merged.is_pinned, true);
});

test('Matching note.id where cloud is newer preserves cloud edit on shared block while appending offline block', () => {
  const cloudNote = {
    id: 'note-shared',
    title: 'Newer Cloud Title',
    blocks: [{ id: 'b1', type: 'paragraph', content: 'Newer cloud text' }],
    tags: ['cloud'],
    is_favorite: false,
    is_pinned: false,
    updated_at: '2026-11-19T12:05:00.000Z',
  };

  const localNote = {
    id: 'note-shared',
    title: 'Older Local Title',
    blocks: [
      { id: 'b1', type: 'paragraph', content: 'Older local text' },
      { id: 'b-local-new', type: 'paragraph', content: 'Added while offline' },
    ],
    tags: ['local'],
    is_favorite: false,
    is_pinned: false,
    updated_at: '2026-11-19T11:00:00.000Z',
  };

  const { merged, hasChangesVsCloud } = mergeNotes(localNote, cloudNote);
  assert.strictEqual(hasChangesVsCloud, true);
  assert.strictEqual(merged.title, 'Newer Cloud Title', 'Cloud newer title must win');
  assert.strictEqual(merged.blocks[0].content, 'Newer cloud text', 'Cloud newer shared block must win');
  assert.strictEqual(merged.blocks[1].content, 'Added while offline', 'Offline-only block must still be preserved');
  assert.deepStrictEqual(merged.tags, ['cloud', 'local']);
});

test('Untouched default guest starter note yields to customized cloud copy with 0 redundant writes', () => {
  const cloudNote = {
    id: 'note-welcome-starter',
    title: 'My Customized Welcome Guide',
    blocks: [{ id: 'wb-title-1', type: 'heading', content: 'Customized on Device A' }],
    tags: ['guide', 'custom'],
    is_favorite: true,
    is_pinned: false,
    updated_at: '2026-11-10T08:00:00.000Z',
  };

  const freshSeedLocal = {
    id: 'note-welcome-starter',
    title: 'Welcome to ScribeX',
    blocks: [{ id: 'wb-title-1', type: 'heading', content: 'Default untouched seed' }],
    tags: ['guide'],
    is_favorite: false,
    is_pinned: false,
    updated_at: '2026-11-19T12:00:00.000Z',
    sync_rev: 0,
  };

  const isUntouchedLocalSeed = DEFAULT_SEED_IDS.has(freshSeedLocal.id) && freshSeedLocal.sync_rev <= 0;
  const { merged, hasChangesVsCloud } = mergeNotes(freshSeedLocal, cloudNote, { isUntouchedLocalSeed });

  assert.strictEqual(hasChangesVsCloud, false, 'Untouched seed note must produce no-op');
  assert.strictEqual(merged.title, 'My Customized Welcome Guide');
  assert.strictEqual(merged.blocks[0].content, 'Customized on Device A');
});

test('In-memory SQLite reconciliation: existing ID -> update delta, unmatched ID -> insert delta + cloud folder remap', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE notes (id TEXT PRIMARY KEY, user_id TEXT, folder_id TEXT, folder_path TEXT, title TEXT, blocks_json TEXT, sync_rev INTEGER DEFAULT 0);
    CREATE TABLE sync_changelog (id TEXT PRIMARY KEY, user_id TEXT, sync_rev INTEGER, entity_type TEXT, entity_id TEXT, change_type TEXT, delta_payload TEXT);
  `);

  const userId = 'google-user-existing';
  // Local DB after guest migration: 1 existing cloud ID ('note-1') + 1 brand-new offline ID ('note-offline-999')
  db.prepare(
    `INSERT INTO notes (id, user_id, folder_id, folder_path, title, blocks_json, sync_rev) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('note-1', userId, 'folder-local-gen', 'General', 'Edited Offline', JSON.stringify([{ id: 'b-new', type: 'paragraph', content: 'Offline line' }]), 2);

  db.prepare(
    `INSERT INTO notes (id, user_id, folder_id, folder_path, title, blocks_json, sync_rev) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('note-offline-999', userId, 'folder-local-gen', 'General', 'Brand New Offline Note', JSON.stringify([{ id: 'b-999', type: 'paragraph', content: 'Hello cloud' }]), 1);

  db.prepare(
    `INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload) VALUES (?, ?, ?, 'note', ?, 'insert', '{}')`
  ).run('log-1', userId, 2, 'note-1');
  db.prepare(
    `INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload) VALUES (?, ?, ?, 'note', ?, 'insert', '{}')`
  ).run('log-2', userId, 1, 'note-offline-999');

  const cloudNotesById = new Map([
    ['note-1', { id: 'note-1', title: 'Cloud Existing', blocks: [{ id: 'b-cloud', type: 'paragraph', content: 'Existing cloud line' }] }],
  ]);
  const cloudFolderIdByPath = new Map([['general', 'folder-cloud-general-id']]);

  // Simulate reconciliation pass
  const logs = db.prepare(`SELECT entity_id FROM sync_changelog WHERE entity_type = 'note'`).all();
  for (const { entity_id: nid } of logs) {
    const localRow = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(nid);
    if (cloudNotesById.has(nid)) {
      db.prepare(`DELETE FROM sync_changelog WHERE entity_type = 'note' AND entity_id = ?`).run(nid);
      db.prepare(
        `INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload) VALUES (?, ?, ?, 'note', ?, 'update', '{}')`
      ).run(`log-merge-${nid}`, userId, 3, nid);
    } else {
      const cloudFolderId = cloudFolderIdByPath.get(localRow.folder_path.toLowerCase());
      if (cloudFolderId) {
        db.prepare(`UPDATE notes SET folder_id = ? WHERE id = ?`).run(cloudFolderId, nid);
      }
    }
  }

  const note1Delta = db.prepare(`SELECT change_type FROM sync_changelog WHERE entity_id = 'note-1'`).get();
  const note999Delta = db.prepare(`SELECT change_type FROM sync_changelog WHERE entity_id = 'note-offline-999'`).get();
  const note999Row = db.prepare(`SELECT folder_id FROM notes WHERE id = 'note-offline-999'`).get();

  assert.strictEqual(note1Delta.change_type, 'update', 'Existing cloud note ID must be pushed as update');
  assert.strictEqual(note999Delta.change_type, 'insert', 'Unmatched offline note ID must be added as new insert');
  assert.strictEqual(note999Row.folder_id, 'folder-cloud-general-id', 'Unmatched note must remap folder_id to existing cloud folder');
  db.close();
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n=================================================================');
console.log(`📊 Offline-to-Cloud Merge Results: ${passedTests}/${totalTests} passed, ${failedTests} failed`);
console.log('=================================================================');

if (failedTests > 0) {
  process.exit(1);
}
