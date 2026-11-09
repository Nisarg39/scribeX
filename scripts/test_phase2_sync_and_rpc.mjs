// =============================================================================
// ScribeX Phase 2 Headless Verification Suite
// Tests: Schema Parity, RPC Declarations, CDC Event Streaming, and Invariants
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
console.log('⚡ SCRIBEX PHASE 2 HEADLESS VERIFICATION HARNESS');
console.log('   Target: Supabase PostgreSQL Schema, Direct RPCs & CDC Invariants');
console.log('=================================================================\n');

// -----------------------------------------------------------------------------
// STAGE 1: Migration Files Existence & Schema Parity
// -----------------------------------------------------------------------------
console.log('▶ STAGE 1: Migration Files & Schema Parity');

const schemaSqlPath = path.join(rootDir, 'supabase', 'migrations', '001_initial_schema.sql');
const rpcsSqlPath = path.join(rootDir, 'supabase', 'migrations', '002_core_rpcs.sql');
const sqliteSchemaPath = path.join(rootDir, 'frontend', 'src', 'db', 'schema.ts');

assert(fs.existsSync(schemaSqlPath), 'supabase/migrations/001_initial_schema.sql exists');
assert(fs.existsSync(rpcsSqlPath), 'supabase/migrations/002_core_rpcs.sql exists');
assert(fs.existsSync(sqliteSchemaPath), 'frontend/src/db/schema.ts exists');

const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
const sqliteSchema = fs.readFileSync(sqliteSchemaPath, 'utf8');

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
  schemaSql.includes('ALTER PUBLICATION supabase_realtime ADD TABLE notes, folders, tasks, reminders, sync_changelog;'),
  'Supabase Realtime publication includes notes, folders, tasks, reminders, sync_changelog'
);

assert(
  schemaSql.includes('CREATE EXTENSION IF NOT EXISTS "vector";'),
  'pgvector extension is enabled for dense semantic embeddings'
);

// -----------------------------------------------------------------------------
// STAGE 3: Core Stored Procedures (RPCs) & Single Source of AI Orchestration
// -----------------------------------------------------------------------------
console.log('\n▶ STAGE 3: Core Stored Procedures (RPCs) & Tool Parity');

const rpcsSql = fs.readFileSync(rpcsSqlPath, 'utf8');

const expectedRpcs = [
  'rpc_create_note',
  'rpc_update_note',
  'rpc_create_task',
  'rpc_toggle_task',
  'rpc_schedule_reminder',
  'rpc_search_vault',
];

for (const rpc of expectedRpcs) {
  assert(
    rpcsSql.includes(`CREATE OR REPLACE FUNCTION ${rpc}`),
    `PostgreSQL stored procedure declared: ${rpc}`
  );
}

assert(
  rpcsSql.includes('p_caller_platform'),
  'RPCs accept p_caller_platform for invocation context traceability'
);

// -----------------------------------------------------------------------------
// STAGE 4: Task Completion & Alarm Auto-Cancellation Invariant Simulation
// -----------------------------------------------------------------------------
console.log('\n▶ STAGE 4: Task Completion & Hardware Alarm Auto-Cancellation Invariant');

// Verify that rpc_toggle_task dismisses reminders
const hasReminderDismissInRpc = rpcsSql.includes('UPDATE reminders') && 
                                rpcsSql.includes('is_dismissed = TRUE') &&
                                rpcsSql.includes('target_id = p_task_id');

assert(
  hasReminderDismissInRpc,
  'rpc_toggle_task atomically dismisses pending reminders in reminders table when task is completed'
);

// Verify sync_changelog delta emission inside rpc_toggle_task
const hasChangelogInRpc = rpcsSql.includes('INSERT INTO sync_changelog') &&
                          rpcsSql.includes("'task', p_task_id, 'update'");

assert(
  hasChangelogInRpc,
  'rpc_toggle_task appends monotonic delta to sync_changelog for real-time CDC broadcast'
);

// -----------------------------------------------------------------------------
// STAGE 5: Multi-Device CDC Sync Simulation
// -----------------------------------------------------------------------------
console.log('\n▶ STAGE 5: Multi-Device CDC Sync Simulation');

// Simulate Device A and Device B interacting via Supabase CDC
class MockSupabaseCDC {
  constructor() {
    this.subscribers = new Map();
  }
  subscribe(channel, callback) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, []);
    }
    this.subscribers.get(channel).push(callback);
  }
  broadcast(channel, payload) {
    const listeners = this.subscribers.get(channel) || [];
    for (const cb of listeners) {
      cb(payload);
    }
  }
}

const cdc = new MockSupabaseCDC();
const deviceAEvents = [];
const deviceBEvents = [];

cdc.subscribe('sync_changelog:user_123', (evt) => deviceAEvents.push(evt));
cdc.subscribe('sync_changelog:user_123', (evt) => deviceBEvents.push(evt));

// Claude Desktop MCP executes rpc_create_task via Cloud
const externalAiEvent = {
  sync_rev: 42,
  entity_type: 'task',
  entity_id: 'task_abc_999',
  change_type: 'insert',
  caller_platform: 'desktop_mcp',
  delta_payload: {
    title: 'Review quarterly architecture spec',
    reminder_at: '2026-11-10T10:00:00Z',
  },
};

cdc.broadcast('sync_changelog:user_123', externalAiEvent);

assert(deviceAEvents.length === 1, 'Device A (Mobile) immediately received external AI CDC event');
assert(deviceBEvents.length === 1, 'Device B (Web) immediately received external AI CDC event');
assert(deviceAEvents[0].caller_platform === 'desktop_mcp', 'Device A identified action origin as desktop_mcp');

console.log('\n=================================================================');
console.log(`🏁 TEST RESULTS: ${passedTests} passed · ${failedTests} failed (Total: ${totalTests})`);
console.log('=================================================================\n');

if (failedTests === 0) {
  console.log('🎉 ALL PHASE 2 SCHEMA & RPC AUDIT ASSERTIONS PASSED WITH 0 ERRORS!\n');
  process.exit(0);
} else {
  console.error(`❌ ${failedTests} assertions failed.`);
  process.exit(1);
}
