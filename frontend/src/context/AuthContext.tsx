import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabase/supabaseClient';
import { migrateGuestVaultToUser } from '../db/vaultMigration';
import { googleDriveVaultService } from '../services/drive/googleDriveVaultService';

if (Platform.OS === 'web') {
  try {
    WebBrowser.maybeCompleteAuthSession();
  } catch {
    // Ignore if unavailable in SSR or non-browser test runners
  }
}

export interface AuthUser {
  id: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  userId: string;
  hasCompletedOnboarding: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  isSigningIn: boolean;
  authError: string | null;
  completeOnboarding: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signIn: () => Promise<void>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  resetAllState: () => Promise<void>;
}

const STORAGE_KEYS = {
  ONBOARDING_COMPLETED: 'scribex_onboarding_completed',
  AUTH_TOKEN: 'scribex_auth_token',
  GUEST_MODE: 'scribex_guest_mode',
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userId: 'user-default',
  hasCompletedOnboarding: false,
  isAuthenticated: false,
  isGuest: false,
  isLoading: true,
  isSigningIn: false,
  authError: null,
  completeOnboarding: async () => {},
  continueAsGuest: async () => {},
  signIn: async () => {},
  signInWithGoogle: async () => false,
  signOut: async () => {},
  clearAuthError: () => {},
  resetAllState: async () => {},
});

function extractUserFromSession(session: Session | null): AuthUser | null {
  if (!session?.user) return null;
  const meta = session.user.user_metadata || {};
  return {
    id: session.user.id,
    email: session.user.email,
    fullName: meta.full_name || meta.name || undefined,
    avatarUrl: meta.avatar_url || meta.picture || undefined,
  };
}

function parseOAuthCallbackParams(url: string): {
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  errorDescription?: string;
} {
  try {
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');
    const params = new URLSearchParams();

    if (queryIndex !== -1) {
      const end = hashIndex !== -1 && hashIndex > queryIndex ? hashIndex : url.length;
      const queryStr = url.slice(queryIndex + 1, end);
      new URLSearchParams(queryStr).forEach((v, k) => params.set(k, v));
    }

    if (hashIndex !== -1) {
      const hashStr = url.slice(hashIndex + 1);
      new URLSearchParams(hashStr).forEach((v, k) => params.set(k, v));
    }

    return {
      accessToken: params.get('access_token') || undefined,
      refreshToken: params.get('refresh_token') || undefined,
      code: params.get('code') || undefined,
      errorDescription: params.get('error_description') || params.get('error') || undefined,
    };
  } catch {
    return {};
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleAuthenticatedSession = useCallback(async (session: Session | null) => {
    const extracted = extractUserFromSession(session);
    if (!extracted) return;

    await googleDriveVaultService.syncDriveTokenFromSupabaseSession(session).catch(() => {});

    try {
      await migrateGuestVaultToUser(extracted.id);
    } catch (migErr) {
      console.warn('Guest vault migration failed cleanly without blocking login:', migErr);
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, 'authenticated');
      await AsyncStorage.removeItem(STORAGE_KEYS.GUEST_MODE);
    } catch (storageErr) {
      console.warn('Failed to persist auth flags:', storageErr);
    }

    setUser(extracted);
    setIsAuthenticated(true);
    setIsGuest(false);
    setAuthError(null);
  }, []);

  // Load persistent state and subscribe to Supabase Auth changes on mount
  useEffect(() => {
    let isMounted = true;

    async function loadPersistedState() {
      try {
        const [onboardingVal, guestVal] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED),
          AsyncStorage.getItem(STORAGE_KEYS.GUEST_MODE),
        ]);

        if (!isMounted) return;

        if (onboardingVal === 'true') {
          setHasCompletedOnboarding(true);
        }

        if (isSupabaseConfigured()) {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.user && isMounted) {
            await handleAuthenticatedSession(data.session);
            return;
          }
        }

        if (guestVal === 'true' && isMounted) {
          setIsGuest(true);
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (err) {
        console.warn('Failed to load persisted auth/onboarding state:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPersistedState();

    let subscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured()) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;

        if (session?.user) {
          await handleAuthenticatedSession(session);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAuthenticated(false);
          await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN).catch(() => {});
        }
      });
      subscription = data.subscription;
    }

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [handleAuthenticatedSession]);

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
      setHasCompletedOnboarding(true);
    } catch (err) {
      console.warn('Failed to persist onboarding state:', err);
    }
  };

  const continueAsGuest = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.GUEST_MODE, 'true');
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      setUser(null);
      setIsGuest(true);
      setIsAuthenticated(false);
      setAuthError(null);
    } catch (err) {
      console.warn('Failed to persist guest mode state:', err);
    }
  };

  const signInWithGoogle = async (): Promise<boolean> => {
    setAuthError(null);
    setIsSigningIn(true);

    try {
      if (!isSupabaseConfigured()) {
        setAuthError(
          'Supabase is not configured. Please check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.'
        );
        return false;
      }

      if (Platform.OS === 'web') {
        const redirectTo =
          typeof window !== 'undefined' ? `${window.location.origin}/signin` : undefined;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        });

        if (error) {
          setAuthError(error.message);
          return false;
        }
        return true;
      }

      // Mobile (iOS / Android) PKCE/OAuth session flow
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error || !data?.url) {
        setAuthError(error?.message || 'Unable to start Google Sign-In flow.');
        return false;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !result.url) {
        // User cancelled or dismissed browser
        return false;
      }

      const { accessToken, refreshToken, code, errorDescription } = parseOAuthCallbackParams(
        result.url
      );

      if (errorDescription) {
        setAuthError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
        return false;
      }

      if (accessToken && refreshToken) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError || !sessionData.session) {
          setAuthError(sessionError?.message || 'Failed to establish Google session.');
          return false;
        }
        await handleAuthenticatedSession(sessionData.session);
        return true;
      }

      if (code) {
        const { data: exchangeData, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError || !exchangeData.session) {
          setAuthError(exchangeError?.message || 'Failed to complete Google OAuth exchange.');
          return false;
        }
        await handleAuthenticatedSession(exchangeData.session);
        return true;
      }

      setAuthError('Google sign-in completed without returning a valid session token.');
      return false;
    } catch (err: any) {
      setAuthError(err?.message || 'Unexpected error during Google sign-in.');
      return false;
    } finally {
      setIsSigningIn(false);
    }
  };

  const signIn = async () => {
    await signInWithGoogle();
  };

  const signOut = async () => {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
      await AsyncStorage.multiRemove([STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.GUEST_MODE]);
      setUser(null);
      setIsAuthenticated(false);
      setIsGuest(false);
      setAuthError(null);
    } catch (err) {
      console.warn('Failed to remove auth state:', err);
    }
  };

  const resetAllState = async () => {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut().catch(() => {});
      }
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ONBOARDING_COMPLETED,
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.GUEST_MODE,
      ]);
      setUser(null);
      setHasCompletedOnboarding(false);
      setIsAuthenticated(false);
      setIsGuest(false);
      setAuthError(null);
    } catch (err) {
      console.warn('Failed to reset state:', err);
    }
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        userId: user?.id || 'user-default',
        hasCompletedOnboarding,
        isAuthenticated,
        isGuest,
        isLoading,
        isSigningIn,
        authError,
        completeOnboarding,
        continueAsGuest,
        signIn,
        signInWithGoogle,
        signOut,
        clearAuthError,
        resetAllState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
