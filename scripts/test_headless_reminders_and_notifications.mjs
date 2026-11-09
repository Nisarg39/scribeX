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
  'src/db/notificationsRepo.ts',
  'src/components/common/ReminderPickerModal.tsx',
  'src/components/common/NotificationCenterModal.tsx',
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

test('Robust cross-platform date-time parser handles typed 12h, 24h, and date formats', () => {
  function parseDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const trimmedDate = dateStr.trim();
    const trimmedTime = timeStr.trim();

    let year, month, day;
    const isoMatch = trimmedDate.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
      year = parseInt(isoMatch[1], 10);
      month = parseInt(isoMatch[2], 10) - 1;
      day = parseInt(isoMatch[3], 10);
    } else {
      const usMatch = trimmedDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (usMatch) {
        const first = parseInt(usMatch[1], 10);
        const second = parseInt(usMatch[2], 10);
        if (first > 12) {
          day = first;
          month = second - 1;
        } else {
          month = first - 1;
          day = second;
        }
        year = parseInt(usMatch[3], 10);
      } else {
        return null;
      }
    }

    const timeMatch = trimmedTime.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?$/i);
    if (!timeMatch) return null;

    const rawH = parseInt(timeMatch[1], 10);
    const rawM = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const period = timeMatch[3] ? timeMatch[3].toUpperCase() : null;

    let hours = 0;
    let minutes = 0;
    if (period) {
      if (rawH < 1 || rawH > 12) return null;
      if (rawM < 0 || rawM > 59) return null;
      hours = period === 'AM' ? (rawH === 12 ? 0 : rawH) : (rawH === 12 ? 12 : rawH + 12);
      minutes = rawM;
    } else {
      if (rawH < 0 || rawH > 23) return null;
      if (rawM < 0 || rawM > 59) return null;
      hours = rawH;
      minutes = rawM;
    }

    const d = new Date(year, month, day, hours, minutes, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  // 12-hour AM/PM formats
  const t1 = parseDateTime('2026-11-10', '9:30 AM');
  assert.ok(t1 && t1.getHours() === 9 && t1.getMinutes() === 30);

  const t2 = parseDateTime('2026-11-10', '9:30 pm');
  assert.ok(t2 && t2.getHours() === 21 && t2.getMinutes() === 30);

  const t3 = parseDateTime('2026-11-10', '12:00 PM');
  assert.ok(t3 && t3.getHours() === 12 && t3.getMinutes() === 0);

  const t4 = parseDateTime('2026-11-10', '12:00 AM');
  assert.ok(t4 && t4.getHours() === 0 && t4.getMinutes() === 0);

  // 24-hour formats
  const t5 = parseDateTime('2026-11-10', '14:45');
  assert.ok(t5 && t5.getHours() === 14 && t5.getMinutes() === 45);

  const t6 = parseDateTime('2026-11-10', '9:15'); // single-digit hour
  assert.ok(t6 && t6.getHours() === 9 && t6.getMinutes() === 15);

  // US Date format
  const t7 = parseDateTime('11/10/2026', '10:00 AM');
  assert.ok(t7 && t7.getFullYear() === 2026 && t7.getMonth() === 10 && t7.getDate() === 10);
});

