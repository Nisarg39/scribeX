/**
 * ScribeX Web Notification Provider (Browser / PWA)
 * Backed by HTML5 Web Notifications API and client-side scheduling.
 */

import { INotificationProvider, ScheduleNotificationOptions } from '../types';

export class WebNotificationProvider implements INotificationProvider {
  public readonly platform = 'web' as const;
  private activeTimers = new Map<string, any>();
  private swRegistration: ServiceWorkerRegistration | null = null;
  public onDelivered?: (options: ScheduleNotificationOptions) => void;

  constructor() {
    this.initServiceWorker();
  }

  private async initServiceWorker(): Promise<void> {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        this.swRegistration = reg;
      } catch (err) {
        console.debug('Service Worker registration skipped or failed:', err);
      }
    }
  }

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

  private async displayWebNotification(options: ScheduleNotificationOptions): Promise<void> {
    if (!this.isSupported() || Notification.permission !== 'granted') return;

    // Prefer ServiceWorker showNotification if available (survives tab blur)
    if (this.swRegistration && 'showNotification' in this.swRegistration) {
      try {
        await this.swRegistration.showNotification(options.title, {
          body: options.body,
          icon: '/favicon.png',
          tag: options.reminderId,
          data: options.payload,
        } as any);
        return;
      } catch (swErr) {
        console.warn('SW notification fallback to window.Notification:', swErr);
      }
    }

    try {
      const notif = new Notification(options.title, {
        body: options.body,
        icon: '/favicon.png',
        tag: options.reminderId,
        data: options.payload,
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('scribex:navigate', {
              detail: options.payload,
            })
          );
        }
      };
    } catch (e) {
      console.warn('Could not display web notification popup:', e);
    }
  }

  public async schedule(options: ScheduleNotificationOptions): Promise<string | null> {
    const targetMs = options.triggerDate.getTime();
    const delay = targetMs - Date.now();

    if (isNaN(targetMs)) {
      console.warn('Web notification trigger date is invalid.');
      return null;
    }

    const notificationId = `web-notif-${options.reminderId}-${Date.now()}`;

    // Immediate delivery (< 1 second)
    if (delay <= 1000) {
      if (this.isSupported() && Notification.permission === 'granted') {
        await this.displayWebNotification(options);
        this.onDelivered?.(options);
        return notificationId;
      }
      return null;
    }

    // Maximum 32-bit signed integer delay for setTimeout (~24.8 days)
    const MAX_TIMEOUT_MS = 2147483647;
    const timerDelay = Math.min(delay, MAX_TIMEOUT_MS);

    const timer = setTimeout(async () => {
      this.activeTimers.delete(notificationId);
      await this.displayWebNotification(options);
      this.onDelivered?.(options);
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

