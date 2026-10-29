import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Platform } from 'react-native';
import { useTheme } from '../../../theme';
import { Plus, Trash2 } from 'lucide-react-native';

export interface NumberedListItem {
  id: string;
  text: string;
}

interface NumberedListBlockProps {
  items?: NumberedListItem[] | string[];
  content?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
  onUpdateItems?: (items: NumberedListItem[]) => void;
  onUpdateContent?: (content: string) => void;
}

export const NumberedListBlock: React.FC<NumberedListBlockProps> = ({
  items,
  content = '',
  isSelected = false,
  isDragging = false,
  onFocus,
  onLongPress,
  onStartDrag,
  onEndDrag,
  onDelete,
  onUpdateItems,
  onUpdateContent,
}) => {
  const { isDark } = useTheme();
  const inputRefs = useRef<{ [id: string]: any }>({});
  const [focusTargetId, setFocusTargetId] = useState<string | null>(null);

  // Normalize initial items from items prop or multiline content string
  const listItems: NumberedListItem[] = React.useMemo(() => {
    if (Array.isArray(items) && items.length > 0) {
      return items.map((it, idx) =>
        typeof it === 'string'
          ? { id: `num-${idx}-${it.slice(0, 10)}`, text: it }
          : it
      );
    }
    if (content && content.trim()) {
      return content.split('\n').map((line, idx) => ({
        id: `num-${idx}-${Date.now()}`,
        text: line.replace(/^\d+[\.\)]\s*/, ''),
      }));
    }
    return [{ id: `num-1-${Date.now()}`, text: '' }];
  }, [items, content]);

  // Adjust auto-height for web textareas
  const adjustWebTextareaHeight = (el: any) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const domEl = el && el.tagName === 'TEXTAREA' ? el : el?.querySelector?.('textarea') || el;
    if (!domEl || !domEl.style) return;

    try {
      (domEl.style as any).fieldSizing = 'content';
      domEl.style.overflow = 'hidden';
      domEl.style.resize = 'none';
      if ('rows' in domEl) {
        domEl.rows = 1;
      }
      domEl.style.height = 'auto';
      const scrollH = domEl.scrollHeight;
      if (scrollH > 0) {
        domEl.style.height = `${scrollH}px`;
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (focusTargetId && inputRefs.current[focusTargetId]) {
      const target = inputRefs.current[focusTargetId];
      target.focus?.();
      adjustWebTextareaHeight(target);
      setFocusTargetId(null);
    }
  }, [focusTargetId]);

  const handleCommitItems = (next: NumberedListItem[]) => {
    if (onUpdateItems) {
      onUpdateItems(next);
    }
    if (onUpdateContent) {
      onUpdateContent(next.map((i, idx) => `${idx + 1}. ${i.text}`).join('\n'));
    }
  };

  const handleTextChange = (text: string, index: number) => {
    const next = listItems.map((item, i) => (i === index ? { ...item, text } : item));
    handleCommitItems(next);
  };

  const handleAddItem = (afterIndex: number) => {
    onFocus?.();
    const newId = `num-${Date.now()}-${listItems.length + 1}`;
    const next = [
      ...listItems.slice(0, afterIndex + 1),
      { id: newId, text: '' },
      ...listItems.slice(afterIndex + 1),
    ];
    setFocusTargetId(newId);
    handleCommitItems(next);
  };

  const handleDeleteItem = (index: number) => {
    onFocus?.();
    if (listItems.length <= 1) {
      if (onDelete) {
        onDelete();
      } else {
        handleCommitItems([{ id: listItems[0].id, text: '' }]);
      }
      return;
    }
    const prevItem = listItems[Math.max(0, index - 1)];
    if (prevItem) {
      setFocusTargetId(prevItem.id);
    }
    const next = listItems.filter((_, i) => i !== index);
    handleCommitItems(next);
  };

  const handleKeyPress = (e: any, index: number) => {
    const key = e?.nativeEvent?.key;
    const currentItem = listItems[index];

    if (key === 'Enter' && !e?.nativeEvent?.shiftKey) {
      e?.preventDefault?.();
      handleAddItem(index);
    } else if (key === 'Backspace' && currentItem.text === '') {
      e?.preventDefault?.();
      handleDeleteItem(index);
    }
  };

  return (
    <Pressable
      onPress={onFocus}
      style={[
        {
          borderColor: isSelected
            ? '#06B6D4'
            : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'),
          borderLeftWidth: 3,
          borderLeftColor: isSelected ? '#06B6D4' : 'transparent',
        },
      ]}
      className="my-1 w-full pl-2 pr-1 py-1 transition-all group"
    >
      {listItems.map((item, index) => (
        <View key={item.id} className="flex-row items-start mb-1 relative group/item">
          {/* Sequential Number Label */}
          <View className="w-6 h-6 items-end justify-center flex-shrink-0 mr-2.5">
            <Text className="font-mono text-sm font-semibold text-light-textMuted dark:text-dark-textMuted">
              {index + 1}.
            </Text>
          </View>

          {/* Text Input */}
          <TextInput
            ref={(ref) => {
              inputRefs.current[item.id] = ref;
              adjustWebTextareaHeight(ref);
            }}
            value={item.text}
            onChangeText={(text) => handleTextChange(text, index)}
            onFocus={() => {
              onFocus?.();
              adjustWebTextareaHeight(inputRefs.current[item.id]);
            }}
            onKeyPress={(e) => handleKeyPress(e, index)}
            placeholder="Step description..."
            placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
            multiline
            className="flex-1 text-base text-light-textPrimary dark:text-dark-textPrimary leading-6 py-0 font-normal outline-none"
            style={{
              fontFamily: Platform.OS === 'web' ? 'inherit' : undefined,
            }}
          />

          {/* Quick Delete Item on Hover (Web) */}
          {listItems.length > 1 ? (
            <Pressable
              onPress={() => handleDeleteItem(index)}
              className="opacity-0 group-hover/item:opacity-40 hover:!opacity-100 p-1 rounded ml-1 transition-opacity"
              accessibilityLabel="Delete item"
            >
              <Trash2 size={12} color={isDark ? '#FF6B6B' : '#DC2626'} />
            </Pressable>
          ) : null}
        </View>
      ))}

      {/* Subtle Add Step Link on Selection */}
      {Boolean(isSelected) ? (
        <Pressable
          onPress={() => handleAddItem(listItems.length - 1)}
          className="flex-row items-center gap-1.5 ml-8 mt-1 py-0.5 opacity-60 hover:opacity-100"
        >
          <Plus size={11} color={isDark ? '#8EDCEB' : '#08C4E5'} />
          <Text className="text-xs font-semibold text-note-cyan">
            Add step
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
};

