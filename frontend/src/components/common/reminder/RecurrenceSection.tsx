import React from 'react';
import { View, Text, Pressable } from 'react-native';

export interface RecurrenceSectionProps {
  repeatDays: number[];
  setRepeatDays: (days: number[]) => void;
  toggleRepeatDay: (day: number) => void;
  isDark: boolean;
}

const WEEKDAYS = [
  { day: 0, label: 'S', title: 'Sun' },
  { day: 1, label: 'M', title: 'Mon' },
  { day: 2, label: 'T', title: 'Tue' },
  { day: 3, label: 'W', title: 'Wed' },
  { day: 4, label: 'T', title: 'Thu' },
  { day: 5, label: 'F', title: 'Fri' },
  { day: 6, label: 'S', title: 'Sat' },
];

export const RecurrenceSection: React.FC<RecurrenceSectionProps> = ({
  repeatDays,
  setRepeatDays,
  toggleRepeatDay,
}) => {
  return (
    <View className="gap-2.5 pt-1">
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-semibold text-light-textMuted dark:text-dark-textMuted">
          Repeat on Days
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Pressable
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            onPress={() => setRepeatDays([0, 1, 2, 3, 4, 5, 6])}
            className="px-2 py-0.5 rounded-md bg-light-appBg dark:bg-white/5 active:scale-95"
          >
            <Text className="text-[10px] font-bold text-light-textMuted dark:text-dark-textMuted">
              Everyday
            </Text>
          </Pressable>
          <Pressable
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            onPress={() => setRepeatDays([1, 2, 3, 4, 5])}
            className="px-2 py-0.5 rounded-md bg-light-appBg dark:bg-white/5 active:scale-95"
          >
            <Text className="text-[10px] font-bold text-light-textMuted dark:text-dark-textMuted">
              Weekdays
            </Text>
          </Pressable>
          <Pressable
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            onPress={() => setRepeatDays([0, 6])}
            className="px-2 py-0.5 rounded-md bg-light-appBg dark:bg-white/5 active:scale-95"
          >
            <Text className="text-[10px] font-bold text-light-textMuted dark:text-dark-textMuted">
              Weekends
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-row items-center justify-between gap-1">
        {WEEKDAYS.map((d) => {
          const isSelected = repeatDays.includes(d.day);
          return (
            <Pressable
              key={`rep-day-${d.day}`}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              onPress={() => toggleRepeatDay(d.day)}
              accessibilityLabel={d.title}
              className={`flex-1 py-2 rounded-xl items-center justify-center ${
                isSelected
                  ? 'bg-lime-500 shadow-sm'
                  : 'bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/5'
              } active:scale-95`}
            >
              <Text
                className={`text-xs font-bold ${
                  isSelected
                    ? 'text-white'
                    : 'text-light-textSecondary dark:text-dark-textSecondary'
                }`}
              >
                {d.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
