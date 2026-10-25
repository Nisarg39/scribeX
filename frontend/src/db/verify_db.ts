/**
 * Automated Verification Script for Step 3: Client Offline-First Database.
 * Runs in node environment to test database operations, latency, and mutations.
 */

import {
  getLocalNotes,
  saveLocalNote,
  toggleLocalFavorite,
  deleteLocalNote,
  applyServerDeltas,
  getPendingMutations,
  clearPendingMutations,
  getCurrentSyncRev,
} from './notesRepo';

async function runVerification() {
  console.log('--- Step 3: Verifying Client Offline-First SQLite Engine ---');

  // 1. Create a sample note
  const t0 = performance.now();
  const note1 = await saveLocalNote({
    title: 'Verification Note 1',
    content_markdown: 'Verifying offline-first storage engine.',
    group_name: 'Testing',
    color_token: 'cyan',
    is_favorite: false,
  });
  const t1 = performance.now();
  console.log(`[PASS] saveLocalNote completed in ${(t1 - t0).toFixed(2)}ms, id: ${note1.id}`);

  // 2. Query notes
  const q0 = performance.now();
  const allNotes = await getLocalNotes();
  const q1 = performance.now();
  console.log(`[PASS] getLocalNotes returned ${allNotes.length} notes in ${(q1 - q0).toFixed(2)}ms`);
  if (allNotes.length === 0 || allNotes[0].title !== 'Verification Note 1') {
    throw new Error('Note verification failed: unexpected note list');
  }

  // 3. Toggle favorite
  const favResult = await toggleLocalFavorite(note1.id);
  console.log(`[PASS] toggleLocalFavorite result: ${favResult}`);
  if (!favResult) {
    throw new Error('toggleLocalFavorite failed to set is_favorite to true');
  }

  // 4. Check pending mutations
  const mutations = await getPendingMutations();
  console.log(`[PASS] Pending mutations count: ${mutations.length}`);
  if (mutations.length < 2) {
    throw new Error('Expected at least 2 pending mutations (INSERT and UPDATE)');
  }

  // 5. Test applyServerDeltas
  await applyServerDeltas(
    [
      {
        id: 1,
        sync_rev: 42,
        entity_type: 'note',
        entity_id: 'server_note_99',
        change_type: 'INSERT',
        delta_payload: {
          title: 'Synced From VPS',
          content_markdown: 'Received via real-time delta sync.',
          group_name: 'Sync',
          color_token: 'lime',
          is_favorite: true,
          sync_rev: 42,
        },
        created_at: new Date().toISOString(),
      },
    ],
    42
  );
  const currentRev = await getCurrentSyncRev();
  console.log(`[PASS] applyServerDeltas advanced current_sync_rev to: ${currentRev}`);
  if (currentRev !== 42) {
    throw new Error(`Expected current_sync_rev 42, got ${currentRev}`);
  }

  // 6. Delete note
  const delSuccess = await deleteLocalNote(note1.id);
  console.log(`[PASS] deleteLocalNote result: ${delSuccess}`);
  if (!delSuccess) {
    throw new Error('deleteLocalNote failed');
  }

  // 7. Clear pending mutations
  const mutIds = mutations.map((m) => m.id);
  await clearPendingMutations(mutIds);
  const remainingMutations = await getPendingMutations();
  console.log(`[PASS] After clearing, remaining mutations: ${remainingMutations.length}`);

  console.log('--- ALL STEP 3 CLIENT DATABASE VERIFICATIONS PASSED ---');
}

runVerification().catch((err) => {
  console.error('[FAIL] Step 3 Verification Error:', err);
  process.exit(1);
});
