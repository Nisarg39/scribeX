import React, { useRef, useState, useMemo, useEffect } from 'react';
import { View, TextInput } from 'react-native';
import { ComposableBlock, BlockType } from '../../../../types/note';
import { useTheme } from '../../../../theme';
import { useWebTextareaAutoHeight } from '../../hooks/useWebTextareaAutoHeight';
import {
  SlashCommandPalette,
  SLASH_COMMANDS,
  SlashCommandDefinition,
} from '../SlashCommandPalette';

export interface ParsedBlockDef {
  type: BlockType;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Scans multiline text and converts any line starting with markdown shortcut syntax
 * into corresponding ScribeX block definitions. Supports both spaced (# hello, - item)
 * and unspaced (##hello, -item, []todo) triggers.
 */
export function parseMarkdownLines(text: string): ParsedBlockDef[] | null {
  if (!text) return null;
  const lines = text.split('\n');
  let hasMarkdown = false;
  const rawList: ParsedBlockDef[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trimEnd();
    if (!line) {
      rawList.push({ type: 'paragraph', content: '' });
      continue;
    }

    let m: RegExpMatchArray | null = null;

    // 1. Heading 3: ### (with space or immediate word)
    if ((m = line.match(/^###(?:\s+(.*)|([a-zA-Z0-9].*))$/))) {
      hasMarkdown = true;
      const content = m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : '');
      rawList.push({ type: 'heading', content, metadata: { level: 3 } });
    }
    // 2. Heading 2: ## (with space or immediate word)
    else if ((m = line.match(/^##(?:\s+(.*)|([a-zA-Z0-9].*))$/))) {
      hasMarkdown = true;
      const content = m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : '');
      rawList.push({ type: 'heading', content, metadata: { level: 2 } });
    }
    // 3. Heading 1: # (with space or immediate word)
    else if ((m = line.match(/^#(?:\s+(.*)|([a-zA-Z0-9].*))$/))) {
      hasMarkdown = true;
      const content = m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : '');
      rawList.push({ type: 'heading', content, metadata: { level: 1 } });
    }
    // 4. Quote: > (with space or immediate word)
    else if ((m = line.match(/^>(?:\s+(.*)|([a-zA-Z0-9].*))$/))) {
      hasMarkdown = true;
      const content = m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : '');
      rawList.push({ type: 'quote', content });
    }
    // 5. Bulleted List: - or * or • (with space or immediate word)
    else if ((m = line.match(/^[-*•](?:\s+(.*)|([a-zA-Z].*))$/))) {
      hasMarkdown = true;
      const itemText = m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : '');
      rawList.push({
        type: 'bulleted_list',
        content: itemText,
        metadata: { items: [{ id: `bullet-${Date.now()}-${idx}`, text: itemText }] },
      });
    }
    // 6. Numbered List: 1. (with space or immediate word)
    else if ((m = line.match(/^(\d+)\.(?:\s+(.*)|([a-zA-Z0-9].*))$/))) {
      hasMarkdown = true;
      const itemText = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : '');
      rawList.push({
        type: 'numbered_list',
        content: itemText,
        metadata: { items: [{ id: `num-${Date.now()}-${idx}`, text: itemText }] },
      });
    }
    // 7. Checklist: [ ] or [] or [x] or [X] (with or without space)
    else if ((m = line.match(/^\[([ xX]?)\](?:\s+(.*)|(.*))$/))) {
      hasMarkdown = true;
      const isChecked = m[1].toLowerCase() === 'x';
      const itemText = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : '');
      rawList.push({
        type: 'checklist',
        content: itemText,
        metadata: {
          items: [
            {
              id: `task-${Date.now()}-${idx}`,
              text: itemText,
              checked: isChecked,
              priority: 'none',
              dueDate: 'Today',
              style: 'paragraph',
            },
          ],
        },
      });
    }
    // 8. Divider: --- or ___ or ***
    else if (/^---+$|^___+$|^\*\*\*+$/.test(line)) {
      hasMarkdown = true;
      rawList.push({ type: 'divider', content: '' });
    }
    // 9. Code block: ```
    else if (line.startsWith('```')) {
      hasMarkdown = true;
      const lang = line.slice(3).trim() || 'typescript';
      rawList.push({ type: 'code', content: '', metadata: { language: lang, fileName: '' } });
    }
    // 10. Equation: $$
    else if (line.startsWith('$$')) {
      hasMarkdown = true;
      rawList.push({ type: 'equation', content: '', metadata: { displayMode: true } });
    }
    // 11. Callout: >> (with space or immediate word)
    else if ((m = line.match(/^>>(?:\s+(.*)|(.*))$/))) {
      hasMarkdown = true;
      const text = m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : '');
      rawList.push({ type: 'callout', content: text, metadata: { variant: 'info' } });
    }
    // Standard paragraph line
    else {
      rawList.push({ type: 'paragraph', content: line });
    }
  }

  if (!hasMarkdown) return null;

  // Merge consecutive list / checklist / paragraph items together cleanly
  const merged: ParsedBlockDef[] = [];
  for (const block of rawList) {
    const prev = merged[merged.length - 1];
    if (prev && prev.type === 'bulleted_list' && block.type === 'bulleted_list') {
      prev.metadata = {
        items: [...(prev.metadata?.items || []), ...(block.metadata?.items || [])],
      };
      prev.content = `${prev.content}\n${block.content}`;
    } else if (prev && prev.type === 'numbered_list' && block.type === 'numbered_list') {
      prev.metadata = {
        items: [...(prev.metadata?.items || []), ...(block.metadata?.items || [])],
      };
      prev.content = `${prev.content}\n${block.content}`;
    } else if (prev && prev.type === 'checklist' && block.type === 'checklist') {
      prev.metadata = {
        items: [...(prev.metadata?.items || []), ...(block.metadata?.items || [])],
      };
      prev.content = `${prev.content}\n${block.content}`;
    } else if (prev && prev.type === 'paragraph' && block.type === 'paragraph') {
      prev.content = prev.content ? `${prev.content}\n${block.content}` : block.content;
    } else {
      merged.push({ ...block });
    }
  }

  // Filter out empty paragraphs if there are other converted blocks
  const filtered = merged.filter((b) => b.type !== 'paragraph' || b.content.trim() !== '');
  return filtered.length > 0 ? filtered : merged;
}

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
  onConvertBlock?: (type: BlockType, content: string, metadata?: Record<string, any>) => void;
  onInsertAfter?: (type: BlockType, content: string, metadata?: Record<string, any>) => void;
  onReplaceBlockWithBlocks?: (blocks: ParsedBlockDef[]) => void;
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
  onConvertBlock,
  onInsertAfter,
  onReplaceBlockWithBlocks,
}) => {
  const { isDark } = useTheme();
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const { localInputRef, setInputRef, adjustWebTextareaHeight } = useWebTextareaAutoHeight({
    content: block.content,
    externalInputRef: inputRef,
  });

  // Slash Command Detection: Active when '/' is typed at start or after whitespace/newline
  const slashIndex = block.content.lastIndexOf('/');
  const isSlashAtStartOrAfterSpace =
    slashIndex === 0 ||
    (slashIndex > 0 &&
      (block.content[slashIndex - 1] === ' ' || block.content[slashIndex - 1] === '\n'));
  const isSlashActive =
    Boolean(isActive) &&
    isSlashAtStartOrAfterSpace &&
    !block.content.slice(slashIndex).includes('\n');
  const slashQuery = isSlashActive ? block.content.slice(slashIndex + 1).toLowerCase() : '';

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter available commands based on user search after '/'
  const filteredCommands = useMemo(() => {
    const clean = slashQuery.trim().toLowerCase();
    if (!clean) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter((cmd) => {
      return (
        cmd.title.toLowerCase().includes(clean) ||
        cmd.shortcut.toLowerCase().includes(clean) ||
        cmd.category.toLowerCase().includes(clean) ||
        cmd.keywords.some((k) => k.toLowerCase().includes(clean))
      );
    });
  }, [slashQuery]);

  // Reset keyboard highlight whenever search query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [slashQuery]);

  const handleExecuteCommand = (cmd: SlashCommandDefinition) => {
    const textBefore = block.content.slice(0, slashIndex).trimEnd();
    const textAfter = block.content.slice(slashIndex + slashQuery.length + 1).trimStart();
    if (textBefore.length === 0) {
      // Entire block converts into the chosen block
      onConvertBlock?.(cmd.blockType, '', cmd.defaultMetadata);
      if (textAfter.length > 0) {
        onInsertAfter?.('paragraph', textAfter);
      }
    } else {
      // Retain text before slash in current paragraph, insert chosen block right below
      onUpdateContent(textBefore);
      onInsertAfter?.(cmd.blockType, '', cmd.defaultMetadata);
      if (textAfter.length > 0) {
        onInsertAfter?.('paragraph', textAfter);
      }
    }
  };

  /**
   * Evaluates text for markdown shortcut patterns.
   * If any line matches, splits/converts the paragraph into the appropriate blocks.
   */
  const processMarkdownShortcuts = (text: string): boolean => {
    if (!onReplaceBlockWithBlocks) return false;
    const parsed = parseMarkdownLines(text);
    if (parsed && parsed.length > 0) {
      onReplaceBlockWithBlocks(parsed);
      return true;
    }
    return false;
  };

  // Convert on mount or when block content contains markdown syntax
  useEffect(() => {
    if (block.content) {
      processMarkdownShortcuts(block.content);
    }
  }, []);

  return (
    <View
      className="pl-2.5 border-l-2 relative"
      style={{ borderLeftColor: isActive && !isDragging ? '#06B6D4' : 'transparent' }}
    >
      <TextInput
        ref={setInputRef}
        multiline
        scrollEnabled={false}
        placeholder="Type '/' for commands or start writing with markdown (#, -, 1., [])..."
        placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
        value={block.content}
        onChangeText={(text) => {
          // Check for instant markdown shortcut conversions across all lines
          if (processMarkdownShortcuts(text)) {
            return;
          }
          onUpdateContent(text);
          adjustWebTextareaHeight(localInputRef.current);
        }}
        onFocus={() => {
          onFocus?.();
          adjustWebTextareaHeight(localInputRef.current);
          // If block already has unparsed markdown lines, convert on focus
          processMarkdownShortcuts(block.content);
        }}
        selection={focusSelection}
        onSelectionChange={(e) => {
          selectionRef.current = e.nativeEvent.selection;
          if (focusSelection) onClearFocusTarget?.();
        }}
        onKeyPress={(e: any) => {
          const key = e.nativeEvent.key;

          // Keyboard navigation for active Slash Command Palette
          if (isSlashActive && filteredCommands.length > 0) {
            if (key === 'ArrowDown') {
              e.preventDefault?.();
              setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
              return;
            }
            if (key === 'ArrowUp') {
              e.preventDefault?.();
              setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
              return;
            }
            if (key === 'Enter') {
              e.preventDefault?.();
              handleExecuteCommand(filteredCommands[selectedIndex]);
              return;
            }
            if (key === 'Escape') {
              e.preventDefault?.();
              const textBefore = block.content.slice(0, slashIndex);
              const textAfter = block.content.slice(slashIndex + 1);
              onUpdateContent(textBefore + textAfter);
              return;
            }
          }

          // Backspace at start merges with previous block
          if (key === 'Backspace') {
            if (selectionRef.current.start === 0 && selectionRef.current.end === 0) {
              e.preventDefault?.();
              onBackspaceAtStart?.();
            }
          }
          // Single Enter (Return) splits into a new block!
          // Shift + Enter inserts a soft newline (\n) inside the same paragraph.
          else if (key === 'Enter' && !e.shiftKey) {
            e.preventDefault?.();
            const curPos = selectionRef.current.start;
            if (!processMarkdownShortcuts(block.content)) {
              onSplitBlock?.(curPos);
            }
          }
        }}
        className="text-base font-normal leading-relaxed text-light-textPrimary dark:text-dark-textPrimary py-0.5 outline-none"
      />

      {/* Floating Inline Slash Command Palette */}
      {Boolean(isSlashActive) ? (
        <SlashCommandPalette
          query={slashQuery}
          selectedIndex={selectedIndex}
          onSelect={handleExecuteCommand}
          onHoverIndex={setSelectedIndex}
        />
      ) : null}
    </View>
  );
};
