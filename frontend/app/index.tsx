import React from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/context';

export default function RootIndex() {
  const {
    hasCompletedOnboarding,
    isAuthenticated,
    isGuest,
    isLoading,
    isDriveChecking,
    isDriveConnected,
    hasCompletedDriveSetup,
  } = useAuth();

  if (isLoading || isDriveChecking) {
    return <View className="flex-1 bg-light-appBg dark:bg-dark-appBg" />;
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  // Allow immediate entry if user is logged in (with Drive onboarding completed) OR has chosen offline guest mode
  if (!isAuthenticated && !isGuest) {
    return <Redirect href="/signin" />;
  }

  // Enforce mandatory Google Drive connection during initial sign-in before entering /home
  if (isAuthenticated && !isGuest && !isDriveConnected && !hasCompletedDriveSetup) {
    return <Redirect href="/signin" />;
  }

  return <Redirect href="/home" />;
}
