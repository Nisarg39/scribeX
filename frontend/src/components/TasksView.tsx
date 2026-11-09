import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, NoteColors } from '../theme';
import { useNotesStore } from '../state/useNotesStore';
import { TaskPriority } from '../types/note';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Calendar,
  FileText,
  Flag,
  Filter,
  Bell,
  BellRing
} from 'lucide-react-native';
import { ReminderPickerModal } from './common/ReminderPickerModal';
import { TaskItem } from '../types/note';
import { parseReminderString, formatRecurrenceLabel, formatReminderChip } from '../types/reminder';

const PRIORITY_FILTERS: Array<{ key: 'all' | TaskPriority; label: string; color?: string }> = [
  { key: 'all', label: 'All' },
  { key: 'urgent', label: 'Urgent', color: '#EF4444' },
  { key: 'high', label: 'High', color: NoteColors.coral },
  { key: 'medium', label: 'Medium', color: NoteColors.apricot },
  { key: 'low', label: 'Low', color: NoteColors.sky },
];

const DATE_FILTERS = [
  { key: 'all', label: 'All Dates' },
  { key: 'Today', label: 'Today' },
  { key: 'Upcoming', label: 'Upcoming' },
];

const PRIORITY_ORDER: TaskPriority[] = ['none', 'low', 'medium', 'high', 'urgent'];

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; label: string }> = {
  none: { color: '#858585', label: 'No Priority' },
  low: { color: NoteColors.sky, label: 'Low' },
  medium: { color: NoteColors.apricot, label: 'Medium' },
  high: { color: NoteColors.coral, label: 'High' },
  urgent: { color: '#EF4444', label: 'Urgent' },
};

export interface TasksViewProps {
  focusedTaskId?: string | null;
  onClearFocusedTask?: () => void;
}

