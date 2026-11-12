import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal, Platform, Share, Alert, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme';
import { useNotesStore } from '../state/useNotesStore';
import { NoteItem } from '../types/note';
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
import { FolderDropdownModal } from './folders/FolderDropdownModal';
import { SortOrderModal } from './notes/SortOrderModal';
import { NotesFilterModal } from './notes/NotesFilterModal';
import { NoteColors, NoteColorToken } from '../theme/tokens';
import { FolderNoteStats } from '../db/types';

export const NotesView: React.FC = () => {
  const router = useRouter();
  const { isDark } = useTheme();
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

  useEffect(() => {
    return () => {
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

  const handleOpenNote = (note: NoteItem) => {
    if (searchQuery.trim()) {
      recordSearchHistory(searchQuery.trim());
    }
    router.push(`/note/${note.id}`);
  };

  const handleCreateNewBlankNote = () => {
    router.push('/note/new');
  };

  const handleCreateFolder = async () => {
    const clean = newFolderName.trim().replace(/^\/+|\/+$/g, '');
    if (!clean) return;
    const created = await createFolder(clean, selectedParentPath || undefined);
    const targetPath = created?.path || (selectedParentPath ? `${selectedParentPath}/${clean}` : clean);
    setNewFolderName('');
    setSelectedParentPath(targetPath);
    setFolderFilter(targetPath);
  };

  const handleCreateAndCloseFolderModal = async () => {
    const clean = newFolderName.trim().replace(/^\/+|\/+$/g, '');
    if (!clean) return;
    const created = await createFolder(clean, selectedParentPath || undefined);
    const targetPath = created?.path || (selectedParentPath ? `${selectedParentPath}/${clean}` : clean);
    setNewFolderName('');
    setIsFolderModalOpen(false);
    setFolderFilter(targetPath);
  };

  const handleOpenFolderActions = async (folderPath: string) => {
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
    setActionSheetFolder({
      path: folderPath,
      id: folderId,
      colorToken,
      icon,
      isFavorite,
      isPinned,
      isArchived,
    });
    try {
      const stats = await getFolderStats(folderPath, folderId);
      setActiveFolderStats(stats);
    } catch (_) {
      setActiveFolderStats(null);
    }
    setIsActionSheetOpen(true);
  };

  const handleOpenCreateSubfolderFromSheet = (parentPath?: string) => {
    setSelectedParentPath(parentPath || '');
    setNewFolderName('');
    setIsFolderModalOpen(true);
  };

  const handleConfirmRenameFolder = async (newName: string) => {
    if (!actionSheetFolder?.id) return;
    await renameFolder(actionSheetFolder.id, newName);
  };

  const handleConfirmMoveFolder = async (newParentPath: string | null) => {
    if (!actionSheetFolder?.id) return;
    await moveFolder(actionSheetFolder.id, newParentPath);
  };

  const handleConfirmDuplicateFolder = async (folderPath: string, folderId?: string) => {
    const idToUse = folderId || actionSheetFolder?.id;
    if (!idToUse) return;
    await duplicateFolder(idToUse, folderPath);
  };

  const handleConfirmDeleteFolder = async (noteAction: 'moveToGeneral' | 'trash') => {
    if (!actionSheetFolder) return;
    const idToUse = actionSheetFolder.id || '';
    await deleteFolderWithOptions(idToUse, actionSheetFolder.path, noteAction);
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
    const folderNotes = notes.filter(
      (n) => n.status !== 'trashed' && (n.folderPath === clean || n.folderPath?.startsWith(`${clean}/`))
    );
    if (folderNotes.length === 0) return;
    const bundleText = folderNotes
      .map((n) => `# ${n.title || 'Untitled'}\n\n${n.contentMarkdown || ''}`)
      .join('\n\n---\n\n');
    try {
      await Share.share({
        title: `ScribeX - /${clean} Export`,
        message: bundleText,
      });
    } catch (_) { }
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
    if (queryRequest.statusScope === 'trashed') {
      await batchPermanentlyDeleteNotes(ids);
    } else {
      await batchDeleteNotes(ids);
    }
    handleClearSelection();
  };

  const handleBatchTogglePin = async () => {
    const ids = Array.from(selectedNoteIds);
    if (ids.length === 0) return;
    const selectedNotes = notes.filter((n) => selectedNoteIds.has(n.id));
    const allPinned = selectedNotes.length > 0 && selectedNotes.every((n) => n.isPinned);
    await batchTogglePin(ids, !allPinned);
  };

  const handleBatchArchive = async () => {
    const ids = Array.from(selectedNoteIds);
    if (ids.length === 0) return;
    const isArchivedScope = queryRequest.statusScope === 'archived';
    await batchArchiveNotes(ids, !isArchivedScope);
    handleClearSelection();
  };

  const handleBatchRestore = async () => {
    const ids = Array.from(selectedNoteIds);
    if (ids.length === 0) return;
    await batchRestoreNotes(ids);
    handleClearSelection();
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
  };

  const handleExecuteBatchMove = async (targetFolder: string) => {
    const ids = Array.from(selectedNoteIds);
    if (ids.length === 0) return;
    const folderObj = folders.find((f) => (f.path || f.name) === targetFolder);
    await batchMoveNotesToFolder(ids, targetFolder, folderObj?.id);
    setIsMoveFolderModalOpen(false);
    handleClearSelection();
  };

  const handleCreateAndMove = async () => {
    const clean = quickNewFolderName.trim().replace(/^\/+|\/+$/g, '');
    if (!clean) return;
    const created = await createFolder(clean);
    const targetPath = created?.path || clean;
    setQuickNewFolderName('');
    await handleExecuteBatchMove(targetPath);
  };

  return (
    <View className="flex-1 relative">
      {/* Sticky Top Bar: Multi-Selection Action Bar (Fixed at top of screen regardless of scroll position) */}
      {isSelectionMode && (
        <View
          style={{
            zIndex: 100,
            backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
            borderColor: isDark ? 'rgba(6, 182, 212, 0.4)' : 'rgba(6, 182, 212, 0.3)',
          }}
          className="mb-3 px-3 py-2 rounded-2xl border shadow-lg flex-row items-center justify-between overflow-hidden"
        >
          {/* Left: Back / Cancel Button + Selection Count Badge */}
          <View className="flex-row items-center gap-1.5 flex-shrink-0 mr-1">
            <Pressable
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={handleClearSelection}
              accessibilityLabel="Deselect all and go back to normal mode"
              className="flex-row items-center gap-1 px-2 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
            >
              <ArrowLeft size={16} color={isDark ? '#F3F4F6' : '#111827'} strokeWidth={2.2} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Back
              </Text>
            </Pressable>

            <View className="h-4 w-[1px] bg-light-border dark:bg-dark-border" />

            <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15">
              <View className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <Text className="text-[11px] font-bold text-cyan-500 dark:text-cyan-400">
                {selectedNoteIds.size}
              </Text>
            </View>
          </View>

          {/* Right: Actions Cluster (Scrollable horizontally on narrow devices to guarantee zero container overflow) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 1 }}
            contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
          >
            {/* Select All / Deselect All Toggle */}
            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              onPress={handleToggleSelectAll}
              accessibilityLabel={isAllVisibleSelected ? 'Deselect All' : 'Select All'}
              className="p-1.5 rounded-xl flex-row items-center gap-1 hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
            >
              <CheckSquare size={16} color="#06B6D4" />
              <Text className="text-xs font-semibold text-cyan-500 dark:text-cyan-400 hidden sm:flex">
                {isAllVisibleSelected ? 'Deselect All' : 'Select All'}
              </Text>
            </Pressable>

            {/* Move to Folder */}
            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              onPress={() => setIsMoveFolderModalOpen(true)}
              accessibilityLabel="Move Selected Notes to Folder"
              className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
            >
              <FolderInput size={16} color={isDark ? '#E5E7EB' : '#1F2937'} />
            </Pressable>

            {/* Pin / Unpin */}
            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              onPress={handleBatchTogglePin}
              accessibilityLabel="Pin or Unpin Selected Notes"
              className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
            >
              <Pin size={16} color={isDark ? '#E5E7EB' : '#1F2937'} />
            </Pressable>

            {/* Archive / Unarchive */}
            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              onPress={handleBatchArchive}
              accessibilityLabel={queryRequest.statusScope === 'archived' ? 'Unarchive Selected Notes' : 'Archive Selected Notes'}
              className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
            >
              <Archive size={16} color={isDark ? '#E5E7EB' : '#1F2937'} />
            </Pressable>

            {/* Share */}
            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              onPress={handleBatchShare}
              accessibilityLabel="Share Selected Notes"
              className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
            >
              <Share2 size={16} color={isDark ? '#E5E7EB' : '#1F2937'} />
            </Pressable>

            {/* Delete / Trash */}
            {queryRequest.statusScope === 'trashed' ? (
              <View className="flex-row items-center gap-1">
                <Pressable
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  onPress={handleBatchRestore}
                  accessibilityLabel="Restore Selected Notes"
                  className="px-2 py-1.5 rounded-xl flex-row items-center gap-1 bg-black/5 dark:bg-white/10 active:scale-95"
                >
                  <RotateCcw size={14} color={isDark ? '#F3F4F6' : '#111827'} />
                  <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">Restore</Text>
                </Pressable>
                <Pressable
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  onPress={handleBatchDelete}
                  accessibilityLabel="Permanently Delete Selected Notes"
                  className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 active:scale-95"
                >
                  <Trash2 size={16} color="#EF4444" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                onPress={handleBatchDelete}
                accessibilityLabel="Move Selected Notes to Trash"
                className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 active:scale-95"
              >
                <Trash2 size={16} color="#EF4444" />
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}

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
        <View className="mb-6">
          <View className="flex-row items-center gap-2">
            <View
              style={{
                borderColor: isVoiceSearching
                  ? '#F43F5E'
                  : isSearchActive
                    ? '#06B6D4'
                    : isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.08)',
              }}
              className="flex-1 flex-row items-center px-3.5 py-2 rounded-2xl bg-light-surface dark:bg-dark-raised border shadow-sm"
            >
              <Search
                size={18}
                color={
                  isSearchActive
                    ? '#06B6D4'
                    : isDark
                      ? '#858585'
                      : '#929292'
                }
              />

              <TextInput
                placeholder={
                  isVoiceSearching
                    ? 'Listening for voice search query...'
                    : 'Search notes, tasks, audio, sketches, or files...'
                }
                placeholderTextColor={isVoiceSearching ? '#F43F5E' : isDark ? '#858585' : '#929292'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => {
                  if (searchQuery.trim()) recordSearchHistory(searchQuery.trim());
                }}
                returnKeyType="search"
                className="flex-1 text-base font-medium text-light-textPrimary dark:text-dark-textPrimary px-3 py-1"
              />

              {searchQuery.length > 0 && (
                <Pressable
                  hitSlop={10}
                  onPress={() => setSearchQuery('')}
                  accessibilityLabel="Clear Search Query"
                  className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 items-center justify-center mr-1.5 active:scale-90"
                >
                  <X size={14} color={isDark ? '#B5B5B5' : '#626262'} />
                </Pressable>
              )}

              {/* Voice-to-Text Search Mic Button */}
              <Pressable
                hitSlop={10}
                onPress={handleToggleVoiceSearch}
                accessibilityLabel="Voice to Text Search"
                className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full transition-all active:scale-95 ${isVoiceSearching
                  ? 'bg-rose-500'
                  : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15'
                  }`}
              >
                <Mic
                  size={15}
                  color={isVoiceSearching ? '#FFFFFF' : isDark ? '#E4E4E7' : '#27272A'}
                />
                {isVoiceSearching && (
                  <Text className="text-[11px] font-bold text-white">Listening</Text>
                )}
              </Pressable>
            </View>

            {/* Filter Button (Prominently visible right next to search) */}
            <Pressable
              onPress={() => setIsFilterModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Filter Notes"
              className={`flex-row items-center justify-center gap-1.5 h-[44px] px-3.5 rounded-2xl border active:scale-95 shadow-sm ${activeFiltersCount > 0
                ? 'bg-cyan-500/15 border-cyan-500/50'
                : 'bg-light-surface dark:bg-dark-raised border-light-border/60 dark:border-white/10'
                }`}
            >
              <SlidersHorizontal
                size={15}
                color={activeFiltersCount > 0 ? '#06B6D4' : isDark ? '#E4E4E7' : '#27272A'}
              />
              <Text
                className={`text-xs font-semibold ${activeFiltersCount > 0
                  ? 'text-cyan-500 font-bold'
                  : 'text-light-textPrimary dark:text-dark-textPrimary'
                  }`}
              >
                Filter
              </Text>
              {activeFiltersCount > 0 && (
                <View className="w-5 h-5 rounded-full bg-[#06B6D4] items-center justify-center">
                  <Text className="text-[10px] font-bold text-white">
                    {activeFiltersCount}
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Sort Button (Prominently visible right next to search) */}
            <Pressable
              onPress={() => setIsSortModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Sort Notes"
              className={`flex-row items-center justify-center gap-1.5 h-[44px] px-3.5 rounded-2xl border active:scale-95 shadow-sm ${queryRequest.sortBy && queryRequest.sortBy !== 'updated_desc'
                ? 'bg-cyan-500/15 border-cyan-500/50'
                : 'bg-light-surface dark:bg-dark-raised border-light-border/60 dark:border-white/10'
                }`}
            >
              <ArrowDownUp
                size={15}
                color={
                  queryRequest.sortBy && queryRequest.sortBy !== 'updated_desc'
                    ? '#06B6D4'
                    : isDark
                      ? '#E4E4E7'
                      : '#27272A'
                }
              />
              <Text
                className={`text-xs font-semibold hidden md:flex ${queryRequest.sortBy && queryRequest.sortBy !== 'updated_desc'
                  ? 'text-cyan-500 font-bold'
                  : 'text-light-textPrimary dark:text-dark-textPrimary'
                  }`}
              >
                {getSortLabel(queryRequest.sortBy)}
              </Text>
            </Pressable>
          </View>

          {/* Active Filter Chips Bar (Shown when any block type, tag, or folder filter is active) */}
          {activeFiltersCount > 0 && (
            <View className="flex-row flex-wrap items-center gap-2 mt-2.5 px-0.5">
              <Text className="text-[11px] font-semibold text-light-textMuted dark:text-dark-textMuted mr-0.5">
                Active Filters:
              </Text>
              {(queryRequest.hasBlockTypes || []).map((bt) => (
                <Pressable
                  key={bt}
                  onPress={() => toggleBlockTypeFilter(bt)}
                  className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 active:scale-95"
                >
                  <Text className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 capitalize">
                    {bt.replace('_', ' ')}
                  </Text>
                  <X size={11} color="#06B6D4" />
                </Pressable>
              ))}
              {(queryRequest.tags || []).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => toggleTagFilter(t)}
                  className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 active:scale-95"
                >
                  <Text className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
                    #{t}
                  </Text>
                  <X size={11} color="#06B6D4" />
                </Pressable>
              ))}
              <Pressable
                onPress={resetQueryRequest}
                className="px-2 py-0.5 rounded-full active:opacity-70"
              >
                <Text className="text-[11px] font-bold text-light-textMuted dark:text-dark-textMuted underline">
                  Clear All
                </Text>
              </Pressable>
            </View>
          )}

          {/* Recent Searches Strip (Shown when search input is empty and history exists) */}
          {!isSearchActive && recentSearches.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, flexShrink: 0, marginTop: 10 }}
              contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 }}
            >
              <View className="flex-row items-center gap-1 mr-1">
                <Clock size={11} color={isDark ? '#71717A' : '#A1A1AA'} />
                <Text className="text-[11px] font-medium text-light-textMuted dark:text-dark-textMuted">
                  Recent:
                </Text>
              </View>
              {recentSearches.map((q) => (
                <View
                  key={q}
                  className="flex-row items-center rounded-full bg-light-surface dark:bg-dark-raised border border-light-border dark:border-white/10"
                >
                  <Pressable
                    onPress={() => setSearchQuery(q)}
                    className="pl-2.5 pr-1.5 py-1 active:scale-95"
                  >
                    <Text className="text-[11px] font-medium text-light-textSecondary dark:text-dark-textSecondary">
                      {q}
                    </Text>
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    onPress={() => deleteSearchHistoryItem(q)}
                    accessibilityLabel={`Remove recent search ${q}`}
                    className="pr-2 py-1 active:opacity-60"
                  >
                    <X size={10} color={isDark ? '#71717A' : '#A1A1AA'} />
                  </Pressable>
                </View>
              ))}
              <Pressable
                hitSlop={8}
                onPress={clearSearchHistory}
                className="px-2 py-1 rounded-full active:opacity-70"
              >
                <Text className="text-[11px] font-semibold text-light-textMuted dark:text-dark-textMuted">
                  Clear
                </Text>
              </Pressable>
            </ScrollView>
          )}
        </View>

        {/* Dynamic Context, Status & Filter Pills Track */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0, marginBottom: 24 }}
          contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}
        >
          {/* All Notes Pill */}
          <Pressable
            onPress={() => setStatusScopeFilter('active')}
            className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${queryRequest.statusScope === 'active' && !queryRequest.folderPath && (!queryRequest.tags || queryRequest.tags.length === 0)
              ? 'bg-light-iconBg dark:bg-white border-transparent'
              : 'bg-transparent border-light-border dark:border-dark-border'
              }`}
          >
            <Text className={`text-xs font-semibold ${queryRequest.statusScope === 'active' && !queryRequest.folderPath && (!queryRequest.tags || queryRequest.tags.length === 0)
              ? 'text-white dark:text-[#111111]'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
              }`}>
              All Notes
            </Text>
            <Text className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${queryRequest.statusScope === 'active' && !queryRequest.folderPath && (!queryRequest.tags || queryRequest.tags.length === 0)
              ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#111111]'
              : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
              }`}>
              {partitionCounts.allActive}
            </Text>
          </Pressable>

          {/* Favorites Pill */}
          <Pressable
            onPress={() => setStatusScopeFilter('favorites')}
            className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${queryRequest.statusScope === 'favorites'
              ? 'bg-light-iconBg dark:bg-white border-transparent'
              : 'bg-transparent border-light-border dark:border-dark-border'
              }`}
          >
            <Star
              size={12}
              color={queryRequest.statusScope === 'favorites' ? '#FFD43B' : (isDark ? '#B5B5B5' : '#626262')}
              fill={queryRequest.statusScope === 'favorites' ? '#FFD43B' : 'transparent'}
            />
            <Text className={`text-xs font-semibold ${queryRequest.statusScope === 'favorites'
              ? 'text-white dark:text-[#111111]'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
              }`}>
              Favorites
            </Text>
            <Text className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${queryRequest.statusScope === 'favorites'
              ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#111111]'
              : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
              }`}>
              {partitionCounts.favorites}
            </Text>
          </Pressable>

          {/* Archive Pill */}
          <Pressable
            onPress={() => setStatusScopeFilter('archived')}
            className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${queryRequest.statusScope === 'archived'
              ? 'bg-cyan-500 border-transparent'
              : 'bg-transparent border-light-border dark:border-dark-border'
              }`}
          >
            <Archive size={12} color={queryRequest.statusScope === 'archived' ? '#FFFFFF' : (isDark ? '#B5B5B5' : '#626262')} />
            <Text className={`text-xs font-semibold ${queryRequest.statusScope === 'archived'
              ? 'text-white'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
              }`}>
              Archive
            </Text>
            {partitionCounts.archived > 0 && (
              <Text className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${queryRequest.statusScope === 'archived'
                ? 'bg-white/20 text-white'
                : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
                }`}>
                {partitionCounts.archived}
              </Text>
            )}
          </Pressable>

          {/* Trash Pill */}
          <Pressable
            onPress={() => setStatusScopeFilter('trashed')}
            className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${queryRequest.statusScope === 'trashed'
              ? 'bg-red-500 border-transparent'
              : 'bg-transparent border-light-border dark:border-dark-border'
              }`}
          >
            <Trash2 size={12} color={queryRequest.statusScope === 'trashed' ? '#FFFFFF' : (isDark ? '#B5B5B5' : '#626262')} />
            <Text className={`text-xs font-semibold ${queryRequest.statusScope === 'trashed'
              ? 'text-white'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
              }`}>
              Trash
            </Text>
            {partitionCounts.trashed > 0 && (
              <Text className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${queryRequest.statusScope === 'trashed'
                ? 'bg-white/20 text-white'
                : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
                }`}>
                {partitionCounts.trashed}
              </Text>
            )}
          </Pressable>

          {/* Divider */}
          <View className="h-5 w-[1px] bg-light-border dark:bg-dark-border mx-1 self-center" />

          {/* Single Folder Dropdown Selector */}
          {!queryRequest.folderPath ? (
            <Pressable
              onPress={() => setIsFolderDropdownOpen(true)}
              accessibilityLabel="Open folder selector dropdown"
              className="flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-full border bg-light-surface/60 dark:bg-white/5 border-light-border dark:border-white/10 hover:border-cyan-500/50 active:scale-95"
            >
              <Folder size={12} color="#06B6D4" />
              <Text className="text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary">
                Folders
              </Text>
              <ChevronDown size={11} color={isDark ? '#A1A1AA' : '#71717A'} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setIsFolderDropdownOpen(true)}
              onLongPress={() => handleOpenFolderActions(queryRequest.folderPath!)}
              delayLongPress={350}
              accessibilityLabel={`Folder ${queryRequest.folderPath}. Tap to change, long press for options.`}
              className="flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-full border bg-light-iconBg dark:bg-white border-transparent active:scale-95"
            >
              <View className="flex-row items-center gap-1">
                {activeFolderColor && (
                  <View
                    style={{ backgroundColor: activeFolderColor }}
                    className="w-2 h-2 rounded-full mr-0.5"
                  />
                )}
                {renderFolderIcon(
                  activeFolderObj?.icon,
                  11,
                  isDark ? '#111111' : '#FFFFFF'
                )}
              </View>

              <Text className="text-xs font-semibold text-white dark:text-[#111111]">
                {queryRequest.folderPath}
              </Text>

              {/* Status Badges on Active Folder Pill */}
              {Boolean(activeFolderObj?.is_favorite) && (
                <Star
                  size={10}
                  color={isDark ? '#111111' : '#FFD43B'}
                  fill={isDark ? '#111111' : '#FFD43B'}
                />
              )}
              {Boolean(activeFolderObj?.is_pinned) && (
                <Pin
                  size={10}
                  color={isDark ? '#111111' : '#FFC96F'}
                  fill={isDark ? '#111111' : '#FFC96F'}
                />
              )}
              {Boolean(activeFolderObj?.is_archived) && (
                <Archive size={10} color={isDark ? '#111111' : '#06B6D4'} />
              )}

              <ChevronDown size={11} color={isDark ? '#111111' : '#FFFFFF'} />

              {/* Manage folder actions button */}
              <Pressable
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                onPress={(e) => {
                  e.stopPropagation?.();
                  handleOpenFolderActions(queryRequest.folderPath!);
                }}
                accessibilityLabel={`Manage folder ${queryRequest.folderPath}`}
                className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:opacity-60"
              >
                <MoreVertical size={11} color={isDark ? '#111111' : '#FFFFFF'} />
              </Pressable>

              {/* Quick clear button */}
              <Pressable
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                onPress={(e) => {
                  e.stopPropagation?.();
                  setFolderFilter(null);
                }}
                accessibilityLabel="Clear folder filter"
                className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:opacity-60"
              >
                <X size={11} color={isDark ? '#111111' : '#FFFFFF'} />
              </Pressable>
            </Pressable>
          )}

          {/* Folder Explorer Tree Button */}
          <Pressable
            onPress={() => setIsFolderExplorerOpen(true)}
            accessibilityLabel="Open Folder Explorer Tree"
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-light-surface/60 dark:bg-white/5 border border-light-border dark:border-white/10 hover:border-cyan-500/50 active:scale-95"
          >
            <FolderTree size={12} color="#06B6D4" />
            <Text className="text-xs text-light-textPrimary dark:text-dark-textPrimary font-semibold">Tree</Text>
          </Pressable>

          {/* Dynamic Tag Pills */}
          {tags.length > 0 && <View className="h-5 w-[1px] bg-light-border dark:bg-dark-border mx-1 self-center" />}

          {tags.map((tag) => {
            const isSelected = (queryRequest.tags || []).some(
              (t) => t.toLowerCase() === tag.toLowerCase()
            );
            return (
              <Pressable
                key={tag}
                onPress={() => toggleTagFilter(tag)}
                className={`flex-row items-center gap-1 px-3 py-1.5 rounded-full border transition-all ${isSelected
                  ? 'bg-cyan-500/20 border-cyan-500/50'
                  : 'bg-transparent border-light-border dark:border-dark-border'
                  }`}
              >
                <Tag size={10} color="#06B6D4" />
                <Text className={`text-xs font-semibold ${isSelected ? 'text-cyan-400' : 'text-light-textSecondary dark:text-dark-textSecondary'
                  }`}>
                  #{tag}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Trash View Action Banner */}
        {queryRequest.statusScope === 'trashed' && (
          <View className="flex-row items-center justify-between mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
            <View className="flex-row items-center gap-2.5">
              <Trash2 size={18} color="#EF4444" />
              <View>
                <Text className="text-sm font-bold text-red-500">Trash Bin</Text>
                <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                  {partitionCounts.trashed} notes in trash. Permanently delete or restore them anytime.
                </Text>
              </View>
            </View>
            {partitionCounts.trashed > 0 && (
              <Pressable
                onPress={emptyTrash}
                accessibilityLabel="Empty All Trash"
                className="px-3.5 py-1.5 rounded-full bg-red-500 active:scale-95"
              >
                <Text className="text-xs font-bold text-white">Empty Trash</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Archive View Action Banner */}
        {queryRequest.statusScope === 'archived' && (
          <View className="flex-row items-center gap-3 mb-6 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
            <Archive size={18} color="#06B6D4" />
            <View>
              <Text className="text-sm font-bold text-cyan-400">Archived Notes</Text>
              <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                {partitionCounts.archived} notes preserved. Tap unarchive on any note to restore it to your main notebook.
              </Text>
            </View>
          </View>
        )}

        {/* Active Folder Filter Banner with Direct Manage Action */}
        {queryRequest.folderPath && queryRequest.statusScope === 'active' && (
          <View className="flex-row items-center justify-between mb-6 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
            <View className="flex-row items-center gap-3 flex-1 mr-2">
              <View className="w-9 h-9 rounded-xl bg-cyan-500/20 items-center justify-center">
                <Folder size={18} color="#06B6D4" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-bold text-light-textPrimary dark:text-dark-textPrimary" numberOfLines={1}>
                    /{queryRequest.folderPath}
                  </Text>
                  <Text className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">
                    {feedCards.length + pinnedCards.length} notes
                  </Text>
                </View>
                <Text className="text-xs text-light-textMuted dark:text-dark-textMuted" numberOfLines={1}>
                  Filtering thoughts & captures in this directory
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-1.5">
              <Pressable
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => handleOpenFolderActions(queryRequest.folderPath!)}
                accessibilityLabel="Manage Folder Actions"
                className="px-3 py-1.5 rounded-full bg-light-surface dark:bg-white/10 border border-light-border dark:border-white/10 flex-row items-center gap-1 active:scale-95"
              >
                <MoreVertical size={13} color={isDark ? '#E5E7EB' : '#1F2937'} />
                <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                  Manage
                </Text>
              </Pressable>

              <Pressable
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setFolderFilter(null)}
                accessibilityLabel="Clear Folder Filter"
                className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:opacity-60"
              >
                <X size={15} color={isDark ? '#A1A1AA' : '#71717A'} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Archived Folder Filter Banner with 1-Tap Unarchive Folder Action */}
        {queryRequest.folderPath && queryRequest.statusScope === 'archived' && (
          <View className="flex-row items-center justify-between mb-6 p-4 rounded-2xl bg-cyan-500/15 border border-cyan-500/30">
            <View className="flex-row items-center gap-3 flex-1 mr-2">
              <View className="w-9 h-9 rounded-xl bg-cyan-500/25 items-center justify-center">
                <Archive size={18} color="#06B6D4" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-bold text-light-textPrimary dark:text-dark-textPrimary" numberOfLines={1}>
                    /{queryRequest.folderPath}
                  </Text>
                  <Text className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/25 text-cyan-400">
                    Archived Folder • {feedCards.length + pinnedCards.length} notes
                  </Text>
                </View>
                <Text className="text-xs text-light-textMuted dark:text-dark-textMuted" numberOfLines={1}>
                  Archived directory and notes preserved offline
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-1.5">
              {activeFolderObj?.id && (
                <Pressable
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={async () => {
                    await unarchiveFolder(activeFolderObj.id);
                  }}
                  accessibilityLabel="Unarchive Folder"
                  className="px-3 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex-row items-center gap-1 active:scale-95"
                >
                  <Archive size={13} color="#06B6D4" />
                  <Text className="text-xs font-bold text-cyan-400">
                    Unarchive
                  </Text>
                </Pressable>
              )}

              <Pressable
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => handleOpenFolderActions(queryRequest.folderPath!)}
                accessibilityLabel="Manage Folder Actions"
                className="px-3 py-1.5 rounded-full bg-light-surface dark:bg-white/10 border border-light-border dark:border-white/10 flex-row items-center gap-1 active:scale-95"
              >
                <MoreVertical size={13} color={isDark ? '#E5E7EB' : '#1F2937'} />
                <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                  Manage
                </Text>
              </Pressable>

              <Pressable
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setFolderFilter(null)}
                accessibilityLabel="Clear Folder Filter"
                className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:opacity-60"
              >
                <X size={15} color={isDark ? '#A1A1AA' : '#71717A'} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Favorite Folders Shelf (When viewing Favorites and favorite folders exist) */}
        {queryRequest.statusScope === 'favorites' && favoriteFolders.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center gap-2 mb-2.5">
              <Star size={13} color="#FFD43B" fill="#FFD43B" />
              <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted">
                Favorite Folders ({favoriteFolders.length})
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, flexShrink: 0 }}
              contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 }}
            >
              {favoriteFolders.map((favFolder) => {
                const folderPath = favFolder.path || favFolder.name;
                const isSelected = queryRequest.folderPath === folderPath;
                const colorHex = favFolder.color_token ? NoteColors[favFolder.color_token as NoteColorToken] : undefined;

                return (
                  <Pressable
                    key={favFolder.id}
                    onPress={() => setFolderFilter(isSelected ? null : folderPath)}
                    onLongPress={() => handleOpenFolderActions(folderPath)}
                    delayLongPress={350}
                    accessibilityLabel={`Favorite folder ${folderPath}`}
                    className={`flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-full border active:scale-95 transition-all ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500/50'
                        : 'bg-light-surface/70 dark:bg-white/5 border-light-border dark:border-white/10 hover:border-amber-500/40'
                    }`}
                  >
                    <View className="flex-row items-center gap-1">
                      {colorHex && (
                        <View style={{ backgroundColor: colorHex }} className="w-2 h-2 rounded-full mr-0.5" />
                      )}
                      {renderFolderIcon(favFolder.icon, 12, isSelected ? '#FFD43B' : (colorHex || (isDark ? '#D4D4D8' : '#71717A')))}
                    </View>
                    <Text
                      className={`text-xs font-semibold ${
                        isSelected
                          ? 'text-amber-500 font-bold'
                          : 'text-light-textPrimary dark:text-dark-textPrimary'
                      }`}
                    >
                      {favFolder.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

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
                  onOpenNote={handleOpenNote}
                  onTogglePin={togglePin}
                  onToggleFavorite={toggleFavorite}
                  onRestoreNote={restoreNote}
                  onPermanentlyDeleteNote={permanentlyDeleteNote}
                  onUnarchiveNote={unarchiveNote}
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
              onOpenNote={handleOpenNote}
              onTogglePin={togglePin}
              onToggleFavorite={toggleFavorite}
              onRestoreNote={restoreNote}
              onPermanentlyDeleteNote={permanentlyDeleteNote}
              onUnarchiveNote={unarchiveNote}
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
      {isFolderModalOpen && (
        <Modal
          transparent
          animationType="fade"
          visible={isFolderModalOpen}
          onRequestClose={() => setIsFolderModalOpen(false)}
        >
          <Pressable
            onPress={() => setIsFolderModalOpen(false)}
            className="flex-1 bg-black/60 items-center justify-center p-4 backdrop-blur-sm"
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: isDark ? '#18181B' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
              }}
              className="w-full max-w-md rounded-3xl border p-6 shadow-2xl"
            >
              {/* Header */}
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                  <FolderPlus size={18} color="#06B6D4" />
                  <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                    New Folder
                  </Text>
                </View>
                <Pressable
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => setIsFolderModalOpen(false)}
                  className="w-7 h-7 rounded-full items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 active:bg-black/15 dark:active:bg-white/15"
                >
                  <X size={16} color={isDark ? '#A1A1AA' : '#71717A'} />
                </Pressable>
              </View>

              <Text className="text-xs text-light-textMuted dark:text-dark-textMuted mb-3">
                Select an existing directory below to traverse into it, or keep Root Directory (/) selected to create a top-level folder.
              </Text>

              {/* Interactive Breadcrumb Path Bar */}
              <View className="mb-3 p-2.5 rounded-xl bg-light-appBg dark:bg-white/[0.04] border border-light-border dark:border-white/10">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-1.5">
                  Parent Location
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0, flexShrink: 0 }}
                  contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Pressable
                    onPress={() => setSelectedParentPath('')}
                    className={`flex-row items-center gap-1 px-2.5 py-1 rounded-lg border ${selectedParentPath === ''
                      ? 'bg-cyan-500/20 border-cyan-500/50'
                      : 'bg-light-surface dark:bg-white/5 border-light-border dark:border-white/10 active:scale-95'
                      }`}
                  >
                    <Folder size={11} color="#06B6D4" />
                    <Text
                      className={`text-xs font-bold ${selectedParentPath === ''
                        ? 'text-cyan-400'
                        : 'text-light-textSecondary dark:text-dark-textSecondary'
                        }`}
                    >
                      Root (/)
                    </Text>
                  </Pressable>

                  {parentBreadcrumbSegments.map((seg) => {
                    const isCurrent = seg.path === selectedParentPath;
                    return (
                      <React.Fragment key={seg.path}>
                        <ChevronRight size={12} color={isDark ? '#71717A' : '#A1A1AA'} />
                        <Pressable
                          onPress={() => setSelectedParentPath(seg.path)}
                          className={`flex-row items-center gap-1 px-2.5 py-1 rounded-lg border ${isCurrent
                            ? 'bg-cyan-500/20 border-cyan-500/50'
                            : 'bg-light-surface dark:bg-white/5 border-light-border dark:border-white/10 active:scale-95'
                            }`}
                        >
                          <Folder size={11} color="#06B6D4" />
                          <Text
                            className={`text-xs font-bold ${isCurrent
                              ? 'text-cyan-400'
                              : 'text-light-textSecondary dark:text-dark-textSecondary'
                              }`}
                          >
                            {seg.name}
                          </Text>
                        </Pressable>
                      </React.Fragment>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Subfolders inside the currently selected directory (Infinite Depth Traversal) */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted">
                    {selectedParentPath
                      ? `Subfolders inside /${selectedParentPath} (Tap to enter)`
                      : 'Existing Root Folders (Tap to enter)'}
                  </Text>
                  {selectedParentPath !== '' && (
                    <Pressable
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => {
                        const parts = selectedParentPath.split('/').filter(Boolean);
                        parts.pop();
                        setSelectedParentPath(parts.join('/'));
                      }}
                      className="px-2 py-0.5 rounded bg-light-surface dark:bg-white/10 active:scale-95"
                    >
                      <Text className="text-[10px] font-bold text-cyan-400">↑ Up One Level</Text>
                    </Pressable>
                  )}
                </View>

                {currentLevelSubfolders.length > 0 ? (
                  <ScrollView
                    style={{ maxHeight: 150 }}
                    contentContainerStyle={{ gap: 6 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {currentLevelSubfolders.map((subPath) => {
                      const leafName = subPath.split('/').pop() || subPath;
                      const childCount = allFolderNames.filter(
                        (f) => f.startsWith(`${subPath}/`) && !f.slice(subPath.length + 1).includes('/')
                      ).length;

                      return (
                        <Pressable
                          key={subPath}
                          onPress={() => setSelectedParentPath(subPath)}
                          className="flex-row items-center justify-between px-3 py-2 rounded-xl bg-light-surface dark:bg-white/[0.04] border border-light-border dark:border-white/10 hover:border-cyan-500/40 active:bg-cyan-500/10"
                        >
                          <View className="flex-row items-center gap-2 flex-1">
                            <Folder size={14} color="#06B6D4" />
                            <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                              {leafName}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-1.5">
                            {childCount > 0 && (
                              <Text className="text-[10px] font-medium text-light-textMuted dark:text-dark-textMuted">
                                {childCount} {childCount === 1 ? 'subfolder' : 'subfolders'}
                              </Text>
                            )}
                            <ChevronRight size={13} color={isDark ? '#A1A1AA' : '#71717A'} />
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <View className="py-3 px-3 rounded-xl bg-light-surface/50 dark:bg-white/[0.02] border border-dashed border-light-border dark:border-white/10 flex-row items-center gap-2">
                    <CornerDownRight size={13} color={isDark ? '#71717A' : '#A1A1AA'} />
                    <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                      Innermost directory reached — no deeper subfolders inside /{selectedParentPath}.
                    </Text>
                  </View>
                )}
              </View>

              {/* New Folder Name Input */}
              <Text className="text-[10px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-1.5">
                New Folder Name
              </Text>
              <TextInput
                placeholder={
                  selectedParentPath
                    ? `New folder inside /${selectedParentPath}...`
                    : 'New folder name in Root (/)...'
                }
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                value={newFolderName}
                onChangeText={setNewFolderName}
                autoFocus
                onSubmitEditing={handleCreateAndCloseFolderModal}
                className="text-sm font-medium text-light-textPrimary dark:text-dark-textPrimary px-3 py-2.5 rounded-xl bg-light-appBg dark:bg-white/5 border border-light-border dark:border-white/10 mb-2"
              />

              {/* Live Target Path Preview */}
              <View className="flex-row items-center gap-1.5 mb-4 px-1">
                <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
                  Target path:
                </Text>
                <Text className="text-[11px] font-mono font-bold text-cyan-400" numberOfLines={1}>
                  /{selectedParentPath ? `${selectedParentPath}/` : ''}
                  {newFolderName.trim().replace(/^\/+|\/+$/g, '') || '<new-folder>'}
                </Text>
              </View>

              {/* Modal Actions */}
              <View className="flex-row flex-wrap items-center justify-end gap-2">
                <Pressable
                  onPress={() => setIsFolderModalOpen(false)}
                  className="px-3.5 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10"
                >
                  <Text className="text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary">
                    Cancel
                  </Text>
                </Pressable>

                {/* Create & Enter (lets user immediately create another subfolder inside the new one!) */}
                <Pressable
                  onPress={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className={`flex-row items-center gap-1 px-3.5 py-2 rounded-full border ${newFolderName.trim()
                    ? 'border-cyan-500/50 bg-cyan-500/15 active:scale-95'
                    : 'border-white/10 bg-white/5 opacity-40'
                    }`}
                >
                  <FolderPlus size={13} color="#06B6D4" />
                  <Text className="text-xs font-bold text-cyan-400">Create & Open</Text>
                </Pressable>

                {/* Create & Done */}
                <Pressable
                  onPress={handleCreateAndCloseFolderModal}
                  disabled={!newFolderName.trim()}
                  className={`flex-row items-center gap-1.5 px-4 py-2 rounded-full ${newFolderName.trim() ? 'bg-cyan-500 active:scale-95' : 'bg-white/10 opacity-40'
                    }`}
                >
                  <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                  <Text className="text-xs font-bold text-white">Create Folder</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Batch Move to Folder Modal */}
      {isMoveFolderModalOpen && (
        <Modal
          transparent
          animationType="fade"
          visible={isMoveFolderModalOpen}
          onRequestClose={() => setIsMoveFolderModalOpen(false)}
        >
          <Pressable
            onPress={() => setIsMoveFolderModalOpen(false)}
            className="flex-1 bg-black/60 items-center justify-center p-4 backdrop-blur-sm"
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: isDark ? '#18181B' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
              }}
              className="w-full max-w-md rounded-3xl border p-6 shadow-2xl"
            >
              {/* Header */}
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                  <FolderInput size={18} color="#06B6D4" />
                  <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                    Move {selectedNoteIds.size} {selectedNoteIds.size === 1 ? 'Note' : 'Notes'}
                  </Text>
                </View>
                <Pressable
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => setIsMoveFolderModalOpen(false)}
                  className="w-7 h-7 rounded-full items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 active:bg-black/15 dark:active:bg-white/15"
                >
                  <X size={16} color={isDark ? '#A1A1AA' : '#71717A'} />
                </Pressable>
              </View>

              <Text className="text-xs text-light-textMuted dark:text-dark-textMuted mb-3">
                Select a destination folder below to move all selected notes.
              </Text>

              {/* Folder Options List */}
              <ScrollView
                style={{ maxHeight: 220 }}
                contentContainerStyle={{ gap: 6 }}
                showsVerticalScrollIndicator={false}
                className="mb-4"
              >
                {/* General / Root Directory */}
                <Pressable
                  onPress={() => handleExecuteBatchMove('General')}
                  className="flex-row items-center justify-between px-3.5 py-2.5 rounded-xl bg-light-surface dark:bg-white/[0.04] border border-light-border dark:border-white/10 hover:border-cyan-500/40 active:bg-cyan-500/10"
                >
                  <View className="flex-row items-center gap-2.5">
                    <Folder size={15} color="#06B6D4" />
                    <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                      General (Root)
                    </Text>
                  </View>
                  <ChevronRight size={13} color={isDark ? '#A1A1AA' : '#71717A'} />
                </Pressable>

                {/* Existing Folders */}
                {allFolderNames
                  .filter((f) => f !== 'General')
                  .map((folderPath) => (
                    <Pressable
                      key={folderPath}
                      onPress={() => handleExecuteBatchMove(folderPath)}
                      className="flex-row items-center justify-between px-3.5 py-2.5 rounded-xl bg-light-surface dark:bg-white/[0.04] border border-light-border dark:border-white/10 hover:border-cyan-500/40 active:bg-cyan-500/10"
                    >
                      <View className="flex-row items-center gap-2.5">
                        <Folder size={15} color="#06B6D4" />
                        <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                          /{folderPath}
                        </Text>
                      </View>
                      <ChevronRight size={13} color={isDark ? '#A1A1AA' : '#71717A'} />
                    </Pressable>
                  ))}
              </ScrollView>

              {/* Quick Create & Move */}
              <Text className="text-[10px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-1.5">
                Or Move To New Folder
              </Text>
              <View className="flex-row items-center gap-2 mb-4">
                <TextInput
                  placeholder="New folder name..."
                  placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                  value={quickNewFolderName}
                  onChangeText={setQuickNewFolderName}
                  onSubmitEditing={handleCreateAndMove}
                  className="flex-1 text-xs font-medium text-light-textPrimary dark:text-dark-textPrimary px-3 py-2 rounded-xl bg-light-appBg dark:bg-white/5 border border-light-border dark:border-white/10"
                />
                <Pressable
                  onPress={handleCreateAndMove}
                  disabled={!quickNewFolderName.trim()}
                  className={`px-3.5 py-2 rounded-xl border ${quickNewFolderName.trim()
                    ? 'border-cyan-500/50 bg-cyan-500/20 active:scale-95'
                    : 'border-white/10 bg-white/5 opacity-40'
                    }`}
                >
                  <Text className="text-xs font-bold text-cyan-400">Create & Move</Text>
                </Pressable>
              </View>

              {/* Close / Cancel Button */}
              <View className="flex-row justify-end">
                <Pressable
                  onPress={() => setIsMoveFolderModalOpen(false)}
                  className="px-4 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10"
                >
                  <Text className="text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary">
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

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
          stats={activeFolderStats}
          onClose={() => setIsActionSheetOpen(false)}
          onOpenCreateSubfolder={(parent) => handleOpenCreateSubfolderFromSheet(parent)}
          onOpenRename={() => setIsRenameModalOpen(true)}
          onOpenMove={() => setIsMoveFolderReparentModalOpen(true)}
          onDuplicate={(p, id) => handleConfirmDuplicateFolder(p, id)}
          onOpenDelete={() => setIsDeleteFolderModalOpen(true)}
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
              if (actionSheetFolder.isArchived) {
                await unarchiveFolder(actionSheetFolder.id);
                setActionSheetFolder((prev) => (prev ? { ...prev, isArchived: false } : null));
              } else {
                await archiveFolder(actionSheetFolder.id);
                setActionSheetFolder((prev) => (prev ? { ...prev, isArchived: true } : null));
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
          onClose={() => setIsDeleteFolderModalOpen(false)}
          onConfirmDelete={(noteAction) => handleConfirmDeleteFolder(noteAction)}
        />
      )}

      {/* Rename Folder Modal with Path Preview */}
      {actionSheetFolder && (
        <RenameFolderModal
          visible={isRenameModalOpen}
          folderId={actionSheetFolder.id}
          currentPath={actionSheetFolder.path}
          onClose={() => setIsRenameModalOpen(false)}
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
          onClose={() => setIsMoveFolderReparentModalOpen(false)}
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
          setFolderFilter(folderPath);
        }}
        onOpenFolderActions={(folderPath) => {
          setIsFolderExplorerOpen(false);
          handleOpenFolderActions(folderPath);
        }}
        onOpenCreateSubfolder={(parentPath) => {
          setIsFolderExplorerOpen(false);
          handleOpenCreateSubfolderFromSheet(parentPath);
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
        onSelectFolder={(folderPath) => setFolderFilter(folderPath)}
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
        onSelectFolder={setFolderFilter}
        onSelectStatusScope={setStatusScopeFilter}
        onResetFilters={resetQueryRequest}
      />
    </View>
  );
};
