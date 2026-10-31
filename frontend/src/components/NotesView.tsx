import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, NoteColors } from '../theme';
import { useNotesStore } from '../state/useNotesStore';
import { NoteItem } from '../types/note';
import { 
  Star, 
  Pencil, 
  Mic, 
  Paperclip, 
  ArrowUp, 
  Folder,
  Plus,
  Pin,
  Archive,
  Trash2,
  RotateCcw,
  Tag,
  X,
  Check
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
    addNote, 
    toggleFavorite,
    togglePin,
    archiveNote,
    unarchiveNote,
    restoreNote,
    permanentlyDeleteNote,
    emptyTrash,
    createFolder
  } = useNotesStore();

  const [quickThought, setQuickThought] = useState('');
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleOpenNote = (note: NoteItem) => {
    router.push(`/note/${note.id}`);
  };

  const handleQuickCapture = async () => {
    if (!quickThought.trim()) return;
    const parts = quickThought.trim().split('\n');
    const title = parts[0].slice(0, 48);
    const content = quickThought.trim();
    const created = await addNote(title, content);
    setQuickThought('');
    if (created?.id) {
      router.push(`/note/${created.id}`);
    }
  };

  const handleCreateNewBlankNote = () => {
    router.push('/note/new');
  };

  const handleCreateFolder = async () => {
    const clean = newFolderName.trim();
    if (!clean) return;
    await createFolder(clean);
    setNewFolderName('');
    setIsFolderModalOpen(false);
    setActiveFilter(`folder:${clean}`);
  };

  // Status partitions
  const activeNotes = notes.filter((n) => n.status !== 'trashed' && n.status !== 'archived');
  const archivedNotes = notes.filter((n) => n.status === 'archived');
  const trashedNotes = notes.filter((n) => n.status === 'trashed');
  const pinnedNotes = activeNotes.filter((n) => n.isPinned);

  // Derive all active folders from repository and notes
  const allFolderNames = Array.from(
    new Set([
      'General',
      ...folders.map((f) => f.name || f.path),
      ...activeNotes.map((n) => n.folderPath).filter(Boolean) as string[],
    ])
  );

  // Filter notes based on activeFilter
  const getDisplayedNotes = (): NoteItem[] => {
    if (activeFilter === 'all') return activeNotes;
    if (activeFilter === 'favorites') return activeNotes.filter((n) => n.isFavorite);
    if (activeFilter === 'archive') return archivedNotes;
    if (activeFilter === 'trash') return trashedNotes;
    if (activeFilter.startsWith('folder:')) {
      const folder = activeFilter.slice(7);
      return activeNotes.filter((n) => (n.folderPath || 'General') === folder);
    }
    if (activeFilter.startsWith('tag:')) {
      const tag = activeFilter.slice(4);
      return activeNotes.filter((n) => n.tags && n.tags.includes(tag));
    }
    return activeNotes;
  };

  const displayedNotes = getDisplayedNotes();

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
    >
      {/* Editorial Page Heading + Add Note Button */}
      <View className="flex-row items-baseline justify-between mb-6">
        <View>
          <Text className="text-4xl md:text-5xl font-extrabold text-light-textPrimary dark:text-dark-textPrimary tracking-tight">
            Notes
          </Text>
          <Text className="text-xs md:text-sm font-medium text-light-textSecondary dark:text-dark-textSecondary mt-1">
            {formattedDate} • {activeNotes.length} thoughts & captures
          </Text>
        </View>

        {/* Create Note Circular Button */}
        <Pressable
          onPress={handleCreateNewBlankNote}
          accessibilityLabel="Create New Note in Block Editor"
          className="w-11 h-11 rounded-full bg-light-iconBg dark:bg-white items-center justify-center active:scale-95 shadow-md transition-transform"
        >
          <Plus size={20} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* Universal Quick Capture Ribbon (Level 0 Ingest) */}
      <View 
        className="mb-8 p-3.5 rounded-2xl bg-light-surface dark:bg-dark-raised border border-light-border dark:border-dark-border shadow-sm"
      >
        <TextInput
          placeholder="Capture a thought, task, or paste markdown..."
          placeholderTextColor={isDark ? '#858585' : '#929292'}
          value={quickThought}
          onChangeText={setQuickThought}
          onSubmitEditing={handleQuickCapture}
          className="text-base font-medium text-light-textPrimary dark:text-dark-textPrimary px-2 py-1 mb-2"
        />

        <View className="flex-row items-center justify-between pt-1 border-t border-light-border/60 dark:border-dark-border/60">
          {/* Multi-Modal Ingest Icons */}
          <View className="flex-row items-center gap-1.5">
            <Pressable 
              accessibilityLabel="Audio Voice Memo"
              className="w-8 h-8 rounded-full items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 active:scale-90"
            >
              <Mic size={16} color={isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>

            <Pressable 
              accessibilityLabel="File & Image Attachment"
              className="w-8 h-8 rounded-full items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 active:scale-90"
            >
              <Paperclip size={16} color={isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>

            <View className="h-4 w-[1px] bg-light-border dark:bg-dark-border mx-1" />

            <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-light-appBg dark:bg-dark-surface">
              <Folder size={11} color={isDark ? '#858585' : '#929292'} />
              <Text className="text-[11px] font-medium text-light-textMuted dark:text-dark-textMuted">
                Universal Inbox
              </Text>
            </View>
          </View>

          {/* Quick Submit Arrow */}
          <Pressable
            onPress={handleQuickCapture}
            accessibilityLabel="Capture Note"
            disabled={!quickThought.trim()}
            className={`w-8 h-8 rounded-full items-center justify-center transition-all ${
              quickThought.trim() 
                ? 'bg-light-iconBg dark:bg-white active:scale-90' 
                : 'bg-black/10 dark:bg-white/10 opacity-50'
            }`}
          >
            <ArrowUp 
              size={16} 
              color={quickThought.trim() ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#858585' : '#929292')} 
              strokeWidth={2.5} 
            />
          </Pressable>
        </View>
      </View>

      {/* Dynamic Context, Status & Filter Pills Track */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="flex-row gap-2 mb-8 -mx-1 px-1"
      >
        {/* All Notes Pill */}
        <Pressable
          onPress={() => setActiveFilter('all')}
          className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${
            activeFilter === 'all'
              ? 'bg-light-iconBg dark:bg-white border-transparent'
              : 'bg-transparent border-light-border dark:border-dark-border'
          }`}
        >
          <Text className={`text-xs font-semibold ${
            activeFilter === 'all'
              ? 'text-white dark:text-[#111111]'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
          }`}>
            All Notes
          </Text>
          <Text className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
            activeFilter === 'all'
              ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#111111]'
              : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
          }`}>
            {activeNotes.length}
          </Text>
        </Pressable>

        {/* Favorites Pill */}
        <Pressable
          onPress={() => setActiveFilter('favorites')}
          className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${
            activeFilter === 'favorites'
              ? 'bg-light-iconBg dark:bg-white border-transparent'
              : 'bg-transparent border-light-border dark:border-dark-border'
          }`}
        >
          <Star 
            size={12} 
            color={activeFilter === 'favorites' ? '#FFD43B' : (isDark ? '#B5B5B5' : '#626262')} 
            fill={activeFilter === 'favorites' ? '#FFD43B' : 'transparent'} 
          />
          <Text className={`text-xs font-semibold ${
            activeFilter === 'favorites'
              ? 'text-white dark:text-[#111111]'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
          }`}>
            Favorites
          </Text>
          <Text className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
            activeFilter === 'favorites'
              ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#111111]'
              : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
          }`}>
            {activeNotes.filter((n) => n.isFavorite).length}
          </Text>
        </Pressable>

        {/* Archive Pill */}
        <Pressable
          onPress={() => setActiveFilter('archive')}
          className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${
            activeFilter === 'archive'
              ? 'bg-cyan-500 border-transparent'
              : 'bg-transparent border-light-border dark:border-dark-border'
          }`}
        >
          <Archive size={12} color={activeFilter === 'archive' ? '#FFFFFF' : (isDark ? '#B5B5B5' : '#626262')} />
          <Text className={`text-xs font-semibold ${
            activeFilter === 'archive'
              ? 'text-white'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
          }`}>
            Archive
          </Text>
          {archivedNotes.length > 0 && (
            <Text className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
              activeFilter === 'archive'
                ? 'bg-white/20 text-white'
                : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
            }`}>
              {archivedNotes.length}
            </Text>
          )}
        </Pressable>

        {/* Trash Pill */}
        <Pressable
          onPress={() => setActiveFilter('trash')}
          className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${
            activeFilter === 'trash'
              ? 'bg-red-500 border-transparent'
              : 'bg-transparent border-light-border dark:border-dark-border'
          }`}
        >
          <Trash2 size={12} color={activeFilter === 'trash' ? '#FFFFFF' : (isDark ? '#B5B5B5' : '#626262')} />
          <Text className={`text-xs font-semibold ${
            activeFilter === 'trash'
              ? 'text-white'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
          }`}>
            Trash
          </Text>
          {trashedNotes.length > 0 && (
            <Text className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
              activeFilter === 'trash'
                ? 'bg-white/20 text-white'
                : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
            }`}>
              {trashedNotes.length}
            </Text>
          )}
        </Pressable>

        {/* Divider */}
        <View className="h-5 w-[1px] bg-light-border dark:bg-dark-border mx-1 self-center" />

        {/* Dynamic Folder Pills */}
        {allFolderNames.map((folderName) => {
          const isSelected = activeFilter === `folder:${folderName}`;
          return (
            <Pressable
              key={folderName}
              onPress={() => setActiveFilter(isSelected ? 'all' : `folder:${folderName}`)}
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
          onPress={() => setIsFolderModalOpen(true)}
          accessibilityLabel="Create New Folder"
          className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-light-surface/60 dark:bg-white/5 border border-dashed border-light-border dark:border-white/20 hover:border-cyan-500/50"
        >
          <Plus size={11} color={isDark ? '#A1A1AA' : '#71717A'} />
          <Text className="text-xs text-light-textMuted dark:text-dark-textMuted font-medium">Folder</Text>
        </Pressable>

        {/* Dynamic Tag Pills */}
        {tags.length > 0 && <View className="h-5 w-[1px] bg-light-border dark:bg-dark-border mx-1 self-center" />}

        {tags.map((tag) => {
          const isSelected = activeFilter === `tag:${tag}`;
          return (
            <Pressable
              key={tag}
              onPress={() => setActiveFilter(isSelected ? 'all' : `tag:${tag}`)}
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
      {activeFilter === 'trash' && (
        <View className="flex-row items-center justify-between mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
          <View className="flex-row items-center gap-2.5">
            <Trash2 size={18} color="#EF4444" />
            <View>
              <Text className="text-sm font-bold text-red-500">Trash Bin</Text>
              <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                {trashedNotes.length} notes in trash. Permanently delete or restore them anytime.
              </Text>
            </View>
          </View>
          {trashedNotes.length > 0 && (
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
      {activeFilter === 'archive' && (
        <View className="flex-row items-center gap-3 mb-6 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
          <Archive size={18} color="#06B6D4" />
          <View>
            <Text className="text-sm font-bold text-cyan-400">Archived Notes</Text>
            <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
              {archivedNotes.length} notes preserved. Tap unarchive on any note to restore it to your main notebook.
            </Text>
          </View>
        </View>
      )}

      {/* Pinned Notes Top Shelf (When viewing All Notes and pinned notes exist) */}
      {activeFilter === 'all' && pinnedNotes.length > 0 && (
        <View className="mb-8">
          <View className="flex-row items-center gap-2 mb-3">
            <Pin size={13} color="#FFC96F" fill="#FFC96F" />
            <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted">
              Pinned Notes ({pinnedNotes.length})
            </Text>
          </View>

          <View className="flex-row flex-wrap -mx-2.5">
            {pinnedNotes.map((note) => {
              const pastelHex = NoteColors[note.colorToken] || '#FFC96F';
              return (
                <View key={note.id} className="w-full sm:w-1/2 lg:w-1/3 p-2.5">
                  <Pressable
                    onPress={() => handleOpenNote(note)}
                    accessibilityLabel={`Open pinned note ${note.title}`}
                    style={{ backgroundColor: pastelHex }}
                    className="p-6 rounded-[22px] min-h-[200px] justify-between shadow-sm active:scale-[0.99] transition-transform cursor-pointer relative overflow-hidden"
                  >
                    {/* Top Row: Folder Badge, Pin Badge, Favorite */}
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-row items-center gap-1.5">
                        <View className="px-2.5 py-1 rounded-full bg-black/10">
                          <Text className="text-[11px] font-semibold text-[#191919] tracking-tight">
                            {note.folderPath || 'General'}
                          </Text>
                        </View>
                        <View className="w-6 h-6 rounded-full bg-black/10 items-center justify-center">
                          <Pin size={11} color="#191919" fill="#191919" />
                        </View>
                      </View>

                      <View className="flex-row items-center gap-1">
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            togglePin(note.id);
                          }}
                          accessibilityLabel="Unpin note"
                          className="w-7 h-7 rounded-full items-center justify-center active:scale-90"
                        >
                          <Pin size={15} color="#191919" fill="#191919" />
                        </Pressable>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            toggleFavorite(note.id);
                          }}
                          accessibilityLabel="Toggle Favorite"
                          className="w-7 h-7 rounded-full items-center justify-center active:scale-90"
                        >
                          <Star 
                            size={16} 
                            color={note.isFavorite ? '#FFD43B' : 'rgba(25, 25, 25, 0.4)'} 
                            fill={note.isFavorite ? '#FFD43B' : 'transparent'} 
                            strokeWidth={2}
                          />
                        </Pressable>
                      </View>
                    </View>

                    {/* Title & Preview */}
                    <View className="flex-1 mb-3">
                      <Text className="text-xl font-bold text-[#191919] tracking-tight mb-1.5 leading-tight">
                        {note.title}
                      </Text>
                      <Text numberOfLines={3} className="text-sm text-[#191919]/80 leading-relaxed font-normal">
                        {note.contentMarkdown}
                      </Text>
                    </View>

                    {/* Tag Chips */}
                    {note.tags && note.tags.length > 0 && (
                      <View className="flex-row flex-wrap gap-1 mb-3">
                        {note.tags.map((t) => (
                          <View key={t} className="px-2 py-0.5 rounded-full bg-black/10">
                            <Text className="text-[10px] font-bold text-[#191919]">#{t}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Bottom Row */}
                    <View className="flex-row items-center justify-between pt-2">
                      <Text className="text-xs font-medium text-[#191919]/60">{note.createdAt}</Text>
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          handleOpenNote(note);
                        }}
                        accessibilityLabel="Edit Note"
                        className="w-8 h-8 rounded-full bg-[#111111] items-center justify-center active:scale-95 shadow-sm"
                      >
                        <Pencil size={14} color="#FFFFFF" strokeWidth={2.2} />
                      </Pressable>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-3 mt-6">
            All Notes ({activeNotes.filter((n) => !n.isPinned).length})
          </Text>
        </View>
      )}

      {/* Main Notes Grid */}
      <View className="flex-row flex-wrap -mx-2.5">
        {(activeFilter === 'all' && pinnedNotes.length > 0
          ? displayedNotes.filter((n) => !n.isPinned)
          : displayedNotes
        ).map((note) => {
          const pastelHex = NoteColors[note.colorToken] || '#FFC96F';
          const isTrashed = note.status === 'trashed';
          const isArchived = note.status === 'archived';

          return (
            <View 
              key={note.id}
              className="w-full sm:w-1/2 lg:w-1/3 p-2.5"
            >
              <Pressable
                onPress={() => !isTrashed && handleOpenNote(note)}
                accessibilityLabel={`Open note ${note.title}`}
                style={{ backgroundColor: pastelHex }}
                className="p-6 rounded-[22px] min-h-[220px] justify-between shadow-sm active:scale-[0.99] transition-transform cursor-pointer"
              >
                {/* Top Row: Folder Badge, Status Chips & Action Buttons */}
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-1.5">
                    <View className="px-2.5 py-1 rounded-full bg-black/10">
                      <Text className="text-[11px] font-semibold text-[#191919] tracking-tight">
                        {note.folderPath || 'General'}
                      </Text>
                    </View>
                    {isArchived && (
                      <View className="px-2 py-0.5 rounded-full bg-cyan-700/20">
                        <Text className="text-[10px] font-bold text-[#191919]">Archived</Text>
                      </View>
                    )}
                    {isTrashed && (
                      <View className="px-2 py-0.5 rounded-full bg-red-700/20">
                        <Text className="text-[10px] font-bold text-[#191919]">Trash</Text>
                      </View>
                    )}
                  </View>

                  {!isTrashed && (
                    <View className="flex-row items-center gap-1">
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          togglePin(note.id);
                        }}
                        accessibilityLabel="Toggle Pin"
                        className="w-7 h-7 rounded-full items-center justify-center active:scale-90"
                      >
                        <Pin 
                          size={15} 
                          color={note.isPinned ? '#191919' : 'rgba(25, 25, 25, 0.4)'} 
                          fill={note.isPinned ? '#191919' : 'transparent'} 
                        />
                      </Pressable>

                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          toggleFavorite(note.id);
                        }}
                        accessibilityLabel="Toggle Favorite"
                        className="w-7 h-7 rounded-full items-center justify-center active:scale-90"
                      >
                        <Star 
                          size={17} 
                          color={note.isFavorite ? '#FFD43B' : 'rgba(25, 25, 25, 0.4)'} 
                          fill={note.isFavorite ? '#FFD43B' : 'transparent'} 
                          strokeWidth={2}
                        />
                      </Pressable>
                    </View>
                  )}
                </View>

                {/* Note Title & Body */}
                <View className="flex-1 mb-3">
                  <Text className="text-xl font-bold text-[#191919] tracking-tight mb-2 leading-tight">
                    {note.title}
                  </Text>
                  <Text 
                    numberOfLines={4}
                    className="text-sm text-[#191919]/80 leading-relaxed font-normal"
                  >
                    {note.contentMarkdown}
                  </Text>
                </View>

                {/* Tag Chips */}
                {note.tags && note.tags.length > 0 && (
                  <View className="flex-row flex-wrap gap-1 mb-3">
                    {note.tags.map((t) => (
                      <View key={t} className="px-2 py-0.5 rounded-full bg-black/10">
                        <Text className="text-[10px] font-bold text-[#191919]">#{t}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Bottom Row Actions */}
                <View className="flex-row items-center justify-between pt-2">
                  <Text className="text-xs font-medium text-[#191919]/60">
                    {note.createdAt}
                  </Text>

                  {isTrashed ? (
                    <View className="flex-row items-center gap-1.5">
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          restoreNote(note.id);
                        }}
                        accessibilityLabel="Restore Note"
                        className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-[#111111] active:scale-95 shadow-sm"
                      >
                        <RotateCcw size={11} color="#FFFFFF" />
                        <Text className="text-[11px] font-bold text-white">Restore</Text>
                      </Pressable>
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          permanentlyDeleteNote(note.id);
                        }}
                        accessibilityLabel="Delete Permanently"
                        className="p-1 rounded-full bg-red-600 active:scale-95"
                      >
                        <Trash2 size={13} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ) : isArchived ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        unarchiveNote(note.id);
                      }}
                      accessibilityLabel="Unarchive Note"
                      className="flex-row items-center gap-1 px-3 py-1 rounded-full bg-[#111111] active:scale-95 shadow-sm"
                    >
                      <RotateCcw size={11} color="#FFFFFF" />
                      <Text className="text-[11px] font-bold text-white">Unarchive</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenNote(note);
                      }}
                      accessibilityLabel="Edit Note"
                      className="w-9 h-9 rounded-full bg-[#111111] items-center justify-center active:scale-95 shadow-sm"
                    >
                      <Pencil size={15} color="#FFFFFF" strokeWidth={2.2} />
                    </Pressable>
                  )}
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Empty State */}
      {displayedNotes.length === 0 && (
        <View className="items-center justify-center py-20 px-4">
          <View className="w-16 h-16 rounded-full bg-light-surface dark:bg-dark-raised border border-light-border dark:border-white/10 items-center justify-center mb-4">
            {activeFilter === 'trash' ? (
              <Trash2 size={24} color={isDark ? '#71717A' : '#A1A1AA'} />
            ) : activeFilter === 'archive' ? (
              <Archive size={24} color={isDark ? '#71717A' : '#A1A1AA'} />
            ) : activeFilter === 'favorites' ? (
              <Star size={24} color={isDark ? '#71717A' : '#A1A1AA'} />
            ) : (
              <Folder size={24} color={isDark ? '#71717A' : '#A1A1AA'} />
            )}
          </View>
          <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary mb-1">
            {activeFilter === 'trash'
              ? 'Trash is empty'
              : activeFilter === 'archive'
              ? 'No archived notes'
              : activeFilter === 'favorites'
              ? 'No favorite notes yet'
              : 'No notes found'}
          </Text>
          <Text className="text-xs text-light-textMuted dark:text-dark-textMuted text-center max-w-xs">
            {activeFilter === 'trash'
              ? 'Deleted notes will appear here before being permanently removed.'
              : activeFilter === 'archive'
              ? 'Archive completed or quiet notes to keep your workspace decluttered.'
              : activeFilter === 'favorites'
              ? 'Tap the star icon on any note to pin it to your favorites.'
              : 'Create a new note or capture a thought above to get started.'}
          </Text>
        </View>
      )}

      {/* Create New Folder Modal */}
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
              className="w-full max-w-sm rounded-3xl border p-6 shadow-2xl"
            >
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-2">
                  <Folder size={18} color="#06B6D4" />
                  <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                    New Folder
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsFolderModalOpen(false)}
                  className="w-7 h-7 rounded-full items-center justify-center hover:bg-black/10 dark:hover:bg-white/10"
                >
                  <X size={16} color={isDark ? '#A1A1AA' : '#71717A'} />
                </Pressable>
              </View>

              <Text className="text-xs text-light-textMuted dark:text-dark-textMuted mb-3">
                Organize your thoughts into custom workspaces or nested paths (e.g. Work/Design or Personal).
              </Text>

              <TextInput
                placeholder="Folder name or path..."
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                value={newFolderName}
                onChangeText={setNewFolderName}
                autoFocus
                onSubmitEditing={handleCreateFolder}
                className="text-sm font-medium text-light-textPrimary dark:text-dark-textPrimary px-3 py-2.5 rounded-xl bg-light-appBg dark:bg-white/5 border border-light-border dark:border-white/10 mb-4"
              />

              <View className="flex-row items-center justify-end gap-2">
                <Pressable
                  onPress={() => setIsFolderModalOpen(false)}
                  className="px-4 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <Text className="text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary">
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleCreateFolder}
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
