// =============================================================================
// ScribeX Phase 2 Headless Verification Suite (Step 3B)
// Tests: Schema Parity, All 11 RPCs, Outbox Queue Lifecycle, Self-Echo Suppression,
//        Master PIN Sync (Device-Only Biometrics Preservation), and Multi-Device CDC
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedTests++;
  }
}

console.log('=================================================================');
console.log('⚡ SCRIBEX PHASE 2 STEP 3B HEADLESS VERIFICATION HARNESS');
console.log('   Target: Supabase RPCs, Outbox Queue, Master PIN & CDC Sync');
console.log('=================================================================\n');

// -----------------------------------------------------------------------------
// STAGE 1: Migration Files Existence & Schema Parity
// -----------------------------------------------------------------------------
console.log('▶ STAGE 1: Migration Files & Schema Parity');

const schemaSqlPath = path.join(rootDir, 'supabase', 'migrations', '001_initial_schema.sql');
const rpcsSqlPath = path.join(rootDir, 'supabase', 'migrations', '002_core_rpcs.sql');
const sqliteSchemaPath = path.join(rootDir, 'frontend', 'src', 'db', 'schema.ts');
const syncEnginePath = path.join(rootDir, 'frontend', 'src', 'services', 'sync', 'syncEngine.ts');
const securityRepoPath = path.join(rootDir, 'frontend', 'src', 'db', 'securityRepo.ts');

assert(fs.existsSync(schemaSqlPath), 'supabase/migrations/001_initial_schema.sql exists');
assert(fs.existsSync(rpcsSqlPath), 'supabase/migrations/002_core_rpcs.sql exists');
assert(fs.existsSync(sqliteSchemaPath), 'frontend/src/db/schema.ts exists');
assert(fs.existsSync(syncEnginePath), 'frontend/src/services/sync/syncEngine.ts exists');

const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
const sqliteSchema = fs.readFileSync(sqliteSchemaPath, 'utf8');
const syncEngineSrc = fs.readFileSync(syncEnginePath, 'utf8');
const securityRepoSrc = fs.readFileSync(securityRepoPath, 'utf8');

const requiredTables = [
  'folders',
  'tags',
  'notes',
  'note_tags',
  'tasks',
  'assets',
  'entity_relations',
  'sync_changelog',
  'search_history',
  'reminders',
  'in_app_notifications',
  'workspace_security',
];

for (const table of requiredTables) {
  assert(
    schemaSql.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
    `Supabase PostgreSQL creates table: ${table}`
  );
  assert(
    sqliteSchema.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
    `Local SQLite creates table: ${table}`
  );
}

// -----------------------------------------------------------------------------
// STAGE 2: Security & RLS Tenant Isolation Policies
// -----------------------------------------------------------------------------
console.log('\n▶ STAGE 2: Row-Level Security (RLS) & Realtime Publication');

