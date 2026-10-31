import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useTheme, NoteColors } from '../../../theme';
import { Flame, Check, RotateCcw, Calendar, Trash2 } from 'lucide-react-native';

export type HabitFrequency = 'daily' | 'weekdays' | 'weekly';

interface HabitBlockProps {
  title?: string;
  frequency?: HabitFrequency;
  streak?: number;
  targetDays?: number;
  history?: Record<string, boolean>; // e.g. { '2026-10-30': true }
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onDelete?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onUpdateHabit?: (updates: {
    title?: string;
    frequency?: HabitFrequency;
    streak?: number;
    targetDays?: number;
    history?: Record<string, boolean>;
  }) => void;
}

const FREQUENCY_CONFIG: Record<HabitFrequency, { label: string; target: number }> = {
  daily: { label: 'Daily', target: 7 },
  weekdays: { label: 'Weekdays', target: 5 },
  weekly: { label: 'Weekly', target: 3 },
};

const FREQUENCY_ORDER: HabitFrequency[] = ['daily', 'weekdays', 'weekly'];

export const HabitBlock: React.FC<HabitBlockProps> = ({
  title = '',
  frequency = 'daily',
  streak = 0,
  targetDays = 7,
  history = {},
  isSelected = false,
  isDragging = false,
  onFocus,
  onDelete,
  onStartDrag,
  onUpdateHabit,
}) => {
  const { isDark } = useTheme();
  const [localTitle, setLocalTitle] = useState(title);

  // Compute 7 days of the current week (Monday to Sunday)
  const weekDays = useMemo(() => {
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);

    const days = [];
    const names = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const fullNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const isToday = iso === today.toISOString().split('T')[0];
      days.push({
        iso,
        name: names[i],
        fullName: fullNames[i],
        dateNum: d.getDate(),
        isToday,
      });
    }
    return days;
  }, []);

  // Calculate current streak dynamically from history
  const calculateStreak = (currentHistory: Record<string, boolean>): number => {
    let count = 0;
    const cur = new Date();
    // Check backwards from today (or yesterday if today isn't checked yet)
    const todayIso = cur.toISOString().split('T')[0];
    let checkDate = new Date(cur);

    if (!currentHistory[todayIso]) {
      // Check if yesterday was completed
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const iso = checkDate.toISOString().split('T')[0];
      if (currentHistory[iso]) {
        count++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  };

  const handleToggleDay = (isoDate: string) => {
    onFocus?.();
    const nextHistory = { ...history, [isoDate]: !history[isoDate] };
    const nextStreak = calculateStreak(nextHistory);
    onUpdateHabit?.({
      title: localTitle,
      frequency,
      targetDays,
      history: nextHistory,
      streak: nextStreak,
    });
  };

  const handleCycleFrequency = () => {
    onFocus?.();
    const currentIdx = FREQUENCY_ORDER.indexOf(frequency);
    const nextFreq = FREQUENCY_ORDER[(currentIdx + 1) % FREQUENCY_ORDER.length];
    const newTarget = FREQUENCY_CONFIG[nextFreq].target;
    onUpdateHabit?.({
      title: localTitle,
      frequency: nextFreq,
      targetDays: newTarget,
      history,
      streak,
    });
  };

  const completedThisWeek = weekDays.filter((d) => !!history[d.iso]).length;
  const currentTarget = targetDays || FREQUENCY_CONFIG[frequency].target;
  const progressPercent = Math.min(100, Math.round((completedThisWeek / currentTarget) * 100));

  const containerStyle = useMemo(() => {
    return {
      borderColor: isSelected
        ? isDark
          ? 'rgba(245, 158, 11, 0.7)'
          : 'rgba(245, 158, 11, 0.85)'
        : 'transparent',
      backgroundColor: isSelected
        ? isDark
          ? 'rgba(245, 158, 11, 0.05)'
          : 'rgba(254, 243, 199, 0.5)'
        : isDark
        ? 'rgba(255, 255, 255, 0.02)'
        : 'rgba(0, 0, 0, 0.02)',
    };
  }, [isSelected, isDark]);

  return (
    <View
      style={containerStyle}
      className="py-3 px-3.5 my-2 rounded-2xl border-2 transition-all"
    >
      {/* Top Header: Flame Badge, Title, Streak & Frequency Pills */}
      <View className="flex-row items-center justify-between mb-3 flex-wrap gap-2">
        {/* Left: Flame Icon + Inline Habit Title */}
        <View className="flex-row items-center gap-2.5 flex-1 min-w-[200px]">
          <View className="w-7 h-7 rounded-full bg-amber-500/15 dark:bg-amber-400/15 items-center justify-center">
            <Flame size={16} color="#F59E0B" strokeWidth={2.4} />
          </View>

          <TextInput
            value={localTitle}
            onChangeText={(text) => {
              setLocalTitle(text);
              onUpdateHabit?.({
                title: text,
                frequency,
                targetDays,
                history,
                streak,
              });
            }}
            onFocus={onFocus}
            placeholder="Habit title (e.g. Daily reading, Morning run)..."
            placeholderTextColor={isDark ? '#737373' : '#A3A3A3'}
            className="flex-1 text-base md:text-lg font-bold text-light-textPrimary dark:text-dark-textPrimary outline-none py-0.5"
          />
        </View>

        {/* Right: Streak & Frequency Pills + Delete */}
        <View className="flex-row items-center gap-2">
          {/* Streak Indicator Pill */}
          <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25">
            <Flame size={12} color="#F59E0B" strokeWidth={2.5} />
            <Text className="text-[11px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              {streak} {streak === 1 ? 'day' : 'days'}
            </Text>
          </View>

          {/* Frequency Cycle Pill */}
          <Pressable
            onPress={handleCycleFrequency}
            className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/70 dark:border-white/10"
            style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
            accessibilityLabel="Cycle habit frequency"
          >
            <Calendar size={11} color={isDark ? '#A3A3A3' : '#737373'} />
            <Text className="text-[11px] font-bold text-light-textSecondary dark:text-dark-textSecondary">
              {FREQUENCY_CONFIG[frequency]?.label || 'Daily'}
            </Text>
          </Pressable>

          {/* Delete Habit */}
          {onDelete && (
            <Pressable
              onPress={onDelete}
              className="p-1 rounded-full opacity-40 hover:opacity-100 hover:bg-red-500/10 active:bg-red-500/20 ml-0.5"
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
              accessibilityLabel="Delete habit block"
            >
              <Trash2 size={13} color={isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>
          )}
        </View>
      </View>

      {/* 7-Day Matrix Strip */}
      <View className="flex-row items-center justify-between gap-1 sm:gap-2 my-1 px-1">
        {weekDays.map((day) => {
          const isDone = !!history[day.iso];
          return (
            <Pressable
              key={day.iso}
              onPress={() => handleToggleDay(day.iso)}
              className="flex-1 items-center justify-center py-2 px-1 rounded-xl"
              style={({ pressed }) => [
                {
                  backgroundColor: isDone
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.18)'
                      : 'rgba(16, 185, 129, 0.12)'
                    : day.isToday
                    ? isDark
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.04)'
                    : 'transparent',
                  borderWidth: day.isToday ? 1.5 : 1,
                  borderColor: isDone
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.5)'
                      : 'rgba(16, 185, 129, 0.4)'
                    : day.isToday
                    ? '#F59E0B'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.05)',
                },
                pressed ? { transform: [{ scale: 0.93 }] } : undefined,
              ]}
              accessibilityLabel={`Toggle habit for ${day.fullName} ${day.dateNum}`}
            >
              <Text
                className={`text-[10px] uppercase font-bold mb-1 ${
                  day.isToday
                    ? 'text-amber-500 font-black'
                    : 'text-light-textMuted dark:text-dark-textMuted'
                }`}
              >
                {day.name}
              </Text>

              {/* Day completion state circle */}
              <View
                className={`w-6 h-6 rounded-full items-center justify-center ${
                  isDone
                    ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                    : 'bg-transparent border border-light-border dark:border-white/10'
                }`}
              >
                {isDone ? (
                  <Check size={13} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <Text className="text-[11px] font-semibold text-light-textMuted dark:text-dark-textMuted">
                    {day.dateNum}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Progress Line and Consistency Summary */}
      <View className="mt-3 px-1">
        {/* Subtle Progress Bar */}
        <View className="w-full h-1.5 rounded-full bg-light-border/60 dark:bg-white/10 overflow-hidden mb-1.5">
          <View
            style={{ width: `${progressPercent}%` }}
            className={`h-full rounded-full ${
              progressPercent >= 100
                ? 'bg-emerald-500'
                : progressPercent >= 50
                ? 'bg-amber-500'
                : 'bg-note-cyan'
            }`}
          />
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-[11px] font-semibold text-light-textSecondary dark:text-dark-textSecondary">
            {completedThisWeek} of {currentTarget} completed this week
          </Text>
          <Text className="text-[11px] font-bold text-light-textMuted dark:text-dark-textMuted">
            {progressPercent}% consistency
          </Text>
        </View>
      </View>
    </View>
  );
};

