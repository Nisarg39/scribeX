import '../global.css';
import React, { useEffect } from 'react';
import { Slot, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../src/theme';
import { AuthProvider } from '../src/context';
import { NotesProvider } from '../src/state/useNotesStore';
import { View, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

// Silence React Native Web "Running application 'main'..." banner
if (typeof console !== 'undefined' && console.log) {
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('Running application "')) {
      return;
    }
    originalLog.apply(console, args);
  };
}

// Disable Reanimated strict logger warning flood in DEV to protect JS bridge responsiveness
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

function RootContent() {
  const { isDark } = useTheme();
  const router = useRouter();

  useEffect(() => {
    const handleDeepLink = (data: any) => {
      if (!data) return;
      const targetType = data.targetType;
      const targetId = data.targetId;
      const noteId = data.noteId || (targetType === 'note' ? targetId : undefined);

      if (targetType === 'note' && noteId) {
        router.push(`/note/${noteId}`);
      } else if (targetType === 'task') {
        if (targetId) {
          router.push({ pathname: '/home', params: { tab: 'tasks', taskId: targetId } });
        } else {
          router.push({ pathname: '/home', params: { tab: 'tasks' } });
        }
      }
    };

    // 1. Mobile OS Notification response listener (Android & iOS foreground & background)
    let subscription: { remove: () => void } | undefined;
    if (Platform.OS !== 'web' && Notifications.addNotificationResponseReceivedListener) {
      try {
        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response?.notification?.request?.content?.data;
          handleDeepLink(data);
        });

        // Cold-start check if launched directly from a killed-state notification tap
        if (Notifications.getLastNotificationResponseAsync) {
          Notifications.getLastNotificationResponseAsync().then((response) => {
            if (response) {
              const data = response?.notification?.request?.content?.data;
              handleDeepLink(data);
            }
          });
        }
      } catch (err) {
        console.warn('Failed to attach native notification response listener:', err);
      }
    }

    // 2. Web Notification onclick custom event listener
    let webListener: ((e: any) => void) | undefined;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      webListener = (e: any) => {
        handleDeepLink(e.detail);
      };
      window.addEventListener('scribex:navigate', webListener);
    }

    return () => {
      subscription?.remove();
      if (webListener && typeof window !== 'undefined') {
        window.removeEventListener('scribex:navigate', webListener);
      }
    };
  }, [router]);

  return (
    <View className="flex-1 bg-light-appBg dark:bg-dark-appBg">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Slot />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NotesProvider>
            <RootContent />
          </NotesProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
