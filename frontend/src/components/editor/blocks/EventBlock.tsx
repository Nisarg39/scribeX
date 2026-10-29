import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useTheme } from '../../../theme';
import { Calendar, Clock, MapPin, Bell, Trash2, CheckCircle2 } from 'lucide-react-native';

export interface EventBlockMetadata {
  title?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  isAllDay?: boolean;
  location?: string;
  reminder?: string;
}

interface EventBlockProps {
  metadata?: EventBlockMetadata;
  content?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onDelete?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onUpdateEvent?: (updates: EventBlockMetadata) => void;
}

const REMINDER_OPTIONS = ['None', '15m before', '1h before', '1d before'];

export const EventBlock: React.FC<EventBlockProps> = ({
  metadata,
  content = '',
  isSelected = false,
  isDragging = false,
  onFocus,
  onDelete,
  onStartDrag,
  onUpdateEvent,
}) => {
  const { isDark } = useTheme();

  const title = metadata?.title || content || 'Product Sync & Sprint Review';
  const startDate = metadata?.startDate || new Date().toISOString().split('T')[0];
  const startTime = metadata?.startTime || '10:00';
  const endDate = metadata?.endDate || startDate;
  const endTime = metadata?.endTime || '11:00';
  const isAllDay = !!metadata?.isAllDay;
  const location = metadata?.location || 'Meeting Room 4B / Zoom';
  const reminder = metadata?.reminder || '15m before';

  const [localTitle, setLocalTitle] = useState(title);
  const [localLocation, setLocalLocation] = useState(location);

  const commitUpdates = (partial: Partial<EventBlockMetadata>) => {
    onUpdateEvent?.({
      title: localTitle,
      startDate,
      startTime,
      endDate,
      endTime,
      isAllDay,
      location: localLocation,
      reminder,
      ...partial,
    });
  };

  const handleCycleReminder = () => {
    onFocus?.();
    const curIdx = REMINDER_OPTIONS.indexOf(reminder);
    const next = REMINDER_OPTIONS[(curIdx + 1) % REMINDER_OPTIONS.length];
    commitUpdates({ reminder: next });
  };

  const handleToggleAllDay = () => {
    onFocus?.();
    commitUpdates({ isAllDay: !isAllDay });
  };

  const containerStyle = useMemo(() => {
    return {
      borderColor: isSelected
        ? isDark
          ? 'rgba(6, 182, 212, 0.7)'
          : 'rgba(6, 182, 212, 0.85)'
        : 'transparent',
      backgroundColor: isSelected
        ? isDark
          ? 'rgba(6, 182, 212, 0.05)'
          : 'rgba(238, 242, 255, 0.5)'
        : isDark
        ? 'rgba(255, 255, 255, 0.02)'
        : 'rgba(0, 0, 0, 0.02)',
    };
  }, [isSelected, isDark]);

  return (
    <View
      style={containerStyle}
      className="py-3 px-3.5 my-2 rounded-2xl border-2 transition-all cursor-default"
    >
      {/* Event Header Strip */}
      <View className="flex-row items-center justify-between mb-2.5">
        <View className="flex-row items-center gap-2 flex-1">
          <View className="w-7 h-7 rounded-full bg-cyan-500/15 dark:bg-cyan-400/15 items-center justify-center">
            <Calendar size={15} color="#06B6D4" strokeWidth={2.4} />
          </View>
          <TextInput
            value={localTitle}
            onChangeText={(t) => {
              setLocalTitle(t);
              commitUpdates({ title: t });
            }}
            onFocus={onFocus}
            placeholder="Event or meeting title..."
            placeholderTextColor={isDark ? '#737373' : '#A3A3A3'}
            className="flex-1 text-base md:text-lg font-bold text-light-textPrimary dark:text-dark-textPrimary outline-none py-0.5"
          />
        </View>

        {onDelete && (
          <Pressable
            onPress={onDelete}
            className="p-1 rounded-full opacity-40 hover:opacity-100 hover:bg-red-500/10 ml-1"
            style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
            accessibilityLabel="Delete event block"
          >
            <Trash2 size={13} color={isDark ? '#B5B5B5' : '#626262'} />
          </Pressable>
        )}
      </View>

      {/* Date, Time & All-Day Chips */}
      <View className="flex-row items-center flex-wrap gap-2 mb-2 px-1">
        {/* Date Chip */}
        <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/70 dark:border-white/10">
          <Calendar size={11} color={isDark ? '#38BDF8' : '#0284C7'} />
          <Text className="text-[11px] font-bold text-light-textPrimary dark:text-dark-textPrimary">
            {startDate}
          </Text>
        </View>

        {/* Time Chip */}
        {!isAllDay && (
          <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/70 dark:border-white/10">
            <Clock size={11} color={isDark ? '#F59E0B' : '#D97706'} />
            <Text className="text-[11px] font-bold text-light-textPrimary dark:text-dark-textPrimary">
              {startTime} – {endTime}
            </Text>
          </View>
        )}

        {/* All-Day Toggle Chip */}
        <Pressable
          onPress={handleToggleAllDay}
          className={`px-2.5 py-1 rounded-full border ${
            isAllDay
              ? 'bg-note-cyan/15 border-note-cyan/40'
              : 'bg-light-appBg dark:bg-dark-raised border-light-border/70 dark:border-white/10'
          }`}
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
          accessibilityLabel="Toggle all-day event"
        >
          <Text
            className={`text-[11px] font-bold ${
              isAllDay
                ? 'text-note-cyan'
                : 'text-light-textMuted dark:text-dark-textMuted'
            }`}
          >
            All-day
          </Text>
        </Pressable>

        {/* Reminder Pill */}
        <Pressable
          onPress={handleCycleReminder}
          className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/70 dark:border-white/10"
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
          accessibilityLabel="Cycle reminder interval"
        >
          <Bell size={11} color={reminder !== 'None' ? '#F59E0B' : isDark ? '#737373' : '#A3A3A3'} />
          <Text className="text-[11px] font-semibold text-light-textSecondary dark:text-dark-textSecondary">
            {reminder}
          </Text>
        </Pressable>
      </View>

      {/* Location Row */}
      <View className="flex-row items-center gap-2 mt-1 px-1">
        <MapPin size={12} color={isDark ? '#A1A1AA' : '#71717A'} />
        <TextInput
          value={localLocation}
          onChangeText={(loc) => {
            setLocalLocation(loc);
            commitUpdates({ location: loc });
          }}
          onFocus={onFocus}
          placeholder="Add location or call link..."
          placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
          className="flex-1 text-xs text-light-textSecondary dark:text-dark-textSecondary outline-none py-0.5"
        />
      </View>
    </View>
  );
};

