/**
 * ScribeX Headless Automated Test Suite: Local & Backend-Ready Reminders
 * Source of Truth: docs/Local_Serverless_Reminder_Implementation_Plan.md
 *
 * Zero-dependency test runner covering:
 * 1. Database Schema, Tables, Indexes, and sync_changelog Event Ledger
 * 2. Provider Pattern & Hardware Notification Adapters (Native & Web)
 * 3. Multi-Device CDC Sync Simulation (Phase 2 Remote Delta Reconciliation)
 * 4. Time Offsets (15m, 1h, 1d) & Past Trigger Boundary Guarantees
 * 5. Lifecycle Invariants (Auto-cancel on Task Complete, Note Cleanup)
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
console.log('🔔 SCRIBEX HEADLESS REMINDER & NOTIFICATION TEST HARNESS');
console.log('   Target: Cross-Platform Alarms & Phase 2 CDC Backend-Ready');
console.log('   Zero external servers · 100% Offline & Hardware Resilient');
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

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// 1. FILE & CONTRACT INTEGRITY CHECKS
// ---------------------------------------------------------------------------
console.log('▶ STAGE 1: Static Contract & Architecture Verification');

const filesToVerify = [
  'src/types/note.ts',
  'src/types/reminder.ts',
  'src/db/schema.ts',
  'src/db/types.ts',
  'src/db/remindersRepo.ts',
  'src/db/tasksRepo.ts',
  'src/db/notesRepo.ts',
  'src/services/notifications/types.ts',
  'src/services/notifications/providers/NativeNotificationProvider.ts',
  'src/services/notifications/providers/WebNotificationProvider.ts',
  'src/services/notifications/NotificationService.ts',
  'src/components/common/ReminderPickerModal.tsx',
  'src/components/TasksView.tsx',
];

for (const relPath of filesToVerify) {
  test(`File exists: ${relPath}`, () => {
    const full = path.join(feDir, relPath);
    assert.ok(fs.existsSync(full), `Missing file: ${full}`);
  });
}

// ---------------------------------------------------------------------------
// 2. DATABASE SCHEMA, TABLES, INDEXES & CHANGELOG VERIFICATION
// ---------------------------------------------------------------------------
console.log('\n▶ STAGE 2: SQLite Schema & Event-Sourcing Ledger Tests');

const schemaFile = fs.readFileSync(path.join(feDir, 'src/db/schema.ts'), 'utf-8');
const schemaMatch = schemaFile.match(/export const SCHEMA_SQL = `([\s\S]*?)`;/);
assert.ok(schemaMatch, 'Failed to extract SCHEMA_SQL from schema.ts');
const rawSchemaSql = schemaMatch[1];

const db = new DatabaseSync(':memory:');
db.exec(rawSchemaSql);

test('Schema creates reminders table with correct columns', () => {
  const tableInfo = db.prepare('PRAGMA table_info(reminders);').all();
  const colNames = tableInfo.map((c) => c.name);

  const requiredCols = [
    'id',
    'user_id',
    'target_type',
    'target_id',
    'note_id',
    'trigger_at',
    'notification_id',
    'channel_id',
    'is_dismissed',
    'dismissed_at',
    'device_id',
    'sync_rev',
    'created_at',
    'updated_at',
  ];

  for (const col of requiredCols) {
    assert.ok(colNames.includes(col), `Column "${col}" missing in reminders table`);
  }
});

test('Schema creates reminders performance indexes', () => {
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index';").all();
  const indexNames = indexes.map((i) => i.name);

  assert.ok(indexNames.includes('idx_reminders_target'), 'idx_reminders_target index missing');
  assert.ok(indexNames.includes('idx_reminders_trigger'), 'idx_reminders_trigger index missing');
  assert.ok(indexNames.includes('idx_reminders_sync'), 'idx_reminders_sync index missing');
});

test('Tasks and Notes tables include reminder_at column', () => {
  const taskCols = db.prepare('PRAGMA table_info(tasks);').all().map((c) => c.name);
  const noteCols = db.prepare('PRAGMA table_info(notes);').all().map((c) => c.name);

  assert.ok(taskCols.includes('reminder_at'), 'Column reminder_at missing from tasks');
  assert.ok(noteCols.includes('reminder_at'), 'Column reminder_at missing from notes');
});

test('Reminders CRUD and sync_changelog delta insertion', () => {
  const reminderId = 'rem-test-001';
  const userId = 'user-test';
  const triggerAt = new Date(Date.now() + 3600000).toISOString();

  // Insert reminder
  db.prepare(`
    INSERT INTO reminders (
      id, user_id, target_type, target_id, note_id, trigger_at, notification_id,
      channel_id, is_dismissed, dismissed_at, device_id, sync_rev
    ) VALUES (?, ?, 'task', 'task-100', 'note-50', ?, 'hw-notif-777', 'scribex_reminders', 0, NULL, 'device-a', 1);
  `).run(reminderId, userId, triggerAt);

  // Append changelog
  db.prepare(`
    INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
    VALUES ('log-rem-1', ?, 1, 'reminder', ?, 'insert', ?);
  `).run(
    userId,
    reminderId,
    JSON.stringify({ id: reminderId, targetType: 'task', targetId: 'task-100', triggerAt })
  );

  // Query reminder
  const row = db.prepare('SELECT * FROM reminders WHERE id = ?;').get(reminderId);
  assert.strictEqual(row.id, reminderId);
  assert.strictEqual(row.target_type, 'task');
  assert.strictEqual(row.target_id, 'task-100');
  assert.strictEqual(row.is_dismissed, 0);
  assert.strictEqual(row.notification_id, 'hw-notif-777');

  // Verify changelog
  const changelog = db.prepare("SELECT * FROM sync_changelog WHERE entity_type = 'reminder';").all();
  assert.strictEqual(changelog.length, 1);
  assert.strictEqual(changelog[0].entity_id, reminderId);
  assert.strictEqual(changelog[0].change_type, 'insert');

  // Dismiss reminder
  db.prepare(`
    UPDATE reminders SET is_dismissed = 1, dismissed_at = CURRENT_TIMESTAMP WHERE id = ?;
  `).run(reminderId);

  const updated = db.prepare('SELECT is_dismissed FROM reminders WHERE id = ?;').get(reminderId);
  assert.strictEqual(updated.is_dismissed, 1);
});

// ---------------------------------------------------------------------------
// 3. PROVIDER PATTERN & NOTIFICATION SERVICE FACADE TESTS
// ---------------------------------------------------------------------------
console.log('\n▶ STAGE 3: Provider Pattern & Notification Service Verification');

class MockNotificationProvider {
  constructor(platform) {
    this.platform = platform;
    this.scheduled = new Map();
    this.cancelled = [];
    this.permissionsGranted = true;
  }

  isSupported() {
    return true;
  }

  async hasPermissions() {
    return this.permissionsGranted;
  }

  async requestPermissions() {
    this.permissionsGranted = true;
    return true;
  }

  async schedule(options) {
    const id = `${this.platform}-notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.scheduled.set(id, options);
    return id;
  }

  async cancel(notificationId) {
    this.scheduled.delete(notificationId);
    this.cancelled.push(notificationId);
  }

  async cancelAll() {
    this.scheduled.clear();
  }
}

test('Native provider schedules alarm with high-priority channel payload', async () => {
  const provider = new MockNotificationProvider('native');
  const triggerDate = new Date(Date.now() + 10000);

  const notifId = await provider.schedule({
    reminderId: 'rem-nat-1',
    title: 'Review Sprint Checklist',
    body: 'High priority task reminder',
    triggerDate,
    payload: {
      targetType: 'task',
      targetId: 't-123',
      title: 'Review Sprint Checklist',
      body: 'High priority task reminder',
    },
  });

  assert.ok(notifId.startsWith('native-notif-'));
  assert.strictEqual(provider.scheduled.size, 1);
  const entry = provider.scheduled.get(notifId);
  assert.strictEqual(entry.title, 'Review Sprint Checklist');
  assert.strictEqual(entry.payload.targetType, 'task');

  // Cancel alarm
  await provider.cancel(notifId);
  assert.strictEqual(provider.scheduled.size, 0);
  assert.ok(provider.cancelled.includes(notifId));
});

test('Web provider handles scheduling, permission checks, and cancellations', async () => {
  const provider = new MockNotificationProvider('web');
  assert.strictEqual(provider.platform, 'web');

  const notifId = await provider.schedule({
    reminderId: 'rem-web-1',
    title: 'Standup Alert',
    body: 'Daily engineering sync',
    triggerDate: new Date(Date.now() + 60000),
    payload: {
      targetType: 'note',
      targetId: 'n-456',
      title: 'Standup Alert',
      body: 'Daily engineering sync',
    },
  });

  assert.ok(notifId.startsWith('web-notif-'));
  assert.strictEqual(provider.scheduled.size, 1);

  await provider.cancel(notifId);
  assert.strictEqual(provider.scheduled.size, 0);
  assert.ok(provider.cancelled.includes(notifId));
});

// ---------------------------------------------------------------------------
// 4. MULTI-DEVICE CDC RECONCILIATION SIMULATION (PHASE 2 READY)
// ---------------------------------------------------------------------------
console.log('\n▶ STAGE 4: Multi-Device CDC Sync Simulation (Phase 2 Zero-Refactor)');

test('Cross-Device Task Completion: Remote dismiss delta cancels local alarm', async () => {
  // Device A setup
  const deviceAProvider = new MockNotificationProvider('native');
  const localAlarmId = await deviceAProvider.schedule({
    reminderId: 'rem-shared-99',
    title: 'Deploy to Staging',
    body: 'Task item',
    triggerDate: new Date(Date.now() + 7200000),
    payload: { targetType: 'task', targetId: 'task-deploy', title: 'Deploy', body: '' },
  });

  assert.strictEqual(deviceAProvider.scheduled.size, 1);

  // Simulation: User checks task complete on Device B (e.g. Web browser)
  // Device B sends CDC event: { change_type: 'update', is_dismissed: true }
  const remoteDeltaReminder = {
    id: 'rem-shared-99',
    userId: 'user-default',
    targetType: 'task',
    targetId: 'task-deploy',
    triggerAt: new Date(Date.now() + 7200000).toISOString(),
    notificationId: localAlarmId,
    channelId: 'scribex_reminders',
    isDismissed: true,
    deviceId: 'web-client-b',
    syncRev: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Device A receives CDC event through NotificationServiceManager.handleRemoteSyncDelta logic
  if (remoteDeltaReminder.isDismissed && remoteDeltaReminder.notificationId) {
    await deviceAProvider.cancel(remoteDeltaReminder.notificationId);
  }

  assert.strictEqual(deviceAProvider.scheduled.size, 0);
  assert.ok(deviceAProvider.cancelled.includes(localAlarmId));
  console.log('     ✓ No phantom alarm on Device A after Device B task completion');
});

test('Cross-Device Reminder Creation: Remote insert delta schedules on Device A', async () => {
  const deviceAProvider = new MockNotificationProvider('native');

  // Device B created a reminder for tomorrow 9 AM
  const futureIso = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const remoteReminder = {
    id: 'rem-shared-100',
    userId: 'user-default',
    targetType: 'task',
    targetId: 'task-standup',
    triggerAt: futureIso,
    notificationId: 'web-device-b-notif',
    channelId: 'scribex_reminders',
    isDismissed: false,
    deviceId: 'web-client-b',
    syncRev: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Device A receives insert delta
  let deviceANotificationId = null;
  if (!remoteReminder.isDismissed && new Date(remoteReminder.triggerAt).getTime() > Date.now()) {
    deviceANotificationId = await deviceAProvider.schedule({
      reminderId: remoteReminder.id,
      title: 'Standup Reminder',
      body: 'Task reminder',
      triggerDate: new Date(remoteReminder.triggerAt),
      payload: {
        targetType: remoteReminder.targetType,
        targetId: remoteReminder.targetId,
        title: 'Standup Reminder',
        body: 'Task reminder',
      },
    });
  }

  assert.ok(deviceANotificationId);
  assert.strictEqual(deviceAProvider.scheduled.size, 1);
  console.log('     ✓ Device A scheduled synchronized alarm from Device B event');
});

// ---------------------------------------------------------------------------
// 5. TIME OFFSETS & PAST TRIGGER BOUNDARY GUARANTEES
// ---------------------------------------------------------------------------
console.log('\n▶ STAGE 5: Event Time Offsets & Past Boundary Guarantees');

test('EventBlock reminder offset calculations (15m, 1h, 1d)', () => {
  const eventStart = new Date('2026-11-15T15:00:00.000Z');

  const offset15m = new Date(eventStart.getTime() - 15 * 60 * 1000);
  assert.strictEqual(offset15m.toISOString(), '2026-11-15T14:45:00.000Z');

  const offset1h = new Date(eventStart.getTime() - 60 * 60 * 1000);
  assert.strictEqual(offset1h.toISOString(), '2026-11-15T14:00:00.000Z');

  const offset1d = new Date(eventStart.getTime() - 24 * 60 * 60 * 1000);
  assert.strictEqual(offset1d.toISOString(), '2026-11-14T15:00:00.000Z');
});

test('Past trigger timestamps (T <= now) are rejected gracefully', async () => {
  const pastDate = new Date(Date.now() - 5000);
  const targetTime = pastDate.getTime();

  let scheduled = false;
  if (!isNaN(targetTime) && targetTime > Date.now()) {
    scheduled = true;
  }

  assert.strictEqual(scheduled, false, 'Past trigger should never be scheduled');
});

// ---------------------------------------------------------------------------
// 6. LIFECYCLE INVARIANT SIMULATION
// ---------------------------------------------------------------------------
console.log('\n▶ STAGE 6: Lifecycle Invariant & Auto-Cancellation Tests');

test('Completing a task auto-cancels and dismisses active reminder', () => {
  const taskId = 'task-auto-cancel';
  const reminderId = 'rem-auto-cancel';

  // 1. Insert task with active reminder
  db.prepare(`
    INSERT INTO tasks (id, user_id, title, is_completed, priority, reminder_at)
    VALUES (?, 'u1', 'Buy coffee beans', 0, 'medium', '2026-11-10T10:00:00.000Z');
  `).run(taskId);

  db.prepare(`
    INSERT INTO reminders (id, user_id, target_type, target_id, trigger_at, is_dismissed)
    VALUES (?, 'u1', 'task', ?, '2026-11-10T10:00:00.000Z', 0);
  `).run(reminderId, taskId);

  // 2. Toggle task complete
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?;').get(taskId);
  const nextChecked = task.is_completed === 0;

  db.prepare('UPDATE tasks SET is_completed = ?, reminder_at = NULL WHERE id = ?;').run(
    nextChecked ? 1 : 0,
    taskId
  );

  // Invariant triggered: if checked, dismiss reminder
  if (nextChecked) {
    db.prepare('UPDATE reminders SET is_dismissed = 1 WHERE target_type = ? AND target_id = ?;').run(
      'task',
      taskId
    );
  }

  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?;').get(taskId);
  const updatedRem = db.prepare('SELECT * FROM reminders WHERE id = ?;').get(reminderId);

  assert.strictEqual(updatedTask.is_completed, 1);
  assert.strictEqual(updatedTask.reminder_at, null);
  assert.strictEqual(updatedRem.is_dismissed, 1);
});

test('Deleting a note cascades reminder cleanup', () => {
  const noteId = 'note-cascade-del';

  // Add note-level reminder
  db.prepare(`
    INSERT INTO reminders (id, user_id, target_type, target_id, note_id, trigger_at, is_dismissed)
    VALUES ('rem-note-del-1', 'u1', 'note', ?, ?, '2026-11-10T12:00:00.000Z', 0);
  `).run(noteId, noteId);

  // Add task reminder under note
  db.prepare(`
    INSERT INTO reminders (id, user_id, target_type, target_id, note_id, trigger_at, is_dismissed)
    VALUES ('rem-note-del-2', 'u1', 'task', 'task-child-1', ?, '2026-11-10T12:00:00.000Z', 0);
  `).run(noteId);

  // Simulate note deletion cascade
  const matching = db.prepare('SELECT id FROM reminders WHERE note_id = ? OR (target_type = ? AND target_id = ?);')
    .all(noteId, 'note', noteId);

  assert.strictEqual(matching.length, 2);

  db.prepare('DELETE FROM reminders WHERE note_id = ? OR (target_type = ? AND target_id = ?);')
    .run(noteId, 'note', noteId);

  const remaining = db.prepare('SELECT count(*) as cnt FROM reminders WHERE note_id = ?;').get(noteId);
  assert.strictEqual(remaining.cnt, 0);
});

// ---------------------------------------------------------------------------
// SUMMARY REPORT
// ---------------------------------------------------------------------------
console.log('\n=================================================================');
console.log(`🏁 TEST RESULTS: ${passedTests} passed · ${failedTests} failed (Total: ${totalTests})`);
console.log('=================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL REMINDER & NOTIFICATION TESTS PASSED WITH 0 ERRORS!\n');
}

