import React, { useRef } from 'react';
import { View, TextInput } from 'react-native';
import { ComposableBlock } from '../../../../types/note';
import { useTheme } from '../../../../theme';
import { useWebTextareaAutoHeight } from '../../hooks/useWebTextareaAutoHeight';

interface ParagraphBlockProps {
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
}

export const ParagraphBlock: React.FC<ParagraphBlockProps> = ({
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
}) => {
  const { isDark } = useTheme();
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const { localInputRef, setInputRef, adjustWebTextareaHeight } = useWebTextareaAutoHeight({
    content: block.content,
    externalInputRef: inputRef,
  });

  return (
    <View
      className="pl-2.5 border-l-2"
      style={{ borderLeftColor: isActive && !isDragging ? '#06B6D4' : 'transparent' }}
    >
      <TextInput
        ref={setInputRef}
        multiline
        scrollEnabled={false}
        placeholder="Start typing your story or use floating dock below..."
        placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
        value={block.content}
        onChangeText={(text) => {
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
            // Pressing Enter on an empty line (Double Enter) splits into a new block.
            // A single Enter naturally inserts a cohesive newline (\n) within the same paragraph!
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
        className="text-base font-normal leading-relaxed text-light-textPrimary dark:text-dark-textPrimary py-0.5 outline-none"
      />
    </View>
  );
};

