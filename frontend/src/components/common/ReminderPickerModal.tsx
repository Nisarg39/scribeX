/**
 * ScribeX Reminder Picker Modal
 * Accessible modal bottom sheet / dialog with presets and custom date/time selection.
 * Cross-platform compatible with Web, iOS, and Android.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, TextInput, Platform } from 'react-native';
import { Bell, Clock, Calendar, X, Check, Trash2 } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';

export interface ReminderPickerModalProps {
  visible: boolean;
  onClose: () => void;
  targetTitle: string;
  currentReminderAt?: string;
  onSave: (triggerAt: string | null) => void;
}

function formatDisplayDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function getPresetLaterToday(): Date {
  const now = new Date();
  const later = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
  return later;
}

function getPresetTomorrowMorning(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function getPresetNextWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  const daysUntilMonday = ((1 + 7 - day) % 7) || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(9, 0, 0, 0);
  return d;
}

export const ReminderPickerModal: React.FC<ReminderPickerModalProps> = ({
  visible,
  onClose,
  targetTitle,
  currentReminderAt,
  onSave,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('09:00');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setErrorMsg(null);
      setIsCustomMode(false);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      setCustomDate(`${yyyy}-${mm}-${dd}`);
      setCustomTime('09:00');
    }
  }, [visible]);

  if (!visible) return null;

  const handleApplyPreset = (date: Date) => {
    if (date.getTime() <= Date.now()) {
      setErrorMsg('Selected reminder time must be in the future.');
      return;
    }
    onSave(date.toISOString());
    onClose();
  };

  const handleApplyCustom = () => {
    if (!customDate || !customTime) {
      setErrorMsg('Please specify both date and time.');
      return;
    }
    const combined = new Date(`${customDate}T${customTime}:00`);
    if (isNaN(combined.getTime())) {
      setErrorMsg('Invalid date/time format. Use YYYY-MM-DD and HH:mm.');
      return;
    }
    if (combined.getTime() <= Date.now()) {
      setErrorMsg('Reminder must be scheduled in the future.');
      return;
    }
    onSave(combined.toISOString());
    onClose();
  };

  const handleClearReminder = () => {
    onSave(null);
    onClose();
  };

  const laterToday = getPresetLaterToday();
  const tomorrowMorning = getPresetTomorrowMorning();
  const nextWeek = getPresetNextWeek();

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/65 items-center justify-center p-4 backdrop-blur-md"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-3xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border p-5 shadow-2xl"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-light-border/40 dark:border-white/5">
            <View className="flex-row items-center gap-2.5 flex-1 pr-2">
              <View className="w-8 h-8 rounded-full bg-lime-500/10 items-center justify-center">
                <Bell size={16} color="#84CC16" strokeWidth={2.2} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Set Reminder
                </Text>
                <Text
                  numberOfLines={1}
                  className="text-xs text-light-textMuted dark:text-dark-textMuted"
                >
                  {targetTitle || 'Item reminder'}
                </Text>
              </View>
            </View>

            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onClose}
              accessibilityLabel="Close"
              className="w-8 h-8 rounded-full items-center justify-center bg-light-appBg dark:bg-dark-raised active:scale-95"
            >
              <X size={15} color={isDark ? '#AAAAAA' : '#666666'} />
            </Pressable>
          </View>

          {/* Current Scheduled Status */}
          {currentReminderAt && (
            <View className="mt-3.5 p-3 rounded-2xl bg-lime-500/10 border border-lime-500/20 flex-row items-center justify-between">
              <View className="flex-1 pr-2">
                <Text className="text-[11px] font-bold text-lime-600 dark:text-lime-400 uppercase tracking-wider">
                  Active Reminder
                </Text>
                <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary mt-0.5">
                  {formatDisplayDate(currentReminderAt)}
                </Text>
              </View>

              <Pressable
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={handleClearReminder}
                accessibilityLabel="Clear Reminder"
                className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full bg-red-500/10 active:scale-95"
              >
                <Trash2 size={12} color="#EF4444" />
                <Text className="text-[11px] font-bold text-red-500">
                  Clear
                </Text>
              </Pressable>
            </View>
          )}

          {/* Presets List */}
          {!isCustomMode ? (
            <View className="mt-4 gap-2">
              <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-1">
                Quick Presets
              </Text>

              {/* Preset 1: Later Today */}
              <Pressable
                onPress={() => handleApplyPreset(laterToday)}
                className="flex-row items-center justify-between p-3 rounded-2xl bg-light-appBg dark:bg-dark-raised border border-light-border/40 dark:border-white/5 active:scale-[0.98]"
              >
                <View className="flex-row items-center gap-3">
                  <Clock size={16} color={isDark ? '#A1A1AA' : '#71717A'} />
                  <View>
                    <Text className="text-sm font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                      Later Today
                    </Text>
                    <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                      {formatDisplayDate(laterToday.toISOString())}
                    </Text>
                  </View>
                </View>
                <Text className="text-xs font-bold text-lime-600 dark:text-lime-400">
                  Select
                </Text>
              </Pressable>

              {/* Preset 2: Tomorrow Morning */}
              <Pressable
                onPress={() => handleApplyPreset(tomorrowMorning)}
                className="flex-row items-center justify-between p-3 rounded-2xl bg-light-appBg dark:bg-dark-raised border border-light-border/40 dark:border-white/5 active:scale-[0.98]"
              >
                <View className="flex-row items-center gap-3">
                  <Calendar size={16} color={isDark ? '#A1A1AA' : '#71717A'} />
                  <View>
                    <Text className="text-sm font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                      Tomorrow Morning
                    </Text>
                    <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                      {formatDisplayDate(tomorrowMorning.toISOString())}
                    </Text>
                  </View>
                </View>
                <Text className="text-xs font-bold text-lime-600 dark:text-lime-400">
                  Select
                </Text>
              </Pressable>

              {/* Preset 3: Next Week */}
              <Pressable
                onPress={() => handleApplyPreset(nextWeek)}
                className="flex-row items-center justify-between p-3 rounded-2xl bg-light-appBg dark:bg-dark-raised border border-light-border/40 dark:border-white/5 active:scale-[0.98]"
              >
                <View className="flex-row items-center gap-3">
                  <Calendar size={16} color={isDark ? '#A1A1AA' : '#71717A'} />
                  <View>
                    <Text className="text-sm font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                      Next Week (Monday)
                    </Text>
                    <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                      {formatDisplayDate(nextWeek.toISOString())}
                    </Text>
                  </View>
                </View>
                <Text className="text-xs font-bold text-lime-600 dark:text-lime-400">
                  Select
                </Text>
              </Pressable>

              {/* Custom Date / Time Button */}
              <Pressable
                onPress={() => setIsCustomMode(true)}
                className="mt-1 py-2.5 items-center justify-center rounded-2xl bg-transparent border border-dashed border-light-border dark:border-white/20 active:scale-[0.98]"
              >
                <Text className="text-xs font-bold text-light-textSecondary dark:text-dark-textSecondary">
                  Custom Date & Time...
                </Text>
              </Pressable>
            </View>
          ) : (
            /* Custom Date & Time View */
            <View className="mt-4 gap-3">
              <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted">
                Pick Custom Time
              </Text>

              <View>
                <Text className="text-[11px] font-medium text-light-textMuted dark:text-dark-textMuted mb-1">
                  Date (YYYY-MM-DD)
                </Text>
                <TextInput
                  value={customDate}
                  onChangeText={setCustomDate}
                  placeholder="2026-11-10"
                  placeholderTextColor={isDark ? '#666666' : '#999999'}
                  className="px-3 py-2 rounded-xl bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-dark-border text-sm font-medium text-light-textPrimary dark:text-dark-textPrimary"
                />
              </View>

              <View>
                <Text className="text-[11px] font-medium text-light-textMuted dark:text-dark-textMuted mb-1">
                  Time (HH:mm, 24-hour)
                </Text>
                <TextInput
                  value={customTime}
                  onChangeText={setCustomTime}
                  placeholder="09:00"
                  placeholderTextColor={isDark ? '#666666' : '#999999'}
                  className="px-3 py-2 rounded-xl bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-dark-border text-sm font-medium text-light-textPrimary dark:text-dark-textPrimary"
                />
              </View>

              {errorMsg && (
                <Text className="text-xs text-red-500 font-medium">
                  {errorMsg}
                </Text>
              )}

              <View className="flex-row items-center gap-2 pt-2">
                <Pressable
                  onPress={() => setIsCustomMode(false)}
                  className="flex-1 py-2.5 rounded-xl bg-light-appBg dark:bg-dark-raised items-center justify-center active:scale-95"
                >
                  <Text className="text-xs font-bold text-light-textSecondary dark:text-dark-textSecondary">
                    Back
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleApplyCustom}
                  className="flex-1 py-2.5 rounded-xl bg-light-iconBg dark:bg-white items-center justify-center active:scale-95"
                >
                  <Text className="text-xs font-bold text-white dark:text-[#111111]">
                    Set Reminder
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {errorMsg && !isCustomMode && (
            <Text className="text-xs text-red-500 font-medium mt-2">
              {errorMsg}
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

