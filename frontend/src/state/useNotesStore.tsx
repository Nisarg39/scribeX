import React, { createContext, useContext, useState, useEffect } from 'react';
import { NoteItem, TaskItem, ComposableBlock, TaskPriority } from '../types/note';
import { NoteColorToken } from '../theme/tokens';
import { notesRepo } from '../db/notesRepo';
import { tasksRepo } from '../db/tasksRepo';
import { foldersRepo } from '../db/foldersRepo';
import { tagsRepo } from '../db/tagsRepo';
import { DBFolder } from '../db/types';
import { serializeBlocksToMarkdown } from '../core/astSerializer';

interface NotesContextValue {
  notes: NoteItem[];
  tasks: TaskItem[];
  folders: DBFolder[];
  tags: string[];
  activeFilter: string;
  isLoading: boolean;
  isEditingNote: boolean;
  setIsEditingNote: (editing: boolean) => void;
  setActiveFilter: (filter: string) => void;
  addNote: (
    title: string,
    content: string,
    colorToken?: NoteColorToken,
    folderPath?: string,
    tags?: string[]
  ) => Promise<NoteItem>;
  updateNote: (updated: NoteItem) => void;
  deleteNote: (noteId: string) => Promise<void>;
  toggleFavorite: (noteId: string) => Promise<void>;
  togglePin: (noteId: string) => Promise<void>;
  archiveNote: (noteId: string) => Promise<void>;
  unarchiveNote: (noteId: string) => Promise<void>;
  restoreNote: (noteId: string) => Promise<void>;
  permanentlyDeleteNote: (noteId: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  createFolder: (name: string, parentPath?: string) => Promise<DBFolder>;
  renameFolder: (id: string, newName: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  moveNoteToFolder: (noteId: string, folderPath: string, folderId?: string) => Promise<void>;
  setNoteTags: (noteId: string, tags: string[]) => Promise<void>;
  addTask: (
    title: string,
    priority?: TaskPriority,
    dueDate?: string,
    noteId?: string,
    noteTitle?: string,
    noteColorToken?: NoteColorToken
  ) => Promise<void>;
  toggleTask: (taskId: string) => Promise<void>;
  updateTaskPriority: (taskId: string, priority: TaskPriority) => Promise<void>;
  updateTaskDueDate: (taskId: string, dueDate: string) => Promise<void>;
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
  folders: [],
  tags: [],
  activeFilter: 'all',
  isLoading: true,
  isEditingNote: false,
  setIsEditingNote: () => {},
  setActiveFilter: () => {},
  addNote: async () => ({} as NoteItem),
  updateNote: () => {},
  deleteNote: async () => {},
  toggleFavorite: async () => {},
  togglePin: async () => {},
  archiveNote: async () => {},
  unarchiveNote: async () => {},
  restoreNote: async () => {},
  permanentlyDeleteNote: async () => {},
  emptyTrash: async () => {},
  createFolder: async () => ({} as DBFolder),
  renameFolder: async () => {},
  deleteFolder: async () => {},
  moveNoteToFolder: async () => {},
  setNoteTags: async () => {},
  addTask: async () => {},
  toggleTask: async () => {},
  updateTaskPriority: async () => {},
  updateTaskDueDate: async () => {},
  deleteTask: async () => {},
  refreshFromDB: async () => {},
});

export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [folders, setFolders] = useState<DBFolder[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEditingNote, setIsEditingNote] = useState<boolean>(false);

