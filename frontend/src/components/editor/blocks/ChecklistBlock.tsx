import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Platform } from 'react-native';
import { useTheme, NoteColors } from '../../../theme';
import { TaskPriority, ChecklistPoint, ChecklistPointStyle } from '../../../types/note';
import { 
  CheckCircle2, 
  Circle, 
  Calendar, 
  Trash2, 
  Plus,
  ChevronUp,
  ChevronDown,
  Type
} from 'lucide-react-native';

interface ChecklistBlockProps {
  items?: ChecklistPoint[];
  isSelected?: boolean;
  activeItemId?: string | null;
  onFocusItem?: (itemId: string) => void;
  // Legacy props fallback
  content?: string;
  checked?: boolean;
  taskId?: string;
  priority?: TaskPriority;
  dueDate?: string;
  onUpdateContent?: (content: string) => void;
  onToggleCheck?: (checked: boolean) => void;
  onUpdatePriority?: (priority: TaskPriority) => void;
  onUpdateDueDate?: (dueDate: string) => void;

  onUpdateItems?: (items: ChecklistPoint[]) => void;
  onFocus?: () => void;
  onLongPress?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onDragMove?: (dy: number, pageY?: number) => void;
  onEndDrag?: () => void;
  isDragging?: boolean;
  onBackspaceAtStart?: () => void;
  onDelete?: () => void;
}

const PRIORITY_ORDER: TaskPriority[] = ['none', 'low', 'medium', 'high', 'urgent'];

const PRIORITY_COLORS: Record<TaskPriority, { color: string; label: string }> = {
  none: { color: '#858585', label: 'None' },
  low: { color: NoteColors.sky, label: 'Low' },
  medium: { color: NoteColors.apricot, label: 'Med' },
  high: { color: NoteColors.coral, label: 'High' },
  urgent: { color: '#EF4444', label: 'Urgent' },
};

