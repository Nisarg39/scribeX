import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useTheme, NoteColors } from '../../../theme';
import { TaskPriority } from '../../../types/note';
import { 
  CheckCircle2, 
  Circle, 
  Calendar, 
  Flag, 
  Trash2 
} from 'lucide-react-native';

interface ChecklistBlockProps {
  content: string;
  checked: boolean;
  taskId?: string;
  priority?: TaskPriority;
  dueDate?: string;
  onUpdateContent: (content: string) => void;
  onToggleCheck: (checked: boolean) => void;
  onUpdatePriority?: (priority: TaskPriority) => void;
  onUpdateDueDate?: (dueDate: string) => void;
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
  content,
  checked = false,
  taskId,
  priority = 'none',
  dueDate = 'Today',
  onUpdateContent,
  onToggleCheck,
  onUpdatePriority,
  onUpdateDueDate,
  onDelete,
}) => {
  const { isDark } = useTheme();
  const [showMeta, setShowMeta] = useState(false);

  const priorityConf = PRIORITY_COLORS[priority] || PRIORITY_COLORS.none;

  const cyclePriority = () => {
    const currentIdx = PRIORITY_ORDER.indexOf(priority);
    const nextPriority = PRIORITY_ORDER[(currentIdx + 1) % PRIORITY_ORDER.length];
    if (onUpdatePriority) {
      onUpdatePriority(nextPriority);
    }
  };

  return (
    <View className="py-1">
      {/* Main Checklist Row */}
      <View className="flex-row items-start gap-3">
        {/* Toggle Checkbox */}
        <Pressable
          onPress={() => onToggleCheck(!checked)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          className="pt-0.5 active:scale-90"
        >
          {checked ? (
            <CheckCircle2 size={19} color={NoteColors.lime} strokeWidth={2.4} />
          ) : (
            <Circle size={19} color={isDark ? '#858585' : '#929292'} strokeWidth={2} />
          )}
        </Pressable>

        {/* Text Input */}
        <View className="flex-1">
          <TextInput
            multiline
            placeholder="To-do item..."
            placeholderTextColor={isDark ? '#858585' : '#929292'}
            value={content}
            onChangeText={onUpdateContent}
            className={`text-base leading-relaxed py-0 text-light-textPrimary dark:text-dark-textPrimary ${
              checked ? 'line-through text-light-textMuted dark:text-dark-textMuted' : ''
            }`}
          />

          {/* Quick Meta Chips Row */}
          <View className="flex-row items-center gap-2 mt-1 flex-wrap">
            {/* Priority Pill */}
            <Pressable
              onPress={cyclePriority}
              className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/60 dark:border-white/5 active:scale-95"
            >
              <View
                style={{ backgroundColor: priorityConf.color }}
                className="w-1.5 h-1.5 rounded-full"
              />
              <Text
                style={{ color: priority !== 'none' ? priorityConf.color : (isDark ? '#858585' : '#929292') }}
                className="text-[10px] font-bold uppercase tracking-wider"
              >
                {priorityConf.label}
              </Text>
            </Pressable>

            {/* Due Date Chip */}
            <Pressable
              onPress={() => {
                if (onUpdateDueDate) {
                  const nextDue = dueDate === 'Today' ? 'Tomorrow' : dueDate === 'Tomorrow' ? 'This Week' : 'Today';
                  onUpdateDueDate(nextDue);
                }
              }}
              className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/60 dark:border-white/5 active:scale-95"
            >
              <Calendar size={10} color={isDark ? '#858585' : '#929292'} />
              <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                {dueDate}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
};
