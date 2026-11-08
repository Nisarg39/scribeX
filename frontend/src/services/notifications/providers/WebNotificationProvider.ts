/**
 * ScribeX Web Notification Provider (Browser / PWA)
 * Backed by HTML5 Web Notifications API and client-side scheduling.
 */

import { INotificationProvider, ScheduleNotificationOptions } from '../types';

export class WebNotificationProvider implements INotificationProvider {
  public readonly platform = 'web' as const;
  private activeTimers = new Map<string, any>();

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public async hasPermissions(): Promise<boolean> {
    if (!this.isSupported()) return false;
    return Notification.permission === 'granted';
  }

  public async requestPermissions(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  }

  public async schedule(options: ScheduleNotificationOptions): Promise<string | null> {
    const targetMs = options.triggerDate.getTime();
    const delay = targetMs - Date.now();

    if (isNaN(targetMs) || delay <= 0) {
      console.warn('Web notification trigger is in the past or invalid.');
      return null;
    }

    const notificationId = `web-notif-${options.reminderId}-${Date.now()}`;

    // Maximum 32-bit signed integer delay for setTimeout (~24.8 days)
    const MAX_TIMEOUT_MS = 2147483647;
    const timerDelay = Math.min(delay, MAX_TIMEOUT_MS);

    const timer = setTimeout(async () => {
      this.activeTimers.delete(notificationId);
      if (this.isSupported() && Notification.permission === 'granted') {
        try {
          const notif = new Notification(options.title, {
            body: options.body,
            icon: '/favicon.ico',
            tag: options.reminderId,
            data: options.payload,
          });

          notif.onclick = () => {
            window.focus();
            notif.close();
          };
        } catch (e) {
          console.warn('Could not display web notification popup:', e);
        }
      }
    }, timerDelay);

    this.activeTimers.set(notificationId, timer);
    return notificationId;
  }

  public async cancel(notificationId: string): Promise<void> {
    const timer = this.activeTimers.get(notificationId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(notificationId);
    }
  }

  public async cancelAll(): Promise<void> {
    for (const [id, timer] of this.activeTimers.entries()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
  }
}

export const webNotificationProvider = new WebNotificationProvider();

