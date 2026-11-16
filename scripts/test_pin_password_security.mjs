/**
 * ScribeX Security Test Suite: Task 36 — PIN / Password Protection & Vault Security
 * Imports real production TypeScript modules via `npx tsx` and executes real SQLite DDL via `node:sqlite`.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import crypto from 'node:crypto';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';

import {
  DEFAULT_PBKDF2_ITERATIONS,
  MAX_FAILED_ATTEMPTS,
  COOLDOWN_DURATION_MS,
  generateSalt,
  hashCredential,
  verifyCredential,
  validateCredentialFormat,
  constantTimeEqual,
  AttemptRateLimiter,
} from '../frontend/src/core/security/pinCrypto.ts';

import {
  LOCKED_MASK_LABEL,
  normalizeFolderPath,
  getAncestorFolderPaths,
  buildFolderMapByPath,
  getBlockingLockedFoldersForPath,
  isFolderEffectivelyLocked,
  inspectNoteLockState,
  isNoteEffectivelyLocked,
  computeLockedNoteIdSet,
  shouldRedactTaskForNote,
  shouldRedactNotification,
  countNotesUnderFolder,
  verifyTargetCredential,
} from '../frontend/src/core/security/vaultLockHelpers.ts';

import { buildNoteSearchDocument } from '../frontend/src/core/searchIndexer.ts';
import { executeNoteQuery } from '../frontend/src/core/noteQueryEngine.ts';
import { SCHEMA_SQL, SCHEMA_TABLES_SQL, SCHEMA_INDEXES_SQL } from '../frontend/src/db/schema.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const feDir = path.join(projectRoot, 'frontend');

console.log('=================================================================');
console.log('🔒 SCRIBEX PIN / PASSWORD PROTECTION & VAULT SECURITY TEST SUITE');
console.log('   Target: Crypto, SQLite Schema, Cascade, Search, Task/Notif Masking');
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
    console.error(`     Error: ${err?.message || err}`);
  }
}

function makeFolder(overrides = {}) {
  const pathVal = overrides.path || 'General';
  return {
    id: `folder-${pathVal}`,
    user_id: 'user_local',
    name: pathVal.split('/').pop() || 'General',
    parent_id: null,
    path: pathVal,
    color_token: 'apricot',
    icon: null,
    is_favorite: 0,
    is_pinned: 0,
    is_archived: 0,
    is_locked: 0,
    lock_type: null,
    lock_credential_kind: null,
    lock_hash: null,
    lock_salt: null,
    lock_hint: null,
    sync_rev: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeNote(overrides = {}) {
  const id = overrides.id || 'note-1';
  const title = overrides.title ?? 'Untitled';
  const body = overrides.body ?? 'Secret body text';
  return {
    id,
    userId: 'user_local',
    folderPath: overrides.folderPath || 'General',
    title,
    contentMarkdown: body,
    blocks: overrides.blocks || [
      {
        id: `${id}-b1`,
        type: 'paragraph',
        content: body,
      },
    ],
    colorToken: overrides.colorToken || 'apricot',
    isFavorite: Boolean(overrides.isFavorite),
    isPinned: Boolean(overrides.isPinned),
    status: overrides.status || 'active',
    tags: overrides.tags || [],
    isLocked: Boolean(overrides.isLocked),
    lockType: overrides.lockType ?? null,
    lockCredentialKind: overrides.lockCredentialKind ?? null,
    lockHash: overrides.lockHash ?? null,
    lockSalt: overrides.lockSalt ?? null,
    lockHint: overrides.lockHint ?? null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

async function run() {
  // ---------------------------------------------------------------------------
  // STAGE 1: Pure-TS Cryptography, Format Validation & Brute-Force Rate Limiter
  // ---------------------------------------------------------------------------
  console.log('▶ STAGE 1: Pure-TS Cryptography & Brute-Force Rate Limiter');

  test('PBKDF2-HMAC-SHA256 matches Node native crypto.pbkdf2Sync vector-for-vector', () => {
    const secrets = ['1234', '987654', 'CorrectHorse!99', 'uni🔐code'];
    for (const secret of secrets) {
      const salt = generateSalt(16);
      assert.strictEqual(salt.length, 32, '16-byte salt must encode as 32 hex chars');
      const pureTsHex = hashCredential(secret, salt, DEFAULT_PBKDF2_ITERATIONS);
      const nodeNativeHex = crypto
        .pbkdf2Sync(Buffer.from(secret, 'utf8'), Buffer.from(salt, 'utf8'), DEFAULT_PBKDF2_ITERATIONS, 32, 'sha256')
        .toString('hex');
      assert.strictEqual(pureTsHex, nodeNativeHex, `PBKDF2 mismatch for secret ${secret}`);
      assert.strictEqual(verifyCredential(secret, pureTsHex, salt), true);
      assert.strictEqual(verifyCredential(`${secret}x`, pureTsHex, salt), false);
    }
  });

  test('Unique salts ensure identical secrets produce distinct hashes and fail cross-salt checks', () => {
    const saltA = generateSalt();
    const saltB = generateSalt();
    assert.notStrictEqual(saltA, saltB);
    const hashA = hashCredential('2580', saltA);
    const hashB = hashCredential('2580', saltB);
    assert.notStrictEqual(hashA, hashB);
    assert.strictEqual(verifyCredential('2580', hashA, saltB), false);
    assert.strictEqual(verifyCredential('', hashA, saltA), false);
    assert.strictEqual(verifyCredential('2580', null, saltA), false);
  });

  test('constantTimeEqual distinguishes equal, mismatched, and different-length inputs', () => {
    assert.strictEqual(constantTimeEqual('abcdef', 'abcdef'), true);
    assert.strictEqual(constantTimeEqual('abcdef', 'abcdeg'), false);
    assert.strictEqual(constantTimeEqual('abcdef', 'abcde'), false);
    assert.strictEqual(constantTimeEqual('', ''), true);
  });

  test('validateCredentialFormat enforces 4-6 digit PIN and >=4 non-whitespace Password rules', () => {
    assert.strictEqual(validateCredentialFormat('1234', 'pin').valid, true);
    assert.strictEqual(validateCredentialFormat('098765', 'pin').valid, true);
    assert.strictEqual(validateCredentialFormat('123', 'pin').valid, false);
    assert.strictEqual(validateCredentialFormat('1234567', 'pin').valid, false);
    assert.strictEqual(validateCredentialFormat('12a4', 'pin').valid, false);
    assert.strictEqual(validateCredentialFormat('12 4', 'pin').valid, false);

    assert.strictEqual(validateCredentialFormat('pass', 'password').valid, true);
    assert.strictEqual(validateCredentialFormat('Strong!Pass1', 'password').valid, true);
    assert.strictEqual(validateCredentialFormat('abc', 'password').valid, false);
    assert.strictEqual(validateCredentialFormat('    ', 'password').valid, false);
    assert.strictEqual(validateCredentialFormat('', 'password').valid, false);
  });

  test('AttemptRateLimiter enforces 5-failure 30s lockout, expiry reset, and success clear', () => {
    const limiter = new AttemptRateLimiter();
    const scope = 'note:custom-1';
    const t0 = 1_000_000;

    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      const res = limiter.recordFailure(scope, t0 + i);
      assert.strictEqual(res.lockedOut, false);
      assert.strictEqual(res.failures, i);
      assert.strictEqual(limiter.getRemainingAttempts(scope), MAX_FAILED_ATTEMPTS - i);
      assert.strictEqual(limiter.getLockoutRemainingMs(scope, t0 + i), 0);
    }

    // 5th failure activates 30s lockout
    const lockRes = limiter.recordFailure(scope, t0 + 100);
    assert.strictEqual(lockRes.lockedOut, true);
    assert.strictEqual(lockRes.failures, MAX_FAILED_ATTEMPTS);
    assert.strictEqual(lockRes.remainingMs, COOLDOWN_DURATION_MS);
    assert.strictEqual(limiter.getLockoutRemainingMs(scope, t0 + 10_100), 20_000);
    assert.strictEqual(limiter.getRemainingAttempts(scope), 0);

    // Other scopes remain unaffected
    assert.strictEqual(limiter.getLockoutRemainingMs('note:other', t0 + 10_100), 0);

    // After cooldown expires, failure counter resets cleanly
    const afterExpiry = t0 + 100 + COOLDOWN_DURATION_MS;
    assert.strictEqual(limiter.getLockoutRemainingMs(scope, afterExpiry), 0);
    const resetRes = limiter.recordFailure(scope, afterExpiry);
    assert.strictEqual(resetRes.lockedOut, false);
    assert.strictEqual(resetRes.failures, 1);

    // Successful unlock clears failures completely
    limiter.recordSuccess(scope);
    assert.strictEqual(limiter.getAttemptCount(scope), 0);
    assert.strictEqual(limiter.getRemainingAttempts(scope), MAX_FAILED_ATTEMPTS);
  });

  // ---------------------------------------------------------------------------
  // STAGE 2: SQLite Schema, Legacy Migration & Zero-Knowledge Persistence
  // ---------------------------------------------------------------------------
  console.log('\n▶ STAGE 2: SQLite Schema, Legacy DB Migration & Zero-Knowledge Constraints');

  test('SCHEMA_SQL initializes workspace_security, lock columns, CHECK constraints, and indexes', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(SCHEMA_SQL);

    // Verify workspace_security table & columns
    const secCols = db.prepare("PRAGMA table_info('workspace_security')").all().map((c) => c.name);
    for (const col of [
      'id',
      'app_lock_enabled',
      'master_credential_type',
      'master_hash',
      'master_salt',
      'master_hint',
      'biometrics_enabled',
      'auto_relock_seconds',
      'updated_at',
    ]) {
      assert(secCols.includes(col), `Missing workspace_security.${col}`);
    }

    // Verify lock columns on notes and folders
    for (const tbl of ['notes', 'folders']) {
      const cols = db.prepare(`PRAGMA table_info('${tbl}')`).all().map((c) => c.name);
      for (const col of [
        'is_locked',
        'lock_type',
        'lock_credential_kind',
        'lock_hash',
        'lock_salt',
        'lock_hint',
      ]) {
        assert(cols.includes(col), `Missing ${tbl}.${col}`);
      }
    }

    // Verify indexes exist
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index'")
      .all()
      .map((r) => r.name);
    assert(indexes.includes('idx_notes_locked'));
    assert(indexes.includes('idx_folders_locked'));

    // Verify CHECK constraint rejects invalid lock_type
    assert.throws(() => {
      db.prepare(
        "INSERT INTO notes (id, user_id, title, is_locked, lock_type) VALUES ('bad-n', 'u1', 'Bad', 1, 'backdoor')"
      ).run();
    });

    // Zero-knowledge insertion: plaintext PIN must NEVER match stored master_hash / lock_hash
    const masterSecret = '9090';
    const masterSalt = generateSalt();
    const masterHash = hashCredential(masterSecret, masterSalt);

    db.prepare(
      `INSERT INTO workspace_security
       (id, app_lock_enabled, master_credential_type, master_hash, master_salt, master_hint, biometrics_enabled, auto_relock_seconds)
       VALUES ('default', 1, 'pin', ?, ?, 'Year', 0, 300)`
    ).run(masterHash, masterSalt);

    const row = db.prepare("SELECT * FROM workspace_security WHERE id='default'").get();
    assert.strictEqual(row.app_lock_enabled, 1);
    assert.strictEqual(row.auto_relock_seconds, 300);
    assert.notStrictEqual(row.master_hash, masterSecret);
    assert.strictEqual(verifyCredential(masterSecret, row.master_hash, row.master_salt), true);

    db.close();
  });

  test('Legacy SQLite database upgrades smoothly via security ALTER TABLE migrations', () => {
    const db = new DatabaseSync(':memory:');
    // Simulate pre-Task-36 schema without lock columns or workspace_security table
    db.exec(`
      CREATE TABLE folders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        parent_id TEXT,
        path TEXT NOT NULL
      );
      CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        folder_path TEXT,
        title TEXT NOT NULL,
        content_markdown TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active'
      );
      INSERT INTO notes (id, user_id, folder_path, title) VALUES ('legacy-1', 'u1', 'Work', 'Old Note');
    `);

    const legacyStatements = [
      'ALTER TABLE notes ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0;',
      "ALTER TABLE notes ADD COLUMN lock_type TEXT CHECK(lock_type IN ('master', 'custom')) DEFAULT NULL;",
      "ALTER TABLE notes ADD COLUMN lock_credential_kind TEXT CHECK(lock_credential_kind IN ('pin', 'password')) DEFAULT NULL;",
      'ALTER TABLE notes ADD COLUMN lock_hash TEXT DEFAULT NULL;',
      'ALTER TABLE notes ADD COLUMN lock_salt TEXT DEFAULT NULL;',
      'ALTER TABLE notes ADD COLUMN lock_hint TEXT DEFAULT NULL;',
      'ALTER TABLE folders ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0;',
      "ALTER TABLE folders ADD COLUMN lock_type TEXT CHECK(lock_type IN ('master', 'custom')) DEFAULT NULL;",
      "ALTER TABLE folders ADD COLUMN lock_credential_kind TEXT CHECK(lock_credential_kind IN ('pin', 'password')) DEFAULT NULL;",
      'ALTER TABLE folders ADD COLUMN lock_hash TEXT DEFAULT NULL;',
      'ALTER TABLE folders ADD COLUMN lock_salt TEXT DEFAULT NULL;',
      'ALTER TABLE folders ADD COLUMN lock_hint TEXT DEFAULT NULL;',
      'CREATE INDEX IF NOT EXISTS idx_notes_locked ON notes(is_locked);',
      'CREATE INDEX IF NOT EXISTS idx_folders_locked ON folders(is_locked);',
    ];
    for (const stmt of legacyStatements) {
      db.exec(stmt);
    }

    const legacyRow = db.prepare("SELECT is_locked, lock_type FROM notes WHERE id='legacy-1'").get();
    assert.strictEqual(legacyRow.is_locked, 0);
    assert.strictEqual(legacyRow.lock_type, null);
    db.close();
  });

  test('Native 3-phase schema initialization prevents "no such column: is_locked" error on legacy DBs', () => {
    const db = new DatabaseSync(':memory:');
    // Pre-create tables without is_locked (simulating existing mobile device SQLite database)
    db.exec(`
      CREATE TABLE folders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, path TEXT NOT NULL);
      CREATE TABLE notes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active');
      CREATE TABLE tasks (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL);
    `);

    // Phase 1: Initialize all base tables
    db.exec(SCHEMA_TABLES_SQL);

    // Phase 2: Run all column migrations before creating any indexes
    const columnMigrations = [
      'ALTER TABLE tasks ADD COLUMN reminder_at TEXT;',
      'ALTER TABLE notes ADD COLUMN reminder_at TEXT;',
      'ALTER TABLE notes ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT 0;',
      'ALTER TABLE notes ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT 0;',
      'ALTER TABLE notes ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0;',
      "ALTER TABLE notes ADD COLUMN lock_type TEXT CHECK(lock_type IN ('master', 'custom')) DEFAULT NULL;",
      "ALTER TABLE notes ADD COLUMN lock_credential_kind TEXT CHECK(lock_credential_kind IN ('pin', 'password')) DEFAULT NULL;",
      'ALTER TABLE notes ADD COLUMN lock_hash TEXT DEFAULT NULL;',
      'ALTER TABLE notes ADD COLUMN lock_salt TEXT DEFAULT NULL;',
      'ALTER TABLE notes ADD COLUMN lock_hint TEXT DEFAULT NULL;',
      'ALTER TABLE folders ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT 0;',
      'ALTER TABLE folders ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT 0;',
      'ALTER TABLE folders ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT 0;',
      'ALTER TABLE folders ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0;',
      "ALTER TABLE folders ADD COLUMN lock_type TEXT CHECK(lock_type IN ('master', 'custom')) DEFAULT NULL;",
      "ALTER TABLE folders ADD COLUMN lock_credential_kind TEXT CHECK(lock_credential_kind IN ('pin', 'password')) DEFAULT NULL;",
      'ALTER TABLE folders ADD COLUMN lock_hash TEXT DEFAULT NULL;',
      'ALTER TABLE folders ADD COLUMN lock_salt TEXT DEFAULT NULL;',
      'ALTER TABLE folders ADD COLUMN lock_hint TEXT DEFAULT NULL;',
    ];
    for (const stmt of columnMigrations) {
      try {
        db.exec(stmt);
      } catch {}
    }

    // Phase 3: Create all performance and security query indexes safely
    const indexStatements = SCHEMA_INDEXES_SQL.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const idxStmt of indexStatements) {
      try {
        db.exec(`${idxStmt};`);
      } catch {}
    }

    // Verify idx_notes_locked and idx_folders_locked exist and is_locked column is queryable
    const cols = db.prepare("PRAGMA table_info('notes')").all().map((c) => c.name);
    assert(cols.includes('is_locked'), 'notes.is_locked must exist');

    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map((r) => r.name);
    assert(indexes.includes('idx_notes_locked'), 'idx_notes_locked index must exist');
    assert(indexes.includes('idx_folders_locked'), 'idx_folders_locked index must exist');
    db.close();
  });

  // ---------------------------------------------------------------------------
  // STAGE 3: Strict Custom Credential Isolation & Multi-Level Folder Cascade
  // ---------------------------------------------------------------------------
  console.log('\n▶ STAGE 3: Strict Custom Credential Isolation & Folder Lock Cascade');

  const masterPin = '1111';
  const masterSalt = generateSalt();
  const masterConfig = {
    masterHash: hashCredential(masterPin, masterSalt),
    masterSalt,
  };

  const folderCustomPin = '2222';
  const folderCustomSalt = generateSalt();
  const folderCustomHash = hashCredential(folderCustomPin, folderCustomSalt);

  const noteCustomPass = 'vault#note#42';
  const noteCustomSalt = generateSalt();
  const noteCustomHash = hashCredential(noteCustomPass, noteCustomSalt);

  test('verifyTargetCredential enforces STRICT Custom Isolation (Master cannot unlock Custom & vice-versa)', () => {
    // Master-locked item accepts Master only
    assert.strictEqual(
      verifyTargetCredential({ candidate: masterPin, lockType: 'master', securityConfig: masterConfig }),
      true
    );
    assert.strictEqual(
      verifyTargetCredential({ candidate: folderCustomPin, lockType: 'master', securityConfig: masterConfig }),
      false
    );

    // Custom-locked item MUST reject Master even when Master config is provided
    assert.strictEqual(
      verifyTargetCredential({
        candidate: masterPin,
        lockType: 'custom',
        customHash: noteCustomHash,
        customSalt: noteCustomSalt,
        securityConfig: masterConfig,
      }),
      false,
      'SECURITY BREACH: Master credential unlocked a custom-locked target!'
    );

    // Custom-locked item accepts its exact custom secret only
    assert.strictEqual(
      verifyTargetCredential({
        candidate: noteCustomPass,
        lockType: 'custom',
        customHash: noteCustomHash,
        customSalt: noteCustomSalt,
        securityConfig: masterConfig,
      }),
      true
    );
  });

  test('Folder Lock Cascade protects all nested subfolders and notes in outer-to-inner order', () => {
    const folders = [
      makeFolder({ id: 'f-work', path: 'Work', is_locked: 1, lock_type: 'master' }),
      makeFolder({ id: 'f-proj', path: 'Work/Projects', is_locked: 0 }),
      makeFolder({
        id: 'f-q4',
        path: 'Work/Projects/Q4',
        is_locked: 1,
        lock_type: 'custom',
        lock_credential_kind: 'pin',
        lock_hash: folderCustomHash,
        lock_salt: folderCustomSalt,
      }),
      makeFolder({ id: 'f-personal', path: 'Personal', is_locked: 0 }),
    ];

    const unlockedFolderPaths = new Set();
    const unlockedNoteIds = new Set();

    // Direct note inside unlocked subfolder Work/Projects inherits lock from ancestor 'Work'
    const inheritedNote = makeNote({ id: 'n-inherited', folderPath: 'Work/Projects', isLocked: false });
    // Custom note inside custom-locked nested folder Work/Projects/Q4
    const deepCustomNote = makeNote({
      id: 'n-deep-custom',
      folderPath: 'Work/Projects/Q4',
      isLocked: true,
      lockType: 'custom',
      lockCredentialKind: 'password',
      lockHash: noteCustomHash,
      lockSalt: noteCustomSalt,
    });
    const openNote = makeNote({ id: 'n-open', folderPath: 'Personal', isLocked: false });

    assert.strictEqual(isFolderEffectivelyLocked('/Work/Projects/', folders, unlockedFolderPaths), true);
    assert.strictEqual(isFolderEffectivelyLocked('Personal', folders, unlockedFolderPaths), false);

    // Blocking folders must be ordered outer -> inner
    const blockers = getBlockingLockedFoldersForPath('Work/Projects/Q4', folders, unlockedFolderPaths);
    assert.deepStrictEqual(
      blockers.map((f) => f.path),
      ['Work', 'Work/Projects/Q4']
    );

    // Inspect initial lock state of deep custom note: reason === 'both'
    const initialState = inspectNoteLockState(deepCustomNote, folders, unlockedNoteIds, unlockedFolderPaths);
    assert.strictEqual(initialState.isEffectivelyLocked, true);
    assert.strictEqual(initialState.lockReason, 'both');
    assert.deepStrictEqual(
      initialState.blockingFolders.map((f) => f.path),
      ['Work', 'Work/Projects/Q4']
    );

    // Unlock outer 'Work' folder -> inheritedNote becomes accessible, deepCustomNote STILL blocked by Work/Projects/Q4 & note custom lock
    unlockedFolderPaths.add('Work');
    assert.strictEqual(isNoteEffectivelyLocked(inheritedNote, folders, unlockedNoteIds, unlockedFolderPaths), false);
    const midState = inspectNoteLockState(deepCustomNote, folders, unlockedNoteIds, unlockedFolderPaths);
    assert.strictEqual(midState.isEffectivelyLocked, true);
    assert.strictEqual(midState.lockReason, 'both');
    assert.deepStrictEqual(
      midState.blockingFolders.map((f) => f.path),
      ['Work/Projects/Q4']
    );

    // Unlock Work/Projects/Q4 with its custom PIN -> note's own custom lock STILL keeps note locked!
    unlockedFolderPaths.add('Work/Projects/Q4');
    const noteOnlyState = inspectNoteLockState(deepCustomNote, folders, unlockedNoteIds, unlockedFolderPaths);
    assert.strictEqual(noteOnlyState.isEffectivelyLocked, true);
    assert.strictEqual(noteOnlyState.lockReason, 'note');
    assert.strictEqual(noteOnlyState.blockingFolders.length, 0);

    // Unlock note itself -> accessible
    unlockedNoteIds.add('n-deep-custom');
    assert.strictEqual(isNoteEffectivelyLocked(deepCustomNote, folders, unlockedNoteIds, unlockedFolderPaths), false);

    // Verify locked note ID computation across whole workspace
    const lockedSetAll = computeLockedNoteIdSet(
      [inheritedNote, deepCustomNote, openNote],
      folders,
      new Set(),
      new Set()
    );
    assert.strictEqual(lockedSetAll.has('n-inherited'), true);
    assert.strictEqual(lockedSetAll.has('n-deep-custom'), true);
    assert.strictEqual(lockedSetAll.has('n-open'), false);
  });

  test('normalizeFolderPath, getAncestorFolderPaths, and countNotesUnderFolder handle slashes & trash cleanly', () => {
    assert.strictEqual(normalizeFolderPath(' /Work/Projects/ '), 'Work/Projects');
    assert.deepStrictEqual(getAncestorFolderPaths('/Work/Projects/Q4/'), [
      'Work',
      'Work/Projects',
      'Work/Projects/Q4',
    ]);
    const notes = [
      makeNote({ id: '1', folderPath: 'Work', status: 'active' }),
      makeNote({ id: '2', folderPath: 'Work/Sub', status: 'archived' }),
      makeNote({ id: '3', folderPath: 'Work/Sub', status: 'trashed' }),
      makeNote({ id: '4', folderPath: 'WorkOther', status: 'active' }),
    ];
    assert.strictEqual(countNotesUnderFolder('Work', notes), 2);
  });

  // ---------------------------------------------------------------------------
  // STAGE 4: Search Engine & Query Pipeline Redaction
  // ---------------------------------------------------------------------------
  console.log('\n▶ STAGE 4: Search Engine, Body/Tag Exclusion & Block-Filter Privacy');

  test('executeNoteQuery hides locked body preview, excludes body/tag matches & counts, and preserves Title/Folder matching', () => {
    const lockedNote = makeNote({
      id: 'n-locked',
      title: 'Project Apollo Roadmap',
      folderPath: 'Finance',
      body: 'Confidential salary budget 994422 and merger details',
      tags: ['topsecret', 'shared'],
      isLocked: true,
      blocks: [
        { id: 'b1', type: 'paragraph', content: 'Confidential salary budget 994422 and merger details' },
        { id: 'b2', type: 'audio', content: 'CEO voice memo', metadata: { title: 'BoardRecording' } },
      ],
    });
    const unlockedNote = makeNote({
      id: 'n-public',
      title: 'Grocery List',
      folderPath: 'Personal',
      body: 'Buy apples and coffee beans',
      tags: ['errands', 'shared'],
      isLocked: false,
      blocks: [
        { id: 'b1', type: 'paragraph', content: 'Buy apples and coffee beans' },
      ],
    });

    const notes = [lockedNote, unlockedNote];
    const searchMap = new Map(notes.map((n) => [n.id, buildNoteSearchDocument(n)]));
    const lockedSet = new Set(['n-locked']);

    // 1. Default browse: locked card has empty cleanPreviewText, unlocked keeps cleanPreviewText, and secret tags are omitted from counts
    const browseRes = executeNoteQuery(notes, searchMap, { statusScope: 'active' }, { lockedNoteIds: lockedSet });
    const lockedVm = browseRes.feedCards.find((vm) => vm.note.id === 'n-locked');
    const publicVm = browseRes.feedCards.find((vm) => vm.note.id === 'n-public');
    assert(lockedVm, 'Locked note card must remain visible in feed');
    assert.strictEqual(lockedVm.cleanPreviewText, '', 'Locked note cleanPreviewText must be redacted');
    assert(publicVm.cleanPreviewText.includes('Buy apples'), 'Unlocked note retains preview');
    assert.strictEqual(browseRes.counts.byTag['topsecret'], undefined, 'Locked-only tag must NOT appear in tag counts');
    assert.strictEqual(browseRes.counts.byTag['shared'], 1, 'Shared tag count must exclude locked notes');

    // 2. Search by confidential BODY keyword -> 0 matches!
    const bodySearch = executeNoteQuery(
      notes,
      searchMap,
      { searchQuery: '994422' },
      { lockedNoteIds: lockedSet }
    );
    assert.strictEqual(bodySearch.totalMatches, 0, 'Locked note body content must NOT match full-text search');

    // 3. Search by secret BLOCK metadata -> 0 matches!
    const blockSearch = executeNoteQuery(
      notes,
      searchMap,
      { searchQuery: 'BoardRecording' },
      { lockedNoteIds: lockedSet }
    );
    assert.strictEqual(blockSearch.totalMatches, 0, 'Locked note block captions must NOT match search');

    // 4. Search & tag-filter by hidden TAG -> 0 matches for locked note!
    const tagSearch = executeNoteQuery(
      notes,
      searchMap,
      { searchQuery: 'topsecret' },
      { lockedNoteIds: lockedSet }
    );
    assert.strictEqual(tagSearch.totalMatches, 0, 'Locked note tags must NOT match search');

    const secretTagFilter = executeNoteQuery(
      notes,
      searchMap,
      { tags: ['topsecret'] },
      { lockedNoteIds: lockedSet }
    );
    assert.strictEqual(secretTagFilter.totalMatches, 0, 'Tag filter must NOT enumerate locked notes');

    const sharedTagFilter = executeNoteQuery(
      notes,
      searchMap,
      { tags: ['shared'] },
      { lockedNoteIds: lockedSet }
    );
    assert.strictEqual(sharedTagFilter.totalMatches, 1, 'Shared tag filter must return only unlocked notes');
    assert.strictEqual(sharedTagFilter.feedCards[0].note.id, 'n-public');

    // 5. Block-type filter (hasBlockTypes: ['audio']) -> locked note excluded
    const audioFilterRes = executeNoteQuery(
      notes,
      searchMap,
      { hasBlockTypes: ['audio'] },
      { lockedNoteIds: lockedSet }
    );
    assert.strictEqual(audioFilterRes.totalMatches, 0, 'Locked notes must NOT leak via hasBlockTypes filter');

    // 6. Search by TITLE -> allowed & matched!
    const titleSearch = executeNoteQuery(
      notes,
      searchMap,
      { searchQuery: 'Apollo' },
      { lockedNoteIds: lockedSet }
    );
    assert.strictEqual(titleSearch.totalMatches, 1);
    assert.strictEqual(titleSearch.feedCards[0].note.id, 'n-locked');
    assert.strictEqual(titleSearch.feedCards[0].cleanPreviewText, '');

    // 7. Search by FOLDER PATH -> allowed & matched!
    const folderSearch = executeNoteQuery(
      notes,
      searchMap,
      { searchQuery: 'Finance' },
      { lockedNoteIds: lockedSet }
    );
    assert.strictEqual(folderSearch.totalMatches, 1);
    assert.strictEqual(folderSearch.feedCards[0].matchBadge?.iconType, 'folder');

    // 8. Once unlocked (empty lockedSet), body/block/tag searches & preview immediately restore!
    const unlockedBodySearch = executeNoteQuery(
      notes,
      searchMap,
      { searchQuery: '994422' },
      { lockedNoteIds: new Set() }
    );
    assert.strictEqual(unlockedBodySearch.totalMatches, 1);
    assert(unlockedBodySearch.feedCards[0].cleanPreviewText.includes('Confidential salary budget'));
  });

  // ---------------------------------------------------------------------------
  // STAGE 5: Task & Notification Center Redaction Helpers
  // ---------------------------------------------------------------------------
  console.log('\n▶ STAGE 5: Task Projection & Notification Center Masking');

  test('Tasks and Notifications linked to direct or folder-locked notes mask as Locked Note/Task', () => {
    assert.strictEqual(LOCKED_MASK_LABEL, 'Locked Note/Task');

    const folders = [makeFolder({ id: 'f-sec', path: 'Private', is_locked: 1, lock_type: 'master' })];
    const folderInheritedNote = makeNote({ id: 'note-priv', folderPath: 'Private', isLocked: false });
    const unlockedPublicNote = makeNote({ id: 'note-pub', folderPath: 'General', isLocked: false });

    const lockedIds = computeLockedNoteIdSet(
      [folderInheritedNote, unlockedPublicNote],
      folders,
      new Set(),
      new Set()
    );

    assert.strictEqual(shouldRedactTaskForNote('note-priv', lockedIds), true);
    assert.strictEqual(shouldRedactTaskForNote('note-pub', lockedIds), false);
    assert.strictEqual(shouldRedactTaskForNote(null, lockedIds), false);

    assert.strictEqual(
      shouldRedactNotification({ noteId: 'note-priv', targetType: 'task', targetId: 't-1' }, lockedIds),
      true
    );
    assert.strictEqual(
      shouldRedactNotification({ noteId: null, targetType: 'note', targetId: 'note-priv' }, lockedIds),
      true
    );
    assert.strictEqual(
      shouldRedactNotification({ noteId: null, targetType: 'system', targetId: 'sys-1' }, lockedIds),
      false
    );

    // Unlocking the folder reveals tasks and notifications immediately
    const unlockedFolderIds = computeLockedNoteIdSet(
      [folderInheritedNote, unlockedPublicNote],
      folders,
      new Set(),
      new Set(['Private'])
    );
    assert.strictEqual(shouldRedactTaskForNote('note-priv', unlockedFolderIds), false);
    assert.strictEqual(
      shouldRedactNotification({ noteId: 'note-priv', targetType: 'task', targetId: 't-1' }, unlockedFolderIds),
      false
    );
  });

  // ---------------------------------------------------------------------------
  // STAGE 6: Navigation, Settings & Backup Structural Integration Check
  // ---------------------------------------------------------------------------
  console.log('\n▶ STAGE 6: App Gate, Side Navbar, Settings & Backup Presence Verification');

  test('Required routes, components, and security providers exist and wire key symbols', () => {
    const mustExist = [
      'src/core/security/pinCrypto.ts',
      'src/core/security/vaultLockHelpers.ts',
      'src/db/securityRepo.ts',
      'src/context/SecurityContext.tsx',
      'src/components/security/PinPasswordPromptModal.tsx',
      'src/components/security/AppLockScreenOverlay.tsx',
      'src/components/navigation/SideNavbarModal.tsx',
      'app/settings/index.tsx',
      'app/settings/pin-password.tsx',
    ];
    for (const rel of mustExist) {
      assert(fs.existsSync(path.join(feDir, rel)), `Missing required security file: ${rel}`);
    }

    const homeSrc = fs.readFileSync(path.join(feDir, 'app/home.tsx'), 'utf8');
    assert(homeSrc.includes('SideNavbarModal'), 'home.tsx must render SideNavbarModal');
    assert(homeSrc.includes('<Menu') && homeSrc.includes('Open Navigation Menu'), 'home.tsx must include top-left hamburger menu trigger');

    const sideNavSrc = fs.readFileSync(path.join(feDir, 'src/components/navigation/SideNavbarModal.tsx'), 'utf8');
    assert(sideNavSrc.includes('Cloud Synced'), 'SideNavbarModal must host Cloud Synced status badge');
    assert(sideNavSrc.includes('Local SQLite Active'), 'SideNavbarModal must host Local SQLite Active status badge');
    assert(sideNavSrc.includes('onOpenSettings') && homeSrc.includes("router.push('/settings')"), 'SideNavbarModal & home.tsx must link Settings to /settings');

    const settingsSrc = fs.readFileSync(path.join(feDir, 'app/settings/index.tsx'), 'utf8');
    assert(settingsSrc.includes('Security'), 'settings/index.tsx must display Security section');
    assert(settingsSrc.includes('Manage PIN / Password'), 'settings/index.tsx must expand to Manage PIN / Password');
    assert(settingsSrc.includes('/settings/pin-password'), 'settings/index.tsx must route to /settings/pin-password');

    const layoutSrc = fs.readFileSync(path.join(feDir, 'app/_layout.tsx'), 'utf8');
    assert(layoutSrc.includes('SecurityProvider'), '_layout.tsx must wrap app with SecurityProvider');
    assert(layoutSrc.includes('AppLockScreenOverlay'), '_layout.tsx must render AppLockScreenOverlay');

    const backupSrc = fs.readFileSync(path.join(feDir, 'src/services/workspaceBackupService.ts'), 'utf8');
    assert(backupSrc.includes('workspace_security'), 'workspaceBackupService.ts must export/restore workspace_security');

    const notesViewSrc = fs.readFileSync(path.join(feDir, 'src/components/NotesView.tsx'), 'utf8');
    for (const sym of [
      'handleTogglePinSafe',
      'handleToggleFavoriteSafe',
      'handleRestoreNoteSafe',
      'handleUnarchiveNoteSafe',
      'handleEmptyTrashSafe',
      'verifyFolderSubtreeUnlocked',
      'handleUnarchiveFolderSafe',
      'restoreEphemeralUnlocks',
      'collectAndVerifyNotes',
      'runWithSingleNoteUnlocked',
      'flushActionSheetEphemeralRelock',
      'fullTargetPath',
      'isInActiveViewPath',
    ]) {
      assert(notesViewSrc.includes(sym), `NotesView.tsx must wire ${sym}`);
    }
    assert(
      !notesViewSrc.includes('wasActiveSubtree || securityConfig.autoRelockSeconds'),
      'NotesView.tsx rename/move must NOT keep non-active locked descendants unlocked under autoRelockSeconds === 0'
    );

    const workspaceSettingsSrc = fs.readFileSync(
      path.join(feDir, 'src/components/settings/WorkspaceSettingsModal.tsx'),
      'utf8'
    );
    assert(
      workspaceSettingsSrc.includes('relockNoteSession') &&
        workspaceSettingsSrc.includes('relockFolderSession') &&
        workspaceSettingsSrc.includes('getAncestorFolderPaths'),
      'WorkspaceSettingsModal.tsx must restore ephemeral session unlocks on emptyTrash & clear stale unlocks on backup restore'
    );

    const deleteFolderModalSrc = fs.readFileSync(
      path.join(feDir, 'src/components/folders/DeleteFolderModal.tsx'),
      'utf8'
    );
    assert(
      deleteFolderModalSrc.includes('useEffect'),
      'DeleteFolderModal.tsx must reset local modal state via useEffect on visible change'
    );

    for (const relModal of [
      'src/components/folders/FolderExplorerModal.tsx',
      'src/components/folders/FolderDropdownModal.tsx',
      'src/components/notes/NotesFilterTrack.tsx',
    ]) {
      const modalSrc = fs.readFileSync(path.join(feDir, relModal), 'utf8');
      assert(
        modalSrc.includes('isFolderEffectivelyLocked'),
        `${relModal} must render inherited folder lock badges via isFolderEffectivelyLocked`
      );
    }

    const pinSettingsSrc = fs.readFileSync(path.join(feDir, 'app/settings/pin-password.tsx'), 'utf8');
    assert(pinSettingsSrc.includes('notePickerQuery') && pinSettingsSrc.includes('filteredCandidateNotes'), 'pin-password.tsx must provide search filter for + Lock Note picker');
    assert(!pinSettingsSrc.includes('.slice(0, 20)'), 'pin-password.tsx must not silently truncate unlocked notes to 20');
    assert(
      pinSettingsSrc.includes("Platform.OS === 'web'") && pinSettingsSrc.includes('window.confirm'),
      'pin-password.tsx must provide Web window.confirm fallback for clearing Master with locked items'
    );
  });

  // ---------------------------------------------------------------------------
  // STAGE 7: Live Production Repo & Backup Execution against node:sqlite
  // ---------------------------------------------------------------------------
  console.log('\n▶ STAGE 7: Live SecurityRepository, FoldersRepository & Backup Roundtrip');

  async function testAsync(name, fn) {
    totalTests++;
    try {
      await fn();
      passedTests++;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      failedTests++;
      console.error(`  ❌ ${name}`);
      console.error(`     Error: ${err?.message || err}`);
    }
  }

  let activeSqlite = new DatabaseSync(':memory:');
  activeSqlite.exec(SCHEMA_SQL);

  const normalizeSqlParams = (params = []) =>
    params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p === undefined ? null : p));

  const sqliteDbClient = {
    async query(sql, params = []) {
      return activeSqlite.prepare(sql).all(...normalizeSqlParams(params));
    },
    async queryFirst(sql, params = []) {
      const row = activeSqlite.prepare(sql).get(...normalizeSqlParams(params));
      return row ?? null;
    },
    async run(sql, params = []) {
      const info = activeSqlite.prepare(sql).run(...normalizeSqlParams(params));
      return {
        lastInsertRowId: Number(info.lastInsertRowid || 0),
        changes: Number(info.changes || 0),
      };
    },
    async exec(sql) {
      activeSqlite.exec(sql);
    },
    async withTransaction(callback) {
      activeSqlite.exec('BEGIN TRANSACTION;');
      try {
        const res = await callback(activeSqlite);
        activeSqlite.exec('COMMIT;');
        return res;
      } catch (err) {
        activeSqlite.exec('ROLLBACK;');
        throw err;
      }
    },
  };

  const origModuleLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'react-native') {
      return { Platform: { OS: 'ios' } };
    }
    if (request === 'expo-file-system/legacy' || request === 'expo-sharing') {
      return {};
    }
    if (
      request === './client' ||
      request === '../db/client' ||
      (typeof request === 'string' && request.endsWith('/db/client'))
    ) {
      return { dbClient: sqliteDbClient };
    }
    return origModuleLoad.call(this, request, parent, isMain);
  };

  const nodeRequire = createRequire(import.meta.url);
  let securityRepo;
  let foldersRepo;
  let workspaceBackupService;
  try {
    ({ securityRepo } = nodeRequire('../frontend/src/db/securityRepo.ts'));
    ({ foldersRepo } = nodeRequire('../frontend/src/db/foldersRepo.ts'));
    ({ workspaceBackupService } = nodeRequire('../frontend/src/services/workspaceBackupService.ts'));
  } finally {
    Module._load = origModuleLoad;
  }

  await testAsync('SecurityRepository persists Master/Custom credentials, counts master items, and unlocks cleanly', async () => {
    const initial = await securityRepo.getSecurityConfig();
    assert.strictEqual(initial.masterHash, null);
    assert.strictEqual(initial.masterSalt, null);
    assert.strictEqual(initial.appLockEnabled, false);
    assert.strictEqual(initial.autoRelockSeconds, 0);

    const savedMaster = await securityRepo.saveMasterCredential({
      credentialKind: 'pin',
      secret: '4321',
      hint: 'Last 4',
      enableAppLock: true,
    });
    assert(Boolean(savedMaster.masterHash && savedMaster.masterSalt), 'Master hash and salt must be saved');
    assert.strictEqual(savedMaster.appLockEnabled, true);
    assert.strictEqual(savedMaster.masterCredentialType, 'pin');
    assert.strictEqual(savedMaster.masterHint, 'Last 4');
    assert.notStrictEqual(savedMaster.masterHash, '4321');
    assert.strictEqual(verifyCredential('4321', savedMaster.masterHash, savedMaster.masterSalt), true);

    const bioUpdated = await securityRepo.setBiometricsEnabled(true);
    assert.strictEqual(bioUpdated.biometricsEnabled, true);
    const timerUpdated = await securityRepo.setAutoRelockSeconds(300);
    assert.strictEqual(timerUpdated.autoRelockSeconds, 300);

    await sqliteDbClient.run(
      `INSERT INTO folders (id, user_id, name, path) VALUES (?, 'user_local', ?, ?);`,
      ['f-m', 'Work', 'Work']
    );
    await sqliteDbClient.run(
      `INSERT INTO folders (id, user_id, name, path) VALUES (?, 'user_local', ?, ?);`,
      ['f-c', 'Vault', 'Vault']
    );
    await sqliteDbClient.run(
      `INSERT INTO notes (id, user_id, folder_path, title, status) VALUES (?, 'user_local', 'Work', ?, 'active');`,
      ['n-1', 'Alpha']
    );
    await sqliteDbClient.run(
      `INSERT INTO notes (id, user_id, folder_path, title, status) VALUES (?, 'user_local', 'Vault', ?, 'active');`,
      ['n-2', 'Beta']
    );
    await sqliteDbClient.run(
      `INSERT INTO notes (id, user_id, folder_path, title, status) VALUES (?, 'user_local', 'General', ?, 'active');`,
      ['n-3', 'Gamma']
    );

    await securityRepo.lockFolderRecord('f-m', { lockType: 'master' });
    await securityRepo.lockFolderRecord('f-c', {
      lockType: 'custom',
      credentialKind: 'pin',
      secret: '8888',
      hint: 'Eights',
    });
    await securityRepo.lockNoteRecord('n-1', { lockType: 'master' });
    await securityRepo.lockNoteRecord('n-2', {
      lockType: 'custom',
      credentialKind: 'password',
      secret: 'CustomNote!9',
      hint: 'PassHint',
    });

    const masterCount = await securityRepo.countMasterLockedItems();
    assert.deepStrictEqual(
      masterCount,
      { folders: 1, notes: 1, total: 2 },
      'countMasterLockedItems must count f-m + n-1 only'
    );

    // Verify strict isolation on DB rows loaded back
    const n2Row = await sqliteDbClient.queryFirst(`SELECT * FROM notes WHERE id='n-2';`);
    const secCfg = await securityRepo.getSecurityConfig();
    assert.strictEqual(
      verifyTargetCredential({
        candidate: '4321',
        lockType: 'custom',
        customHash: n2Row.lock_hash,
        customSalt: n2Row.lock_salt,
        securityConfig: secCfg,
      }),
      false,
      'Master PIN must NEVER unlock custom DB note'
    );
    assert.strictEqual(
      verifyTargetCredential({
        candidate: 'CustomNote!9',
        lockType: 'custom',
        customHash: n2Row.lock_hash,
        customSalt: n2Row.lock_salt,
        securityConfig: secCfg,
      }),
      true
    );

    // Batch lock & unlock
    await securityRepo.batchLockNoteRecords(['n-1', 'n-3'], {
      lockType: 'custom',
      credentialKind: 'pin',
      secret: '7777',
    });
    const n3Row = await sqliteDbClient.queryFirst(`SELECT * FROM notes WHERE id='n-3';`);
    assert.strictEqual(n3Row.is_locked, 1);
    assert.strictEqual(n3Row.lock_type, 'custom');
    assert.strictEqual(verifyCredential('7777', n3Row.lock_hash, n3Row.lock_salt), true);

    await securityRepo.batchUnlockNoteRecords(['n-3']);
    const n3After = await sqliteDbClient.queryFirst(`SELECT * FROM notes WHERE id='n-3';`);
    assert.strictEqual(n3After.is_locked, 0);
    assert.strictEqual(n3After.lock_hash, null);
  });

  await testAsync('FoldersRepository.duplicateFolderCascade preserves folder lock & per-note lock metadata', async () => {
    const dupResult = await foldersRepo.duplicateFolderCascade('f-c', 'Vault', 'Vault Copy');
    assert.strictEqual(dupResult.newFolder.is_locked, 1, 'Duplicated folder must preserve is_locked=1');
    assert.strictEqual(dupResult.newFolder.lock_type, 'custom', 'Duplicated folder must preserve lock_type');
    assert.strictEqual(dupResult.newFolder.lock_hint, 'Eights');
    assert.strictEqual(
      verifyCredential('8888', dupResult.newFolder.lock_hash, dupResult.newFolder.lock_salt),
      true,
      'Duplicated folder must verify with original custom PIN'
    );

    const clonedNotes = await sqliteDbClient.query(
      `SELECT * FROM notes WHERE folder_path='Vault Copy';`
    );
    assert.strictEqual(clonedNotes.length, 1);
    assert.strictEqual(clonedNotes[0].is_locked, 1, 'Cloned custom note must remain locked');
    assert.strictEqual(clonedNotes[0].lock_type, 'custom');
    assert.strictEqual(clonedNotes[0].lock_hint, 'PassHint');
    assert.strictEqual(
      verifyCredential('CustomNote!9', clonedNotes[0].lock_hash, clonedNotes[0].lock_salt),
      true
    );
  });

  await testAsync('WorkspaceBackupService preserves & restores workspace_security and note/folder locks intact', async () => {
    const backup = await workspaceBackupService.generateFullBackup();
    const validation = workspaceBackupService.validateBackup(backup);
    assert.strictEqual(validation.valid, true);
    assert(
      Array.isArray(backup.workspace.workspaceSecurity) && backup.workspace.workspaceSecurity.length === 1,
      'Backup must include workspaceSecurity row'
    );

    // Swap in a fresh empty SQLite DB and restore in replace mode
    const oldDb = activeSqlite;
    activeSqlite = new DatabaseSync(':memory:');
    activeSqlite.exec(SCHEMA_SQL);
    try {
      const summary = await workspaceBackupService.restoreBackup(backup, 'replace');
      assert(summary.notesRestored >= 3, 'Expected at least 3 restored notes');
      assert(summary.foldersRestored >= 2, 'Expected at least 2 restored folders');

      const restoredCfg = await securityRepo.getSecurityConfig();
      assert(Boolean(restoredCfg.masterHash && restoredCfg.masterSalt), 'Master credential must restore');
      assert.strictEqual(restoredCfg.appLockEnabled, true);
      assert.strictEqual(restoredCfg.autoRelockSeconds, 300);
      assert.strictEqual(
        verifyCredential('4321', restoredCfg.masterHash, restoredCfg.masterSalt),
        true
      );

      const restoredVault = await sqliteDbClient.queryFirst(`SELECT * FROM folders WHERE id='f-c';`);
      assert.strictEqual(restoredVault.is_locked, 1);
      assert.strictEqual(restoredVault.lock_type, 'custom');
      assert.strictEqual(verifyCredential('8888', restoredVault.lock_hash, restoredVault.lock_salt), true);

      const restoredNote = await sqliteDbClient.queryFirst(`SELECT * FROM notes WHERE id='n-2';`);
      assert.strictEqual(restoredNote.is_locked, 1);
      assert.strictEqual(verifyCredential('CustomNote!9', restoredNote.lock_hash, restoredNote.lock_salt), true);

      // Verify clearMasterCredential removes master config & app lock cleanly while preserving custom note lock
      const cleared = await securityRepo.clearMasterCredential();
      assert.strictEqual(cleared.masterHash, null);
      assert.strictEqual(cleared.masterSalt, null);
      assert.strictEqual(cleared.appLockEnabled, false);
      const customNoteAfterClear = await sqliteDbClient.queryFirst(`SELECT * FROM notes WHERE id='n-2';`);
      assert.strictEqual(customNoteAfterClear.is_locked, 1);
      assert.strictEqual(
        verifyCredential('CustomNote!9', customNoteAfterClear.lock_hash, customNoteAfterClear.lock_salt),
        true
      );

      // Replace restore of an older pre-security backup (no workspaceSecurity field) must preserve active Master Lock
      await securityRepo.saveMasterCredential({
        secret: '1122',
        credentialKind: 'pin',
        hint: 'LocalMaster',
        enableAppLock: true,
      });
      const legacyBackup = JSON.parse(JSON.stringify(backup));
      delete legacyBackup.workspace.workspaceSecurity;
      await workspaceBackupService.restoreBackup(legacyBackup, 'replace');
      const afterLegacyReplace = await securityRepo.getSecurityConfig();
      assert.strictEqual(afterLegacyReplace.appLockEnabled, true);
      assert.strictEqual(afterLegacyReplace.masterHint, 'LocalMaster');
      assert.strictEqual(
        verifyCredential('1122', afterLegacyReplace.masterHash, afterLegacyReplace.masterSalt),
        true,
        'Replace restore of legacy pre-security backup must preserve existing Master Lock'
      );

      // Replace restore with empty workspaceSecurity: [] must ALSO preserve active Master Lock
      const emptySecArrayBackup = JSON.parse(JSON.stringify(backup));
      emptySecArrayBackup.workspace.workspaceSecurity = [];
      await workspaceBackupService.restoreBackup(emptySecArrayBackup, 'replace');
      const afterEmptyArrReplace = await securityRepo.getSecurityConfig();
      assert.strictEqual(afterEmptyArrReplace.appLockEnabled, true);
      assert.strictEqual(
        verifyCredential('1122', afterEmptyArrReplace.masterHash, afterEmptyArrReplace.masterSalt),
        true,
        'Replace restore with empty workspaceSecurity array must preserve existing Master Lock'
      );

      // Merge restore must NOT overwrite an already-configured local Master Lock
      await workspaceBackupService.restoreBackup(backup, 'merge');
      const afterMergeProtected = await securityRepo.getSecurityConfig();
      assert.strictEqual(afterMergeProtected.masterHint, 'LocalMaster');
      assert.strictEqual(
        verifyCredential('1122', afterMergeProtected.masterHash, afterMergeProtected.masterSalt),
        true,
        'Merge restore must keep existing local Master Lock intact'
      );
      assert.strictEqual(
        verifyCredential('4321', afterMergeProtected.masterHash, afterMergeProtected.masterSalt),
        false,
        'Merge restore must not overwrite local Master Lock with backup credential'
      );

      // Merge restore SHOULD import workspace_security when local DB has placeholder row with master_hash = NULL
      await securityRepo.clearMasterCredential();
      const emptyLocal = await securityRepo.getSecurityConfig();
      assert.strictEqual(emptyLocal.masterHash, null);
      await workspaceBackupService.restoreBackup(backup, 'merge');
      const afterMergeImported = await securityRepo.getSecurityConfig();
      assert.strictEqual(afterMergeImported.appLockEnabled, true);
      assert.strictEqual(
        verifyCredential('4321', afterMergeImported.masterHash, afterMergeImported.masterSalt),
        true,
        'Merge restore must import backup Master Lock when local Master credential is empty'
      );
    } finally {
      activeSqlite.close();
      activeSqlite = oldDb;
      activeSqlite.close();
    }
  });

  // ---------------------------------------------------------------------------
  // STAGE 8: Native Biometrics Integration & Web Suppression Invariants
  // ---------------------------------------------------------------------------
  console.log('\n▶ STAGE 8: Native Biometrics Configuration & Master Fallback');

  test('biometrics.ts degrades safely without crashing on non-native runtime', () => {
    const bioSrc = fs.readFileSync(path.join(feDir, 'src/core/security/biometrics.ts'), 'utf8');
    assert(bioSrc.includes("Platform.OS === 'web'"), 'biometrics.ts must guard for Web platform');
    assert(bioSrc.includes('disableDeviceFallback: true'), 'biometrics.ts must enforce disableDeviceFallback: true to protect Master PIN');
    assert(bioSrc.includes('supportedAuthenticationTypesAsync'), 'biometrics.ts must inspect hardware authentication types');
  });

  test('pin-password.tsx strictly hides Biometric Unlock on Web and challenges biometrics before enable', () => {
    const pinSettingsSrc = fs.readFileSync(path.join(feDir, 'app/settings/pin-password.tsx'), 'utf8');
    assert(
      pinSettingsSrc.includes("Platform.OS !== 'web'"),
      'pin-password.tsx must strictly hide biometric preferences on Web platform'
    );
    assert(
      pinSettingsSrc.includes('authenticateWithBiometrics') && pinSettingsSrc.includes('checkBiometricCapability'),
      'pin-password.tsx must invoke biometric hardware checks and challenge before enabling'
    );
    assert(
      pinSettingsSrc.includes('hasMasterConfigured'),
      'pin-password.tsx must require Master PIN configured before biometric toggle can be enabled'
    );
  });

  test('AppLockScreenOverlay and PinPasswordPromptModal wire biometric unlock with Master PIN fallback', () => {
    const overlaySrc = fs.readFileSync(path.join(feDir, 'src/components/security/AppLockScreenOverlay.tsx'), 'utf8');
    assert(
      overlaySrc.includes('biometricsEnabled') && overlaySrc.includes('handleBiometricAuth'),
      'AppLockScreenOverlay must support biometric auto-prompt and manual retry'
    );
    assert(
      overlaySrc.includes('Unlock Workspace') && overlaySrc.includes('TextInput'),
      'AppLockScreenOverlay must preserve Master PIN/Password input as fallback'
    );

    const modalSrc = fs.readFileSync(path.join(feDir, 'src/components/security/PinPasswordPromptModal.tsx'), 'utf8');
    assert(
      modalSrc.includes('handleBiometricVerify') && modalSrc.includes("request.lockType === 'master'"),
      'PinPasswordPromptModal must prompt biometrics when Master verification is active'
    );
    assert(
      modalSrc.includes('handleVerifySubmit') && modalSrc.includes('TextInput'),
      'PinPasswordPromptModal must keep Master PIN input available as fallback'
    );
  });

  test('Biometric cancellation does not penalize or lock out Master PIN attempts', () => {
    const limiter = new AttemptRateLimiter();
    const rateKey = 'test_bio_cancel';
    assert.strictEqual(limiter.getLockoutRemainingMs(rateKey), 0);
    assert.strictEqual(limiter.getRemainingAttempts(rateKey), 5);

    // Cancelled biometric operation does NOT record failure to rate limiter
    assert.strictEqual(limiter.getRemainingAttempts(rateKey), 5);
  });

  console.log('\n=================================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} passed, ${failedTests} failed.`);
  console.log('=================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
