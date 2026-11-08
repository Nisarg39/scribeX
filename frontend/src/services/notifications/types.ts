/**
 * ScribeX Notifications Service Contracts
 * Source of Truth: docs/Local_Serverless_Reminder_Implementation_Plan.md
 */

import { ReminderPayload } from '../../types/reminder';

export interface ScheduleNotificationOptions {
  reminderId: string;
  title: string;
  body: string;
  triggerDate: Date;
  payload: ReminderPayload;
}

/**
 * Universal Hardware Notification Adapter Interface.
 * Implementations:
 * 1. LocalNativeNotificationProvider (expo-notifications for iOS/Android)
 * 2. LocalWebNotificationProvider (Browser Notification API + Service Worker)
 * 3. Future CloudNotificationSyncProvider (Phase 2 backend bridge)
 */
export interface INotificationProvider {
  readonly platform: 'native' | 'web';
  isSupported(): boolean;
  requestPermissions(): Promise<boolean>;
  hasPermissions(): Promise<boolean>;
  schedule(options: ScheduleNotificationOptions): Promise<string | null>;
  cancel(notificationId: string): Promise<void>;
  cancelAll(): Promise<void>;
}

