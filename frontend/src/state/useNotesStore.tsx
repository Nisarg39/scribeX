import React, { createContext, useContext, useState, useEffect } from 'react';
import { NoteItem, TaskItem, ComposableBlock } from '../types/note';
import { NoteColorToken } from '../theme/tokens';
import { dbClient } from '../db/client';
import { DBNote, DBTask } from '../db/types';

interface NotesContextValue {
  notes: NoteItem[];
  tasks: TaskItem[];
  activeFilter: string;
  isLoading: boolean;
  setActiveFilter: (filter: string) => void;
  addNote: (title: string, content: string, colorToken?: NoteColorToken, folderPath?: string) => Promise<void>;
  toggleFavorite: (noteId: string) => Promise<void>;
  addTask: (title: string, noteId?: string, noteTitle?: string, noteColorToken?: NoteColorToken) => Promise<void>;
  toggleTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  refreshFromDB: () => Promise<void>;
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

const NotesContext = createContext<NotesContextValue>({
  notes: [],
  tasks: [],
  activeFilter: 'all',
  isLoading: true,
  setActiveFilter: () => {},
  addNote: async () => {},
  toggleFavorite: async () => {},
  addTask: async () => {},
  toggleTask: async () => {},
  deleteTask: async () => {},
  refreshFromDB: async () => {},
});

export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load notes and tasks from SQLite on initial mount
  const refreshFromDB = async () => {
    try {
      const dbNotes = await dbClient.query<DBNote>(
        `SELECT * FROM notes WHERE status != 'trashed' ORDER BY is_pinned DESC, updated_at DESC;`
      );

      const dbTasks = await dbClient.query<DBTask>(
        `SELECT * FROM tasks ORDER BY is_completed ASC, created_at DESC;`
      );

      // Convert DB rows to UI models
      const mappedNotes: NoteItem[] = dbNotes.map((n) => {
        let parsedBlocks: ComposableBlock[] = [];
        try {
          parsedBlocks = JSON.parse(n.blocks_json);
        } catch {
          parsedBlocks = [{ id: `b-${n.id}`, type: 'paragraph', content: n.content_markdown }];
        }

        return {
          id: n.id,
          userId: n.user_id,
          folderId: n.folder_id || undefined,
          folderPath: n.folder_path || undefined,
          title: n.title,
          contentMarkdown: n.content_markdown,
          blocks: parsedBlocks,
          colorToken: n.color_token as NoteColorToken,
          isFavorite: n.is_favorite === 1,
          isPinned: n.is_pinned === 1,
          status: n.status,
          tags: ['sqlite-synced'],
          createdAt: n.created_at,
          updatedAt: n.updated_at,
        };
      });

      const mappedTasks: TaskItem[] = dbTasks.map((t) => ({
        id: t.id,
        userId: t.user_id,
        noteId: t.note_id || undefined,
        noteTitle: t.note_title || undefined,
        noteColorToken: (t.note_color_token as NoteColorToken) || undefined,
        blockId: t.block_id || undefined,
        title: t.title,
        isCompleted: t.is_completed === 1,
        priority: t.priority,
        dueDate: t.due_date || undefined,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));

      setNotes(mappedNotes);
      setTasks(mappedTasks);
    } catch (err) {
      console.warn('Could not load from SQLite, falling back to local state:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshFromDB();
  }, []);

  const addNote = async (
    title: string,
    content: string,
    colorToken?: NoteColorToken,
    folderPath: string = 'General'
  ) => {
    const nextColor = colorToken || PASTEL_PALETTE[notes.length % PASTEL_PALETTE.length];
    const noteId = `note-${Date.now()}`;
    const cleanTitle = title.trim() || 'Untitled Note';
    const cleanContent = content.trim();
    const blocks: ComposableBlock[] = [
      { id: `b-${Date.now()}`, type: 'paragraph', content: cleanContent }
    ];
    const blocksJson = JSON.stringify(blocks);

    const newNote: NoteItem = {
      id: noteId,
      userId: 'user-default',
      folderPath,
      title: cleanTitle,
      contentMarkdown: cleanContent,
      blocks,
      colorToken: nextColor,
      isFavorite: false,
      isPinned: false,
      status: 'active',
      tags: ['quick-capture'],
      createdAt: 'Just now',
      updatedAt: 'Just now',
    };

    // Optimistic UI Update
    setNotes((prev) => [newNote, ...prev]);

    // Persist into SQLite
    try {
      await dbClient.run(
        `INSERT INTO notes (
          id, user_id, folder_path, title, content_markdown, blocks_json, color_token, is_favorite, is_pinned
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        [noteId, 'user-default', folderPath, cleanTitle, cleanContent, blocksJson, nextColor]
      );

      // Log changelog event for Phase 2 Delta Sync
      await dbClient.run(
        `INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [`log-${Date.now()}`, 'user-default', 1, 'note', noteId, 'insert', JSON.stringify(newNote)]
      );
    } catch (err) {
      console.warn('Failed to persist note into SQLite:', err);
    }
  };

  const toggleFavorite = async (noteId: string) => {
    // Optimistic UI Update
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, isFavorite: !n.isFavorite } : n))
    );

    // Persist into SQLite
    try {
      await dbClient.run(
        `UPDATE notes 
         SET is_favorite = (CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END), updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?;`,
        [noteId]
      );

      await dbClient.run(
        `INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [`log-${Date.now()}`, 'user-default', 1, 'note', noteId, 'update', JSON.stringify({ toggleFavorite: true })]
      );
    } catch (err) {
      console.warn('Failed to update favorite in SQLite:', err);
    }
  };

  const addTask = async (
    title: string,
    noteId?: string,
    noteTitle?: string,
    noteColorToken?: NoteColorToken
  ) => {
    if (!title.trim()) return;
    const taskId = `task-${Date.now()}`;
    const cleanTitle = title.trim();

    const newTask: TaskItem = {
      id: taskId,
      userId: 'user-default',
      noteId,
      noteTitle,
      noteColorToken,
      title: cleanTitle,
      isCompleted: false,
      priority: 'none',
      dueDate: 'Today',
      createdAt: 'Just now',
      updatedAt: 'Just now',
    };

    // Optimistic UI Update
    setTasks((prev) => [newTask, ...prev]);

    // Persist into SQLite
    try {
      await dbClient.run(
        `INSERT INTO tasks (
          id, user_id, note_id, note_title, note_color_token, title, is_completed, priority, due_date
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 'none', 'Today');`,
        [taskId, 'user-default', noteId || null, noteTitle || null, noteColorToken || null, cleanTitle]
      );

      await dbClient.run(
        `INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [`log-${Date.now()}`, 'user-default', 1, 'task', taskId, 'insert', JSON.stringify(newTask)]
      );
    } catch (err) {
      console.warn('Failed to insert task into SQLite:', err);
    }
  };

  const toggleTask = async (taskId: string) => {
    // Optimistic UI Update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t))
    );

    // Persist into SQLite
    try {
      await dbClient.run(
        `UPDATE tasks 
         SET is_completed = (CASE WHEN is_completed = 1 THEN 0 ELSE 1 END), updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?;`,
        [taskId]
      );

      await dbClient.run(
        `INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [`log-${Date.now()}`, 'user-default', 1, 'task', taskId, 'update', JSON.stringify({ toggleCompleted: true })]
      );
    } catch (err) {
      console.warn('Failed to toggle task in SQLite:', err);
    }
  };

  const deleteTask = async (taskId: string) => {
    // Optimistic UI Update
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    // Persist into SQLite
    try {
      await dbClient.run(`DELETE FROM tasks WHERE id = ?;`, [taskId]);

      await dbClient.run(
        `INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [`log-${Date.now()}`, 'user-default', 1, 'task', taskId, 'delete', JSON.stringify({ id: taskId })]
      );
    } catch (err) {
      console.warn('Failed to delete task in SQLite:', err);
    }
  };

  return (
    <NotesContext.Provider
      value={{
        notes,
        tasks,
        activeFilter,
        isLoading,
        setActiveFilter,
        addNote,
        toggleFavorite,
        addTask,
        toggleTask,
        deleteTask,
        refreshFromDB,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
};

export const useNotesStore = () => useContext(NotesContext);
