import React, { createContext, useContext, useState } from 'react';
import { NoteItem, TaskItem } from '../types/note';
import { NoteColors, NoteColorToken } from '../theme/tokens';

interface NotesContextValue {
  notes: NoteItem[];
  tasks: TaskItem[];
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
  addNote: (title: string, content: string, colorToken?: NoteColorToken, folderPath?: string) => void;
  toggleFavorite: (noteId: string) => void;
  addTask: (title: string, noteId?: string, noteTitle?: string, noteColorToken?: NoteColorToken) => void;
  toggleTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
}

const PASTEL_PALETTE: NoteColorToken[] = [
  'lime',
  'apricot',
  'cyan',
  'coral',
  'lavender',
  'pink',
  'sky',
];

const INITIAL_NOTES: NoteItem[] = [
  {
    id: 'note-1',
    userId: 'user-default',
    folderPath: 'Work/Projects/ScribeX',
    title: 'Sprint Checklist & Action Items',
    contentMarkdown: 'Task engine single source of truth: checklist blocks inside notes reflect instantly on the global task board without data duplication.',
    blocks: [
      { id: 'b1-1', type: 'paragraph', content: 'Single source of truth between note checklists and tasks ledger.' },
      { id: 'b1-2', type: 'checklist', content: 'Configure SQLite WAL mode for sub-5ms latency' },
      { id: 'b1-3', type: 'checklist', content: 'Implement two-part Notes & Tasks floating dock' },
    ],
    colorToken: 'lime',
    isFavorite: true,
    isPinned: true,
    status: 'active',
    tags: ['sprint', 'architecture'],
    createdAt: 'Today',
    updatedAt: 'Just now',
  },
  {
    id: 'note-2',
    userId: 'user-default',
    folderPath: 'Work/Projects/ScribeX',
    title: 'Universal Engine Architecture',
    contentMarkdown: 'Unifying 42 input methods into composable content blocks. Local-first SQLite WAL ensures sub-5ms latency across all platforms.',
    blocks: [
      { id: 'b2-1', type: 'paragraph', content: 'Unifying 42 input methods into composable content blocks.' },
      { id: 'b2-2', type: 'code', content: 'CREATE TABLE notes (id TEXT PRIMARY KEY, sync_rev INT);' },
    ],
    colorToken: 'apricot',
    isFavorite: false,
    isPinned: false,
    status: 'active',
    tags: ['architecture', 'v1'],
    createdAt: 'Today',
    updatedAt: '1h ago',
  },
  {
    id: 'note-3',
    userId: 'user-default',
    folderPath: 'General',
    title: 'Offline Delta Sync & Git Vault',
    contentMarkdown: 'Bidirectional sync: local SQLite commits append to sync_changelog. Server pushes Git commits to markdown vault.',
    blocks: [
      { id: 'b3-1', type: 'paragraph', content: 'Bidirectional sync engine.' },
    ],
    colorToken: 'cyan',
    isFavorite: true,
    isPinned: false,
    status: 'active',
    tags: ['sync', 'vault'],
    createdAt: 'Yesterday',
    updatedAt: 'Yesterday',
  },
  {
    id: 'note-4',
    userId: 'user-default',
    folderPath: 'Research',
    title: 'Bidirectional Relations & Backlinks',
    contentMarkdown: 'Knowledge graph links (relates_to, supersedes, derived_from) allow traversal across folder boundaries freely.',
    blocks: [
      { id: 'b4-1', type: 'paragraph', content: 'Knowledge graph lateral connections.' },
      { id: 'b4-2', type: 'relation', content: '[[Universal Engine Architecture]]', metadata: { relation: 'supersedes' } },
    ],
    colorToken: 'lavender',
    isFavorite: false,
    isPinned: false,
    status: 'active',
    tags: ['graph', 'ideas'],
    createdAt: 'Oct 25',
    updatedAt: 'Oct 25',
  },
];

const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'task-1',
    userId: 'user-default',
    noteId: 'note-1',
    noteTitle: 'Sprint Checklist',
    noteColorToken: 'lime',
    title: 'Configure SQLite WAL mode for sub-5ms latency',
    isCompleted: true,
    priority: 'high',
    dueDate: 'Today',
    createdAt: 'Today',
    updatedAt: 'Just now',
  },
  {
    id: 'task-2',
    userId: 'user-default',
    noteId: 'note-1',
    noteTitle: 'Sprint Checklist',
    noteColorToken: 'lime',
    title: 'Implement two-part Notes & Tasks floating dock',
    isCompleted: false,
    priority: 'urgent',
    dueDate: 'Today',
    createdAt: 'Today',
    updatedAt: 'Just now',
  },
  {
    id: 'task-3',
    userId: 'user-default',
    noteId: 'note-2',
    noteTitle: 'Universal Engine',
    noteColorToken: 'apricot',
    title: 'Review 42 composable input block AST definitions',
    isCompleted: false,
    priority: 'medium',
    dueDate: 'Tomorrow',
    createdAt: 'Today',
    updatedAt: 'Today',
  },
  {
    id: 'task-4',
    userId: 'user-default',
    title: 'Test local offline storage across desktop and mobile browsers',
    isCompleted: false,
    priority: 'low',
    dueDate: 'Oct 30',
    createdAt: 'Yesterday',
    updatedAt: 'Yesterday',
  },
];

const NotesContext = createContext<NotesContextValue>({
  notes: INITIAL_NOTES,
  tasks: INITIAL_TASKS,
  activeFilter: 'all',
  setActiveFilter: () => {},
  addNote: () => {},
  toggleFavorite: () => {},
  addTask: () => {},
  toggleTask: () => {},
  deleteTask: () => {},
});

export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<NoteItem[]>(INITIAL_NOTES);
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const addNote = (title: string, content: string, colorToken?: NoteColorToken, folderPath: string = 'General') => {
    // Pick next pastel color if not specified
    const nextColor = colorToken || PASTEL_PALETTE[notes.length % PASTEL_PALETTE.length];
    const newNote: NoteItem = {
      id: `note-${Date.now()}`,
      userId: 'user-default',
      folderPath,
      title: title.trim() || 'Untitled Note',
      contentMarkdown: content.trim(),
      blocks: [
        { id: `b-${Date.now()}`, type: 'paragraph', content: content.trim() }
      ],
      colorToken: nextColor,
      isFavorite: false,
      isPinned: false,
      status: 'active',
      tags: ['quick-capture'],
      createdAt: 'Just now',
      updatedAt: 'Just now',
    };

    setNotes((prev) => [newNote, ...prev]);
  };

  const toggleFavorite = (noteId: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, isFavorite: !n.isFavorite } : n))
    );
  };

  const addTask = (title: string, noteId?: string, noteTitle?: string, noteColorToken?: NoteColorToken) => {
    if (!title.trim()) return;
    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      userId: 'user-default',
      noteId,
      noteTitle,
      noteColorToken,
      title: title.trim(),
      isCompleted: false,
      priority: 'none',
      dueDate: 'Today',
      createdAt: 'Just now',
      updatedAt: 'Just now',
    };

    setTasks((prev) => [newTask, ...prev]);
  };

  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t))
    );
  };

  const deleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  return (
    <NotesContext.Provider
      value={{
        notes,
        tasks,
        activeFilter,
        setActiveFilter,
        addNote,
        toggleFavorite,
        addTask,
        toggleTask,
        deleteTask,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
};

export const useNotesStore = () => useContext(NotesContext);
