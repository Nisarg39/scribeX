import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextValue {
  hasCompletedOnboarding: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  completeOnboarding: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  resetAllState: () => Promise<void>;
}

const STORAGE_KEYS = {
  ONBOARDING_COMPLETED: 'scribex_onboarding_completed',
  AUTH_TOKEN: 'scribex_auth_token',
  GUEST_MODE: 'scribex_guest_mode',
};

const AuthContext = createContext<AuthContextValue>({
  hasCompletedOnboarding: false,
  isAuthenticated: false,
  isGuest: false,
  isLoading: true,
  completeOnboarding: async () => {},
  continueAsGuest: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  resetAllState: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load persistent state on initial app mount
  useEffect(() => {
    async function loadPersistedState() {
      try {
        const [onboardingVal, authVal, guestVal] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED),
          AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
          AsyncStorage.getItem(STORAGE_KEYS.GUEST_MODE),
        ]);

        if (onboardingVal === 'true') {
          setHasCompletedOnboarding(true);
        }
        if (authVal === 'authenticated') {
          setIsAuthenticated(true);
          setIsGuest(false);
        } else if (guestVal === 'true') {
          setIsGuest(true);
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.warn('Failed to load persisted auth/onboarding state:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadPersistedState();
  }, []);

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
      setIsGuest(true);
      setIsAuthenticated(false);
    } catch (err) {
      console.warn('Failed to persist guest mode state:', err);
    }
  };

  const signIn = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, 'authenticated');
      await AsyncStorage.removeItem(STORAGE_KEYS.GUEST_MODE);
      setIsAuthenticated(true);
      setIsGuest(false);
    } catch (err) {
      console.warn('Failed to persist auth state:', err);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.multiRemove([STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.GUEST_MODE]);
      setIsAuthenticated(false);
      setIsGuest(false);
    } catch (err) {
      console.warn('Failed to remove auth state:', err);
    }
  };

  const resetAllState = async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ONBOARDING_COMPLETED,
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.GUEST_MODE,
      ]);
      setHasCompletedOnboarding(false);
      setIsAuthenticated(false);
      setIsGuest(false);
    } catch (err) {
      console.warn('Failed to reset state:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        hasCompletedOnboarding,
        isAuthenticated,
        isGuest,
        isLoading,
        completeOnboarding,
        continueAsGuest,
        signIn,
        signOut,
        resetAllState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
