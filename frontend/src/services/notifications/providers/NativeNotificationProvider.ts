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

  public isSupported(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  private async ensureAndroidChannel(): Promise<void> {
    if (this.channelConfigured || Platform.OS !== 'android') return;
    try {
      await Notifications.setNotificationChannelAsync('scribex_reminders', {
        name: 'ScribeX Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#84CC16',
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

      // Ensure trigger date is valid and in the future
      const targetTime = options.triggerDate.getTime();
      if (isNaN(targetTime) || targetTime <= Date.now()) {
        console.warn('Trigger date is in the past or invalid; cannot schedule alarm.');
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: options.title,
          body: options.body,
          data: options.payload as Record<string, any>,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
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
      await Notifications.cancelScheduledNotificationAsync(notificationId);
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

