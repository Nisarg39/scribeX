/**
 * Root Application Navigator & Authentication Gate.
 *
 * Dynamically switches between the SaaS Auth Screen and the authenticated
 * Notes workspace based on central AuthContext state.
 */

import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth';
import { useTheme } from '../theme';
import { AuthScreen } from '../screens/auth';
import { NotesHomeScreen } from '../screens/notes';
import { OnboardingScreen } from '../screens/onboarding';

export const RootNavigator: React.FC = () => {
  const { isLoading, isAuthenticated, isGuest, user } = useAuth();
  const { colors } = useTheme();

  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkOnboarding = async () => {
      if (!isAuthenticated || isGuest) {
        if (isMounted) {
          setNeedsOnboarding(false);
          setHasCheckedOnboarding(true);
        }
        return;
      }

      try {
        const key = `scribex_onboarding_completed_${user?.id || 'default'}`;
        const done = await AsyncStorage.getItem(key);
        if (isMounted) {
          setNeedsOnboarding(!done);
        }
      } catch (err) {
        if (isMounted) setNeedsOnboarding(false);
      } finally {
        if (isMounted) setHasCheckedOnboarding(true);
      }
    };

    checkOnboarding();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isGuest, user?.id]);

  if (isLoading || (isAuthenticated && !isGuest && !hasCheckedOnboarding)) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.appBg }]}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
      </View>
    );
  }

  // If not authenticated and not in offline guest mode, show Auth Screen
  if (!isAuthenticated && !isGuest) {
    return <AuthScreen />;
  }

  // If new user needs first-launch cognitive onboarding
  if (needsOnboarding) {
    return (
      <OnboardingScreen
        onComplete={() => {
          setNeedsOnboarding(false);
        }}
      />
    );
  }

  // Primary authenticated / guest notes workspace
  return <NotesHomeScreen />;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
