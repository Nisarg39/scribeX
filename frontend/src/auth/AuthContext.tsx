/**
 * Central User & Authentication Context.
 *
 * Provides reactive authentication state, session initialization,
 * and dynamic multi-tenant binding to the synchronization engine.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  AuthContextValue,
  AuthState,
  SignInCredentials,
  SignUpPayload,
  User,
} from './authTypes';
import {
  loadSession,
  saveSession,
  clearSession,
  loadGuestMode,
  setGuestMode,
} from './sessionStorage';
import { authService } from './authService';
import { syncEngine } from '../sync/syncEngine';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    isGuest: false,
    authMode: 'unauthenticated',
    user: null,
    token: null,
    error: null,
  });

  // Initialize session on mount from persistent storage
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const session = await loadSession();
        if (session && isMounted) {
          setState({
            isLoading: false,
            isAuthenticated: true,
            isGuest: false,
            authMode: 'authenticated',
            user: session.user,
            token: session.token,
            error: null,
          });
          syncEngine.setAuthContext(session.user.id, session.token);
          return;
        }

        const guestMode = await loadGuestMode();
        if (guestMode.isGuest && isMounted) {
          const guestSession = authService.createGuestSession();
          if (guestMode.guestId) {
            guestSession.user.id = guestMode.guestId;
          }
          setState({
            isLoading: false,
            isAuthenticated: false,
            isGuest: true,
            authMode: 'guest',
            user: guestSession.user,
            token: guestSession.token,
            error: null,
          });
          syncEngine.setAuthContext(guestSession.user.id, guestSession.token);
          return;
        }

        if (isMounted) {
          setState({
            isLoading: false,
            isAuthenticated: false,
            isGuest: false,
            authMode: 'unauthenticated',
            user: null,
            token: null,
            error: null,
          });
          syncEngine.setAuthContext(null, null);
        }
      } catch (err: any) {
        if (isMounted) {
          setState({
            isLoading: false,
            isAuthenticated: false,
            isGuest: false,
            authMode: 'unauthenticated',
            user: null,
            token: null,
            error: err?.message || 'Failed to initialize session',
          });
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = useCallback(async (credentials: SignInCredentials) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const session = await authService.login(credentials);
      await saveSession(session);
      syncEngine.setAuthContext(session.user.id, session.token);

      setState({
        isLoading: false,
        isAuthenticated: true,
        isGuest: false,
        authMode: 'authenticated',
        user: session.user,
        token: session.token,
        error: null,
      });
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err?.message || 'Failed to sign in. Please check your credentials.',
      }));
      throw err;
    }
  }, []);

  const signUp = useCallback(async (payload: SignUpPayload) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const session = await authService.register(payload);
      await saveSession(session);
      syncEngine.setAuthContext(session.user.id, session.token);

      setState({
        isLoading: false,
        isAuthenticated: true,
        isGuest: false,
        authMode: 'authenticated',
        user: session.user,
        token: session.token,
        error: null,
      });
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err?.message || 'Failed to register account.',
      }));
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      await clearSession();
      syncEngine.setAuthContext(null, null);

      setState({
        isLoading: false,
        isAuthenticated: false,
        isGuest: false,
        authMode: 'unauthenticated',
        user: null,
        token: null,
        error: null,
      });
    } catch (err: any) {
      console.warn('Error during signOut:', err);
    }
  }, []);

  const continueAsGuest = useCallback(async (guestName?: string) => {
    const guestSession = authService.createGuestSession(guestName);
    await setGuestMode(true, guestSession.user.id);
    syncEngine.setAuthContext(guestSession.user.id, guestSession.token);

    setState({
      isLoading: false,
      isAuthenticated: false,
      isGuest: true,
      authMode: 'guest',
      user: guestSession.user,
      token: guestSession.token,
      error: null,
    });
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const value: AuthContextValue = {
    ...state,
    signIn,
    signUp,
    signOut,
    continueAsGuest,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