export const TasksView: React.FC<TasksViewProps> = ({ focusedTaskId, onClearFocusedTask }) => {
  const router = useRouter();
  const { isDark } = useTheme();
  const { tasks, addTask, toggleTask, updateTaskPriority, updateTaskDueDate, deleteTask, setTaskReminder } = useNotesStore();

  const scrollViewRef = useRef<ScrollView>(null);
  const taskYPositions = useRef<Record<string, number>>({});
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority>('none');
  const [selectedDueDate, setSelectedDueDate] = useState('Today');
  const [reminderModalTask, setReminderModalTask] = useState<TaskItem | null>(null);

  const [activePriorityFilter, setActivePriorityFilter] = useState<'all' | TaskPriority>('all');
  const [activeDateFilter, setActiveDateFilter] = useState<string>('all');

  useEffect(() => {
    if (focusedTaskId) {
      setHighlightedTaskId(focusedTaskId);

      // Auto-reset filters if the focused task would otherwise be hidden
      const targetTask = tasks.find((t) => t.id === focusedTaskId);
      if (targetTask) {
        if (activePriorityFilter !== 'all' && activePriorityFilter !== targetTask.priority) {
          setActivePriorityFilter('all');
        }
        if (activeDateFilter !== 'all') {
          setActiveDateFilter('all');
        }
      }

      const scrollTimer = setTimeout(() => {
        const y = taskYPositions.current[focusedTaskId];
        if (typeof y === 'number' && scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: Math.max(0, y - 60), animated: true });
        }
      }, 120);

      const clearTimer = setTimeout(() => {
        setHighlightedTaskId(null);
        onClearFocusedTask?.();
      }, 3500);

      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [focusedTaskId, tasks]);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    addTask(newTaskTitle.trim(), selectedPriority, selectedDueDate);
    setNewTaskTitle('');
    setSelectedPriority('none');
    setSelectedDueDate('Today');
  };

  const cycleCapturePriority = () => {
    const idx = PRIORITY_ORDER.indexOf(selectedPriority);
    setSelectedPriority(PRIORITY_ORDER[(idx + 1) % PRIORITY_ORDER.length]);
  };

  const cycleCaptureDueDate = () => {
    const dates = ['Today', 'Tomorrow', 'This Week'];
    const idx = dates.indexOf(selectedDueDate);
    setSelectedDueDate(dates[(idx + 1) % dates.length]);
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (activePriorityFilter !== 'all' && t.priority !== activePriorityFilter) {
      return false;
    }
    if (activeDateFilter === 'Today' && t.dueDate !== 'Today') {
      return false;
    }
    if (activeDateFilter === 'Upcoming' && t.dueDate === 'Today') {
      return false;
    }
    return true;
  });

  const pendingTasks = filteredTasks.filter((t) => !t.isCompleted);
  const completedTasks = filteredTasks.filter((t) => t.isCompleted);

  return (
    <ScrollView 
      ref={scrollViewRef}
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Editorial Page Heading */}
      <View className="mb-6">
        <Text className="text-4xl md:text-5xl font-extrabold text-light-textPrimary dark:text-dark-textPrimary tracking-tight">
          Tasks
        </Text>
        <Text className="text-xs md:text-sm font-medium text-light-textSecondary dark:text-dark-textSecondary mt-1">
          {pendingTasks.length} pending • {completedTasks.length} completed
        </Text>
      </View>

      {/* Filter Tracks */}
      <View className="mb-6 gap-2.5">
        {/* Priority Filter Track */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }}>
          <View className="flex-row items-center gap-2">
            {PRIORITY_FILTERS.map((f) => {
              const isSelected = activePriorityFilter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setActivePriorityFilter(f.key)}
                  className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                    isSelected
                      ? 'bg-light-iconBg dark:bg-white border-transparent'
                      : 'bg-light-appBg dark:bg-dark-raised border-light-border dark:border-white/5'
                  } active:scale-95`}
                >
                  {f.color && (
                    <View
                      style={{ backgroundColor: f.color }}
                      className="w-1.5 h-1.5 rounded-full"
                    />
                  )}
                  <Text
                    className={`text-xs font-bold ${
                      isSelected
                        ? 'text-white dark:text-[#111111]'
                        : 'text-light-textSecondary dark:text-dark-textSecondary'
                    }`}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Due Date Filter Track */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }}>
          <View className="flex-row items-center gap-2">
            {DATE_FILTERS.map((d) => {
              const isSelected = activeDateFilter === d.key;
              return (
                <Pressable
                  key={d.key}
                  onPress={() => setActiveDateFilter(d.key)}
                  className={`px-3 py-1 rounded-full border ${
                    isSelected
                      ? 'bg-light-surface dark:bg-[#333333] border-black dark:border-white'
                      : 'bg-transparent border-light-border/60 dark:border-white/5'
                  } active:scale-95`}
                >
                  <Text
                    className={`text-[11px] font-semibold ${
                      isSelected
                        ? 'text-light-textPrimary dark:text-dark-textPrimary font-bold'
                        : 'text-light-textMuted dark:text-dark-textMuted'
                    }`}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Quick Task Capture Field */}
      <View 
        className="mb-8 p-3 rounded-2xl bg-light-surface dark:bg-dark-raised border border-light-border dark:border-dark-border shadow-sm"
      >
        <TextInput
          placeholder="Add a task or to-do..."
          placeholderTextColor={isDark ? '#858585' : '#929292'}
          value={newTaskTitle}
          onChangeText={setNewTaskTitle}
          onSubmitEditing={handleAddTask}
          className="text-base font-medium text-light-textPrimary dark:text-dark-textPrimary px-2 py-1 mb-2"
        />

        {/* Bottom Options inside capture box */}
        <View className="flex-row items-center justify-between pt-2 border-t border-light-border/40 dark:border-white/5">
          <View className="flex-row items-center gap-2">
            {/* Priority Selector Pill */}
            <Pressable
              onPress={cycleCapturePriority}
              className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-light-appBg dark:bg-dark-surface border border-light-border/60 dark:border-white/5 active:scale-95"
            >
              <View
                style={{ backgroundColor: PRIORITY_CONFIG[selectedPriority].color }}
                className="w-1.5 h-1.5 rounded-full"
              />
              <Text className="text-[11px] font-bold text-light-textSecondary dark:text-dark-textSecondary">
                {PRIORITY_CONFIG[selectedPriority].label}
              </Text>
            </Pressable>

            {/* Due Date Selector Pill */}
            <Pressable
              onPress={cycleCaptureDueDate}
              className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-light-appBg dark:bg-dark-surface border border-light-border/60 dark:border-white/5 active:scale-95"
            >
              <Calendar size={11} color={isDark ? '#858585' : '#929292'} />
              <Text className="text-[11px] font-medium text-light-textSecondary dark:text-dark-textSecondary">
                {selectedDueDate}
              </Text>
            </Pressable>
          </View>

          {/* Submit Add Button */}
          <Pressable
 hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={handleAddTask}
            disabled={!newTaskTitle.trim()}
            accessibilityLabel="Add Task"
            className={`w-8 h-8 rounded-full items-center justify-center ${
              newTaskTitle.trim()
                ? 'bg-light-iconBg dark:bg-white active:scale-95'
                : 'bg-black/10 dark:bg-white/10 opacity-40'
            }`}
          >
            <Plus 
              size={16} 
              color={newTaskTitle.trim() ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#858585' : '#929292')} 
              strokeWidth={2.5} 
            />
          </Pressable>
        </View>
      </View>

      {/* Pending Tasks Section */}
      <View className="mb-8">
        <Text className="text-xs uppercase tracking-widest font-bold text-light-textMuted dark:text-dark-textMuted mb-3">
          To Do ({pendingTasks.length})
        </Text>

        <View className="gap-2">
          {pendingTasks.map((task) => {
            const originColor = task.noteColorToken ? NoteColors[task.noteColorToken] : undefined;
            const pConf = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.none;
            const isHighlighted = highlightedTaskId === task.id;

            return (
              <View 
                key={task.id}
                onLayout={(e) => {
                  taskYPositions.current[task.id] = e.nativeEvent.layout.y;
                }}
                className={`flex-row items-center justify-between p-4 rounded-2xl border transition-all ${
                  isHighlighted
                    ? 'bg-lime-500/15 dark:bg-lime-500/20 border-lime-500 dark:border-lime-400 shadow-lg ring-2 ring-lime-500/30'
                    : 'bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border'
                }`}
              >
                <Pressable
                  onPress={() => toggleTask(task.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: false }}
                  className="flex-1 flex-row items-center gap-3.5 pr-2"
                >
                  <Circle 
                    size={20} 
                    color={isDark ? '#858585' : '#929292'} 
                    strokeWidth={2} 
                  />

                  <View className="flex-1">
                    <Text className="text-base font-medium text-light-textPrimary dark:text-dark-textPrimary leading-snug">
                      {task.title}
                    </Text>

                    {/* Metadata & Origin Note Badge */}
                    <View className="flex-row items-center gap-2 mt-1.5 flex-wrap">
                      {/* Origin Note Pastel Chip */}
                      {task.noteTitle && (
                        <Pressable 
                          onPress={(e) => {
                            e.stopPropagation();
                            if (task.noteId) {
                              router.push(`/note/${task.noteId}`);
                            }
                          }}
                          style={({ pressed }) => [
                            { backgroundColor: originColor || '#E5F28B' },
                            pressed ? { transform: [{ scale: 0.95 }] } : undefined,
                          ]}
                          className="flex-row items-center gap-1 px-2.5 py-0.5 rounded-full"
                        >
                          <FileText size={10} color="#191919" />
                          <Text className="text-[10px] font-bold text-[#191919]">
                            {task.noteTitle}
                          </Text>
                        </Pressable>
                      )}

                      {/* Priority Chip with inline cycle on tap */}
                      {task.priority !== 'none' && (
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            const idx = PRIORITY_ORDER.indexOf(task.priority);
                            updateTaskPriority(task.id, PRIORITY_ORDER[(idx + 1) % PRIORITY_ORDER.length]);
                          }}
                          className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised"
                        >
                          <View
                            style={{ backgroundColor: pConf.color }}
                            className="w-1.5 h-1.5 rounded-full"
                          />
                          <Text
                            style={{ color: pConf.color }}
                            className="text-[10px] font-bold uppercase tracking-wider"
                          >
                            {pConf.label}
                          </Text>
                        </Pressable>
                      )}

                      {/* Due Date Chip */}
                      {task.dueDate && (
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            const nextDue = task.dueDate === 'Today' ? 'Tomorrow' : task.dueDate === 'Tomorrow' ? 'This Week' : 'Today';
                            updateTaskDueDate(task.id, nextDue);
                          }}
                          className="flex-row items-center gap-1"
                        >
                          <Calendar size={11} color={isDark ? '#858585' : '#929292'} />
                          <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                            {task.dueDate}
                          </Text>
                        </Pressable>
                      )}

                      {/* Scheduled Reminder Chip */}
                      {task.reminderAt && (
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            setReminderModalTask(task);
                          }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-lime-500/10 active:scale-95"
                        >
                          <BellRing size={11} color="#84CC16" />
                          <Text className="text-[10px] font-bold text-lime-600 dark:text-lime-400">
                            {formatReminderChip(task.reminderAt)}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </Pressable>

                <View className="flex-row items-center gap-1">
                  <Pressable
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => setReminderModalTask(task)}
                    accessibilityLabel="Set Reminder"
                    className={`w-8 h-8 rounded-full items-center justify-center active:scale-90 ${
                      task.reminderAt ? 'opacity-100 bg-lime-500/15' : 'opacity-40 hover:opacity-100'
                    }`}
                  >
                    {task.reminderAt ? (
                      <BellRing size={15} color="#84CC16" strokeWidth={2.2} />
                    ) : (
                      <Bell size={15} color={isDark ? '#B5B5B5' : '#626262'} />
                    )}
                  </Pressable>

                  <Pressable
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => deleteTask(task.id)}
                    accessibilityLabel="Delete Task"
                    className="w-8 h-8 rounded-full items-center justify-center opacity-40 hover:opacity-100 active:scale-90"
                  >
                    <Trash2 size={16} color={isDark ? '#B5B5B5' : '#626262'} />
                  </Pressable>
                </View>
              </View>
            );
          })}

          {pendingTasks.length === 0 && (
            <View className="py-8 items-center justify-center">
              <Text className="text-sm text-light-textMuted dark:text-dark-textMuted">
                All caught up! No pending tasks.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Completed Tasks Section */}
      {completedTasks.length > 0 && (
        <View>
          <Text className="text-xs uppercase tracking-widest font-bold text-light-textMuted dark:text-dark-textMuted mb-3">
            Completed ({completedTasks.length})
          </Text>

          <View className="gap-2 opacity-60">
            {completedTasks.map((task) => {
              const isHighlighted = highlightedTaskId === task.id;

              return (
                <View 
                  key={task.id}
                  onLayout={(e) => {
                    taskYPositions.current[task.id] = e.nativeEvent.layout.y;
                  }}
                  className={`flex-row items-center justify-between p-4 rounded-2xl border transition-all ${
                    isHighlighted
                      ? 'bg-lime-500/15 dark:bg-lime-500/20 border-lime-500 dark:border-lime-400 shadow-lg ring-2 ring-lime-500/30'
                      : 'bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border'
                  }`}
                >
                <Pressable
                  onPress={() => toggleTask(task.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: true }}
                  className="flex-1 flex-row items-center gap-3.5 pr-2"
                >
                  <CheckCircle2 
                    size={20} 
                    color={NoteColors.lime} 
                    strokeWidth={2.2} 
                  />

                  <Text className="flex-1 text-base font-medium line-through text-light-textMuted dark:text-dark-textMuted leading-snug">
                    {task.title}
                  </Text>
                </Pressable>

                <Pressable
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => deleteTask(task.id)}
                  accessibilityLabel="Delete Task"
                  className="w-8 h-8 rounded-full items-center justify-center opacity-40 hover:opacity-100 active:scale-90"
                >
                  <Trash2 size={16} color={isDark ? '#B5B5B5' : '#626262'} />
                </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Reminder Picker Modal */}
      {reminderModalTask && (
        <ReminderPickerModal
          visible={Boolean(reminderModalTask)}
          targetTitle={reminderModalTask.title}
          currentReminderAt={reminderModalTask.reminderAt}
          onClose={() => setReminderModalTask(null)}
          onSave={(triggerAt) => {
            if (reminderModalTask) {
              setTaskReminder(reminderModalTask.id, triggerAt);
            }
          }}
        />
      )}
    </ScrollView>
  );
};
