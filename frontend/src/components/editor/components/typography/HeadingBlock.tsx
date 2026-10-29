import React, { useRef } from 'react';
import { View, TextInput } from 'react-native';
import { ComposableBlock, BlockType } from '../../../../types/note';
import { useTheme } from '../../../../theme';
import { useWebTextareaAutoHeight } from '../../hooks/useWebTextareaAutoHeight';

interface HeadingBlockProps {
  block: ComposableBlock;
  isActive?: boolean;
  isDragging?: boolean;
  inputRef?: (el: any) => void;
  focusSelection?: { start: number; end: number };
  onClearFocusTarget?: () => void;
  onSplitBlock?: (splitPosition: number) => void;
  onBackspaceAtStart?: () => void;
  onFocus?: () => void;
  onUpdateContent: (content: string) => void;
  onConvertBlock?: (type: BlockType, content: string, metadata?: Record<string, any>) => void;
}

export const HeadingBlock: React.FC<HeadingBlockProps> = ({
  block,
  isActive,
  isDragging,
  inputRef,
  focusSelection,
  onClearFocusTarget,
  onSplitBlock,
  onBackspaceAtStart,
  onFocus,
  onUpdateContent,
  onConvertBlock,
}) => {
  const { isDark } = useTheme();
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const { localInputRef, setInputRef, adjustWebTextareaHeight } = useWebTextareaAutoHeight({
    content: block.content,
    externalInputRef: inputRef,
  });

  const checkMarkdownShortcuts = (text: string): boolean => {
    if (!onConvertBlock) return false;
    if (text.startsWith('# ') && block.metadata?.level !== 1) {
      onConvertBlock('heading', text.slice(2), { level: 1 });
      return true;
    }
    if (text.startsWith('## ') && block.metadata?.level !== 2) {
      onConvertBlock('heading', text.slice(3), { level: 2 });
      return true;
    }
    if (text.startsWith('### ') && block.metadata?.level !== 3) {
      onConvertBlock('heading', text.slice(4), { level: 3 });
      return true;
    }
    if (text.startsWith('> ')) {
      onConvertBlock('quote', text.slice(2));
      return true;
    }
    if (text.startsWith('- ') || text.startsWith('* ')) {
      onConvertBlock('bulleted_list', text.slice(2), {
        items: [{ id: `bullet-${Date.now()}-1`, text: text.slice(2) }],
      });
      return true;
    }
    return false;
  };

  return (
    <View
      className="pl-2.5 border-l-2"
      style={{ borderLeftColor: isActive && !isDragging ? '#06B6D4' : 'transparent' }}
    >
      <TextInput
        ref={setInputRef}
        multiline
        scrollEnabled={false}
        placeholder={`Heading ${block.metadata?.level || 1}...`}
        placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
        value={block.content}
        onChangeText={(text) => {
          if (checkMarkdownShortcuts(text)) {
            return;
          }
          onUpdateContent(text);
          adjustWebTextareaHeight(localInputRef.current);
        }}
        onFocus={() => {
          onFocus?.();
          adjustWebTextareaHeight(localInputRef.current);
        }}
        selection={focusSelection}
        onSelectionChange={(e) => {
          selectionRef.current = e.nativeEvent.selection;
          if (focusSelection) onClearFocusTarget?.();
        }}
        onKeyPress={(e: any) => {
          const key = e.nativeEvent.key;
          if (key === 'Enter' && !e.shiftKey) {
            e.preventDefault?.();
            onSplitBlock?.(selectionRef.current.start);
          } else if (key === 'Backspace') {
            if (selectionRef.current.start === 0 && selectionRef.current.end === 0) {
              e.preventDefault?.();
              onBackspaceAtStart?.();
            }
          }
        }}
        onSubmitEditing={() => onSplitBlock?.(selectionRef.current.start)}
        className={`font-extrabold text-light-textPrimary dark:text-dark-textPrimary tracking-tight py-1 outline-none ${
          block.metadata?.level === 1
            ? 'text-2xl md:text-3xl mt-4 mb-1'
            : block.metadata?.level === 2
            ? 'text-xl md:text-2xl mt-3 mb-1'
            : 'text-lg md:text-xl mt-2 mb-0.5'
        }`}
      />
    </View>
  );
};

