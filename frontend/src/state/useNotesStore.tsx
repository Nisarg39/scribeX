import React, { createContext, useContext, useState, useEffect } from 'react';
import { NoteItem, TaskItem, ComposableBlock } from '../types/note';
import { NoteColorToken } from '../theme/tokens';
import { notesRepo } from '../db/notesRepo';
import { tasksRepo } from '../db/tasksRepo';

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

  const refreshFromDB = async () => {
    try {
      const [fetchedNotes, fetchedTasks] = await Promise.all([
        notesRepo.listNotes(),
        tasksRepo.listTasks(),
      ]);

      setNotes(fetchedNotes);
      setTasks(fetchedTasks);
    } catch (err) {
      console.warn('Failed to load notes/tasks from repositories:', err);
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
    const cleanTitle = title.trim() || 'Untitled Note';
    const cleanContent = content.trim();

    // Optimistic UI placeholder
    const tempId = `note-${Date.now()}`;
    const optimisticNote: NoteItem = {
      id: tempId,
      userId: 'user-default',
      folderPath,
      title: cleanTitle,
      contentMarkdown: cleanContent,
      blocks: [{ id: `b-${Date.now()}`, type: 'paragraph', content: cleanContent }],
      colorToken: nextColor,
      isFavorite: false,
      isPinned: false,
      status: 'active',
      tags: ['quick-capture'],
      createdAt: 'Just now',
      updatedAt: 'Just now',
    };

    setNotes((prev) => [optimisticNote, ...prev]);

    try {
      const created = await notesRepo.createNote({
        id: tempId,
        title: cleanTitle,
        contentMarkdown: cleanContent,
        folderPath,
        colorToken: nextColor,
      });

      // Update state with confirmed persisted item
      setNotes((prev) => prev.map((n) => (n.id === tempId ? created : n)));
    } catch (err) {
      console.warn('Failed to persist note via notesRepo:', err);
    }
  };

  const toggleFavorite = async (noteId: string) => {
    // Optimistic update
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, isFavorite: !n.isFavorite } : n))
    );

    try {
      await notesRepo.toggleFavorite(noteId);
    } catch (err) {
      console.warn('Failed to toggle favorite via notesRepo:', err);
    }
  };

  const addTask = async (
    title: string,
    noteId?: string,
    noteTitle?: string,
    noteColorToken?: NoteColorToken
  ) => {
    if (!title.trim()) return;
    const tempId = `task-${Date.now()}`;
    const cleanTitle = title.trim();

    const optimisticTask: TaskItem = {
      id: tempId,
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

    setTasks((prev) => [optimisticTask, ...prev]);

    try {
      const created = await tasksRepo.createTask({
        id: tempId,
        title: cleanTitle,
        noteId,
        noteTitle,
        noteColorToken,
      });

      setTasks((prev) => prev.map((t) => (t.id === tempId ? created : t)));
    } catch (err) {
      console.warn('Failed to persist task via tasksRepo:', err);
    }
  };

  const toggleTask = async (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t))
    );

    try {
      await tasksRepo.toggleTask(taskId);
    } catch (err) {
      console.warn('Failed to toggle task via tasksRepo:', err);
    }
  };

  const deleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      await tasksRepo.deleteTask(taskId);
    } catch (err) {
      console.warn('Failed to delete task via tasksRepo:', err);
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
