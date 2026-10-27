import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { ComposableBlock, BlockType } from '../../types/note';
import { useTheme, NoteColors } from '../../theme';
import { 
  CheckCircle2, 
  Circle, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Code2, 
  Heading1, 
  Heading2, 
  ListTodo, 
  Quote, 
  Minus,
  AlignLeft
} from 'lucide-react-native';

interface BlockRendererProps {
  block: ComposableBlock;
  index: number;
  totalBlocks: number;
  onUpdateContent: (content: string) => void;
  onUpdateMetadata: (metadata: Record<string, any>) => void;
  onChangeType: (type: BlockType) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  index,
  totalBlocks,
  onUpdateContent,
  onUpdateMetadata,
  onChangeType,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  const { isDark } = useTheme();

  // 1. Divider Block
  if (block.type === 'divider') {
    return (
      <View className="my-4 py-2 group flex-row items-center justify-between">
        <View className="flex-1 h-[1px] bg-light-border dark:bg-dark-border" />
        <Pressable
          onPress={onDelete}
          accessibilityLabel="Delete Divider"
          className="ml-2 w-7 h-7 rounded-full items-center justify-center opacity-40 hover:opacity-100 active:scale-90"
        >
          <Trash2 size={14} color={isDark ? '#B5B5B5' : '#626262'} />
        </Pressable>
      </View>
    );
  }

  return (
    <View className="mb-3 p-3 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border/60 dark:border-dark-border/60 hover:border-light-border dark:hover:border-dark-border transition-colors">
      
      {/* Top Block Control Bar */}
      <View className="flex-row items-center justify-between mb-2 pb-1.5 border-b border-light-border/40 dark:border-dark-border/40">
        
        {/* Type Selector Pills */}
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() => onChangeType('paragraph')}
            className={`p-1.5 rounded-lg ${block.type === 'paragraph' ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
          >
            <AlignLeft size={13} color={block.type === 'paragraph' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => {
              onChangeType('heading');
              onUpdateMetadata({ level: 1 });
            }}
            className={`p-1.5 rounded-lg ${block.type === 'heading' && block.metadata?.level === 1 ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
          >
            <Heading1 size={13} color={block.type === 'heading' && block.metadata?.level === 1 ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => {
              onChangeType('heading');
              onUpdateMetadata({ level: 2 });
            }}
            className={`p-1.5 rounded-lg ${block.type === 'heading' && block.metadata?.level === 2 ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
          >
            <Heading2 size={13} color={block.type === 'heading' && block.metadata?.level === 2 ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => {
              onChangeType('checklist');
              onUpdateMetadata({ checked: false });
            }}
            className={`p-1.5 rounded-lg ${block.type === 'checklist' ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
          >
            <ListTodo size={13} color={block.type === 'checklist' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => onChangeType('code')}
            className={`p-1.5 rounded-lg ${block.type === 'code' ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
          >
            <Code2 size={13} color={block.type === 'code' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => onChangeType('quote')}
            className={`p-1.5 rounded-lg ${block.type === 'quote' ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
          >
            <Quote size={13} color={block.type === 'quote' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>
        </View>

        {/* Right Actions: Reorder & Delete */}
        <View className="flex-row items-center gap-1">
          {index > 0 && onMoveUp && (
            <Pressable
              onPress={onMoveUp}
              accessibilityLabel="Move Block Up"
              className="p-1 rounded-full opacity-50 hover:opacity-100"
            >
              <ChevronUp size={14} color={isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>
          )}

          {index < totalBlocks - 1 && onMoveDown && (
            <Pressable
              onPress={onMoveDown}
              accessibilityLabel="Move Block Down"
              className="p-1 rounded-full opacity-50 hover:opacity-100"
            >
              <ChevronDown size={14} color={isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>
          )}

          <Pressable
            onPress={onDelete}
            accessibilityLabel="Delete Block"
            className="p-1 rounded-full opacity-40 hover:opacity-100 active:scale-90"
          >
            <Trash2 size={14} color={isDark ? '#B5B5B5' : '#626262'} />
          </Pressable>
        </View>
      </View>

      {/* Block Main Editable Content */}
      {/* 2. Heading Block */}
      {block.type === 'heading' && (
        <TextInput
          multiline
          placeholder={`Heading ${block.metadata?.level || 1}...`}
          placeholderTextColor={isDark ? '#858585' : '#929292'}
          value={block.content}
          onChangeText={onUpdateContent}
          className={`font-extrabold text-light-textPrimary dark:text-dark-textPrimary tracking-tight py-1 ${
            block.metadata?.level === 1 ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'
          }`}
        />
      )}

      {/* 3. Checklist Block */}
      {block.type === 'checklist' && (
        <View className="flex-row items-start gap-3 py-1">
          <Pressable
            onPress={() => onUpdateMetadata({ checked: !block.metadata?.checked })}
            className="pt-1 active:scale-90"
          >
            {block.metadata?.checked ? (
              <CheckCircle2 size={19} color={NoteColors.lime} strokeWidth={2.4} />
            ) : (
              <Circle size={19} color={isDark ? '#858585' : '#929292'} strokeWidth={2} />
            )}
          </Pressable>

          <TextInput
            multiline
            placeholder="To-do item..."
            placeholderTextColor={isDark ? '#858585' : '#929292'}
            value={block.content}
            onChangeText={onUpdateContent}
            className={`flex-1 text-base leading-relaxed py-0 text-light-textPrimary dark:text-dark-textPrimary ${
              block.metadata?.checked ? 'line-through text-light-textMuted dark:text-dark-textMuted' : ''
            }`}
          />
        </View>
      )}

      {/* 4. Code Snippet Block */}
      {block.type === 'code' && (
        <View className="p-3 rounded-xl bg-black/5 dark:bg-black/30 border border-light-border dark:border-white/5 font-mono">
          <TextInput
            multiline
            placeholder="// Paste or write code snippet..."
            placeholderTextColor={isDark ? '#858585' : '#929292'}
            value={block.content}
            onChangeText={onUpdateContent}
            className="text-xs md:text-sm font-mono text-light-textPrimary dark:text-dark-textPrimary leading-relaxed py-1"
          />
        </View>
      )}

      {/* 5. Blockquote Block */}
      {block.type === 'quote' && (
        <View className="pl-4 border-l-4 border-note-lavender py-1">
          <TextInput
            multiline
            placeholder="Quote or reference text..."
            placeholderTextColor={isDark ? '#858585' : '#929292'}
            value={block.content}
            onChangeText={onUpdateContent}
            className="text-base italic text-light-textSecondary dark:text-dark-textSecondary leading-relaxed py-0"
          />
        </View>
      )}

      {/* 6. Standard Paragraph Block */}
      {block.type === 'paragraph' && (
        <TextInput
          multiline
          placeholder="Write your thought..."
          placeholderTextColor={isDark ? '#858585' : '#929292'}
          value={block.content}
          onChangeText={onUpdateContent}
          className="text-base font-normal leading-relaxed text-light-textPrimary dark:text-dark-textPrimary py-1 min-h-[44px]"
        />
      )}
    </View>
  );
};
