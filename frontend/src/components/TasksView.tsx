import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useTheme, NoteColors } from '../theme';
import { useNotesStore } from '../state/useNotesStore';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Calendar,
  FileText
} from 'lucide-react-native';

export const TasksView: React.FC = () => {
  const { isDark } = useTheme();
  const { tasks, addTask, toggleTask, deleteTask } = useNotesStore();
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    addTask(newTaskTitle.trim());
    setNewTaskTitle('');
  };

  const pendingTasks = tasks.filter((t) => !t.isCompleted);
  const completedTasks = tasks.filter((t) => t.isCompleted);

  return (
    <ScrollView 
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

      {/* Quick Task Capture Field */}
      <View 
        className="mb-8 flex-row items-center p-2.5 rounded-2xl bg-light-surface dark:bg-dark-raised border border-light-border dark:border-dark-border shadow-sm"
      >
        <TextInput
          placeholder="Add a task or to-do..."
          placeholderTextColor={isDark ? '#858585' : '#929292'}
          value={newTaskTitle}
          onChangeText={setNewTaskTitle}
          onSubmitEditing={handleAddTask}
          className="flex-1 text-base font-medium text-light-textPrimary dark:text-dark-textPrimary px-3 py-1"
        />

        <Pressable
          onPress={handleAddTask}
          disabled={!newTaskTitle.trim()}
          accessibilityLabel="Add Task"
          className={`w-9 h-9 rounded-full items-center justify-center transition-all ${
            newTaskTitle.trim()
              ? 'bg-light-iconBg dark:bg-white active:scale-95'
              : 'bg-black/10 dark:bg-white/10 opacity-40'
          }`}
        >
          <Plus 
            size={18} 
            color={newTaskTitle.trim() ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#858585' : '#929292')} 
            strokeWidth={2.5} 
          />
        </Pressable>
      </View>

      {/* Pending Tasks Section */}
      <View className="mb-8">
        <Text className="text-xs uppercase tracking-widest font-bold text-light-textMuted dark:text-dark-textMuted mb-3">
          To Do ({pendingTasks.length})
        </Text>

        <View className="gap-2">
          {pendingTasks.map((task) => {
            const originColor = task.noteColorToken ? NoteColors[task.noteColorToken] : undefined;

            return (
              <View 
                key={task.id}
                className="flex-row items-center justify-between p-4 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border"
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
                      {task.noteTitle && (
                        <View 
                          style={{ backgroundColor: originColor || '#E5F28B' }}
                          className="flex-row items-center gap-1 px-2 py-0.5 rounded-full"
                        >
                          <FileText size={10} color="#191919" />
                          <Text className="text-[10px] font-bold text-[#191919]">
                            {task.noteTitle}
                          </Text>
                        </View>
                      )}

                      {task.dueDate && (
                        <View className="flex-row items-center gap-1">
                          <Calendar size={11} color={isDark ? '#858585' : '#929292'} />
                          <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                            {task.dueDate}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => deleteTask(task.id)}
                  accessibilityLabel="Delete Task"
                  className="w-8 h-8 rounded-full items-center justify-center opacity-40 hover:opacity-100 active:scale-90"
                >
                  <Trash2 size={16} color={isDark ? '#B5B5B5' : '#626262'} />
                </Pressable>
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
            {completedTasks.map((task) => (
              <View 
                key={task.id}
                className="flex-row items-center justify-between p-4 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border"
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
                  onPress={() => deleteTask(task.id)}
                  accessibilityLabel="Delete Task"
                  className="w-8 h-8 rounded-full items-center justify-center opacity-40 hover:opacity-100 active:scale-90"
                >
                  <Trash2 size={16} color={isDark ? '#B5B5B5' : '#626262'} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};
