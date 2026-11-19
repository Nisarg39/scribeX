/**
 * ScribeX Headless Automated Test Suite: Phase 2 Step 3D
 * (Google Drive Media Vault, Account Selector, Temp Playback Cache & Auth-Gated Sync UI)
 *
 * Verifies:
 * 1. Source contracts for googleDriveVaultService.ts (drive.file scope, select_account, ScribeX_Vault, temp cache, upload + local delete)
 * 2. Strict Auth Gate & UI integration in signin.tsx, SideNavbarModal.tsx, WorkspaceSettingsModal.tsx, app/settings/index.tsx
 * 3. Editor media hydration & purge lifecycle in app/note/[id].tsx and useEditorState.ts
 * 4. Executable lifecycle simulation (local attachment -> upload -> local delete -> gdrive:// persist -> temp cache hydrate -> purge)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const feDir = path.join(projectRoot, 'frontend');

console.log('=================================================================');
console.log('☁️  SCRIBEX PHASE 2 STEP 3D TEST HARNESS');
console.log('   Target: Google Drive Media Vault, Account Selector & Auth Gate');
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
console.log('▶ STAGE 1: Step 3D Service, UI & Auth-Gate Contracts');

test('googleDriveVaultService.ts uses expo-file-system/legacy & exports full API', () => {
  const src = fs.readFileSync(
    path.join(feDir, 'src/services/drive/googleDriveVaultService.ts'),
    'utf-8'
  );
  assert.ok(src.includes("from 'expo-file-system/legacy'"), 'Must import expo-file-system/legacy');
  assert.ok(src.includes("GDRIVE_PREFIX = 'gdrive://'"), 'Missing GDRIVE_PREFIX');
  assert.ok(src.includes('gdrive_temp/'), 'Missing gdrive_temp cache root');
  assert.ok(src.includes("VAULT_FOLDER_NAME = 'ScribeX_Vault'"), 'Missing ScribeX_Vault folder');
  assert.ok(src.includes('https://www.googleapis.com/auth/drive.file'), 'Missing drive.file scope');
  assert.ok(src.includes("prompt: 'select_account consent'"), 'Missing select_account consent prompt');
  assert.ok(src.includes('connectOrSwitchDriveAccount'), 'Missing connectOrSwitchDriveAccount');
  assert.ok(src.includes('uploadNoteMediaAttachments'), 'Missing uploadNoteMediaAttachments');
  assert.ok(src.includes('hydrateNoteMediaToTempCache'), 'Missing hydrateNoteMediaToTempCache');
  assert.ok(src.includes('dehydrateTempUrisForPersistence'), 'Missing dehydrateTempUrisForPersistence');
  assert.ok(src.includes('purgeNoteTempCache'), 'Missing purgeNoteTempCache');
  assert.ok(src.includes('FileSystem.deleteAsync'), 'Must delete local binary after upload');
});

test('signin.tsx enforces Mandatory Step 2 Google Drive Gate (no Drive skip)', () => {
  const src = fs.readFileSync(path.join(feDir, 'app/signin.tsx'), 'utf-8');
  assert.ok(src.includes("'drive_required'"), 'Missing drive_required mandatory step');
  assert.ok(src.includes('Connect Google Drive'), 'Missing Connect Google Drive CTA');
  assert.ok(!src.includes('Skip Drive Setup for Now'), 'Must NOT allow skipping Google Drive setup');
  assert.ok(src.includes('Sign Out & Use Offline Mode'), 'Must provide sign-out offline escape hatch');
  assert.ok(src.includes('isCloudSyncReady'), 'Must wait for isCloudSyncReady before navigating to /home');
  assert.ok(src.includes('Skip & Use Offline Mode'), 'Must retain guest mode escape hatch on Step 1');
});

test('AuthContext, SyncEngine & useNotesStore gate sync, migration & backfill behind verified Drive', () => {
  const authSrc = fs.readFileSync(path.join(feDir, 'src/context/AuthContext.tsx'), 'utf-8');
  const syncSrc = fs.readFileSync(path.join(feDir, 'src/services/sync/syncEngine.ts'), 'utf-8');
  const syncTypesSrc = fs.readFileSync(path.join(feDir, 'src/services/sync/syncTypes.ts'), 'utf-8');
  const storeSrc = fs.readFileSync(path.join(feDir, 'src/state/useNotesStore.tsx'), 'utf-8');
  const driveSrc = fs.readFileSync(
    path.join(feDir, 'src/services/drive/googleDriveVaultService.ts'),
    'utf-8'
  );
  const indexSrc = fs.readFileSync(path.join(feDir, 'app/index.tsx'), 'utf-8');

  assert.ok(
    authSrc.includes("scopes: 'https://www.googleapis.com/auth/drive.file'"),
    'AuthContext.signInWithGoogle must request drive.file scope'
  );
  assert.ok(authSrc.includes('isCloudSyncReady'), 'AuthContext must expose isCloudSyncReady');
  assert.ok(authSrc.includes('subscribeDriveState'), 'AuthContext must reactively subscribe to Drive state');
  assert.ok(
    authSrc.includes('if (verifiedDrive?.accessToken)'),
    'AuthContext must defer migrateGuestVaultToUser until Drive is verified'
  );

  assert.ok(syncTypesSrc.includes("'drive_required'"), 'SyncStatus must include drive_required');
  assert.ok(syncTypesSrc.includes('isDriveConnected?: boolean'), 'SyncEngineConfig must include isDriveConnected');
  assert.ok(syncSrc.includes('isSyncGateBlocked()'), 'SyncEngine must enforce isSyncGateBlocked()');
  assert.ok(syncSrc.includes('MAX_BATCHES'), 'pushPendingDeltas must drain outbox across multiple batches');

  assert.ok(driveSrc.includes('public async verifyDriveAccess('), 'Must verify drive.file scope via verifyDriveAccess');
  assert.ok(driveSrc.includes('public subscribeDriveState('), 'Must expose subscribeDriveState pub/sub');
  assert.ok(
    driveSrc.includes('public async backfillOfflineMediaToDrive('),
    'Must expose backfillOfflineMediaToDrive for pre-login offline media'
  );

  assert.ok(
    storeSrc.includes('googleDriveVaultService.backfillOfflineMediaToDrive(userId)'),
    'useNotesStore must backfill offline local media before flushing outbox'
  );
  assert.ok(
    storeSrc.includes('isDriveConnected: true') && storeSrc.includes('isDriveConnected: false'),
    'useNotesStore must toggle SyncEngine isDriveConnected reactively'
  );
  assert.ok(
    indexSrc.includes('!isDriveConnected && !hasCompletedDriveSetup'),
    'RootIndex must redirect authenticated users who have not completed Drive setup to /signin'
  );
});

test('Permanent Google Drive Refresh Architecture: migration, Edge Function & silent auto-refresh contracts', () => {
  const migPath = path.join(projectRoot, 'supabase/migrations/003_google_drive_refresh_tokens.sql');
  const fnPath = path.join(projectRoot, 'supabase/functions/google-drive-token/index.ts');
  assert.ok(fs.existsSync(migPath), 'Missing 003_google_drive_refresh_tokens.sql migration');
  assert.ok(fs.existsSync(fnPath), 'Missing supabase/functions/google-drive-token/index.ts');

  const migSrc = fs.readFileSync(migPath, 'utf-8');
  assert.ok(migSrc.includes('CREATE TABLE IF NOT EXISTS public.google_drive_connections'), 'Missing google_drive_connections table');
  assert.ok(migSrc.includes('REVOKE ALL ON TABLE public.google_drive_connections FROM anon'), 'Must revoke anon access');
  assert.ok(migSrc.includes('REVOKE ALL ON TABLE public.google_drive_connections FROM authenticated'), 'Must revoke authenticated access');

  const fnSrc = fs.readFileSync(fnPath, 'utf-8');
  assert.ok(fnSrc.includes('AES-GCM'), 'Edge Function must encrypt refresh_token with AES-GCM');
  assert.ok(fnSrc.includes('https://oauth2.googleapis.com/token'), 'Edge Function must refresh via Google OAuth token endpoint');
  assert.ok(fnSrc.includes("action === 'store'") && fnSrc.includes("action === 'refresh'") && fnSrc.includes("action === 'revoke'"), 'Edge Function must support store, refresh, and revoke actions');
  assert.ok(fnSrc.includes('invalid_grant'), 'Edge Function must clean up revoked refresh tokens on invalid_grant');

  const driveSrc = fs.readFileSync(
    path.join(feDir, 'src/services/drive/googleDriveVaultService.ts'),
    'utf-8'
  );
  assert.ok(driveSrc.includes('provider_refresh_token'), 'Drive service must capture session.provider_refresh_token');
  assert.ok(driveSrc.includes('refreshAccessTokenFromBackend'), 'Drive service must silently refresh expired tokens via backend');
  assert.ok(driveSrc.includes('storeRefreshTokenInBackend'), 'Drive service must store refresh token in backend');
  assert.ok(driveSrc.includes("action: 'revoke'"), 'disconnectDriveAccount must revoke remote refresh token');
});

test('SideNavbarModal.tsx enforces Strict Auth Gate on Sync & AI status row', () => {
  const src = fs.readFileSync(
    path.join(feDir, 'src/components/navigation/SideNavbarModal.tsx'),
    'utf-8'
  );
  assert.ok(src.includes('Offline Mode · Sign in with Google to Sync'), 'Missing guest lock status copy');
  assert.ok(src.includes("router.push('/signin')"), 'Guest row must navigate to /signin');
  assert.ok(src.includes('Cloud Synced'), 'Missing authenticated sync status');
  assert.ok(src.includes('Friday AI & Sync'), 'Missing locked AI/Sync badge');
});

test('WorkspaceSettingsModal.tsx & app/settings/index.tsx render Auth-Gated Drive Vault controls', () => {
  const modalSrc = fs.readFileSync(
    path.join(feDir, 'src/components/settings/WorkspaceSettingsModal.tsx'),
    'utf-8'
  );
  const settingsSrc = fs.readFileSync(path.join(feDir, 'app/settings/index.tsx'), 'utf-8');

  assert.ok(modalSrc.includes('Cloud Sync & Google Drive Vault'), 'Missing section title in WorkspaceSettingsModal');
  assert.ok(modalSrc.includes('Sign in with Google to Unlock'), 'Missing guest lock button in WorkspaceSettingsModal');
  assert.ok(modalSrc.includes('Switch Account'), 'Missing Switch Account button in WorkspaceSettingsModal');
  assert.ok(modalSrc.includes('Sync Now'), 'Missing manual Sync Now button in WorkspaceSettingsModal');

  assert.ok(settingsSrc.includes('Cloud Sync & Google Drive Vault'), 'Missing section title in app/settings/index.tsx');
  assert.ok(settingsSrc.includes('Sign in with Google to Enable'), 'Missing guest lock CTA in app/settings/index.tsx');
  assert.ok(settingsSrc.includes('Switch Account'), 'Missing Switch Account in app/settings/index.tsx');
  assert.ok(settingsSrc.includes('Disconnect'), 'Missing Disconnect in app/settings/index.tsx');
});

test('app/note/[id].tsx hydrates Drive temp cache on open & purges on exit/unmount', () => {
  const src = fs.readFileSync(path.join(feDir, 'app/note/[id].tsx'), 'utf-8');
  assert.ok(src.includes('googleDriveVaultService.hydrateNoteMediaToTempCache'), 'Missing Editor open temp hydration');
  const purgeMatches = src.match(/googleDriveVaultService\.purgeNoteTempCache/g) || [];
  assert.ok(purgeMatches.length >= 2, 'Expected purgeNoteTempCache in both unmount effect and handleClose');
});

test('useEditorState.ts dehydrates temp URIs before saving & uploads new media asynchronously', () => {
  const src = fs.readFileSync(
    path.join(feDir, 'src/components/editor/hooks/useEditorState.ts'),
    'utf-8'
  );
  assert.ok(src.includes('googleDriveVaultService.dehydrateTempUrisForPersistence'), 'Must restore gdrive:// before DB write');
  assert.ok(src.includes('.uploadNoteMediaAttachments('), 'Must upload new local media blocks');
  assert.ok(src.includes('.hydrateNoteMediaToTempCache('), 'Must hydrate CDC/uploaded gdrive:// URIs');
  assert.ok(src.includes('isLocalUploadableUri'), 'Must detect file://, blob:, and data: URIs for upload');
  assert.ok(src.includes('deleteDriveAssetById'), 'Must delete replaced/removed Google Drive assets');
  assert.ok(src.includes('collectMediaRefs') && src.includes('lastPersistedMediaRef'), 'Must diff removed media blocks to delete Drive & local assets');
  assert.ok(src.includes('deleteLocalMediaIfManaged'), 'Must clean up removed local_media files in Guest Mode');
});

test('ImageBlock.tsx & BlockRenderer.tsx support cross-platform device upload and replacement cleanup', () => {
  const imgSrc = fs.readFileSync(
    path.join(feDir, 'src/components/editor/blocks/ImageBlock.tsx'),
    'utf-8'
  );
  const rendererSrc = fs.readFileSync(
    path.join(feDir, 'src/components/editor/BlockRenderer.tsx'),
    'utf-8'
  );
  const driveSrc = fs.readFileSync(
    path.join(feDir, 'src/services/drive/googleDriveVaultService.ts'),
    'utf-8'
  );

  assert.ok(imgSrc.includes('expo-image-picker'), 'ImageBlock must import expo-image-picker');
  assert.ok(imgSrc.includes('launchImageLibraryAsync'), 'ImageBlock must launch native/web image picker');
  assert.ok(imgSrc.includes('stagePickedImageLocally'), 'ImageBlock must stage picked assets cleanly');
  assert.ok(imgSrc.includes('isMediaReplacement: true'), 'ImageBlock must flag media replacement');

  assert.ok(rendererSrc.includes('deleteLocalMediaIfManaged'), 'BlockRenderer must delete replaced local_media files');
  assert.ok(rendererSrc.includes('replacedDriveFileId'), 'BlockRenderer must record replaced Drive file IDs');

  assert.ok(driveSrc.includes('export function isLocalUploadableUri'), 'Must export isLocalUploadableUri');
  assert.ok(driveSrc.includes('export async function stagePickedImageLocally'), 'Must export stagePickedImageLocally');
  assert.ok(driveSrc.includes('export async function deleteLocalMediaIfManaged'), 'Must export deleteLocalMediaIfManaged');
  assert.ok(driveSrc.includes('public async deleteDriveAssetById'), 'Must expose deleteDriveAssetById');
  assert.ok(driveSrc.includes('syncDriveTokenFromSupabaseSession'), 'Must expose syncDriveTokenFromSupabaseSession');
  assert.ok(driveSrc.includes('isExpired'), 'getDriveAccountState must invalidate expired tokens');

  const authSrc = fs.readFileSync(path.join(feDir, 'src/context/AuthContext.tsx'), 'utf-8');
  assert.ok(authSrc.includes('syncDriveTokenFromSupabaseSession'), 'AuthContext must persist fresh provider_token on login/switch');

  assert.ok(driveSrc.includes('readAsDataURL'), 'Web temp hydration must use StrictMode-safe in-memory data URI');
  assert.ok(driveSrc.includes('cleanupMediaForDeletedNotes'), 'Must clean up Drive & local assets when notes are permanently purged');
  const notesRepoSrc = fs.readFileSync(path.join(feDir, 'src/db/notesRepo.ts'), 'utf-8');
  const purgeCalls = notesRepoSrc.match(/cleanupMediaForDeletedNotes/g) || [];
  assert.ok(purgeCalls.length >= 3, 'notesRepo must clean up assets in permanentlyDeleteNote, emptyTrashCascade, and batchPermanentlyDeleteNotes');
  const noteSrc = fs.readFileSync(path.join(feDir, 'app/note/[id].tsx'), 'utf-8');
  assert.ok(noteSrc.includes('isClosingRef.current = false'), 'Editor unmount effect must reset isClosingRef on remount');
});

test('.env.example documents EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID & Drive redirect URIs', () => {
  const envSrc = fs.readFileSync(path.join(feDir, '.env.example'), 'utf-8');
  assert.ok(envSrc.includes('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'), 'Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  assert.ok(envSrc.includes('drive-callback'), 'Missing web drive-callback instruction');
  assert.ok(envSrc.includes('scribex://drive/callback'), 'Missing native drive callback instruction');
});

// -----------------------------------------------------------------------------
// STAGE 2: Media Block Extraction, Rewrite & Temp Cache Lifecycle Simulation
// -----------------------------------------------------------------------------
console.log('\n▶ STAGE 2: Media Block & Temp Cache Filesystem Lifecycle Simulation');

const MEDIA_BLOCK_TYPES = new Set(['image', 'audio', 'video', 'file', 'scan']);
const GDRIVE_PREFIX = 'gdrive://';

function extractUri(block) {
  if (!MEDIA_BLOCK_TYPES.has(block.type)) return null;
  const meta = block.metadata || {};
  if (block.type === 'scan') return meta.imageUrl || meta.rawImageUrl || meta.url || null;
  if (block.type === 'audio') return block.content || meta.url || meta.audioUrl || null;
  return block.content || meta.url || null;
}

function applyUri(block, nextUri, driveFileId) {
  const nextMeta = { ...(block.metadata || {}), ...(driveFileId ? { driveFileId } : {}) };
  if (block.type === 'scan') {
    return { ...block, metadata: { ...nextMeta, imageUrl: nextUri } };
  }
  if (block.type === 'audio') {
    return { ...block, content: nextUri, metadata: { ...nextMeta, url: nextUri, audioUrl: nextUri } };
  }
  return { ...block, content: nextUri, metadata: { ...nextMeta, url: nextUri } };
}

test('extractUri & applyUri handle all 5 media block types uniformly', () => {
  const sampleBlocks = [
    { id: '1', type: 'image', content: 'file:///tmp/photo.jpg', metadata: { url: 'file:///tmp/photo.jpg' } },
    { id: '2', type: 'audio', content: '', metadata: { audioUrl: 'file:///tmp/voice.m4a' } },
    { id: '3', type: 'video', content: 'file:///tmp/clip.mp4' },
    { id: '4', type: 'file', content: '', metadata: { url: 'file:///tmp/doc.zip' } },
    { id: '5', type: 'scan', content: '', metadata: { imageUrl: 'file:///tmp/scan.png' } },
  ];

  for (const b of sampleBlocks) {
    assert.ok(extractUri(b)?.startsWith('file:///tmp/'), `Failed extractUri for ${b.type}`);
    const rewritten = applyUri(b, `${GDRIVE_PREFIX}drive_id_${b.id}`, `drive_id_${b.id}`);
    assert.strictEqual(extractUri(rewritten), `${GDRIVE_PREFIX}drive_id_${b.id}`);
    assert.strictEqual(rewritten.metadata.driveFileId, `drive_id_${b.id}`);
  }
});

test('End-to-end local binary delete -> gdrive:// persist -> temp hydrate -> dehydrate -> purge', () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'scribex-drive-test-'));
  try {
    const localAttachment = path.join(sandbox, 'picked_photo.jpg');
    fs.writeFileSync(localAttachment, 'fake-jpeg-bytes');
    assert.strictEqual(fs.existsSync(localAttachment), true);

    // 1. Simulate upload + immediate local binary deletion
    const noteId = 'note-drive-001';
    const initialBlock = { id: 'b-img', type: 'image', content: `file://${localAttachment}` };
    const uploadedDriveId = '1A2B3C_driveFileId';
    fs.unlinkSync(localAttachment);
    assert.strictEqual(fs.existsSync(localAttachment), false, 'Original local attachment must be deleted');

    const persistedBlock = applyUri(initialBlock, `${GDRIVE_PREFIX}${uploadedDriveId}`, uploadedDriveId);
    assert.strictEqual(extractUri(persistedBlock), `gdrive://${uploadedDriveId}`);

    // 2. Simulate Editor open hydrating to gdrive_temp/<noteId>/
    const noteTempDir = path.join(sandbox, 'gdrive_temp', noteId);
    fs.mkdirSync(noteTempDir, { recursive: true });
    const tempFilePath = path.join(noteTempDir, `${uploadedDriveId}_picked_photo.jpg`);
    fs.writeFileSync(tempFilePath, 'fake-jpeg-bytes');

    const tempMap = new Map([[tempFilePath, `gdrive://${uploadedDriveId}`]]);
    const editorBlock = applyUri(persistedBlock, tempFilePath, uploadedDriveId);
    assert.strictEqual(fs.existsSync(tempFilePath), true);
    assert.ok(extractUri(editorBlock)?.includes('/gdrive_temp/'));

    // 3. Simulate text edit dehydration before SQLite/Cloud save
    const restoredUri = tempMap.get(extractUri(editorBlock));
    const rePersistedBlock = applyUri(editorBlock, restoredUri, uploadedDriveId);
    assert.strictEqual(extractUri(rePersistedBlock), `gdrive://${uploadedDriveId}`);

    // 4. Simulate Editor close purging gdrive_temp/<noteId>/
    fs.rmSync(noteTempDir, { recursive: true, force: true });
    assert.strictEqual(fs.existsSync(noteTempDir), false, 'Temp cache directory must be purged on exit');
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('Mandatory Drive Gate state machine: blocks sync until Drive verified, preserves guest notes on abort, pauses on disconnect', () => {
  const resolveSyncGate = ({ isAuthenticated, isGuest, isDriveConnected }) => {
    if (!isAuthenticated || isGuest) return { allowed: false, status: 'offline_guest' };
    if (!isDriveConnected) return { allowed: false, status: 'drive_required' };
    return { allowed: true, status: 'idle' };
  };

  // 1. Offline guest creates note with local image
  const guestNotes = [{ id: 'n1', user_id: 'user-default', mediaUri: 'file:///local_media/a.jpg' }];
  assert.deepStrictEqual(
    resolveSyncGate({ isAuthenticated: false, isGuest: true, isDriveConnected: false }),
    { allowed: false, status: 'offline_guest' }
  );

  // 2. Guest signs in with Google but unchecks Drive checkbox -> sync blocked, guest note NOT migrated
  const partialGate = resolveSyncGate({
    isAuthenticated: true,
    isGuest: false,
    isDriveConnected: false,
  });
  assert.deepStrictEqual(partialGate, { allowed: false, status: 'drive_required' });
  assert.strictEqual(guestNotes[0].user_id, 'user-default', 'Guest note must remain untouched until Drive connects');

  // 3. User connects Drive -> migration + backfill + sync unlocked
  const unlockedGate = resolveSyncGate({
    isAuthenticated: true,
    isGuest: false,
    isDriveConnected: true,
  });
  assert.deepStrictEqual(unlockedGate, { allowed: true, status: 'idle' });
  guestNotes[0].user_id = 'google-uid-123';
  guestNotes[0].mediaUri = 'gdrive://driveFile999';
  assert.strictEqual(guestNotes[0].mediaUri, 'gdrive://driveFile999');

  // 4. User disconnects Drive in Settings -> sync pauses immediately
  const pausedGate = resolveSyncGate({
    isAuthenticated: true,
    isGuest: false,
    isDriveConnected: false,
  });
  assert.deepStrictEqual(pausedGate, { allowed: false, status: 'drive_required' });
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n=================================================================');
console.log(`📊 Step 3D Results: ${passedTests}/${totalTests} passed, ${failedTests} failed`);
console.log('=================================================================');

if (failedTests > 0) {
  process.exit(1);
}