export const ChecklistBlock: React.FC<ChecklistBlockProps> = ({
  items,
  isSelected = false,
  isDragging = false,
  activeItemId,
  onFocusItem,
  content,
  checked = false,
  taskId,
  priority = 'none',
  dueDate = 'Today',
  onUpdateItems,
  onUpdateContent,
  onToggleCheck,
  onFocus,
  onLongPress,
  onStartDrag,
  onDragMove,
  onEndDrag,
  onBackspaceAtStart,
  onDelete,
}) => {
  const { isDark } = useTheme();
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const inputRefs = useRef<{ [id: string]: any }>({});
  const startTouchY = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  isDraggingRef.current = isDragging;

  const adjustWebTextareaHeight = (el: any) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const domEl = (el && el.tagName === 'TEXTAREA') ? el : el?.querySelector?.('textarea') || el;
    if (!domEl || !domEl.style) return;

    const apply = () => {
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
      } catch (err) {
        // ignore
      }
    };

    apply();
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(apply);
    }
  };

  const setInputRef = (id: string, el: any) => {
    inputRefs.current[id] = el;
    if (el) {
      adjustWebTextareaHeight(el);
    }
  };

  // Normalize items to ensure a checklist container array
  const checklistItems: ChecklistPoint[] = Array.isArray(items) && items.length > 0
    ? items.map(it => ({ ...it, style: it.style || 'paragraph' }))
    : [{
        id: taskId || `task-${Date.now()}-1`,
        text: content || '',
        checked: checked,
        priority: priority || 'none',
        dueDate: dueDate || 'Today',
        style: 'paragraph',
      }];

  const handleCommitItems = (nextItems: ChecklistPoint[]) => {
    if (onUpdateItems) {
      onUpdateItems(nextItems);
    } else if (onUpdateContent && nextItems.length > 0) {
      // Legacy fallback
      onUpdateContent(nextItems[0].text);
      if (onToggleCheck) onToggleCheck(nextItems[0].checked);
    }
  };

  const handleToggleItem = (index: number) => {
    onFocus?.();
    const next = checklistItems.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    );
    handleCommitItems(next);
  };

  const handleUpdateItemText = (index: number, text: string) => {
    const next = checklistItems.map((item, i) =>
      i === index ? { ...item, text } : item
    );
    handleCommitItems(next);
  };

  const handleCyclePriority = (index: number) => {
    onFocus?.();
    const item = checklistItems[index];
    const currentIdx = PRIORITY_ORDER.indexOf(item.priority || 'none');
    const nextPriority = PRIORITY_ORDER[(currentIdx + 1) % PRIORITY_ORDER.length];
    const next = checklistItems.map((it, i) =>
      i === index ? { ...it, priority: nextPriority } : it
    );
    handleCommitItems(next);
  };

  const handleCycleDueDate = (index: number) => {
    onFocus?.();
    const item = checklistItems[index];
    const nextDue = item.dueDate === 'Today' ? 'Tomorrow' : item.dueDate === 'Tomorrow' ? 'This Week' : 'Today';
    const next = checklistItems.map((it, i) =>
      i === index ? { ...it, dueDate: nextDue } : it
    );
    handleCommitItems(next);
  };

  const handleCycleStyle = (index: number) => {
    onFocus?.();
    const item = checklistItems[index];
    onFocusItem?.(item.id);
    const order: ChecklistPointStyle[] = ['paragraph', 'h1', 'h2', 'quote'];
    const currentStyle = item.style || 'paragraph';
    const nextStyle = order[(order.indexOf(currentStyle) + 1) % order.length];
    const next = checklistItems.map((it, i) =>
      i === index ? { ...it, style: nextStyle } : it
    );
    handleCommitItems(next);
  };

  const handleAddItem = (afterIndex?: number) => {
    onFocus?.();
    const newId = `task-${Date.now()}-${checklistItems.length + 1}`;
    setNewlyAddedId(newId);
    onFocusItem?.(newId);
    const newPoint: ChecklistPoint = {
      id: newId,
      text: '',
      checked: false,
      priority: 'none',
      dueDate: 'Today',
      style: 'paragraph',
    };

    let next: ChecklistPoint[];
    if (afterIndex !== undefined) {
      next = [
        ...checklistItems.slice(0, afterIndex + 1),
        newPoint,
        ...checklistItems.slice(afterIndex + 1),
      ];
    } else {
      next = [...checklistItems, newPoint];
    }
    handleCommitItems(next);
  };

  const handleMoveItemUp = (index: number) => {
    if (index <= 0) return;
    onFocus?.();
    const next = [...checklistItems];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    handleCommitItems(next);
  };

  const handleMoveItemDown = (index: number) => {
    if (index >= checklistItems.length - 1) return;
    onFocus?.();
    const next = [...checklistItems];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    handleCommitItems(next);
  };

  const handleDeleteItem = (index: number) => {
    onFocus?.();
    if (checklistItems.length <= 1) {
      if (onDelete) {
        onDelete();
      } else {
        handleCommitItems([{ ...checklistItems[0], text: '', checked: false }]);
      }
      return;
    }
    const next = checklistItems.filter((_, i) => i !== index);
    handleCommitItems(next);
  };

  const completedCount = checklistItems.filter((i) => i.checked).length;

  return (
    <View
      className={`py-3 my-2 rounded-2xl cursor-default ${
        isSelected
          ? 'bg-light-appBg/90 dark:bg-white/[0.06] border-2 border-note-cyan/80 dark:border-note-cyan/60'
          : 'bg-black/[0.02] dark:bg-white/[0.02] border-2 border-transparent hover:border-black/10 dark:hover:border-white/10'
      } px-2.5 md:px-3.5`}
    >
      {/* Container Header Badge */}
      <Pressable
        onPress={onFocus}
        onPressIn={(e) => {
          startTouchY.current = e?.nativeEvent?.pageY || 0;
        }}
        onLongPress={(e) => {
          const pageY = e?.nativeEvent?.pageY ?? startTouchY.current;
          if (onStartDrag) onStartDrag(pageY);
          else onLongPress?.();
        }}
        delayLongPress={280}
        className="flex-row items-center justify-between mb-2.5 px-1 cursor-pointer select-none"
        accessibilityRole="button"
        accessibilityLabel="Select checklist group"
      >
        <View className="flex-row items-center gap-2">
          <View
            className={`w-2 h-2 rounded-full ${
              isSelected ? 'bg-note-cyan shadow-sm shadow-note-cyan' : 'bg-light-textMuted dark:bg-dark-textMuted'
            }`}
          />
          <Text
            className={`text-[11px] uppercase tracking-wider ${
              isSelected ? 'text-note-cyan dark:text-note-cyan font-black' : 'text-light-textMuted dark:text-dark-textMuted font-bold'
            }`}
          >
            Checklist Group {isSelected ? '• Selected' : ''}
          </Text>
          <View className="px-2 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/60 dark:border-white/5">
            <Text className="text-[10px] font-semibold text-light-textSecondary dark:text-dark-textSecondary">
              {completedCount} of {checklistItems.length} completed
            </Text>
          </View>
        </View>

        {isSelected ? (
          <Text className="text-[10px] font-medium text-note-cyan opacity-90 hidden sm:flex">
            Use ▲ ▼ in top toolbar to move unit
          </Text>
        ) : (
          <Text className="text-[10px] font-medium text-light-textMuted dark:text-dark-textMuted opacity-60 hidden sm:flex">
            Click to select group
          </Text>
        )}
      </Pressable>

      {/* Stream of Checkpoints inside this Container */}
      <View className="space-y-1">
        {checklistItems.map((item, idx) => {
          const priorityConf = PRIORITY_COLORS[item.priority || 'none'] || PRIORITY_COLORS.none;
          const itemStyle: ChecklistPointStyle = item.style || 'paragraph';

          // Checkbox vertical alignment depending on typography
          const checkboxPt = itemStyle === 'h1' ? 'pt-2.5' : itemStyle === 'h2' ? 'pt-2' : 'pt-1';

          // Typography configuration based on paragraph / h1 / h2 / quote
          let inputTypography = 'text-base md:text-lg text-light-textPrimary dark:text-dark-textPrimary leading-relaxed py-0.5 outline-none';
          let placeholder = 'Checklist point... (Press Enter to add next)';

          if (itemStyle === 'h1') {
            inputTypography = 'font-black text-2xl md:text-3xl tracking-tight text-light-textPrimary dark:text-dark-textPrimary py-0.5 outline-none';
            placeholder = 'Heading 1 checkpoint...';
          } else if (itemStyle === 'h2') {
            inputTypography = 'font-extrabold text-xl md:text-2xl tracking-tight text-light-textPrimary dark:text-dark-textPrimary py-0.5 outline-none';
            placeholder = 'Heading 2 checkpoint...';
          } else if (itemStyle === 'quote') {
            inputTypography = 'italic text-base md:text-lg text-light-textSecondary dark:text-dark-textSecondary leading-relaxed py-0.5 outline-none';
            placeholder = 'Quote checkpoint...';
          }

          const isItemChecked = !!item.checked;

          return (
            <View key={item.id || idx} className="flex-row items-start gap-3 py-1.5 group">
              {/* Checkbox Toggle */}
              <Pressable
                onPress={() => handleToggleItem(idx)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isItemChecked }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className={checkboxPt}
                style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.9 : 1 }] })}
              >
                {isItemChecked ? (
                  <CheckCircle2 key="checked-circle" size={itemStyle === 'h1' ? 22 : 19} color={NoteColors.lime} strokeWidth={2.4} />
                ) : (
                  <Circle key="unchecked-circle" size={itemStyle === 'h1' ? 22 : 19} color={isDark ? '#858585' : '#929292'} strokeWidth={2} />
                )}
              </Pressable>

              {/* Text Input & Meta Chips */}
              <View className="flex-1">
                {itemStyle === 'quote' ? (
                  <View className="pl-3 border-l-2 border-note-lavender dark:border-note-lavender/60 my-0.5">
                    <TextInput
                      ref={(el) => setInputRef(item.id, el)}
                      autoFocus={item.id === newlyAddedId}
                      multiline
                      scrollEnabled={false}
                      placeholder={placeholder}
                      placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
                      value={item.text}
                      onChangeText={(text) => {
                        if (newlyAddedId === item.id) setNewlyAddedId(null);
                        handleUpdateItemText(idx, text);
                        adjustWebTextareaHeight(inputRefs.current[item.id]);
                      }}
                      onFocus={() => {
                        onFocus?.();
                        onFocusItem?.(item.id);
                        adjustWebTextareaHeight(inputRefs.current[item.id]);
                      }}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onKeyPress={(e: any) => {
                        if (e.nativeEvent.key === 'Enter') {
                          e.preventDefault?.();
                          handleAddItem(idx);
                        } else if (e.nativeEvent.key === 'Backspace' && item.text === '') {
                          if (item.style && item.style !== 'paragraph') {
                            e.preventDefault?.();
                            const next = checklistItems.map((it, i) =>
                              i === idx ? { ...it, style: 'paragraph' as ChecklistPointStyle } : it
                            );
                            handleCommitItems(next);
                          } else if (checklistItems.length > 1) {
                            e.preventDefault?.();
                            handleDeleteItem(idx);
                          } else if (checklistItems.length === 1) {
                            e.preventDefault?.();
                            onBackspaceAtStart?.();
                          }
                        }
                      }}
                      onSubmitEditing={() => handleAddItem(idx)}
                      style={{
                        textDecorationLine: isItemChecked ? 'line-through' : 'none',
                        opacity: isItemChecked ? 0.6 : 1,
                      }}
                      className={`${inputTypography} ${isItemChecked ? 'text-light-textMuted dark:text-dark-textMuted' : ''}`}
                    />
                  </View>
                ) : (
                  <TextInput
                    ref={(el) => setInputRef(item.id, el)}
                    autoFocus={item.id === newlyAddedId}
                    multiline
                    scrollEnabled={false}
                    placeholder={placeholder}
                    placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
                    value={item.text}
                    onChangeText={(text) => {
                      if (newlyAddedId === item.id) setNewlyAddedId(null);
                      handleUpdateItemText(idx, text);
                      adjustWebTextareaHeight(inputRefs.current[item.id]);
                    }}
                    onFocus={() => {
                      onFocus?.();
                      onFocusItem?.(item.id);
                      adjustWebTextareaHeight(inputRefs.current[item.id]);
                    }}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onKeyPress={(e: any) => {
                      if (e.nativeEvent.key === 'Enter') {
                        e.preventDefault?.();
                        handleAddItem(idx);
                      } else if (e.nativeEvent.key === 'Backspace' && item.text === '') {
                        if (item.style && item.style !== 'paragraph') {
                          e.preventDefault?.();
                          const next = checklistItems.map((it, i) =>
                            i === idx ? { ...it, style: 'paragraph' as ChecklistPointStyle } : it
                          );
                          handleCommitItems(next);
                        } else if (checklistItems.length > 1) {
                          e.preventDefault?.();
                          handleDeleteItem(idx);
                        } else if (checklistItems.length === 1) {
                          e.preventDefault?.();
                          onBackspaceAtStart?.();
                        }
                      }
                    }}
                    onSubmitEditing={() => handleAddItem(idx)}
                    style={{
                      textDecorationLine: isItemChecked ? 'line-through' : 'none',
                      opacity: isItemChecked ? 0.6 : 1,
                    }}
                    className={`${inputTypography} ${isItemChecked ? 'text-light-textMuted dark:text-dark-textMuted' : ''}`}
                  />
                )}

                {/* Priority & Due Date Chips, Style Chip, and Point Reorder/Delete */}
                <View className="flex-row items-center gap-2 mt-1.5 flex-wrap justify-between">
                  {/* Left: Priority, Due Date, and Style Pills */}
                  <View className="flex-row items-center gap-2">
                    {/* Style Pill (Text, H1, H2, Quote) */}
                    <Pressable
                      onPress={() => handleCycleStyle(idx)}
                      className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full border ${
                        itemStyle !== 'paragraph'
                          ? 'shadow-sm'
                          : 'bg-light-appBg dark:bg-dark-raised border-light-border/60 dark:border-white/5'
                      }`}
                      style={({ pressed }) => [
                        itemStyle !== 'paragraph'
                          ? {
                              backgroundColor: isDark ? 'rgba(8, 196, 229, 0.18)' : 'rgba(8, 196, 229, 0.12)',
                              borderColor: isDark ? 'rgba(8, 196, 229, 0.45)' : 'rgba(8, 196, 229, 0.35)',
                            }
                          : undefined,
                        pressed ? { transform: [{ scale: 0.95 }] } : undefined,
                      ]}
                      accessibilityLabel="Cycle Checkpoint Style"
                    >
                      <Type size={10} color={itemStyle !== 'paragraph' ? (isDark ? '#67E8F9' : '#0891B2') : (isDark ? '#858585' : '#929292')} />
                      <Text
                        className={`text-[10px] uppercase tracking-wider ${
                          itemStyle !== 'paragraph'
                            ? 'font-black text-note-cyan dark:text-note-cyan'
                            : 'font-semibold text-light-textSecondary dark:text-dark-textSecondary'
                        }`}
                      >
                        {itemStyle === 'h1' ? 'H1' : itemStyle === 'h2' ? 'H2' : itemStyle === 'quote' ? 'Quote' : 'Text'}
                      </Text>
                    </Pressable>
                    {/* Priority Pill */}
                    <Pressable
                      onPress={() => handleCyclePriority(idx)}
                      className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/60 dark:border-white/5"
                      style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
                      accessibilityLabel="Cycle Priority"
                    >
                      <View
                        style={{ backgroundColor: priorityConf.color }}
                        className="w-1.5 h-1.5 rounded-full"
                      />
                      <Text
                        style={{ color: item.priority && item.priority !== 'none' ? priorityConf.color : (isDark ? '#858585' : '#929292') }}
                        className="text-[10px] font-bold uppercase tracking-wider"
                      >
                        {priorityConf.label}
                      </Text>
                    </Pressable>

                    {/* Due Date Chip */}
                    <Pressable
                      onPress={() => handleCycleDueDate(idx)}
                      className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/60 dark:border-white/5"
                      style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
                      accessibilityLabel="Change Due Date"
                    >
                      <Calendar size={10} color={isDark ? '#858585' : '#929292'} />
                      <Text className="text-[10px] font-semibold text-light-textSecondary dark:text-dark-textSecondary">
                        {item.dueDate || 'Today'}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Right: Point Reorder (Up/Down) & Delete Controls */}
                  <View className="flex-row items-center gap-0.5">
                    {/* Move Up */}
                    <Pressable
                      onPress={() => handleMoveItemUp(idx)}
                      disabled={idx === 0}
                      className={`p-1 rounded-full ${
                        idx === 0
                          ? 'opacity-20'
                          : 'opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
                      }`}
                      style={({ pressed }) => pressed ? { transform: [{ scale: 0.9 }] } : undefined}
                      accessibilityLabel="Move checkpoint up"
                    >
                      <ChevronUp size={14} color={isDark ? '#B5B5B5' : '#626262'} strokeWidth={2.2} />
                    </Pressable>

                    {/* Move Down */}
                    <Pressable
                      onPress={() => handleMoveItemDown(idx)}
                      disabled={idx === checklistItems.length - 1}
                      className={`p-1 rounded-full ${
                        idx === checklistItems.length - 1
                          ? 'opacity-20'
                          : 'opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
                      }`}
                      style={({ pressed }) => pressed ? { transform: [{ scale: 0.9 }] } : undefined}
                      accessibilityLabel="Move checkpoint down"
                    >
                      <ChevronDown size={14} color={isDark ? '#B5B5B5' : '#626262'} strokeWidth={2.2} />
                    </Pressable>

                    {/* Delete point */}
                    <Pressable
                      onPress={() => handleDeleteItem(idx)}
                      className="p-1 rounded-full opacity-40 hover:opacity-100 hover:bg-red-500/10 ml-1"
                      style={({ pressed }) => pressed ? { transform: [{ scale: 0.9 }] } : undefined}
                      accessibilityLabel="Delete checkpoint"
                    >
                      <Trash2 size={12} color={isDark ? '#B5B5B5' : '#626262'} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Add Checkpoint Button */}
      <View className="flex-row items-center mt-2.5 pl-7">
        <Pressable
          onPress={() => handleAddItem()}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/70 dark:border-white/10 hover:border-note-cyan/60 dark:hover:border-note-cyan/60 shadow-sm group"
          style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
          accessibilityLabel="Add checkpoint to this checklist"
        >
          <View className="w-4 h-4 rounded-full bg-note-cyan/15 items-center justify-center">
            <Plus size={11} color={isDark ? '#38BDF8' : '#0284C7'} strokeWidth={2.5} />
          </View>
          <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
            Add checkpoint
          </Text>
        </Pressable>
      </View>
    </View>
  );
};
