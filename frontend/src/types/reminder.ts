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

export type ReminderType = 'once' | 'repeat';

export interface RecurringRule {
  type: 'repeat';
  days: number[]; // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  time: string;   // 24-hour "HH:mm"
}

export interface ParsedReminderConfig {
  type: ReminderType;
  triggerAt?: string;         // ISO 8601 for 'once'
  repeatRule?: RecurringRule; // Configuration for 'repeat'
}

/**
 * Computes the exact next occurrence Date strictly in the future for a recurring rule.
 */
export function getNextOccurrence(rule: RecurringRule, fromDate: Date = new Date()): Date {
  const [hStr, mStr] = (rule.time || '12:00').split(':');
  const targetHour = parseInt(hStr, 10) || 0;
  const targetMinute = parseInt(mStr, 10) || 0;

  const validDays = Array.isArray(rule.days) && rule.days.length > 0 ? rule.days : [0, 1, 2, 3, 4, 5, 6];

  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(fromDate);
    candidate.setDate(fromDate.getDate() + offset);
    candidate.setHours(targetHour, targetMinute, 0, 0);

    const candidateDay = candidate.getDay(); // 0 = Sun .. 6 = Sat
    if (validDays.includes(candidateDay)) {
      if (candidate.getTime() > fromDate.getTime()) {
        return candidate;
      }
    }
  }

  const fallback = new Date(fromDate);
  fallback.setDate(fromDate.getDate() + 7);
  fallback.setHours(targetHour, targetMinute, 0, 0);
  return fallback;
}

/**
 * Parses a reminder string (either ISO 8601 date or JSON repeat rule).
 */
export function parseReminderString(raw: string | undefined | null): ParsedReminderConfig | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === 'repeat' && Array.isArray(parsed.days) && typeof parsed.time === 'string') {
        return {
          type: 'repeat',
          repeatRule: {
            type: 'repeat',
            days: parsed.days,
            time: parsed.time,
          },
        };
      }
    } catch {
      // Fallback to ISO check
    }
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return {
      type: 'once',
      triggerAt: trimmed,
    };
  }

  return null;
}

/**
 * Generates an aesthetic human-readable label for recurring rules (e.g. "Daily at 1:30 PM", "Mon, Wed, Fri at 9:00 AM").
 */
export function formatRecurrenceLabel(rule: RecurringRule): string {
  const [hStr, mStr] = (rule.time || '12:00').split(':');
  let h = parseInt(hStr, 10) || 12;
  const m = mStr || '00';
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const timeFormatted = `${h}:${m} ${period}`;

  const days = rule.days || [];
  if (days.length === 7) {
    return `Every day at ${timeFormatted}`;
  }
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) {
    return `Weekdays at ${timeFormatted}`;
  }
  if (days.length === 2 && [0, 6].every((d) => days.includes(d))) {
    return `Weekends at ${timeFormatted}`;
  }
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayLabels = days.slice().sort().map((d) => dayNames[d]).join(', ');
  return `${dayLabels} at ${timeFormatted}`;
}

export const MONTH_INITIALS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * Formats a Date object into a 12-hour string with AM/PM (e.g. "11:41 AM", "5:34 PM").
 */
export function formatTime12h(d: Date): string {
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${period}`;
}

/**
 * Formats task and note reminder chips using 12-hour time and month initials (never 24-hour time or month numbers).
 * E.g. "Today 5:34 PM", "Tomorrow 9:00 AM", "10 Nov, 1:26 PM".
 */
export function formatReminderChip(rawReminder?: string): string {
  if (!rawReminder) return '';
  const parsed = parseReminderString(rawReminder);
  if (!parsed) return '';

  if (parsed.type === 'repeat' && parsed.repeatRule) {
    return `🔁 ${formatRecurrenceLabel(parsed.repeatRule)}`;
  }

  try {
    const d = new Date(parsed.triggerAt!);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const timeStr = formatTime12h(d);
    if (isToday) return `Today ${timeStr}`;

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow =
      d.getDate() === tomorrow.getDate() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getFullYear() === tomorrow.getFullYear();
    if (isTomorrow) return `Tomorrow ${timeStr}`;

    const monthInitials = MONTH_INITIALS[d.getMonth()];
    const isSameYear = d.getFullYear() === now.getFullYear();
    if (isSameYear) {
      return `${d.getDate()} ${monthInitials}, ${timeStr}`;
    }
    return `${d.getDate()} ${monthInitials} ${d.getFullYear()}, ${timeStr}`;
  } catch {
    return '';
  }
}

/**
 * Formats note creation/updated dates using 12-hour time and month initials.
 * Avoids raw SQLite timestamps like "2026-11-09 11:41:04".
 * E.g. "Today, 11:41 AM", "Yesterday, 3:20 PM", "9 Nov, 11:41 AM".
 */
export function formatNoteCardDate(rawDate?: string): string {
  if (!rawDate) return '';

  if (rawDate === 'Today' || rawDate === 'Yesterday') {
    return rawDate;
  }

  try {
    let d: Date;
    if (rawDate.includes(' ') && !rawDate.includes('T')) {
      d = new Date(rawDate.replace(' ', 'T'));
    } else {
      d = new Date(rawDate);
    }

    if (isNaN(d.getTime())) {
      return rawDate;
    }

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const timeStr = formatTime12h(d);
    const monthInitials = MONTH_INITIALS[d.getMonth()];

    if (isToday) {
      return `Today, ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Yesterday, ${timeStr}`;
    }

    const isSameYear = d.getFullYear() === now.getFullYear();
    if (isSameYear) {
      return `${d.getDate()} ${monthInitials}, ${timeStr}`;
    }
    return `${d.getDate()} ${monthInitials} ${d.getFullYear()}, ${timeStr}`;
  } catch {
    return rawDate;
  }
}

