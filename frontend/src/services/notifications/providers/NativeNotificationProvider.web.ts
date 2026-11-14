/**
 * ScribeX Native Notification Provider (Web Stub)
 * Metro resolves this file for Web builds, eliminating native expo-notifications imports and warnings.
 */

import { INotificationProvider, ScheduleNotificationOptions } from '../types';

export class NativeNotificationProvider implements INotificationProvider {
  public readonly platform = 'native' as const;
  public onDelivered?: (options: ScheduleNotificationOptions) => void;

  public isSupported(): boolean {
    return false;
  }

  public async requestPermissions(): Promise<boolean> {
    return false;
  }

  public async hasPermissions(): Promise<boolean> {
    return false;
  }

  public async schedule(_options: ScheduleNotificationOptions): Promise<string | null> {
    return null;
  }

  public async cancel(_notificationId: string): Promise<void> {}

  public async cancelAll(): Promise<void> {}
}

export const nativeNotificationProvider = new NativeNotificationProvider();
