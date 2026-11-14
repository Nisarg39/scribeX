import React, { useCallback } from 'react';
import { notificationsRepo } from '../../db/notificationsRepo';
import { remindersRepo } from '../../db/remindersRepo';
import { tasksRepo } from '../../db/tasksRepo';
import { notesRepo } from '../../db/notesRepo';
import { notificationService } from '../../services/notifications/NotificationService';
import { ReminderRecord, parseReminderString, getNextOccurrence } from '../../types/reminder';
import { InAppNotificationItem, NotificationTargetType, NotificationCounts } from '../../db/types';
import { serializeBlocksToMarkdown } from '../../core/astSerializer';
import { TaskItem, NoteItem } from '../../types/note';

export interface UseReminderStoreActionsProps {
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  notes: NoteItem[];
  setNotes: React.Dispatch<React.SetStateAction<NoteItem[]>>;
  reminders: ReminderRecord[];
  setReminders: React.Dispatch<React.SetStateAction<ReminderRecord[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<InAppNotificationItem[]>>;
  setUnreadNotificationsCount: React.Dispatch<React.SetStateAction<number>>;
  setNotificationCounts: React.Dispatch<React.SetStateAction<NotificationCounts>>;
  updateNote: (updated: NoteItem) => void;
}

export function useReminderStoreActions({
  tasks,
  setTasks,
  notes,
  setNotes,
  reminders,
  setReminders,
  setNotifications,
  setUnreadNotificationsCount,
  setNotificationCounts,
  updateNote,
}: UseReminderStoreActionsProps) {
  const refreshNotifications = useCallback(async () => {
    try {
      const [list, counts] = await Promise.all([
        notificationsRepo.listNotifications(),
        notificationsRepo.getNotificationCounts(),
      ]);
      setNotifications(list);
      setUnreadNotificationsCount(counts.unread);
      setNotificationCounts(counts);
    } catch (err) {
      console.warn('Failed to load in-app notifications:', err);
    }
  }, [setNotifications, setUnreadNotificationsCount, setNotificationCounts]);

  const markNotificationAsRead = useCallback(async (id: string, isRead: boolean = true) => {
    try {
      await notificationsRepo.markAsRead(id, isRead);
      await refreshNotifications();
    } catch (err) {
      console.warn('Failed to mark notification as read:', err);
    }
  }, [refreshNotifications]);

  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      await notificationsRepo.markAllAsRead();
      await refreshNotifications();
    } catch (err) {
      console.warn('Failed to mark all notifications as read:', err);
    }
  }, [refreshNotifications]);

  const clearNotification = useCallback(async (id: string) => {
    try {
      await notificationsRepo.clearNotification(id);
      await refreshNotifications();
    } catch (err) {
      console.warn('Failed to clear notification:', err);
    }
  }, [refreshNotifications]);

  const clearAllNotifications = useCallback(async () => {
    try {
      await notificationsRepo.clearAll();
      await refreshNotifications();
    } catch (err) {
      console.warn('Failed to clear all notifications:', err);
    }
  }, [refreshNotifications]);

  const reconcileFiredReminders = useCallback(async () => {
    try {
      await notificationsRepo.purgePrematureNotifications().catch(() => {});

      const activeReminders = await remindersRepo.listActiveReminders().catch(() => []);
      const now = Date.now();

      for (const rem of activeReminders) {
        if (!rem.triggerAt) continue;
        const isTask = rem.targetType === 'task';
        const taskItem = isTask ? tasks.find((t) => t.id === rem.targetId) : undefined;
        const noteItem = !isTask ? notes.find((n) => n.id === rem.targetId) : undefined;
        const notifTitle = isTask
          ? taskItem?.title || 'Task'
          : noteItem?.title || 'Untitled Note';
        const notifBody = isTask
          ? taskItem?.noteTitle ? `From note: ${taskItem.noteTitle}` : ''
          : noteItem?.contentMarkdown ? noteItem.contentMarkdown.trim().slice(0, 100) : '';

        const parsed = parseReminderString(rem.triggerAt);
        if (parsed?.type === 'repeat' && parsed.repeatRule) {
          const [hStr, mStr] = (parsed.repeatRule.time || '12:00').split(':');
          const targetH = parseInt(hStr, 10) || 0;
          const targetM = parseInt(mStr, 10) || 0;
          const nowDate = new Date(now);
          const currentDay = nowDate.getDay();
          const validDays = Array.isArray(parsed.repeatRule.days) && parsed.repeatRule.days.length > 0
            ? parsed.repeatRule.days
            : [0, 1, 2, 3, 4, 5, 6];

          if (validDays.includes(currentDay)) {
            const todayOccurrence = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), targetH, targetM, 0, 0);
            if (todayOccurrence.getTime() <= now) {
              const occurrenceKey = `notif-${rem.id}-${nowDate.toISOString().slice(0, 10)}`;
              const existing = await notificationsRepo.getNotificationById(occurrenceKey);
              if (!existing) {
                await notificationsRepo.createNotification({
                  id: occurrenceKey,
                  reminderId: rem.id,
                  targetType: rem.targetType as NotificationTargetType,
                  targetId: rem.targetId,
                  noteId: rem.noteId,
                  title: notifTitle,
                  body: notifBody,
                  triggerAt: todayOccurrence.toISOString(),
                  recurrenceRule: JSON.stringify(parsed.repeatRule),
                });
              }
            }
          }
        } else {
          const triggerTime = new Date(rem.triggerAt).getTime();
          if (triggerTime <= now) {
            const firedId = `notif-${rem.id}`;
            const existing = await notificationsRepo.getNotificationById(firedId);
            if (!existing) {
              await notificationsRepo.createNotification({
                id: firedId,
                reminderId: rem.id,
                targetType: rem.targetType as NotificationTargetType,
                targetId: rem.targetId,
                noteId: rem.noteId,
                title: notifTitle,
                body: notifBody,
                triggerAt: rem.triggerAt,
              });
            }
          }
        }
      }

      await refreshNotifications();
    } catch (err) {
      console.warn('Failed to reconcile fired reminders:', err);
    }
  }, [notes, refreshNotifications, tasks]);

  const setTaskReminder = useCallback(async (taskId: string, triggerAt: string | null) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    if (!triggerAt) {
      const existing = await remindersRepo.getActiveReminderByTarget('task', taskId);
      if (existing?.notificationId) {
        await notificationService.cancelReminder(existing.notificationId);
      }
      await remindersRepo.dismissReminderByTarget('task', taskId);
      await notificationsRepo.deleteNotificationByTarget('task', taskId);
      await tasksRepo.updateTaskReminder(taskId, null);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, reminderAt: undefined } : t)));
      setReminders((prev) => prev.filter((r) => !(r.targetType === 'task' && r.targetId === taskId)));
      await refreshNotifications();

      if (targetTask.noteId) {
        const targetNote = notes.find((n) => n.id === targetTask.noteId);
        if (targetNote && targetNote.blocks) {
          let hasChanged = false;
          const updatedBlocks = targetNote.blocks.map((b) => {
            if (b.type === 'checklist' && Array.isArray(b.metadata?.items)) {
              const updatedItems = b.metadata.items.map((item: any) => {
                if (item.id === taskId) {
                  hasChanged = true;
                  return { ...item, reminderAt: undefined };
                }
                return item;
              });
              return { ...b, metadata: { ...b.metadata, items: updatedItems } };
            }
            return b;
          });
          if (hasChanged) {
            const nextContent = serializeBlocksToMarkdown(updatedBlocks);
            await notesRepo.updateNote(targetTask.noteId, {
              blocks: updatedBlocks,
              contentMarkdown: nextContent,
            });
            updateNote({
              ...targetNote,
              blocks: updatedBlocks,
              contentMarkdown: nextContent,
            });
          }
        }
      }
    } else {
      const parsedConfig = parseReminderString(triggerAt);
      const computedTriggerDate = parsedConfig?.type === 'repeat' && parsedConfig.repeatRule
        ? getNextOccurrence(parsedConfig.repeatRule)
        : new Date(triggerAt);

      const reminder = await remindersRepo.createReminder({
        targetType: 'task',
        targetId: taskId,
        noteId: targetTask.noteId,
        triggerAt,
        title: targetTask.title,
        body: targetTask.noteTitle ? `From note: ${targetTask.noteTitle}` : '',
      });

      const notificationId = await notificationService.scheduleReminder({
        reminderId: reminder.id,
        title: targetTask.title,
        body: targetTask.noteTitle ? `From note: ${targetTask.noteTitle}` : '',
        triggerDate: computedTriggerDate,
        repeatRule: parsedConfig?.type === 'repeat' ? parsedConfig.repeatRule : undefined,
        payload: {
          targetType: 'task',
          targetId: taskId,
          noteId: targetTask.noteId,
          title: targetTask.title,
          body: targetTask.noteTitle ? `From note: ${targetTask.noteTitle}` : '',
        },
      });

      if (notificationId) {
        await remindersRepo.updateNotificationId(reminder.id, notificationId);
        reminder.notificationId = notificationId;
      }

      await tasksRepo.updateTaskReminder(taskId, triggerAt);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, reminderAt: triggerAt } : t)));
      setReminders((prev) => [
        ...prev.filter((r) => !(r.targetType === 'task' && r.targetId === taskId)),
        reminder,
      ]);
      await refreshNotifications();

      if (targetTask.noteId) {
        const targetNote = notes.find((n) => n.id === targetTask.noteId);
        if (targetNote && targetNote.blocks) {
          let hasChanged = false;
          const updatedBlocks = targetNote.blocks.map((b) => {
            if (b.type === 'checklist' && Array.isArray(b.metadata?.items)) {
              const updatedItems = b.metadata.items.map((item: any) => {
                if (item.id === taskId) {
                  hasChanged = true;
                  return { ...item, reminderAt: triggerAt };
                }
                return item;
              });
              return { ...b, metadata: { ...b.metadata, items: updatedItems } };
            }
            return b;
          });
          if (hasChanged) {
            const nextContent = serializeBlocksToMarkdown(updatedBlocks);
            await notesRepo.updateNote(targetTask.noteId, {
              blocks: updatedBlocks,
              contentMarkdown: nextContent,
            });
            updateNote({
              ...targetNote,
              blocks: updatedBlocks,
              contentMarkdown: nextContent,
            });
          }
        }
      }
    }
  }, [notes, refreshNotifications, setReminders, setTasks, tasks, updateNote]);

  const setNoteReminder = useCallback(async (noteId: string, triggerAt: string | null) => {
    const targetNote = notes.find((n) => n.id === noteId);
    if (!targetNote) return;

    if (!triggerAt) {
      const existing = await remindersRepo.getActiveReminderByTarget('note', noteId);
      if (existing?.notificationId) {
        await notificationService.cancelReminder(existing.notificationId);
      }
      await remindersRepo.dismissReminderByTarget('note', noteId);
      await notificationsRepo.deleteNotificationByTarget('note', noteId);
      await notesRepo.updateNote(noteId, { reminderAt: null });
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, reminderAt: undefined } : n)));
      setReminders((prev) => prev.filter((r) => !(r.targetType === 'note' && r.targetId === noteId)));
      await refreshNotifications();
    } else {
      const parsedConfig = parseReminderString(triggerAt);
      const computedTriggerDate = parsedConfig?.type === 'repeat' && parsedConfig.repeatRule
        ? getNextOccurrence(parsedConfig.repeatRule)
        : new Date(triggerAt);

      const noteTitle = targetNote.title || 'Untitled Note';
      const noteBody = targetNote.contentMarkdown ? targetNote.contentMarkdown.trim().slice(0, 100) : '';

      const reminder = await remindersRepo.createReminder({
        targetType: 'note',
        targetId: noteId,
        noteId,
        triggerAt,
        title: noteTitle,
        body: noteBody,
      });

      const notificationId = await notificationService.scheduleReminder({
        reminderId: reminder.id,
        title: noteTitle,
        body: noteBody,
        triggerDate: computedTriggerDate,
        repeatRule: parsedConfig?.type === 'repeat' ? parsedConfig.repeatRule : undefined,
        payload: {
          targetType: 'note',
          targetId: noteId,
          noteId,
          title: noteTitle,
          body: noteBody,
        },
      });

      if (notificationId) {
        await remindersRepo.updateNotificationId(reminder.id, notificationId);
        reminder.notificationId = notificationId;
      }

      await notesRepo.updateNote(noteId, { reminderAt: triggerAt });
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, reminderAt: triggerAt } : n)));
      setReminders((prev) => [
        ...prev.filter((r) => !(r.targetType === 'note' && r.targetId === noteId)),
        reminder,
      ]);
      await refreshNotifications();
    }
  }, [notes, refreshNotifications, setNotes, setReminders]);

  const cancelReminder = useCallback(async (reminderId: string) => {
    const rem = await remindersRepo.getReminderById(reminderId);
    if (!rem) return;
    if (rem.notificationId) {
      await notificationService.cancelReminder(rem.notificationId);
    }
    await remindersRepo.dismissReminder(reminderId);
    await notificationsRepo.deleteNotificationByTarget(rem.targetType, rem.targetId);
    if (rem.targetType === 'task') {
      await tasksRepo.updateTaskReminder(rem.targetId, null);
      setTasks((prev) => prev.map((t) => (t.id === rem.targetId ? { ...t, reminderAt: undefined } : t)));
    } else if (rem.targetType === 'note') {
      await notesRepo.updateNote(rem.targetId, { reminderAt: null });
      setNotes((prev) => prev.map((n) => (n.id === rem.targetId ? { ...n, reminderAt: undefined } : n)));
    }
    setReminders((prev) => prev.filter((r) => r.id !== reminderId));
    await refreshNotifications();
  }, [refreshNotifications, setNotes, setReminders, setTasks]);

  return {
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotification,
    clearAllNotifications,
    reconcileFiredReminders,
    setTaskReminder,
    setNoteReminder,
    cancelReminder,
  };
}