  const refreshFromDB = async () => {
    try {
      const [allNotes, allTasks, fetchedFolders, fetchedTags] = await Promise.all([
        notesRepo.listNotes(), // Active + Archived notes (non-trashed)
        tasksRepo.listTasks(),
        foldersRepo.listFolders(),
        tagsRepo.listTags(),
      ]);

      // Also fetch trashed notes so trash bin view can inspect them
      let trashedNotes: NoteItem[] = [];
      try {
        trashedNotes = await notesRepo.listNotes({ status: 'trashed' });
      } catch (_) {}

      // Combine into unified store
      const combinedNotes = [...allNotes, ...trashedNotes];
      setNotes(combinedNotes);
      setTasks(allTasks);
      setFolders(fetchedFolders);

      // Extract unique tags from notes + tag repository
      const noteTags = combinedNotes.flatMap((n) => n.tags || []);
      const dbTagNames = fetchedTags.map((t) => t.name);
      const uniqueTags = Array.from(new Set([...noteTags, ...dbTagNames])).filter(Boolean);
      setTags(uniqueTags);
    } catch (err) {
      console.warn('Failed to load notes/tasks/folders/tags from repositories:', err);
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
    folderPath: string = 'General',
    initialTags: string[] = []
  ): Promise<NoteItem> => {
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
      tags: initialTags,
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
        tags: initialTags,
      });

