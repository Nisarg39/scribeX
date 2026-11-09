/**
 * ScribeX Universal Notification Service Facade
 * Source of Truth: docs/Local_Serverless_Reminder_Implementation_Plan.md
 */

import { Platform } from 'react-native';
import { INotificationProvider, ScheduleNotificationOptions } from './types';
import { nativeNotificationProvider } from './providers/NativeNotificationProvider';
import { webNotificationProvider } from './providers/WebNotificationProvider';
import { ReminderRecord } from '../../types/reminder';
import { remindersRepo } from '../../db/remindersRepo';
import { notificationsRepo } from '../../db/notificationsRepo';
import { NotificationTargetType } from '../../db/types';

export class NotificationServiceManager {
  private provider: INotificationProvider;
  private deliveryListeners = new Set<(payload: any) => void>();

  constructor(customProvider?: INotificationProvider) {
    this.provider =
      customProvider ||
      (Platform.OS === 'web' ? webNotificationProvider : nativeNotificationProvider);
    this.attachDeliveryListener();
  }

  public setProvider(provider: INotificationProvider): void {
    this.provider = provider;
    this.attachDeliveryListener();
  }

  public getProvider(): INotificationProvider {
    return this.provider;
  }

  private attachDeliveryListener(): void {
    if ('onDelivered' in this.provider) {
      (this.provider as any).onDelivered = (options: ScheduleNotificationOptions) => {
        this.onNotificationDelivered(options);
      };
    }
  }

  public async onNotificationDelivered(options: ScheduleNotificationOptions): Promise<void> {
    try {
      const payload = options.payload || {};
      const targetType = (payload.targetType as NotificationTargetType) || 'task';
      const targetId = (payload.targetId as string) || options.reminderId;

      await notificationsRepo.recordFiredNotification({
        reminderId: options.reminderId,
        targetType,
        targetId,
        noteId: payload.noteId as string | undefined,
        title: options.title,
        body: options.body,
        triggerAt: new Date().toISOString(),
        recurrenceRule: options.repeatRule ? JSON.stringify(options.repeatRule) : undefined,
      });

      for (const listener of this.deliveryListeners) {
        listener(options);
      }
    } catch (err) {
      console.warn('Failed to record fired notification:', err);
    }
  }

  public subscribeDelivery(listener: (payload: any) => void): () => void {
    this.deliveryListeners.add(listener);
    return () => {
      this.deliveryListeners.delete(listener);
    };
  }

  public async scheduleReminder(options: ScheduleNotificationOptions): Promise<string | null> {
    const hasPermission = await this.provider.hasPermissions();
    if (!hasPermission) {
      const granted = await this.provider.requestPermissions();
      if (!granted) {
        console.warn('Notification permission not granted.');
        return null;
      }
    }
    return this.provider.schedule(options);
  }

  public async cancelReminder(notificationId: string): Promise<void> {
    return this.provider.cancel(notificationId);
  }

  public async cancelAllReminders(): Promise<void> {
    return this.provider.cancelAll();
  }

  /**
   * Phase 2 Ready: Handles remote delta sync events from Supabase Realtime CDC.
   * If a reminder was dismissed or deleted remotely, cancels local OS alarm.
   */
  public async handleRemoteSyncDelta(
    action: 'insert' | 'update' | 'delete',
    reminder: ReminderRecord,
    title: string = 'ScribeX Reminder',
    body: string = 'You have a scheduled reminder.'
  ): Promise<void> {
    if (action === 'delete' || reminder.isDismissed) {
      if (reminder.notificationId) {
        await this.cancelReminder(reminder.notificationId);
      }
    } else if (new Date(reminder.triggerAt).getTime() > Date.now()) {
      // Re-schedule locally on this client if trigger is in future
      const newNotificationId = await this.scheduleReminder({
        reminderId: reminder.id,
        title,
        body,
        triggerDate: new Date(reminder.triggerAt),
        payload: {
          targetType: reminder.targetType,
          targetId: reminder.targetId,
          noteId: reminder.noteId,
          title,
          body,
        },
      });

      // Update local ledger with device-specific notification ID
      if (newNotificationId) {
        await remindersRepo.updateNotificationId(reminder.id, newNotificationId);
      }
    }
  }
}

export const notificationService = new NotificationServiceManager();

