import React, { useRef } from 'react';
import { View, TextInput } from 'react-native';
import { ComposableBlock, BlockType } from '../../../../types/note';
import { useTheme } from '../../../../theme';
import { useWebTextareaAutoHeight } from '../../hooks/useWebTextareaAutoHeight';

interface QuoteBlockProps {
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

export const QuoteBlock: React.FC<QuoteBlockProps> = ({
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
    if (text.startsWith('# ')) {
      onConvertBlock('heading', text.slice(2), { level: 1 });
      return true;
    }
    if (text.startsWith('## ')) {
      onConvertBlock('heading', text.slice(3), { level: 2 });
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
      className="pl-4 border-l-4 py-1 my-1"
      style={{
        borderLeftColor:
          isActive && !isDragging
            ? '#06B6D4'
            : isDark
            ? '#B4A7D6'
            : '#9B87F5',
      }}
    >
      <TextInput
        ref={setInputRef}
        multiline
        scrollEnabled={false}
        placeholder="Quote or reference text..."
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
          if (key === 'Backspace') {
            if (selectionRef.current.start === 0 && selectionRef.current.end === 0) {
              e.preventDefault?.();
              onBackspaceAtStart?.();
            }
          } else if (key === 'Enter') {
            const curPos = selectionRef.current.start;
            const textBefore = block.content.slice(0, curPos);
            if (textBefore.endsWith('\n') || (block.content === '' && curPos === 0)) {
              e.preventDefault?.();
              const cleanedBefore = textBefore.endsWith('\n') ? textBefore.slice(0, -1) : textBefore;
              onUpdateContent(cleanedBefore + block.content.slice(curPos));
              onSplitBlock?.(cleanedBefore.length);
            }
          }
        }}
        className="text-base md:text-lg italic text-light-textSecondary dark:text-dark-textSecondary leading-relaxed py-0 outline-none"
      />
    </View>
  );
};

