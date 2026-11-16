import '../global.css';
import React, { useEffect, useState } from 'react';
import { Slot, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../src/theme';
import { AuthProvider, SecurityProvider, useSecurity } from '../src/context';
import { AppLockScreenOverlay } from '../src/components/security/AppLockScreenOverlay';
import { ShareDestinationModal } from '../src/components/share/ShareDestinationModal';
import { NotesProvider, useNotesStore } from '../src/state/useNotesStore';
import { shareIngestService } from '../src/services/share/ShareIngestService';
import { SynthesizedNoteResult } from '../src/core/share/types';
import { View, Platform } from 'react-native';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

// Silence React Native Web "Running application 'main'..." banner & push token web warning
if (typeof console !== 'undefined') {
  if (console.log) {
    const originalLog = console.log;
    console.log = (...args: any[]) => {
      if (typeof args[0] === 'string' && args[0].startsWith('Running application "')) {
        return;
      }
      originalLog.apply(console, args);
    };
  }
  if (console.warn) {
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      if (
        typeof args[0] === 'string' &&
        args[0].includes('[expo-notifications] Listening to push token changes is not yet fully supported on web')
      ) {
        return;
      }
      originalWarn.apply(console, args);
    };
  }
}

// Disable Reanimated strict logger warning flood in DEV to protect JS bridge responsiveness
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

function RootContent() {
  const { isDark } = useTheme();
  const router = useRouter();
  const { notes, activeFolders, addNoteWithBlocks, appendBlocksToNote } = useNotesStore();
  const [pendingSharedNote, setPendingSharedNote] = useState<SynthesizedNoteResult | null>(null);
  const {
    isSecurityLoading,
    isAppLocked,
    securityConfig,
    unlockAppWithCredential,
    unlockAppWithBiometrics,
    biometricCapability,
  } = useSecurity();

  useEffect(() => {
    const unsubscribeShare = shareIngestService.initialize(
      addNoteWithBlocks,
      (noteId) => {
        router.push(`/note/${noteId}`);
      },
      (synthesized) => {
        setPendingSharedNote(synthesized);
      }
    );

    return () => {
      unsubscribeShare();
    };
  }, [addNoteWithBlocks, router]);

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
    if (Platform.OS !== 'web') {
      try {
        const Notifications = require('expo-notifications');
        if (Notifications.addNotificationResponseReceivedListener) {
          subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
            const data = response?.notification?.request?.content?.data;
            handleDeepLink(data);
          });
        }

        // Cold-start check if launched directly from a killed-state notification tap
        if (Notifications.getLastNotificationResponseAsync) {
          Notifications.getLastNotificationResponseAsync().then((response: any) => {
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

  if (isSecurityLoading) {
    return (
      <View className="flex-1 bg-light-appBg dark:bg-dark-appBg">
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    );
  }

  if (isAppLocked) {
    return (
      <View className="flex-1 bg-light-appBg dark:bg-dark-appBg">
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AppLockScreenOverlay
          credentialKind={securityConfig.masterCredentialType}
          masterHint={securityConfig.masterHint}
          onUnlockAttempt={unlockAppWithCredential}
          biometricsEnabled={securityConfig.biometricsEnabled && Boolean(biometricCapability?.isAvailable)}
          biometricDisplayName={biometricCapability?.displayName || 'Biometrics'}
          onBiometricUnlockSuccess={unlockAppWithBiometrics}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-light-appBg dark:bg-dark-appBg">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Slot />
      <ShareDestinationModal
        visible={Boolean(pendingSharedNote)}
        synthesized={pendingSharedNote}
        notes={notes}
        folders={activeFolders}
        onClose={() => setPendingSharedNote(null)}
        onSaveNewNote={async ({ title, folderPath, blocks, colorToken, tags }) => {
          setPendingSharedNote(null);
          const created = await addNoteWithBlocks({
            title,
            folderPath,
            blocks,
            colorToken,
            tags,
          });
          if (created?.id) {
            router.push(`/note/${created.id}`);
          }
        }}
        onAppendToExistingNote={async (noteId, blocks, tags) => {
          setPendingSharedNote(null);
          const updated = await appendBlocksToNote(noteId, blocks, tags);
          if (updated?.id) {
            router.push(`/note/${updated.id}`);
          }
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <SecurityProvider>
            <NotesProvider>
              <RootContent />
            </NotesProvider>
          </SecurityProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
