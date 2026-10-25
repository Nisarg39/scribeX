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
   * Sign In with email and password via backend API.
   */
  async login(credentials: SignInCredentials): Promise<AuthSession> {
    const email = credentials.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!credentials.password) {
      throw new Error('Please enter your password.');
    }

    try {
      const response = await fetch(`${appConfig.apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: credentials.password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'Invalid email or password.');
      }

      const data = await response.json();
      return data as AuthSession;
    } catch (err: any) {
      if (err.message && err.message !== 'Failed to fetch') {
        throw err;
      }
      throw new Error('Cannot connect to ScribeX server. Please ensure the backend is running.');
    }
  },

  /**
   * Sign Up / Register a new account via backend API.
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
    if (!payload.password || payload.password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    try {
      const response = await fetch(`${appConfig.apiUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password: payload.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'Registration failed.');
      }

      const data = await response.json();
      return data as AuthSession;
    } catch (err: any) {
      if (err.message && err.message !== 'Failed to fetch') {
        throw err;
      }
      throw new Error('Cannot connect to ScribeX server. Please ensure the backend is running.');
    }
  },

  /**
   * Fetch currently authenticated profile from backend.
   */
  async getMe(token: string): Promise<User> {
    const response = await fetch(`${appConfig.apiUrl}/api/v1/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Session expired or invalid.');
    }

    return (await response.json()) as User;
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
