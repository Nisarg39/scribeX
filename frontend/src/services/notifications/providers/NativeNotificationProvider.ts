/**
 * ScribeX Native Notification Provider (iOS & Android)
 * Backed by expo-notifications with native OS AlarmManager (Android) & UNUserNotificationCenter (iOS)
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { INotificationProvider, ScheduleNotificationOptions } from '../types';

// Configure foreground presentation behavior safely
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  // Graceful fallback for non-native environments
}

export class NativeNotificationProvider implements INotificationProvider {
  public readonly platform = 'native' as const;
  private channelConfigured = false;
  public onDelivered?: (options: ScheduleNotificationOptions) => void;

  constructor() {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      try {
        Notifications.addNotificationReceivedListener((notification) => {
          const content = notification.request.content;
          const data = (content.data || {}) as Record<string, any>;
          if (this.onDelivered) {
            this.onDelivered({
              reminderId: data.reminderId || notification.request.identifier,
              title: content.title || 'Reminder',
              body: content.body || '',
              triggerDate: new Date(),
              payload: (data as any) || {
                targetType: 'task',
                targetId: notification.request.identifier,
                title: content.title || 'Reminder',
                body: content.body || '',
              },
            });
          }
        });
      } catch (err) {
        console.debug('Failed to register native notification listener:', err);
      }
    }
  }

  public isSupported(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  private async ensureAndroidChannel(): Promise<void> {
    if (this.channelConfigured || Platform.OS !== 'android') return;
    try {
      await Notifications.setNotificationChannelAsync('scribex_reminders', {
        name: 'ScribeX Reminders',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#84CC16',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      this.channelConfigured = true;
    } catch (e) {
      console.warn('Failed to configure Android notification channel:', e);
    }
  }

  public async hasPermissions(): Promise<boolean> {
    try {
      const settings = await Notifications.getPermissionsAsync();
      return (
        settings.granted ||
        settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
        settings.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED
      );
    } catch {
      return false;
    }
  }

  public async requestPermissions(): Promise<boolean> {
    try {
      const status = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: false,
        },
      });
      return status.granted;
    } catch {
      return false;
    }
  }

  public async schedule(options: ScheduleNotificationOptions): Promise<string | null> {
    try {
      await this.ensureAndroidChannel();

      const targetTime = options.triggerDate.getTime();
      if (isNaN(targetTime)) {
        console.warn('Trigger date is invalid; cannot schedule alarm.');
        return null;
      }

      // If repeating rule provided, schedule repeating OS calendar triggers (survives app closure indefinitely)
      if (options.repeatRule && Array.isArray(options.repeatRule.days) && options.repeatRule.days.length > 0) {
        const [hStr, mStr] = (options.repeatRule.time || '12:00').split(':');
        const hour = parseInt(hStr, 10) || 0;
        const minute = parseInt(mStr, 10) || 0;

        const scheduledIds: string[] = [];
        for (const day of options.repeatRule.days) {
          // JS day: 0=Sun..6=Sat. expo-notifications weekday: 1=Sun..7=Sat
          const expoWeekday = day + 1;
          const nid = await Notifications.scheduleNotificationAsync({
            content: {
              title: options.title,
              body: options.body,
              data: options.payload as Record<string, any>,
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
              weekday: expoWeekday,
              hour,
              minute,
              repeats: true,
              channelId: 'scribex_reminders',
            },
          });
          scheduledIds.push(nid);
        }
        return scheduledIds.join(',');
      }

      // If scheduled time is immediate (within 1 second or past), deliver immediately
      const isImmediate = targetTime <= Date.now() + 1000;

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: options.title,
          body: options.body,
          data: options.payload as Record<string, any>,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: isImmediate
          ? null
          : {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: options.triggerDate,
              channelId: 'scribex_reminders',
            },
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to schedule native notification:', error);
      return null;
    }
  }

  public async cancel(notificationId: string): Promise<void> {
    try {
      const ids = notificationId.split(',').map((s) => s.trim()).filter(Boolean);
      for (const id of ids) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    } catch (error) {
      console.warn('Failed to cancel native notification:', error);
    }
  }

  public async cancelAll(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.warn('Failed to cancel all native notifications:', error);
    }
  }
}

export const nativeNotificationProvider = new NativeNotificationProvider();

