/**
 * ScribeX In-App Notification Center
 * Floating popover / drawer (z-50) overlay with zero displacement of underlying content.
 * Compatible with Web, iOS, and Android.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import {
  Bell,
  Check,
  CheckCheck,
  CheckSquare,
  FileText,
  Trash2,
  X,
  Clock,
  Repeat,
  Sparkles,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useNotesStore } from '../../state/useNotesStore';
import { InAppNotificationItem, NotificationTargetType } from '../../db/types';
import {
  parseReminderString,
  getNextOccurrence,
  formatRecurrenceLabel,
  RecurringRule,
} from '../../types/reminder';

interface NotificationCenterModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToTarget?: (targetType: NotificationTargetType, targetId: string, noteId?: string) => void;
}

type FilterCategory = 'all' | 'unread' | 'task' | 'note';

function formatNotificationTime(isoString: string): string {
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

function formatRelativeDuration(isoString: string): { text: string; isPast: boolean } {
  try {
    const target = new Date(isoString).getTime();
    if (isNaN(target)) return { text: '', isPast: false };
    const now = Date.now();
    const diffMs = target - now;

    if (diffMs <= 0) {
      const pastSec = Math.floor(-diffMs / 1000);
      if (pastSec < 60) return { text: 'Just now', isPast: true };
      const pastMin = Math.floor(pastSec / 60);
      if (pastMin < 60) return { text: `${pastMin}m ago`, isPast: true };
      const pastHr = Math.floor(pastMin / 60);
      if (pastHr < 24) return { text: `${pastHr}h ago`, isPast: true };
      const pastDays = Math.floor(pastHr / 24);
      return { text: `${pastDays}d ago`, isPast: true };
    }

    const futureSec = Math.floor(diffMs / 1000);
    if (futureSec < 60) return { text: 'In <1m', isPast: false };
    const futureMin = Math.floor(futureSec / 60);
    if (futureMin < 60) return { text: `In ${futureMin}m`, isPast: false };
    const futureHr = Math.floor(futureMin / 60);
    const remMin = futureMin % 60;
    if (futureHr < 24) {
      return { text: remMin > 0 ? `In ${futureHr}h ${remMin}m` : `In ${futureHr}h`, isPast: false };
    }
    const futureDays = Math.floor(futureHr / 24);
    const remHr = futureHr % 24;
    return { text: remHr > 0 ? `In ${futureDays}d ${remHr}h` : `In ${futureDays}d`, isPast: false };
  } catch {
    return { text: '', isPast: false };
  }
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  visible,
  onClose,
  onNavigateToTarget,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const {
    notes,
    tasks,
    notifications,
    unreadNotificationsCount,
    notificationCounts,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotification,
    clearAllNotifications,
    refreshNotifications,
  } = useNotesStore();

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [displayedPage, setDisplayedPage] = useState<number>(1);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const PAGE_SIZE = 4;

  useEffect(() => {
    if (visible) {
      refreshNotifications();
      setDisplayedPage(1);
    }
  }, [visible]);

  useEffect(() => {
    setDisplayedPage(1);
  }, [activeFilter]);

  const counts = useMemo(() => {
    return {
      all: notificationCounts?.all ?? notifications.length,
      unread: notificationCounts?.unread ?? unreadNotificationsCount,
      tasks: notificationCounts?.tasks ?? notifications.filter((n) => n.targetType === 'task').length,
      notes: notificationCounts?.notes ?? notifications.filter((n) => n.targetType === 'note').length,
    };
  }, [notificationCounts, notifications, unreadNotificationsCount]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (activeFilter === 'unread') return !item.isRead;
      if (activeFilter === 'task') return item.targetType === 'task';
      if (activeFilter === 'note') return item.targetType === 'note';
      return true;
    });
  }, [notifications, activeFilter]);

  const paginatedNotifications = useMemo(() => {
    return filteredNotifications.slice(0, displayedPage * PAGE_SIZE);
  }, [filteredNotifications, displayedPage]);

  const hasMore = paginatedNotifications.length < filteredNotifications.length;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (!layoutMeasurement || !contentSize) return;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
    if (isCloseToBottom && hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      setTimeout(() => {
        setDisplayedPage((prev) => prev + 1);
        setIsLoadingMore(false);
      }, 100);
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      setTimeout(() => {
        setDisplayedPage((prev) => prev + 1);
        setIsLoadingMore(false);
      }, 80);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
      statusBarTranslucent
    >
      {/* Backdrop: Clicking outside dismisses the popover with zero layout shift */}
      <View className="flex-1 relative">
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          className="bg-black/40 dark:bg-black/60"
          onPress={onClose}
        />

        {/* Floating Overlapping Container (Fixed card size across all states, internal scroll pagination) */}
        <View
          style={{
            position: 'absolute',
            ...(Platform.OS === 'web'
              ? {
                  top: 60,
                  right: 24,
                  width: 400,
                  maxWidth: windowWidth - 32,
                  height: Math.min(490, Math.max(380, windowHeight - 90)),
                }
              : {
                  top: 64,
                  left: 16,
                  right: 16,
                  height: Math.min(520, Math.floor(windowHeight * 0.78)),
                }),
          }}
          className="rounded-2xl bg-white dark:bg-[#1E1E1E] border border-light-border dark:border-dark-border/60 shadow-2xl overflow-hidden z-50 flex-col"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-light-border/40 dark:border-dark-border/40 bg-light-surface/80 dark:bg-white/[0.02]">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-full bg-light-border/60 dark:bg-dark-raised items-center justify-center">
                <Bell size={16} color={isDark ? '#F7F7F7' : '#171717'} strokeWidth={2} />
              </View>
              <View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-bold text-light-textPrimary dark:text-dark-textPrimary tracking-tight">
                    Notifications
                  </Text>
                  {counts.unread > 0 && (
                    <View className="px-1.5 py-0.5 rounded-full bg-light-iconBg dark:bg-white">
                      <Text className="text-[10px] font-bold text-white dark:text-[#111111]">
                        {counts.unread} new
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
                  Offline storage ledger & alerts
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-1.5">
              {counts.unread > 0 && (
                <Pressable
                  onPress={() => markAllNotificationsAsRead()}
                  accessibilityRole="button"
                  accessibilityLabel="Mark all as read"
                  className="px-2.5 py-1 rounded-lg bg-light-border/50 dark:bg-dark-raised active:scale-95"
                >
                  <Text className="text-[11px] font-medium text-light-textSecondary dark:text-dark-textSecondary">
                    Mark all read
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close notification center"
                className="w-7 h-7 rounded-full bg-light-border/50 dark:bg-dark-raised items-center justify-center active:scale-95"
              >
                <X size={14} color={isDark ? '#B5B5B5' : '#626262'} />
              </Pressable>
            </View>
          </View>

          {/* Category Filter Pills (Aligned with ScribeX Pastel Tile UI Design System) */}
          <View className="flex-row items-center gap-1.5 px-4 py-2.5 border-b border-light-border/40 dark:border-dark-border/40 bg-light-surface/40 dark:bg-dark-surface/40">
            <Pressable
              onPress={() => setActiveFilter('all')}
              className={`flex-row items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${
                activeFilter === 'all'
                  ? 'bg-light-iconBg dark:bg-white border-transparent'
                  : 'bg-transparent border-light-border dark:border-dark-border'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  activeFilter === 'all'
                    ? 'text-white dark:text-[#111111]'
                    : 'text-light-textSecondary dark:text-dark-textSecondary'
                }`}
              >
                All
              </Text>
              <Text
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  activeFilter === 'all'
                    ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#111111]'
                    : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
                }`}
              >
                {counts.all}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveFilter('unread')}
              className={`flex-row items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${
                activeFilter === 'unread'
                  ? 'bg-light-iconBg dark:bg-white border-transparent'
                  : 'bg-transparent border-light-border dark:border-dark-border'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  activeFilter === 'unread'
                    ? 'text-white dark:text-[#111111]'
                    : 'text-light-textSecondary dark:text-dark-textSecondary'
                }`}
              >
                Unread
              </Text>
              <Text
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  activeFilter === 'unread'
                    ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#111111]'
                    : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
                }`}
              >
                {counts.unread}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveFilter('task')}
              className={`flex-row items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${
                activeFilter === 'task'
                  ? 'bg-light-iconBg dark:bg-white border-transparent'
                  : 'bg-transparent border-light-border dark:border-dark-border'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  activeFilter === 'task'
                    ? 'text-white dark:text-[#111111]'
                    : 'text-light-textSecondary dark:text-dark-textSecondary'
                }`}
              >
                Tasks
              </Text>
              <Text
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  activeFilter === 'task'
                    ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#111111]'
                    : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
                }`}
              >
                {counts.tasks}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveFilter('note')}
              className={`flex-row items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${
                activeFilter === 'note'
                  ? 'bg-light-iconBg dark:bg-white border-transparent'
                  : 'bg-transparent border-light-border dark:border-dark-border'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  activeFilter === 'note'
                    ? 'text-white dark:text-[#111111]'
                    : 'text-light-textSecondary dark:text-dark-textSecondary'
                }`}
              >
                Notes
              </Text>
              <Text
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  activeFilter === 'note'
                    ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#111111]'
                    : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
                }`}
              >
                {counts.notes}
              </Text>
            </Pressable>
          </View>

          {/* Notification List Scroll Area */}
          <ScrollView
            className="flex-1 px-3 py-2"
            showsVerticalScrollIndicator={true}
            scrollEventThrottle={16}
            onScroll={handleScroll}
            contentContainerStyle={
              filteredNotifications.length === 0
                ? { flexGrow: 1, justifyContent: 'center', alignItems: 'center' }
                : { paddingBottom: 16 }
            }
          >
            {filteredNotifications.length === 0 ? (
              <View className="py-12 items-center justify-center">
                <View className="w-12 h-12 rounded-full bg-light-border/40 dark:bg-dark-raised items-center justify-center mb-3">
                  <CheckCheck size={22} color={isDark ? '#858585' : '#929292'} />
                </View>
                <Text className="text-sm font-bold text-light-textPrimary dark:text-dark-textPrimary text-center">
                  All caught up!
                </Text>
                <Text className="text-xs text-light-textMuted dark:text-dark-textMuted text-center mt-1 px-6">
                  {activeFilter === 'all'
                    ? 'Reminders and notification alerts will be collected and organized here.'
                    : `No ${activeFilter} notifications right now.`}
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {paginatedNotifications.map((item) => {
                  const isTask = item.targetType === 'task';
                  const isNote = item.targetType === 'note';

                  const taskItem = isTask ? tasks.find((t) => t.id === item.targetId) : undefined;
                  const noteItem = isNote ? notes.find((n) => n.id === item.targetId || n.id === item.noteId) : undefined;

                  let displayTitle = '';
                  let displayBody = '';

                  if (isTask) {
                    displayTitle =
                      taskItem?.title ||
                      (item.body && item.body !== 'Task Reminder' && item.body !== 'Scheduled task' ? item.body : '') ||
                      (item.title && item.title !== 'Task Reminder' ? item.title : '') ||
                      'Task';

                    if (taskItem?.noteTitle) {
                      displayBody = `From note: ${taskItem.noteTitle}`;
                    } else if (taskItem?.dueDate && taskItem.dueDate !== 'No Date') {
                      displayBody = `Due: ${taskItem.dueDate}`;
                    } else if (item.body && item.body !== displayTitle && item.body !== 'Task Reminder' && item.body !== 'Scheduled task') {
                      displayBody = item.body;
                    }
                  } else if (isNote) {
                    displayTitle =
                      noteItem?.title ||
                      (item.title && item.title !== 'Note Reminder' && item.title !== 'Review Note' ? item.title : '') ||
                      (item.body && item.body !== 'Note Reminder' && item.body !== 'Review Note' ? item.body : '') ||
                      'Untitled Note';

                    const noteExcerpt = noteItem?.contentMarkdown ? noteItem.contentMarkdown.trim().slice(0, 100) : '';
                    if (noteExcerpt && noteExcerpt !== displayTitle) {
                      displayBody = noteExcerpt;
                    } else if (item.body && item.body !== displayTitle && item.body !== 'Note Reminder' && item.body !== 'Review Note') {
                      displayBody = item.body;
                    }
                  } else {
                    displayTitle = item.title;
                    displayBody = item.body;
                  }

                  // Parse recurrence if any
                  let parsedRule: RecurringRule | undefined = undefined;
                  if (item.recurrenceRule) {
                    try {
                      parsedRule = JSON.parse(item.recurrenceRule);
                    } catch {
                      // ignore parse errors
                    }
                  } else {
                    const parsed = parseReminderString(item.triggerAt);
                    if (parsed?.type === 'repeat') {
                      parsedRule = parsed.repeatRule;
                    }
                  }

                  const relative = formatRelativeDuration(item.triggerAt);

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        markNotificationAsRead(item.id, !item.isRead);
                        if (onNavigateToTarget) {
                          onNavigateToTarget(item.targetType, item.targetId, item.noteId);
                        }
                      }}
                      className={`p-3 rounded-xl border transition-all ${
                        item.isRead
                          ? 'bg-light-surface/40 dark:bg-dark-surface/40 border-light-border/40 dark:border-dark-border/40 opacity-75'
                          : 'bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border/70 shadow-sm'
                      }`}
                    >
                      {/* Item Top Row: Target Badge + Timing Info + Actions */}
                      <View className="flex-row items-center justify-between mb-1.5">
                        <View className="flex-row items-center gap-1.5">
                          {/* Unread Subtle Indicator Dot */}
                          {!item.isRead && (
                            <View className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-sm" />
                          )}

                          {/* Source Target Badge: Tasks are green-themed, Notes are lavender/cyan themed */}
                          <View
                            className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full ${
                              isTask
                                ? 'bg-emerald-500/15 dark:bg-emerald-500/20'
                                : isNote
                                ? 'bg-purple-500/15 dark:bg-purple-500/20'
                                : 'bg-slate-500/15 dark:bg-slate-500/20'
                            }`}
                          >
                            {isTask ? (
                              <CheckSquare size={10} color={isDark ? '#34d399' : '#059669'} />
                            ) : (
                              <FileText size={10} color={isDark ? '#c084fc' : '#9333ea'} />
                            )}
                            <Text
                              className={`text-[10px] font-bold uppercase tracking-wider ${
                                isTask
                                  ? 'text-emerald-700 dark:text-emerald-300'
                                  : isNote
                                  ? 'text-purple-700 dark:text-purple-300'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {item.targetType}
                            </Text>
                          </View>

                          {/* Recurrence Badge or Relative Duration */}
                          {parsedRule ? (
                            <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 dark:bg-sky-500/20">
                              <Repeat size={10} color={isDark ? '#38bdf8' : '#0284c7'} />
                              <Text className="text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                                {formatRecurrenceLabel(parsedRule)}
                              </Text>
                            </View>
                          ) : (
                            <View
                              className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full ${
                                relative.isPast
                                  ? 'bg-amber-500/10 dark:bg-amber-500/20'
                                  : 'bg-black/5 dark:bg-white/5'
                              }`}
                            >
                              <Clock
                                size={10}
                                color={
                                  relative.isPast
                                    ? isDark
                                      ? '#fbbf24'
                                      : '#d97706'
                                    : isDark
                                    ? '#B5B5B5'
                                    : '#626262'
                                }
                              />
                              <Text
                                className={`text-[10px] font-semibold ${
                                  relative.isPast
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : 'text-light-textSecondary dark:text-dark-textSecondary'
                                }`}
                              >
                                {relative.text}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Item Quick Actions */}
                        <View className="flex-row items-center gap-1">
                          {/* Toggle Read */}
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation?.();
                              markNotificationAsRead(item.id, !item.isRead);
                            }}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={item.isRead ? 'Mark as unread' : 'Mark as read'}
                            className="p-1 rounded-md hover:bg-light-border/40 dark:hover:bg-dark-raised active:scale-95"
                          >
                            <Check
                              size={13}
                              color={item.isRead ? (isDark ? '#F7F7F7' : '#171717') : (isDark ? '#858585' : '#929292')}
                              strokeWidth={item.isRead ? 2.5 : 1.8}
                            />
                          </Pressable>

                          {/* Dismiss / Delete */}
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation?.();
                              clearNotification(item.id);
                            }}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Dismiss notification"
                            className="p-1 rounded-md hover:bg-rose-500/10 active:scale-95"
                          >
                            <Trash2 size={13} color={isDark ? '#858585' : '#929292'} />
                          </Pressable>
                        </View>
                      </View>

                      {/* Title & Body */}
                      <Text
                        numberOfLines={1}
                        className={`text-xs font-bold tracking-tight mb-0.5 ${
                          item.isRead
                            ? 'text-light-textMuted dark:text-dark-textMuted'
                            : 'text-light-textPrimary dark:text-dark-textPrimary'
                        }`}
                      >
                        {displayTitle}
                      </Text>
                      {Boolean(displayBody) && (
                        <Text
                          numberOfLines={2}
                          className="text-xs text-light-textSecondary dark:text-dark-textSecondary leading-relaxed"
                        >
                          {displayBody}
                        </Text>
                      )}

                      {/* Recurrence Next Occurrence info */}
                      {parsedRule && (
                        <View className="mt-2 pt-1.5 border-t border-light-border/30 dark:border-dark-border/30 flex-row items-center justify-between">
                          <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                            Next:{' '}
                            <Text className="text-light-textPrimary dark:text-dark-textPrimary font-medium">
                              {formatNotificationTime(getNextOccurrence(parsedRule).toISOString())}
                            </Text>
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}

                {/* Pagination Status / Load More Control */}
                {hasMore && (
                  <View className="py-2.5 items-center justify-center">
                    <Pressable
                      onPress={handleLoadMore}
                      disabled={isLoadingMore}
                      accessibilityRole="button"
                      accessibilityLabel="Load more notifications"
                      className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-light-border/40 dark:bg-dark-raised border border-light-border/60 dark:border-dark-border/40 active:scale-95"
                    >
                      <Text className="text-[11px] font-medium text-light-textSecondary dark:text-dark-textSecondary">
                        {isLoadingMore
                          ? 'Loading...'
                          : `Showing ${paginatedNotifications.length} of ${filteredNotifications.length} • Tap or scroll for more`}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {!hasMore && filteredNotifications.length > PAGE_SIZE && (
                  <View className="py-2 items-center justify-center">
                    <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted tracking-wide">
                      Showing all {filteredNotifications.length} alerts
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          {counts.all > 0 && (
            <View className="px-4 py-2.5 border-t border-light-border/40 dark:border-dark-border/40 bg-light-surface/60 dark:bg-dark-surface/60 flex-row items-center justify-between">
              <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
                {counts.all} {counts.all === 1 ? 'alert' : 'alerts'} logged
              </Text>
              <Pressable
                onPress={() => clearAllNotifications()}
                accessibilityRole="button"
                accessibilityLabel="Clear all notifications"
                className="flex-row items-center gap-1 active:opacity-70"
              >
                <Trash2 size={12} color={isDark ? '#ef4444' : '#dc2626'} />
                <Text className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  Clear all
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};
