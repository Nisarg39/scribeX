import React, { createContext, useContext, useState, useEffect } from 'react';
import { NoteItem, TaskItem, ComposableBlock, TaskPriority } from '../types/note';
import { NoteColorToken } from '../theme/tokens';
import { notesRepo } from '../db/notesRepo';
import { tasksRepo } from '../db/tasksRepo';
import { serializeBlocksToMarkdown } from '../core/astSerializer';

interface NotesContextValue {
  notes: NoteItem[];
  tasks: TaskItem[];
  activeFilter: string;
  isLoading: boolean;
  setActiveFilter: (filter: string) => void;
  addNote: (title: string, content: string, colorToken?: NoteColorToken, folderPath?: string) => Promise<NoteItem>;
  updateNote: (updated: NoteItem) => void;
  deleteNote: (noteId: string) => Promise<void>;
  toggleFavorite: (noteId: string) => Promise<void>;
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
  isEditingNote: boolean;
  setIsEditingNote: (editing: boolean) => void;
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
  isEditingNote: false,
  setIsEditingNote: () => {},
  setActiveFilter: () => {},
  addNote: async () => ({} as NoteItem),
  updateNote: () => {},
  deleteNote: async () => {},
  toggleFavorite: async () => {},
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
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEditingNote, setIsEditingNote] = useState<boolean>(false);

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

      setNotes((prev) => prev.map((n) => (n.id === tempId ? created : n)));
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
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    setTasks((prev) => prev.filter((t) => t.noteId !== noteId));
    try {
      await notesRepo.softDeleteNote(noteId);
      await tasksRepo.syncNoteChecklists(noteId, '', 'apricot', []);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to delete note via notesRepo:', err);
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

    // 1. Optimistic update of task in tasks array
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          nextCheckedState = !t.isCompleted;
          noteIdToSync = t.noteId;
          return { ...t, isCompleted: nextCheckedState };
        }
        return t;
      })
    );

    // 2. If task belongs to an origin note, sync checklist block in note too!
    if (noteIdToSync) {
      setNotes((prevNotes) =>
        prevNotes.map((n) => {
          if (n.id !== noteIdToSync) return n;

          const updatedBlocks = (n.blocks || []).map((b) => {
            if (b.type === 'checklist' && (b.metadata?.taskId === taskId || b.id === taskId)) {
              return {
                ...b,
                metadata: {
                  ...b.metadata,
                  checked: nextCheckedState,
                },
              };
            }
            return b;
          });

          const updatedMarkdown = serializeBlocksToMarkdown(updatedBlocks);

          notesRepo
            .updateNote(n.id, {
              blocks: updatedBlocks,
              contentMarkdown: updatedMarkdown,
            })
            .catch((err) => console.warn('Failed to sync note block on task toggle:', err));

          return {
            ...n,
            blocks: updatedBlocks,
            contentMarkdown: updatedMarkdown,
          };
        })
      );
    }

    try {
      await tasksRepo.toggleTask(taskId);
    } catch (err) {
      console.warn('Failed to toggle task via tasksRepo:', err);
    }
  };

  const updateTaskPriority = async (taskId: string, priority: TaskPriority) => {
    let noteIdToSync: string | undefined;

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          noteIdToSync = t.noteId;
          return { ...t, priority };
        }
        return t;
      })
    );

    if (noteIdToSync) {
      setNotes((prevNotes) =>
        prevNotes.map((n) => {
          if (n.id !== noteIdToSync) return n;

          const updatedBlocks = (n.blocks || []).map((b) => {
            if (b.type === 'checklist' && (b.metadata?.taskId === taskId || b.id === taskId)) {
              return {
                ...b,
                metadata: {
                  ...b.metadata,
                  priority,
                },
              };
            }
            return b;
          });

          const updatedMarkdown = serializeBlocksToMarkdown(updatedBlocks);
          notesRepo.updateNote(n.id, { blocks: updatedBlocks, contentMarkdown: updatedMarkdown }).catch(() => {});

          return { ...n, blocks: updatedBlocks, contentMarkdown: updatedMarkdown };
        })
      );
    }

    try {
      await tasksRepo.updateTask(taskId, { priority });
    } catch (err) {
      console.warn('Failed to update task priority via tasksRepo:', err);
    }
  };

  const updateTaskDueDate = async (taskId: string, dueDate: string) => {
    let noteIdToSync: string | undefined;

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          noteIdToSync = t.noteId;
          return { ...t, dueDate };
        }
        return t;
      })
    );

    if (noteIdToSync) {
      setNotes((prevNotes) =>
        prevNotes.map((n) => {
          if (n.id !== noteIdToSync) return n;

          const updatedBlocks = (n.blocks || []).map((b) => {
            if (b.type === 'checklist' && (b.metadata?.taskId === taskId || b.id === taskId)) {
              return {
                ...b,
                metadata: {
                  ...b.metadata,
                  dueDate,
                },
              };
            }
            return b;
          });

          const updatedMarkdown = serializeBlocksToMarkdown(updatedBlocks);
          notesRepo.updateNote(n.id, { blocks: updatedBlocks, contentMarkdown: updatedMarkdown }).catch(() => {});

          return { ...n, blocks: updatedBlocks, contentMarkdown: updatedMarkdown };
        })
      );
    }

    try {
      await tasksRepo.updateTask(taskId, { dueDate });
    } catch (err) {
      console.warn('Failed to update task due date via tasksRepo:', err);
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
        updateNote,
        deleteNote,
        toggleFavorite,
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
