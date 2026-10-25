/**
 * Central User & Authentication Type Definitions.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  isGuest?: boolean;
  createdAt: string;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt?: string;
}

export type AuthMode = 'authenticated' | 'guest' | 'unauthenticated';

export interface SignInCredentials {
  email: string;
  password?: string;
}

export interface SignUpPayload {
  name: string;
  email: string;
  password?: string;
}

export interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  authMode: AuthMode;
  user: User | null;
  token: string | null;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  signIn: (credentials: SignInCredentials) => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: (guestName?: string) => Promise<void>;
  clearError: () => void;
}
