import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context';
import { useTheme } from '../../src/theme';
import { NoteColors } from '../../src/theme/tokens';

try {
  WebBrowser.maybeCompleteAuthSession();
} catch {
  // Ignore when unavailable in non-browser runners
}

export default function DriveCallbackScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { isLoading, isDriveChecking, isCloudSyncReady, refreshDriveState } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(true);

  useEffect(() => {
    let active = true;
    void refreshDriveState()
      .catch(() => {})
      .finally(() => {
        if (active) setIsRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [refreshDriveState]);

  useEffect(() => {
    if (isLoading || isDriveChecking || isRefreshing) return;
    const timer = setTimeout(() => {
      router.replace(isCloudSyncReady ? '/home' : '/signin');
    }, 150);
    return () => clearTimeout(timer);
  }, [isLoading, isDriveChecking, isRefreshing, isCloudSyncReady, router]);

  return (
    <View
      className="flex-1 items-center justify-center px-8"
      style={{ backgroundColor: isDark ? '#101115' : '#F8FAFC' }}
    >
      <ActivityIndicator size="large" color={NoteColors.cyan} />
      <Text
        className="mt-4 text-sm font-semibold"
        style={{ color: isDark ? '#E2E8F0' : '#334155' }}
      >
        Connecting Google Drive Vault...
      </Text>
    </View>
  );
}
