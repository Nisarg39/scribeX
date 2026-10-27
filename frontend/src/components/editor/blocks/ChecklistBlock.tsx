import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useTheme, NoteColors } from '../../../theme';
import { TaskPriority, ChecklistPoint } from '../../../types/note';
import { 
  CheckCircle2, 
  Circle, 
  Calendar, 
  Trash2, 
  Plus 
} from 'lucide-react-native';

interface ChecklistBlockProps {
  items?: ChecklistPoint[];
  isSelected?: boolean;
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
  content,
  checked = false,
  taskId,
  priority = 'none',
  dueDate = 'Today',
  onUpdateItems,
  onUpdateContent,
  onToggleCheck,
  onFocus,
  onDelete,
}) => {
  const { isDark } = useTheme();

  // Normalize items to ensure a checklist container array
  const checklistItems: ChecklistPoint[] = Array.isArray(items) && items.length > 0
    ? items
    : [{
        id: taskId || `task-${Date.now()}-1`,
        text: content || '',
        checked: checked,
        priority: priority || 'none',
        dueDate: dueDate || 'Today',
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

  const handleAddItem = (afterIndex?: number) => {
    onFocus?.();
    const newPoint: ChecklistPoint = {
      id: `task-${Date.now()}-${checklistItems.length + 1}`,
      text: '',
      checked: false,
      priority: 'none',
      dueDate: 'Today',
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
    <Pressable
      onPress={onFocus}
      className={`py-3 my-2 rounded-2xl transition-all cursor-default ${
        isSelected
          ? 'bg-light-appBg/90 dark:bg-white/[0.06] border-2 border-note-cyan/80 dark:border-note-cyan/60 shadow-md ring-2 ring-note-cyan/20'
          : 'bg-black/[0.02] dark:bg-white/[0.02] border-2 border-transparent hover:border-black/10 dark:hover:border-white/10'
      } px-2.5 md:px-3.5`}
    >
      {/* Container Header Badge */}
      <Pressable
        onPress={onFocus}
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

          return (
            <View key={item.id || idx} className="flex-row items-start gap-3 py-1.5 group">
              {/* Checkbox Toggle */}
              <Pressable
                onPress={() => handleToggleItem(idx)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.checked }}
                className="pt-1 active:scale-90"
              >
                {item.checked ? (
                  <CheckCircle2 size={19} color={NoteColors.lime} strokeWidth={2.4} />
                ) : (
                  <Circle size={19} color={isDark ? '#858585' : '#929292'} strokeWidth={2} />
                )}
              </Pressable>

              {/* Text Input & Meta Chips */}
              <View className="flex-1">
                <TextInput
                  multiline
                  placeholder="Checklist point... (Press Enter to add next)"
                  placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
                  value={item.text}
                  onChangeText={(text) => handleUpdateItemText(idx, text)}
                  onFocus={onFocus}
                  onSubmitEditing={() => handleAddItem(idx)}
                  className={`text-base leading-relaxed py-0 outline-none text-light-textPrimary dark:text-dark-textPrimary ${
                    item.checked ? 'line-through text-light-textMuted dark:text-dark-textMuted' : ''
                  }`}
                />

                {/* Priority & Due Date Chips */}
                <View className="flex-row items-center gap-2 mt-1 flex-wrap">
                  {/* Priority Pill */}
                  <Pressable
                    onPress={() => handleCyclePriority(idx)}
                    className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/60 dark:border-white/5 active:scale-95"
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
                    className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/60 dark:border-white/5 active:scale-95"
                    accessibilityLabel="Change Due Date"
                  >
                    <Calendar size={10} color={isDark ? '#858585' : '#929292'} />
                    <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                      {item.dueDate || 'Today'}
                    </Text>
                  </Pressable>

                  {/* Delete individual point */}
                  <Pressable
                    onPress={() => handleDeleteItem(idx)}
                    className="p-1 rounded-full opacity-40 hover:opacity-100 hover:bg-red-500/10 active:scale-90 ml-auto"
                    accessibilityLabel="Delete item"
                  >
                    <Trash2 size={12} color={isDark ? '#B5B5B5' : '#626262'} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Add Checkpoint Button */}
      <View className="flex-row items-center mt-2 pl-7">
        <Pressable
          onPress={() => handleAddItem()}
          className="flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/60 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20 active:scale-95"
          accessibilityLabel="Add checkpoint to this checklist"
        >
          <Plus size={12} color={isDark ? '#B5B5B5' : '#626262'} strokeWidth={2.2} />
          <Text className="text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary">
            Add checkpoint
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
};