      setNotes((prev) => prev.map((n) => (n.id === tempId ? created : n)));
      if (initialTags.length > 0) {
        setTags((prev) => Array.from(new Set([...prev, ...initialTags])));
      }
      return created;
    } catch (err) {
      console.warn('Failed to persist note via notesRepo:', err);
      return optimisticNote;
    }
  };

  const updateNote = (updated: NoteItem) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  const deleteNote = async (noteId: string) => {
    // Soft delete to trash
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, status: 'trashed' } : n))
    );
    try {
      await notesRepo.softDeleteNote(noteId);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to soft-delete note via notesRepo:', err);
    }
  };

  const toggleFavorite = async (noteId: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, isFavorite: !n.isFavorite } : n))
    );

    try {
      await notesRepo.toggleFavorite(noteId);
    } catch (err) {
      console.warn('Failed to toggle favorite via notesRepo:', err);
    }
  };

  const togglePin = async (noteId: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, isPinned: !n.isPinned } : n))
    );

    try {
      await notesRepo.togglePin(noteId);
    } catch (err) {
      console.warn('Failed to toggle pin via notesRepo:', err);
    }
  };

  const archiveNote = async (noteId: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, status: 'archived' } : n))
    );
    try {
      await notesRepo.archiveNote(noteId);
    } catch (err) {
      console.warn('Failed to archive note via notesRepo:', err);
    }
  };

  const unarchiveNote = async (noteId: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, status: 'active' } : n))
    );
    try {
      await notesRepo.unarchiveNote(noteId);
    } catch (err) {
      console.warn('Failed to unarchive note via notesRepo:', err);
    }
  };

  const restoreNote = async (noteId: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, status: 'active' } : n))
    );
    try {
      await notesRepo.restoreNote(noteId);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to restore note via notesRepo:', err);
    }
  };

  const permanentlyDeleteNote = async (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    setTasks((prev) => prev.filter((t) => t.noteId !== noteId));
    try {
      await notesRepo.permanentlyDeleteNote(noteId);
      await tasksRepo.syncNoteChecklists(noteId, '', 'apricot', []);
    } catch (err) {
      console.warn('Failed to permanently delete note via notesRepo:', err);
    }
  };

  const emptyTrash = async () => {
    const trashed = notes.filter((n) => n.status === 'trashed');
    setNotes((prev) => prev.filter((n) => n.status !== 'trashed'));
    for (const n of trashed) {
      try {
        await notesRepo.permanentlyDeleteNote(n.id);
      } catch (_) {}
    }
  };

  const createFolder = async (name: string, parentPath?: string): Promise<DBFolder> => {
    const cleanName = name.trim();
    const path = parentPath ? `${parentPath}/${cleanName}` : cleanName;
    const created = await foldersRepo.createFolder({
      name: cleanName,
      path,
      colorToken: 'cyan',
    });
    setFolders((prev) => [...prev, created]);
    return created;
  };

  const renameFolder = async (id: string, newName: string) => {
    await foldersRepo.renameFolder(id, newName);
    await refreshFromDB();
  };

  const deleteFolder = async (id: string) => {
    await foldersRepo.deleteFolder(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
  };

  const moveNoteToFolder = async (noteId: string, folderPath: string, folderId?: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, folderPath, folderId } : n))
    );
    try {
      await notesRepo.updateNote(noteId, { folderPath, folderId });
    } catch (err) {
      console.warn('Failed to move note folder:', err);
    }
  };

  const setNoteTags = async (noteId: string, newTags: string[]) => {
    const cleanTags = newTags.map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, tags: cleanTags } : n))
    );
    try {
      await notesRepo.updateNote(noteId, { tags: cleanTags });
      setTags((prev) => Array.from(new Set([...prev, ...cleanTags])));
    } catch (err) {
      console.warn('Failed to set note tags:', err);
    }
  };

  const addTask = async (
    title: string,
    priority: TaskPriority = 'none',
    dueDate: string = 'Today',
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
      priority,
      dueDate,
      createdAt: 'Just now',
      updatedAt: 'Just now',
    };

    setTasks((prev) => [optimisticTask, ...prev]);

    try {
      const created = await tasksRepo.createTask({
        id: tempId,
        title: cleanTitle,
        priority,
        dueDate,
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
    let noteIdToSync: string | undefined;
    let nextCheckedState = false;

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          noteIdToSync = t.noteId;
          nextCheckedState = !t.isCompleted;
          return { ...t, isCompleted: nextCheckedState };
        }
        return t;
      })
    );

    try {
      await tasksRepo.toggleTask(taskId);

      // Two-way task sync back to note
      if (noteIdToSync) {
        const targetNote = notes.find((n) => n.id === noteIdToSync);
        if (targetNote && targetNote.blocks) {
          let hasChanged = false;
          const updatedBlocks = targetNote.blocks.map((b) => {
            if (b.type === 'checklist' && Array.isArray(b.metadata?.items)) {
              const updatedItems = b.metadata.items.map((item: any) => {
                if (item.id === taskId) {
                  hasChanged = true;
                  return { ...item, checked: nextCheckedState };
                }
                return item;
              });
              return { ...b, metadata: { ...b.metadata, items: updatedItems } };
            }
            return b;
          });

          if (hasChanged) {
            const nextContent = serializeBlocksToMarkdown(updatedBlocks);
            await notesRepo.updateNote(noteIdToSync, {
              blocks: updatedBlocks,
              contentMarkdown: nextContent,
            });
            updateNote({
              ...targetNote,
              blocks: updatedBlocks,
              contentMarkdown: nextContent,
            });
          }
        }
      }
    } catch (err) {
      console.warn('Failed to toggle task via tasksRepo:', err);
    }
  };

  const updateTaskPriority = async (taskId: string, priority: TaskPriority) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, priority } : t)));
    try {
      await tasksRepo.updateTaskPriority(taskId, priority);
    } catch (err) {
      console.warn('Failed to update task priority via tasksRepo:', err);
    }
  };

  const updateTaskDueDate = async (taskId: string, dueDate: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, dueDate } : t)));
    try {
      await tasksRepo.updateTaskDueDate(taskId, dueDate);
    } catch (err) {
      console.warn('Failed to update task dueDate via tasksRepo:', err);
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
        folders,
        tags,
        activeFilter,
        isLoading,
        setActiveFilter,
        addNote,
        updateNote,
        deleteNote,
        toggleFavorite,
        togglePin,
        archiveNote,
        unarchiveNote,
        restoreNote,
        permanentlyDeleteNote,
        emptyTrash,
        createFolder,
        renameFolder,
        deleteFolder,
        moveNoteToFolder,
        setNoteTags,
        addTask,
        toggleTask,
        updateTaskPriority,
        updateTaskDueDate,
        deleteTask,
        isEditingNote,
        setIsEditingNote,
        refreshFromDB,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
};

export const useNotesStore = () => useContext(NotesContext);
