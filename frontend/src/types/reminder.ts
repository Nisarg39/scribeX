/**
 * ScribeX Reminder Domain Types & DTOs
 * Source of Truth: docs/Local_Serverless_Reminder_Implementation_Plan.md
 */

export type ReminderTargetType = 'task' | 'note' | 'event' | 'checklist_point';

export interface ReminderPayload {
  targetType: ReminderTargetType;
  targetId: string;
  noteId?: string;
  title: string;
  body: string;
}

export interface ReminderRecord {
  id: string;
  userId: string;
  targetType: ReminderTargetType;
  targetId: string;
  noteId?: string;
  triggerAt: string;          // ISO 8601 UTC: e.g. "2026-11-09T09:00:00.000Z"
  notificationId?: string;    // Hardware platform ID returned by local OS daemon
  channelId: string;
  isDismissed: boolean;
  dismissedAt?: string;
  deviceId: string;
  syncRev: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderDTO {
  id?: string;
  userId?: string;
  targetType: ReminderTargetType;
  targetId: string;
  noteId?: string;
  triggerAt: string;          // ISO 8601 UTC
  title: string;
  body: string;
}

export interface UpdateReminderDTO {
  triggerAt?: string;
  notificationId?: string;
  isDismissed?: boolean;
  dismissedAt?: string;
}

