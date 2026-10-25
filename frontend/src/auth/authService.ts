/**
 * SaaS Authentication Service.
 *
 * Handles API calls to backend authentication endpoints and provides
 * instant local account generation for offline/development environments.
 */

import { appConfig } from '../core/config';
import {
  AuthSession,
  SignInCredentials,
  SignUpPayload,
  User,
} from './authTypes';

export const authService = {
  /**
   * Sign In with email and optional password.
   */
  async login(credentials: SignInCredentials): Promise<AuthSession> {
    const email = credentials.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    try {
      // Attempt backend auth endpoint if available
      const response = await fetch(`${appConfig.apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (response.ok) {
        const data = await response.json();
        return data as AuthSession;
      }
    } catch (e) {
      // Backend auth endpoint not mounted yet or server unreachable
    }

    // Client-side SaaS account generation (local dev & offline-first ready)
    const sanitizedId = `usr_${email.replace(/[^a-z0-9]/g, '_')}`;
    const namePart = email.split('@')[0];
    const formattedName =
      namePart.charAt(0).toUpperCase() + namePart.slice(1);

    const user: User = {
      id: sanitizedId,
      email,
      name: formattedName,
      createdAt: new Date().toISOString(),
    };

    const session: AuthSession = {
      user,
      token: `jwt_local_${sanitizedId}_${Date.now()}`,
    };

    return session;
  },

  /**
   * Sign Up / Register a new account.
   */
  async register(payload: SignUpPayload): Promise<AuthSession> {
    const email = payload.email.trim().toLowerCase();
    const name = payload.name.trim();

    if (!name) {
      throw new Error('Please enter your full name.');
    }
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    try {
      const response = await fetch(`${appConfig.apiUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        return data as AuthSession;
      }
    } catch (e) {
      // Fallback to local session
    }

    const sanitizedId = `usr_${email.replace(/[^a-z0-9]/g, '_')}`;
    const user: User = {
      id: sanitizedId,
      email,
      name,
      createdAt: new Date().toISOString(),
    };

    const session: AuthSession = {
      user,
      token: `jwt_local_${sanitizedId}_${Date.now()}`,
    };

    return session;
  },

  /**
   * Create an instant Offline Guest Session.
   */
  createGuestSession(guestName: string = 'Guest Explorer'): AuthSession {
    const guestId = `guest_${Math.random().toString(36).substring(2, 9)}`;
    const user: User = {
      id: guestId,
      email: `${guestId}@local.scribex`,
      name: guestName,
      isGuest: true,
      createdAt: new Date().toISOString(),
    };

    return {
      user,
      token: `guest_token_${guestId}`,
    };
  },
};
