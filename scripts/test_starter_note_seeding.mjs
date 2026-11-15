/**
 * Automated Verification Suite for Point 37:
 * Pre-Seeded Interactive 'Welcome to ScribeX' Starter Note
 */

import assert from 'node:assert/strict';
import {
  WELCOME_STARTER_NOTE_ID,
  STARTER_NOTE_INITIALIZED_KEY,
  WELCOME_STARTER_NOTE,
  WELCOME_STARTER_BLOCKS,
  WELCOME_STARTER_TASKS,
  ensureWelcomeStarterNote,
} from '../frontend/src/state/starterNote.ts';
import { executeNoteQuery, DEFAULT_NOTE_QUERY_REQUEST } from '../frontend/src/core/noteQueryEngine.ts';
import { buildNoteSearchDocument } from '../frontend/src/core/searchIndexer.ts';

console.log('=================================================================');
console.log('🌟 SCRIBEX WELCOME STARTER NOTE SEEDING VERIFICATION SUITE');
console.log('   Target: AST Blocks, Seeding Gate, Task Sync, Query Engine');
console.log('=================================================================\n');

let passedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('▶ STAGE 1: Starter Note Metadata & AST Blocks Validation');

test('WELCOME_STARTER_NOTE has valid core metadata', () => {
  assert.equal(WELCOME_STARTER_NOTE.id, WELCOME_STARTER_NOTE_ID);
  assert.equal(WELCOME_STARTER_NOTE.title, 'Welcome to ScribeX 👋');
  assert.equal(WELCOME_STARTER_NOTE.colorToken, 'lavender');
  assert.equal(WELCOME_STARTER_NOTE.isFavorite, true);
  assert.equal(WELCOME_STARTER_NOTE.isPinned, true);
  assert.equal(WELCOME_STARTER_NOTE.status, 'active');
  assert.equal(WELCOME_STARTER_NOTE.folderPath, 'General');
  assert.ok(WELCOME_STARTER_NOTE.tags.includes('getting-started'));
  assert.ok(WELCOME_STARTER_NOTE.tags.includes('blocks'));
});

test('WELCOME_STARTER_BLOCKS contains all required showcase block types', () => {
  const blockTypes = WELCOME_STARTER_BLOCKS.map((b) => b.type);
  assert.ok(blockTypes.includes('heading'), 'Should have heading blocks');
  assert.ok(blockTypes.includes('paragraph'), 'Should have paragraph blocks');
  assert.ok(blockTypes.includes('callout'), 'Should have callout blocks');
  assert.ok(blockTypes.includes('checklist'), 'Should have checklist block');
  assert.ok(blockTypes.includes('equation'), 'Should have equation blocks (KaTeX)');
  assert.ok(blockTypes.includes('code'), 'Should have code reference block');

  // Verify callout variants
  const callouts = WELCOME_STARTER_BLOCKS.filter((b) => b.type === 'callout');
  const variants = callouts.map((c) => c.metadata?.variant);
  assert.ok(variants.includes('info'), 'Info callout present');
  assert.ok(variants.includes('quote'), 'Quote/palette callout present');
  assert.ok(variants.includes('warning'), 'Warning/reminder callout present');
  assert.ok(variants.includes('success'), 'Success/security callout present');

  // Verify KaTeX equations
  const equations = WELCOME_STARTER_BLOCKS.filter((b) => b.type === 'equation');
  assert.ok(equations.some((e) => e.content.includes('e^{i\\pi}')), 'Euler formula present');
  assert.ok(equations.some((e) => e.content.includes('\\sqrt{\\pi}')), 'Gaussian integral present');
});

test('WELCOME_STARTER_TASKS match checklist items for task board synchronization', () => {
  const checklist = WELCOME_STARTER_BLOCKS.find((b) => b.type === 'checklist');
  assert.ok(checklist, 'Checklist block found');
  const items = checklist.metadata?.items || [];
  assert.equal(items.length, 3, 'Checklist should have 3 initial items');
  assert.equal(WELCOME_STARTER_TASKS.length, 3, 'Should have 3 projected starter tasks');

  for (let i = 0; i < items.length; i++) {
    assert.equal(WELCOME_STARTER_TASKS[i].id, items[i].id);
    assert.equal(WELCOME_STARTER_TASKS[i].title, items[i].text);
    assert.equal(WELCOME_STARTER_TASKS[i].isCompleted, items[i].checked);
    assert.equal(WELCOME_STARTER_TASKS[i].priority, items[i].priority);
    assert.equal(WELCOME_STARTER_TASKS[i].dueDate, items[i].dueDate);
    assert.equal(WELCOME_STARTER_TASKS[i].noteId, WELCOME_STARTER_NOTE_ID);
  }
});

