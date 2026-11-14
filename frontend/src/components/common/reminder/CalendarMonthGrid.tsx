import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

export interface CalendarMonthGridProps {
  isOpen: boolean;
  onClose: () => void;
  calYear: number;
  calMonth: number;
  calMonthName: string;
  dayCells: (number | null)[];
  prevMonth: () => void;
  nextMonth: () => void;
  customDate: string;
  setCustomDate: (dateStr: string) => void;
  jumpToToday: () => void;
  isDark: boolean;
}

export const CalendarMonthGrid: React.FC<CalendarMonthGridProps> = ({
  isOpen,
  onClose,
  calYear,
  calMonth,
  calMonthName,
  dayCells,
  prevMonth,
  nextMonth,
  customDate,
  setCustomDate,
  jumpToToday,
  isDark,
}) => {
  if (!isOpen) return null;

  return (
    <Pressable
      onPress={(e) => {
        if (e && typeof e.stopPropagation === 'function') {
          e.stopPropagation();
        }
      }}
      className="mt-2 p-3 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-xl"
    >
      {/* Calendar Header with Month/Year & Navigation */}
      <View className="flex-row items-center justify-between pb-2 mb-2 border-b border-light-border/40 dark:border-white/5">
        <Pressable
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={prevMonth}
          className="p-1 rounded-full bg-light-appBg dark:bg-white/10 active:scale-95"
        >
          <ChevronLeft size={16} color={isDark ? '#FFFFFF' : '#111111'} />
        </Pressable>

        <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
          {calMonthName}
        </Text>

        <Pressable
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={nextMonth}
          className="p-1 rounded-full bg-light-appBg dark:bg-white/10 active:scale-95"
        >
          <ChevronRight size={16} color={isDark ? '#FFFFFF' : '#111111'} />
        </Pressable>
      </View>

      {/* Weekdays Header */}
      <View className="flex-row justify-between mb-1.5 px-0.5">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayChar, idx) => (
          <View key={idx} className="w-[13.5%] items-center">
            <Text className="text-[10px] font-semibold text-light-textMuted dark:text-dark-textMuted">
              {dayChar}
            </Text>
          </View>
        ))}
      </View>

      {/* Days Grid */}
      <View className="flex-row flex-wrap">
        {dayCells.map((dayNum, idx) => {
          if (dayNum === null) {
            return <View key={`empty-${idx}`} className="w-[14.28%] h-7" />;
          }

          const cellDate = new Date(calYear, calMonth, dayNum);
          cellDate.setHours(0, 0, 0, 0);
          const todayObj = new Date();
          todayObj.setHours(0, 0, 0, 0);

          const isPast = cellDate < todayObj;
          const isToday = cellDate.getTime() === todayObj.getTime();
          const formattedDayStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const isSelected = customDate === formattedDayStr;

          return (
            <View key={`day-${dayNum}`} className="w-[14.28%] h-8 items-center justify-center p-0.5">
              <Pressable
                disabled={isPast}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                onPress={() => {
                  setCustomDate(formattedDayStr);
                  onClose();
                }}
                className={`w-full h-full rounded-lg items-center justify-center ${
                  isSelected
                    ? 'bg-lime-500'
                    : isToday
                    ? 'border border-lime-500/50 bg-lime-500/10'
                    : isPast
                    ? 'opacity-25'
                    : 'active:bg-light-appBg dark:active:bg-white/10'
                }`}
              >
                <Text
                  className={`text-xs ${
                    isSelected
                      ? 'font-bold text-white'
                      : isPast
                      ? 'text-light-textMuted dark:text-dark-textMuted'
                      : 'font-medium text-light-textPrimary dark:text-dark-textPrimary'
                  }`}
                >
                  {dayNum}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Calendar Quick Footer */}
      <View className="flex-row items-center justify-between pt-2 mt-2 border-t border-light-border/40 dark:border-white/5">
        <Pressable
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={jumpToToday}
          className="px-2.5 py-1 rounded-full bg-lime-500/15 active:scale-95"
        >
          <Text className="text-[10px] font-bold text-lime-600 dark:text-lime-400">
            Today
          </Text>
        </Pressable>

        <Pressable
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={onClose}
          className="px-2.5 py-1 rounded-full bg-light-appBg dark:bg-white/10 active:scale-95"
        >
          <Text className="text-[10px] font-bold text-light-textMuted dark:text-dark-textMuted">
            Close
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
};
