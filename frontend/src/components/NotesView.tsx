import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal, Platform, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
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
  Clock
} from 'lucide-react-native';

export const NotesView: React.FC = () => {
  const router = useRouter();
  const { isDark } = useTheme();
  const { 
    notes, 
    folders,
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
    createFolder
  } = useNotesStore();

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedParentPath, setSelectedParentPath] = useState<string>('');

  // Voice-to-Text Search Dictation State
  const [isVoiceSearching, setIsVoiceSearching] = useState(false);
  const recognitionRef = useRef<any>(null);
  const loadingMoreLockRef = useRef(false);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
    };
  }, []);

  const handleToggleVoiceSearch = () => {
    if (isVoiceSearching) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
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

  // Derive all active folders from repository and notes (including intermediate parent paths)
  const rawFolderPaths = Array.from(
    new Set([
      'General',
      ...folders.map((f) => f.path || f.name),
      ...notes.filter((n) => n.status !== 'trashed' && n.status !== 'archived').map((n) => n.folderPath).filter(Boolean) as string[],
    ])
  );

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
  }, [folders, notes]);

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

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <ScrollView 
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      onScroll={handleScrollFeed}
      scrollEventThrottle={16}
    >
      {/* Editorial Page Heading + Add Note Button */}
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

      {/* Universal Local Search Bar (Text + Voice-to-Text Search) */}
      <View className="mb-6">
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
          className="flex-row items-center px-3.5 py-2.5 rounded-2xl bg-light-surface dark:bg-dark-raised border shadow-sm"
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
            className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full transition-all active:scale-95 ${
              isVoiceSearching
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
          className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${
            queryRequest.statusScope === 'active' && !queryRequest.folderPath && (!queryRequest.tags || queryRequest.tags.length === 0)
              ? 'bg-light-iconBg dark:bg-white border-transparent'
              : 'bg-transparent border-light-border dark:border-dark-border'
          }`}
        >
          <Text className={`text-xs font-semibold ${
            queryRequest.statusScope === 'active' && !queryRequest.folderPath && (!queryRequest.tags || queryRequest.tags.length === 0)
              ? 'text-white dark:text-[#111111]'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
          }`}>
            All Notes
          </Text>
          <Text className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
            queryRequest.statusScope === 'active' && !queryRequest.folderPath && (!queryRequest.tags || queryRequest.tags.length === 0)
              ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#111111]'
              : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
          }`}>
            {partitionCounts.allActive}
          </Text>
        </Pressable>

        {/* Favorites Pill */}
        <Pressable
          onPress={() => setStatusScopeFilter('favorites')}
          className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${
            queryRequest.statusScope === 'favorites'
              ? 'bg-light-iconBg dark:bg-white border-transparent'
              : 'bg-transparent border-light-border dark:border-dark-border'
          }`}
        >
          <Star 
            size={12} 
            color={queryRequest.statusScope === 'favorites' ? '#FFD43B' : (isDark ? '#B5B5B5' : '#626262')} 
            fill={queryRequest.statusScope === 'favorites' ? '#FFD43B' : 'transparent'} 
          />
          <Text className={`text-xs font-semibold ${
            queryRequest.statusScope === 'favorites'
              ? 'text-white dark:text-[#111111]'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
          }`}>
            Favorites
          </Text>
          <Text className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
            queryRequest.statusScope === 'favorites'
              ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#111111]'
              : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
          }`}>
            {partitionCounts.favorites}
          </Text>
        </Pressable>

        {/* Archive Pill */}
        <Pressable
          onPress={() => setStatusScopeFilter('archived')}
          className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${
            queryRequest.statusScope === 'archived'
              ? 'bg-cyan-500 border-transparent'
              : 'bg-transparent border-light-border dark:border-dark-border'
          }`}
        >
          <Archive size={12} color={queryRequest.statusScope === 'archived' ? '#FFFFFF' : (isDark ? '#B5B5B5' : '#626262')} />
          <Text className={`text-xs font-semibold ${
            queryRequest.statusScope === 'archived'
              ? 'text-white'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
          }`}>
            Archive
          </Text>
          {partitionCounts.archived > 0 && (
            <Text className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
              queryRequest.statusScope === 'archived'
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
          className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${
            queryRequest.statusScope === 'trashed'
              ? 'bg-red-500 border-transparent'
              : 'bg-transparent border-light-border dark:border-dark-border'
          }`}
        >
          <Trash2 size={12} color={queryRequest.statusScope === 'trashed' ? '#FFFFFF' : (isDark ? '#B5B5B5' : '#626262')} />
          <Text className={`text-xs font-semibold ${
            queryRequest.statusScope === 'trashed'
              ? 'text-white'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
          }`}>
            Trash
          </Text>
          {partitionCounts.trashed > 0 && (
            <Text className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
              queryRequest.statusScope === 'trashed'
                ? 'bg-white/20 text-white'
                : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
            }`}>
              {partitionCounts.trashed}
            </Text>
          )}
        </Pressable>

        {/* Divider */}
        <View className="h-5 w-[1px] bg-light-border dark:bg-dark-border mx-1 self-center" />

        {/* Dynamic Folder Pills */}
        {allFolderNames.map((folderName) => {
          const isSelected = queryRequest.folderPath === folderName;
          return (
            <Pressable
              key={folderName}
              onPress={() => setFolderFilter(isSelected ? null : folderName)}
              className={`flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-full border transition-all ${
                isSelected
                  ? 'bg-light-iconBg dark:bg-white border-transparent'
                  : 'bg-transparent border-light-border dark:border-dark-border'
              }`}
            >
              <Folder size={11} color={isSelected ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
              <Text className={`text-xs font-semibold ${
                isSelected
                  ? 'text-white dark:text-[#111111]'
                  : 'text-light-textSecondary dark:text-dark-textSecondary'
              }`}>
                {folderName}
              </Text>
            </Pressable>
          );
        })}

        {/* + New Folder Button */}
        <Pressable
          onPress={handleOpenFolderModal}
          accessibilityLabel="Create New Folder"
          className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-light-surface/60 dark:bg-white/5 border border-dashed border-light-border dark:border-white/20 hover:border-cyan-500/50 active:scale-95"
        >
          <Plus size={11} color={isDark ? '#A1A1AA' : '#71717A'} />
          <Text className="text-xs text-light-textMuted dark:text-dark-textMuted font-medium">Folder</Text>
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
              className={`flex-row items-center gap-1 px-3 py-1.5 rounded-full border transition-all ${
                isSelected
                  ? 'bg-cyan-500/20 border-cyan-500/50'
                  : 'bg-transparent border-light-border dark:border-dark-border'
              }`}
            >
              <Tag size={10} color="#06B6D4" />
              <Text className={`text-xs font-semibold ${
                isSelected ? 'text-cyan-400' : 'text-light-textSecondary dark:text-dark-textSecondary'
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
                onOpenNote={handleOpenNote}
                onTogglePin={togglePin}
                onToggleFavorite={toggleFavorite}
                onRestoreNote={restoreNote}
                onPermanentlyDeleteNote={permanentlyDeleteNote}
                onUnarchiveNote={unarchiveNote}
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
            onOpenNote={handleOpenNote}
            onTogglePin={togglePin}
            onToggleFavorite={toggleFavorite}
            onRestoreNote={restoreNote}
            onPermanentlyDeleteNote={permanentlyDeleteNote}
            onUnarchiveNote={unarchiveNote}
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
                    className={`flex-row items-center gap-1 px-2.5 py-1 rounded-lg border ${
                      selectedParentPath === ''
                        ? 'bg-cyan-500/20 border-cyan-500/50'
                        : 'bg-light-surface dark:bg-white/5 border-light-border dark:border-white/10 active:scale-95'
                    }`}
                  >
                    <Folder size={11} color="#06B6D4" />
                    <Text
                      className={`text-xs font-bold ${
                        selectedParentPath === ''
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
                          className={`flex-row items-center gap-1 px-2.5 py-1 rounded-lg border ${
                            isCurrent
                              ? 'bg-cyan-500/20 border-cyan-500/50'
                              : 'bg-light-surface dark:bg-white/5 border-light-border dark:border-white/10 active:scale-95'
                          }`}
                        >
                          <Folder size={11} color="#06B6D4" />
                          <Text
                            className={`text-xs font-bold ${
                              isCurrent
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
                  className={`flex-row items-center gap-1 px-3.5 py-2 rounded-full border ${
                    newFolderName.trim()
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
                  className={`flex-row items-center gap-1.5 px-4 py-2 rounded-full ${
                    newFolderName.trim() ? 'bg-cyan-500 active:scale-95' : 'bg-white/10 opacity-40'
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
    </ScrollView>
  );
};