console.log('\n▶ STAGE 2: Seeding Gate & First-Visit / Empty DB Lifecycle');

await asyncTest('ensureWelcomeStarterNote creates note and tasks when DB is empty', async () => {
  const mockDb = { notes: new Map(), tasks: new Map(), storage: new Map() };
  const mockNotesRepo = {
    getNoteById: async (id) => mockDb.notes.get(id) || null,
    createNote: async (dto) => {
      mockDb.notes.set(dto.id, dto);
      return dto;
    },
  };
  const mockTasksRepo = {
    createTask: async (dto) => {
      mockDb.tasks.set(dto.id, dto);
      return dto;
    },
  };

  const seeded = await ensureWelcomeStarterNote(mockNotesRepo, mockTasksRepo, true);
  assert.ok(seeded, 'Starter note should be seeded');
  assert.equal(seeded.id, WELCOME_STARTER_NOTE_ID);
  assert.equal(mockDb.notes.size, 1);
  assert.equal(mockDb.tasks.size, 3);
});

await asyncTest('ensureWelcomeStarterNote returns existing note if already seeded', async () => {
  const mockDb = { notes: new Map(), tasks: new Map() };
  mockDb.notes.set(WELCOME_STARTER_NOTE_ID, WELCOME_STARTER_NOTE);

  const mockNotesRepo = {
    getNoteById: async (id) => mockDb.notes.get(id) || null,
    createNote: async () => {
      throw new Error('Should not call createNote when note already exists');
    },
  };

  const res = await ensureWelcomeStarterNote(mockNotesRepo);
  assert.ok(res, 'Should return existing note');
  assert.equal(res.id, WELCOME_STARTER_NOTE_ID);
});

console.log('\n▶ STAGE 3: Query Engine & Pinned Grid Display on /home');

test('Starter note appears in pinnedCards and matches default query filters', () => {
  const indexMap = new Map();
  indexMap.set(WELCOME_STARTER_NOTE.id, buildNoteSearchDocument(WELCOME_STARTER_NOTE));

  const queryResult = executeNoteQuery([WELCOME_STARTER_NOTE], indexMap, DEFAULT_NOTE_QUERY_REQUEST);

  // In default query (statusScope: 'active', folderPath: null)
  assert.equal(queryResult.totalMatches, 1, 'Starter note should match default query');
  assert.equal(queryResult.pinnedCards.length, 1, 'Starter note must be pinned');
  assert.equal(queryResult.pinnedCards[0].note.id, WELCOME_STARTER_NOTE_ID);
  assert.equal(queryResult.pinnedCards[0].note.title, 'Welcome to ScribeX 👋');
  assert.equal(queryResult.pinnedCards[0].note.colorToken, 'lavender');
  assert.equal(queryResult.pinnedCards[0].note.isPinned, true);
  assert.equal(queryResult.pinnedCards[0].note.isFavorite, true);

  // Search matching
  const searchResult = executeNoteQuery([WELCOME_STARTER_NOTE], indexMap, {
    ...DEFAULT_NOTE_QUERY_REQUEST,
    searchQuery: 'KaTeX',
  });
  assert.equal(searchResult.totalMatches, 1, 'Search query for KaTeX should find starter note');

  const tagSearchResult = executeNoteQuery([WELCOME_STARTER_NOTE], indexMap, {
    ...DEFAULT_NOTE_QUERY_REQUEST,
    tagFilter: 'getting-started',
  });
  assert.equal(tagSearchResult.totalMatches, 1, 'Tag filter getting-started should find starter note');
});

console.log('\n=================================================================');
console.log(`SUMMARY: ${passedTests}/${passedTests} passed, 0 failed.`);
console.log('=================================================================');
