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
import { NotesBatchActionBar } from "./notes/NotesBatchActionBar";
import { NotesSearchBar } from "./notes/NotesSearchBar";
import { NotesFilterTrack } from "./notes/NotesFilterTrack";
import { FolderContextBanners } from "./notes/FolderContextBanners";
import { CreateFolderModal, BatchMoveFolderModal } from "./notes/CreateFolderModal";
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
      <NotesBatchActionBar
        isSelectionMode={isSelectionMode}
        selectedNoteIds={selectedNoteIds}
        isDark={isDark}
        isAllVisibleSelected={isAllVisibleSelected}
        statusScope={queryRequest.statusScope}
        onClearSelection={handleClearSelection}
        onToggleSelectAll={handleToggleSelectAll}
        onOpenMoveFolderModal={() => setIsMoveFolderModalOpen(true)}
        onBatchTogglePin={handleBatchTogglePin}
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
          pinnedFolders={pinnedFolders}
          activeFolderObj={activeFolderObj}
          activeFolderColor={activeFolderColor}
          renderFolderIcon={renderFolderIcon}
          tags={tags}
          setStatusScopeFilter={setStatusScopeFilter}
          setFolderFilter={setFolderFilter}
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
          emptyTrash={emptyTrash}
          isDark={isDark}
          activeFolderObj={activeFolderObj}
          onOpenFolderActions={handleOpenFolderActions}
          setFolderFilter={setFolderFilter}
          unarchiveFolder={unarchiveFolder}
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
      <CreateFolderModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
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
