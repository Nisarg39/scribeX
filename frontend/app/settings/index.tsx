import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  ShieldCheck,
} from 'lucide-react-native';
import { useTheme } from '../../src/theme';
import { NoteColors } from '../../src/theme/tokens';
import { useSecurity } from '../../src/context';
import { useNotesStore } from '../../src/state/useNotesStore';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { securityConfig, hasMasterConfigured } = useSecurity();
  const { notes, folders } = useNotesStore();

  const [isSecurityExpanded, setIsSecurityExpanded] = useState(false);

  const lockedNotesCount = notes.filter((n) => n.isLocked).length;
  const lockedFoldersCount = folders.filter((f) => f.is_locked === 1).length;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  return (
    <View
      className="flex-1 bg-light-surface dark:bg-dark-surface"
      style={{ paddingTop: Math.max(insets.top, 8), paddingBottom: insets.bottom }}
    >
      {/* Top Bar */}
      <View
        className="flex-row items-center gap-3 px-4 md:px-8 pb-3 border-b"
        style={{ borderColor: colors.borderSubtle }}
      >
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          className="w-10 h-10 rounded-full items-center justify-center active:opacity-75"
          style={{ backgroundColor: isDark ? '#303030' : '#F1F3F7' }}
        >
          <ChevronLeft size={20} color={colors.textPrimary} strokeWidth={2.2} />
        </Pressable>
        <View>
          <Text
            className="text-[20px] font-black tracking-tight"
            style={{ color: colors.textPrimary }}
          >
            Settings
          </Text>
          <Text className="text-[12px]" style={{ color: colors.textMuted }}>
            Workspace preferences & protection
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 md:px-8" contentContainerStyle={{ paddingVertical: 16 }}>
        {/* Primary Settings Option 1: Security (Expandable) */}
        <View
          className="border-b pb-2"
          style={{ borderColor: colors.borderSubtle }}
        >
          <Pressable
            onPress={() => setIsSecurityExpanded((prev) => !prev)}
            accessibilityRole="button"
            accessibilityState={{ expanded: isSecurityExpanded }}
            accessibilityLabel="Security Settings Section"
            className="flex-row items-center justify-between py-3.5 px-2 rounded-2xl active:opacity-80"
          >
            <View className="flex-row items-center gap-3.5 flex-1 pr-3">
              <View
                className="w-11 h-11 rounded-2xl items-center justify-center"
                style={{
                  backgroundColor: isDark ? 'rgba(177, 138, 243, 0.16)' : '#F2ECFE',
                }}
              >
                <ShieldCheck size={20} color={NoteColors.lavender} strokeWidth={2.2} />
              </View>
              <View className="flex-1">
                <Text
                  className="text-[16px] font-extrabold tracking-tight"
                  style={{ color: colors.textPrimary }}
                >
                  Security
                </Text>
                <Text className="text-[12.5px] mt-0.5" style={{ color: colors.textSecondary }}>
                  {hasMasterConfigured
                    ? `Master ${
                        securityConfig.masterCredentialType === 'password' ? 'Password' : 'PIN'
                      } active${securityConfig.appLockEnabled ? ' • Startup Lock ON' : ''}`
                    : 'Set up Master Lock, auto-relock & vault protection'}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-2">
              {lockedFoldersCount + lockedNotesCount > 0 ? (
                <View
                  className="px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: isDark ? 'rgba(8, 196, 229, 0.15)' : '#E0F7FA',
                  }}
                >
                  <Text className="text-[11px] font-bold" style={{ color: NoteColors.cyan }}>
                    {lockedFoldersCount + lockedNotesCount} locked
                  </Text>
                </View>
              ) : null}

              {isSecurityExpanded ? (
                <ChevronDown size={19} color={colors.textSecondary} />
              ) : (
                <ChevronRight size={19} color={colors.textSecondary} />
              )}
            </View>
          </Pressable>

          {/* Expanded Sub-Navlink: Manage PIN / Password */}
          {isSecurityExpanded && (
            <View className="pl-14 pr-2 pb-2 pt-1">
              <Pressable
                onPress={() => router.push('/settings/pin-password')}
                accessibilityRole="button"
                accessibilityLabel="Manage PIN / Password"
                className="flex-row items-center justify-between py-3 px-4 rounded-2xl border active:opacity-80"
                style={{
                  backgroundColor: isDark ? '#2C2C2C' : '#F8FAFC',
                  borderColor: colors.borderSubtle,
                }}
              >
                <View className="flex-row items-center gap-3 flex-1 pr-2">
                  <KeyRound size={17} color={NoteColors.cyan} strokeWidth={2.2} />
                  <View className="flex-1">
                    <Text
                      className="text-[14.5px] font-bold"
                      style={{ color: colors.textPrimary }}
                    >
                      Manage PIN / Password
                    </Text>
                    <Text className="text-[12px] mt-0.5" style={{ color: colors.textMuted }}>
                      Master credential, auto-relock, {lockedFoldersCount} folders &{' '}
                      {lockedNotesCount} notes
                    </Text>
                  </View>
                </View>
                <ChevronRight size={17} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
