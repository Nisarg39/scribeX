import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, NoteColors } from '../../../theme';
import { useNotesStore } from '../../../state/useNotesStore';
import { FileText, ArrowUpRight, Link2, Search, X } from 'lucide-react-native';

interface NoteLinkBlockProps {
  targetNoteId?: string;
  targetNoteTitle?: string;
  targetColorToken?: string;
  targetFolder?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
  onUpdateLink?: (targetNoteId: string, targetNoteTitle: string, targetColorToken?: string, targetFolder?: string) => void;
}

export const NoteLinkBlock: React.FC<NoteLinkBlockProps> = ({
  targetNoteId,
  targetNoteTitle,
  targetColorToken = 'cyan',
  targetFolder = 'General',
  isSelected = false,
  isDragging = false,
  onFocus,
  onLongPress,
  onStartDrag,
  onEndDrag,
  onDelete,
  onUpdateLink,
}) => {
  const router = useRouter();
  const { isDark } = useTheme();
  const { notes } = useNotesStore();
  const [isPickerOpen, setIsPickerOpen] = useState(!targetNoteId);
  const [searchQuery, setSearchQuery] = useState('');

  // Find linked note from store if available
  const linkedNote = notes.find((n) => n.id === targetNoteId);
  const displayTitle = linkedNote?.title || targetNoteTitle || 'Untitled Note Link';
  const displayColor = (NoteColors as any)[linkedNote?.colorToken || targetColorToken] || NoteColors.cyan;
  const displayFolder = linkedNote?.folderPath || targetFolder;

  const handleNavigate = () => {
    if (targetNoteId) {
      router.push(`/note/${targetNoteId}`);
    }
  };

  const handleSelectNote = (n: any) => {
    onUpdateLink?.(n.id, n.title, n.colorToken, n.folderPath);
    setIsPickerOpen(false);
  };

  const filteredNotes = notes.filter((n) =>
    (n.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Pressable
      onPress={onFocus}
      style={[
        {
          borderColor: isSelected
            ? '#06B6D4'
            : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)',
        },
      ]}
      className="my-1.5 w-full rounded-2xl border p-3 transition-all group"
    >
      {isPickerOpen ? (
        <View className="w-full">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-1.5">
              <Link2 size={13} color="#06B6D4" />
              <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                Link to Another Note
              </Text>
            </View>
            {Boolean(targetNoteId) ? (
              <Pressable onPress={() => setIsPickerOpen(false)} className="p-1">
                <X size={13} color={isDark ? '#B5B5B5' : '#626262'} />
              </Pressable>
            ) : null}
          </View>

          {/* Note Search Input */}
          <View className="flex-row items-center gap-2 p-2 rounded-xl bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10 mb-2">
            <Search size={13} color={isDark ? '#858585' : '#929292'} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={onFocus}
              placeholder="Search existing notes in your vault..."
              placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
              className="flex-1 text-xs text-light-textPrimary dark:text-dark-textPrimary py-0"
              autoFocus
            />
          </View>

          {/* Quick List of Available Notes */}
          <ScrollView className="max-h-48" showsVerticalScrollIndicator={false}>
            {filteredNotes.slice(0, 6).map((n) => {
              const noteColor = (NoteColors as any)[n.colorToken] || NoteColors.cyan;
              return (
                <Pressable
                  key={n.id}
                  onPress={() => handleSelectNote(n)}
                  className="flex-row items-center justify-between p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10"
                >
                  <View className="flex-row items-center gap-2 flex-1 mr-2">
                    <View style={{ backgroundColor: noteColor }} className="w-2.5 h-2.5 rounded-full" />
                    <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary" numberOfLines={1}>
                      {n.title || 'Untitled Note'}
                    </Text>
                  </View>
                  <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                    {n.folderPath || 'General'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        /* Rendered Bidirectional Link Capsule */
        <View className="flex-row items-center justify-between w-full">
          {/* Left Info: Swatch, Icon & Note Title */}
          <Pressable
            onPress={handleNavigate}
            className="flex-row items-center gap-3 flex-1 mr-3 group/link"
          >
            {/* Color-accented icon container */}
            <View
              style={{ backgroundColor: `${displayColor}20` }}
              className="w-9 h-9 rounded-xl items-center justify-center flex-shrink-0"
            >
              <FileText size={16} color={displayColor} />
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text
                  numberOfLines={1}
                  className="text-xs md:text-sm font-bold text-light-textPrimary dark:text-dark-textPrimary group-hover/link:underline"
                >
                  {displayTitle}
                </Text>
                <ArrowUpRight size={13} color={isDark ? '#8EDCEB' : '#08C4E5'} />
              </View>

              <View className="flex-row items-center gap-2 mt-0.5">
                <Text className="text-[10px] font-bold text-light-textMuted dark:text-dark-textMuted uppercase tracking-wider">
                  Linked Note
                </Text>
                <View className="w-1 h-1 rounded-full bg-light-textMuted dark:bg-dark-textMuted opacity-40" />
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  {displayFolder}
                </Text>
              </View>
            </View>
          </Pressable>

          {/* Right Action: Re-link / Edit Button */}
          <Pressable
            onPress={() => {
              onFocus?.();
              setIsPickerOpen(true);
            }}
            className="px-2.5 py-1 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10 hover:border-note-cyan/40"
          >
            <Text className="text-[10px] font-semibold text-light-textSecondary dark:text-dark-textSecondary">
              Change Note
            </Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
};

