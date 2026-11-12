import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NoteItem, TaskItem, ComposableBlock, TaskPriority, BlockType } from '../types/note';
import { NoteColorToken } from '../theme/tokens';
import { notesRepo } from '../db/notesRepo';
import { tasksRepo } from '../db/tasksRepo';
import { foldersRepo } from '../db/foldersRepo';
import { tagsRepo } from '../db/tagsRepo';
import { searchHistoryRepo } from '../db/searchHistoryRepo';
import { remindersRepo } from '../db/remindersRepo';
import { notificationsRepo } from '../db/notificationsRepo';
import { notificationService } from '../services/notifications/NotificationService';
import { syncEngine } from '../services/sync/syncEngine';
import { ReminderRecord, parseReminderString, getNextOccurrence } from '../types/reminder';
import {
  DBFolder,
  SearchHistorySource,
  FolderNoteStats,
  DBSyncChangelog,
  FolderSyncResult,
  InAppNotificationItem,
  NotificationTargetType,
  NotificationCounts,
} from '../db/types';
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
  activeFolders: DBFolder[];
  favoriteFolders: DBFolder[];
  pinnedFolders: DBFolder[];
  archivedFolders: DBFolder[];
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
  batchDeleteNotes: (ids: string[]) => Promise<void>;
  batchMoveNotesToFolder: (ids: string[], folderPath: string, folderId?: string) => Promise<void>;
  batchTogglePin: (ids: string[], pin: boolean) => Promise<void>;
  batchArchiveNotes: (ids: string[], archive: boolean) => Promise<void>;
  batchRestoreNotes: (ids: string[]) => Promise<void>;
  batchPermanentlyDeleteNotes: (ids: string[]) => Promise<void>;
  createFolder: (name: string, parentPath?: string) => Promise<DBFolder>;
  renameFolder: (id: string, newName: string) => Promise<void>;
  moveFolder: (id: string, newParentPath: string | null) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  deleteFolderWithOptions: (
    id: string,
    folderPath: string,
    noteAction: 'moveToGeneral' | 'trash'
  ) => Promise<{ affectedNotes: number; deletedFolders: number }>;
  duplicateFolder: (id: string, folderPath: string, newName?: string) => Promise<DBFolder>;
  updateFolderColor: (id: string, colorToken: string) => Promise<void>;
  updateFolderIcon: (id: string, icon: string | null) => Promise<void>;
  toggleFolderFavorite: (folderId: string) => Promise<boolean>;
  toggleFolderPin: (folderId: string) => Promise<boolean>;
  archiveFolder: (folderId: string) => Promise<{ affectedNotes: number; affectedFolders: number }>;
  unarchiveFolder: (folderId: string) => Promise<{ affectedNotes: number; affectedFolders: number }>;
  getFolderStats: (folderPath: string, folderId?: string) => Promise<FolderNoteStats>;
  getPendingFolderChangelogs: (sinceRev?: number) => Promise<DBSyncChangelog[]>;
  applyRemoteFolderDelta: (entry: DBSyncChangelog) => Promise<FolderSyncResult>;
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
  reminders: ReminderRecord[];
  setTaskReminder: (taskId: string, triggerAt: string | null) => Promise<void>;
  setNoteReminder: (noteId: string, triggerAt: string | null) => Promise<void>;
  cancelReminder: (reminderId: string) => Promise<void>;
  notifications: InAppNotificationItem[];
  unreadNotificationsCount: number;
  notificationCounts: NotificationCounts;
  markNotificationAsRead: (id: string, isRead?: boolean) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  clearNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
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
  activeFolders: [],
  favoriteFolders: [],
  pinnedFolders: [],
  archivedFolders: [],
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
  batchDeleteNotes: async () => {},
  batchMoveNotesToFolder: async () => {},
  batchTogglePin: async () => {},
  batchArchiveNotes: async () => {},
  batchRestoreNotes: async () => {},
  batchPermanentlyDeleteNotes: async () => {},
  createFolder: async () => ({} as DBFolder),
  renameFolder: async () => {},
  moveFolder: async () => {},
  deleteFolder: async () => {},
  deleteFolderWithOptions: async () => ({ affectedNotes: 0, deletedFolders: 0 }),
  duplicateFolder: async () => ({} as DBFolder),
  updateFolderColor: async () => {},
  updateFolderIcon: async () => {},
  toggleFolderFavorite: async () => false,
  toggleFolderPin: async () => false,
  archiveFolder: async () => ({ affectedNotes: 0, affectedFolders: 0 }),
  unarchiveFolder: async () => ({ affectedNotes: 0, affectedFolders: 0 }),
  getFolderStats: async () => ({
    directNotesCount: 0,
    nestedNotesCount: 0,
    totalNotesCount: 0,
    subfoldersCount: 0,
  }),
  getPendingFolderChangelogs: async () => [],
  applyRemoteFolderDelta: async () => ({ status: 'applied', folderId: '' }),
  moveNoteToFolder: async () => {},
  setNoteTags: async () => {},
  addTask: async () => {},
  toggleTask: async () => {},
  updateTaskPriority: async () => {},
  updateTaskDueDate: async () => {},
  deleteTask: async () => {},
  reminders: [],
  setTaskReminder: async () => {},
  setNoteReminder: async () => {},
  cancelReminder: async () => {},
  notifications: [],
  unreadNotificationsCount: 0,
  notificationCounts: { all: 0, unread: 0, tasks: 0, notes: 0 },
  markNotificationAsRead: async () => {},
  markAllNotificationsAsRead: async () => {},
  clearNotification: async () => {},
  clearAllNotifications: async () => {},
  refreshNotifications: async () => {},
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
  const [reminders, setReminders] = useState<ReminderRecord[]>([]);
  const [notifications, setNotifications] = useState<InAppNotificationItem[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [notificationCounts, setNotificationCounts] = useState<NotificationCounts>({ all: 0, unread: 0, tasks: 0, notes: 0 });

  const activeFolders = useMemo(() => folders.filter((f) => !f.is_archived), [folders]);
  const favoriteFolders = useMemo(
    () => folders.filter((f) => Boolean(f.is_favorite) && !f.is_archived),
    [folders]
  );
  const pinnedFolders = useMemo(
    () => folders.filter((f) => Boolean(f.is_pinned) && !f.is_archived),
    [folders]
  );
  const archivedFolders = useMemo(() => folders.filter((f) => Boolean(f.is_archived)), [folders]);

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
    AsyncStorage.setItem('scribex_sort_preference', sortBy).catch(() => {});
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

  const refreshNotifications = async () => {
    try {
      const [list, counts] = await Promise.all([
        notificationsRepo.listNotifications(),
        notificationsRepo.getNotificationCounts(),
      ]);
      setNotifications(list);
      setUnreadNotificationsCount(counts.unread);
      setNotificationCounts(counts);
    } catch (err) {
      console.warn('Failed to load in-app notifications:', err);
    }
  };

  const markNotificationAsRead = async (id: string, isRead: boolean = true) => {
    try {
      await notificationsRepo.markAsRead(id, isRead);
      await refreshNotifications();
    } catch (err) {
      console.warn('Failed to mark notification as read:', err);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await notificationsRepo.markAllAsRead();
      await refreshNotifications();
    } catch (err) {
      console.warn('Failed to mark all notifications as read:', err);
    }
  };

  const clearNotification = async (id: string) => {
    try {
      await notificationsRepo.clearNotification(id);
      await refreshNotifications();
    } catch (err) {
      console.warn('Failed to clear notification:', err);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await notificationsRepo.clearAll();
      await refreshNotifications();
    } catch (err) {
      console.warn('Failed to clear all notifications:', err);
    }
  };

  const reconcileFiredReminders = async () => {
    try {
      await notificationsRepo.purgePrematureNotifications().catch(() => {});

      const activeReminders = await remindersRepo.listActiveReminders().catch(() => []);
      const now = Date.now();

      for (const rem of activeReminders) {
        if (!rem.triggerAt) continue;
        const isTask = rem.targetType === 'task';
        const taskItem = isTask ? tasks.find((t) => t.id === rem.targetId) : undefined;
        const noteItem = !isTask ? notes.find((n) => n.id === rem.targetId) : undefined;
        const notifTitle = isTask 
          ? (taskItem?.title || 'Task') 
          : (noteItem?.title || 'Untitled Note');
        const notifBody = isTask 
          ? (taskItem?.noteTitle ? `From note: ${taskItem.noteTitle}` : '') 
          : (noteItem?.contentMarkdown ? noteItem.contentMarkdown.trim().slice(0, 100) : '');

        const parsed = parseReminderString(rem.triggerAt);
        if (parsed?.type === 'repeat' && parsed.repeatRule) {
          const [hStr, mStr] = (parsed.repeatRule.time || '12:00').split(':');
          const targetH = parseInt(hStr, 10) || 0;
          const targetM = parseInt(mStr, 10) || 0;
          const nowDate = new Date(now);
          const currentDay = nowDate.getDay();
          const validDays = Array.isArray(parsed.repeatRule.days) && parsed.repeatRule.days.length > 0
            ? parsed.repeatRule.days
            : [0, 1, 2, 3, 4, 5, 6];

          if (validDays.includes(currentDay)) {
            const todayOccurrence = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), targetH, targetM, 0, 0);
            if (todayOccurrence.getTime() <= now) {
              const occurrenceKey = `notif-${rem.id}-${nowDate.toISOString().slice(0, 10)}`;
              const existing = await notificationsRepo.getNotificationById(occurrenceKey);
              if (!existing) {
                await notificationsRepo.createNotification({
                  id: occurrenceKey,
                  reminderId: rem.id,
                  targetType: rem.targetType as NotificationTargetType,
                  targetId: rem.targetId,
                  noteId: rem.noteId,
                  title: notifTitle,
                  body: notifBody,
                  triggerAt: todayOccurrence.toISOString(),
                  recurrenceRule: JSON.stringify(parsed.repeatRule),
                });
              }
            }
          }
        } else {
          const triggerTime = new Date(rem.triggerAt).getTime();
          if (triggerTime <= now) {
            const firedId = `notif-${rem.id}`;
            const existing = await notificationsRepo.getNotificationById(firedId);
            if (!existing) {
              await notificationsRepo.createNotification({
                id: firedId,
                reminderId: rem.id,
                targetType: rem.targetType as NotificationTargetType,
                targetId: rem.targetId,
                noteId: rem.noteId,
                title: notifTitle,
                body: notifBody,
                triggerAt: rem.triggerAt,
              });
            }
          }
        }
      }

      await refreshNotifications();
    } catch (err) {
      console.warn('Failed to reconcile fired reminders:', err);
    }
  };

  const refreshFromDB = async () => {
    try {
      await notificationsRepo.purgePrematureNotifications().catch(() => {});
      const [
        allNotes,
        allTasks,
        fetchedFolders,
        fetchedTags,
        savedSearchHistory,
        activeReminders,
        fetchedNotifs,
        notifCounts,
      ] = await Promise.all([
        notesRepo.listNotes(), // Active + Archived notes (non-trashed)
        tasksRepo.listTasks(),
        foldersRepo.listFolders(true),
        tagsRepo.listTags(),
        searchHistoryRepo.loadRecentSearches(8).catch(() => []),
        remindersRepo.listActiveReminders().catch(() => []),
        notificationsRepo.listNotifications().catch(() => []),
        notificationsRepo.getNotificationCounts().catch(() => ({ all: 0, unread: 0, tasks: 0, notes: 0 })),
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
      setReminders(activeReminders);
      setNotifications(fetchedNotifs);
      setUnreadNotificationsCount(notifCounts.unread);
      setNotificationCounts(notifCounts);
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
    syncEngine.initialize().catch((err) => console.warn('Failed to init syncEngine:', err));
    const unsubscribeSync = syncEngine.subscribe(() => {
      refreshFromDB();
    });

    const unsubscribeDelivery = notificationService.subscribeDelivery(() => {
      refreshNotifications();
    });

    const reminderCheckTimer = setInterval(() => {
      reconcileFiredReminders();
    }, 10000);

    AsyncStorage.getItem('scribex_sort_preference')
      .then((savedSort) => {
        if (savedSort) {
          setQueryRequestState((prev) => ({
            ...prev,
            sortBy: savedSort as NoteSortBy,
          }));
        }
      })
      .catch(() => {});

    return () => {
      unsubscribeSync();
      unsubscribeDelivery();
      clearInterval(reminderCheckTimer);
    };
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
      const deletedReminders = await remindersRepo.deleteRemindersByNoteId(noteId);
      for (const rem of deletedReminders) {
        if (rem.notificationId) {
          await notificationService.cancelReminder(rem.notificationId);
        }
      }
      const noteReminders = await remindersRepo.deleteRemindersByTarget('note', noteId);
      for (const rem of noteReminders) {
        if (rem.notificationId) {
          await notificationService.cancelReminder(rem.notificationId);
        }
      }
      setReminders((prev) =>
        prev.filter((r) => r.noteId !== noteId && !(r.targetType === 'note' && r.targetId === noteId))
      );
      await notesRepo.permanentlyDeleteNote(noteId);
      await tasksRepo.syncNoteChecklists(noteId, '', 'apricot', []);
    } catch (err) {
      console.warn('Failed to permanently delete note via notesRepo:', err);
    }
  };

  const emptyTrash = async () => {
    setNotes((prev) => prev.filter((n) => n.status !== 'trashed'));
    try {
      await notesRepo.emptyTrashCascade();
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to empty trash via notesRepo:', err);
    }
  };

  const batchDeleteNotes = async (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setNotes((prev) =>
      prev.map((n) => (idSet.has(n.id) ? { ...n, status: 'trashed' } : n))
    );
    try {
      await notesRepo.batchSoftDeleteNotes(ids);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to batch soft-delete notes:', err);
    }
  };

  const batchMoveNotesToFolder = async (ids: string[], folderPath: string, folderId?: string) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setNotes((prev) =>
      prev.map((n) => (idSet.has(n.id) ? { ...n, folderPath, folderId } : n))
    );
    try {
      await notesRepo.batchMoveNotesToFolder(ids, folderPath, folderId);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to batch move notes to folder:', err);
    }
  };

  const batchTogglePin = async (ids: string[], pin: boolean) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setNotes((prev) =>
      prev.map((n) => (idSet.has(n.id) ? { ...n, isPinned: pin } : n))
    );
    try {
      await notesRepo.batchTogglePinNotes(ids, pin);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to batch toggle pin:', err);
    }
  };

  const batchArchiveNotes = async (ids: string[], archive: boolean) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const newStatus = archive ? 'archived' : 'active';
    setNotes((prev) =>
      prev.map((n) => (idSet.has(n.id) ? { ...n, status: newStatus } : n))
    );
    try {
      await notesRepo.batchArchiveNotes(ids, archive);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to batch archive notes:', err);
    }
  };

  const batchRestoreNotes = async (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setNotes((prev) =>
      prev.map((n) => (idSet.has(n.id) ? { ...n, status: 'active' } : n))
    );
    try {
      await notesRepo.batchRestoreNotes(ids);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to batch restore notes:', err);
    }
  };

  const batchPermanentlyDeleteNotes = async (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setNotes((prev) => prev.filter((n) => !idSet.has(n.id)));
    setTasks((prev) => prev.filter((t) => !t.noteId || !idSet.has(t.noteId)));
    try {
      await notesRepo.batchPermanentlyDeleteNotes(ids);
      for (const id of ids) {
        await tasksRepo.syncNoteChecklists(id, '', 'apricot', []);
      }
    } catch (err) {
      console.warn('Failed to batch permanently delete notes:', err);
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
    try {
      const { oldPath, newPath } = await foldersRepo.renameFolderCascade(id, newName);
      setFolders((prev) =>
        prev.map((f) => {
          if (f.id === id) {
            return { ...f, name: newName, path: newPath };
          }
          if (f.path.startsWith(`${oldPath}/`)) {
            return { ...f, path: `${newPath}${f.path.slice(oldPath.length)}` };
          }
          return f;
        })
      );
      setNotes((prev) =>
        prev.map((n) => {
          if (n.folderPath === oldPath) {
            return { ...n, folderPath: newPath };
          }
          if (n.folderPath?.startsWith(`${oldPath}/`)) {
            return { ...n, folderPath: `${newPath}${n.folderPath.slice(oldPath.length)}` };
          }
          return n;
        })
      );
      if (queryRequest.folderPath === oldPath) {
        setFolderFilter(newPath);
      } else if (queryRequest.folderPath?.startsWith(`${oldPath}/`)) {
        setFolderFilter(`${newPath}${queryRequest.folderPath.slice(oldPath.length)}`);
      }
      logWorkspaceActivity('folder', 'rename', `Renamed folder "${oldPath}" to "${newPath}"`, id);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to rename folder:', err);
      throw err;
    }
  };

  const moveFolder = async (id: string, newParentPath: string | null) => {
    try {
      const { oldPath, newPath } = await foldersRepo.moveFolderCascade(id, newParentPath);
      setFolders((prev) =>
        prev.map((f) => {
          if (f.id === id) {
            return { ...f, path: newPath };
          }
          if (f.path.startsWith(`${oldPath}/`)) {
            return { ...f, path: `${newPath}${f.path.slice(oldPath.length)}` };
          }
          return f;
        })
      );
      setNotes((prev) =>
        prev.map((n) => {
          if (n.folderPath === oldPath) {
            return { ...n, folderPath: newPath };
          }
          if (n.folderPath?.startsWith(`${oldPath}/`)) {
            return { ...n, folderPath: `${newPath}${n.folderPath.slice(oldPath.length)}` };
          }
          return n;
        })
      );
      if (queryRequest.folderPath === oldPath) {
        setFolderFilter(newPath);
      } else if (queryRequest.folderPath?.startsWith(`${oldPath}/`)) {
        setFolderFilter(`${newPath}${queryRequest.folderPath.slice(oldPath.length)}`);
      }
      logWorkspaceActivity('folder', 'move', `Moved folder "${oldPath}" to "${newPath}"`, id);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to move folder:', err);
      throw err;
    }
  };

  const deleteFolderWithOptions = async (
    id: string,
    folderPath: string,
    noteAction: 'moveToGeneral' | 'trash'
  ) => {
    try {
      const cleanPath = folderPath.trim().replace(/^\/+|\/+$/g, '');
      const res = await foldersRepo.deleteFolderCascade(id, cleanPath, noteAction);

      setFolders((prev) =>
        prev.filter((f) => f.id !== id && f.path !== cleanPath && !f.path.startsWith(`${cleanPath}/`))
      );

      if (noteAction === 'moveToGeneral') {
        setNotes((prev) =>
          prev.map((n) => {
            if (n.folderId === id || n.folderPath === cleanPath || n.folderPath?.startsWith(`${cleanPath}/`)) {
              return { ...n, folderPath: 'General', folderId: undefined };
            }
            return n;
          })
        );
      } else {
        const nowIso = new Date().toISOString();
        setNotes((prev) =>
          prev.map((n) => {
            if (n.folderId === id || n.folderPath === cleanPath || n.folderPath?.startsWith(`${cleanPath}/`)) {
              return { ...n, status: 'trashed', trashedAt: nowIso };
            }
            return n;
          })
        );
      }

      if (queryRequest.folderPath === cleanPath || queryRequest.folderPath?.startsWith(`${cleanPath}/`)) {
        setFolderFilter(null);
      }

      logWorkspaceActivity(
        'folder',
        'delete',
        `Deleted folder "${cleanPath}" (${res.affectedNotes} notes ${noteAction === 'moveToGeneral' ? 'moved to General' : 'trashed'})`,
        id
      );

      await refreshFromDB();
      return res;
    } catch (err) {
      console.warn('Failed to delete folder cascade:', err);
      throw err;
    }
  };

  const deleteFolder = async (id: string) => {
    const folder = folders.find((f) => f.id === id);
    const folderPath = folder?.path || folder?.name || '';
    await deleteFolderWithOptions(id, folderPath, 'moveToGeneral');
  };

  const duplicateFolder = async (id: string, folderPath: string, newName?: string): Promise<DBFolder> => {
    try {
      const { newFolder, duplicatedNotesCount } = await foldersRepo.duplicateFolderCascade(id, folderPath, newName);
      logWorkspaceActivity(
        'folder',
        'duplicate',
        `Duplicated folder "${folderPath}" -> "${newFolder.path}" (${duplicatedNotesCount} notes copied)`,
        newFolder.id
      );
      await refreshFromDB();
      return newFolder;
    } catch (err) {
      console.warn('Failed to duplicate folder:', err);
      throw err;
    }
  };

  const updateFolderColor = async (id: string, colorToken: string): Promise<void> => {
    try {
      await foldersRepo.updateFolderColor(id, colorToken);
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, color_token: colorToken } : f)));
    } catch (err) {
      console.warn('Failed to update folder color:', err);
    }
  };

  const updateFolderIcon = async (id: string, icon: string | null): Promise<void> => {
    try {
      await foldersRepo.updateFolderIcon(id, icon);
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, icon } : f)));
    } catch (err) {
      console.warn('Failed to update folder icon:', err);
    }
  };

  const toggleFolderFavorite = async (folderId: string): Promise<boolean> => {
    try {
      const isFav = await foldersRepo.toggleFolderFavorite(folderId);
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, is_favorite: isFav ? 1 : 0 } : f))
      );
      return isFav;
    } catch (err) {
      console.warn('Failed to toggle folder favorite:', err);
      return false;
    }
  };

  const toggleFolderPin = async (folderId: string): Promise<boolean> => {
    try {
      const isPinned = await foldersRepo.toggleFolderPin(folderId);
      setFolders((prev) => {
        const updated = prev.map((f) => (f.id === folderId ? { ...f, is_pinned: isPinned ? 1 : 0 } : f));
        return updated.sort((a, b) => (b.is_pinned - a.is_pinned) || a.path.localeCompare(b.path));
      });
      return isPinned;
    } catch (err) {
      console.warn('Failed to toggle folder pin:', err);
      return false;
    }
  };

  const archiveFolder = async (
    folderId: string
  ): Promise<{ affectedNotes: number; affectedFolders: number }> => {
    try {
      const folder = folders.find((f) => f.id === folderId);
      const res = await foldersRepo.archiveFolderContained(folderId);
      const cleanPath = folder ? (folder.path || folder.name).trim().replace(/^\/+|\/+$/g, '') : '';

      setFolders((prev) =>
        prev.map((f) => {
          if (f.id === folderId || (cleanPath && f.path.startsWith(`${cleanPath}/`))) {
            return { ...f, is_archived: 1 };
          }
          return f;
        })
      );

      setNotes((prev) =>
        prev.map((n) => {
          if (
            n.status === 'active' &&
            (n.folderId === folderId ||
              (cleanPath && (n.folderPath === cleanPath || n.folderPath?.startsWith(`${cleanPath}/`))))
          ) {
            return { ...n, status: 'archived', updatedAt: new Date().toISOString() };
          }
          return n;
        })
      );

      // If currently filtering by this folder, clear when not in archive scope
      if (
        queryRequest.folderPath &&
        cleanPath &&
        (queryRequest.folderPath === cleanPath || queryRequest.folderPath.startsWith(`${cleanPath}/`))
      ) {
        if (queryRequest.statusScope !== 'archived') {
          setFolderFilter(null);
        }
      }

      return res;
    } catch (err) {
      console.warn('Failed to archive folder:', err);
      return { affectedNotes: 0, affectedFolders: 0 };
    }
  };

  const unarchiveFolder = async (
    folderId: string
  ): Promise<{ affectedNotes: number; affectedFolders: number }> => {
    try {
      const folder = folders.find((f) => f.id === folderId);
      const res = await foldersRepo.unarchiveFolderContained(folderId);
      const cleanPath = folder ? (folder.path || folder.name).trim().replace(/^\/+|\/+$/g, '') : '';
      const segments = cleanPath.split('/').filter(Boolean);
      const ancestorPaths = new Set(segments.map((_, i) => segments.slice(0, i + 1).join('/')));

      setFolders((prev) =>
        prev.map((f) => {
          if (
            f.id === folderId ||
            (cleanPath && f.path.startsWith(`${cleanPath}/`)) ||
            ancestorPaths.has(f.path)
          ) {
            return { ...f, is_archived: 0 };
          }
          return f;
        })
      );

      setNotes((prev) =>
        prev.map((n) => {
          if (
            n.status === 'archived' &&
            (n.folderId === folderId ||
              (cleanPath && (n.folderPath === cleanPath || n.folderPath?.startsWith(`${cleanPath}/`))))
          ) {
            return { ...n, status: 'active', updatedAt: new Date().toISOString() };
          }
          return n;
        })
      );

      return res;
    } catch (err) {
      console.warn('Failed to unarchive folder:', err);
      return { affectedNotes: 0, affectedFolders: 0 };
    }
  };

  const getFolderStats = async (folderPath: string, folderId?: string): Promise<FolderNoteStats> => {
    try {
      return await foldersRepo.getFolderNoteStats(folderPath, folderId);
    } catch (err) {
      const cleanPath = folderPath.trim().replace(/^\/+|\/+$/g, '');
      const direct = notes.filter((n) => n.status !== 'trashed' && (n.folderPath === cleanPath || n.folderId === folderId)).length;
      const nested = notes.filter((n) => n.status !== 'trashed' && n.folderPath?.startsWith(`${cleanPath}/`)).length;
      const subfolders = folders.filter((f) => f.path.startsWith(`${cleanPath}/`)).length;
      return {
        directNotesCount: direct,
        nestedNotesCount: nested,
        totalNotesCount: direct + nested,
        subfoldersCount: subfolders,
      };
    }
  };

  const getPendingFolderChangelogs = async (sinceRev = 0): Promise<DBSyncChangelog[]> => {
    return foldersRepo.getPendingFolderChangelogs(sinceRev);
  };

  const applyRemoteFolderDelta = async (entry: DBSyncChangelog): Promise<FolderSyncResult> => {
    const res = await foldersRepo.applyRemoteFolderDelta(entry);
    await refreshFromDB();
    return res;
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
          return {
            ...t,
            isCompleted: nextCheckedState,
            reminderAt: nextCheckedState ? undefined : t.reminderAt,
          };
        }
        return t;
      })
    );

    try {
      await tasksRepo.toggleTask(taskId);

      // Invariant: Auto-cancel reminder on task completion
      if (nextCheckedState) {
        const activeReminder = await remindersRepo.getActiveReminderByTarget('task', taskId);
        if (activeReminder) {
          if (activeReminder.notificationId) {
            await notificationService.cancelReminder(activeReminder.notificationId);
          }
          await remindersRepo.dismissReminder(activeReminder.id);
          await tasksRepo.updateTaskReminder(taskId, null);
          setReminders((prev) => prev.filter((r) => r.id !== activeReminder.id));
        }
      }

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
                  return {
                    ...item,
                    checked: nextCheckedState,
                    reminderAt: nextCheckedState ? undefined : item.reminderAt,
                  };
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
      const activeReminder = await remindersRepo.getActiveReminderByTarget('task', taskId);
      if (activeReminder?.notificationId) {
        await notificationService.cancelReminder(activeReminder.notificationId);
      }
      await remindersRepo.deleteRemindersByTarget('task', taskId);
      await notificationsRepo.deleteNotificationByTarget('task', taskId);
      setReminders((prev) => prev.filter((r) => !(r.targetType === 'task' && r.targetId === taskId)));
      await tasksRepo.deleteTask(taskId);
      await refreshNotifications();
    } catch (err) {
      console.warn('Failed to delete task via tasksRepo:', err);
    }
  };

  const setTaskReminder = async (taskId: string, triggerAt: string | null) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    if (!triggerAt) {
      const existing = await remindersRepo.getActiveReminderByTarget('task', taskId);
      if (existing?.notificationId) {
        await notificationService.cancelReminder(existing.notificationId);
      }
      await remindersRepo.dismissReminderByTarget('task', taskId);
      await notificationsRepo.deleteNotificationByTarget('task', taskId);
      await tasksRepo.updateTaskReminder(taskId, null);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, reminderAt: undefined } : t)));
      setReminders((prev) => prev.filter((r) => !(r.targetType === 'task' && r.targetId === taskId)));
      await refreshNotifications();

      if (targetTask.noteId) {
        const targetNote = notes.find((n) => n.id === targetTask.noteId);
        if (targetNote && targetNote.blocks) {
          let hasChanged = false;
          const updatedBlocks = targetNote.blocks.map((b) => {
            if (b.type === 'checklist' && Array.isArray(b.metadata?.items)) {
              const updatedItems = b.metadata.items.map((item: any) => {
                if (item.id === taskId) {
                  hasChanged = true;
                  return { ...item, reminderAt: undefined };
                }
                return item;
              });
              return { ...b, metadata: { ...b.metadata, items: updatedItems } };
            }
            return b;
          });
          if (hasChanged) {
            const nextContent = serializeBlocksToMarkdown(updatedBlocks);
            await notesRepo.updateNote(targetTask.noteId, {
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
    } else {
      const parsedConfig = parseReminderString(triggerAt);
      const computedTriggerDate = parsedConfig?.type === 'repeat' && parsedConfig.repeatRule
        ? getNextOccurrence(parsedConfig.repeatRule)
        : new Date(triggerAt);

      const reminder = await remindersRepo.createReminder({
        targetType: 'task',
        targetId: taskId,
        noteId: targetTask.noteId,
        triggerAt,
        title: targetTask.title,
        body: targetTask.noteTitle ? `From note: ${targetTask.noteTitle}` : '',
      });

      const notificationId = await notificationService.scheduleReminder({
        reminderId: reminder.id,
        title: targetTask.title,
        body: targetTask.noteTitle ? `From note: ${targetTask.noteTitle}` : '',
        triggerDate: computedTriggerDate,
        repeatRule: parsedConfig?.type === 'repeat' ? parsedConfig.repeatRule : undefined,
        payload: {
          targetType: 'task',
          targetId: taskId,
          noteId: targetTask.noteId,
          title: targetTask.title,
          body: targetTask.noteTitle ? `From note: ${targetTask.noteTitle}` : '',
        },
      });

      if (notificationId) {
        await remindersRepo.updateNotificationId(reminder.id, notificationId);
        reminder.notificationId = notificationId;
      }

      await tasksRepo.updateTaskReminder(taskId, triggerAt);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, reminderAt: triggerAt } : t)));
      setReminders((prev) => [
        ...prev.filter((r) => !(r.targetType === 'task' && r.targetId === taskId)),
        reminder,
      ]);
      await refreshNotifications();

      if (targetTask.noteId) {
        const targetNote = notes.find((n) => n.id === targetTask.noteId);
        if (targetNote && targetNote.blocks) {
          let hasChanged = false;
          const updatedBlocks = targetNote.blocks.map((b) => {
            if (b.type === 'checklist' && Array.isArray(b.metadata?.items)) {
              const updatedItems = b.metadata.items.map((item: any) => {
                if (item.id === taskId) {
                  hasChanged = true;
                  return { ...item, reminderAt: triggerAt };
                }
                return item;
              });
              return { ...b, metadata: { ...b.metadata, items: updatedItems } };
            }
            return b;
          });
          if (hasChanged) {
            const nextContent = serializeBlocksToMarkdown(updatedBlocks);
            await notesRepo.updateNote(targetTask.noteId, {
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
    }
  };

  const setNoteReminder = async (noteId: string, triggerAt: string | null) => {
    const targetNote = notes.find((n) => n.id === noteId);
    if (!targetNote) return;

    if (!triggerAt) {
      const existing = await remindersRepo.getActiveReminderByTarget('note', noteId);
      if (existing?.notificationId) {
        await notificationService.cancelReminder(existing.notificationId);
      }
      await remindersRepo.dismissReminderByTarget('note', noteId);
      await notificationsRepo.deleteNotificationByTarget('note', noteId);
      await notesRepo.updateNote(noteId, { reminderAt: null });
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, reminderAt: undefined } : n)));
      setReminders((prev) => prev.filter((r) => !(r.targetType === 'note' && r.targetId === noteId)));
      await refreshNotifications();
    } else {
      const parsedConfig = parseReminderString(triggerAt);
      const computedTriggerDate = parsedConfig?.type === 'repeat' && parsedConfig.repeatRule
        ? getNextOccurrence(parsedConfig.repeatRule)
        : new Date(triggerAt);

      const noteTitle = targetNote.title || 'Untitled Note';
      const noteBody = targetNote.contentMarkdown ? targetNote.contentMarkdown.trim().slice(0, 100) : '';

      const reminder = await remindersRepo.createReminder({
        targetType: 'note',
        targetId: noteId,
        noteId,
        triggerAt,
        title: noteTitle,
        body: noteBody,
      });

      const notificationId = await notificationService.scheduleReminder({
        reminderId: reminder.id,
        title: noteTitle,
        body: noteBody,
        triggerDate: computedTriggerDate,
        repeatRule: parsedConfig?.type === 'repeat' ? parsedConfig.repeatRule : undefined,
        payload: {
          targetType: 'note',
          targetId: noteId,
          noteId,
          title: noteTitle,
          body: noteBody,
        },
      });

      if (notificationId) {
        await remindersRepo.updateNotificationId(reminder.id, notificationId);
        reminder.notificationId = notificationId;
      }

      await notesRepo.updateNote(noteId, { reminderAt: triggerAt });
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, reminderAt: triggerAt } : n)));
      setReminders((prev) => [
        ...prev.filter((r) => !(r.targetType === 'note' && r.targetId === noteId)),
        reminder,
      ]);
      await refreshNotifications();
    }
  };

  const cancelReminder = async (reminderId: string) => {
    const rem = await remindersRepo.getReminderById(reminderId);
    if (!rem) return;
    if (rem.notificationId) {
      await notificationService.cancelReminder(rem.notificationId);
    }
    await remindersRepo.dismissReminder(reminderId);
    await notificationsRepo.deleteNotificationByTarget(rem.targetType, rem.targetId);
    if (rem.targetType === 'task') {
      await tasksRepo.updateTaskReminder(rem.targetId, null);
      setTasks((prev) => prev.map((t) => (t.id === rem.targetId ? { ...t, reminderAt: undefined } : t)));
    } else if (rem.targetType === 'note') {
      await notesRepo.updateNote(rem.targetId, { reminderAt: null });
      setNotes((prev) => prev.map((n) => (n.id === rem.targetId ? { ...n, reminderAt: undefined } : n)));
    }
    setReminders((prev) => prev.filter((r) => r.id !== reminderId));
    await refreshNotifications();
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
        activeFolders,
        favoriteFolders,
        pinnedFolders,
        archivedFolders,
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
        batchDeleteNotes,
        batchMoveNotesToFolder,
        batchTogglePin,
        batchArchiveNotes,
        batchRestoreNotes,
        batchPermanentlyDeleteNotes,
        createFolder,
        renameFolder,
        moveFolder,
        deleteFolder,
        deleteFolderWithOptions,
        duplicateFolder,
        updateFolderColor,
        updateFolderIcon,
        toggleFolderFavorite,
        toggleFolderPin,
        archiveFolder,
        unarchiveFolder,
        getFolderStats,
        getPendingFolderChangelogs,
        applyRemoteFolderDelta,
        moveNoteToFolder,
        setNoteTags,
        addTask,
        toggleTask,
        updateTaskPriority,
        updateTaskDueDate,
        deleteTask,
        reminders,
        setTaskReminder,
        setNoteReminder,
        cancelReminder,
        notifications,
        unreadNotificationsCount,
        notificationCounts,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearNotification,
        clearAllNotifications,
        refreshNotifications,
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
