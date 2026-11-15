import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NoteItem, TaskItem, ComposableBlock, TaskPriority, BlockType, ChecklistPoint } from '../types/note';
import { NoteColorToken } from '../theme/tokens';
import { notesRepo } from '../db/notesRepo';
import { tasksRepo } from '../db/tasksRepo';
import { foldersRepo } from '../db/foldersRepo';
import { tagsRepo } from '../db/tagsRepo';
import { searchHistoryRepo } from '../db/searchHistoryRepo';
import { remindersRepo } from '../db/remindersRepo';
import { notificationsRepo } from '../db/notificationsRepo';
import { LockTargetPayload, securityRepo } from '../db/securityRepo';
import { useSecurity } from '../context/SecurityContext';
import { computeLockedNoteIdSet } from '../core/security/vaultLockHelpers';
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
import { PASTEL_PALETTE, INITIAL_NOTES, INITIAL_TASKS } from './seedData';
import { ensureWelcomeStarterNote, WELCOME_STARTER_NOTE_ID } from './starterNote';
import { useFolderStoreActions } from './slices/useFolderStoreActions';
import { useReminderStoreActions } from './slices/useReminderStoreActions';
import { useWorkspaceBackupActions } from './slices/useWorkspaceBackupActions';

export { PASTEL_PALETTE, INITIAL_NOTES, INITIAL_TASKS };

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
  addNoteWithBlocks: (params: {
    title?: string;
    blocks: ComposableBlock[];
    colorToken?: NoteColorToken;
    folderPath?: string;
    tags?: string[];
  }) => Promise<NoteItem>;
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
  lockedNoteIds: ReadonlySet<string>;
  lockNote: (
    noteId: string,
    payload: LockTargetPayload,
    options?: { keepSessionUnlocked?: boolean }
  ) => Promise<{
    lockType: 'master' | 'custom';
    lockCredentialKind: 'pin' | 'password' | null;
    lockHash: string | null;
    lockSalt: string | null;
    lockHint: string | null;
  } | void>;
  unlockNoteForever: (noteId: string) => Promise<void>;
  batchLockNotes: (noteIds: string[], payload: LockTargetPayload) => Promise<void>;
  batchUnlockNotesForever: (noteIds: string[]) => Promise<void>;
  lockFolder: (folderId: string, folderPath: string, payload: LockTargetPayload) => Promise<void>;
  unlockFolderForever: (folderId: string) => Promise<void>;
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
  addNoteWithBlocks: async () => ({} as NoteItem),
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
  lockedNoteIds: new Set<string>(),
  lockNote: async () => {},
  unlockNoteForever: async () => {},
  batchLockNotes: async () => {},
  batchUnlockNotesForever: async () => {},
  lockFolder: async () => {},
  unlockFolderForever: async () => {},
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
  const {
    unlockedNoteIds,
    unlockedFolderPaths,
    markNoteUnlocked,
    relockNoteSession,
    relockFolderSession,
    relockFoldersOnSwitch,
  } = useSecurity();
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
    relockFoldersOnSwitch(null);
    setQueryRequestState(DEFAULT_NOTE_QUERY_REQUEST);
    setActiveFilterState('all');
  };

  const setStatusScopeFilter = (statusScope: NoteStatusScope) => {
    relockFoldersOnSwitch(null);
    setQueryRequest({
      statusScope,
      folderPath: null,
      tags: [],
    });
  };

  const setFolderFilter = (folderPath: string | null, includeSubfolders: boolean = false) => {
    relockFoldersOnSwitch(folderPath);
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
    relockFoldersOnSwitch(null);
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

  // Effective locked note set (direct note lock OR ancestor folder lock cascade)
  const lockedNoteIds = useMemo(
    () => computeLockedNoteIdSet(notes, folders, unlockedNoteIds, unlockedFolderPaths),
    [notes, folders, unlockedNoteIds, unlockedFolderPaths]
  );

  // Redact tags belonging exclusively to locked notes until unlocked
  const visibleTags = useMemo(() => {
    const lockedOnlyTags = new Set<string>();
    const unlockedTags = new Set<string>();
    for (const n of notes) {
      if (n.status === 'trashed') continue;
      const noteTags = n.tags || [];
      if (lockedNoteIds.has(n.id)) {
        for (const t of noteTags) lockedOnlyTags.add(t);
      } else {
        for (const t of noteTags) unlockedTags.add(t);
      }
    }
    for (const t of tags) {
      if (!lockedOnlyTags.has(t)) unlockedTags.add(t);
    }
    return Array.from(unlockedTags).filter(Boolean);
  }, [notes, tags, lockedNoteIds]);

  // Execute the Unified 3-Stage Query, Ranking & 10-Note Pagination Pipeline
  const unifiedFeed = useMemo(
    () => executeNoteQuery(notes, searchIndexMap, queryRequest, { lockedNoteIds }),
    [notes, searchIndexMap, queryRequest, lockedNoteIds]
  );

  const updateNote = (updated: NoteItem) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  const lockNote = async (
    noteId: string,
    payload: LockTargetPayload,
    options?: { keepSessionUnlocked?: boolean }
  ) => {
    const computed = await securityRepo.lockNoteRecord(noteId, payload);
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? {
              ...n,
              isLocked: true,
              lockType: computed.lockType,
              lockCredentialKind: computed.lockCredentialKind || undefined,
              lockHash: computed.lockHash || undefined,
              lockSalt: computed.lockSalt || undefined,
              lockHint: computed.lockHint || undefined,
            }
          : n
      )
    );
    if (options?.keepSessionUnlocked) {
      markNoteUnlocked(noteId);
    } else {
      relockNoteSession(noteId);
    }
    logWorkspaceActivity('note_lifecycle', 'lock_note', `Locked note (${computed.lockType})`, noteId);
    return computed;
  };

  const unlockNoteForever = async (noteId: string) => {
    await securityRepo.unlockNoteRecord(noteId);
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? {
              ...n,
              isLocked: false,
              lockType: undefined,
              lockCredentialKind: undefined,
              lockHash: undefined,
              lockSalt: undefined,
              lockHint: undefined,
            }
          : n
      )
    );
    relockNoteSession(noteId);
    logWorkspaceActivity('note_lifecycle', 'unlock_note_permanent', 'Removed lock from note', noteId);
  };

  const batchLockNotes = async (noteIds: string[], payload: LockTargetPayload) => {
    if (noteIds.length === 0) return;
    const computed = await securityRepo.batchLockNoteRecords(noteIds, payload);
    const targetSet = new Set(noteIds);
    setNotes((prev) =>
      prev.map((n) =>
        targetSet.has(n.id)
          ? {
              ...n,
              isLocked: true,
              lockType: computed.lockType,
              lockCredentialKind: computed.lockCredentialKind || undefined,
              lockHash: computed.lockHash || undefined,
              lockSalt: computed.lockSalt || undefined,
              lockHint: computed.lockHint || undefined,
            }
          : n
      )
    );
    for (const id of noteIds) {
      relockNoteSession(id);
    }
    logWorkspaceActivity(
      'note_lifecycle',
      'batch_lock_notes',
      `Locked ${noteIds.length} note(s) (${computed.lockType})`
    );
  };

  const batchUnlockNotesForever = async (noteIds: string[]) => {
    if (noteIds.length === 0) return;
    await securityRepo.batchUnlockNoteRecords(noteIds);
    const targetSet = new Set(noteIds);
    setNotes((prev) =>
      prev.map((n) =>
        targetSet.has(n.id)
          ? {
              ...n,
              isLocked: false,
              lockType: undefined,
              lockCredentialKind: undefined,
              lockHash: undefined,
              lockSalt: undefined,
              lockHint: undefined,
            }
          : n
      )
    );
    for (const id of noteIds) {
      relockNoteSession(id);
    }
    logWorkspaceActivity(
      'note_lifecycle',
      'batch_unlock_notes',
      `Removed lock from ${noteIds.length} note(s)`
    );
  };

  const lockFolder = async (folderId: string, folderPath: string, payload: LockTargetPayload) => {
    const computed = await securityRepo.lockFolderRecord(folderId, payload);
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId
          ? {
              ...f,
              is_locked: 1,
              lock_type: computed.lockType,
              lock_credential_kind: computed.lockCredentialKind,
              lock_hash: computed.lockHash,
              lock_salt: computed.lockSalt,
              lock_hint: computed.lockHint,
            }
          : f
      )
    );
    relockFolderSession(folderPath);
    logWorkspaceActivity(
      'folder',
      'lock_folder',
      `Locked folder "${folderPath}" (${computed.lockType})`,
      folderId
    );
  };

  const unlockFolderForever = async (folderId: string) => {
    const targetFolder = folders.find((f) => f.id === folderId);
    await securityRepo.unlockFolderRecord(folderId);
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId
          ? {
              ...f,
              is_locked: 0,
              lock_type: null,
              lock_credential_kind: null,
              lock_hash: null,
              lock_salt: null,
              lock_hint: null,
            }
          : f
      )
    );
    if (targetFolder?.path) {
      relockFolderSession(targetFolder.path);
    }
    logWorkspaceActivity('folder', 'unlock_folder_permanent', 'Removed lock from folder', folderId);
  };

  const {
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotification,
    clearAllNotifications,
    reconcileFiredReminders,
    setTaskReminder,
    setNoteReminder,
    cancelReminder,
  } = useReminderStoreActions({
    tasks,
    setTasks,
    notes,
    setNotes,
    reminders,
    setReminders,
    setNotifications,
    setUnreadNotificationsCount,
    setNotificationCounts,
    updateNote,
  });

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

      let resolvedNotes = allNotes;
      let resolvedTasks = allTasks;

      // Point 37: Pre-Seeded Interactive 'Welcome to ScribeX' Starter Note
      // Automatically seed when database is empty (0 active notes), or when new user visits home first time (login or guest)
      if (allNotes.length === 0) {
        const seeded = await ensureWelcomeStarterNote(notesRepo, tasksRepo, true);
        if (seeded) {
          resolvedNotes = await notesRepo.listNotes();
          resolvedTasks = await tasksRepo.listTasks();
        }
      } else if (!allNotes.some((n) => n.id === WELCOME_STARTER_NOTE_ID)) {
        const seeded = await ensureWelcomeStarterNote(notesRepo, tasksRepo, false);
        if (seeded) {
          resolvedNotes = await notesRepo.listNotes();
          resolvedTasks = await tasksRepo.listTasks();
        }
      }

      // Combine into unified store
      const combinedNotes = [...resolvedNotes, ...trashedNotes];
      setNotes(combinedNotes);
      setTasks(resolvedTasks);
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

  const addNoteWithBlocks = async ({
    title,
    blocks,
    colorToken,
    folderPath = 'General',
    tags = [],
  }: {
    title?: string;
    blocks: ComposableBlock[];
    colorToken?: NoteColorToken;
    folderPath?: string;
    tags?: string[];
  }): Promise<NoteItem> => {
    const nextColor = colorToken || PASTEL_PALETTE[notes.length % PASTEL_PALETTE.length];
    const cleanTitle = (title && title.trim()) || 'Untitled Note';
    const contentMarkdown = serializeBlocksToMarkdown(blocks);

    const tempId = `note-${Date.now()}`;
    const optimisticNote: NoteItem = {
      id: tempId,
      userId: 'user-default',
      folderPath,
      title: cleanTitle,
      contentMarkdown,
      blocks,
      colorToken: nextColor,
      isFavorite: false,
      isPinned: false,
      status: 'active',
      tags,
      createdAt: 'Just now',
      updatedAt: 'Just now',
    };

    setNotes((prev) => [optimisticNote, ...prev]);

    try {
      const created = await notesRepo.createNote({
        id: tempId,
        title: cleanTitle,
        contentMarkdown,
        blocks,
        folderPath,
        colorToken: nextColor,
        tags,
      });

      // If there are checklist blocks, sync them to tasksRepo
      const checklistBlocks = blocks.filter((b) => b.type === 'checklist');
      if (checklistBlocks.length > 0) {
        try {
          const checklistPoints: ChecklistPoint[] = checklistBlocks.flatMap((b) => {
            if (Array.isArray(b.metadata?.items)) {
              return b.metadata.items.map((item: any) => ({
                id: item.id || `cp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                text: item.text || item.content || '',
                checked: Boolean(item.checked),
                isBullet: false,
              }));
            }
            return [];
          });
          if (checklistPoints.length > 0) {
            await tasksRepo.syncNoteChecklists(created.id, created.title, created.colorToken, checklistPoints);
            const updatedTasks = await tasksRepo.listTasks();
            setTasks(updatedTasks);
          }
        } catch (taskErr) {
          console.warn('Failed to sync checklist tasks:', taskErr);
        }
      }

      setNotes((prev) => prev.map((n) => (n.id === tempId ? created : n)));
      if (tags.length > 0) {
        setTags((prev) => Array.from(new Set([...prev, ...tags])));
      }
      return created;
    } catch (err) {
      console.warn('Failed to persist note with blocks via notesRepo:', err);
      return optimisticNote;
    }
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

  // Workspace Backup & Batch Actions Slice
  const {
    emptyTrash,
    batchDeleteNotes,
    batchMoveNotesToFolder,
    batchTogglePin,
    batchArchiveNotes,
    batchRestoreNotes,
    batchPermanentlyDeleteNotes,
  } = useWorkspaceBackupActions({
    notes,
    setNotes,
    tasks,
    setTasks,
    refreshFromDB,
  });

  // Folder Store Actions Slice
  const {
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolderWithOptions,
    deleteFolder,
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
  } = useFolderStoreActions({
    folders,
    setFolders,
    notes,
    setNotes,
    queryRequest,
    setFolderFilter,
    logWorkspaceActivity,
    refreshFromDB,
  });

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
        tags: visibleTags,
        activeFilter,
        isLoading,
        setActiveFilter,
        addNote,
        addNoteWithBlocks,
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
        lockedNoteIds,
        lockNote,
        unlockNoteForever,
        batchLockNotes,
        batchUnlockNotesForever,
        lockFolder,
        unlockFolderForever,
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
