import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ArrowLeft, Check, Pin, Star, Trash2, Download, Upload, FileText, Archive } from 'lucide-react-native';
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
  isArchived?: boolean;
  onClose: () => void;
  onColorChange: (color: NoteColorToken) => void;
  onTogglePin: () => void;
  onToggleFavorite: () => void;
  onToggleArchive?: () => void;
  onDeleteNote: () => void;
  onExportMarkdown?: () => void;
  onExportJSON?: () => void;
  onImportFile?: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  colorToken,
  isPinned,
  isFavorite,
  isArchived = false,
  onClose,
  onColorChange,
  onTogglePin,
  onToggleFavorite,
  onToggleArchive,
  onDeleteNote,
  onExportMarkdown,
  onExportJSON,
  onImportFile,
}) => {
  const { isDark } = useTheme();
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <View
      nativeID="scribex-editor-header"
      dataSet={{ scribexToolbar: 'true' }}
      {...({ 'data-scribex-toolbar': 'true' } as any)}
      className="flex-row items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border z-10 bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-md relative"
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

      {/* Right Action Icons: Import, Export, Pin, Favorite, Delete, Done */}
      <View className="flex-row items-center gap-2">
        {/* Import File Button */}
        {onImportFile && (
          <Pressable
            onPress={onImportFile}
            accessibilityLabel="Import File (.md, .json, .csv)"
            className="w-9 h-9 rounded-full items-center justify-center hover:bg-black/5 dark:hover:bg-white/5"
            style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
          >
            <Upload size={16} color={isDark ? '#B5B5B5' : '#626262'} />
          </Pressable>
        )}

        {/* Export Menu Toggle */}
        {onExportMarkdown && (
          <View className="relative">
            <Pressable
              onPress={() => setShowExportMenu(!showExportMenu)}
              accessibilityLabel="Export Note"
              className={`w-9 h-9 rounded-full items-center justify-center ${
                showExportMenu ? 'bg-cyan-500/20' : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
            >
              <Download size={16} color={showExportMenu ? NoteColors.cyan : isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>

            {/* Canvas-Native Floating Export Popover */}
            {showExportMenu && (
              <View
                style={{
                  position: 'absolute',
                  top: 44,
                  right: 0,
                  backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  zIndex: 100,
                }}
                className="rounded-2xl border p-1.5 shadow-2xl min-w-[180px]"
              >
                <Pressable
                  onPress={() => {
                    setShowExportMenu(false);
                    onExportMarkdown();
                  }}
                  className="flex-row items-center gap-2 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <FileText size={14} color={NoteColors.cyan} />
                  <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                    Export as Markdown (.md)
                  </Text>
                </Pressable>

                {onExportJSON && (
                  <Pressable
                    onPress={() => {
                      setShowExportMenu(false);
                      onExportJSON();
                    }}
                    className="flex-row items-center gap-2 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <Download size={14} color={NoteColors.lavender} />
                    <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                      Export as JSON (.json)
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}

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

        {onToggleArchive && (
          <Pressable
            onPress={onToggleArchive}
            accessibilityLabel={isArchived ? 'Unarchive Note' : 'Archive Note'}
            className="w-9 h-9 rounded-full items-center justify-center hover:bg-black/5 dark:hover:bg-white/5"
            style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
          >
            <Archive
              size={17}
              color={isArchived ? NoteColors.cyan : isDark ? '#B5B5B5' : '#626262'}
            />
          </Pressable>
        )}

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
