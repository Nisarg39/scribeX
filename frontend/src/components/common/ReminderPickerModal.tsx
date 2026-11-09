/**
 * ScribeX Reminder Picker Modal
 * Accessible modal bottom sheet / dialog with presets and interactive cross-platform date/time selection.
 * Cross-platform compatible with Web, iOS, and Android with unified visual consistency.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, Pressable, TextInput, Platform, ScrollView } from 'react-native';
import { Bell, Clock, Calendar as CalendarIcon, X, Trash2, ChevronLeft, ChevronRight, Check, Repeat } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import {
  ReminderType,
  RecurringRule,
  parseReminderString,
  getNextOccurrence,
  formatRecurrenceLabel,
} from '../../types/reminder';

export interface ReminderPickerModalProps {
  visible: boolean;
  onClose: () => void;
  targetTitle: string;
  currentReminderAt?: string;
  initialReminderAt?: string;
  onSave?: (triggerAt: string | null) => void;
  onSaveReminder?: (triggerAt: string | null) => void;
}

function formatDisplayDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = d.getDate();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day} ${month}, ${hours}:${minutes} ${period}`;
  } catch {
    return isoString;
  }
}

function formatRemainingDuration(isoString: string): { text: string; isPast: boolean } {
  try {
    const target = new Date(isoString).getTime();
    if (isNaN(target)) return { text: '', isPast: false };
    const now = Date.now();
    const diffMs = target - now;

    if (diffMs <= 0) {
      const pastSec = Math.floor(-diffMs / 1000);
      if (pastSec < 60) return { text: 'Triggered just now', isPast: true };
      const pastMin = Math.floor(pastSec / 60);
      if (pastMin < 60) return { text: `Triggered ${pastMin}m ago`, isPast: true };
      const pastHr = Math.floor(pastMin / 60);
      return { text: `Triggered ${pastHr}h ago`, isPast: true };
    }

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
      return { text: `Triggers in ${days}d ${hours}h`, isPast: false };
    }
    if (hours > 0) {
      return { text: `Triggers in ${hours}h ${minutes}m`, isPast: false };
    }
    if (minutes > 0) {
      return { text: `Triggers in ${minutes}m`, isPast: false };
    }
    return { text: 'Triggers in < 1m', isPast: false };
  } catch {
    return { text: '', isPast: false };
  }
}

function getTodayString(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDefaultTimeString(): string {
  const now = new Date();
  const plus5Min = new Date(now.getTime() + 5 * 60 * 1000);
  const hh = String(plus5Min.getHours()).padStart(2, '0');
  const mm = String(plus5Min.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function parse24to12(time24: string): { hour12: number; minute: number; period: 'AM' | 'PM' } {
  const [hStr, mStr] = (time24 || '12:00').split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) h = 12;
  let m = parseInt(mStr, 10);
  if (isNaN(m)) m = 0;
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute: m, period };
}

function format12to24(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  let h = hour12 % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatDate(text: string, prevVal: string): string {
  if (prevVal && prevVal.endsWith('-') && text === prevVal.slice(0, -1)) {
    return text.slice(0, -1);
  }
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 4) return digits;
  const yearStr = digits.slice(0, 4);
  if (digits.length <= 6) {
    const mDigits = digits.slice(4);
    if (mDigits.length === 2) {
      let m = parseInt(mDigits, 10);
      if (m > 12) m = 12;
      if (m === 0) m = 1;
      return `${yearStr}-${String(m).padStart(2, '0')}`;
    }
    return `${yearStr}-${mDigits}`;
  }
  let m = parseInt(digits.slice(4, 6), 10);
  if (m > 12) m = 12;
  if (m === 0) m = 1;
  const monthStr = String(m).padStart(2, '0');
  const dDigits = digits.slice(6);
  if (dDigits.length === 2) {
    let d = parseInt(dDigits, 10);
    if (d > 31) d = 31;
    if (d === 0) d = 1;
    return `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
  }
  return `${yearStr}-${monthStr}-${dDigits}`;
}

export function formatTime12(text: string, prevVal: string, currentPeriod: 'AM' | 'PM'): { formatted: string; period: 'AM' | 'PM' } {
  let period = currentPeriod;
  if (/a/i.test(text)) period = 'AM';
  if (/p/i.test(text)) period = 'PM';

  if (prevVal && prevVal.endsWith(':') && text === prevVal.slice(0, -1)) {
    return { formatted: text.slice(0, -1), period };
  }

  const digits = text.replace(/\D/g, '').slice(0, 4);
  if (!digits) return { formatted: '', period };
  if (digits.length === 1) return { formatted: digits, period };

  let h = parseInt(digits.slice(0, 2), 10);
  if (h > 12) h = 12;
  if (h === 0) h = 12;
  const hStr = String(h).padStart(2, '0');

  if (digits.length === 2) {
    return { formatted: `${hStr}:`, period };
  }

  const mDigits = digits.slice(2);
  let m1 = parseInt(mDigits[0], 10);
  if (m1 > 5) m1 = 5;

  if (mDigits.length === 1) {
    return { formatted: `${hStr}:${m1}`, period };
  }

  let m = parseInt(mDigits, 10);
  if (m > 59) m = 59;
  const mStr = String(m).padStart(2, '0');
  return { formatted: `${hStr}:${mStr}`, period };
}

export function parseDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const trimmedDate = dateStr.trim();
  const trimmedTime = timeStr.trim();

  // Parse Date (support YYYY-MM-DD, YYYY/MM/DD, and MM/DD/YYYY)
  let year: number;
  let month: number;
  let day: number;

  const isoMatch = trimmedDate.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10) - 1;
    day = parseInt(isoMatch[3], 10);
  } else {
    const usMatch = trimmedDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (usMatch) {
      const first = parseInt(usMatch[1], 10);
      const second = parseInt(usMatch[2], 10);
      if (first > 12) {
        day = first;
        month = second - 1;
      } else {
        month = first - 1;
        day = second;
      }
      year = parseInt(usMatch[3], 10);
    } else {
      return null;
    }
  }

  // Parse Time (support 24-hr "14:30", "9:30", and 12-hr "9:30 AM", "2:15 pm", "11pm")
  let hours = 0;
  let minutes = 0;
  const timeMatch = trimmedTime.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?$/i);
  if (!timeMatch) return null;

  const rawH = parseInt(timeMatch[1], 10);
  const rawM = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  const period = timeMatch[3] ? timeMatch[3].toUpperCase() : null;

  if (period) {
    if (rawH < 1 || rawH > 12) return null;
    if (rawM < 0 || rawM > 59) return null;
    hours = period === 'AM' ? (rawH === 12 ? 0 : rawH) : (rawH === 12 ? 12 : rawH + 12);
    minutes = rawM;
  } else {
    if (rawH < 0 || rawH > 23) return null;
    if (rawM < 0 || rawM > 59) return null;
    hours = rawH;
    minutes = rawM;
  }

  const d = new Date(year, month, day, hours, minutes, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

export const ReminderPickerModal: React.FC<ReminderPickerModalProps> = ({
  visible,
  onClose,
  targetTitle,
  currentReminderAt,
  initialReminderAt,
  onSave,
  onSaveReminder,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const effectiveReminderAt = currentReminderAt ?? initialReminderAt;

  const handleSave = (val: string | null) => {
    if (onSave) onSave(val);
    if (onSaveReminder) onSaveReminder(val);
  };

  const [reminderType, setReminderType] = useState<ReminderType>('once');
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5]); // default Mon-Fri
  const [customDate, setCustomDate] = useState(getTodayString);
  const [customTime, setCustomTime] = useState(getDefaultTimeString);
  const [time12Text, setTime12Text] = useState(() => {
    const p = parse24to12(getDefaultTimeString());
    return `${String(p.hour12).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  });
  const [timePeriod, setTimePeriod] = useState<'AM' | 'PM'>(() => parse24to12(getDefaultTimeString()).period);
  const [currentTimeTick, setCurrentTimeTick] = useState(Date.now());

  // Mobile Calendar & Time Dropdown states
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth()); // 0-11

  // Periodically refresh the duration tick while modal is visible
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => setCurrentTimeTick(Date.now()), 5000);
    return () => clearInterval(interval);
  }, [visible]);

  // Load existing reminder configuration for seamless editing, or default to fresh state
  useEffect(() => {
    if (visible) {
      setIsCalendarOpen(false);
      setIsTimeDropdownOpen(false);
      const today = new Date();
      setCalYear(today.getFullYear());
      setCalMonth(today.getMonth());

      const parsed = parseReminderString(effectiveReminderAt);
      if (parsed?.type === 'repeat' && parsed.repeatRule) {
        setReminderType('repeat');
        setRepeatDays(parsed.repeatRule.days && parsed.repeatRule.days.length > 0 ? parsed.repeatRule.days : [1, 2, 3, 4, 5]);
        const timeVal = parsed.repeatRule.time || getDefaultTimeString();
        setCustomTime(timeVal);
        const p = parse24to12(timeVal);
        setTime12Text(`${String(p.hour12).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`);
        setTimePeriod(p.period);
        setCustomDate(getTodayString());
      } else if (parsed?.type === 'once' && parsed.triggerAt) {
        setReminderType('once');
        setRepeatDays([1, 2, 3, 4, 5]);
        const triggerDate = new Date(parsed.triggerAt);
        if (!isNaN(triggerDate.getTime())) {
          const yyyy = triggerDate.getFullYear();
          const mm = String(triggerDate.getMonth() + 1).padStart(2, '0');
          const dd = String(triggerDate.getDate()).padStart(2, '0');
          setCustomDate(`${yyyy}-${mm}-${dd}`);
          setCalYear(triggerDate.getFullYear());
          setCalMonth(triggerDate.getMonth());

          const hh = String(triggerDate.getHours()).padStart(2, '0');
          const min = String(triggerDate.getMinutes()).padStart(2, '0');
          const timeVal = `${hh}:${min}`;
          setCustomTime(timeVal);
          const p = parse24to12(timeVal);
          setTime12Text(`${String(p.hour12).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`);
          setTimePeriod(p.period);
        } else {
          setCustomDate(getTodayString());
          const defTime = getDefaultTimeString();
          setCustomTime(defTime);
          const p = parse24to12(defTime);
          setTime12Text(`${String(p.hour12).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`);
          setTimePeriod(p.period);
        }
      } else {
        setReminderType('once');
        setRepeatDays([1, 2, 3, 4, 5]);
        setCustomDate(getTodayString());
        const defTime = getDefaultTimeString();
        setCustomTime(defTime);
        const p = parse24to12(defTime);
        setTime12Text(`${String(p.hour12).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`);
        setTimePeriod(p.period);
      }
    }
  }, [visible, effectiveReminderAt]);

  // Next occurrence computation for recurring rule (must be at top level before any early return)
  const nextRepeatDate = useMemo(() => {
    if (repeatDays.length === 0) return null;
    return getNextOccurrence(
      { type: 'repeat', days: repeatDays, time: customTime },
      new Date(currentTimeTick)
    );
  }, [repeatDays, customTime, currentTimeTick]);

  const toggleRepeatDay = (day: number) => {
    setRepeatDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev; // Keep at least one day
        return prev.filter((d) => d !== day).sort((a, b) => a - b);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  // Handle strictly-formatted Date input typing
  const handleDateTextChange = (text: string) => {
    const formatted = formatDate(text, customDate);
    setCustomDate(formatted);
    if (formatted.length === 10) {
      const parsed = new Date(`${formatted}T12:00:00`);
      if (!isNaN(parsed.getTime())) {
        setCalYear(parsed.getFullYear());
        setCalMonth(parsed.getMonth());
      }
    }
  };

  // Handle strictly-formatted 12-hour Time input typing with a/p period switching
  const handleTimeTextChange = (text: string) => {
    const result = formatTime12(text, time12Text, timePeriod);
    setTime12Text(result.formatted);
    setTimePeriod(result.period);

    if (result.formatted.length === 5 && result.formatted.includes(':')) {
      const [hStr, mStr] = result.formatted.split(':');
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (!isNaN(h) && !isNaN(m)) {
        setCustomTime(format12to24(h, m, result.period));
      }
    }
  };

  // Upfront AM/PM Toggle Handler
  const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
    setTimePeriod(newPeriod);
    if (time12Text.length === 5 && time12Text.includes(':')) {
      const [hStr, mStr] = time12Text.split(':');
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (!isNaN(h) && !isNaN(m)) {
        setCustomTime(format12to24(h, m, newPeriod));
        return;
      }
    }
    const parsed = parse24to12(customTime);
    setCustomTime(format12to24(parsed.hour12, parsed.minute, newPeriod));
  };

  // Validation logic for current custom selection
  const parsedDateObj = parseDateTime(customDate, customTime);
  const isSelectedValid = parsedDateObj !== null;
  const isSelectedInFuture = isSelectedValid && parsedDateObj.getTime() > currentTimeTick;

  const remainingCustom = isSelectedValid
    ? formatRemainingDuration(parsedDateObj.toISOString())
    : { text: '', isPast: true };

  const nextRepeatRemaining = nextRepeatDate
    ? formatRemainingDuration(nextRepeatDate.toISOString())
    : { text: '', isPast: false };

  const canSave = reminderType === 'once' ? isSelectedInFuture : repeatDays.length > 0;

  const handleApplyCustom = () => {
    if (reminderType === 'once') {
      if (!isSelectedValid || !isSelectedInFuture || !parsedDateObj) {
        return;
      }
      handleSave(parsedDateObj.toISOString());
    } else {
      if (repeatDays.length === 0) return;
      const repeatPayload = JSON.stringify({
        type: 'repeat',
        days: repeatDays,
        time: customTime,
      });
      handleSave(repeatPayload);
    }
    onClose();
  };

  const handleClearReminder = () => {
    handleSave(null);
    onClose();
  };

  // Calendar month navigation
  const prevMonth = () => {
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const jumpToToday = () => {
    const today = new Date();
    setCalYear(today.getFullYear());
    setCalMonth(today.getMonth());
    setCustomDate(getTodayString());
    setIsCalendarOpen(false);
  };

  // Active reminder breakdown
  const activeParsed = parseReminderString(effectiveReminderAt);
  const activeRemaining = effectiveReminderAt && activeParsed?.type === 'once'
    ? formatRemainingDuration(effectiveReminderAt)
    : null;
  const activeRepeatNextDate = activeParsed?.type === 'repeat' && activeParsed.repeatRule
    ? getNextOccurrence(activeParsed.repeatRule, new Date(currentTimeTick))
    : null;
  const activeRepeatRemaining = activeRepeatNextDate
    ? formatRemainingDuration(activeRepeatNextDate.toISOString())
    : null;

  const todayStr = getTodayString();

  // Calendar Day Grid Computation
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay(); // 0 (Sun) - 6 (Sat)
  const daysInCurrentMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const dayCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    dayCells.push(null);
  }
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    dayCells.push(d);
  }

  const calMonthName = new Date(calYear, calMonth, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  const parsed12 = parse24to12(customTime);

  const hoursList = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutesList = Array.from({ length: 60 }, (_, i) => i);

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        onPress={() => {
          if (isCalendarOpen || isTimeDropdownOpen) {
            setIsCalendarOpen(false);
            setIsTimeDropdownOpen(false);
          } else {
            onClose();
          }
        }}
        className="flex-1 bg-black/65 items-center justify-center p-4 backdrop-blur-md"
      >
        <Pressable
          onPress={(e) => {
            if (e && typeof e.stopPropagation === 'function') {
              e.stopPropagation();
            }
            if (isCalendarOpen || isTimeDropdownOpen) {
              setIsCalendarOpen(false);
              setIsTimeDropdownOpen(false);
            }
          }}
          className="w-full max-w-sm rounded-3xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border p-5 shadow-2xl max-h-[90vh]"
        >
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Pressable
              onPress={() => {
                if (isCalendarOpen || isTimeDropdownOpen) {
                  setIsCalendarOpen(false);
                  setIsTimeDropdownOpen(false);
                }
              }}
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

            {/* Current Active Reminder - High-Craft Editorial Card */}
            {effectiveReminderAt && activeParsed && (
              <View className="mt-3.5 p-3 rounded-2xl bg-light-appBg dark:bg-dark-raised/70 border border-light-border dark:border-white/[0.08] flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                  <View
                    className={`w-9 h-9 rounded-xl items-center justify-center ${
                      activeParsed.type === 'repeat'
                        ? 'bg-lime-500/15'
                        : activeRemaining?.isPast
                        ? 'bg-amber-500/15'
                        : 'bg-lime-500/15'
                    }`}
                  >
                    <Bell
                      size={16}
                      color={
                        activeParsed.type === 'repeat'
                          ? '#84CC16'
                          : activeRemaining?.isPast
                          ? '#F59E0B'
                          : '#84CC16'
                      }
                      strokeWidth={2.2}
                    />
                  </View>
                  <View className="flex-1 justify-center">
                    <Text
                      numberOfLines={1}
                      className="text-sm font-semibold text-light-textPrimary dark:text-dark-textPrimary"
                    >
                      {activeParsed.type === 'repeat' && activeParsed.repeatRule
                        ? `🔁 ${formatRecurrenceLabel(activeParsed.repeatRule)}`
                        : formatDisplayDate(activeParsed.triggerAt || effectiveReminderAt)}
                    </Text>
                    <View className="flex-row items-center gap-1.5 mt-0.5">
                      <View
                        className={`w-1.5 h-1.5 rounded-full ${
                          activeParsed.type === 'repeat'
                            ? 'bg-lime-500 animate-pulse'
                            : activeRemaining?.isPast
                            ? 'bg-amber-500'
                            : 'bg-lime-500'
                        }`}
                      />
                      <Text
                        className={`text-xs font-medium ${
                          activeParsed.type === 'repeat'
                            ? 'text-lime-600 dark:text-lime-400'
                            : activeRemaining?.isPast
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-lime-600 dark:text-lime-400'
                        }`}
                      >
                        {activeParsed.type === 'repeat' && activeRepeatNextDate
                          ? `Next: ${formatDisplayDate(activeRepeatNextDate.toISOString())} (${activeRepeatRemaining?.text.replace('Triggers in ', 'in ') || ''})`
                          : activeRemaining?.text || 'Active Reminder'}
                      </Text>
                    </View>
                  </View>
                </View>

                <Pressable
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={handleClearReminder}
                  accessibilityLabel="Clear Reminder"
                  className="px-3 py-1.5 rounded-xl bg-red-500/15 dark:bg-red-500/20 border border-red-500/30 dark:border-red-500/40 hover:bg-red-500/25 active:bg-red-500/30 active:scale-95 flex-row items-center gap-1.5"
                >
                  <Trash2 size={13} color={isDark ? '#F87171' : '#EF4444'} strokeWidth={2.2} />
                  <Text className="text-xs font-bold text-red-600 dark:text-red-400">
                    Clear
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Interactive Reminder Configuration Section */}
            <View className="mt-4 gap-3.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted">
                  {reminderType === 'once' ? 'Pick Date & Time' : 'Recurring Schedule'}
                </Text>
              </View>

              {/* Mode Switcher Pill: Once vs Repeat */}
              <View className="flex-row p-1 rounded-2xl bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-dark-border">
                <Pressable
                  onPress={() => setReminderType('once')}
                  className={`flex-1 py-1.5 rounded-xl items-center justify-center ${
                    reminderType === 'once'
                      ? 'bg-lime-500 shadow-sm'
                      : 'bg-transparent active:opacity-70'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      reminderType === 'once'
                        ? 'text-white'
                        : 'text-light-textMuted dark:text-dark-textMuted'
                    }`}
                  >
                    Once
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setReminderType('repeat')}
                  className={`flex-1 py-1.5 rounded-xl items-center justify-center ${
                    reminderType === 'repeat'
                      ? 'bg-lime-500 shadow-sm'
                      : 'bg-transparent active:opacity-70'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      reminderType === 'repeat'
                        ? 'text-white'
                        : 'text-light-textMuted dark:text-dark-textMuted'
                    }`}
                  >
                    Repeat
                  </Text>
                </Pressable>
              </View>

                {Platform.OS === 'web' ? (
                  /* Semantic HTML5 Date & Time Pickers for Web */
                  <View className="gap-3">
                    {reminderType === 'once' && (
                      <View>
                        <Text className="text-[11px] font-semibold text-light-textMuted dark:text-dark-textMuted mb-1">
                          Date (minimum: Today)
                        </Text>
                        <input
                          type="date"
                          min={todayStr}
                          value={customDate}
                          onChange={(e) => setCustomDate(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '12px',
                            backgroundColor: isDark ? '#1C1D22' : '#F4F4F5',
                            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                            color: isDark ? '#FFFFFF' : '#111111',
                            fontSize: '14px',
                            fontWeight: '500',
                            colorScheme: isDark ? 'dark' : 'light',
                            outline: 'none',
                          }}
                        />
                      </View>
                    )}

                    <View>
                      <Text className="text-[11px] font-semibold text-light-textMuted dark:text-dark-textMuted mb-1">
                        Time (12-hour)
                      </Text>
                      <input
                        type="time"
                        value={customTime}
                        onChange={(e) => {
                          setCustomTime(e.target.value);
                          const p = parse24to12(e.target.value);
                          setTime12Text(`${String(p.hour12).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`);
                          setTimePeriod(p.period);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '12px',
                          backgroundColor: isDark ? '#1C1D22' : '#F4F4F5',
                          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                          color: isDark ? '#FFFFFF' : '#111111',
                          fontSize: '14px',
                          fontWeight: '500',
                          colorScheme: isDark ? 'dark' : 'light',
                          outline: 'none',
                        }}
                      />
                    </View>

                    {reminderType === 'repeat' && (
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
                          {[
                            { day: 0, label: 'S', title: 'Sun' },
                            { day: 1, label: 'M', title: 'Mon' },
                            { day: 2, label: 'T', title: 'Tue' },
                            { day: 3, label: 'W', title: 'Wed' },
                            { day: 4, label: 'T', title: 'Thu' },
                            { day: 5, label: 'F', title: 'Fri' },
                            { day: 6, label: 'S', title: 'Sat' },
                          ].map((d) => {
                            const isSelected = repeatDays.includes(d.day);
                            return (
                              <Pressable
                                key={`rep-web-day-${d.day}`}
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
                    )}
                  </View>
                ) : (
                  /* Native Interactive Input Boxes with Keyboard Typing + Dropdowns for Android & iOS */
                  <View className="gap-3">
                    {/* Date Input Field with Calendar Dropdown Trigger */}
                    {reminderType === 'once' && (
                      <View>
                        <Text className="text-[11px] font-semibold text-light-textMuted dark:text-dark-textMuted mb-1">
                          Date (minimum: Today)
                        </Text>
                        <View className="flex-row items-center justify-between px-3 py-2 rounded-xl bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-dark-border">
                          <TextInput
                            value={customDate}
                            onChangeText={handleDateTextChange}
                            onFocus={() => {
                              setIsCalendarOpen(false);
                              setIsTimeDropdownOpen(false);
                            }}
                            placeholder="YYYY-MM-DD"
                            keyboardType="numeric"
                            maxLength={10}
                            placeholderTextColor={isDark ? '#666666' : '#999999'}
                            className="flex-1 text-sm font-medium text-light-textPrimary dark:text-dark-textPrimary p-0"
                          />
                          <Pressable
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() => {
                              setIsCalendarOpen(!isCalendarOpen);
                              setIsTimeDropdownOpen(false);
                            }}
                            accessibilityLabel="Toggle Calendar Dropdown"
                            className="p-1 rounded-lg bg-light-surface dark:bg-white/10 active:scale-95 ml-2"
                          >
                            <CalendarIcon size={16} color={isDark ? '#E4E4E7' : '#52525B'} />
                          </Pressable>
                        </View>

                        {/* Calendar Dropdown UI (Matches Web Month Picker) */}
                        {isCalendarOpen && (
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
                                      onPress={() => {
                                        setCustomDate(formattedDayStr);
                                        setIsCalendarOpen(false);
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
                                onPress={jumpToToday}
                                className="px-2.5 py-1 rounded-full bg-lime-500/15 active:scale-95"
                              >
                                <Text className="text-[10px] font-bold text-lime-600 dark:text-lime-400">
                                  Today
                                </Text>
                              </Pressable>

                              <Pressable
                                onPress={() => setIsCalendarOpen(false)}
                                className="px-2.5 py-1 rounded-full bg-light-appBg dark:bg-white/10 active:scale-95"
                              >
                                <Text className="text-[10px] font-bold text-light-textMuted dark:text-dark-textMuted">
                                  Close
                                </Text>
                              </Pressable>
                            </View>
                          </Pressable>
                        )}
                      </View>
                    )}

                    {/* Time Input Field with Upfront AM/PM & Dropdown Trigger */}
                    <View>
                      <Text className="text-[11px] font-semibold text-light-textMuted dark:text-dark-textMuted mb-1">
                        Time (12-hour)
                      </Text>
                      <View className="flex-row items-center justify-between px-3 py-2 rounded-xl bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-dark-border">
                        <TextInput
                          value={time12Text}
                          onChangeText={handleTimeTextChange}
                          onFocus={() => {
                            setIsCalendarOpen(false);
                            setIsTimeDropdownOpen(false);
                          }}
                          placeholder="HH:mm"
                          keyboardType="default"
                          maxLength={5}
                          placeholderTextColor={isDark ? '#666666' : '#999999'}
                          className="flex-1 text-sm font-medium text-light-textPrimary dark:text-dark-textPrimary p-0"
                        />

                        {/* Upfront AM / PM Switcher Pill */}
                        <View className="flex-row items-center bg-light-surface dark:bg-white/10 rounded-lg p-0.5 mx-2 border border-light-border/60 dark:border-white/5">
                          <Pressable
                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                            onPress={() => handlePeriodChange('AM')}
                            className={`px-2 py-0.5 rounded-md ${timePeriod === 'AM' ? 'bg-lime-500' : 'bg-transparent active:opacity-70'}`}
                          >
                            <Text className={`text-[11px] font-bold ${timePeriod === 'AM' ? 'text-white' : 'text-light-textMuted dark:text-dark-textMuted'}`}>
                              AM
                            </Text>
                          </Pressable>
                          <Pressable
                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                            onPress={() => handlePeriodChange('PM')}
                            className={`px-2 py-0.5 rounded-md ${timePeriod === 'PM' ? 'bg-lime-500' : 'bg-transparent active:opacity-70'}`}
                          >
                            <Text className={`text-[11px] font-bold ${timePeriod === 'PM' ? 'text-white' : 'text-light-textMuted dark:text-dark-textMuted'}`}>
                              PM
                            </Text>
                          </Pressable>
                        </View>

                        <Pressable
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          onPress={() => {
                            setIsTimeDropdownOpen(!isTimeDropdownOpen);
                            setIsCalendarOpen(false);
                          }}
                          accessibilityLabel="Toggle Time Picker Dropdown"
                          className="p-1 rounded-lg bg-light-surface dark:bg-white/10 active:scale-95"
                        >
                          <Clock size={16} color={isDark ? '#E4E4E7' : '#52525B'} />
                        </Pressable>
                      </View>

                      {/* Time Dropdown UI (3 Columns: Hour, Minute, Period) */}
                      {isTimeDropdownOpen && (
                        <Pressable
                          onPress={(e) => {
                            if (e && typeof e.stopPropagation === 'function') {
                              e.stopPropagation();
                            }
                          }}
                          className="mt-2 p-3 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-xl"
                        >
                          <Text className="text-[10px] font-bold text-light-textMuted dark:text-dark-textMuted uppercase tracking-wider mb-2 text-center">
                            Select Time
                          </Text>

                          <View className="flex-row items-center justify-between h-36">
                            {/* Column 1: Hours (1-12) */}
                            <View className="flex-1 items-center">
                              <Text className="text-[9px] font-bold text-light-textMuted dark:text-dark-textMuted mb-1">
                                Hour
                              </Text>
                              <ScrollView className="w-full" showsVerticalScrollIndicator={false}>
                                {hoursList.map((h) => {
                                  const isHourSelected = parsed12.hour12 === h;
                                  return (
                                    <Pressable
                                      key={`hour-${h}`}
                                      onPress={() => {
                                        setCustomTime(format12to24(h, parsed12.minute, timePeriod));
                                        setTime12Text(`${String(h).padStart(2, '0')}:${String(parsed12.minute).padStart(2, '0')}`);
                                      }}
                                      className={`py-1.5 my-0.5 rounded-lg items-center ${
                                        isHourSelected ? 'bg-lime-500' : 'active:bg-white/5'
                                      }`}
                                    >
                                      <Text
                                        className={`text-xs ${
                                          isHourSelected ? 'font-bold text-white' : 'text-light-textPrimary dark:text-dark-textPrimary'
                                        }`}
                                      >
                                        {String(h).padStart(2, '0')}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </ScrollView>
                            </View>

                            <View className="w-px h-full bg-light-border/40 dark:border-white/10 mx-1" />

                            {/* Column 2: Minutes (00-59 every minute) */}
                            <View className="flex-1 items-center">
                              <Text className="text-[9px] font-bold text-light-textMuted dark:text-dark-textMuted mb-1">
                                Min
                              </Text>
                              <ScrollView className="w-full" showsVerticalScrollIndicator={false}>
                                {minutesList.map((m) => {
                                  const isMinSelected = parsed12.minute === m;
                                  return (
                                    <Pressable
                                      key={`min-${m}`}
                                      onPress={() => {
                                        setCustomTime(format12to24(parsed12.hour12, m, timePeriod));
                                        setTime12Text(`${String(parsed12.hour12).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                                      }}
                                      className={`py-1.5 my-0.5 rounded-lg items-center ${
                                        isMinSelected ? 'bg-lime-500' : 'active:bg-white/5'
                                      }`}
                                    >
                                      <Text
                                        className={`text-xs ${
                                          isMinSelected ? 'font-bold text-white' : 'text-light-textPrimary dark:text-dark-textPrimary'
                                        }`}
                                      >
                                        {String(m).padStart(2, '0')}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </ScrollView>
                            </View>

                            <View className="w-px h-full bg-light-border/40 dark:border-white/10 mx-1" />

                            {/* Column 3: Period (AM / PM) */}
                            <View className="flex-1 items-center">
                              <Text className="text-[9px] font-bold text-light-textMuted dark:text-dark-textMuted mb-1">
                                Period
                              </Text>
                              <View className="gap-2 mt-2 w-full px-1">
                                {(['AM', 'PM'] as const).map((p) => {
                                  const isPeriodSelected = timePeriod === p;
                                  return (
                                    <Pressable
                                      key={p}
                                      onPress={() => handlePeriodChange(p)}
                                      className={`py-2 rounded-lg items-center ${
                                        isPeriodSelected ? 'bg-lime-500' : 'bg-light-appBg dark:bg-white/5 active:scale-95'
                                      }`}
                                    >
                                      <Text
                                        className={`text-xs font-bold ${
                                          isPeriodSelected ? 'text-white' : 'text-light-textPrimary dark:text-dark-textPrimary'
                                        }`}
                                      >
                                        {p}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            </View>
                          </View>

                          {/* Done Button */}
                          <Pressable
                            onPress={() => setIsTimeDropdownOpen(false)}
                            className="mt-2.5 py-1.5 rounded-xl bg-lime-500/15 items-center justify-center active:scale-95"
                          >
                            <Text className="text-xs font-bold text-lime-600 dark:text-lime-400">
                              Done
                            </Text>
                          </Pressable>
                        </Pressable>
                      )}
                    </View>

                    {/* Mobile Weekday Selector for Recurring Mode */}
                    {reminderType === 'repeat' && (
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
                          {[
                            { day: 0, label: 'S', title: 'Sun' },
                            { day: 1, label: 'M', title: 'Mon' },
                            { day: 2, label: 'T', title: 'Tue' },
                            { day: 3, label: 'W', title: 'Wed' },
                            { day: 4, label: 'T', title: 'Thu' },
                            { day: 5, label: 'F', title: 'Fri' },
                            { day: 6, label: 'S', title: 'Sat' },
                          ].map((d) => {
                            const isSelected = repeatDays.includes(d.day);
                            return (
                              <Pressable
                                key={`rep-mob-day-${d.day}`}
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
                    )}
                  </View>
                )}

                {/* Live Duration / Validation Feedback */}
                <View className="py-1">
                  {reminderType === 'once' ? (
                    isSelectedInFuture ? (
                      <View className="p-2.5 rounded-2xl bg-lime-500/10 border border-lime-500/20">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-1.5">
                            <View className="w-2 h-2 rounded-full bg-lime-500 animate-pulse" />
                            <Text className="text-[11px] font-bold text-lime-600 dark:text-lime-400 uppercase tracking-wider">
                              Scheduled
                            </Text>
                          </View>
                          <Text className="text-xs font-bold text-lime-700 dark:text-lime-300">
                            {remainingCustom.text}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View className="p-2.5 rounded-2xl bg-red-500/10 border border-red-500/20">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-1.5">
                            <View className="w-2 h-2 rounded-full bg-red-500" />
                            <Text className="text-[11px] font-bold text-red-500 uppercase tracking-wider">
                              Invalid Time
                            </Text>
                          </View>
                          <Text className="text-xs font-medium text-red-500">
                            Must be later than now
                          </Text>
                        </View>
                      </View>
                    )
                  ) : (
                    repeatDays.length > 0 && nextRepeatDate ? (
                      <View className="p-2.5 rounded-2xl bg-lime-500/10 border border-lime-500/20">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-1.5">
                            <View className="w-2 h-2 rounded-full bg-lime-500 animate-pulse" />
                            <Text className="text-[11px] font-bold text-lime-600 dark:text-lime-400 uppercase tracking-wider">
                              Scheduled
                            </Text>
                          </View>
                          <Text className="text-xs font-bold text-lime-700 dark:text-lime-300">
                            Next: {formatDisplayDate(nextRepeatDate.toISOString())} ({nextRepeatRemaining.text.replace('Triggers in ', 'in ')})
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View className="p-2.5 rounded-2xl bg-red-500/10 border border-red-500/20">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-1.5">
                            <View className="w-2 h-2 rounded-full bg-red-500" />
                            <Text className="text-[11px] font-bold text-red-500 uppercase tracking-wider">
                              Select Day
                            </Text>
                          </View>
                          <Text className="text-xs font-medium text-red-500">
                            Select at least one day
                          </Text>
                        </View>
                      </View>
                    )
                  )}
                </View>

                {/* Action Buttons */}
                <View className="flex-row items-center gap-2 pt-1.5">
                  <Pressable
                    onPress={onClose}
                    className="flex-1 py-2.5 rounded-xl bg-light-appBg dark:bg-dark-raised items-center justify-center active:scale-95"
                  >
                    <Text className="text-xs font-bold text-light-textSecondary dark:text-dark-textSecondary">
                      Cancel
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={!canSave}
                    onPress={handleApplyCustom}
                    className={`flex-1 py-2.5 rounded-xl items-center justify-center active:scale-95 ${
                      canSave
                        ? 'bg-lime-500 dark:bg-lime-400'
                        : 'bg-light-border/40 dark:bg-white/10 opacity-50'
                    }`}
                  >
                    <Text className={`text-xs font-bold ${canSave ? 'text-white dark:text-[#111111]' : 'text-light-textMuted dark:text-dark-textMuted'}`}>
                      Set Reminder
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};