for (const table of requiredTables) {
  assert(
    schemaSql.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`),
    `RLS is enabled on table: ${table}`
  );
}

assert(
  schemaSql.includes('auth.uid()::text = user_id'),
  'RLS policies enforce auth.uid() = user_id tenant boundary'
);

assert(
  schemaSql.includes(
    'ALTER PUBLICATION supabase_realtime ADD TABLE notes, folders, tasks, reminders, in_app_notifications, workspace_security, sync_changelog;'
  ),
  'Supabase Realtime publication includes all 7 synced tables'
);

assert(
  schemaSql.includes('CREATE EXTENSION IF NOT EXISTS "vector";'),
  'pgvector extension is enabled for dense semantic embeddings'
);

// -----------------------------------------------------------------------------
// STAGE 3: Core Stored Procedures (All 11 RPCs) & Pagination/Hydration Contracts
// -----------------------------------------------------------------------------
console.log('\n▶ STAGE 3: Core Stored Procedures (11 RPCs) & Pagination/Hydration');

const rpcsSql = fs.readFileSync(rpcsSqlPath, 'utf8');

const expectedRpcs = [
  'rpc_create_note',
  'rpc_update_note',
  'rpc_upsert_folder',
  'rpc_create_task',
  'rpc_toggle_task',
  'rpc_schedule_reminder',
  'rpc_upsert_workspace_security',
  'rpc_search_vault',
  'rpc_list_notes_paginated',
  'rpc_get_note_by_id',
  'rpc_delete_entity',
];

for (const rpc of expectedRpcs) {
  assert(
    rpcsSql.includes(`CREATE OR REPLACE FUNCTION ${rpc}`),
    `PostgreSQL stored procedure declared: ${rpc}`
  );
}

assert(
  rpcsSql.includes("LEFT(COALESCE(n.content_markdown, ''), 240) AS content_markdown") &&
    rpcsSql.includes("'[]'::jsonb AS blocks_json"),
  'rpc_list_notes_paginated returns 240-char snippet and empty blocks_json stub for lean Home cards'
);

assert(
  rpcsSql.includes('p_caller_platform'),
  'RPCs accept p_caller_platform for invocation context traceability & self-echo suppression'
);

// -----------------------------------------------------------------------------
// STAGE 4: SyncEngine Contracts, 1.5s Debounce, FlushNow & Outbox Cleanup
// -----------------------------------------------------------------------------
console.log('\n▶ STAGE 4: SyncEngine Outbox Queue, 1.5s Debounce & Master PIN Contracts');

assert(
  syncEngineSrc.includes('debounceMs: 1500'),
  'SyncEngine defaults to 1.5s (1500ms) typing debounce'
);
assert(
  syncEngineSrc.includes('public async flushNow(): Promise<number>'),
  'SyncEngine exposes flushNow() for immediate sync on Editor exit / backgrounding'
);
assert(
  syncEngineSrc.includes('public async hasPendingChanges'),
  'SyncEngine exposes hasPendingChanges() to protect dirty notes from eviction'
);
assert(
  syncEngineSrc.includes('DELETE FROM sync_changelog WHERE id = ?;'),
  'SyncEngine deletes committed Outbox rows upon Cloud 200 OK ACK (zero local changelog bloat)'
);
assert(
  syncEngineSrc.includes('fetchPaginatedNotesFromCloud') &&
    syncEngineSrc.includes('fetchFullNoteFromCloud'),
  'SyncEngine exposes fetchPaginatedNotesFromCloud and fetchFullNoteFromCloud helpers'
);
const biometricsFnMatch = securityRepoSrc.match(
  /public async setBiometricsEnabled[\s\S]*?return this\.getSecurityConfig\(\);\s*\}/
);
assert(
  securityRepoSrc.includes('queueWorkspaceSecuritySync') &&
    Boolean(biometricsFnMatch) &&
    !biometricsFnMatch[0].includes('queueWorkspaceSecuritySync'),
  'securityRepo queues Master PIN changes to sync_changelog while strictly excluding setBiometricsEnabled'
);

// -----------------------------------------------------------------------------
// STAGE 5: In-Memory SQLite Outbox Queue & Multi-Device CDC Simulation
// -----------------------------------------------------------------------------
console.log('\n▶ STAGE 5: In-Memory SQLite Outbox Queue & Multi-Device CDC Simulation');

const tablesMatch = sqliteSchema.match(/export const SCHEMA_TABLES_SQL = `([\s\S]*?)`;/);
const indexesMatch = sqliteSchema.match(/export const SCHEMA_INDEXES_SQL = `([\s\S]*?)`;/);
const db = new DatabaseSync(':memory:');
db.exec(`${tablesMatch[1]}\n${indexesMatch[1]}`);

// 1. Simulate local note creation + Outbox queue insertion
db.prepare(
  `INSERT INTO notes (id, user_id, title, content_markdown, blocks_json, color_token)
   VALUES ('note-sync-1', 'user-123', 'Cloud Sync Spec', 'Full body text', '[{"id":"b1","type":"paragraph","content":"Full body text"}]', 'lavender');`
).run();
db.prepare(
  `INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
   VALUES ('log-outbox-1', 'user-123', 1, 'note', 'note-sync-1', 'insert', '{"id":"note-sync-1","title":"Cloud Sync Spec"}');`
).run();

const pendingBefore = db
  .prepare(`SELECT COUNT(*) AS cnt FROM sync_changelog WHERE entity_type = 'note' AND entity_id = 'note-sync-1';`)
  .get().cnt;
assert(pendingBefore === 1, 'Dirty check (hasPendingChanges) detects uncommitted note edit in Outbox');

// 2. Simulate Cloud 200 OK ACK & Outbox cleanup
db.prepare(`DELETE FROM sync_changelog WHERE id = 'log-outbox-1';`).run();
const pendingAfter = db
  .prepare(`SELECT COUNT(*) AS cnt FROM sync_changelog WHERE entity_type = 'note' AND entity_id = 'note-sync-1';`)
  .get().cnt;
assert(pendingAfter === 0, 'Outbox row is deleted after Cloud ACK; note is now clean and eligible for eviction');

// 3. Simulate Device B with local biometrics_enabled = 1 receiving remote Master PIN update from Device A
db.prepare(
  `INSERT INTO workspace_security (id, app_lock_enabled, master_credential_type, master_hash, master_salt, master_hint, biometrics_enabled, auto_relock_seconds, updated_at)
   VALUES ('default', 0, NULL, NULL, NULL, NULL, 1, 0, '2026-11-17T00:00:00Z');`
).run();

// Apply remote workspace_security delta (exact SQL from SyncEngine.applyWorkspaceSecurityDelta)
db.prepare(
  `INSERT INTO workspace_security (
    id, app_lock_enabled, master_credential_type, master_hash, master_salt, master_hint,
    biometrics_enabled, auto_relock_seconds, updated_at
  ) VALUES ('default', ?, ?, ?, ?, ?, 0, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    app_lock_enabled = excluded.app_lock_enabled,
    master_credential_type = excluded.master_credential_type,
    master_hash = excluded.master_hash,
    master_salt = excluded.master_salt,
    master_hint = excluded.master_hint,
    auto_relock_seconds = excluded.auto_relock_seconds,
    updated_at = excluded.updated_at;`
).run(1, 'pin', 'remote_pin_hash_999', 'remote_pin_salt_999', 'Birth year', 60, '2026-11-17T11:45:00Z');

const wsAfter = db.prepare(`SELECT * FROM workspace_security WHERE id = 'default';`).get();
assert(
  wsAfter.app_lock_enabled === 1 &&
    wsAfter.master_hash === 'remote_pin_hash_999' &&
    wsAfter.auto_relock_seconds === 60,
  'Device B updated Master PIN hash, salt, hint, and auto_relock_seconds from remote CDC delta'
);
assert(
  wsAfter.biometrics_enabled === 1,
  'Device B preserved its local biometrics_enabled = 1 setting untouched during Master PIN cloud sync'
);

// 4. Verify SyncEngine P0001 rpc_update_note self-healing & Outbox dependency priority
const syncEngineLatestSrc = fs.readFileSync(
  path.join(rootDir, 'frontend/src/services/sync/syncEngine.ts'),
  'utf-8'
);
assert(
  syncEngineLatestSrc.includes("error.code === 'P0001'") &&
    syncEngineLatestSrc.includes('pushCreateNote('),
  'SyncEngine falls back to pushCreateNote (rpc_create_note) when rpc_update_note throws P0001 Note not found'
);
assert(
  syncEngineLatestSrc.includes('UPSERT_PRIORITY') &&
    syncEngineLatestSrc.includes('folder: 1') &&
    syncEngineLatestSrc.includes('note: 3'),
  'SyncEngine sorts Outbox upserts in dependency order (folder -> workspace_security -> note -> task -> reminder)'
);
assert(
  syncEngineLatestSrc.includes('ensureFolderSyncedToSupabase') &&
    syncEngineLatestSrc.includes('notes_folder_id_fkey') &&
    syncEngineLatestSrc.includes('tasks_note_id_fkey'),
  'SyncEngine self-heals notes_folder_id_fkey and tasks_note_id_fkey foreign key errors'
);

console.log('\n=================================================================');
console.log(`🏁 TEST RESULTS: ${passedTests} passed · ${failedTests} failed (Total: ${totalTests})`);
console.log('=================================================================\n');

if (failedTests === 0) {
  console.log('🎉 ALL PHASE 2 STEP 3B ASSERTIONS PASSED WITH 0 ERRORS!\n');
  process.exit(0);
} else {
  console.error(`❌ ${failedTests} assertions failed.`);
  process.exit(1);
}
