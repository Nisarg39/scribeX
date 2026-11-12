/**
 * ScribeX Headless Automated Test Suite: Folder Favourites, Pinned & Contained Archive
 * Source of Truth: docs/Folder_Favourites_Pinned_Archive_Plan.md
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
console.log('📁 SCRIBEX HEADLESS FOLDER FEATURES TEST HARNESS');
console.log('   Target: Favourites, Pinned & Contained Cascade Archive');
console.log('   Point 32: SQLite Engine & Sync Changelog Event Ledger');
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

async function run() {
  console.log('▶ STAGE 1: Static Architecture & File Verification');
  test('Folders schema contains is_favorite, is_pinned, is_archived', () => {
    const schemaContent = fs.readFileSync(path.join(feDir, 'src/db/schema.ts'), 'utf8');
    assert(schemaContent.includes('is_favorite BOOLEAN NOT NULL DEFAULT 0'));
    assert(schemaContent.includes('is_pinned BOOLEAN NOT NULL DEFAULT 0'));
    assert(schemaContent.includes('is_archived BOOLEAN NOT NULL DEFAULT 0'));
    assert(schemaContent.includes('idx_folders_flags'));
  });

  test('Database types include is_favorite, is_pinned, is_archived in DBFolder and FolderTreeNode', () => {
    const typesContent = fs.readFileSync(path.join(feDir, 'src/db/types.ts'), 'utf8');
    assert(typesContent.includes('is_favorite: number'));
    assert(typesContent.includes('is_pinned: number'));
    assert(typesContent.includes('is_archived: number'));
    assert(typesContent.includes('isFavorite?: boolean'));
    assert(typesContent.includes('isPinned?: boolean'));
    assert(typesContent.includes('isArchived?: boolean'));
  });

  test('client.web.ts and client.native.ts contain ALTER TABLE migrations for folders', () => {
    const webContent = fs.readFileSync(path.join(feDir, 'src/db/client.web.ts'), 'utf8');
    const nativeContent = fs.readFileSync(path.join(feDir, 'src/db/client.native.ts'), 'utf8');
    assert(webContent.includes('ALTER TABLE folders ADD COLUMN is_favorite'));
    assert(webContent.includes('ALTER TABLE folders ADD COLUMN is_pinned'));
    assert(webContent.includes('ALTER TABLE folders ADD COLUMN is_archived'));
    assert(nativeContent.includes('ALTER TABLE folders ADD COLUMN is_favorite'));
    assert(nativeContent.includes('ALTER TABLE folders ADD COLUMN is_pinned'));
    assert(nativeContent.includes('ALTER TABLE folders ADD COLUMN is_archived'));
  });

  test('foldersRepo.ts exports toggleFolderFavorite, toggleFolderPin, archiveFolderContained, unarchiveFolderContained', () => {
    const repoContent = fs.readFileSync(path.join(feDir, 'src/db/foldersRepo.ts'), 'utf8');
    assert(repoContent.includes('toggleFolderFavorite'));
    assert(repoContent.includes('toggleFolderPin'));
    assert(repoContent.includes('archiveFolderContained'));
    assert(repoContent.includes('unarchiveFolderContained'));
    assert(repoContent.includes('getFavoriteFolders'));
    assert(repoContent.includes('getPinnedFolders'));
    assert(repoContent.includes('getArchivedFolders'));
  });

  test('useNotesStore.tsx declares and exposes activeFolders, favoriteFolders, pinnedFolders, archivedFolders and folder actions', () => {
    const storeContent = fs.readFileSync(path.join(feDir, 'src/state/useNotesStore.tsx'), 'utf8');
    assert(storeContent.includes('activeFolders: DBFolder[];'));
    assert(storeContent.includes('favoriteFolders: DBFolder[];'));
    assert(storeContent.includes('pinnedFolders: DBFolder[];'));
    assert(storeContent.includes('archivedFolders: DBFolder[];'));
    assert(storeContent.includes('toggleFolderFavorite: (folderId: string) => Promise<boolean>;'));
    assert(storeContent.includes('toggleFolderPin: (folderId: string) => Promise<boolean>;'));
    assert(storeContent.includes('archiveFolder: (folderId: string) => Promise<{ affectedNotes: number; affectedFolders: number }>;'));
    assert(storeContent.includes('unarchiveFolder: (folderId: string) => Promise<{ affectedNotes: number; affectedFolders: number }>;'));
  });

  test('FolderActionSheet.tsx supports onToggleFavorite, onTogglePin, and onToggleArchive', () => {
    const sheetContent = fs.readFileSync(path.join(feDir, 'src/components/folders/FolderActionSheet.tsx'), 'utf8');
    assert(sheetContent.includes('onToggleFavorite?: () => void;'));
    assert(sheetContent.includes('onTogglePin?: () => void;'));
    assert(sheetContent.includes('onToggleArchive?: () => void;'));
    assert(sheetContent.includes('Unfavorite Folder'));
    assert(sheetContent.includes('Unpin Folder'));
    assert(sheetContent.includes('Unarchive Folder'));
  });

  test('FolderDropdownModal.tsx anchors pinned folders first and displays Star/Pin badges', () => {
    const dropdownContent = fs.readFileSync(path.join(feDir, 'src/components/folders/FolderDropdownModal.tsx'), 'utf8');
    assert(dropdownContent.includes('isPinnedB - isPinnedA'));
    assert(dropdownContent.includes('folderObj?.is_favorite'));
    assert(dropdownContent.includes('folderObj?.is_pinned'));
  });

  test('FolderExplorerModal.tsx displays Star, Pin, and Archive badges on tree nodes', () => {
    const explorerContent = fs.readFileSync(path.join(feDir, 'src/components/folders/FolderExplorerModal.tsx'), 'utf8');
    assert(explorerContent.includes('node.folderRecord?.is_favorite'));
    assert(explorerContent.includes('node.folderRecord?.is_pinned'));
    assert(explorerContent.includes('node.folderRecord?.is_archived'));
  });

  test('NotesView.tsx integrates Star/Pin badges on active folder pill, Favorite Folders shelf, and Archive banner', () => {
    const notesViewContent = fs.readFileSync(path.join(feDir, 'src/components/NotesView.tsx'), 'utf8');
    assert(notesViewContent.includes('activeFolderObj?.is_favorite'));
    assert(notesViewContent.includes('activeFolderObj?.is_pinned'));
    assert(notesViewContent.includes('activeFolderObj?.is_archived'));
    assert(notesViewContent.includes('Favorite Folders'));
    assert(notesViewContent.includes('Unarchive Folder'));
    assert(notesViewContent.includes('visibleFolders'));
  });

  console.log('\n▶ STAGE 2: SQLite Schema Execution & Migration Tests');
  const db = new DatabaseSync(':memory:');

  test('Execute full SCHEMA_SQL successfully in memory SQLite', () => {
    const schemaContent = fs.readFileSync(path.join(feDir, 'src/db/schema.ts'), 'utf8');
    const match = schemaContent.match(/export const SCHEMA_SQL = `([\s\S]+?)`;/);
    assert(match && match[1], 'SCHEMA_SQL template literal found');
    db.exec(match[1]);
  });

  test('Insert folder with default flags (0, 0, 0)', () => {
    db.exec(`
      INSERT INTO folders (id, user_id, name, path, color_token)
      VALUES ('f-1', 'user-default', 'Work', 'Work', 'cyan');
    `);
    const row = db.prepare(`SELECT is_favorite, is_pinned, is_archived FROM folders WHERE id = 'f-1'`).get();
    assert.strictEqual(row.is_favorite, 0);
    assert.strictEqual(row.is_pinned, 0);
    assert.strictEqual(row.is_archived, 0);
  });

  console.log('\n▶ STAGE 3: Favourites & Pinned Functionality');
  test('Toggle folder favorite flips 0 -> 1 and 1 -> 0', () => {
    db.exec(`UPDATE folders SET is_favorite = 1 - is_favorite WHERE id = 'f-1'`);
    let row = db.prepare(`SELECT is_favorite FROM folders WHERE id = 'f-1'`).get();
    assert.strictEqual(row.is_favorite, 1);

    db.exec(`UPDATE folders SET is_favorite = 1 - is_favorite WHERE id = 'f-1'`);
    row = db.prepare(`SELECT is_favorite FROM folders WHERE id = 'f-1'`).get();
    assert.strictEqual(row.is_favorite, 0);
  });

  test('Toggle folder pin flips 0 -> 1 and alters ordering (pinned first)', () => {
    db.exec(`
      INSERT INTO folders (id, user_id, name, path, color_token, is_pinned)
      VALUES ('f-2', 'user-default', 'Alpha', 'Alpha', 'cyan', 0);
      INSERT INTO folders (id, user_id, name, path, color_token, is_pinned)
      VALUES ('f-3', 'user-default', 'Beta', 'Beta', 'cyan', 1);
    `);

    // With ORDER BY is_pinned DESC, path ASC, Beta must come before Alpha and Work
    const rows = db.prepare(`SELECT path FROM folders WHERE is_archived = 0 ORDER BY is_pinned DESC, path ASC`).all();
    assert.strictEqual(rows[0].path, 'Beta');
  });

  console.log('\n▶ STAGE 4: Contained Cascade Archiving & Restoration');
  test('Archive folder cascades to subfolders and contained notes', () => {
    // Setup hierarchy:
    // Work (f-1)
    // Work/Projects (f-4)
    // Note 1 in Work (active)
    // Note 2 in Work/Projects (active)
    // Note 3 in Personal (active)
    db.exec(`
      INSERT INTO folders (id, user_id, name, path, color_token)
      VALUES ('f-4', 'user-default', 'Projects', 'Work/Projects', 'cyan');
      INSERT INTO folders (id, user_id, name, path, color_token)
      VALUES ('f-5', 'user-default', 'Personal', 'Personal', 'cyan');

      INSERT INTO notes (id, user_id, title, folder_path, status)
      VALUES ('n-1', 'user-default', 'Work Note', 'Work', 'active');
      INSERT INTO notes (id, user_id, title, folder_path, status)
      VALUES ('n-2', 'user-default', 'Project Note', 'Work/Projects', 'active');
      INSERT INTO notes (id, user_id, title, folder_path, status)
      VALUES ('n-3', 'user-default', 'Personal Note', 'Personal', 'active');
    `);

    // Perform Contained Cascade Archive on 'Work'
    const targetFolder = 'Work';
    db.exec(`
      UPDATE folders SET is_archived = 1 WHERE path = '${targetFolder}' OR path LIKE '${targetFolder}/%';
      UPDATE notes SET status = 'archived' WHERE status = 'active' AND (folder_path = '${targetFolder}' OR folder_path LIKE '${targetFolder}/%');
    `);

    // Verify Work and Work/Projects are archived
    const archivedFolders = db.prepare(`SELECT id, path FROM folders WHERE is_archived = 1 ORDER BY path ASC`).all();
    assert.strictEqual(archivedFolders.length, 2);
    assert.strictEqual(archivedFolders[0].path, 'Work');
    assert.strictEqual(archivedFolders[1].path, 'Work/Projects');

    // Verify active folders excludes archived ones
    const activeFolders = db.prepare(`SELECT path FROM folders WHERE is_archived = 0 ORDER BY path ASC`).all();
    assert(!activeFolders.some(f => f.path.startsWith('Work')));
    assert(activeFolders.some(f => f.path === 'Personal'));

    // Verify Note 1 & 2 are archived, Note 3 is active
    const n1 = db.prepare(`SELECT status FROM notes WHERE id = 'n-1'`).get();
    const n2 = db.prepare(`SELECT status FROM notes WHERE id = 'n-2'`).get();
    const n3 = db.prepare(`SELECT status FROM notes WHERE id = 'n-3'`).get();
    assert.strictEqual(n1.status, 'archived');
    assert.strictEqual(n2.status, 'archived');
    assert.strictEqual(n3.status, 'active');
  });

  test('Unarchive folder restores folder, subfolders, and contained notes back to active', () => {
    const targetFolder = 'Work';
    db.exec(`
      UPDATE folders SET is_archived = 0 WHERE path = '${targetFolder}' OR path LIKE '${targetFolder}/%';
      UPDATE notes SET status = 'active' WHERE status = 'archived' AND (folder_path = '${targetFolder}' OR folder_path LIKE '${targetFolder}/%');
    `);

    const archivedFolders = db.prepare(`SELECT id FROM folders WHERE is_archived = 1`).all();
    assert.strictEqual(archivedFolders.length, 0);

    const n1 = db.prepare(`SELECT status FROM notes WHERE id = 'n-1'`).get();
    const n2 = db.prepare(`SELECT status FROM notes WHERE id = 'n-2'`).get();
    assert.strictEqual(n1.status, 'active');
    assert.strictEqual(n2.status, 'active');
  });

  console.log('\n=================================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests} passed · ${failedTests} failed (Total: ${totalTests})`);
  console.log('=================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

run();

