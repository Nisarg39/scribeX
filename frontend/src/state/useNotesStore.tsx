import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { NoteItem, TaskItem, ComposableBlock, TaskPriority, BlockType } from '../types/note';
import { NoteColorToken } from '../theme/tokens';
import { notesRepo } from '../db/notesRepo';
import { tasksRepo } from '../db/tasksRepo';
import { foldersRepo } from '../db/foldersRepo';
import { tagsRepo } from '../db/tagsRepo';
import { searchHistoryRepo } from '../db/searchHistoryRepo';
import { DBFolder, SearchHistorySource } from '../db/types';
import { serializeBlocksToMarkdown } from '../core/astSerializer';
import { NoteSearchDocument, buildNoteSearchDocument } from '../core/searchIndexer';
import {
  NoteQueryRequest,
  NoteStatusScope,
  NoteSortBy,
  NoteCardViewModel,
  NotePartitionCounts,
  DEFAULT_NOTE_QUERY_REQUEST,
  executeNoteQuery,
  mapLegacyFilterToQuery,
  deriveLegacyFilterFromQuery,
  buildCanonicalNoteQueryRequest,
} from '../core/noteQueryEngine';

export interface WorkspaceActivityEntry {
  id: string;
  timestamp: string;
  category: 'search' | 'note_lifecycle' | 'folder' | 'tag' | 'task' | 'sync';
  action: string;
  targetId?: string;
  summary: string;
}

