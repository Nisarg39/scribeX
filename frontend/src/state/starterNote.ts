/**
 * ScribeX Welcome Starter Note Definition (Point 37)
 * Source of truth: docs/future_ideas.md
 * 
 * Interactive pre-seeded note showcasing the 42 composable blocks,
 * slash commands (/), pastel color tokens, KaTeX formulas, interactive
 * checklists with task board sync, sample callouts, and offline reminder tips.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NoteItem, TaskItem, ComposableBlock } from '../types/note';

export const WELCOME_STARTER_NOTE_ID = 'note-welcome-starter';
export const STARTER_NOTE_INITIALIZED_KEY = 'scribex_starter_note_initialized';

export const WELCOME_STARTER_BLOCKS: ComposableBlock[] = [
  {
    id: 'wb-title-1',
    type: 'heading',
    content: 'Welcome to ScribeX: The Local-First Spatial Notebook',
    metadata: { level: 1 },
  },
  {
    id: 'wb-callout-info',
    type: 'callout',
    content:
      'ScribeX is designed around local-first SQLite WAL architecture with sub-5ms latency, full offline availability, and zero mandatory cloud lock-in. Your thoughts, files, and formulas stay strictly on your device.',
    metadata: { variant: 'info' },
  },
  {
    id: 'wb-heading-slash',
    type: 'heading',
    content: '⚡ The Slash Command System (/)',
    metadata: { level: 2 },
  },
  {
    id: 'wb-para-slash',
    type: 'paragraph',
    content:
      'Press Enter on a new line and type / anywhere to open the Slash Command Palette. You can instantly summon any of ScribeX\'s 42 composable input blocks: headings (/h1, /h2, /h3), checklists (/todo), equations (/math), callouts (/callout), kanban boards (/kanban), spreadsheets (/sheet), audio recorders (/audio), and code snippets (/code).',
  },
  {
    id: 'wb-heading-checklists',
    type: 'heading',
    content: '✅ Interactive Checklists & Unified Task Engine',
    metadata: { level: 2 },
  },
  {
    id: 'wb-checklist-1',
    type: 'checklist',
    content:
      'Tap any checkbox to test instant task state updates\nPriority tasks synchronize automatically to your global Tasks dock\nSet due dates and offline alarms directly on checklist items',
    metadata: {
      items: [
        {
          id: 'starter-task-1',
          text: 'Tap any checkbox to test instant task state updates',
          checked: true,
          priority: 'high',
          dueDate: 'Today',
          style: 'paragraph',
        },
        {
          id: 'starter-task-2',
          text: 'Priority tasks synchronize automatically to your global Tasks dock',
          checked: false,
          priority: 'urgent',
          dueDate: 'Today',
          style: 'paragraph',
        },
        {
          id: 'starter-task-3',
          text: 'Set due dates and offline alarms directly on checklist items',
          checked: false,
          priority: 'medium',
          dueDate: 'Tomorrow',
          style: 'paragraph',
        },
      ],
    },
  },
  {
    id: 'wb-heading-equations',
    type: 'heading',
    content: '🧮 Mathematical Formulas (KaTeX)',
    metadata: { level: 2 },
  },
  {
    id: 'wb-para-equations',
    type: 'paragraph',
    content:
      'Equations render instantly with zero lag. Click the formula below to inspect or edit the LaTeX source code:',
  },
  {
    id: 'wb-eq-euler',
    type: 'equation',
    content: 'e^{i\\pi} + 1 = 0',
    metadata: { displayMode: true },
  },
  {
    id: 'wb-eq-integral',
    type: 'equation',
    content: '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}',
    metadata: { displayMode: true },
  },
  {
    id: 'wb-heading-colors',
    type: 'heading',
    content: '🎨 Pastel Color Tokens & Spatial Note Tiles',
    metadata: { level: 2 },
  },
  {
    id: 'wb-callout-palette',
    type: 'callout',
    content:
      'Every note can be tinted with one of 7 pastel design tokens: Lime (#E5F28B), Apricot (#FFC96F), Cyan (#08C4E5), Coral (#FF9277), Lavender (#B18AF3), Pink (#F5A4C6), or Sky (#8EDCEB). Try switching this note\'s color in the header menu!',
    metadata: { variant: 'quote' },
  },
  {
    id: 'wb-heading-reminders',
    type: 'heading',
    content: '⏰ Offline Alarms & In-App Notification Center',
    metadata: { level: 2 },
  },
  {
    id: 'wb-callout-reminders',
    type: 'callout',
    content:
      'Set custom offline reminders for individual notes or tasks with flexible recurrence (Daily, Weekly, Weekdays). Fired alarms appear immediately inside your In-App Notification Center (top bell icon) with sound and haptic alerts.',
    metadata: { variant: 'warning' },
  },
  {
    id: 'wb-heading-security',
    type: 'heading',
    content: '🔒 Zero-Knowledge Security Vault',
    metadata: { level: 2 },
  },
  {
    id: 'wb-callout-security',
    type: 'callout',
    content:
      'Lock sensitive notes or entire folders with a Master PIN/Password or dedicated Custom credentials. Locked content uses zero-knowledge PBKDF2-HMAC-SHA256 derivation with 30-second brute-force lockouts and complete body exclusion from global search.',
    metadata: { variant: 'success' },
  },
  {
    id: 'wb-heading-code',
    type: 'heading',
    content: '🧭 Quick Reference & Cheatsheet',
    metadata: { level: 2 },
  },
  {
    id: 'wb-code-shortcuts',
    type: 'code',
    content:
      '// ScribeX Keyboard & Gesture Shortcuts:\n// /          -> Open 42-Block Slash Command Palette\n// Shift+Tab  -> Outdent checklist item\n// Tab        -> Indent checklist item\n// Long-Press -> Multi-select notes on Home screen\n// Esc        -> Dismiss modals & close active search',
    metadata: { language: 'typescript' },
  },
  {
    id: 'wb-para-conclusion',
    type: 'paragraph',
    content:
      'This starter canvas is completely yours. Feel free to edit its contents, add new blocks, test out checklists, or archive it whenever you\'re ready to create your own notes!',
  },
];

export const WELCOME_STARTER_NOTE: NoteItem = {
  id: WELCOME_STARTER_NOTE_ID,
  userId: 'user-default',
  folderPath: 'General',
  title: 'Welcome to ScribeX 👋',
  contentMarkdown:
    'Welcome to ScribeX: The Local-First Spatial Notebook.\n\nScribeX unites 42 composable input blocks, local SQLite WAL storage, interactive checklists, KaTeX mathematics, and zero-knowledge security vaults.',
  blocks: WELCOME_STARTER_BLOCKS,
  colorToken: 'lavender',
  isFavorite: true,
  isPinned: true,
  status: 'active',
  tags: ['getting-started', 'guide', 'scribex', 'blocks'],
  createdAt: 'Just now',
  updatedAt: 'Just now',
};

export const WELCOME_STARTER_TASKS: TaskItem[] = [
  {
    id: 'starter-task-1',
    userId: 'user-default',
    noteId: WELCOME_STARTER_NOTE_ID,
    noteTitle: 'Welcome to ScribeX 👋',
    noteColorToken: 'lavender',
    blockId: 'wb-checklist-1',
    title: 'Tap any checkbox to test instant task state updates',
    isCompleted: true,
    priority: 'high',
    dueDate: 'Today',
    createdAt: 'Just now',
    updatedAt: 'Just now',
  },
  {
    id: 'starter-task-2',
    userId: 'user-default',
    noteId: WELCOME_STARTER_NOTE_ID,
    noteTitle: 'Welcome to ScribeX 👋',
    noteColorToken: 'lavender',
    blockId: 'wb-checklist-1',
    title: 'Priority tasks synchronize automatically to your global Tasks dock',
    isCompleted: false,
    priority: 'urgent',
    dueDate: 'Today',
    createdAt: 'Just now',
    updatedAt: 'Just now',
  },
  {
    id: 'starter-task-3',
    userId: 'user-default',
    noteId: WELCOME_STARTER_NOTE_ID,
    noteTitle: 'Welcome to ScribeX 👋',
    noteColorToken: 'lavender',
    blockId: 'wb-checklist-1',
    title: 'Set due dates and offline alarms directly on checklist items',
    isCompleted: false,
    priority: 'medium',
    dueDate: 'Tomorrow',
    createdAt: 'Just now',
    updatedAt: 'Just now',
  },
];

/**
 * Ensures the Welcome Starter Note is present in the database if:
 * 1. The database currently has 0 notes (empty DB / purge), OR
 * 2. This is a first-time home visit after login or onboarding and the starter note has not yet been seeded.
 */
