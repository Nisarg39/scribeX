/**
 * Cross-Platform Persistent Session Storage.
 *
 * Uses AsyncStorage across Web and Native, providing seamless persistence
 * for authenticated sessions, JWT tokens, and guest modes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthSession } from './authTypes';

const SESSION_STORAGE_KEY = 'scribex_auth_session';
const GUEST_STORAGE_KEY = 'scribex_guest_active';

export async function saveSession(session: AuthSession): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    await AsyncStorage.removeItem(GUEST_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to persist auth session:', err);
  }
}

export async function loadSession(): Promise<AuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch (err) {
    console.warn('Failed to load auth session:', err);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([SESSION_STORAGE_KEY, GUEST_STORAGE_KEY]);
  } catch (err) {
    console.warn('Failed to clear auth session:', err);
  }
}

export async function setGuestMode(isGuest: boolean, guestId?: string): Promise<void> {
  try {
    if (isGuest) {
      const guestPayload = {
        isGuest: true,
        guestId: guestId || `guest_${Date.now()}`,
      };
      await AsyncStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestPayload));
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      await AsyncStorage.removeItem(GUEST_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Failed to set guest mode:', err);
  }
}

export async function loadGuestMode(): Promise<{ isGuest: boolean; guestId?: string }> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return { isGuest: false };
    const parsed = JSON.parse(raw);
    return { isGuest: true, guestId: parsed.guestId };
  } catch (err) {
    return { isGuest: false };
  }
}
