import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextValue {
  hasCompletedOnboarding: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  completeOnboarding: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  resetAllState: () => Promise<void>;
}

const STORAGE_KEYS = {
  ONBOARDING_COMPLETED: 'scribex_onboarding_completed',
  AUTH_TOKEN: 'scribex_auth_token',
};

const AuthContext = createContext<AuthContextValue>({
  hasCompletedOnboarding: false,
  isAuthenticated: false,
  isLoading: true,
  completeOnboarding: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  resetAllState: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load persistent state on initial app mount
  useEffect(() => {
    async function loadPersistedState() {
      try {
        const [onboardingVal, authVal] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED),
          AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
        ]);

        if (onboardingVal === 'true') {
          setHasCompletedOnboarding(true);
        }
        if (authVal === 'authenticated') {
          setIsAuthenticated(true);
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

  const signIn = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, 'authenticated');
      setIsAuthenticated(true);
    } catch (err) {
      console.warn('Failed to persist auth state:', err);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      setIsAuthenticated(false);
    } catch (err) {
      console.warn('Failed to remove auth state:', err);
    }
  };

  const resetAllState = async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ONBOARDING_COMPLETED,
        STORAGE_KEYS.AUTH_TOKEN,
      ]);
      setHasCompletedOnboarding(false);
      setIsAuthenticated(false);
    } catch (err) {
      console.warn('Failed to reset state:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        hasCompletedOnboarding,
        isAuthenticated,
        isLoading,
        completeOnboarding,
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
