import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  Plus,
  Undo2,
  Redo2,
  Quote as QuoteIcon,
  ListTodo,
  Image as ImageIcon,
  ChevronUp,
  ChevronDown,
  Trash2,
} from 'lucide-react-native';
import { BlockType, ChecklistPointStyle } from '../../../types/note';
import { useTheme } from '../../../theme';

interface EditorCommandBarProps {
  isTextFormatApplicable: boolean;
  currentActiveStyle: ChecklistPointStyle | null;
  canUndo: boolean;
  canRedo: boolean;
  hasActiveBlock: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onOpenInsertPalette: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSwitchActiveType: (type: BlockType, metadata?: Record<string, any>) => void;
  onInsertQuickTask: () => void;
  onInsertQuickMedia: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDeleteActiveBlock: () => void;
}

export const EditorCommandBar: React.FC<EditorCommandBarProps> = ({
  isTextFormatApplicable,
  currentActiveStyle,
  canUndo,
  canRedo,
  hasActiveBlock,
  canMoveUp,
  canMoveDown,
  onOpenInsertPalette,
  onUndo,
  onRedo,
  onSwitchActiveType,
  onInsertQuickTask,
  onInsertQuickMedia,
  onMoveUp,
  onMoveDown,
  onDeleteActiveBlock,
}) => {
  const { isDark } = useTheme();

  return (
    <View
      nativeID="scribex-editor-command-bar"
      dataSet={{ scribexToolbar: 'true' }}
      {...({ 'data-scribex-toolbar': 'true' } as any)}
      className="flex-row items-center justify-between px-6 py-2.5 border-b border-light-border/70 dark:border-white/10 bg-light-appBg/95 dark:bg-[#18181A]/95 backdrop-blur-md z-20"
    >
      {/* Left: Primary Insert Element & Undo / Redo Controls */}
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={onOpenInsertPalette}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-light-iconBg dark:bg-white shadow-sm"
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
        >
          <Plus size={13} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2.5} />
          <Text className="text-xs font-bold text-white dark:text-[#111111]">Insert</Text>
        </Pressable>

        <View className="flex-row items-center bg-light-surface dark:bg-dark-raised rounded-full border border-light-border/70 dark:border-white/5 px-1 py-0.5">
          <Pressable
            disabled={!canUndo}
            onPress={onUndo}
            className={`p-1.5 rounded-full ${canUndo ? 'hover:bg-black/5 dark:hover:bg-white/10' : 'opacity-30'}`}
            accessibilityLabel="Undo (Ctrl+Z / Cmd+Z)"
            style={({ pressed }) => (pressed && canUndo ? { transform: [{ scale: 0.9 }] } : undefined)}
          >
            <Undo2 size={13} color={isDark ? '#F7F7F7' : '#171717'} />
          </Pressable>
          <View className="w-[1px] h-3 bg-black/10 dark:bg-white/15 mx-0.5" />
          <Pressable
            disabled={!canRedo}
            onPress={onRedo}
            className={`p-1.5 rounded-full ${canRedo ? 'hover:bg-black/5 dark:hover:bg-white/10' : 'opacity-30'}`}
            accessibilityLabel="Redo (Ctrl+Y / Cmd+Shift+Z)"
            style={({ pressed }) => (pressed && canRedo ? { transform: [{ scale: 0.9 }] } : undefined)}
          >
            <Redo2 size={13} color={isDark ? '#F7F7F7' : '#171717'} />
          </Pressable>
        </View>
      </View>

      {/* Center: Style Switchers */}
      <View
        className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-light-surface dark:bg-dark-raised border border-light-border/70 dark:border-white/5 ${
          isTextFormatApplicable ? 'opacity-100' : 'opacity-40'
        }`}
      >
        <Pressable
          disabled={!isTextFormatApplicable}
          onPress={() => onSwitchActiveType('paragraph')}
          className={`px-2.5 py-1 rounded-full ${
            currentActiveStyle === 'paragraph'
              ? 'bg-light-appBg dark:bg-white/15'
              : isTextFormatApplicable
              ? 'hover:bg-black/5 dark:hover:bg-white/10'
              : ''
          }`}
          style={({ pressed }) =>
            pressed && isTextFormatApplicable ? { transform: [{ scale: 0.95 }] } : undefined
          }
          accessibilityLabel={isTextFormatApplicable ? 'Normal Text' : 'Text styling not applicable'}
        >
          <Text
            className={`text-xs ${
              currentActiveStyle === 'paragraph'
                ? 'font-bold text-light-textPrimary dark:text-white'
                : 'font-semibold text-light-textSecondary dark:text-dark-textSecondary'
            }`}
          >
            Text
          </Text>
        </Pressable>

        <Pressable
          disabled={!isTextFormatApplicable}
          onPress={() => onSwitchActiveType('heading', { level: 1 })}
          className={`px-2.5 py-1 rounded-full ${
            currentActiveStyle === 'h1'
              ? 'bg-light-appBg dark:bg-white/15'
              : isTextFormatApplicable
              ? 'hover:bg-black/5 dark:hover:bg-white/10'
              : ''
          }`}
          style={({ pressed }) =>
            pressed && isTextFormatApplicable ? { transform: [{ scale: 0.95 }] } : undefined
          }
          accessibilityLabel={isTextFormatApplicable ? 'Heading 1' : 'Text styling not applicable'}
        >
          <Text
            className={`text-xs ${
              currentActiveStyle === 'h1'
                ? 'font-black text-light-textPrimary dark:text-white'
                : 'font-black text-light-textPrimary dark:text-dark-textPrimary opacity-70'
            }`}
          >
            H1
          </Text>
        </Pressable>

        <Pressable
          disabled={!isTextFormatApplicable}
          onPress={() => onSwitchActiveType('heading', { level: 2 })}
          className={`px-2.5 py-1 rounded-full ${
            currentActiveStyle === 'h2'
              ? 'bg-light-appBg dark:bg-white/15'
              : isTextFormatApplicable
              ? 'hover:bg-black/5 dark:hover:bg-white/10'
              : ''
          }`}
          style={({ pressed }) =>
            pressed && isTextFormatApplicable ? { transform: [{ scale: 0.95 }] } : undefined
          }
          accessibilityLabel={isTextFormatApplicable ? 'Heading 2' : 'Text styling not applicable'}
        >
          <Text
            className={`text-xs ${
              currentActiveStyle === 'h2'
                ? 'font-bold text-light-textPrimary dark:text-white'
                : 'font-bold text-light-textPrimary dark:text-dark-textPrimary opacity-70'
            }`}
          >
            H2
          </Text>
        </Pressable>

        <Pressable
          disabled={!isTextFormatApplicable}
          onPress={() => onSwitchActiveType('quote')}
          className={`p-1 rounded-full ${
            currentActiveStyle === 'quote'
              ? 'bg-light-appBg dark:bg-white/15'
              : isTextFormatApplicable
              ? 'hover:bg-black/5 dark:hover:bg-white/10'
              : ''
          }`}
          style={({ pressed }) =>
            pressed && isTextFormatApplicable ? { transform: [{ scale: 0.95 }] } : undefined
          }
          accessibilityLabel={isTextFormatApplicable ? 'Quote' : 'Text styling not applicable'}
        >
          <QuoteIcon
            size={13}
            color={
              currentActiveStyle === 'quote'
                ? isDark
                  ? '#F7F7F7'
                  : '#171717'
                : isDark
                ? '#B5B5B5'
                : '#626262'
            }
          />
        </Pressable>
      </View>

      {/* Right: Quick Task, Media, and Block Reorder/Delete */}
      <View className="flex-row items-center gap-1.5">
        {/* Quick Task Button */}
        <Pressable
          onPress={onInsertQuickTask}
          className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-light-surface dark:bg-dark-raised border border-light-border/70 dark:border-white/5"
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
          accessibilityLabel="Add Task Checklist"
        >
          <ListTodo size={12} color={isDark ? '#6EE7B7' : '#059669'} />
          <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
            Task
          </Text>
        </Pressable>

        <Pressable
          onPress={onInsertQuickMedia}
          className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-light-surface dark:bg-dark-raised border border-light-border/70 dark:border-white/5"
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
          accessibilityLabel="Add Image"
        >
          <ImageIcon size={12} color={isDark ? '#38BDF8' : '#0284C7'} />
          <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
            Media
          </Text>
        </Pressable>

        {hasActiveBlock && (
          <>
            <View className="w-[1px] h-4 bg-black/10 dark:bg-white/15 mx-0.5" />
            <Pressable
              disabled={!canMoveUp}
              onPress={onMoveUp}
              className={`p-1 rounded-full ${canMoveUp ? 'hover:bg-black/5 dark:hover:bg-white/10' : 'opacity-30'}`}
              style={({ pressed }) => (pressed && canMoveUp ? { transform: [{ scale: 0.9 }] } : undefined)}
              accessibilityLabel="Move Up"
            >
              <ChevronUp size={13} color={isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>
            <Pressable
              disabled={!canMoveDown}
              onPress={onMoveDown}
              className={`p-1 rounded-full ${canMoveDown ? 'hover:bg-black/5 dark:hover:bg-white/10' : 'opacity-30'}`}
              style={({ pressed }) => (pressed && canMoveDown ? { transform: [{ scale: 0.9 }] } : undefined)}
              accessibilityLabel="Move Down"
            >
              <ChevronDown size={13} color={isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>
            <Pressable
              onPress={onDeleteActiveBlock}
              className="p-1 rounded-full hover:bg-red-500/20"
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
              accessibilityLabel="Delete Block"
            >
              <Trash2 size={13} color="#EF4444" />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
};

