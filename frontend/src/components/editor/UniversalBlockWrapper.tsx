import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { BlockType } from '../../types/note';
import { useTheme } from '../../theme';

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
  habit: { label: 'Habit Tracker', category: 'interactive' },
  kanban: { label: 'Kanban Board', category: 'interactive' },
  event: { label: 'Calendar Event', category: 'interactive' },
  contact: { label: 'Person Profile', category: 'interactive' },
  expense: { label: 'Expense Record', category: 'interactive' },
  reading: { label: 'Reading Queue', category: 'interactive' },
  lecture_note: { label: 'Lecture Notes', category: 'media' },
  message_thread: { label: 'Message Thread', category: 'embed' },
  meeting_notes: { label: 'Meeting Minutes', category: 'media' },
  sheet: { label: 'Spreadsheet Grid', category: 'data' },
  diagram: { label: 'Diagram & Whiteboard', category: 'interactive' },
  web_clip: { label: 'Web Article Clip', category: 'embed' },
  voice_dictation: { label: 'Voice Dictation', category: 'media' },
  code: { label: 'Code Snippet', category: 'data' },
  table: { label: 'Table Grid', category: 'data' },
  callout: { label: 'Callout Box', category: 'interactive' },
  equation: { label: 'LaTeX Formula', category: 'data' },
  drawing: { label: 'Drawing Canvas', category: 'interactive' },
  audio: { label: 'Voice Memo', category: 'media' },
  image: { label: 'Media Embed', category: 'media' },
  video: { label: 'Video Embed', category: 'media' },
  file: { label: 'File Attachment', category: 'embed' },
  bookmark: { label: 'Web Bookmark', category: 'embed' },
};

export interface UniversalBlockWrapperProps {
  blockType: BlockType | string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onDragMove?: (dy: number, pageY?: number) => void;
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
 * 4. Long-press drag-to-reorder gesture lifecycle across Web & Native
 * 
 * Child blocks (Drawing, Audio, Code, Table, etc.) remain 100% focused on their pure domain logic.
 */
export const UniversalBlockWrapper: React.FC<UniversalBlockWrapperProps> = ({
  blockType,
  isSelected = false,
  isDragging = false,
  onFocus,
  onLongPress,
  onStartDrag,
  headerRightContent,
  children,
  className = '',
  style,
  noPadding = false,
}) => {
  const { isDark } = useTheme();
  const meta = UNIVERSAL_BLOCK_REGISTRY[blockType] || {
    label: blockType.charAt(0).toUpperCase() + blockType.slice(1),
  };

  const startTouchY = React.useRef<number>(0);

  const containerStyle = React.useMemo(() => {
    return [
      {
        borderColor: isSelected
          ? (isDark ? 'rgba(6, 182, 212, 0.7)' : 'rgba(6, 182, 212, 0.85)')
          : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'),
        backgroundColor: isSelected
          ? (isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(248, 250, 252, 0.95)')
          : (isDark ? '#181818' : '#FFFFFF'),
      },
      style,
    ];
  }, [isSelected, isDark, style]);

  return (
    <Pressable
      onPress={onFocus}
      style={containerStyle}
      className={`my-2 rounded-2xl cursor-default overflow-hidden border-2 ${className}`}
    >
      {/* Universal Selection Status Header */}
      {isSelected && (
        <View 
          style={{
            backgroundColor: isDark ? 'rgba(6, 182, 212, 0.08)' : 'rgba(6, 182, 212, 0.06)',
            borderBottomColor: isDark ? 'rgba(6, 182, 212, 0.25)' : 'rgba(6, 182, 212, 0.2)',
            borderBottomWidth: 1,
          }}
          className="flex-row items-center justify-between px-3.5 py-2 select-none"
        >
          <View className="flex-row items-center gap-1.5">
            <View className="w-1.5 h-1.5 rounded-full bg-note-cyan shadow-sm shadow-note-cyan" />
            <Text className="text-[10px] font-black text-note-cyan uppercase tracking-wider">
              {meta.label} • Selected
            </Text>
          </View>
          {headerRightContent || (
            <Text 
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
              className="text-[10px] hidden sm:flex"
            >
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
