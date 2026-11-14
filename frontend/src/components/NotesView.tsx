import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal, Platform, Share, Alert, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme';
import { useSecurity } from '../context';
import { useNotesStore } from '../state/useNotesStore';
import { NoteItem } from '../types/note';
import {
  getAncestorFolderPaths,
  isFolderEffectivelyLocked,
  normalizeFolderPath,
} from '../core/security/vaultLockHelpers';

function isSameOrDescendantPath(childPath?: string | null, parentPath?: string | null): boolean {
  const normChild = normalizeFolderPath(childPath);
  const normParent = normalizeFolderPath(parentPath);
  if (!normChild || !normParent) return false;
  return normChild === normParent || normChild.startsWith(`${normParent}/`);
}
import { NoteCard } from './notes/NoteCard';
import {
  Star,
  Mic,
  Search,
  Folder,
  Plus,
  Pin,
  Archive,
  Trash2,
  Tag,
  X,
  Check,
  FilePlus,
  ChevronRight,
  CornerDownRight,
  FolderPlus,
  Clock,
  ArrowLeft,
  CheckSquare,
  FolderInput,
  Share2,
  RotateCcw,
  MoreVertical,
  FolderTree,
  ArrowDownUp,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react-native';
import { FolderActionSheet, renderFolderIcon } from './folders/FolderActionSheet';
import { DeleteFolderModal } from './folders/DeleteFolderModal';
import { RenameFolderModal } from './folders/RenameFolderModal';
import { MoveFolderModal } from './folders/MoveFolderModal';
import { FolderExplorerModal } from './folders/FolderExplorerModal';
import { NotesBatchActionBar } from "./notes/NotesBatchActionBar";
import { NotesSearchBar } from "./notes/NotesSearchBar";
import { NotesFilterTrack } from "./notes/NotesFilterTrack";
import { FolderContextBanners } from "./notes/FolderContextBanners";
import { CreateFolderModal, BatchMoveFolderModal } from "./notes/CreateFolderModal";
import { FolderDropdownModal } from './folders/FolderDropdownModal';
import { SortOrderModal } from './notes/SortOrderModal';
import { NotesFilterModal } from './notes/NotesFilterModal';
import { NoteColors, NoteColorToken } from '../theme/tokens';
import { NoteStatusScope } from '../core/noteQueryEngine';
import { FolderNoteStats } from '../db/types';

export const NotesView: React.FC = () => {
  const router = useRouter();
  const { isDark } = useTheme();
  const {
    securityConfig,
    unlockedNoteIds,
    unlockedFolderPaths,
    markFolderUnlocked,
    relockFoldersOnSwitch,
    relockNoteSession,
    relockFolderSession,
    promptUnlockNote,
    promptUnlockFolder,
    promptConfigureLock,
    promptVerifyTargetCredential,
  } = useSecurity();
  const {
    notes,
    folders,
    activeFolders,
    favoriteFolders,
    pinnedFolders,
    archivedFolders,
    tags,
    activeFilter,
    setActiveFilter,
    queryRequest,
    setStatusScopeFilter,
    setFolderFilter,
    toggleTagFilter,
    searchQuery,
    setSearchQuery,
    pinnedCards,
    feedCards,
    totalMatches,
    mainFeedTotal,
    visibleCount,
    hasMore,
    isSearchActive,
    partitionCounts,
    loadNextPage,
    recentSearches,
    recordSearchHistory,
    deleteSearchHistoryItem,
    clearSearchHistory,
    toggleFavorite,
    togglePin,
    unarchiveNote,
    restoreNote,
    permanentlyDeleteNote,
    emptyTrash,
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolderWithOptions,
    duplicateFolder,
    updateFolderColor,
    updateFolderIcon,
    toggleFolderFavorite,
    toggleFolderPin,
    archiveFolder,
    unarchiveFolder,
    getFolderStats,
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
    setSortByFilter,
    toggleBlockTypeFilter,
    resetQueryRequest,
  } = useNotesStore();

  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [isMoveFolderModalOpen, setIsMoveFolderModalOpen] = useState(false);
  const [quickNewFolderName, setQuickNewFolderName] = useState('');
  const isSelectionMode = selectedNoteIds.size > 0;

  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const activeFiltersCount =
    (queryRequest.hasBlockTypes || []).length +
    (queryRequest.tags || []).length +
    (queryRequest.folderPath ? 1 : 0) +
    (queryRequest.statusScope !== 'active' ? 1 : 0);

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedParentPath, setSelectedParentPath] = useState<string>('');

  // Folder Actions Management State
  const [actionSheetFolder, setActionSheetFolder] = useState<{
    path: string;
    id?: string;
    colorToken?: string;
    icon?: string | null;
    isFavorite?: boolean;
    isPinned?: boolean;
    isArchived?: boolean;
    isLocked?: boolean;
    lockType?: 'master' | 'custom' | null;
  } | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isFolderExplorerOpen, setIsFolderExplorerOpen] = useState(false);
  const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isMoveFolderReparentModalOpen, setIsMoveFolderReparentModalOpen] = useState(false);
  const [isDeleteFolderModalOpen, setIsDeleteFolderModalOpen] = useState(false);
  const [activeFolderStats, setActiveFolderStats] = useState<FolderNoteStats | null>(null);

  // Voice-to-Text Search Dictation State
  const [isVoiceSearching, setIsVoiceSearching] = useState(false);
  const recognitionRef = useRef<any>(null);
  const loadingMoreLockRef = useRef(false);
  const actionSheetEphemeralFoldersRef = useRef<string[]>([]);
  const actionSheetRelockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (actionSheetRelockTimerRef.current) {
        clearTimeout(actionSheetRelockTimerRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) { }
      }
    };
  }, []);

  const handleToggleVoiceSearch = () => {
    if (isVoiceSearching) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) { }
        recognitionRef.current = null;
      }
      setIsVoiceSearching(false);
      if (searchQuery.trim()) {
        recordSearchHistory(searchQuery.trim(), 'voice');
      }
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; ++i) {
              transcript += event.results[i][0].transcript;
            }
            if (transcript.trim()) {
              setSearchQuery(transcript.trim());
            }
          };

          recognition.onerror = () => setIsVoiceSearching(false);
          recognition.onend = () => {
            setIsVoiceSearching(false);
          };
          recognition.start();
          recognitionRef.current = recognition;
          setIsVoiceSearching(true);
          return;
        } catch (_) {
          setIsVoiceSearching(false);
        }
      }
    }

    // Mobile / fallback voice search toggle feedback
    setIsVoiceSearching(true);
    setTimeout(() => {
      setIsVoiceSearching(false);
    }, 2000);
  };

  const handleScrollFeed = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!hasMore || loadingMoreLockRef.current) return;
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
    if (distanceFromBottom < 160) {
      loadingMoreLockRef.current = true;
      loadNextPage();
      setTimeout(() => {
        loadingMoreLockRef.current = false;
      }, 250);
    }
  };

  const handleOpenFolderModal = () => {
    setSelectedParentPath('');
    setNewFolderName('');
    setIsFolderModalOpen(true);
  };

  const handleSelectFolderWithSecurity = async (
    folderPath: string | null,
    includeSubfolders: boolean = false
  ) => {
    setIsFilterModalOpen(false);
    setIsFolderDropdownOpen(false);
    setIsFolderExplorerOpen(false);

    if (folderPath) {
      const clean = normalizeFolderPath(folderPath);
      if (isFolderEffectivelyLocked(clean, folders, unlockedFolderPaths)) {
        const unlocked = await promptUnlockFolder(clean, folders);
        if (!unlocked) return;
      }
    }

    relockFoldersOnSwitch(folderPath);
    setFolderFilter(folderPath, includeSubfolders);
  };

  const handleSetStatusScopeWithSecurity = (scope: NoteStatusScope) => {
    relockFoldersOnSwitch(null);
    setStatusScopeFilter(scope);
  };

  const handleOpenNote = async (note: NoteItem) => {
    if (lockedNoteIds.has(note.id)) {
      const ok = await promptUnlockNote(note, folders);
      if (!ok) return;
    }

    if (searchQuery.trim()) {
      recordSearchHistory(searchQuery.trim());
    }
    router.push(`/note/${note.id}`);
  };

  const cancelActionSheetRelockTimer = () => {
    if (actionSheetRelockTimerRef.current) {
      clearTimeout(actionSheetRelockTimerRef.current);
      actionSheetRelockTimerRef.current = null;
    }
  };

  const consumeActionSheetEphemeralSet = (): Set<string> => {
    cancelActionSheetRelockTimer();
    const list = actionSheetEphemeralFoldersRef.current;
    actionSheetEphemeralFoldersRef.current = [];
    return new Set(list);
  };

  const flushActionSheetEphemeralRelock = (activeFolderOverride?: string | null) => {
    const ephemeral = consumeActionSheetEphemeralSet();
    if (securityConfig.autoRelockSeconds !== 0 || ephemeral.size === 0) return;
    const activeTarget =
      activeFolderOverride !== undefined ? activeFolderOverride : queryRequest.folderPath;
    for (const fp of ephemeral) {
      if (!isSameOrDescendantPath(activeTarget, fp)) {
        relockFolderSession(fp);
      }
    }
  };

  const restoreEphemeralUnlocks = (
    preNoteIds: Set<string>,
    preFolderPaths: Set<string>,
    touchedNoteIds: Iterable<string>,
    touchedFolderPaths: Iterable<string>,
    activeFolderOverride?: string | null
  ) => {
    if (securityConfig.autoRelockSeconds !== 0) return;
    for (const id of touchedNoteIds) {
      if (!preNoteIds.has(id)) {
        relockNoteSession(id);
      }
    }
    const activeTarget =
      activeFolderOverride !== undefined ? activeFolderOverride : queryRequest.folderPath;
    for (const fp of touchedFolderPaths) {
      if (!preFolderPaths.has(fp) && !isSameOrDescendantPath(activeTarget, fp)) {
        relockFolderSession(fp);
      }
    }
  };

  const collectAndVerifyNotes = async (
    candidates: NoteItem[],
    touchedNotes: Set<string>,
    touchedFolders: Set<string>
  ): Promise<boolean> => {
    for (const candidate of candidates) {
      if (lockedNoteIds.has(candidate.id)) {
        touchedNotes.add(candidate.id);
        for (const anc of getAncestorFolderPaths(normalizeFolderPath(candidate.folderPath))) {
          touchedFolders.add(anc);
        }
        const ok = await promptUnlockNote(candidate, folders);
        if (!ok) return false;
      }
    }
    return true;
  };

  const handleToggleCardLock = async (note: NoteItem) => {
    const cleanFolder = normalizeFolderPath(note.folderPath);
    const preFolderPaths = new Set(unlockedFolderPaths);
    const touchedFolders = new Set<string>();

    try {
      if (isFolderEffectivelyLocked(cleanFolder, folders, unlockedFolderPaths)) {
        for (const anc of getAncestorFolderPaths(cleanFolder)) {
          touchedFolders.add(anc);
        }
        const folderUnlocked = await promptUnlockFolder(cleanFolder, folders);
        if (!folderUnlocked) return;
      }

      if (note.isLocked) {
        // Unlock or re-lock existing locked note
        const lockType = note.lockType === 'custom' ? 'custom' : 'master';
        const verified = await promptVerifyTargetCredential({
          title: `Remove Lock: "${note.title || 'Untitled Note'}"`,
          subtitle:
            lockType === 'custom'
              ? 'Requires this note’s Custom PIN or Password.'
              : 'Verify your Master credential to permanently unlock this note.',
          lockType,
          credentialKind: note.lockCredentialKind,
          customHash: note.lockHash,
          customSalt: note.lockSalt,
          hint: note.lockHint,
          rateLimitKey: `note:${note.id}`,
          confirmLabel: 'Remove Lock',
        });
        if (!verified) return;
        await unlockNoteForever(note.id);
        return;
      }

      const payload = await promptConfigureLock({
        targetLabel: note.title || 'Untitled Note',
        entityType: 'note',
      });
      if (!payload) return;
      await lockNote(note.id, payload);
    } finally {
      restoreEphemeralUnlocks(new Set(), preFolderPaths, [], touchedFolders);
    }
  };

  const runWithSingleNoteUnlocked = async (
    noteId: string,
    action: () => Promise<void>
  ) => {
    const preNoteIds = new Set(unlockedNoteIds);
    const preFolderPaths = new Set(unlockedFolderPaths);
    const touchedNotes = new Set<string>();
    const touchedFolders = new Set<string>();

    try {
      const target = notes.find((n) => n.id === noteId);
      if (target && lockedNoteIds.has(noteId)) {
        touchedNotes.add(noteId);
        for (const anc of getAncestorFolderPaths(normalizeFolderPath(target.folderPath))) {
          touchedFolders.add(anc);
        }
        const ok = await promptUnlockNote(target, folders);
        if (!ok) return;
      }
      await action();
    } finally {
      restoreEphemeralUnlocks(preNoteIds, preFolderPaths, touchedNotes, touchedFolders);
    }
  };

  const handleTogglePinSafe = async (noteId: string) => {
    await runWithSingleNoteUnlocked(noteId, () => togglePin(noteId));
  };

  const handleToggleFavoriteSafe = async (noteId: string) => {
    await runWithSingleNoteUnlocked(noteId, () => toggleFavorite(noteId));
  };

  const handleRestoreNoteSafe = async (noteId: string) => {
    await runWithSingleNoteUnlocked(noteId, () => restoreNote(noteId));
  };

  const handleUnarchiveNoteSafe = async (noteId: string) => {
    await runWithSingleNoteUnlocked(noteId, () => unarchiveNote(noteId));
  };

  const handlePermanentlyDeleteNoteSafe = async (noteId: string) => {
    await runWithSingleNoteUnlocked(noteId, () => permanentlyDeleteNote(noteId));
  };

  const handleEmptyTrashSafe = async () => {
    const trashedNotes = notes.filter((n) => n.status === 'trashed');
    const preNoteIds = new Set(unlockedNoteIds);
    const preFolderPaths = new Set(unlockedFolderPaths);
    const touchedNotes = new Set<string>();
    const touchedFolders = new Set<string>();

    try {
      const ok = await collectAndVerifyNotes(trashedNotes, touchedNotes, touchedFolders);
      if (!ok) return;
      await emptyTrash();
    } finally {
      restoreEphemeralUnlocks(preNoteIds, preFolderPaths, touchedNotes, touchedFolders);
    }
  };

  const verifyFolderSubtreeUnlocked = async (
    folderPath: string,
    options?: {
      targetParentPath?: string | null;
      includeTrashedNotes?: boolean;
      beforePrompt?: () => void;
      touchedNoteIds?: Set<string>;
      touchedFolderPaths?: Set<string>;
    }
  ): Promise<boolean> => {
    const cleanRoot = normalizeFolderPath(folderPath);
    if (!cleanRoot) return true;

    const localUnlockedFolders = new Set(unlockedFolderPaths);
    const localUnlockedNotes = new Set(unlockedNoteIds);
    let didDismissActiveModal = false;
    const notifyBeforePrompt = () => {
      if (!didDismissActiveModal) {
        didDismissActiveModal = true;
        options?.beforePrompt?.();
      }
    };
    const recordFolderTouched = (fp: string) => {
      for (const anc of getAncestorFolderPaths(fp)) {
        localUnlockedFolders.add(anc);
        options?.touchedFolderPaths?.add(anc);
      }
    };

    if (isFolderEffectivelyLocked(cleanRoot, folders, localUnlockedFolders)) {
      notifyBeforePrompt();
      const ok = await promptUnlockFolder(cleanRoot, folders);
      if (!ok) return false;
      recordFolderTouched(cleanRoot);
    }

    const lockedDescendants = folders
      .filter((f) => {
        const subPath = normalizeFolderPath(f.path || f.name);
        if (!subPath || subPath === cleanRoot) return false;
        if (!isSameOrDescendantPath(subPath, cleanRoot)) return false;
        return Boolean(f.is_locked) && !localUnlockedFolders.has(subPath);
      })
      .sort(
        (a, b) =>
          normalizeFolderPath(a.path || a.name).length -
          normalizeFolderPath(b.path || b.name).length
      );

    for (const sub of lockedDescendants) {
      const subPath = normalizeFolderPath(sub.path || sub.name);
      if (isFolderEffectivelyLocked(subPath, folders, localUnlockedFolders)) {
        notifyBeforePrompt();
        const ok = await promptUnlockFolder(subPath, folders);
        if (!ok) return false;
        recordFolderTouched(subPath);
      }
    }

    const cleanDest = normalizeFolderPath(options?.targetParentPath);
    if (cleanDest && isFolderEffectivelyLocked(cleanDest, folders, localUnlockedFolders)) {
      notifyBeforePrompt();
      const ok = await promptUnlockFolder(cleanDest, folders);
      if (!ok) return false;
      recordFolderTouched(cleanDest);
    }

    const lockedNotesInSubtree = notes.filter((n) => {
      if (!options?.includeTrashedNotes && n.status === 'trashed') return false;
      if (!isSameOrDescendantPath(n.folderPath, cleanRoot)) return false;
      return Boolean(n.isLocked) && !localUnlockedNotes.has(n.id);
    });

    for (const lockedNote of lockedNotesInSubtree) {
      if (!localUnlockedNotes.has(lockedNote.id)) {
        notifyBeforePrompt();
        options?.touchedNoteIds?.add(lockedNote.id);
        for (const anc of getAncestorFolderPaths(normalizeFolderPath(lockedNote.folderPath))) {
          options?.touchedFolderPaths?.add(anc);
        }
        const ok = await promptUnlockNote(lockedNote, folders);
        if (!ok) return false;
        localUnlockedNotes.add(lockedNote.id);
      }
    }

    return true;
  };

  const handleCreateNewBlankNote = () => {
    router.push('/note/new');
  };

  const handleCreateFolder = async () => {
    const clean = newFolderName.trim().replace(/^\/+|\/+$/g, '');
    if (!clean) return;
    const cleanParent = normalizeFolderPath(selectedParentPath);
    const fullTargetPath = normalizeFolderPath(cleanParent ? `${cleanParent}/${clean}` : clean);
    consumeActionSheetEphemeralSet();
    if (fullTargetPath && isFolderEffectivelyLocked(fullTargetPath, folders, unlockedFolderPaths)) {
      setIsFolderModalOpen(false);
      const unlocked = await promptUnlockFolder(fullTargetPath, folders);
      if (!unlocked) return;
      setIsFolderModalOpen(true);
    }
    const created = await createFolder(clean, cleanParent || undefined);
    const targetPath = created?.path || fullTargetPath;
    setNewFolderName('');
    setSelectedParentPath(targetPath);
    setFolderFilter(targetPath);
  };

  const handleCreateAndCloseFolderModal = async () => {
    const clean = newFolderName.trim().replace(/^\/+|\/+$/g, '');
    if (!clean) return;
    const cleanParent = normalizeFolderPath(selectedParentPath);
    const fullTargetPath = normalizeFolderPath(cleanParent ? `${cleanParent}/${clean}` : clean);
    consumeActionSheetEphemeralSet();
    if (fullTargetPath && isFolderEffectivelyLocked(fullTargetPath, folders, unlockedFolderPaths)) {
      setIsFolderModalOpen(false);
      const unlocked = await promptUnlockFolder(fullTargetPath, folders);
      if (!unlocked) return;
    }
    const created = await createFolder(clean, cleanParent || undefined);
    const targetPath = created?.path || fullTargetPath;
    setNewFolderName('');
    setIsFolderModalOpen(false);
    setFolderFilter(targetPath);
  };

  const handleOpenFolderActions = async (folderPath: string) => {
    const cleanPath = normalizeFolderPath(folderPath);
    cancelActionSheetRelockTimer();
    const preFolders = new Set(unlockedFolderPaths);
    let newlyUnlockedAncestors: string[] = [];

    if (isFolderEffectivelyLocked(cleanPath, folders, unlockedFolderPaths)) {
      const unlocked = await promptUnlockFolder(cleanPath, folders);
      if (!unlocked) return;
      if (
        securityConfig.autoRelockSeconds === 0 &&
        !isSameOrDescendantPath(queryRequest.folderPath, cleanPath)
      ) {
        newlyUnlockedAncestors = getAncestorFolderPaths(cleanPath).filter(
          (p) => !preFolders.has(p)
        );
      }
    }
    actionSheetEphemeralFoldersRef.current = newlyUnlockedAncestors;

    const existingFolder = folders.find((f) => (f.path || f.name) === folderPath);
    let folderId = existingFolder?.id;
    if (!folderId) {
      try {
        const created = await createFolder(folderPath);
        folderId = created?.id;
      } catch (_) { }
    }
    const colorToken = existingFolder?.color_token || 'cyan';
    const icon = existingFolder?.icon || null;
    const isFavorite = Boolean(existingFolder?.is_favorite);
    const isPinned = Boolean(existingFolder?.is_pinned);
    const isArchived = Boolean(existingFolder?.is_archived);
    const isLocked = Boolean(existingFolder?.is_locked);
    const lockType = existingFolder?.lock_type || null;
    setActionSheetFolder({
      path: folderPath,
      id: folderId,
      colorToken,
      icon,
      isFavorite,
      isPinned,
      isArchived,
      isLocked,
      lockType,
    });
    try {
      const stats = await getFolderStats(folderPath, folderId);
      setActiveFolderStats(stats);
    } catch (_) {
      setActiveFolderStats(null);
    }
    setIsActionSheetOpen(true);
  };

  const handleOpenCreateSubfolderFromSheet = async (parentPath?: string) => {
    cancelActionSheetRelockTimer();
    const cleanParent = normalizeFolderPath(parentPath);
    if (cleanParent && isFolderEffectivelyLocked(cleanParent, folders, unlockedFolderPaths)) {
      setIsActionSheetOpen(false);
      const preFolderPaths = new Set(unlockedFolderPaths);
      const unlocked = await promptUnlockFolder(cleanParent, folders);
      if (!unlocked) return;
      if (
        securityConfig.autoRelockSeconds === 0 &&
        !isSameOrDescendantPath(queryRequest.folderPath, cleanParent)
      ) {
        const added = getAncestorFolderPaths(cleanParent).filter((p) => !preFolderPaths.has(p));
        actionSheetEphemeralFoldersRef.current = Array.from(
          new Set([...actionSheetEphemeralFoldersRef.current, ...added])
        );
      }
    }
    setSelectedParentPath(cleanParent);
    setNewFolderName('');
    setIsFolderModalOpen(true);
  };

  const handleConfirmRenameFolder = async (newName: string) => {
    const cleanNewName = newName.trim().replace(/^\/+|\/+$/g, '');
    if (!actionSheetFolder?.id || !cleanNewName) return;
    const oldPath = normalizeFolderPath(actionSheetFolder.path);
    const sheetEphemeral = consumeActionSheetEphemeralSet();
    const preNoteIds = new Set(unlockedNoteIds);
    const preFolderPaths = new Set(
      Array.from(unlockedFolderPaths).filter((p) => !sheetEphemeral.has(p))
    );
    const touchedNotes = new Set<string>();
    const touchedFolders = new Set<string>(sheetEphemeral);

    let verified = false;
    try {
      verified = await verifyFolderSubtreeUnlocked(oldPath, {
        includeTrashedNotes: true,
        beforePrompt: () => setIsRenameModalOpen(false),
        touchedNoteIds: touchedNotes,
        touchedFolderPaths: touchedFolders,
      });
      if (!verified) return;

      const parentSlashIndex = oldPath.lastIndexOf('/');
      const newPath =
        parentSlashIndex !== -1
          ? `${oldPath.slice(0, parentSlashIndex + 1)}${cleanNewName}`
          : cleanNewName;
      const wasActiveSubtree = isSameOrDescendantPath(queryRequest.folderPath, oldPath);

      await renameFolder(actionSheetFolder.id, cleanNewName);

      const candidatePaths = new Set<string>(
        Array.from(unlockedFolderPaths).filter((p) => isSameOrDescendantPath(p, oldPath))
      );
      for (const fp of touchedFolders) {
        if (isSameOrDescendantPath(fp, oldPath)) {
          candidatePaths.add(fp);
        }
      }
      for (const f of folders) {
        const fp = normalizeFolderPath(f.path || f.name);
        if (f.is_locked === 1 && fp && isSameOrDescendantPath(fp, oldPath)) {
          candidatePaths.add(fp);
        }
      }

      for (const stalePath of candidatePaths) {
        relockFolderSession(stalePath);
        const suffix = stalePath.slice(oldPath.length);
        const newDescendantPath = `${newPath}${suffix}`;
        const isInActiveViewPath = isSameOrDescendantPath(queryRequest.folderPath, stalePath);
        const shouldKeepUnlocked =
          securityConfig.autoRelockSeconds === 0
            ? isInActiveViewPath
            : isInActiveViewPath || preFolderPaths.has(stalePath) || touchedFolders.has(stalePath);
        if (shouldKeepUnlocked) {
          markFolderUnlocked(newDescendantPath);
        }
      }

      const activeAfterRename = wasActiveSubtree
        ? `${newPath}${normalizeFolderPath(queryRequest.folderPath).slice(oldPath.length)}`
        : queryRequest.folderPath;
      const nonSubtreeFolders = Array.from(touchedFolders).filter(
        (fp) => !isSameOrDescendantPath(fp, oldPath)
      );
      restoreEphemeralUnlocks(
        preNoteIds,
        preFolderPaths,
        touchedNotes,
        nonSubtreeFolders,
        activeAfterRename
      );

      setActionSheetFolder((prev) => (prev ? { ...prev, path: newPath } : null));
    } finally {
      if (!verified) {
        restoreEphemeralUnlocks(preNoteIds, preFolderPaths, touchedNotes, touchedFolders);
      }
    }
  };

  const handleConfirmMoveFolder = async (newParentPath: string | null) => {
    if (!actionSheetFolder?.id) return;
    const oldPath = normalizeFolderPath(actionSheetFolder.path);
    const cleanDest = normalizeFolderPath(newParentPath);
    const sheetEphemeral = consumeActionSheetEphemeralSet();
    const preNoteIds = new Set(unlockedNoteIds);
    const preFolderPaths = new Set(
      Array.from(unlockedFolderPaths).filter((p) => !sheetEphemeral.has(p))
    );
    const touchedNotes = new Set<string>();
    const touchedFolders = new Set<string>(sheetEphemeral);

    let verified = false;
    try {
      verified = await verifyFolderSubtreeUnlocked(oldPath, {
        targetParentPath: cleanDest || null,
        includeTrashedNotes: true,
        beforePrompt: () => setIsMoveFolderReparentModalOpen(false),
        touchedNoteIds: touchedNotes,
        touchedFolderPaths: touchedFolders,
      });
      if (!verified) return;

      const leafName = oldPath.split('/').filter(Boolean).pop() || oldPath;
      const newPath = cleanDest ? `${cleanDest}/${leafName}` : leafName;
      const wasActiveSubtree = isSameOrDescendantPath(queryRequest.folderPath, oldPath);

      await moveFolder(actionSheetFolder.id, newParentPath);

      const candidatePaths = new Set<string>(
        Array.from(unlockedFolderPaths).filter((p) => isSameOrDescendantPath(p, oldPath))
      );
      for (const fp of touchedFolders) {
        if (isSameOrDescendantPath(fp, oldPath)) {
          candidatePaths.add(fp);
        }
      }
      for (const f of folders) {
        const fp = normalizeFolderPath(f.path || f.name);
        if (f.is_locked === 1 && fp && isSameOrDescendantPath(fp, oldPath)) {
          candidatePaths.add(fp);
        }
      }

      for (const stalePath of candidatePaths) {
        relockFolderSession(stalePath);
        const suffix = stalePath.slice(oldPath.length);
        const newDescendantPath = `${newPath}${suffix}`;
        const isInActiveViewPath = isSameOrDescendantPath(queryRequest.folderPath, stalePath);
        const shouldKeepUnlocked =
          securityConfig.autoRelockSeconds === 0
            ? isInActiveViewPath
            : isInActiveViewPath || preFolderPaths.has(stalePath) || touchedFolders.has(stalePath);
        if (shouldKeepUnlocked) {
          markFolderUnlocked(newDescendantPath);
        }
      }

      const activeAfterMove = wasActiveSubtree
        ? `${newPath}${normalizeFolderPath(queryRequest.folderPath).slice(oldPath.length)}`
        : queryRequest.folderPath;
      const nonSubtreeFolders = Array.from(touchedFolders).filter(
        (fp) => !isSameOrDescendantPath(fp, oldPath)
      );
      restoreEphemeralUnlocks(
        preNoteIds,
        preFolderPaths,
        touchedNotes,
        nonSubtreeFolders,
        activeAfterMove
      );

      setActionSheetFolder((prev) => (prev ? { ...prev, path: newPath } : null));
    } finally {
      if (!verified) {
        restoreEphemeralUnlocks(preNoteIds, preFolderPaths, touchedNotes, touchedFolders);
      }
    }
  };

  const handleConfirmDuplicateFolder = async (folderPath: string, folderId?: string) => {
    const idToUse = folderId || actionSheetFolder?.id;
    if (!idToUse) return;
    const cleanPath = normalizeFolderPath(folderPath);
    const sheetEphemeral = consumeActionSheetEphemeralSet();
    const preNoteIds = new Set(unlockedNoteIds);
    const preFolderPaths = new Set(
      Array.from(unlockedFolderPaths).filter((p) => !sheetEphemeral.has(p))
    );
    const touchedNotes = new Set<string>();
    const touchedFolders = new Set<string>(sheetEphemeral);

    try {
      const ok = await verifyFolderSubtreeUnlocked(cleanPath, {
        beforePrompt: () => setIsActionSheetOpen(false),
        touchedNoteIds: touchedNotes,
        touchedFolderPaths: touchedFolders,
      });
      if (!ok) return;
      await duplicateFolder(idToUse, folderPath);
    } finally {
      restoreEphemeralUnlocks(preNoteIds, preFolderPaths, touchedNotes, touchedFolders);
    }
  };

  const handleConfirmDeleteFolder = async (noteAction: 'moveToGeneral' | 'trash') => {
    if (!actionSheetFolder) return;
    const idToUse = actionSheetFolder.id || '';
    const cleanPath = normalizeFolderPath(actionSheetFolder.path);
    const sheetEphemeral = consumeActionSheetEphemeralSet();
    const preNoteIds = new Set(unlockedNoteIds);
    const preFolderPaths = new Set(
      Array.from(unlockedFolderPaths).filter((p) => !sheetEphemeral.has(p))
    );
    const touchedNotes = new Set<string>();
    const touchedFolders = new Set<string>(sheetEphemeral);

    try {
      const verified = await verifyFolderSubtreeUnlocked(cleanPath, {
        includeTrashedNotes: true,
        beforePrompt: () => setIsDeleteFolderModalOpen(false),
        touchedNoteIds: touchedNotes,
        touchedFolderPaths: touchedFolders,
      });
      if (!verified) return;

      await deleteFolderWithOptions(idToUse, actionSheetFolder.path, noteAction);

      for (const unlockedPath of new Set([...unlockedFolderPaths, ...touchedFolders])) {
        if (isSameOrDescendantPath(unlockedPath, cleanPath)) {
          relockFolderSession(unlockedPath);
        }
      }
      for (const f of folders) {
        const fp = normalizeFolderPath(f.path || f.name);
        if (fp && isSameOrDescendantPath(fp, cleanPath)) {
          relockFolderSession(fp);
        }
      }
      setActionSheetFolder(null);
    } finally {
      restoreEphemeralUnlocks(preNoteIds, preFolderPaths, touchedNotes, touchedFolders);
    }
  };

  const handleUnarchiveFolderSafe = async (
    folderId: string
  ): Promise<{ affectedNotes: number; affectedFolders: number }> => {
    const targetFolder = folders.find((f) => f.id === folderId);
    const preNoteIds = new Set(unlockedNoteIds);
    const preFolderPaths = new Set(unlockedFolderPaths);
    const touchedNotes = new Set<string>();
    const touchedFolders = new Set<string>();

    try {
      if (targetFolder) {
        const verified = await verifyFolderSubtreeUnlocked(
          normalizeFolderPath(targetFolder.path || targetFolder.name),
          {
            touchedNoteIds: touchedNotes,
            touchedFolderPaths: touchedFolders,
          }
        );
        if (!verified) return { affectedNotes: 0, affectedFolders: 0 };
      }
      return await unarchiveFolder(folderId);
    } finally {
      restoreEphemeralUnlocks(preNoteIds, preFolderPaths, touchedNotes, touchedFolders);
    }
  };

  const handleChangeFolderColor = async (colorToken: string) => {
    if (!actionSheetFolder?.id) return;
    await updateFolderColor(actionSheetFolder.id, colorToken);
    setActionSheetFolder((prev) => (prev ? { ...prev, colorToken } : null));
  };

  const handleChangeFolderIcon = async (icon: string | null) => {
    if (!actionSheetFolder?.id) return;
    await updateFolderIcon(actionSheetFolder.id, icon);
    setActionSheetFolder((prev) => (prev ? { ...prev, icon } : null));
  };

  const handleSelectAllFolderNotes = (folderPath: string) => {
    const clean = folderPath.trim().replace(/^\/+|\/+$/g, '');
    const matchingIds = notes
      .filter((n) => n.status !== 'trashed' && (n.folderPath === clean || n.folderPath?.startsWith(`${clean}/`)))
      .map((n) => n.id);
    setSelectedNoteIds(new Set(matchingIds));
  };

  const handleExportFolderNotes = async (folderPath: string) => {
    const clean = folderPath.trim().replace(/^\/+|\/+$/g, '');
    const sheetEphemeral = consumeActionSheetEphemeralSet();
    const preNoteIds = new Set(unlockedNoteIds);
    const preFolderPaths = new Set(
      Array.from(unlockedFolderPaths).filter((p) => !sheetEphemeral.has(p))
    );
    const touchedNotes = new Set<string>();
    const touchedFolders = new Set<string>(sheetEphemeral);

    try {
      const folderNotes = notes.filter(
        (n) => n.status !== 'trashed' && (n.folderPath === clean || n.folderPath?.startsWith(`${clean}/`))
      );
      if (folderNotes.length === 0) return;

      const ok = await collectAndVerifyNotes(folderNotes, touchedNotes, touchedFolders);
      if (!ok) return;

      const bundleText = folderNotes
        .map((n) => `# ${n.title || 'Untitled'}\n\n${n.contentMarkdown || ''}`)
        .join('\n\n---\n\n');
      try {
        await Share.share({
          title: `ScribeX - /${clean} Export`,
          message: bundleText,
        });
      } catch (_) { }
    } finally {
      restoreEphemeralUnlocks(preNoteIds, preFolderPaths, touchedNotes, touchedFolders);
    }
  };

  // Derive folders matching current status scope (active vs archived)
  const visibleFolders = React.useMemo(() => {
    if (queryRequest.statusScope === 'archived') {
      return folders.filter((f) => Boolean(f.is_archived));
    }
    return folders.filter((f) => !f.is_archived);
  }, [folders, queryRequest.statusScope]);

  const rawFolderPaths = React.useMemo(() => {
    if (queryRequest.statusScope === 'archived') {
      const archivedNotesFolders = notes
        .filter((n) => n.status === 'archived')
        .map((n) => n.folderPath)
        .filter(Boolean) as string[];
      return Array.from(new Set([...visibleFolders.map((f) => f.path || f.name), ...archivedNotesFolders]));
    }
    return Array.from(
      new Set([
        'General',
        ...visibleFolders.map((f) => f.path || f.name),
        ...notes
          .filter((n) => n.status !== 'trashed' && n.status !== 'archived')
          .map((n) => n.folderPath)
          .filter(Boolean) as string[],
      ])
    );
  }, [visibleFolders, notes, queryRequest.statusScope]);

  const allFolderNames = React.useMemo(() => {
    const expanded = new Set<string>();
    rawFolderPaths.forEach((p) => {
      if (!p) return;
      const parts = p.split('/').map((s) => s.trim()).filter(Boolean);
      let acc = '';
      parts.forEach((seg) => {
        acc = acc ? `${acc}/${seg}` : seg;
        expanded.add(acc);
      });
    });
    return Array.from(expanded);
  }, [rawFolderPaths]);

  // Direct child folders of the currently selected parent directory in the modal
  const currentLevelSubfolders = React.useMemo(() => {
    return allFolderNames.filter((folderPath) => {
      if (!selectedParentPath) {
        return !folderPath.includes('/');
      }
      if (!folderPath.startsWith(`${selectedParentPath}/`)) return false;
      const remainder = folderPath.slice(selectedParentPath.length + 1);
      return remainder.length > 0 && !remainder.includes('/');
    });
  }, [allFolderNames, selectedParentPath]);

  const parentBreadcrumbSegments = React.useMemo(() => {
    if (!selectedParentPath) return [];
    const parts = selectedParentPath.split('/').filter(Boolean);
    return parts.map((name, idx) => ({
      name,
      path: parts.slice(0, idx + 1).join('/'),
    }));
  }, [selectedParentPath]);

  const activeFolderObj = React.useMemo(() => {
    if (!queryRequest.folderPath) return null;
    return folders.find((f) => (f.path || f.name) === queryRequest.folderPath) || null;
  }, [folders, queryRequest.folderPath]);

  const activeFolderColor = React.useMemo(() => {
    if (!activeFolderObj?.color_token) return undefined;
    return NoteColors[activeFolderObj.color_token as NoteColorToken];
  }, [activeFolderObj]);

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  // Multi-Selection Logic & Batch Actions
  const handleToggleSelectNote = (noteId: string) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const handleLongPressNote = (noteId: string) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      next.add(noteId);
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedNoteIds(new Set());
  };

  const visibleNotes = React.useMemo(() => {
    const list: NoteItem[] = [];
    const seen = new Set<string>();
    pinnedCards.forEach((vm) => {
      if (!seen.has(vm.note.id)) {
        seen.add(vm.note.id);
        list.push(vm.note);
      }
    });
    feedCards.forEach((vm) => {
      if (!seen.has(vm.note.id)) {
        seen.add(vm.note.id);
        list.push(vm.note);
      }
    });
    return list;
  }, [pinnedCards, feedCards]);

  const isAllVisibleSelected =
    visibleNotes.length > 0 && visibleNotes.every((n) => selectedNoteIds.has(n.id));

  const handleToggleSelectAll = () => {
    if (isAllVisibleSelected) {
      setSelectedNoteIds(new Set());
    } else {
      setSelectedNoteIds(new Set(visibleNotes.map((n) => n.id)));
    }
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedNoteIds);
    if (ids.length === 0) return;
    const selectedNotes = notes.filter((n) => selectedNoteIds.has(n.id));
    const preNoteIds = new Set(unlockedNoteIds);
    const preFolderPaths = new Set(unlockedFolderPaths);
    const touchedNotes = new Set<string>();
    const touchedFolders = new Set<string>();

    try {
      const ok = await collectAndVerifyNotes(selectedNotes, touchedNotes, touchedFolders);
      if (!ok) return;
      if (queryRequest.statusScope === 'trashed') {
        await batchPermanentlyDeleteNotes(ids);
      } else {
        await batchDeleteNotes(ids);
      }
      handleClearSelection();
    } finally {
      restoreEphemeralUnlocks(preNoteIds, preFolderPaths, touchedNotes, touchedFolders);
    }
  };

  const handleBatchLock = async () => {
    const ids = Array.from(selectedNoteIds);
    if (ids.length === 0) return;

    const selectedNotes = notes.filter((n) => selectedNoteIds.has(n.id));
    const preFolderPaths = new Set(unlockedFolderPaths);
    const touchedFolders = new Set<string>();

    try {
      // 1. Verify any locked ancestor folders protecting selected notes
      const checkedFolders = new Set<string>();
      for (const n of selectedNotes) {
        const fp = normalizeFolderPath(n.folderPath);
        if (!checkedFolders.has(fp) && isFolderEffectivelyLocked(fp, folders, unlockedFolderPaths)) {
          for (const anc of getAncestorFolderPaths(fp)) {
            touchedFolders.add(anc);
          }
          const ok = await promptUnlockFolder(fp, folders);
          if (!ok) return;
        }
        checkedFolders.add(fp);
      }

      // 2. Enforce strict credential verification before replacing any already-locked note
      let masterVerified = false;
      for (const n of selectedNotes) {
        if (!n.isLocked) continue;
        if (n.lockType === 'custom') {
          const ok = await promptVerifyTargetCredential({
            title: `Replace Lock: "${n.title || 'Untitled Note'}"`,
            subtitle: 'Custom PIN/Password required before changing this note’s lock.',
            lockType: 'custom',
            credentialKind: n.lockCredentialKind,
            customHash: n.lockHash,
            customSalt: n.lockSalt,
            hint: n.lockHint,
            rateLimitKey: `note:${n.id}`,
            confirmLabel: 'Verify',
          });
          if (!ok) return;
        } else if (!masterVerified) {
          const ok = await promptVerifyTargetCredential({
            title: 'Replace Lock on Master-Locked Notes',
            subtitle: 'Verify your Master credential before overwriting existing note locks.',
            lockType: 'master',
            rateLimitKey: 'batch_master_relock',
            confirmLabel: 'Verify',
          });
          if (!ok) return;
          masterVerified = true;
        }
      }

      const payload = await promptConfigureLock({
        targetLabel: `${ids.length} selected note${ids.length === 1 ? '' : 's'}`,
        entityType: 'batch_notes',
      });
      if (!payload) return;
      await batchLockNotes(ids, payload);
      handleClearSelection();
    } finally {
      restoreEphemeralUnlocks(new Set(), preFolderPaths, [], touchedFolders);
    }
  };

  const handleBatchUnlock = async () => {
    const directlyLocked = notes.filter(
      (n) => selectedNoteIds.has(n.id) && Boolean(n.isLocked)
    );
    if (directlyLocked.length === 0) return;

    const verifiedIds: string[] = [];
    let masterVerified = false;

    for (const n of directlyLocked) {
      if (n.lockType === 'custom') {
        const ok = await promptVerifyTargetCredential({
          title: `Unlock "${n.title || 'Untitled Note'}"`,
          subtitle: 'Custom PIN/Password required to remove lock.',
          lockType: 'custom',
          credentialKind: n.lockCredentialKind,
          customHash: n.lockHash,
          customSalt: n.lockSalt,
          hint: n.lockHint,
          rateLimitKey: `note:${n.id}`,
          confirmLabel: 'Remove Lock',
        });
        if (!ok) return;
        verifiedIds.push(n.id);
      } else {
        if (!masterVerified) {
          const ok = await promptVerifyTargetCredential({
            title: 'Remove Lock from Master-Locked Notes',
            subtitle: 'Verify your Workspace Master credential to unlock selected Master-locked notes.',
            lockType: 'master',
            rateLimitKey: 'batch_master_unlock',
            confirmLabel: 'Remove Lock',
          });
          if (!ok) return;
          masterVerified = true;
        }
        verifiedIds.push(n.id);
      }
    }

    await batchUnlockNotesForever(verifiedIds);
    handleClearSelection();
  };

  const handleBatchTogglePin = async () => {
    const ids = Array.from(selectedNoteIds);
    if (ids.length === 0) return;
    const selectedNotes = notes.filter((n) => selectedNoteIds.has(n.id));
    const preNoteIds = new Set(unlockedNoteIds);
    const preFolderPaths = new Set(unlockedFolderPaths);
    const touchedNotes = new Set<string>();
    const touchedFolders = new Set<string>();

    try {
      const ok = await collectAndVerifyNotes(selectedNotes, touchedNotes, touchedFolders);
      if (!ok) return;
      const allPinned = selectedNotes.length > 0 && selectedNotes.every((n) => n.isPinned);
      await batchTogglePin(ids, !allPinned);
    } finally {
      restoreEphemeralUnlocks(preNoteIds, preFolderPaths, touchedNotes, touchedFolders);
    }
  };

  const handleBatchArchive = async () => {
    const ids = Array.from(selectedNoteIds);
    if (ids.length === 0) return;
    const selectedNotes = notes.filter((n) => selectedNoteIds.has(n.id));
    const preNoteIds = new Set(unlockedNoteIds);
    const preFolderPaths = new Set(unlockedFolderPaths);
    const touchedNotes = new Set<string>();
    const touchedFolders = new Set<string>();

    try {
      const ok = await collectAndVerifyNotes(selectedNotes, touchedNotes, touchedFolders);
      if (!ok) return;
      const isArchivedScope = queryRequest.statusScope === 'archived';
      await batchArchiveNotes(ids, !isArchivedScope);
      handleClearSelection();
    } finally {
      restoreEphemeralUnlocks(preNoteIds, preFolderPaths, touchedNotes, touchedFolders);
    }
  };

  const handleBatchRestore = async () => {
    const ids = Array.from(selectedNoteIds);
    if (ids.length === 0) return;
    const selectedNotes = notes.filter((n) => selectedNoteIds.has(n.id));
    const preNoteIds = new Set(unlockedNoteIds);
    const preFolderPaths = new Set(unlockedFolderPaths);
    const touchedNotes = new Set<string>();
    const touchedFolders = new Set<string>();

    try {
      const ok = await collectAndVerifyNotes(selectedNotes, touchedNotes, touchedFolders);
      if (!ok) return;
      await batchRestoreNotes(ids);
      handleClearSelection();
    } finally {
      restoreEphemeralUnlocks(preNoteIds, preFolderPaths, touchedNotes, touchedFolders);
    }
  };

  const getSortLabel = (sortBy?: string) => {
    switch (sortBy) {
      case 'created_desc':
        return 'Newest';
      case 'created_asc':
        return 'Oldest';
      case 'title_asc':
        return 'A → Z';
      case 'title_desc':
        return 'Z → A';
      case 'updated_asc':
        return 'Least Recent';
      default:
        return 'Sort';
    }
  };

  const handleBatchShare = async () => {
    const ids = Array.from(selectedNoteIds);
    if (ids.length === 0) return;
    const selectedNotes = notes.filter((n) => selectedNoteIds.has(n.id));
    const preNoteIds = new Set(unlockedNoteIds);
    const preFolderPaths = new Set(unlockedFolderPaths);
    const touchedNotes = new Set<string>();
    const touchedFolders = new Set<string>();

    try {
      const ok = await collectAndVerifyNotes(selectedNotes, touchedNotes, touchedFolders);
      if (!ok) return;

      const combined = selectedNotes
        .map((n) => `# ${n.title}\n\n${n.contentMarkdown || ''}`)
        .join('\n\n---\n\n');

      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) {
          try {
            await navigator.share({
              title: `${selectedNotes.length} Notes from ScribeX`,
              text: combined,
            });
            return;
          } catch (_) { }
        }
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(combined);
        }
      } else {
        await Share.share({
          title: `${selectedNotes.length} Notes from ScribeX`,
          message: combined,
        });
      }
    } finally {
      restoreEphemeralUnlocks(preNoteIds, preFolderPaths, touchedNotes, touchedFolders);
    }
  };

  const handleExecuteBatchMove = async (targetFolder: string) => {
    const ids = Array.from(selectedNoteIds);
    if (ids.length === 0) return;
    const selectedNotes = notes.filter((n) => selectedNoteIds.has(n.id));
    const cleanTarget = normalizeFolderPath(targetFolder);

    const hasLockedNote = selectedNotes.some((n) => lockedNoteIds.has(n.id));
    const hasLockedTarget = Boolean(
      cleanTarget && isFolderEffectivelyLocked(cleanTarget, folders, unlockedFolderPaths)
    );
    if (hasLockedNote || hasLockedTarget) {
      setIsMoveFolderModalOpen(false);
    }

    const preNoteIds = new Set(unlockedNoteIds);
    const preFolderPaths = new Set(unlockedFolderPaths);
    const touchedNotes = new Set<string>();
    const touchedFolders = new Set<string>();

    try {
      // Prevent moving locked/folder-locked notes out to bypass locks
      const notesOk = await collectAndVerifyNotes(selectedNotes, touchedNotes, touchedFolders);
      if (!notesOk) return;

      // Also verify target folder if moving into a locked folder
      if (cleanTarget && isFolderEffectivelyLocked(cleanTarget, folders, unlockedFolderPaths)) {
        for (const anc of getAncestorFolderPaths(cleanTarget)) {
          touchedFolders.add(anc);
        }
        const ok = await promptUnlockFolder(cleanTarget, folders);
        if (!ok) return;
      }

      const folderObj = folders.find((f) => (f.path || f.name) === targetFolder);
      await batchMoveNotesToFolder(ids, targetFolder, folderObj?.id);
      setIsMoveFolderModalOpen(false);
      handleClearSelection();
    } finally {
      restoreEphemeralUnlocks(preNoteIds, preFolderPaths, touchedNotes, touchedFolders);
    }
  };

  const handleCreateAndMove = async () => {
    const clean = quickNewFolderName.trim().replace(/^\/+|\/+$/g, '');
    if (!clean) return;
    const ids = Array.from(selectedNoteIds);
    if (ids.length === 0) return;
    const selectedNotes = notes.filter((n) => selectedNoteIds.has(n.id));
    const cleanTarget = normalizeFolderPath(clean);

    setIsMoveFolderModalOpen(false);

    const preNoteIds = new Set(unlockedNoteIds);
    const preFolderPaths = new Set(unlockedFolderPaths);
    const touchedNotes = new Set<string>();
    const touchedFolders = new Set<string>();

    try {
      const notesOk = await collectAndVerifyNotes(selectedNotes, touchedNotes, touchedFolders);
      if (!notesOk) return;

      if (cleanTarget && isFolderEffectivelyLocked(cleanTarget, folders, unlockedFolderPaths)) {
        for (const anc of getAncestorFolderPaths(cleanTarget)) {
          touchedFolders.add(anc);
        }
        const ok = await promptUnlockFolder(cleanTarget, folders);
        if (!ok) return;
      }

      const created = await createFolder(clean);
      const targetPath = created?.path || clean;
      setQuickNewFolderName('');
      await batchMoveNotesToFolder(ids, targetPath, created?.id);
      handleClearSelection();
    } finally {
      restoreEphemeralUnlocks(preNoteIds, preFolderPaths, touchedNotes, touchedFolders);
    }
  };

  return (
    <View className="flex-1 relative">
      {/* Sticky Top Bar: Multi-Selection Action Bar (Fixed at top of screen regardless of scroll position) */}
      <NotesBatchActionBar
        isSelectionMode={isSelectionMode}
        selectedNoteIds={selectedNoteIds}
        isDark={isDark}
        isAllVisibleSelected={isAllVisibleSelected}
        statusScope={queryRequest.statusScope}
        hasLockedSelected={notes.some((n) => selectedNoteIds.has(n.id) && Boolean(n.isLocked))}
        onClearSelection={handleClearSelection}
        onToggleSelectAll={handleToggleSelectAll}
        onOpenMoveFolderModal={() => setIsMoveFolderModalOpen(true)}
        onBatchTogglePin={handleBatchTogglePin}
        onBatchLock={handleBatchLock}
        onBatchUnlock={handleBatchUnlock}
        onBatchArchive={handleBatchArchive}
        onBatchShare={handleBatchShare}
        onBatchRestore={handleBatchRestore}
        onBatchDelete={handleBatchDelete}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        onScroll={handleScrollFeed}
        scrollEventThrottle={16}
      >
        {/* Editorial Page Heading + Add Note Button (Shown when not in selection mode) */}
        {!isSelectionMode && (
          <View style={{ zIndex: 50 }} className="flex-row items-baseline justify-between mb-6">
            <View>
              <Text className="text-4xl md:text-5xl font-extrabold text-light-textPrimary dark:text-dark-textPrimary tracking-tight">
                Notes
              </Text>
              <Text className="text-xs md:text-sm font-medium text-light-textSecondary dark:text-dark-textSecondary mt-1">
                {formattedDate} • {partitionCounts.allActive} thoughts & captures
              </Text>
            </View>

            {/* Add Menu: New Note / New Folder */}
            <View style={{ position: 'relative', zIndex: 50 }}>
              <Pressable
                onPress={() => setIsAddMenuOpen((o) => !o)}
                accessibilityLabel="Create New Note in Block Editor"
                accessibilityHint="Opens menu with New Note and New Folder"
                className="w-11 h-11 rounded-full bg-light-iconBg dark:bg-white items-center justify-center active:scale-95 shadow-md"
              >
                <Plus size={20} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2.5} />
              </Pressable>

              {isAddMenuOpen && (
                <View
                  style={{
                    position: 'absolute',
                    top: 52,
                    right: 0,
                    zIndex: 100,
                    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  }}
                  className="rounded-2xl border p-1.5 min-w-[170px] shadow-2xl"
                >
                  <Pressable
                    onPress={() => {
                      setIsAddMenuOpen(false);
                      handleCreateNewBlankNote();
                    }}
                    accessibilityLabel="New Note"
                    className="flex-row items-center gap-3 px-3.5 py-3 rounded-xl active:bg-black/10 dark:active:bg-white/10"
                  >
                    <FilePlus size={16} color={isDark ? '#F7F7F7' : '#171717'} />
                    <Text className="text-sm font-semibold text-light-textPrimary dark:text-dark-textPrimary">New Note</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setIsAddMenuOpen(false);
                      handleOpenFolderModal();
                    }}
                    accessibilityLabel="New Folder"
                    className="flex-row items-center gap-3 px-3.5 py-3 rounded-xl active:bg-black/10 dark:active:bg-white/10"
                  >
                    <Folder size={16} color={isDark ? '#F7F7F7' : '#171717'} />
                    <Text className="text-sm font-semibold text-light-textPrimary dark:text-dark-textPrimary">New Folder</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Universal Local Search Bar + Filter & Sort Controls */}
        <NotesSearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSearchActive={isSearchActive}
          isVoiceSearching={isVoiceSearching}
          onToggleVoiceSearch={handleToggleVoiceSearch}
          recordSearchHistory={recordSearchHistory}
          isDark={isDark}
          activeFiltersCount={activeFiltersCount}
          onOpenFilterModal={() => setIsFilterModalOpen(true)}
          onOpenSortModal={() => setIsSortModalOpen(true)}
          sortBy={queryRequest.sortBy}
          getSortLabel={getSortLabel}
          hasBlockTypes={queryRequest.hasBlockTypes}
          tags={queryRequest.tags}
          toggleBlockTypeFilter={toggleBlockTypeFilter}
          toggleTagFilter={toggleTagFilter}
          resetQueryRequest={resetQueryRequest}
          recentSearches={recentSearches}
          deleteSearchHistoryItem={deleteSearchHistoryItem}
          clearSearchHistory={clearSearchHistory}
        />

        {/* Dynamic Context, Status & Filter Pills Track */}
        <NotesFilterTrack
          queryRequest={queryRequest}
          partitionCounts={partitionCounts}
          isDark={isDark}
          folders={folders}
          pinnedFolders={pinnedFolders}
          activeFolderObj={activeFolderObj}
          activeFolderColor={activeFolderColor}
          renderFolderIcon={renderFolderIcon}
          tags={tags}
          setStatusScopeFilter={handleSetStatusScopeWithSecurity}
          setFolderFilter={handleSelectFolderWithSecurity}
          toggleTagFilter={toggleTagFilter}
          onOpenFolderDropdown={() => setIsFolderDropdownOpen(true)}
          onOpenFolderExplorer={() => setIsFolderExplorerOpen(true)}
          onOpenFolderActions={handleOpenFolderActions}
        />

        {/* Folder & Status Context Banners */}
        <FolderContextBanners
          queryRequest={queryRequest}
          partitionCounts={partitionCounts}
          feedCardsCount={feedCards.length}
          pinnedCardsCount={pinnedCards.length}
          emptyTrash={handleEmptyTrashSafe}
          isDark={isDark}
          folders={folders}
          activeFolderObj={activeFolderObj}
          onOpenFolderActions={handleOpenFolderActions}
          onRelockFolder={(folderPath) => {
            const ancestors = getAncestorFolderPaths(folderPath);
            for (const anc of ancestors) {
              relockFolderSession(anc);
            }
            relockFolderSession(folderPath);
            setFolderFilter(null);
          }}
          setFolderFilter={handleSelectFolderWithSecurity}
          unarchiveFolder={handleUnarchiveFolderSafe}
          favoriteFolders={favoriteFolders}
          renderFolderIcon={renderFolderIcon}
        />

        {/* Pinned Notes Top Shelf (When viewing All Notes without an active search query) */}
        {!isSearchActive && pinnedCards.length > 0 && (
          <View className="mb-8">
            <View className="flex-row items-center gap-2 mb-3">
              <Pin size={13} color="#FFC96F" fill="#FFC96F" />
              <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted">
                Pinned Notes ({pinnedCards.length})
              </Text>
            </View>

            <View className="flex-row flex-wrap -mx-2.5">
              {pinnedCards.map((vm) => (
                <NoteCard
                  key={vm.note.id}
                  viewModel={vm}
                  isPinnedShelfCard
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedNoteIds.has(vm.note.id)}
                  isEffectivelyLocked={lockedNoteIds.has(vm.note.id)}
                  onOpenNote={handleOpenNote}
                  onTogglePin={handleTogglePinSafe}
                  onToggleFavorite={handleToggleFavoriteSafe}
                  onToggleLock={handleToggleCardLock}
                  onRestoreNote={handleRestoreNoteSafe}
                  onPermanentlyDeleteNote={handlePermanentlyDeleteNoteSafe}
                  onUnarchiveNote={handleUnarchiveNoteSafe}
                  onToggleSelect={handleToggleSelectNote}
                  onLongPressNote={handleLongPressNote}
                />
              ))}
            </View>

            <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-3 mt-6">
              All Notes ({mainFeedTotal})
            </Text>
          </View>
        )}

        {/* Search Results Header Banner */}
        {isSearchActive && (
          <View className="flex-row items-center justify-between mb-3 px-1">
            <Text className="text-xs font-bold uppercase tracking-wider text-cyan-500">
              Search Results ({totalMatches} {totalMatches === 1 ? 'match' : 'matches'} for "{searchQuery.trim()}")
            </Text>
            {(queryRequest.statusScope !== 'active' || queryRequest.folderPath || (queryRequest.tags && queryRequest.tags.length > 0)) && totalMatches === 0 && (
              <Pressable
                onPress={() => setStatusScopeFilter('active')}
                className="px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 active:scale-95"
              >
                <Text className="text-[11px] font-bold text-cyan-400">
                  Search in All Notes
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Main Notes Grid (Unified Paginated Feed — 10 notes per page) */}
        <View className="flex-row flex-wrap -mx-2.5">
          {feedCards.map((vm) => (
            <NoteCard
              key={vm.note.id}
              viewModel={vm}
              isSelectionMode={isSelectionMode}
              isSelected={selectedNoteIds.has(vm.note.id)}
              isEffectivelyLocked={lockedNoteIds.has(vm.note.id)}
              onOpenNote={handleOpenNote}
              onTogglePin={handleTogglePinSafe}
              onToggleFavorite={handleToggleFavoriteSafe}
              onToggleLock={handleToggleCardLock}
              onRestoreNote={handleRestoreNoteSafe}
              onPermanentlyDeleteNote={handlePermanentlyDeleteNoteSafe}
              onUnarchiveNote={handleUnarchiveNoteSafe}
              onToggleSelect={handleToggleSelectNote}
              onLongPressNote={handleLongPressNote}
            />
          ))}
        </View>

        {/* Dynamic 10-Note Pagination Footer */}
        {mainFeedTotal > 0 && (
          <View className="items-center justify-center mt-6 mb-2">
            <Text className="text-xs font-medium text-light-textMuted dark:text-dark-textMuted mb-2">
              Showing {visibleCount} of {mainFeedTotal} {mainFeedTotal === 1 ? 'note' : 'notes'}
              {hasMore ? ' • Scroll down for more' : ''}
            </Text>
            {hasMore && (
              <Pressable
                onPress={loadNextPage}
                accessibilityLabel="Load More Notes"
                className="px-4 py-2 rounded-full bg-light-surface dark:bg-dark-raised border border-light-border dark:border-white/10 active:scale-95"
              >
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Load More Notes
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Empty State */}
        {totalMatches === 0 && (
          <View className="items-center justify-center py-20 px-4">
            <View className="w-16 h-16 rounded-full bg-light-surface dark:bg-dark-raised border border-light-border dark:border-white/10 items-center justify-center mb-4">
              {isSearchActive ? (
                <Search size={24} color={isDark ? '#71717A' : '#A1A1AA'} />
              ) : queryRequest.statusScope === 'trashed' ? (
                <Trash2 size={24} color={isDark ? '#71717A' : '#A1A1AA'} />
              ) : queryRequest.statusScope === 'archived' ? (
                <Archive size={24} color={isDark ? '#71717A' : '#A1A1AA'} />
              ) : queryRequest.statusScope === 'favorites' ? (
                <Star size={24} color={isDark ? '#71717A' : '#A1A1AA'} />
              ) : (
                <Folder size={24} color={isDark ? '#71717A' : '#A1A1AA'} />
              )}
            </View>
            <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary mb-1">
              {isSearchActive
                ? `No matches for "${searchQuery.trim()}"`
                : queryRequest.statusScope === 'trashed'
                  ? 'Trash is empty'
                  : queryRequest.statusScope === 'archived'
                    ? 'No archived notes'
                    : queryRequest.statusScope === 'favorites'
                      ? 'No favorite notes yet'
                      : 'No notes found'}
            </Text>
            <Text className="text-xs text-light-textMuted dark:text-dark-textMuted text-center max-w-xs">
              {isSearchActive
                ? 'Try searching for a different keyword, tag, folder, media caption, or voice transcript.'
                : queryRequest.statusScope === 'trashed'
                  ? 'Deleted notes will appear here before being permanently removed.'
                  : queryRequest.statusScope === 'archived'
                    ? 'Archive completed or quiet notes to keep your workspace decluttered.'
                    : queryRequest.statusScope === 'favorites'
                      ? 'Tap the star icon on any note to pin it to your favorites.'
                      : 'Tap the + button in the top right to create a new note.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Create New Folder Modal (Recursive Directory Explorer) */}
      <CreateFolderModal
        isOpen={isFolderModalOpen}
        onClose={() => {
          setIsFolderModalOpen(false);
          flushActionSheetEphemeralRelock();
        }}
        isDark={isDark}
        selectedParentPath={selectedParentPath}
        setSelectedParentPath={setSelectedParentPath}
        parentBreadcrumbSegments={parentBreadcrumbSegments}
        currentLevelSubfolders={currentLevelSubfolders}
        allFolderNames={allFolderNames}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        onCreateFolder={handleCreateFolder}
        onCreateAndClose={handleCreateAndCloseFolderModal}
      />

      {/* Batch Move to Folder Modal */}
      <BatchMoveFolderModal
        isOpen={isMoveFolderModalOpen}
        onClose={() => setIsMoveFolderModalOpen(false)}
        isDark={isDark}
        selectedCount={selectedNoteIds.size}
        allFolderNames={allFolderNames}
        quickNewFolderName={quickNewFolderName}
        setQuickNewFolderName={setQuickNewFolderName}
        onExecuteBatchMove={handleExecuteBatchMove}
        onCreateAndMove={handleCreateAndMove}
      />

      {/* Folder Action Sheet (Rename, Move, Duplicate, Subfolder, Delete, Colors, Icons, Select All, Export, Favorites, Pin, Archive) */}
      {actionSheetFolder && (
        <FolderActionSheet
          visible={isActionSheetOpen}
          folderId={actionSheetFolder.id}
          folderPath={actionSheetFolder.path}
          currentColorToken={actionSheetFolder.colorToken}
          currentIcon={actionSheetFolder.icon}
          isFavorite={actionSheetFolder.isFavorite}
          isPinned={actionSheetFolder.isPinned}
          isArchived={actionSheetFolder.isArchived}
          isLocked={actionSheetFolder.isLocked}
          lockType={actionSheetFolder.lockType}
          stats={activeFolderStats}
          onClose={() => {
            setIsActionSheetOpen(false);
            cancelActionSheetRelockTimer();
            if (actionSheetEphemeralFoldersRef.current.length > 0) {
              actionSheetRelockTimerRef.current = setTimeout(() => {
                actionSheetRelockTimerRef.current = null;
                flushActionSheetEphemeralRelock();
              }, 220);
            }
          }}
          onLockFolder={async () => {
            if (!actionSheetFolder.id) return;
            cancelActionSheetRelockTimer();
            try {
              const payload = await promptConfigureLock({
                targetLabel: `Folder: ${actionSheetFolder.path}`,
                entityType: 'folder',
              });
              if (!payload) return;
              await lockFolder(actionSheetFolder.id, actionSheetFolder.path, payload);
              setActionSheetFolder((prev) =>
                prev ? { ...prev, isLocked: true, lockType: payload.lockType } : null
              );
              if (isSameOrDescendantPath(queryRequest.folderPath, actionSheetFolder.path)) {
                setFolderFilter(null);
              }
            } finally {
              flushActionSheetEphemeralRelock();
            }
          }}
          onChangeFolderLock={async () => {
            if (!actionSheetFolder.id) return;
            const target = folders.find((f) => f.id === actionSheetFolder.id);
            if (!target) return;
            cancelActionSheetRelockTimer();
            try {
              const lt = target.lock_type === 'custom' ? 'custom' : 'master';
              const ok = await promptVerifyTargetCredential({
                title: `Verify "${target.name}"`,
                subtitle:
                  lt === 'custom'
                    ? 'Custom PIN/Password required before changing lock.'
                    : 'Verify Master credential before changing lock.',
                lockType: lt,
                credentialKind: target.lock_credential_kind,
                customHash: target.lock_hash,
                customSalt: target.lock_salt,
                hint: target.lock_hint,
                rateLimitKey: `folder:${target.id}`,
                confirmLabel: 'Verify',
              });
              if (!ok) return;
              const payload = await promptConfigureLock({
                targetLabel: `Change Lock — Folder: ${target.path}`,
                entityType: 'folder',
                initialLockType: lt,
                initialHint: target.lock_hint,
              });
              if (!payload) return;
              await lockFolder(target.id, target.path, payload);
              setActionSheetFolder((prev) =>
                prev ? { ...prev, isLocked: true, lockType: payload.lockType } : null
              );
            } finally {
              flushActionSheetEphemeralRelock();
            }
          }}
          onUnlockFolderForever={async () => {
            if (!actionSheetFolder.id) return;
            const target = folders.find((f) => f.id === actionSheetFolder.id);
            if (!target) return;
            cancelActionSheetRelockTimer();
            try {
              const lt = target.lock_type === 'custom' ? 'custom' : 'master';
              const ok = await promptVerifyTargetCredential({
                title: `Remove Lock: "${target.name}"`,
                subtitle:
                  lt === 'custom'
                    ? 'Custom PIN/Password required to permanently unlock this folder.'
                    : 'Enter your Master credential to permanently unlock this folder.',
                lockType: lt,
                credentialKind: target.lock_credential_kind,
                customHash: target.lock_hash,
                customSalt: target.lock_salt,
                hint: target.lock_hint,
                rateLimitKey: `folder:${target.id}`,
                confirmLabel: 'Unlock Forever',
              });
              if (!ok) return;
              await unlockFolderForever(target.id);
              setActionSheetFolder((prev) =>
                prev ? { ...prev, isLocked: false, lockType: null } : null
              );
            } finally {
              flushActionSheetEphemeralRelock();
            }
          }}
          onRelockFolderSession={() => {
            consumeActionSheetEphemeralSet();
            relockFolderSession(actionSheetFolder.path);
            if (isSameOrDescendantPath(queryRequest.folderPath, actionSheetFolder.path)) {
              setFolderFilter(null);
            }
          }}
          onOpenCreateSubfolder={(parent) => handleOpenCreateSubfolderFromSheet(parent)}
          onOpenRename={() => {
            cancelActionSheetRelockTimer();
            setIsRenameModalOpen(true);
          }}
          onOpenMove={() => {
            cancelActionSheetRelockTimer();
            setIsMoveFolderReparentModalOpen(true);
          }}
          onDuplicate={(p, id) => handleConfirmDuplicateFolder(p, id)}
          onOpenDelete={() => {
            cancelActionSheetRelockTimer();
            setIsDeleteFolderModalOpen(true);
          }}
          onToggleFavorite={async () => {
            if (actionSheetFolder.id) {
              const nextFav = await toggleFolderFavorite(actionSheetFolder.id);
              setActionSheetFolder((prev) => (prev ? { ...prev, isFavorite: nextFav } : null));
            }
          }}
          onTogglePin={async () => {
            if (actionSheetFolder.id) {
              const nextPin = await toggleFolderPin(actionSheetFolder.id);
              setActionSheetFolder((prev) => (prev ? { ...prev, isPinned: nextPin } : null));
            }
          }}
          onToggleArchive={async () => {
            if (actionSheetFolder.id) {
              const sheetEphemeral = consumeActionSheetEphemeralSet();
              const preNoteIds = new Set(unlockedNoteIds);
              const preFolderPaths = new Set(
                Array.from(unlockedFolderPaths).filter((p) => !sheetEphemeral.has(p))
              );
              const touchedNotes = new Set<string>();
              const touchedFolders = new Set<string>(sheetEphemeral);

              try {
                const verified = await verifyFolderSubtreeUnlocked(
                  normalizeFolderPath(actionSheetFolder.path),
                  {
                    beforePrompt: () => setIsActionSheetOpen(false),
                    touchedNoteIds: touchedNotes,
                    touchedFolderPaths: touchedFolders,
                  }
                );
                if (!verified) return;
                if (actionSheetFolder.isArchived) {
                  await unarchiveFolder(actionSheetFolder.id);
                  setActionSheetFolder((prev) => (prev ? { ...prev, isArchived: false } : null));
                } else {
                  await archiveFolder(actionSheetFolder.id);
                  setActionSheetFolder((prev) => (prev ? { ...prev, isArchived: true } : null));
                }
              } finally {
                restoreEphemeralUnlocks(preNoteIds, preFolderPaths, touchedNotes, touchedFolders);
              }
            }
          }}
          onSelectAllNotes={(p) => handleSelectAllFolderNotes(p)}
          onExportFolder={(p) => handleExportFolderNotes(p)}
          onChangeColor={(col) => handleChangeFolderColor(col)}
          onChangeIcon={(icon) => handleChangeFolderIcon(icon)}
        />
      )}

      {/* Delete Folder Modal with Note Count & Safe General Re-route */}
      {actionSheetFolder && (
        <DeleteFolderModal
          visible={isDeleteFolderModalOpen}
          folderId={actionSheetFolder.id}
          folderPath={actionSheetFolder.path}
          stats={activeFolderStats}
          onClose={() => {
            setIsDeleteFolderModalOpen(false);
            flushActionSheetEphemeralRelock();
          }}
          onConfirmDelete={(noteAction) => handleConfirmDeleteFolder(noteAction)}
        />
      )}

      {/* Rename Folder Modal with Path Preview */}
      {actionSheetFolder && (
        <RenameFolderModal
          visible={isRenameModalOpen}
          folderId={actionSheetFolder.id}
          currentPath={actionSheetFolder.path}
          onClose={() => {
            setIsRenameModalOpen(false);
            flushActionSheetEphemeralRelock();
          }}
          onConfirmRename={(newName) => handleConfirmRenameFolder(newName)}
        />
      )}

      {/* Move / Reparent Folder Modal with Cycle Prevention */}
      {actionSheetFolder && (
        <MoveFolderModal
          visible={isMoveFolderReparentModalOpen}
          folderId={actionSheetFolder.id}
          folderPath={actionSheetFolder.path}
          allFolderPaths={allFolderNames}
          onClose={() => {
            setIsMoveFolderReparentModalOpen(false);
            flushActionSheetEphemeralRelock();
          }}
          onConfirmMove={(newParent) => handleConfirmMoveFolder(newParent)}
        />
      )}

      {/* Folder Explorer Tree Hierarchy Modal */}
      <FolderExplorerModal
        visible={isFolderExplorerOpen}
        folders={folders}
        notes={notes}
        activeFolderPath={queryRequest.folderPath}
        onClose={() => setIsFolderExplorerOpen(false)}
        onSelectFolder={(folderPath) => {
          setIsFolderExplorerOpen(false);
          setTimeout(() => handleSelectFolderWithSecurity(folderPath), 60);
        }}
        onOpenFolderActions={(folderPath) => {
          setIsFolderExplorerOpen(false);
          setTimeout(() => handleOpenFolderActions(folderPath), 60);
        }}
        onOpenCreateSubfolder={(parentPath) => {
          setIsFolderExplorerOpen(false);
          setTimeout(() => handleOpenCreateSubfolderFromSheet(parentPath), 60);
        }}
      />

      {/* Folder Dropdown Selector Modal */}
      <FolderDropdownModal
        visible={isFolderDropdownOpen}
        folders={folders}
        allFolderNames={allFolderNames}
        selectedFolderPath={queryRequest.folderPath}
        notes={notes}
        onClose={() => setIsFolderDropdownOpen(false)}
        onSelectFolder={(folderPath) => handleSelectFolderWithSecurity(folderPath)}
        onOpenFolderActions={(folderPath) => handleOpenFolderActions(folderPath)}
        onOpenCreateFolder={handleOpenFolderModal}
        onOpenFolderTree={() => setIsFolderExplorerOpen(true)}
      />

      {/* Sort Order Selection Sheet / Modal */}
      <SortOrderModal
        visible={isSortModalOpen}
        currentSort={queryRequest.sortBy || 'updated_desc'}
        onClose={() => setIsSortModalOpen(false)}
        onSelectSort={(sort) => setSortByFilter(sort)}
      />

      {/* Advanced Filter Selection Sheet / Modal */}
      <NotesFilterModal
        visible={isFilterModalOpen}
        queryRequest={queryRequest}
        folders={folders}
        tags={tags}
        onClose={() => setIsFilterModalOpen(false)}
        onToggleBlockType={toggleBlockTypeFilter}
        onToggleTag={toggleTagFilter}
        onSelectFolder={(fp) => handleSelectFolderWithSecurity(fp)}
        onSelectStatusScope={(sc) => handleSetStatusScopeWithSecurity(sc)}
        onResetFilters={resetQueryRequest}
      />
    </View>
  );
};
