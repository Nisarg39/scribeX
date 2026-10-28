import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ArrowLeft, Check, Pin, Star, Trash2 } from 'lucide-react-native';
import { useTheme, NoteColors, NoteColorToken } from '../../../theme';

export const PASTEL_PALETTE: NoteColorToken[] = [
  'lime',
  'apricot',
  'cyan',
  'coral',
  'lavender',
  'pink',
  'sky',
];

export const COLOR_BG_CLASSES: Partial<Record<NoteColorToken, string>> = {
  lime: 'bg-note-lime',
  apricot: 'bg-note-apricot',
  cyan: 'bg-note-cyan',
  coral: 'bg-note-coral',
  lavender: 'bg-note-lavender',
  pink: 'bg-note-pink',
  sky: 'bg-note-sky',
};

interface EditorHeaderProps {
  colorToken: NoteColorToken;
  isPinned: boolean;
  isFavorite: boolean;
  onClose: () => void;
  onColorChange: (color: NoteColorToken) => void;
  onTogglePin: () => void;
  onToggleFavorite: () => void;
  onDeleteNote: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  colorToken,
  isPinned,
  isFavorite,
  onClose,
  onColorChange,
  onTogglePin,
  onToggleFavorite,
  onDeleteNote,
}) => {
  const { isDark } = useTheme();

  return (
    <View
      nativeID="scribex-editor-header"
      dataSet={{ scribexToolbar: 'true' }}
      {...({ 'data-scribex-toolbar': 'true' } as any)}
      className="flex-row items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border z-10 bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-md"
    >
      {/* Back Button */}
      <Pressable
        onPress={onClose}
        accessibilityLabel="Back to notes"
        className="w-10 h-10 rounded-full bg-light-appBg dark:bg-dark-raised items-center justify-center shadow-sm"
        style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
      >
        <ArrowLeft size={18} color={isDark ? '#F7F7F7' : '#171717'} strokeWidth={2.2} />
      </Pressable>

      {/* Pastel Color Swatches */}
      <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/5 shrink-0">
        {PASTEL_PALETTE.map((color) => {
          const isSelected = colorToken === color;
          return (
            <Pressable
              key={color}
              onPress={() => onColorChange(color)}
              accessibilityLabel={`Color ${color}`}
              style={({ pressed }) => [
                { backgroundColor: NoteColors[color] },
                pressed ? { transform: [{ scale: 0.9 }] } : undefined,
              ]}
              className={`w-6 h-6 rounded-full items-center justify-center shrink-0 ${COLOR_BG_CLASSES[color] || ''} ${
                isSelected ? 'border-2 border-black dark:border-white scale-110' : ''
              }`}
            >
              {isSelected && <Check size={12} color="#191919" strokeWidth={3} />}
            </Pressable>
          );
        })}
      </View>

      {/* Right Action Icons: Pin, Favorite, Delete, Done */}
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={onTogglePin}
          accessibilityLabel="Toggle Pin"
          className="w-9 h-9 rounded-full items-center justify-center hover:bg-black/5 dark:hover:bg-white/5"
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
        >
          <Pin
            size={17}
            color={isPinned ? '#FFC96F' : isDark ? '#B5B5B5' : '#626262'}
            fill={isPinned ? '#FFC96F' : 'transparent'}
          />
        </Pressable>

        <Pressable
          onPress={onToggleFavorite}
          accessibilityLabel="Toggle Favorite"
          className="w-9 h-9 rounded-full items-center justify-center hover:bg-black/5 dark:hover:bg-white/5"
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
        >
          <Star
            size={18}
            color={isFavorite ? '#FFD43B' : isDark ? '#B5B5B5' : '#626262'}
            fill={isFavorite ? '#FFD43B' : 'transparent'}
          />
        </Pressable>

        <Pressable
          onPress={onDeleteNote}
          accessibilityLabel="Delete Note"
          className="w-9 h-9 rounded-full items-center justify-center hover:bg-red-500/10"
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
        >
          <Trash2 size={17} color="#EF4444" />
        </Pressable>

        <Pressable
          onPress={onClose}
          accessibilityLabel="Done"
          className="px-4 py-1.5 rounded-full bg-light-iconBg dark:bg-white items-center justify-center ml-1 shadow-sm"
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
        >
          <Text className="text-xs font-bold text-white dark:text-[#111111]">Done</Text>
        </Pressable>
      </View>
    </View>
  );
};

