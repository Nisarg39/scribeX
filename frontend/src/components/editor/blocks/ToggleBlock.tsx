import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Platform } from 'react-native';
import { useTheme } from '../../../theme';
import { ChevronRight, ChevronDown, ListCollapse } from 'lucide-react-native';

interface ToggleBlockProps {
  title?: string;
  content?: string;
  isOpen?: boolean;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
  onUpdateTitle?: (title: string) => void;
  onUpdateContent?: (content: string) => void;
  onUpdateIsOpen?: (isOpen: boolean) => void;
}

export const ToggleBlock: React.FC<ToggleBlockProps> = ({
  title = '',
  content = '',
  isOpen = false,
  isSelected = false,
  isDragging = false,
  onFocus,
  onLongPress,
  onStartDrag,
  onEndDrag,
  onDelete,
  onUpdateTitle,
  onUpdateContent,
  onUpdateIsOpen,
}) => {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(isOpen);
  const titleInputRef = useRef<any>(null);
  const contentInputRef = useRef<any>(null);

  const toggleOpen = () => {
    onFocus?.();
    const next = !open;
    setOpen(next);
    onUpdateIsOpen?.(next);
  };

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
    adjustWebTextareaHeight(titleInputRef.current);
  }, [title]);

  useEffect(() => {
    if (open) {
      adjustWebTextareaHeight(contentInputRef.current);
    }
  }, [open, content]);

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
      className="my-1.5 w-full pl-2 pr-1 py-1 transition-all group"
    >
      {/* Header Row: Toggle Icon + Summary Title */}
      <View className="flex-row items-start">
        {/* Toggle Chevron */}
        <Pressable
          onPress={toggleOpen}
          style={({ pressed }) => pressed ? { transform: [{ scale: 0.9 }] } : undefined}
          className="w-6 h-7 items-center justify-center mr-1 rounded hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 flex-shrink-0"
          accessibilityLabel={open ? 'Collapse toggle section' : 'Expand toggle section'}
        >
          {open ? (
            <ChevronDown size={17} color={isDark ? '#F7F7F7' : '#171717'} />
          ) : (
            <ChevronRight size={17} color={isDark ? '#B5B5B5' : '#626262'} />
          )}
        </Pressable>

        {/* Title Input */}
        <TextInput
          ref={(ref) => {
            titleInputRef.current = ref;
            adjustWebTextareaHeight(ref);
          }}
          value={title}
          onChangeText={(text) => onUpdateTitle?.(text)}
          onFocus={() => {
            onFocus?.();
            adjustWebTextareaHeight(titleInputRef.current);
          }}
          placeholder="Toggle title..."
          placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
          className="flex-1 text-base font-bold text-light-textPrimary dark:text-dark-textPrimary leading-6 py-0 outline-none"
          style={{
            fontFamily: Platform.OS === 'web' ? 'inherit' : undefined,
          }}
        />

        {/* Floating Indicator Badge when selected */}
        {Boolean(isSelected) ? (
          <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-note-cyan/20 ml-2">
            <ListCollapse size={10} color="#06B6D4" />
            <Text className="text-[10px] font-bold text-note-cyan">
              Toggle
            </Text>
          </View>
        ) : null}
      </View>

      {/* Expanded Body Content */}
      {Boolean(open) ? (
        <View className="ml-3 pl-3.5 my-1.5 border-l-2 border-note-cyan/40 dark:border-note-cyan/30">
          <TextInput
            ref={(ref) => {
              contentInputRef.current = ref;
              adjustWebTextareaHeight(ref);
            }}
            value={content}
            onChangeText={(text) => onUpdateContent?.(text)}
            onFocus={() => {
              onFocus?.();
              adjustWebTextareaHeight(contentInputRef.current);
            }}
            placeholder="Type hidden details, notes, or explanations..."
            placeholderTextColor={isDark ? '#525252' : '#B0B0B0'}
            multiline
            className="text-sm md:text-base text-light-textSecondary dark:text-dark-textSecondary leading-relaxed py-0 outline-none"
            style={{
              fontFamily: Platform.OS === 'web' ? 'inherit' : undefined,
            }}
          />
        </View>
      ) : null}
    </Pressable>
  );
};

