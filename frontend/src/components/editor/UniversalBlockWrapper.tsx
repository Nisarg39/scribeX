import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { BlockType } from '../../types/note';

export interface UniversalBlockMeta {
  label: string;
  category?: 'media' | 'data' | 'embed' | 'interactive';
}

/**
 * Central registry of all embed / interactive block types.
 * Whenever a new block type is added to ScribeX, register its human-readable label here.
 * The UniversalBlockWrapper automatically applies single-tap selection, focus rings,
 * selection badges, long-press drag-to-reorder, and layout measurement.
 */
export const UNIVERSAL_BLOCK_REGISTRY: Record<string, UniversalBlockMeta> = {
  checklist: { label: 'Checklist Group', category: 'interactive' },
  code: { label: 'Code Snippet', category: 'data' },
  table: { label: 'Table Grid', category: 'data' },
  callout: { label: 'Callout Box', category: 'interactive' },
  equation: { label: 'LaTeX Formula', category: 'data' },
  drawing: { label: 'Drawing Canvas', category: 'interactive' },
  audio: { label: 'Voice Memo', category: 'media' },
  image: { label: 'Media Embed', category: 'media' },
  file: { label: 'File Attachment', category: 'embed' },
  bookmark: { label: 'Web Bookmark', category: 'embed' },
};

export interface UniversalBlockWrapperProps {
  blockType: BlockType | string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onEndDrag?: () => void;
  headerRightContent?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: any;
  noPadding?: boolean;
}

/**
 * UniversalBlockWrapper
 * 
 * High-performance, unified container for all ScribeX embed & interactive blocks.
 * Eliminates repetitive boilerplate by handling cross-cutting concerns centrally:
 * 1. Single-tap selection (onFocus)
 * 2. Visual focus border & ambient glow ring (pastel cyan design tokens)
 * 3. Selection status badge with reorder hint
 * 4. Long-press drag-to-reorder gesture lifecycle
 * 
 * Child blocks (Drawing, Audio, Code, Table, etc.) remain 100% focused on their pure domain logic.
 */
export const UniversalBlockWrapper: React.FC<UniversalBlockWrapperProps> = ({
  blockType,
  isSelected = false,
  isDragging = false,
  onFocus,
  onLongPress,
  onEndDrag,
  headerRightContent,
  children,
  className = '',
  style,
  noPadding = false,
}) => {
  const meta = UNIVERSAL_BLOCK_REGISTRY[blockType] || {
    label: blockType.charAt(0).toUpperCase() + blockType.slice(1),
  };

  return (
    <Pressable
      onPress={onFocus}
      onLongPress={onLongPress}
      delayLongPress={280}
      style={style}
      className={`my-2 rounded-2xl cursor-default overflow-hidden ${
        isSelected
          ? 'bg-light-appBg/90 dark:bg-white/[0.06] border-2 border-note-cyan/80 dark:border-note-cyan/60 shadow-md ring-2 ring-note-cyan/20'
          : 'bg-light-surface dark:bg-[#181818] border border-light-border dark:border-white/10 hover:border-black/20 dark:hover:border-white/20'
      } ${className}`}
    >
      {/* Universal Selection Status Header */}
      {isSelected && (
        <View className="flex-row items-center justify-between px-3.5 py-2 bg-note-cyan/5 border-b border-note-cyan/20 select-none">
          <View className="flex-row items-center gap-1.5">
            <View className="w-1.5 h-1.5 rounded-full bg-note-cyan shadow-sm shadow-note-cyan" />
            <Text className="text-[10px] font-black text-note-cyan uppercase tracking-wider">
              {meta.label} • Selected
            </Text>
          </View>
          {headerRightContent || (
            <Text className="text-[10px] text-light-textSecondary/60 dark:text-dark-textSecondary/60 hidden sm:flex">
              Use ▲ ▼ in top toolbar to move
            </Text>
          )}
        </View>
      )}

      {/* Pure Domain Child Element */}
      <View className={noPadding ? '' : 'p-3'}>
        {children}
      </View>
    </Pressable>
  );
};
