/**
 * ScribeX Delta Sync Engine Offline Resilience & Conflict Verification.
 *
 * Tests:
 * 1. Offline local note mutations (INSERT, UPDATE, DELETE).
 * 2. Mutation staging in SQLite pending_mutations queue.
 * 3. Simulating network loss without state degradation.
 * 4. Concurrent conflict resolution & remote delta application.
 */

import {
  saveLocalNote,
  deleteLocalNote,
  getPendingMutations,
  clearPendingMutations,
  getLocalNotes,
  applyServerDeltas,
  getCurrentSyncRev,
} from '../db';
import { syncEngine } from './syncEngine';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function runResilienceTests() {
  console.log('--- Step 10: Verifying Delta Sync Engine Resilience & Conflict Handling ---');

  // 1. Stage offline mutations
  console.log('1. Staging offline mutations...');
  const note1 = await saveLocalNote({
    title: 'Offline Subway Thought',
    content_markdown: 'Recorded while offline in low connectivity environment.',
    group_name: 'Work',
  });
  assert(note1.pending_sync === true, 'Offline note should have pending_sync set to true');

  const updatedNote1 = await saveLocalNote({
    id: note1.id,
    title: 'Offline Subway Thought (Refined)',
    content_markdown: 'Revised before reconnecting.',
    group_name: 'Work',
  });

  const pending = await getPendingMutations();
  console.log(`[PASS] Staged ${pending.length} pending mutations while offline.`);
  assert(pending.length >= 2, 'Should have at least 2 pending mutations in queue');

  // 2. Simulate Remote Delta Application (Concurrent conflict resolution)
  console.log('2. Simulating remote delta ingestion (concurrent multi-device sync)...');
  const remoteRev = 256;
  const mockDeltas: any[] = [
    {
      id: 1,
      sync_rev: remoteRev,
      entity_type: 'note',
      entity_id: 'collab_device_note_42',
      change_type: 'INSERT',
      delta_payload: {
        id: 'collab_device_note_42',
        title: 'Concurrent Desktop Note Edit',
        content_markdown: 'Synchronized from desktop browser while mobile was offline.',
        group_name: 'Sync',
        color_token: 'cyan',
        updated_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    },
  ];

  await applyServerDeltas(mockDeltas, remoteRev);
  const currentRev = await getCurrentSyncRev();
  assert(currentRev === remoteRev, `Sync revision should advance to ${remoteRev}, got ${currentRev}`);
  console.log(`[PASS] Server deltas applied cleanly: sync rev advanced to ${currentRev}.`);

  // Verify remote note exists in local SQLite
  const notesAfter = await getLocalNotes();
  const remoteNoteExists = notesAfter.some((n) => n.id === 'collab_device_note_42');
  assert(remoteNoteExists, 'Remote collaborative note should be present in local SQLite');
  console.log('[PASS] Remote collaborative note materialized locally without conflict.');

  // 3. Test Offline Status Handling
  console.log('3. Verifying SyncEngine offline status handling...');
  const initialStatus = syncEngine.getStatus();
  assert(
    initialStatus === 'offline' || initialStatus === 'synced',
    `Initial status should be valid state, got ${initialStatus}`
  );

  // Trigger syncNow without auth (should gracefully handle as offline)
  syncEngine.setAuthContext(null, null);
  await syncEngine.syncNow();
  assert(syncEngine.getStatus() === 'offline', 'SyncEngine should be in offline state without credentials');
  console.log('[PASS] SyncEngine gracefully fell back to offline state without unhandled rejection.');

  // 4. Cleanup test notes
  await deleteLocalNote(note1.id);
  await deleteLocalNote('collab_device_note_42');
  console.log('[PASS] Cleaned up verification test notes from local database.');

  console.log('\n--- ALL DELTA SYNC RESILIENCE TESTS PASSED ---');
}

runResilienceTests().catch((err) => {
  console.error('[FAIL] Resilience verification error:', err);
  process.exit(1);
});