export async function ensureWelcomeStarterNote(
  notesRepo: {
    getNoteById: (id: string) => Promise<NoteItem | null>;
    createNote: (dto: any) => Promise<NoteItem>;
  },
  tasksRepo?: {
    createTask: (dto: any) => Promise<any>;
  },
  force = false
): Promise<NoteItem | null> {
  try {
    const existing = await notesRepo.getNoteById(WELCOME_STARTER_NOTE_ID);
    if (existing) {
      await AsyncStorage.setItem(STARTER_NOTE_INITIALIZED_KEY, 'true').catch(() => { });
      return existing;
    }

    if (!force) {
      const alreadyInitialized = await AsyncStorage.getItem(STARTER_NOTE_INITIALIZED_KEY);
      if (alreadyInitialized === 'true') {
        // User deliberately deleted or unseeded it in the past
        return null;
      }
    }

    const created = await notesRepo.createNote({
      id: WELCOME_STARTER_NOTE.id,
      userId: WELCOME_STARTER_NOTE.userId,
      folderPath: WELCOME_STARTER_NOTE.folderPath,
      title: WELCOME_STARTER_NOTE.title,
      contentMarkdown: WELCOME_STARTER_NOTE.contentMarkdown,
      blocks: WELCOME_STARTER_NOTE.blocks,
      colorToken: WELCOME_STARTER_NOTE.colorToken,
      isFavorite: WELCOME_STARTER_NOTE.isFavorite,
      isPinned: WELCOME_STARTER_NOTE.isPinned,
      tags: WELCOME_STARTER_NOTE.tags,
    });

    if (tasksRepo) {
      for (const t of WELCOME_STARTER_TASKS) {
        await tasksRepo.createTask({
          id: t.id,
          userId: t.userId,
          noteId: t.noteId,
          noteTitle: t.noteTitle,
          noteColorToken: t.noteColorToken,
          blockId: t.blockId,
          title: t.title,
          isCompleted: t.isCompleted,
          priority: t.priority,
          dueDate: t.dueDate,
        }).catch(() => { });
      }
    }

    await AsyncStorage.setItem(STARTER_NOTE_INITIALIZED_KEY, 'true').catch(() => { });
    return created;
  } catch (err) {
    console.warn('Failed to seed Welcome to ScribeX starter note:', err);
    return null;
  }
}

