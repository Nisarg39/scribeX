import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useTheme, NoteColors } from '../theme';
import { useNotesStore } from '../state/useNotesStore';
import { 
  Star, 
  Pencil, 
  Mic, 
  Paperclip, 
  ArrowUp, 
  Folder,
  Tag as TagIcon
} from 'lucide-react-native';

export const NotesView: React.FC = () => {
  const { isDark } = useTheme();
  const { notes, activeFilter, setActiveFilter, addNote, toggleFavorite } = useNotesStore();
  const [quickThought, setQuickThought] = useState('');

  const handleQuickCapture = () => {
    if (!quickThought.trim()) return;
    // Extract title from first line / sentence
    const parts = quickThought.trim().split('\n');
    const title = parts[0].slice(0, 48);
    const content = quickThought.trim();
    addNote(title, content);
    setQuickThought('');
  };

  // Filter notes based on active filter
  const filteredNotes = notes.filter((n) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'favorites') return n.isFavorite;
    return n.folderPath === activeFilter || n.tags.includes(activeFilter);
  });

  return (
    <ScrollView 
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Editorial Page Heading */}
      <View className="mb-6">
        <Text className="text-4xl md:text-5xl font-extrabold text-light-textPrimary dark:text-dark-textPrimary tracking-tight">
          Notes
        </Text>
        <Text className="text-xs md:text-sm font-medium text-light-textSecondary dark:text-dark-textSecondary mt-1">
          Tuesday, Oct 27 • {notes.length} thoughts & captures
        </Text>
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

      {/* Context & Filter Pills Track */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="flex-row gap-2 mb-8 -mx-1 px-1"
      >
        <Pressable
          onPress={() => setActiveFilter('all')}
          className={`px-4 py-1.5 rounded-full border transition-all ${
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
        </Pressable>

        <Pressable
          onPress={() => setActiveFilter('favorites')}
          className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${
            activeFilter === 'favorites'
              ? 'bg-light-iconBg dark:bg-white border-transparent'
              : 'bg-transparent border-light-border dark:border-dark-border'
          }`}
        >
          <Star size={12} color={activeFilter === 'favorites' ? '#FFD43B' : (isDark ? '#B5B5B5' : '#626262')} fill={activeFilter === 'favorites' ? '#FFD43B' : 'transparent'} />
          <Text className={`text-xs font-semibold ${
            activeFilter === 'favorites'
              ? 'text-white dark:text-[#111111]'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
          }`}>
            Favorites
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveFilter('Work/Projects/ScribeX')}
          className={`px-4 py-1.5 rounded-full border transition-all ${
            activeFilter === 'Work/Projects/ScribeX'
              ? 'bg-light-iconBg dark:bg-white border-transparent'
              : 'bg-transparent border-light-border dark:border-dark-border'
          }`}
        >
          <Text className={`text-xs font-semibold ${
            activeFilter === 'Work/Projects/ScribeX'
              ? 'text-white dark:text-[#111111]'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
          }`}>
            Work/Projects/ScribeX
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveFilter('General')}
          className={`px-4 py-1.5 rounded-full border transition-all ${
            activeFilter === 'General'
              ? 'bg-light-iconBg dark:bg-white border-transparent'
              : 'bg-transparent border-light-border dark:border-dark-border'
          }`}
        >
          <Text className={`text-xs font-semibold ${
            activeFilter === 'General'
              ? 'text-white dark:text-[#111111]'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
          }`}>
            General
          </Text>
        </Pressable>
      </ScrollView>

      {/* The Vivid Pastel Note Tiles Grid */}
      <View className="flex-row flex-wrap -mx-2.5">
        {filteredNotes.map((note) => {
          const pastelHex = NoteColors[note.colorToken] || '#FFC96F';

          return (
            <View 
              key={note.id}
              className="w-full sm:w-1/2 lg:w-1/3 p-2.5"
            >
              <View 
                style={{ backgroundColor: pastelHex }}
                className="p-6 rounded-[22px] min-h-[220px] justify-between shadow-sm active:scale-[0.99] transition-transform"
              >
                {/* Top Row: Folder Badge & Favorite Star */}
                <View className="flex-row items-center justify-between mb-3">
                  <View className="px-2.5 py-1 rounded-full bg-black/10">
                    <Text className="text-[11px] font-semibold text-[#191919] tracking-tight">
                      {note.folderPath || 'General'}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => toggleFavorite(note.id)}
                    accessibilityLabel="Toggle Favorite"
                    className="w-8 h-8 rounded-full items-center justify-center active:scale-90"
                  >
                    <Star 
                      size={18} 
                      color={note.isFavorite ? '#FFD43B' : 'rgba(25, 25, 25, 0.4)'} 
                      fill={note.isFavorite ? '#FFD43B' : 'transparent'} 
                      strokeWidth={2}
                    />
                  </Pressable>
                </View>

                {/* Note Title & Body (Strictly dark #191919 text for high contrast) */}
                <View className="flex-1 mb-4">
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

                {/* Bottom Row: Timestamp & Circular Edit Button */}
                <View className="flex-row items-center justify-between pt-2">
                  <Text className="text-xs font-medium text-[#191919]/60">
                    {note.createdAt}
                  </Text>

                  <Pressable
                    accessibilityLabel="Edit Note"
                    className="w-9 h-9 rounded-full bg-[#111111] items-center justify-center active:scale-95 shadow-sm"
                  >
                    <Pencil size={15} color="#FFFFFF" strokeWidth={2.2} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};