interface NotesContextValue {
  notes: NoteItem[];
  searchIndexMap: Map<string, NoteSearchDocument>;
  queryRequest: NoteQueryRequest;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setQueryRequest: (partial: Partial<NoteQueryRequest>) => void;
  resetQueryRequest: () => void;
  setStatusScopeFilter: (statusScope: NoteStatusScope) => void;
  setFolderFilter: (folderPath: string | null, includeSubfolders?: boolean) => void;
  toggleTagFilter: (tag: string) => void;
  toggleBlockTypeFilter: (blockType: BlockType) => void;
  setSortByFilter: (sortBy: NoteSortBy) => void;
  pinnedCards: NoteCardViewModel[];
  feedCards: NoteCardViewModel[];
  totalMatches: number;
  mainFeedTotal: number;
  visibleCount: number;
  hasMore: boolean;
  isSearchActive: boolean;
  partitionCounts: NotePartitionCounts;
  loadNextPage: () => void;
  resetPagination: () => void;
  upsertSyncedNote: (note: NoteItem) => void;
  recentSearches: string[];
  recordSearchHistory: (query: string, source?: SearchHistorySource) => void;
  deleteSearchHistoryItem: (query: string) => void;
  clearSearchHistory: () => void;
  workspaceHistory: WorkspaceActivityEntry[];
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
  searchIndexMap: new Map(),
  queryRequest: DEFAULT_NOTE_QUERY_REQUEST,
  searchQuery: '',
  setSearchQuery: () => {},
  setQueryRequest: () => {},
  resetQueryRequest: () => {},
  setStatusScopeFilter: () => {},
  setFolderFilter: () => {},
  toggleTagFilter: () => {},
  toggleBlockTypeFilter: () => {},
  setSortByFilter: () => {},
  pinnedCards: [],
  feedCards: [],
  totalMatches: 0,
  mainFeedTotal: 0,
  visibleCount: 0,
  hasMore: false,
  isSearchActive: false,
  partitionCounts: {
    allActive: 0,
    favorites: 0,
    archived: 0,
    trashed: 0,
    byFolder: {},
    byTag: {},
  },
  loadNextPage: () => {},
  resetPagination: () => {},
  upsertSyncedNote: () => {},
  recentSearches: [],
  recordSearchHistory: () => {},
  deleteSearchHistoryItem: () => {},
  clearSearchHistory: () => {},
  workspaceHistory: [],
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
  const [activeFilter, setActiveFilterState] = useState<string>('all');
  const [queryRequest, setQueryRequestState] = useState<NoteQueryRequest>(DEFAULT_NOTE_QUERY_REQUEST);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [workspaceHistory, setWorkspaceHistory] = useState<WorkspaceActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEditingNote, setIsEditingNote] = useState<boolean>(false);

  const logWorkspaceActivity = (
    category: WorkspaceActivityEntry['category'],
    action: string,
    summary: string,
    targetId?: string
  ) => {
    const entry: WorkspaceActivityEntry = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      category,
      action,
      targetId,
      summary,
    };
    setWorkspaceHistory((prev) => [entry, ...prev.slice(0, 49)]);
  };

  const recordSearchHistory = (
    rawQuery: string,
    source: SearchHistorySource = 'text'
  ) => {
    const clean = rawQuery.trim();
    if (clean.length < 2) return;
    setRecentSearches((prev) => {
      const deduped = [clean, ...prev.filter((q) => q.toLowerCase() !== clean.toLowerCase())];
      return deduped.slice(0, 8);
    });
    logWorkspaceActivity('search', 'search_query', `Searched (${source}): "${clean}"`);

    const filterSnapshot = {
      statusScope: queryRequest.statusScope,
      folderPath: queryRequest.folderPath,
      tags: queryRequest.tags,
      hasBlockTypes: queryRequest.hasBlockTypes,
    };
    searchHistoryRepo
      .upsertSearchQuery(clean, source, filterSnapshot)
      .catch((err) => console.warn('Failed to persist search query via searchHistoryRepo:', err));
  };

  const deleteSearchHistoryItem = (query: string) => {
    setRecentSearches((prev) => prev.filter((q) => q.toLowerCase() !== query.toLowerCase()));
    searchHistoryRepo
      .deleteSearchHistoryItem(query)
      .catch((err) => console.warn('Failed to delete search history item:', err));
  };

  const clearSearchHistory = () => {
    setRecentSearches([]);
    searchHistoryRepo
      .clearAllSearchHistory()
      .catch((err) => console.warn('Failed to clear search history via searchHistoryRepo:', err));
  };

  const setActiveFilter = (filter: string) => {
    setActiveFilterState(filter);
    const mapped = mapLegacyFilterToQuery(filter);
    setQueryRequestState((prev) => buildCanonicalNoteQueryRequest(prev, mapped));
  };

  const setSearchQuery = (searchQuery: string) => {
    setQueryRequestState((prev) => buildCanonicalNoteQueryRequest(prev, { searchQuery }));
  };

  const setQueryRequest = (partial: Partial<NoteQueryRequest>) => {
    setQueryRequestState((prev) => {
      const next = buildCanonicalNoteQueryRequest(prev, partial);
      setActiveFilterState(deriveLegacyFilterFromQuery(next));
      return next;
    });
  };

  const resetQueryRequest = () => {
    setQueryRequestState(DEFAULT_NOTE_QUERY_REQUEST);
    setActiveFilterState('all');
  };

  const setStatusScopeFilter = (statusScope: NoteStatusScope) => {
    setQueryRequest({
      statusScope,
      folderPath: null,
      tags: [],
    });
  };

  const setFolderFilter = (folderPath: string | null, includeSubfolders: boolean = false) => {
    setQueryRequest({
      statusScope: 'active',
      folderPath,
      includeSubfolders,
      tags: [],
    });
  };

  const toggleTagFilter = (tag: string) => {
    const cleanTag = tag.trim().replace(/^#/, '');
    if (!cleanTag) return;
    setQueryRequestState((prev) => {
      const currentTags = prev.tags || [];
      const exists = currentTags.some((t) => t.toLowerCase() === cleanTag.toLowerCase());
      const nextTags = exists
        ? currentTags.filter((t) => t.toLowerCase() !== cleanTag.toLowerCase())
        : [...currentTags, cleanTag];
      const next = buildCanonicalNoteQueryRequest(prev, {
        statusScope: 'active',
        folderPath: null,
        tags: nextTags,
      });
      setActiveFilterState(deriveLegacyFilterFromQuery(next));
      return next;
    });
  };

  const toggleBlockTypeFilter = (blockType: BlockType) => {
    setQueryRequestState((prev) => {
      const currentTypes = prev.hasBlockTypes || [];
      const exists = currentTypes.includes(blockType);
      const nextTypes = exists
        ? currentTypes.filter((t) => t !== blockType)
        : [...currentTypes, blockType];
      const next = buildCanonicalNoteQueryRequest(prev, {
        hasBlockTypes: nextTypes,
      });
      return next;
    });
  };

  const setSortByFilter = (sortBy: NoteSortBy) => {
    setQueryRequest({ sortBy });
  };

  const loadNextPage = () => {
    setQueryRequestState((prev) => ({
      ...prev,
      page: prev.page + 1,
    }));
  };

  const resetPagination = () => {
    setQueryRequestState((prev) => ({
      ...prev,
      page: 1,
    }));
  };

  const upsertSyncedNote = (syncedNote: NoteItem) => {
    setNotes((prev) => {
      const exists = prev.some((n) => n.id === syncedNote.id);
      if (exists) {
        return prev.map((n) => (n.id === syncedNote.id ? syncedNote : n));
      }
      return [syncedNote, ...prev];
    });
    logWorkspaceActivity('sync', 'upsert_synced_note', `Synced note "${syncedNote.title}"`, syncedNote.id);
  };

  // Derived in-memory search index map (single source of truth from `notes` — zero extra DB tables)
  const searchIndexMap = useMemo(() => {
    const map = new Map<string, NoteSearchDocument>();
    for (const note of notes) {
      map.set(note.id, buildNoteSearchDocument(note));
    }
    return map;
  }, [notes]);

  // Execute the Unified 3-Stage Query, Ranking & 10-Note Pagination Pipeline
  const unifiedFeed = useMemo(
    () => executeNoteQuery(notes, searchIndexMap, queryRequest),
    [notes, searchIndexMap, queryRequest]
  );

  const refreshFromDB = async () => {
    try {
      const [allNotes, allTasks, fetchedFolders, fetchedTags, savedSearchHistory] = await Promise.all([
        notesRepo.listNotes(), // Active + Archived notes (non-trashed)
        tasksRepo.listTasks(),
        foldersRepo.listFolders(),
        tagsRepo.listTags(),
        searchHistoryRepo.loadRecentSearches(8).catch(() => []),
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
      if (Array.isArray(savedSearchHistory) && savedSearchHistory.length > 0) {
        setRecentSearches(savedSearchHistory.map((item) => item.queryText));
      }

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
    const cleanName = name.trim().replace(/^\/+|\/+$/g, '');
    const cleanParent = (parentPath || '').trim().replace(/^\/+|\/+$/g, '');
    const fullPath = cleanParent ? `${cleanParent}/${cleanName}` : cleanName;
    const segments = fullPath.split('/').map((s) => s.trim()).filter(Boolean);

    let currentPath = '';
    let parentId: string | undefined = undefined;
    let lastCreated: DBFolder | null = null;
    const newlyCreated: DBFolder[] = [];

    for (const seg of segments) {
      currentPath = currentPath ? `${currentPath}/${seg}` : seg;
      const existing = [...folders, ...newlyCreated].find((f) => (f.path || f.name) === currentPath);
      if (existing) {
        parentId = existing.id;
        lastCreated = existing;
      } else {
        const created = await foldersRepo.createFolder({
          name: seg,
          path: currentPath,
          parentId,
          colorToken: 'cyan',
        });
        newlyCreated.push(created);
        parentId = created.id;
        lastCreated = created;
      }
    }

    if (newlyCreated.length > 0) {
      setFolders((prev) => [...prev, ...newlyCreated]);
    }
    return lastCreated!;
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
        searchIndexMap,
        queryRequest,
        searchQuery: queryRequest.searchQuery,
        setSearchQuery,
        setQueryRequest,
        resetQueryRequest,
        setStatusScopeFilter,
        setFolderFilter,
        toggleTagFilter,
        toggleBlockTypeFilter,
        setSortByFilter,
        pinnedCards: unifiedFeed.pinnedCards,
        feedCards: unifiedFeed.feedCards,
        totalMatches: unifiedFeed.totalMatches,
        mainFeedTotal: unifiedFeed.mainFeedTotal,
        visibleCount: unifiedFeed.visibleCount,
        hasMore: unifiedFeed.hasMore,
        isSearchActive: unifiedFeed.isSearchActive,
        partitionCounts: unifiedFeed.counts,
        loadNextPage,
        resetPagination,
        upsertSyncedNote,
        recentSearches,
        recordSearchHistory,
        deleteSearchHistoryItem,
        clearSearchHistory,
        workspaceHistory,
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
