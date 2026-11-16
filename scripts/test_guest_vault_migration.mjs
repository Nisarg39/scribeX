/**
 * ScribeX Headless Automated Test Suite: Phase 2 Step 2 (Google OAuth & Lossless Guest Vault Migration)
 * Source of Truth: docs/Unified_Backend_and_AI_Master_Specification.md (Section 3.1.1)
 *
 * Verifies:
 * 1. Static source contracts for supabaseClient.ts, vaultMigration.ts, AuthContext.tsx, and signin.tsx
 * 2. Atomic reassignment of all 10 user-scoped tables from 'user-default' -> auth.uid()
 * 3. Preservation of note/folder lock fields and ai_context_excluded privacy flags
 * 4. Queuing of missing 'insert' deltas into sync_changelog for cloud push
 * 5. Idempotency when re-run with 0 remaining 'user-default' rows
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const feDir = path.join(projectRoot, 'frontend');

console.log('=================================================================');
console.log('🔐 SCRIBEX PHASE 2 STEP 2 TEST HARNESS');
console.log('   Target: Supabase Client, Google OAuth Only & Guest Migration');
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

// ---------------------------------------------------------------------------
// STAGE 1: Static Contract & Architecture Verification
// ---------------------------------------------------------------------------
console.log('▶ STAGE 1: Source & Contract Verification');

const requiredFiles = [
  'src/services/supabase/supabaseClient.ts',
  'src/db/vaultMigration.ts',
  'src/context/AuthContext.tsx',
  'app/signin.tsx',
];

for (const relPath of requiredFiles) {
  test(`File exists: ${relPath}`, () => {
    const full = path.join(feDir, relPath);
    assert.ok(fs.existsSync(full), `Missing file: ${full}`);
  });
}

test('supabaseClient.ts exports supabase and isSupabaseConfigured with AsyncStorage', () => {
  const src = fs.readFileSync(path.join(feDir, 'src/services/supabase/supabaseClient.ts'), 'utf-8');
  assert.ok(src.includes('export const isSupabaseConfigured'), 'Missing isSupabaseConfigured export');
  assert.ok(src.includes('export const supabase'), 'Missing supabase export');
  assert.ok(src.includes('AsyncStorage'), 'Missing AsyncStorage persistence configuration');
  assert.ok(src.includes('EXPO_PUBLIC_SUPABASE_URL'), 'Missing EXPO_PUBLIC_SUPABASE_URL env read');
  assert.ok(src.includes('EXPO_PUBLIC_SUPABASE_ANON_KEY'), 'Missing EXPO_PUBLIC_SUPABASE_ANON_KEY env read');
});

test('vaultMigration.ts exports migrateGuestVaultToUser and covers all user tables', () => {
  const src = fs.readFileSync(path.join(feDir, 'src/db/vaultMigration.ts'), 'utf-8');
  assert.ok(src.includes('export async function migrateGuestVaultToUser'), 'Missing migrateGuestVaultToUser');
  assert.ok(src.includes('dbClient.withTransaction'), 'Migration must run inside dbClient.withTransaction');
  const expectedTables = [
    'folders',
    'notes',
    'tasks',
    'reminders',
    'tags',
    'assets',
    'entity_relations',
    'in_app_notifications',
    'search_history',
    'sync_changelog',
  ];
  for (const tbl of expectedTables) {
    assert.ok(src.includes(`UPDATE ${tbl}`) || src.includes(`UPDATE OR IGNORE ${tbl}`), `Missing table migration for ${tbl}`);
  }
});

test('AuthContext.tsx enforces Google OAuth exclusively and invokes migrateGuestVaultToUser', () => {
  const src = fs.readFileSync(path.join(feDir, 'src/context/AuthContext.tsx'), 'utf-8');
  assert.ok(src.includes("provider: 'google'"), 'Must authenticate via Google OAuth provider');
  assert.ok(src.includes('migrateGuestVaultToUser'), 'Must trigger lossless vault migration on sign-in');
  assert.ok(src.includes('onAuthStateChange'), 'Must subscribe to Supabase onAuthStateChange');
  assert.ok(src.includes('signInWithGoogle'), 'Must expose signInWithGoogle');
  assert.ok(src.includes("Linking.createURL('auth/callback')"), 'Must configure scribex://auth/callback deep link');
});

test('signin.tsx presents Google OAuth CTA and Offline Guest Skip with Strict Auth Gate note', () => {
  const src = fs.readFileSync(path.join(feDir, 'app/signin.tsx'), 'utf-8');
  assert.ok(src.includes('Continue with Google'), 'Missing Continue with Google CTA');
  assert.ok(src.includes('Skip & Use Offline Mode'), 'Missing Skip & Use Offline Mode CTA');
  assert.ok(src.includes('Cloud Sync and Friday AI require Google Sign-In'), 'Missing Strict Auth Gate caption');
});

// ---------------------------------------------------------------------------
// STAGE 2: SQLite Schema & In-Memory Vault Migration Execution
// ---------------------------------------------------------------------------
console.log('\n▶ STAGE 2: Lossless Guest Vault Migration Simulation');

const schemaFile = fs.readFileSync(path.join(feDir, 'src/db/schema.ts'), 'utf-8');
const tablesMatch = schemaFile.match(/export const SCHEMA_TABLES_SQL = `([\s\S]*?)`;/);
const indexesMatch = schemaFile.match(/export const SCHEMA_INDEXES_SQL = `([\s\S]*?)`;/);
assert.ok(tablesMatch && indexesMatch, 'Failed to extract SCHEMA_TABLES_SQL / SCHEMA_INDEXES_SQL');

const db = new DatabaseSync(':memory:');
db.exec(`${tablesMatch[1]}\n${indexesMatch[1]}`);

// Exact SQL execution mirroring frontend/src/db/vaultMigration.ts
function runMigrationSql(authenticatedUserId) {
  if (!authenticatedUserId || authenticatedUserId === 'user-default') {
    return { migratedNotes: 0, migratedFolders: 0, migratedTasks: 0, migratedReminders: 0, queuedSyncEntries: 0 };
  }

  db.exec('BEGIN');
  try {
    const foldersRes = db.prepare(`UPDATE folders SET user_id = ? WHERE user_id = 'user-default';`).run(authenticatedUserId);
    const notesRes = db.prepare(`UPDATE notes SET user_id = ? WHERE user_id = 'user-default';`).run(authenticatedUserId);
    const tasksRes = db.prepare(`UPDATE tasks SET user_id = ? WHERE user_id = 'user-default';`).run(authenticatedUserId);
    const remindersRes = db.prepare(`UPDATE reminders SET user_id = ? WHERE user_id = 'user-default';`).run(authenticatedUserId);

    db.prepare(`UPDATE tags SET user_id = ? WHERE user_id = 'user-default';`).run(authenticatedUserId);
    db.prepare(`UPDATE assets SET user_id = ? WHERE user_id = 'user-default';`).run(authenticatedUserId);
    db.prepare(`UPDATE entity_relations SET user_id = ? WHERE user_id = 'user-default';`).run(authenticatedUserId);
    db.prepare(`UPDATE in_app_notifications SET user_id = ? WHERE user_id = 'user-default';`).run(authenticatedUserId);
    db.prepare(`UPDATE OR IGNORE search_history SET user_id = ? WHERE user_id = 'user-default';`).run(authenticatedUserId);
    db.prepare(`DELETE FROM search_history WHERE user_id = 'user-default';`).run();
    db.prepare(`UPDATE sync_changelog SET user_id = ? WHERE user_id = 'user-default';`).run(authenticatedUserId);

    let queuedSyncEntries = 0;

    const foldersToQueue = db
      .prepare(
        `SELECT * FROM folders
         WHERE user_id = ?
           AND id NOT IN (
             SELECT entity_id FROM sync_changelog WHERE entity_type = 'folder' AND user_id = ?
           );`
      )
      .all(authenticatedUserId, authenticatedUserId);

    for (const folder of foldersToQueue) {
      const nextRev = Math.max(folder.sync_rev || 0, 1);
      db.prepare(
        `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, 'folder', ?, 'insert', ?);`
      ).run(
        `log-mig-folder-${folder.id}`,
        authenticatedUserId,
        nextRev,
        folder.id,
        JSON.stringify({ id: folder.id, name: folder.name, path: folder.path, ai_context_excluded: Boolean(folder.ai_context_excluded) })
      );
      queuedSyncEntries++;
    }

    const notesToQueue = db
      .prepare(
        `SELECT * FROM notes
         WHERE user_id = ?
           AND id NOT IN (
             SELECT entity_id FROM sync_changelog WHERE entity_type = 'note' AND user_id = ?
           );`
      )
      .all(authenticatedUserId, authenticatedUserId);

    for (const note of notesToQueue) {
      const nextRev = Math.max(note.sync_rev || 0, 1);
      db.prepare(
        `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, 'note', ?, 'insert', ?);`
      ).run(
        `log-mig-note-${note.id}`,
        authenticatedUserId,
        nextRev,
        note.id,
        JSON.stringify({ id: note.id, title: note.title, ai_context_excluded: Boolean(note.ai_context_excluded) })
      );
      queuedSyncEntries++;
    }

    db.exec('COMMIT');
    return {
      migratedNotes: Number(notesRes.changes),
      migratedFolders: Number(foldersRes.changes),
      migratedTasks: Number(tasksRes.changes),
      migratedReminders: Number(remindersRes.changes),
      queuedSyncEntries,
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Seed guest vault data under 'user-default'
db.prepare(
  `INSERT INTO folders (id, user_id, name, path, ai_context_excluded) VALUES
   ('folder-guest-1', 'user-default', 'Personal Journal', 'Personal Journal', 1),
   ('folder-guest-2', 'user-default', 'Work Notes', 'Work Notes', 0);`
).run();

db.prepare(
  `INSERT INTO notes (id, user_id, folder_id, folder_path, title, content_markdown, is_locked, lock_type, lock_credential_kind, lock_hash, lock_salt, ai_context_excluded) VALUES
   ('note-guest-1', 'user-default', 'folder-guest-1', 'Personal Journal', 'Private Entry', 'Secret diary', 1, 'master', 'pin', 'hash123', 'salt123', 1),
   ('note-guest-2', 'user-default', 'folder-guest-2', 'Work Notes', 'Sprint Plan', 'Deliver Phase 2', 0, NULL, NULL, NULL, NULL, 0),
   ('note-guest-3', 'user-default', NULL, 'General', 'Quick Idea', 'Offline thought', 0, NULL, NULL, NULL, NULL, 0);`
).run();

db.prepare(
  `INSERT INTO tasks (id, user_id, note_id, title, is_completed) VALUES
   ('task-guest-1', 'user-default', 'note-guest-2', 'Ship OAuth', 0),
   ('task-guest-2', 'user-default', 'note-guest-2', 'Verify SQLite parity', 1);`
).run();

db.prepare(
  `INSERT INTO reminders (id, user_id, target_type, target_id, note_id, trigger_at) VALUES
   ('rem-guest-1', 'user-default', 'task', 'task-guest-1', 'note-guest-2', '2026-12-01T10:00:00.000Z');`
).run();

db.prepare(`INSERT INTO tags (id, user_id, name) VALUES ('tag-guest-1', 'user-default', 'offline-tag');`).run();
db.prepare(
  `INSERT INTO in_app_notifications (id, user_id, target_type, target_id, title, body, trigger_at) VALUES
   ('notif-guest-1', 'user-default', 'task', 'task-guest-1', 'Task Due', 'Ship OAuth', '2026-12-01T10:00:00.000Z');`
).run();

const TARGET_UID = 'google-oauth-user-uuid-777';
const firstRunResult = runMigrationSql(TARGET_UID);

test('Migrates exact counts of folders, notes, tasks, and reminders from user-default', () => {
  assert.strictEqual(firstRunResult.migratedFolders, 2);
  assert.strictEqual(firstRunResult.migratedNotes, 3);
  assert.strictEqual(firstRunResult.migratedTasks, 2);
  assert.strictEqual(firstRunResult.migratedReminders, 1);
  assert.strictEqual(firstRunResult.queuedSyncEntries, 5); // 2 folders + 3 notes
});

test('Leaves 0 orphaned rows under user-default across all tables', () => {
  const tables = ['folders', 'notes', 'tasks', 'reminders', 'tags', 'in_app_notifications', 'sync_changelog'];
  for (const t of tables) {
    const row = db.prepare(`SELECT COUNT(*) AS cnt FROM ${t} WHERE user_id = 'user-default';`).get();
    assert.strictEqual(row.cnt, 0, `Table ${t} still has rows with user_id = 'user-default'`);
  }
});

test('All migrated rows belong to Google auth.uid() with lock and ai_context_excluded intact', () => {
  const lockedNote = db.prepare(`SELECT * FROM notes WHERE id = 'note-guest-1';`).get();
  assert.strictEqual(lockedNote.user_id, TARGET_UID);
  assert.strictEqual(lockedNote.is_locked, 1);
  assert.strictEqual(lockedNote.lock_hash, 'hash123');
  assert.strictEqual(lockedNote.ai_context_excluded, 1);

  const excludedFolder = db.prepare(`SELECT * FROM folders WHERE id = 'folder-guest-1';`).get();
  assert.strictEqual(excludedFolder.user_id, TARGET_UID);
  assert.strictEqual(excludedFolder.ai_context_excluded, 1);

  const tagRow = db.prepare(`SELECT * FROM tags WHERE id = 'tag-guest-1';`).get();
  assert.strictEqual(tagRow.user_id, TARGET_UID);

  const notifRow = db.prepare(`SELECT * FROM in_app_notifications WHERE id = 'notif-guest-1';`).get();
  assert.strictEqual(notifRow.user_id, TARGET_UID);
});

test('Queues insert delta records into sync_changelog under new user ID', () => {
  const logs = db
    .prepare(`SELECT * FROM sync_changelog WHERE user_id = ? AND change_type = 'insert';`)
    .all(TARGET_UID);
  assert.strictEqual(logs.length, 5);
  const noteLog = logs.find((l) => l.entity_id === 'note-guest-1');
  assert.ok(noteLog, 'Missing changelog entry for note-guest-1');
  const payload = JSON.parse(noteLog.delta_payload);
  assert.strictEqual(payload.ai_context_excluded, true);
});

test('Idempotency: re-running migration produces 0 changes and 0 duplicate changelog rows', () => {
  const secondRunResult = runMigrationSql(TARGET_UID);
  assert.strictEqual(secondRunResult.migratedFolders, 0);
  assert.strictEqual(secondRunResult.migratedNotes, 0);
  assert.strictEqual(secondRunResult.migratedTasks, 0);
  assert.strictEqual(secondRunResult.migratedReminders, 0);
  assert.strictEqual(secondRunResult.queuedSyncEntries, 0);

  const totalLogs = db.prepare(`SELECT COUNT(*) AS cnt FROM sync_changelog WHERE user_id = ?;`).get(TARGET_UID);
  assert.strictEqual(totalLogs.cnt, 5);
});

console.log('\n=================================================================');
console.log(`🏁 TEST RESULTS: ${passedTests} passed · ${failedTests} failed (Total: ${totalTests})`);
console.log('=================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
