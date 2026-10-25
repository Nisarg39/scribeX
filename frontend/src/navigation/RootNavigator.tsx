/**
 * Root Application Navigator & Authentication Gate.
 *
 * Dynamically switches between the SaaS Auth Screen and the authenticated
 * Notes workspace based on central AuthContext state.
 */

import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../auth';
import { useTheme } from '../theme';
import { AuthScreen } from '../screens/auth';
import { NotesHomeScreen } from '../screens/notes';

export const RootNavigator: React.FC = () => {
  const { isLoading, isAuthenticated, isGuest } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
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