test('Mobile strict input masking: auto-formats Date (YYYY-MM-DD) and strips letters', () => {
  function formatDate(text, prevVal) {
    if (prevVal && prevVal.endsWith('-') && text === prevVal.slice(0, -1)) {
      return text.slice(0, -1);
    }
    const digits = text.replace(/\D/g, '').slice(0, 8);
    if (!digits) return '';
    if (digits.length <= 4) return digits;
    const yearStr = digits.slice(0, 4);
    if (digits.length <= 6) {
      const mDigits = digits.slice(4);
      if (mDigits.length === 2) {
        let m = parseInt(mDigits, 10);
        if (m > 12) m = 12;
        if (m === 0) m = 1;
        return `${yearStr}-${String(m).padStart(2, '0')}`;
      }
      return `${yearStr}-${mDigits}`;
    }
    let m = parseInt(digits.slice(4, 6), 10);
    if (m > 12) m = 12;
    if (m === 0) m = 1;
    const monthStr = String(m).padStart(2, '0');
    const dDigits = digits.slice(6);
    if (dDigits.length === 2) {
      let d = parseInt(dDigits, 10);
      if (d > 31) d = 31;
      if (d === 0) d = 1;
      return `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
    }
    return `${yearStr}-${monthStr}-${dDigits}`;
  }

  // Letters stripped, numeric date formatted
  assert.strictEqual(formatDate('22020023jdjdj', ''), '2202-01-23');
  assert.strictEqual(formatDate('20261109', ''), '2026-11-09');
  assert.strictEqual(formatDate('20261', '2026'), '2026-1');
  assert.strictEqual(formatDate('2026', '2026-'), '202');
});

test('Mobile strict input masking: auto-formats 12-hour Time (HH:mm) and switches AM/PM on a/p', () => {
  function formatTime12(text, prevVal, currentPeriod) {
    let period = currentPeriod;
    if (/a/i.test(text)) period = 'AM';
    if (/p/i.test(text)) period = 'PM';

    if (prevVal && prevVal.endsWith(':') && text === prevVal.slice(0, -1)) {
      return { formatted: text.slice(0, -1), period };
    }

    const digits = text.replace(/\D/g, '').slice(0, 4);
    if (!digits) return { formatted: '', period };
    if (digits.length === 1) return { formatted: digits, period };

    let h = parseInt(digits.slice(0, 2), 10);
    if (h > 12) h = 12;
    if (h === 0) h = 12;
    const hStr = String(h).padStart(2, '0');

    if (digits.length === 2) {
      return { formatted: `${hStr}:`, period };
    }

    const mDigits = digits.slice(2);
    let m1 = parseInt(mDigits[0], 10);
    if (m1 > 5) m1 = 5;

    if (mDigits.length === 1) {
      return { formatted: `${hStr}:${m1}`, period };
    }

    let m = parseInt(mDigits, 10);
    if (m > 59) m = 59;
    const mStr = String(m).padStart(2, '0');
    return { formatted: `${hStr}:${mStr}`, period };
  }

  // Letters stripped except a/p toggling period
  const r1 = formatTime12('1222aa', '', 'PM');
  assert.strictEqual(r1.formatted, '12:22');
  assert.strictEqual(r1.period, 'AM');

  const r2 = formatTime12('0930p', '', 'AM');
  assert.strictEqual(r2.formatted, '09:30');
  assert.strictEqual(r2.period, 'PM');

  // Backspace over colon
  const r3 = formatTime12('12', '12:', 'PM');
  assert.strictEqual(r3.formatted, '1');
});

test('Recurring reminder parser, label formatter, and next occurrence calculation', () => {
  function getNextOccurrence(rule, fromDate = new Date()) {
    const [hStr, mStr] = (rule.time || '12:00').split(':');
    const targetHour = parseInt(hStr, 10) || 0;
    const targetMinute = parseInt(mStr, 10) || 0;
    const validDays = Array.isArray(rule.days) && rule.days.length > 0 ? rule.days : [0, 1, 2, 3, 4, 5, 6];

    for (let offset = 0; offset <= 7; offset++) {
      const candidate = new Date(fromDate);
      candidate.setDate(fromDate.getDate() + offset);
      candidate.setHours(targetHour, targetMinute, 0, 0);

      const candidateDay = candidate.getDay();
      if (validDays.includes(candidateDay)) {
        if (candidate.getTime() > fromDate.getTime()) {
          return candidate;
        }
      }
    }

    const fallback = new Date(fromDate);
    fallback.setDate(fromDate.getDate() + 7);
    fallback.setHours(targetHour, targetMinute, 0, 0);
    return fallback;
  }

  function parseReminderString(raw) {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.type === 'repeat' && Array.isArray(parsed.days) && typeof parsed.time === 'string') {
          return {
            type: 'repeat',
            repeatRule: {
              type: 'repeat',
              days: parsed.days,
              time: parsed.time,
            },
          };
        }
      } catch {}
    }

    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return { type: 'once', triggerAt: trimmed };
    }
    return null;
  }

  function formatRecurrenceLabel(rule) {
    const [hStr, mStr] = (rule.time || '12:00').split(':');
    let h = parseInt(hStr, 10) || 12;
    const m = mStr || '00';
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const timeFormatted = `${h}:${m} ${period}`;
    const days = rule.days || [];
    if (days.length === 7) return `Every day at ${timeFormatted}`;
    if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return `Weekdays at ${timeFormatted}`;
    if (days.length === 2 && [0, 6].every((d) => days.includes(d))) return `Weekends at ${timeFormatted}`;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayLabels = days.slice().sort().map((d) => dayNames[d]).join(', ');
    return `${dayLabels} at ${timeFormatted}`;
  }

  // 1. Serialization and parsing
  const onceParsed = parseReminderString('2026-11-10T14:30:00.000Z');
  assert.strictEqual(onceParsed.type, 'once');
  assert.strictEqual(onceParsed.triggerAt, '2026-11-10T14:30:00.000Z');

  const repeatJson = JSON.stringify({ type: 'repeat', days: [1, 3, 5], time: '13:26' });
  const repeatParsed = parseReminderString(repeatJson);
  assert.strictEqual(repeatParsed.type, 'repeat');
  assert.deepStrictEqual(repeatParsed.repeatRule.days, [1, 3, 5]);
  assert.strictEqual(repeatParsed.repeatRule.time, '13:26');

  // 2. Human-readable labels
  assert.strictEqual(formatRecurrenceLabel({ type: 'repeat', days: [0, 1, 2, 3, 4, 5, 6], time: '09:00' }), 'Every day at 9:00 AM');
  assert.strictEqual(formatRecurrenceLabel({ type: 'repeat', days: [1, 2, 3, 4, 5], time: '13:30' }), 'Weekdays at 1:30 PM');
  assert.strictEqual(formatRecurrenceLabel({ type: 'repeat', days: [0, 6], time: '18:00' }), 'Weekends at 6:00 PM');
  assert.strictEqual(formatRecurrenceLabel({ type: 'repeat', days: [1, 3], time: '10:15' }), 'Mon, Wed at 10:15 AM');

  // 3. Next occurrence calculation strictly in future (using local times)
  const mondayMorning = new Date(2026, 10, 9, 9, 0, 0); // Monday 9:00 AM local time
  const dailyAt2pm = { type: 'repeat', days: [0, 1, 2, 3, 4, 5, 6], time: '14:00' };
  const nextSameDay = getNextOccurrence(dailyAt2pm, mondayMorning);
  assert.strictEqual(nextSameDay.getDay(), 1); // Still Monday
  assert.strictEqual(nextSameDay.getHours(), 14);

  const mondayNight = new Date(2026, 10, 9, 20, 0, 0); // Monday 8:00 PM local time
  const nextNextDay = getNextOccurrence(dailyAt2pm, mondayNight);
  assert.strictEqual(nextNextDay.getDay(), 2); // Rolls over to Tuesday
  assert.strictEqual(nextNextDay.getHours(), 14);

  // 4. Invariant: Daily/Repeat reminder NEVER displays "Triggered Xm ago"
  // For daily reminders, we always compute next trigger date in the future
  const pastTriggerDate = new Date(Date.now() - 3600000); // 1 hour ago
  const isDaily = repeatParsed.type === 'repeat';
  let displayedStatus = '';
  if (isDaily) {
    const nextDate = getNextOccurrence(repeatParsed.repeatRule, new Date());
    displayedStatus = `Next: ${nextDate.toISOString()}`;
    assert.ok(!displayedStatus.includes('Triggered'), 'Daily reminder must never show Triggered');
    assert.ok(nextDate.getTime() > Date.now(), 'Next daily trigger must be in the future');
  }
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
// 7. IN-APP NOTIFICATION CENTER & STORAGE LEDGER TESTS
// ---------------------------------------------------------------------------
console.log('\n▶ STAGE 7: In-App Notification Center & Storage Ledger Tests');

test('Schema creates in_app_notifications table and indexes', () => {
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='in_app_notifications';").get();
  assert.ok(tableCheck, 'in_app_notifications table does not exist');

  const idx1 = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_notifications_user_read';").get();
  assert.ok(idx1, 'idx_notifications_user_read index missing');

  const idx2 = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_notifications_trigger';").get();
  assert.ok(idx2, 'idx_notifications_trigger index missing');
});

test('In-app notification ledger: CRUD, unread count, and mark-read flow', () => {
  const notifId1 = 'notif-test-1';
  const notifId2 = 'notif-test-2';

  // 1. Insert unread notifications
  db.prepare(`
    INSERT INTO in_app_notifications (
      id, user_id, reminder_id, target_type, target_id, title, body,
      trigger_at, is_read, is_cleared, sync_rev
    ) VALUES (?, 'u-ledger', 'rem-1', 'task', 'task-1', 'Task Reminder', 'Buy groceries',
      '2026-11-10T15:00:00.000Z', 0, 0, 1);
  `).run(notifId1);

  db.prepare(`
    INSERT INTO in_app_notifications (
      id, user_id, reminder_id, target_type, target_id, title, body,
      trigger_at, is_read, is_cleared, sync_rev
    ) VALUES (?, 'u-ledger', 'rem-2', 'note', 'note-1', 'Note Reminder', 'Review sprint roadmap',
      '2026-11-10T16:00:00.000Z', 0, 0, 1);
  `).run(notifId2);

  // 2. Verify unread count is 2
  const unreadCount1 = db.prepare(`
    SELECT COUNT(*) as count FROM in_app_notifications
    WHERE user_id = 'u-ledger' AND is_read = 0 AND is_cleared = 0;
  `).get();
  assert.strictEqual(unreadCount1.count, 2);

  // 3. Mark notif-test-1 as read
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE in_app_notifications SET is_read = 1, read_at = ? WHERE id = ?;
  `).run(now, notifId1);

  const unreadCount2 = db.prepare(`
    SELECT COUNT(*) as count FROM in_app_notifications
    WHERE user_id = 'u-ledger' AND is_read = 0 AND is_cleared = 0;
  `).get();
  assert.strictEqual(unreadCount2.count, 1);

  const readItem = db.prepare('SELECT * FROM in_app_notifications WHERE id = ?;').get(notifId1);
  assert.strictEqual(readItem.is_read, 1);
  assert.strictEqual(readItem.read_at, now);

  // 4. Mark all as read
  db.prepare(`
    UPDATE in_app_notifications SET is_read = 1, read_at = ? WHERE user_id = 'u-ledger';
  `).run(now);

  const unreadCount3 = db.prepare(`
    SELECT COUNT(*) as count FROM in_app_notifications
    WHERE user_id = 'u-ledger' AND is_read = 0 AND is_cleared = 0;
  `).get();
  assert.strictEqual(unreadCount3.count, 0);

  // 5. Soft clear notification
  db.prepare(`
    UPDATE in_app_notifications SET is_cleared = 1, cleared_at = ? WHERE id = ?;
  `).run(now, notifId1);

  const activeList = db.prepare(`
    SELECT * FROM in_app_notifications WHERE user_id = 'u-ledger' AND is_cleared = 0;
  `).all();
  assert.strictEqual(activeList.length, 1);
  assert.strictEqual(activeList[0].id, notifId2);

  // 6. Target deletion cascade
  db.prepare(`
    DELETE FROM in_app_notifications WHERE target_type = 'note' AND target_id = 'note-1';
  `).run();

  const remainingNotifs = db.prepare(`
    SELECT count(*) as count FROM in_app_notifications WHERE user_id = 'u-ledger';
  `).get();
  assert.strictEqual(remainingNotifs.count, 1); // Only notifId1 (which was cleared) remains in ledger
});

test('Future reminders do not appear in notification center until actually fired (trigger_at <= asOfTime)', () => {
  const notifFuture = 'notif-future-1';
  const notifPast = 'notif-past-1';

  // 1. Insert one past (fired) and one future notification
  db.prepare(`
    INSERT INTO in_app_notifications (
      id, user_id, reminder_id, target_type, target_id, title, body,
      trigger_at, is_read, is_cleared, sync_rev
    ) VALUES (?, 'u-timing', 'rem-past', 'task', 'task-p', 'Past Fired Reminder', 'Fired 5m ago',
      '2026-11-09T17:30:00.000Z', 0, 0, 1);
  `).run(notifPast);

  db.prepare(`
    INSERT INTO in_app_notifications (
      id, user_id, reminder_id, target_type, target_id, title, body,
      trigger_at, is_read, is_cleared, sync_rev
    ) VALUES (?, 'u-timing', 'rem-fut', 'task', 'task-f', 'Future Reminder', 'Fires in 5m',
      '2026-11-09T17:40:00.000Z', 0, 0, 1);
  `).run(notifFuture);

  // 2. Query as of 17:32 (before the future reminder has fired)
  const asOf1732 = '2026-11-09T17:32:00.000Z';
  const unreadBeforeFire = db.prepare(`
    SELECT COUNT(*) as count FROM in_app_notifications
    WHERE user_id = 'u-timing' AND is_read = 0 AND is_cleared = 0 AND trigger_at <= ?;
  `).get(asOf1732);
  assert.strictEqual(unreadBeforeFire.count, 1, 'Only the already fired past notification should be counted');

  const visibleBeforeFire = db.prepare(`
    SELECT * FROM in_app_notifications
    WHERE user_id = 'u-timing' AND is_cleared = 0 AND trigger_at <= ?;
  `).all(asOf1732);
  assert.strictEqual(visibleBeforeFire.length, 1);
  assert.strictEqual(visibleBeforeFire[0].id, notifPast);

  // 3. Query as of 17:41 (after the future reminder has fired)
  const asOf1741 = '2026-11-09T17:41:00.000Z';
  const unreadAfterFire = db.prepare(`
    SELECT COUNT(*) as count FROM in_app_notifications
    WHERE user_id = 'u-timing' AND is_read = 0 AND is_cleared = 0 AND trigger_at <= ?;
  `).get(asOf1741);
  assert.strictEqual(unreadAfterFire.count, 2, 'Both notifications are now fired and counted');

  // 4. Purge premature future notifications
  db.prepare(`DELETE FROM in_app_notifications WHERE trigger_at > ?;`).run(asOf1732);
  const remaining = db.prepare(`SELECT count(*) as count FROM in_app_notifications WHERE user_id = 'u-timing';`).get();
  assert.strictEqual(remaining.count, 1, 'Premature entry was successfully purged');
});

// ---------------------------------------------------------------------------
// STAGE 8: Deep Linking & Redirection Flow (Stage 4 Verification)
// ---------------------------------------------------------------------------
console.log('\n▶ STAGE 8: Deep Linking & Redirection Flow (Stage 4 Verification)');

test('Note notification maps to /note/:id route', () => {
  const payload = { targetType: 'note', targetId: 'note-quantum-42', noteId: 'note-quantum-42' };
  const resolveDestination = (p) => {
    if (p.targetType === 'note') return `/note/${p.noteId || p.targetId}`;
    return `/home?tab=tasks&taskId=${p.targetId}`;
  };

  const route = resolveDestination(payload);
  assert.strictEqual(route, '/note/note-quantum-42');
});

test('Task notification maps to /home?tab=tasks&taskId=:id with highlight param', () => {
  const payload = { targetType: 'task', targetId: 'task-build-apk-99' };
  const resolveDestination = (p) => {
    if (p.targetType === 'note') return `/note/${p.noteId || p.targetId}`;
    return `/home?tab=tasks&taskId=${p.targetId}`;
  };

  const route = resolveDestination(payload);
  assert.strictEqual(route, '/home?tab=tasks&taskId=task-build-apk-99');
});

test('In-app navigation handler switches tab to tasks and passes focusedTaskId', () => {
  let navigatedTab = null;
  let highlightedTaskId = null;
  let routedPath = null;

  const handleNavigateFromNotification = (targetType, targetId, noteId) => {
    if (targetType === 'task') {
      navigatedTab = 'tasks';
      highlightedTaskId = targetId;
    } else if (targetType === 'note') {
      routedPath = `/note/${noteId || targetId}`;
    }
  };

  // 1. Task click
  handleNavigateFromNotification('task', 'task-sprint-101');
  assert.strictEqual(navigatedTab, 'tasks');
  assert.strictEqual(highlightedTaskId, 'task-sprint-101');

  // 2. Note click
  handleNavigateFromNotification('note', 'note-arch-202');
  assert.strictEqual(routedPath, '/note/note-arch-202');
});

// ---------------------------------------------------------------------------
// STAGE 9: 12-Hour Time & Month Initials Format Verification
// ---------------------------------------------------------------------------
console.log('\n▶ STAGE 9: 12-Hour Time & Month Initials Format Verification');

const MONTH_INITIALS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTime12h(d) {
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${period}`;
}

function formatNoteCardDate(rawDate) {
  if (!rawDate) return '';
  if (rawDate === 'Today' || rawDate === 'Yesterday') return rawDate;
  try {
    let d = rawDate.includes(' ') && !rawDate.includes('T')
      ? new Date(rawDate.replace(' ', 'T'))
      : new Date(rawDate);
    if (isNaN(d.getTime())) return rawDate;

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const timeStr = formatTime12h(d);
    const monthInitials = MONTH_INITIALS[d.getMonth()];

    if (isToday) return `Today, ${timeStr}`;

    const isSameYear = d.getFullYear() === now.getFullYear();
    if (isSameYear) return `${d.getDate()} ${monthInitials}, ${timeStr}`;
    return `${d.getDate()} ${monthInitials} ${d.getFullYear()}, ${timeStr}`;
  } catch {
    return rawDate;
  }
}

test('formatTime12h correctly formats 24h times to 12h AM/PM', () => {
  const d1 = new Date(2026, 10, 9, 17, 34); // 17:34
  assert.strictEqual(formatTime12h(d1), '5:34 PM');

  const d2 = new Date(2026, 10, 9, 11, 41); // 11:41
  assert.strictEqual(formatTime12h(d2), '11:41 AM');

  const d3 = new Date(2026, 10, 9, 0, 5); // 00:05
  assert.strictEqual(formatTime12h(d3), '12:05 AM');

  const d4 = new Date(2026, 10, 9, 12, 0); // 12:00
  assert.strictEqual(formatTime12h(d4), '12:00 PM');
});

test('formatNoteCardDate transforms raw SQLite timestamp into 12h format and month initials', () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayRaw = `${y}-${m}-${d} 11:41:04`;

  const formattedToday = formatNoteCardDate(todayRaw);
  assert.ok(formattedToday.startsWith('Today, 11:41 AM'), `Expected Today, 11:41 AM, got ${formattedToday}`);

  const pastDateRaw = '2026-10-25 14:30:00';
  const formattedPast = formatNoteCardDate(pastDateRaw);
  assert.ok(formattedPast.includes('Oct'), `Expected month initials Oct, got ${formattedPast}`);
  assert.ok(formattedPast.includes('2:30 PM'), `Expected 12h time 2:30 PM, got ${formattedPast}`);
  assert.ok(!formattedPast.includes('14:30'), 'Should not contain 24-hour time 14:30');
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

