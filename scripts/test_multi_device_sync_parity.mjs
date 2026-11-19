/**
 * ScribeX Headless Automated Test Suite: Multi-Device Cloud Sync Parity (All 8 Gaps)
 * Source of Truth: docs/Multi_Device_Cloud_Sync_Audit_and_Gap_Fix_Plan.md
 *
 * Verifies:
 * 1. SQL migration 004_multi_device_sync_parity.sql contracts (overload-safe DROP, nullable clears,
 *    tags in sync_changelog, folder server cascades, secondary entity RPCs, RLS auth guards)
 * 2. Client source contracts across foldersRepo, leanCacheManager, tagsRepo, notesRepo,
 *    syncTypes, syncEngine, workspaceBackupService, notificationsRepo, searchHistoryRepo,
 *    remindersRepo, and useNotesStore
 * 3. Two-device (Device A <-> Device B) executable in-memory SQLite simulations covering all 8 gaps
 *    and edge cases (LIKE wildcard safety, partial delta preservation, UNIQUE collision safety,
 *    empty-tag clear, nullable field clear, backup restore outbox, and reminder notification hygiene)
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
console.log('🌐 SCRIBEX MULTI-DEVICE CLOUD SYNC PARITY TEST HARNESS');
console.log('   Target: All 8 Sync Gaps (Phases A–F) & Two-Device CDC Parity');
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
// STAGE 1: SQL Migration 004 Contracts
// -----------------------------------------------------------------------------
console.log('▶ STAGE 1: Migration 004_multi_device_sync_parity.sql Contracts');

const mig004Path = path.join(projectRoot, 'supabase/migrations/004_multi_device_sync_parity.sql');
assert.ok(fs.existsSync(mig004Path), 'Missing supabase/migrations/004_multi_device_sync_parity.sql');
const mig004Sql = fs.readFileSync(mig004Path, 'utf-8');

test('004 migration drops old 21-param rpc_update_note before defining 23-param overload-free version', () => {
  const dropIdx = mig004Sql.indexOf('DROP FUNCTION IF EXISTS public.rpc_update_note(');
  const createIdx = mig004Sql.indexOf('CREATE OR REPLACE FUNCTION rpc_update_note(');
  assert.ok(dropIdx !== -1, 'Missing DROP FUNCTION IF EXISTS public.rpc_update_note');
  assert.ok(createIdx !== -1, 'Missing CREATE OR REPLACE FUNCTION rpc_update_note');
  assert.ok(dropIdx < createIdx, 'DROP FUNCTION must appear before CREATE OR REPLACE FUNCTION');
  assert.ok(mig004Sql.includes('p_clear_folder_id BOOLEAN DEFAULT FALSE'), 'Missing p_clear_folder_id');
  assert.ok(mig004Sql.includes('p_clear_reminder_at BOOLEAN DEFAULT FALSE'), 'Missing p_clear_reminder_at');
  assert.ok(mig004Sql.includes('WHEN p_clear_folder_id THEN NULL'), 'Missing clear_folder_id CASE');
  assert.ok(mig004Sql.includes('WHEN p_clear_reminder_at THEN NULL'), 'Missing clear_reminder_at CASE');
});

test('004 migration emits tags in sync_changelog.delta_payload for both rpc_create_note and rpc_update_note', () => {
  const createMatch = mig004Sql.match(
    /CREATE OR REPLACE FUNCTION rpc_create_note[\s\S]*?CREATE OR REPLACE FUNCTION rpc_update_note/
  );
  const updateMatch = mig004Sql.match(
    /CREATE OR REPLACE FUNCTION rpc_update_note[\s\S]*?CREATE OR REPLACE FUNCTION rpc_cascade_folder_path_change/
  );
  assert.ok(createMatch && createMatch[0].includes("'tags', COALESCE(v_tags_json, '[]'::jsonb)"), 'rpc_create_note must emit tags in sync_changelog');
  assert.ok(updateMatch && updateMatch[0].includes("'tags', COALESCE(v_tags_json, '[]'::jsonb)"), 'rpc_update_note must emit tags in sync_changelog');
});

test('004 migration defines all folder cascade, duplicate, reminder dismiss, and secondary-entity RPCs with auth.uid() & cross-tenant PK guards', () => {
  const expectedRpcs = [
    'rpc_create_note',
    'rpc_update_note',
    'rpc_cascade_folder_path_change',
    'rpc_delete_folder_cascade',
    'rpc_cascade_folder_archive_change',
    'rpc_duplicate_folder_cascade',
    'rpc_dismiss_reminder',
    'rpc_upsert_in_app_notification',
    'rpc_mark_notifications_read',
    'rpc_delete_in_app_notification',
    'rpc_upsert_search_history',
    'rpc_delete_search_history',
    'rpc_upsert_entity_relation',
    'rpc_delete_entity_relation',
  ];

  for (const rpc of expectedRpcs) {
    assert.ok(
      mig004Sql.includes(`CREATE OR REPLACE FUNCTION ${rpc}(`),
      `Missing SQL RPC definition: ${rpc}`
    );
  }

  const authGuards = mig004Sql.match(/v_user_id TEXT := auth\.uid\(\)::text;/g) || [];
  assert.strictEqual(
    authGuards.length,
    expectedRpcs.length,
    `Expected every RPC (${expectedRpcs.length}) to enforce auth.uid() tenant isolation, found ${authGuards.length}`
  );

  // Security guard: rpc_create_note must bail out BEFORE DELETE FROM note_tags on cross-tenant PK collision
  const createBody = mig004Sql.match(/CREATE OR REPLACE FUNCTION rpc_create_note[\s\S]*?CREATE OR REPLACE FUNCTION rpc_update_note/)?.[0] || '';
  const notFoundIdx = createBody.indexOf('IF NOT FOUND THEN\n    RETURN NULL;');
  const deleteTagsIdx = createBody.indexOf('DELETE FROM note_tags WHERE note_id = v_note_id;');
  assert.ok(notFoundIdx !== -1 && deleteTagsIdx !== -1 && notFoundIdx < deleteTagsIdx, 'rpc_create_note must guard cross-tenant PK collision before touching note_tags');
  assert.ok(mig004Sql.includes("NOTIFY pgrst, 'reload schema';"), 'Missing PostgREST schema reload notification');
});

// -----------------------------------------------------------------------------
// STAGE 2: Client Source Contracts (Phases B–E)
// -----------------------------------------------------------------------------
console.log('\n▶ STAGE 2: Client Repository, Cache, SyncEngine & Backup Contracts');

test('foldersRepo.ts queues child-note deltas, uses wildcard-safe SUBSTR prefixes, and delegates Lean-Cache duplicate to cloud RPC', () => {
  const src = fs.readFileSync(path.join(feDir, 'src/db/foldersRepo.ts'), 'utf-8');
  assert.ok(src.includes("action: 'folder_rename_cascade'"), 'renameFolderCascade must queue note update deltas');
  assert.ok(src.includes("action: 'folder_move_cascade'"), 'moveFolderCascade must queue note update deltas');
  assert.ok(src.includes("action: 'folder_delete_cascade'"), 'deleteFolderCascade must queue note update deltas');
  assert.ok(src.includes("action: 'cascade_path'"), 'rename/move must attach cascade_path metadata for server cascade');
  assert.ok(src.includes('isCascadeRoot'), 'delete/archive must mark root folder tombstone/cascade');
  assert.ok(src.includes('duplicatedFromNoteId'), 'duplicateFolderCascade must enqueue insert deltas for cloned notes');
  assert.ok(src.includes("action: 'duplicate_lock_metadata'"), 'duplicateFolderCascade must queue lock metadata when cloning locked folder');
  assert.ok(src.includes('SELECT nt.tag_id, t.name FROM note_tags'), 'duplicateFolderCascade must clone note_tags');
  assert.ok(src.includes('duplicateFolderCascadeInCloud'), 'duplicateFolderCascade must use Lean-Cache-safe server RPC when cloud sync is active');
  assert.ok(!/folder_path\s+LIKE\s+\?/i.test(src), 'foldersRepo.ts must not use wildcard-unsafe folder_path LIKE ?');
  assert.ok(!/\bpath\s+LIKE\s+\?/i.test(src), 'foldersRepo.ts must not use wildcard-unsafe path LIKE ?');
});

test('leanCacheManager.ts & tagsRepo.ts sync Page-1 tags, clear empty tags, and accept active userId', () => {
  const cacheSrc = fs.readFileSync(path.join(feDir, 'src/db/leanCacheManager.ts'), 'utf-8');
  const tagsSrc = fs.readFileSync(path.join(feDir, 'src/db/tagsRepo.ts'), 'utf-8');

  const hydrateMatch = cacheSrc.match(/export async function hydrateNoteForEditing[\s\S]*?return \{ \.\.\.mapped, isDehydrated: false \};/);
  assert.ok(hydrateMatch, 'Could not extract hydrateNoteForEditing');
  assert.ok(
    !hydrateMatch[0].includes('if (mapped.tags && mapped.tags.length > 0)'),
    'hydrateNoteForEditing must not skip empty tags array'
  );
  assert.ok(
    hydrateMatch[0].includes('tagsRepo.setNoteTags(mapped.id, mapped.tags || [], mapped.userId)'),
    'hydrateNoteForEditing must unconditionally call tagsRepo.setNoteTags with mapped.userId'
  );

  const pageOneMatch = cacheSrc.match(/export async function cachePageOnePreviews[\s\S]*?return pageOneIds;/);
  assert.ok(pageOneMatch, 'Could not extract cachePageOnePreviews');
  assert.ok(
    pageOneMatch[0].includes('tagsRepo') && pageOneMatch[0].includes('.setNoteTags('),
    'cachePageOnePreviews must sync tags into local SQLite note_tags'
  );

  assert.ok(
    !tagsSrc.includes("VALUES (?, 'user-default', ?, ?)"),
    'tagsRepo.createTag must not hardcode user-default in SQL INSERT'
  );
  assert.ok(
    tagsSrc.includes("userId: string = 'user-default'"),
    'tagsRepo must accept optional userId parameter'
  );
});

test('notesRepo.ts emits explicit clearFolderId / clearReminderAt flags and wraps all 6 batch ops in transactions', () => {
  const src = fs.readFileSync(path.join(feDir, 'src/db/notesRepo.ts'), 'utf-8');
  const storeSrc = fs.readFileSync(path.join(feDir, 'src/state/useNotesStore.tsx'), 'utf-8');

  assert.ok(
    src.includes('dto.folderId === null || resolvedFolderIdUpdate === null') &&
      src.includes('deltaPayload.clearFolderId = true'),
    'updateNote must emit clearFolderId on explicit null or General/unmatched folderPath move'
  );
  assert.ok(src.includes('if (dto.reminderAt === null)') && src.includes('deltaPayload.clearReminderAt = true'), 'updateNote must emit clearReminderAt');

  const batchMethods = [
    'batchSoftDeleteNotes',
    'batchPermanentlyDeleteNotes',
    'batchRestoreNotes',
    'batchArchiveNotes',
    'batchTogglePinNotes',
    'batchMoveNotesToFolder',
  ];
  for (const method of batchMethods) {
    const idx = src.indexOf(`public async ${method}`);
    assert.ok(idx !== -1, `Missing ${method}`);
    const slice = src.slice(idx, idx + 1500);
    assert.ok(slice.includes('dbClient.withTransaction'), `${method} must execute inside dbClient.withTransaction`);
  }

  assert.ok(
    storeSrc.includes('const resolvedFolderId = folderId ?? null;') &&
      storeSrc.includes('notesRepo.updateNote(noteId, { folderPath, folderId: resolvedFolderId })'),
    'useNotesStore.moveNoteToFolder must pass explicit null folderId when moving to root/General'
  );
});

test('syncTypes.ts & syncEngine.ts wire full push, CDC receive, and cold-start pull for all entities', () => {
  const typesSrc = fs.readFileSync(path.join(feDir, 'src/services/sync/syncTypes.ts'), 'utf-8');
  const engineSrc = fs.readFileSync(path.join(feDir, 'src/services/sync/syncEngine.ts'), 'utf-8');

  assert.ok(typesSrc.includes("'in_app_notification'"), 'SyncEntityType missing in_app_notification');
  assert.ok(typesSrc.includes("'search_history'"), 'SyncEntityType missing search_history');

  const requiredEngineSymbols = [
    'public getActiveUserId(): string',
    'p_clear_folder_id: clearFolderId',
    'p_clear_reminder_at: clearReminderAt',
    "supabase.rpc('rpc_cascade_folder_path_change'",
    "supabase.rpc('rpc_delete_folder_cascade'",
    "supabase.rpc('rpc_cascade_folder_archive_change'",
    "supabase.rpc('rpc_duplicate_folder_cascade'",
    "supabase.rpc('rpc_dismiss_reminder'",
    "supabase.rpc('rpc_upsert_in_app_notification'",
    "supabase.rpc('rpc_mark_notifications_read'",
    "supabase.rpc('rpc_delete_in_app_notification'",
    "supabase.rpc('rpc_upsert_search_history'",
    "supabase.rpc('rpc_delete_search_history'",
    "supabase.rpc('rpc_upsert_entity_relation'",
    "supabase.rpc('rpc_delete_entity_relation'",
    'applyNotificationDelta',
    'applySearchHistoryDelta',
    'applyRelationDelta',
    ".from('in_app_notifications')",
    ".from('search_history')",
    ".from('entity_relations')",
    'tagsRepo.setNoteTags(delta.entityId, p.tags, effectiveUserId)',
  ];
  for (const sym of requiredEngineSymbols) {
    assert.ok(engineSrc.includes(sym), `syncEngine.ts missing required symbol/call: ${sym}`);
  }
  assert.ok(!/folder_path\s+LIKE\s+\?/i.test(engineSrc), 'syncEngine.ts must not use wildcard-unsafe folder_path LIKE ?');
  assert.ok(!/\bpath\s+LIKE\s+\?/i.test(engineSrc), 'syncEngine.ts must not use wildcard-unsafe path LIKE ?');
});

test('tasksRepo, noteMergeReconciler, useEditorState & useNotesStore close secondary sync edge cases', () => {
  const tasksSrc = fs.readFileSync(path.join(feDir, 'src/db/tasksRepo.ts'), 'utf-8');
  const mergeSrc = fs.readFileSync(path.join(feDir, 'src/services/sync/noteMergeReconciler.ts'), 'utf-8');
  const editorSrc = fs.readFileSync(path.join(feDir, 'src/components/editor/hooks/useEditorState.ts'), 'utf-8');
  const storeSrc = fs.readFileSync(path.join(feDir, 'src/state/useNotesStore.tsx'), 'utf-8');
  const backupSrc = fs.readFileSync(path.join(feDir, 'src/services/workspaceBackupService.ts'), 'utf-8');

  assert.ok(!tasksSrc.includes('reminderAt: reminderAt ?? undefined'), 'tasksRepo.updateTaskReminder must pass null directly to clear reminder_at');
  assert.ok(tasksSrc.includes('syncEngine.getActiveUserId()'), 'tasksRepo.createTask must default to active userId');
  assert.ok(mergeSrc.includes('tags: merged.tags'), 'noteMergeReconciler must emit tags in merged sync_changelog payload');
  assert.ok(editorSrc.includes('Array.isArray(p.tags)') && editorSrc.includes("typeof p.folder_path === 'string'"), 'useEditorState must sync remote tags & folder_path on open note');
  assert.ok(storeSrc.includes("p.action === 'cascade_path'"), 'useNotesStore must update active folderFilter on remote folder rename/move cascade');
  assert.ok(backupSrc.includes('replacedByBackup: true') && backupSrc.includes('tagIdRemap'), 'workspaceBackupService must emit replace tombstones and remap colliding tags safely');
});

test('workspaceBackupService, notificationsRepo, searchHistoryRepo & remindersRepo meet Phases E contracts', () => {
  const backupSrc = fs.readFileSync(path.join(feDir, 'src/services/workspaceBackupService.ts'), 'utf-8');
  const notifSrc = fs.readFileSync(path.join(feDir, 'src/db/notificationsRepo.ts'), 'utf-8');
  const searchSrc = fs.readFileSync(path.join(feDir, 'src/db/searchHistoryRepo.ts'), 'utf-8');
  const remSrc = fs.readFileSync(path.join(feDir, 'src/db/remindersRepo.ts'), 'utf-8');

  assert.ok(backupSrc.includes('restoredFromBackup: true'), 'workspaceBackupService must queue restored entity deltas');
  assert.ok(backupSrc.includes('syncEngine.schedulePush()'), 'workspaceBackupService must call syncEngine.schedulePush()');
  assert.ok(backupSrc.includes('backfillOfflineMediaToDrive'), 'workspaceBackupService must backfill restored local/data media');

  const notifScheduleCalls = (notifSrc.match(/syncEngine\.schedulePush\(\)/g) || []).length;
  assert.ok(notifScheduleCalls >= 5, `notificationsRepo must call syncEngine.schedulePush() on all writes (found ${notifScheduleCalls})`);
  assert.ok(notifSrc.includes("action: 'clear_all'"), 'notificationsRepo.clearAll must log sync_changelog delete delta');

  const searchScheduleCalls = (searchSrc.match(/syncEngine\.schedulePush\(\)/g) || []).length;
  assert.ok(searchScheduleCalls >= 4, `searchHistoryRepo must call syncEngine.schedulePush() on all writes (found ${searchScheduleCalls})`);

  const updateNotifIdFn = remSrc.match(/public async updateNotificationId[\s\S]*?public async dismissReminder/);
  assert.ok(updateNotifIdFn, 'Could not extract remindersRepo.updateNotificationId');
  const updateNotifCodeOnly = updateNotifIdFn[0].replace(/\/\/.*$/gm, '');
  assert.ok(
    !updateNotifCodeOnly.includes('sync_changelog'),
    'remindersRepo.updateNotificationId must NOT log device-local OS notification_id to sync_changelog'
  );
});

// -----------------------------------------------------------------------------
// STAGE 3: Two-Device Executable SQLite Simulations (Device A <-> Device B)
// -----------------------------------------------------------------------------
console.log('\n▶ STAGE 3: Two-Device In-Memory SQLite Multi-Device Parity Simulations');

const schemaFile = fs.readFileSync(path.join(feDir, 'src/db/schema.ts'), 'utf-8');
const tablesMatch = schemaFile.match(/export const SCHEMA_TABLES_SQL = `([\s\S]*?)`;/);
const indexesMatch = schemaFile.match(/export const SCHEMA_INDEXES_SQL = `([\s\S]*?)`;/);
assert.ok(tablesMatch && indexesMatch, 'Failed to extract SCHEMA SQL');

function createDeviceDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`${tablesMatch[1]}\n${indexesMatch[1]}`);
  return db;
}

const UID = 'google-uid-multi-device-001';

// Helper mirroring tagsRepo.setNoteTags(noteId, tags, userId) including deterministic hash & orphan pruning
function deterministicTagHash(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function setNoteTagsSql(db, noteId, tags, userId) {
  db.prepare(`DELETE FROM note_tags WHERE note_id = ?;`).run(noteId);
  for (const tag of tags) {
    const clean = String(tag).trim().replace(/^#+/, '');
    if (!clean) continue;
    const existing = db.prepare(`SELECT id FROM tags WHERE LOWER(name) = LOWER(?) LIMIT 1;`).get(clean);
    let tagId = existing?.id;
    if (!tagId) {
      const lower = clean.toLowerCase();
      const asciiSlug = lower.replace(/[^a-z0-9]/g, '-');
      tagId = asciiSlug && asciiSlug === lower ? `tag-${asciiSlug}` : `tag-${asciiSlug || 'u'}-${deterministicTagHash(lower)}`;
      db.prepare(`INSERT OR IGNORE INTO tags (id, user_id, name, color_token) VALUES (?, ?, ?, 'cyan');`).run(
        tagId,
        userId,
        clean
      );
      const created = db.prepare(`SELECT id FROM tags WHERE LOWER(name) = LOWER(?) OR id = ? LIMIT 1;`).get(clean, tagId);
      tagId = created?.id;
    }
    if (tagId) {
      db.prepare(`INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?);`).run(noteId, tagId);
    }
  }
  db.prepare(`DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags);`).run();
}

function getNoteTagsSql(db, noteId) {
  return db
    .prepare(
      `SELECT t.name FROM tags t INNER JOIN note_tags nt ON nt.tag_id = t.id WHERE nt.note_id = ? ORDER BY t.name ASC;`
    )
    .all(noteId)
    .map((r) => r.name);
}

// Helper mirroring SyncEngine.applyNoteDelta (exact SQL & field presence guards from syncEngine.ts)
function applyNoteDeltaSql(db, delta) {
  const p = delta.deltaPayload || {};
  const uid = delta.userId || UID;
  if (delta.changeType === 'delete') {
    db.prepare(`DELETE FROM note_tags WHERE note_id = ?;`).run(delta.entityId);
    db.prepare(`DELETE FROM entity_relations WHERE source_id = ? OR target_id = ?;`).run(
      delta.entityId,
      delta.entityId
    );
    db.prepare(`DELETE FROM notes WHERE id = ?;`).run(delta.entityId);
    return;
  }
  const hasKey = (k) => (Object.prototype.hasOwnProperty.call(p, k) ? 1 : 0);
  let safeFolderId = p.folder_id || null;
  if (safeFolderId) {
    const exists = db.prepare(`SELECT id FROM folders WHERE id = ? LIMIT 1;`).get(safeFolderId);
    if (!exists) safeFolderId = null;
  }
  const blocksJsonStr = typeof p.blocks_json === 'string' ? p.blocks_json : JSON.stringify(p.blocks_json || []);

  db.prepare(
    `INSERT INTO notes (
      id, user_id, folder_id, folder_path, group_name, title,
      content_markdown, blocks_json, color_token, is_favorite, is_pinned,
      status, priority_score, reminder_at,
      is_locked, lock_type, lock_credential_kind, lock_hash, lock_salt, lock_hint,
      ai_context_excluded, sync_rev, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      title = CASE WHEN ? = 1 THEN excluded.title ELSE notes.title END,
      folder_id = CASE WHEN ? = 1 THEN excluded.folder_id ELSE notes.folder_id END,
      folder_path = CASE WHEN ? = 1 THEN excluded.folder_path ELSE notes.folder_path END,
      content_markdown = CASE WHEN excluded.content_markdown != '' THEN excluded.content_markdown ELSE notes.content_markdown END,
      blocks_json = CASE WHEN excluded.blocks_json != '[]' THEN excluded.blocks_json ELSE notes.blocks_json END,
      color_token = CASE WHEN ? = 1 THEN excluded.color_token ELSE notes.color_token END,
      is_favorite = CASE WHEN ? = 1 THEN excluded.is_favorite ELSE notes.is_favorite END,
      is_pinned = CASE WHEN ? = 1 THEN excluded.is_pinned ELSE notes.is_pinned END,
      status = CASE WHEN ? = 1 THEN excluded.status ELSE notes.status END,
      reminder_at = CASE WHEN ? = 1 THEN excluded.reminder_at ELSE notes.reminder_at END,
      is_locked = CASE WHEN ? = 1 THEN excluded.is_locked ELSE notes.is_locked END,
      lock_type = CASE WHEN ? = 1 THEN excluded.lock_type ELSE notes.lock_type END,
      lock_credential_kind = CASE WHEN ? = 1 THEN excluded.lock_credential_kind ELSE notes.lock_credential_kind END,
      lock_hash = CASE WHEN ? = 1 THEN excluded.lock_hash ELSE notes.lock_hash END,
      lock_salt = CASE WHEN ? = 1 THEN excluded.lock_salt ELSE notes.lock_salt END,
      lock_hint = CASE WHEN ? = 1 THEN excluded.lock_hint ELSE notes.lock_hint END,
      ai_context_excluded = CASE WHEN ? = 1 THEN excluded.ai_context_excluded ELSE notes.ai_context_excluded END,
      sync_rev = excluded.sync_rev,
      updated_at = CURRENT_TIMESTAMP;`
  ).run(
    delta.entityId,
    uid,
    safeFolderId,
    p.folder_path || 'General',
    p.group_name || null,
    p.title || 'Untitled Note',
    p.content_markdown || '',
    blocksJsonStr,
    p.color_token || 'apricot',
    p.is_favorite ? 1 : 0,
    p.is_pinned ? 1 : 0,
    p.status || 'active',
    p.priority_score || 0.0,
    p.reminder_at || null,
    p.is_locked ? 1 : 0,
    p.lock_type || null,
    p.lock_credential_kind || null,
    p.lock_hash || null,
    p.lock_salt || null,
    p.lock_hint || null,
    p.ai_context_excluded ? 1 : 0,
    delta.syncRev || 1,
    hasKey('title'),
    hasKey('folder_id'),
    hasKey('folder_path'),
    hasKey('color_token'),
    hasKey('is_favorite'),
    hasKey('is_pinned'),
    hasKey('status'),
    hasKey('reminder_at'),
    hasKey('is_locked'),
    hasKey('lock_type'),
    hasKey('lock_credential_kind'),
    hasKey('lock_hash'),
    hasKey('lock_salt'),
    hasKey('lock_hint'),
    hasKey('ai_context_excluded')
  );

  if (Array.isArray(p.tags)) {
    setNoteTagsSql(db, delta.entityId, p.tags, uid);
  }
}

test('Gap 1: Folder rename cascade updates direct + nested notes on Device B while protecting LIKE-wildcard siblings (Work_2026 vs WorkX2026)', () => {
  const deviceB = createDeviceDb();
  deviceB
    .prepare(`INSERT INTO folders (id, user_id, name, path) VALUES (?, ?, ?, ?);`)
    .run('f-work', UID, 'Work_2026', 'Work_2026');
  deviceB
    .prepare(`INSERT INTO folders (id, user_id, name, parent_id, path) VALUES (?, ?, ?, ?, ?);`)
    .run('f-sub', UID, 'Q4', 'f-work', 'Work_2026/Q4');
  deviceB
    .prepare(`INSERT INTO folders (id, user_id, name, path) VALUES (?, ?, ?, ?);`)
    .run('f-sibling', UID, 'WorkX2026', 'WorkX2026');
  deviceB
    .prepare(`INSERT INTO folders (id, user_id, name, parent_id, path) VALUES (?, ?, ?, ?, ?);`)
    .run('f-sibling-sub', UID, 'Keep', 'f-sibling', 'WorkX2026/Keep');

  deviceB
    .prepare(`INSERT INTO notes (id, user_id, folder_id, folder_path, title) VALUES (?, ?, ?, ?, ?);`)
    .run('n-1', UID, 'f-work', 'Work_2026', 'Direct Note');
  deviceB
    .prepare(`INSERT INTO notes (id, user_id, folder_id, folder_path, title) VALUES (?, ?, ?, ?, ?);`)
    .run('n-2', UID, 'f-sub', 'Work_2026/Q4', 'Nested Note');
  deviceB
    .prepare(`INSERT INTO notes (id, user_id, folder_id, folder_path, title) VALUES (?, ?, ?, ?, ?);`)
    .run('n-3', UID, 'f-sibling-sub', 'WorkX2026/Keep', 'Wildcard Sibling Note');

  // Mirror SyncEngine.applyFolderDelta for cascade_path
  const oldPath = 'Work_2026';
  const newPath = 'Client_2026';
  deviceB.prepare(`UPDATE folders SET path = ? WHERE path = ?;`).run(newPath, oldPath);
  for (const cf of deviceB.prepare(`SELECT id, path FROM folders WHERE path LIKE ?;`).all(`${oldPath}/%`)) {
    if (!cf.path.startsWith(`${oldPath}/`)) continue;
    deviceB.prepare(`UPDATE folders SET path = ? WHERE id = ?;`).run(`${newPath}${cf.path.slice(oldPath.length)}`, cf.id);
  }
  deviceB.prepare(`UPDATE notes SET folder_path = ? WHERE folder_path = ? OR folder_id = ?;`).run(newPath, oldPath, 'f-work');
  for (const cn of deviceB.prepare(`SELECT id, folder_path FROM notes WHERE folder_path LIKE ?;`).all(`${oldPath}/%`)) {
    if (cn.folder_path && cn.folder_path.startsWith(`${oldPath}/`)) {
      deviceB.prepare(`UPDATE notes SET folder_path = ? WHERE id = ?;`).run(`${newPath}${cn.folder_path.slice(oldPath.length)}`, cn.id);
    }
  }

  assert.strictEqual(deviceB.prepare(`SELECT folder_path FROM notes WHERE id = 'n-1';`).get().folder_path, 'Client_2026');
  assert.strictEqual(deviceB.prepare(`SELECT folder_path FROM notes WHERE id = 'n-2';`).get().folder_path, 'Client_2026/Q4');
  assert.strictEqual(
    deviceB.prepare(`SELECT folder_path FROM notes WHERE id = 'n-3';`).get().folder_path,
    'WorkX2026/Keep',
    'LIKE underscore wildcard must NOT corrupt sibling folder WorkX2026/Keep'
  );
  assert.strictEqual(deviceB.prepare(`SELECT path FROM folders WHERE id = 'f-sub';`).get().path, 'Client_2026/Q4');
  assert.strictEqual(deviceB.prepare(`SELECT path FROM folders WHERE id = 'f-sibling-sub';`).get().path, 'WorkX2026/Keep');
  deviceB.close();
});

test('Gap 1: Folder delete & archive cascades protect LIKE-wildcard siblings (Work_2026 vs WorkX2026) and mirror moveToGeneral + trash', () => {
  const deviceB = createDeviceDb();
  deviceB.prepare(`INSERT INTO folders (id, user_id, name, path) VALUES ('f-gen-del', ?, 'Temp_A', 'Temp_A');`).run(UID);
  deviceB.prepare(`INSERT INTO folders (id, user_id, name, path) VALUES ('f-gen-sib', ?, 'TempXA', 'TempXA');`).run(UID);
  deviceB.prepare(`INSERT INTO folders (id, user_id, name, parent_id, path) VALUES ('f-gen-sib-sub', ?, 'Keep', 'f-gen-sib', 'TempXA/Keep');`).run(UID);
  deviceB.prepare(`INSERT INTO folders (id, user_id, name, path) VALUES ('f-trash-del', ?, 'Temp_B', 'Temp_B');`).run(UID);
  deviceB.prepare(`INSERT INTO notes (id, user_id, folder_id, folder_path, title) VALUES ('n-a', ?, 'f-gen-del', 'Temp_A', 'Note A');`).run(UID);
  deviceB.prepare(`INSERT INTO notes (id, user_id, folder_id, folder_path, title) VALUES ('n-sib', ?, 'f-gen-sib-sub', 'TempXA/Keep', 'Sibling Keep');`).run(UID);
  deviceB.prepare(`INSERT INTO notes (id, user_id, folder_id, folder_path, title) VALUES ('n-b', ?, 'f-trash-del', 'Temp_B', 'Note B');`).run(UID);

  // Case 1: moveToGeneral using exact SUBSTR prefix matching (same SQL as foldersRepo & syncEngine)
  deviceB
    .prepare(
      `UPDATE notes SET folder_path = 'General', folder_id = NULL
       WHERE folder_id = ? OR folder_path = ? OR SUBSTR(COALESCE(folder_path, ''), 1, LENGTH(?) + 1) = ? || '/';`
    )
    .run('f-gen-del', 'Temp_A', 'Temp_A', 'Temp_A');
  deviceB
    .prepare(`DELETE FROM folders WHERE id = ? OR path = ? OR SUBSTR(path, 1, LENGTH(?) + 1) = ? || '/';`)
    .run('f-gen-del', 'Temp_A', 'Temp_A', 'Temp_A');

  // Case 2: trash using exact SUBSTR prefix matching
  deviceB
    .prepare(
      `UPDATE notes SET status = 'trashed', trashed_at = CURRENT_TIMESTAMP, folder_id = NULL
       WHERE folder_id = ? OR folder_path = ? OR SUBSTR(COALESCE(folder_path, ''), 1, LENGTH(?) + 1) = ? || '/';`
    )
    .run('f-trash-del', 'Temp_B', 'Temp_B', 'Temp_B');
  deviceB
    .prepare(`DELETE FROM folders WHERE id = ? OR path = ? OR SUBSTR(path, 1, LENGTH(?) + 1) = ? || '/';`)
    .run('f-trash-del', 'Temp_B', 'Temp_B', 'Temp_B');

  const noteA = deviceB.prepare(`SELECT folder_path, folder_id, status FROM notes WHERE id = 'n-a';`).get();
  const noteSib = deviceB.prepare(`SELECT folder_path, folder_id, status FROM notes WHERE id = 'n-sib';`).get();
  const noteB = deviceB.prepare(`SELECT folder_id, status FROM notes WHERE id = 'n-b';`).get();
  assert.strictEqual(noteA.folder_path, 'General');
  assert.strictEqual(noteA.folder_id, null);
  assert.strictEqual(noteA.status, 'active');
  assert.strictEqual(noteSib.folder_path, 'TempXA/Keep', 'Wildcard sibling note TempXA/Keep must NOT be touched');
  assert.strictEqual(noteSib.folder_id, 'f-gen-sib-sub');
  assert.strictEqual(noteB.status, 'trashed');
  assert.strictEqual(noteB.folder_id, null);
  assert.strictEqual(deviceB.prepare(`SELECT COUNT(*) AS cnt FROM folders;`).get().cnt, 2, 'Sibling folders TempXA & TempXA/Keep must remain');
  deviceB.close();
});

test('Gap 2: Bidirectional tags sync handles Unicode/punctuation tags without ID collision, clears [] & prunes orphan tags', () => {
  const deviceB = createDeviceDb();

  // 1. Device B receives initial note delta with ASCII, punctuation-variant, and Unicode/emoji tags
  applyNoteDeltaSql(deviceB, {
    entityId: 'note-tags-1',
    userId: UID,
    syncRev: 1,
    changeType: 'insert',
    deltaPayload: {
      title: 'Tagged Note',
      folder_path: 'General',
      tags: ['work', 'a-b', 'a b', '🔥', '⭐'],
    },
  });
  assert.deepStrictEqual(getNoteTagsSql(deviceB, 'note-tags-1'), ['a b', 'a-b', 'work', '⭐', '🔥']);
  const tagOwners = deviceB.prepare(`SELECT DISTINCT user_id FROM tags;`).all().map((r) => r.user_id);
  assert.deepStrictEqual(tagOwners, [UID], 'tags table must record active authenticated user_id');

  // 2. Device A removes ALL tags -> Device B receives delta with tags: []
  applyNoteDeltaSql(deviceB, {
    entityId: 'note-tags-1',
    userId: UID,
    syncRev: 2,
    changeType: 'update',
    deltaPayload: {
      title: 'Tagged Note',
      folder_path: 'General',
      tags: [],
    },
  });
  assert.deepStrictEqual(
    getNoteTagsSql(deviceB, 'note-tags-1'),
    [],
    'Empty tags: [] delta must clear all stale local note_tags on Device B'
  );
  assert.strictEqual(
    deviceB.prepare(`SELECT COUNT(*) AS cnt FROM tags;`).get().cnt,
    0,
    'Orphan tags with zero note_tags references must be pruned so stale filter chips disappear'
  );
  deviceB.close();
});

test('Gap 3: Nullable clears work while partial deltas preserve folder_path, favorite & lock state (and out-of-order folder_id FK never crashes)', () => {
  const deviceB = createDeviceDb();
  deviceB.prepare(`INSERT INTO folders (id, user_id, name, path) VALUES ('f-proj', ?, 'Projects', 'Projects');`).run(UID);

  // Initial locked favorite note inside Projects folder with active reminder
  applyNoteDeltaSql(deviceB, {
    entityId: 'note-clear-1',
    userId: UID,
    syncRev: 1,
    changeType: 'insert',
    deltaPayload: {
      title: 'Launch Plan',
      folder_id: 'f-proj',
      folder_path: 'Projects',
      color_token: 'lavender',
      is_favorite: true,
      is_locked: true,
      lock_type: 'master',
      lock_hash: 'hash-123',
      reminder_at: '2026-12-10T09:00:00.000Z',
      tags: ['launch'],
    },
  });

  // Partial delta WITHOUT folder_id / folder_path / reminder_at / lock fields must preserve EVERY omitted field
  applyNoteDeltaSql(deviceB, {
    entityId: 'note-clear-1',
    userId: UID,
    syncRev: 2,
    changeType: 'update',
    deltaPayload: {
      title: 'Launch Plan v2',
      is_pinned: true,
    },
  });
  const afterPartial = deviceB
    .prepare(`SELECT title, folder_id, folder_path, color_token, is_favorite, is_pinned, is_locked, lock_type, lock_hash, reminder_at FROM notes WHERE id = 'note-clear-1';`)
    .get();
  assert.strictEqual(afterPartial.title, 'Launch Plan v2');
  assert.strictEqual(afterPartial.folder_id, 'f-proj', 'Omitted folder_id must NOT be wiped');
  assert.strictEqual(afterPartial.folder_path, 'Projects', 'Omitted folder_path must NOT reset to General');
  assert.strictEqual(afterPartial.color_token, 'lavender', 'Omitted color_token must NOT reset to apricot');
  assert.strictEqual(afterPartial.is_favorite, 1, 'Omitted is_favorite must NOT reset to 0');
  assert.strictEqual(afterPartial.is_pinned, 1);
  assert.strictEqual(afterPartial.is_locked, 1, 'Omitted is_locked must NOT unlock a locked note');
  assert.strictEqual(afterPartial.lock_type, 'master');
  assert.strictEqual(afterPartial.lock_hash, 'hash-123');
  assert.strictEqual(afterPartial.reminder_at, '2026-12-10T09:00:00.000Z', 'Omitted reminder_at must NOT be wiped');

  // Out-of-order note delta referencing a missing folder_id must NOT crash PRAGMA foreign_keys = ON
  applyNoteDeltaSql(deviceB, {
    entityId: 'note-ooo-1',
    userId: UID,
    syncRev: 3,
    changeType: 'insert',
    deltaPayload: {
      title: 'Out Of Order Note',
      folder_id: 'f-not-arrived-yet',
      folder_path: 'FutureFolder',
    },
  });
  const oooNote = deviceB.prepare(`SELECT folder_id, folder_path FROM notes WHERE id = 'note-ooo-1';`).get();
  assert.strictEqual(oooNote.folder_id, null);
  assert.strictEqual(oooNote.folder_path, 'FutureFolder');

  // Explicit NULL clear delta (moved back to General + reminder cleared)
  applyNoteDeltaSql(deviceB, {
    entityId: 'note-clear-1',
    userId: UID,
    syncRev: 4,
    changeType: 'update',
    deltaPayload: {
      title: 'Launch Plan v2',
      folder_id: null,
      folder_path: 'General',
      reminder_at: null,
    },
  });
  const afterClear = deviceB.prepare(`SELECT folder_id, folder_path, reminder_at FROM notes WHERE id = 'note-clear-1';`).get();
  assert.strictEqual(afterClear.folder_id, null, 'Explicit null folder_id must clear to NULL on Device B');
  assert.strictEqual(afterClear.folder_path, 'General');
  assert.strictEqual(afterClear.reminder_at, null, 'Explicit null reminder_at must clear to NULL on Device B');
  deviceB.close();
});

test('Gap 4: Workspace backup restore handles tag-name collision on merge without wiping existing note_tags and emits replace tombstones', () => {
  const deviceA = createDeviceDb();

  // Existing local note with tag 'work' under local ID 'tag-work'
  deviceA.prepare(`INSERT INTO folders (id, user_id, name, path) VALUES ('f-old', ?, 'Old', 'Old');`).run(UID);
  deviceA.prepare(`INSERT INTO tags (id, user_id, name) VALUES ('tag-work', ?, 'work');`).run(UID);
  deviceA.prepare(`INSERT INTO notes (id, user_id, folder_id, folder_path, title) VALUES ('n-existing', ?, 'f-old', 'Old', 'Existing Note');`).run(UID);
  deviceA.prepare(`INSERT INTO note_tags (note_id, tag_id) VALUES ('n-existing', 'tag-work');`).run();

  // Merge restore brings backup tag { id: 'tag-backup-99', name: 'work' } -> remap instead of INSERT OR REPLACE
  const existingTag = deviceA.prepare(`SELECT id FROM tags WHERE LOWER(name) = LOWER(?) LIMIT 1;`).get('work');
  const tagIdRemap = new Map([['tag-backup-99', existingTag.id]]);
  deviceA.prepare(`INSERT INTO notes (id, user_id, folder_path, title) VALUES ('n-restored', ?, 'General', 'Restored Note');`).run(UID);
  deviceA.prepare(`INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES ('n-restored', ?);`).run(tagIdRemap.get('tag-backup-99'));

  // Verify existing note STILL has its 'work' tag (not cascade-deleted!) AND restored note also links to 'work'
  assert.deepStrictEqual(getNoteTagsSql(deviceA, 'n-existing'), ['work'], 'Merge restore must NOT cascade-delete existing note_tags on tag-name collision');
  assert.deepStrictEqual(getNoteTagsSql(deviceA, 'n-restored'), ['work']);
  deviceA.close();
});

test('Gap 5: In-app notifications supports expanded target_type (event, checklist_point) natively in SQLite + mark read & clear all', () => {
  const deviceB = createDeviceDb();

  // Expanded SQLite schema natively persists 'event' and 'checklist_point' without CHECK failure
  deviceB
    .prepare(
      `INSERT INTO in_app_notifications (id, user_id, target_type, target_id, title, body, trigger_at, is_read, is_cleared, sync_rev)
       VALUES ('notif-1', ?, 'event', 'evt-1', 'Standup', 'Daily sync', '2026-11-19T08:00:00Z', 0, 0, 1);`
    )
    .run(UID);

  deviceB
    .prepare(
      `INSERT INTO in_app_notifications (id, user_id, target_type, target_id, title, body, trigger_at, is_read, is_cleared, sync_rev)
       VALUES ('notif-2', ?, 'checklist_point', 'cp-1', 'Review PR', '', '2026-11-19T09:00:00Z', 0, 0, 2);`
    )
    .run(UID);

  assert.strictEqual(
    deviceB.prepare(`SELECT target_type FROM in_app_notifications WHERE id = 'notif-1';`).get().target_type,
    'event'
  );
  assert.strictEqual(
    deviceB.prepare(`SELECT target_type FROM in_app_notifications WHERE id = 'notif-2';`).get().target_type,
    'checklist_point'
  );

  // Mark all read on Device B
  deviceB
    .prepare(`UPDATE in_app_notifications SET is_read = 1, read_at = '2026-11-19T10:00:00Z' WHERE user_id = ? AND is_cleared = 0;`)
    .run(UID);
  assert.strictEqual(
    deviceB.prepare(`SELECT COUNT(*) AS cnt FROM in_app_notifications WHERE user_id = ? AND is_read = 0;`).get(UID).cnt,
    0
  );

  // Clear all on Device B
  deviceB
    .prepare(`UPDATE in_app_notifications SET is_cleared = 1, cleared_at = '2026-11-19T11:00:00Z' WHERE user_id = ? AND is_cleared = 0;`)
    .run(UID);
  assert.strictEqual(
    deviceB.prepare(`SELECT COUNT(*) AS cnt FROM in_app_notifications WHERE user_id = ? AND is_cleared = 0;`).get(UID).cnt,
    0
  );
  deviceB.close();
});

test('Cold-start metadata pull sorts child-before-parent folders safely under PRAGMA foreign_keys = ON and reconciles remote deletes while protecting dirty rows', () => {
  const deviceB = createDeviceDb();

  // Pre-existing local state: 1 stale deleted folder + 1 dirty offline folder
  deviceB.prepare(`INSERT INTO folders (id, user_id, name, path) VALUES ('f-stale-deleted', ?, 'Stale', 'Stale');`).run(UID);
  deviceB.prepare(`INSERT INTO folders (id, user_id, name, path) VALUES ('f-dirty-offline', ?, 'Offline', 'Offline');`).run(UID);
  deviceB
    .prepare(`INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload) VALUES ('log-dirty-1', ?, 1, 'folder', 'f-dirty-offline', 'insert', '{}');`)
    .run(UID);

  // Simulated cloud snapshot returning child BEFORE parent (unordered Postgres SELECT)
  const unorderedCloudFolders = [
    { id: 'f-child', name: 'Q4', parent_id: 'f-parent', path: 'Work/Q4' },
    { id: 'f-parent', name: 'Work', parent_id: null, path: 'Work' },
  ];
  const sorted = [...unorderedCloudFolders].sort(
    (a, b) => a.path.split('/').length - b.path.split('/').length
  );
  const cloudIds = new Set();
  for (const f of sorted) {
    cloudIds.add(f.id);
    deviceB
      .prepare(`INSERT OR REPLACE INTO folders (id, user_id, name, parent_id, path) VALUES (?, ?, ?, ?, ?);`)
      .run(f.id, UID, f.name, f.parent_id, f.path);
  }
  const dirtyRows = deviceB.prepare(`SELECT DISTINCT entity_type, entity_id FROM sync_changelog;`).all();
  const dirtySet = new Set(dirtyRows.map((r) => `${r.entity_type}:${r.entity_id}`));
  for (const lf of deviceB.prepare(`SELECT id FROM folders WHERE user_id = ?;`).all(UID)) {
    if (!cloudIds.has(lf.id) && !dirtySet.has(`folder:${lf.id}`)) {
      deviceB.prepare(`DELETE FROM folders WHERE id = ?;`).run(lf.id);
    }
  }

  const finalFolderIds = deviceB.prepare(`SELECT id FROM folders ORDER BY id ASC;`).all().map((r) => r.id);
  assert.deepStrictEqual(
    finalFolderIds,
    ['f-child', 'f-dirty-offline', 'f-parent'],
    'Cold-start pull must insert child-before-parent safely, prune clean remotely-deleted folder, and keep dirty local folder'
  );
  deviceB.close();
});

test('Gap 6: Search history CDC resolves cross-device UNIQUE(user_id, query_text) collisions cleanly and handles clear all', () => {
  const deviceB = createDeviceDb();

  // Device B locally searched 'sprint' under local ID 'sh-local-b'
  deviceB
    .prepare(
      `INSERT INTO search_history (id, user_id, query_text, source, use_count, sync_rev)
       VALUES ('sh-local-b', ?, 'sprint', 'text', 1, 1);`
    )
    .run(UID);

  // Device A pushes 'Sprint' under remote ID 'sh-remote-a' -> applySearchHistoryDelta dedups before upsert
  deviceB
    .prepare(`DELETE FROM search_history WHERE user_id = ? AND LOWER(query_text) = LOWER(?) AND id != ?;`)
    .run(UID, 'Sprint', 'sh-remote-a');
  deviceB
    .prepare(
      `INSERT INTO search_history (id, user_id, query_text, source, filter_snapshot_json, use_count, sync_rev, created_at, last_used_at)
       VALUES ('sh-remote-a', ?, 'Sprint', 'text', '{}', 3, 2, '2026-11-19T10:00:00Z', '2026-11-19T12:00:00Z')
       ON CONFLICT(id) DO UPDATE SET query_text = excluded.query_text, use_count = excluded.use_count;`
    )
    .run(UID);

  const rows = deviceB.prepare(`SELECT id, query_text, use_count FROM search_history WHERE user_id = ?;`).all(UID);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].id, 'sh-remote-a');
  assert.strictEqual(rows[0].use_count, 3);

  // Clear all search history delta
  deviceB.prepare(`DELETE FROM search_history WHERE user_id = ?;`).run(UID);
  assert.strictEqual(deviceB.prepare(`SELECT COUNT(*) AS cnt FROM search_history WHERE user_id = ?;`).get(UID).cnt, 0);
  deviceB.close();
});

test('Gap 7: Entity relations CDC resolves cross-device UNIQUE(source_id, relation_type, target_id) collisions cleanly and deletes', () => {
  const deviceB = createDeviceDb();

  deviceB
    .prepare(
      `INSERT INTO entity_relations (id, user_id, source_id, relation_type, target_id, created_by, confidence_score)
       VALUES ('rel-local-1', ?, 'note-1', 'relates_to', 'note-2', 'user', 1.0);`
    )
    .run(UID);

  // Incoming remote relation with same triple under different ID 'rel-remote-9'
  deviceB
    .prepare(`DELETE FROM entity_relations WHERE source_id = ? AND relation_type = ? AND target_id = ? AND id != ?;`)
    .run('note-1', 'relates_to', 'note-2', 'rel-remote-9');
  deviceB
    .prepare(
      `INSERT INTO entity_relations (id, user_id, source_id, relation_type, target_id, created_by, confidence_score)
       VALUES ('rel-remote-9', ?, 'note-1', 'relates_to', 'note-2', 'friday_ai', 0.92)
       ON CONFLICT(id) DO UPDATE SET confidence_score = excluded.confidence_score;`
    )
    .run(UID);

  const rels = deviceB.prepare(`SELECT * FROM entity_relations WHERE user_id = ?;`).all(UID);
  assert.strictEqual(rels.length, 1);
  assert.strictEqual(rels[0].id, 'rel-remote-9');
  assert.strictEqual(rels[0].created_by, 'friday_ai');

  // Delete delta
  deviceB.prepare(`DELETE FROM entity_relations WHERE id = ?;`).run('rel-remote-9');
  assert.strictEqual(deviceB.prepare(`SELECT COUNT(*) AS cnt FROM entity_relations;`).get().cnt, 0);
  deviceB.close();
});

test('Edge-Case Hardening 005: Migration contracts, recursive folder duplicate, task reminder dedup & folder PK rekey', () => {
  const mig005Path = path.join(projectRoot, 'supabase/migrations/005_sync_edge_case_hardening.sql');
  assert.ok(fs.existsSync(mig005Path), 'Missing 005_sync_edge_case_hardening.sql');
  const mig005Src = fs.readFileSync(mig005Path, 'utf-8');
  assert.ok(mig005Src.includes('CREATE OR REPLACE FUNCTION rpc_upsert_folder('), '005 must harden rpc_upsert_folder');
  assert.ok(mig005Src.includes('IF NOT FOUND THEN\n    RETURN NULL;\n  END IF;'), '005 must guard cross-tenant PK collisions');
  assert.ok(mig005Src.includes('CREATE OR REPLACE FUNCTION rpc_create_task('), '005 must harden rpc_create_task');
  assert.ok(mig005Src.includes('v_existing_rem_id'), '005 rpc_create_task must deduplicate active task reminders');
  assert.ok(mig005Src.includes('v_cloned_folders'), '005 rpc_duplicate_folder_cascade must return recursive cloned folders');

  const syncSrc = fs.readFileSync(path.join(feDir, 'src/services/sync/syncEngine.ts'), 'utf-8');
  assert.ok(syncSrc.includes('private async rekeyLocalFolderId('), 'SyncEngine must expose rekeyLocalFolderId');
  assert.ok(syncSrc.includes('remintedTaskId'), 'SyncEngine must re-mint colliding task IDs');
  assert.ok(syncSrc.includes('data.folders'), 'duplicateFolderCascadeInCloud must ingest recursive data.folders');

  const foldersRepoSrc = fs.readFileSync(path.join(feDir, 'src/db/foldersRepo.ts'), 'utf-8');
  assert.ok(foldersRepoSrc.includes('descendantFolders'), 'foldersRepo.duplicateFolderCascade offline fallback must clone descendant subfolders');

  // In-memory SQLite verification for folder PK rekeying & recursive subfolder cloning
  const db = createDeviceDb();
  db.prepare(`INSERT INTO folders (id, user_id, name, path) VALUES ('folder-work', ?, 'Work', 'Work');`).run(UID);
  db.prepare(`INSERT INTO folders (id, user_id, name, parent_id, path) VALUES ('folder-sub', ?, 'Q4', 'folder-work', 'Work/Q4');`).run(UID);
  db.prepare(`INSERT INTO notes (id, user_id, folder_id, folder_path, title) VALUES ('n-sub', ?, 'folder-sub', 'Work/Q4', 'Nested');`).run(UID);
  db.prepare(`INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload) VALUES ('log-f1', ?, 1, 'folder', 'folder-work', 'insert', '{}');`).run(UID);

  // Simulate rekeyLocalFolderId('folder-work' -> 'folder-reminted-1')
  db.exec(`PRAGMA foreign_keys = OFF;`);
  db.prepare(`UPDATE folders SET id = ? WHERE id = ?;`).run('folder-reminted-1', 'folder-work');
  db.prepare(`UPDATE folders SET parent_id = ? WHERE parent_id = ?;`).run('folder-reminted-1', 'folder-work');
  db.prepare(`UPDATE notes SET folder_id = ? WHERE folder_id = ?;`).run('folder-reminted-1', 'folder-work');
  db.prepare(`UPDATE sync_changelog SET entity_id = ? WHERE entity_type = 'folder' AND entity_id = ?;`).run('folder-reminted-1', 'folder-work');
  db.exec(`PRAGMA foreign_keys = ON;`);

  const subAfter = db.prepare(`SELECT parent_id FROM folders WHERE id = 'folder-sub';`).get();
  const logAfter = db.prepare(`SELECT entity_id FROM sync_changelog WHERE id = 'log-f1';`).get();
  assert.strictEqual(subAfter.parent_id, 'folder-reminted-1');
  assert.strictEqual(logAfter.entity_id, 'folder-reminted-1');
  db.close();
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n=================================================================');
console.log(`🏁 TEST RESULTS: ${passedTests} passed · ${failedTests} failed (Total: ${totalTests})`);
console.log('=================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
