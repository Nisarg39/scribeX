import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context';
import { useTheme } from '../../src/theme';
import { NoteColors } from '../../src/theme/tokens';

export default function DriveCallbackScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { isLoading, isDriveChecking, isCloudSyncReady } = useAuth();

  useEffect(() => {
    if (isLoading || isDriveChecking) return;
    const timer = setTimeout(() => {
      router.replace(isCloudSyncReady ? '/home' : '/signin');
    }, 150);
    return () => clearTimeout(timer);
  }, [isLoading, isDriveChecking, isCloudSyncReady, router]);

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
