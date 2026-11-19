import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  HardDrive,
  KeyRound,
  Lock,
  LogIn,
  ShieldCheck,
} from 'lucide-react-native';
import { useTheme } from '../../src/theme';
import { NoteColors } from '../../src/theme/tokens';
import { useAuth, useSecurity } from '../../src/context';
import { useNotesStore } from '../../src/state/useNotesStore';
import {
  googleDriveVaultService,
  type GoogleDriveAccountState,
} from '../../src/services/drive/googleDriveVaultService';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { securityConfig, hasMasterConfigured } = useSecurity();
  const { user, isAuthenticated, isGuest } = useAuth();
  const { notes, folders } = useNotesStore();

  const [isSecurityExpanded, setIsSecurityExpanded] = useState(false);
  const [driveAccount, setDriveAccount] = useState<GoogleDriveAccountState | null>(null);
  const [isDriveBusy, setIsDriveBusy] = useState(false);
  const [driveStatusMsg, setDriveStatusMsg] = useState<string | null>(null);

  const cloudSyncUnlocked = isAuthenticated && !isGuest && Boolean(user?.id);

  useEffect(() => {
    let active = true;
    if (!cloudSyncUnlocked || !user?.id) {
      setDriveAccount(null);
      return;
    }
    void googleDriveVaultService.getDriveAccountState(user.id).then((state) => {
      if (active) setDriveAccount(state);
    });
    return () => {
      active = false;
    };
  }, [cloudSyncUnlocked, user?.id]);

  const handleConnectOrSwitchDrive = async () => {
    if (!cloudSyncUnlocked || !user?.id || isDriveBusy) return;
    setIsDriveBusy(true);
    setDriveStatusMsg(null);
    const result = await googleDriveVaultService.connectOrSwitchDriveAccount(user.id);
    if (result.ok && result.account) {
      setDriveAccount(result.account);
      setDriveStatusMsg(`Connected to ${result.account.email}`);
    } else if (result.error) {
      setDriveStatusMsg(result.error);
    }
    setIsDriveBusy(false);
  };

  const handleDisconnectDrive = async () => {
    if (!cloudSyncUnlocked || !user?.id || isDriveBusy) return;
    setIsDriveBusy(true);
    setDriveStatusMsg(null);
    await googleDriveVaultService.disconnectDriveAccount(user.id);
    setDriveAccount(null);
    setDriveStatusMsg('Google Drive Vault disconnected.');
    setIsDriveBusy(false);
  };

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
        {/* Cloud Sync & Google Drive Media Vault (Auth-Gated) */}
        <View
          className="mb-2 border-b pb-4"
          style={{ borderColor: colors.borderSubtle }}
        >
          <View className="px-2 py-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center gap-3.5 pr-3">
                <View
                  className="h-11 w-11 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: cloudSyncUnlocked
                      ? isDark
                        ? 'rgba(8, 196, 229, 0.16)'
                        : '#E0F7FA'
                      : isDark
                      ? 'rgba(255,255,255,0.06)'
                      : '#F1F5F9',
                  }}
                >
                  {cloudSyncUnlocked ? (
                    <Cloud size={20} color={NoteColors.cyan} strokeWidth={2.2} />
                  ) : (
                    <Lock size={20} color={colors.textMuted} strokeWidth={2.2} />
                  )}
                </View>
                <View className="flex-1">
                  <Text
                    className="text-[16px] font-extrabold tracking-tight"
                    style={{ color: colors.textPrimary }}
                  >
                    Cloud Sync & Google Drive Vault
                  </Text>
                  <Text className="mt-0.5 text-[12.5px]" style={{ color: colors.textSecondary }}>
                    {cloudSyncUnlocked
                      ? `Signed in as ${user?.email || 'Google Account'}`
                      : 'Sign in with Google to enable cloud sync & Drive media storage'}
                  </Text>
                </View>
              </View>

              <View
                className="rounded-full px-2.5 py-1"
                style={{
                  backgroundColor: cloudSyncUnlocked
                    ? driveAccount
                      ? isDark
                        ? 'rgba(8, 196, 229, 0.15)'
                        : '#E0F7FA'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#F1F5F9'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : '#F1F5F9',
                }}
              >
                <Text
                  className="text-[11px] font-bold"
                  style={{
                    color:
                      cloudSyncUnlocked && driveAccount ? NoteColors.cyan : colors.textSecondary,
                  }}
                >
                  {!cloudSyncUnlocked
                    ? 'Offline'
                    : driveAccount
                    ? 'Connected'
                    : 'Not Linked'}
                </Text>
              </View>
            </View>

            {!cloudSyncUnlocked ? (
              <View className="mt-3 pl-14">
                <Pressable
                  onPress={() => router.push('/signin')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in with Google to Enable"
                  className="self-start flex-row items-center rounded-xl px-4 py-2.5 active:opacity-80"
                  style={{ backgroundColor: NoteColors.cyan }}
                >
                  <LogIn size={15} color="#0F172A" />
                  <Text className="ml-2 text-xs font-bold" style={{ color: '#0F172A' }}>
                    Sign in with Google to Enable
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="mt-3 pl-14 pr-2">
                <View className="flex-row items-center">
                  <HardDrive
                    size={15}
                    color={driveAccount ? NoteColors.cyan : colors.textMuted}
                  />
                  <Text
                    className="ml-2 flex-1 text-[13px] font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    {driveAccount
                      ? `Drive Vault: ${driveAccount.email}`
                      : 'No Google Drive account connected for media vault'}
                  </Text>
                </View>

                <View className="mt-2.5 flex-row flex-wrap items-center gap-2.5">
                  <Pressable
                    onPress={handleConnectOrSwitchDrive}
                    disabled={isDriveBusy}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={driveAccount ? 'Switch Account' : 'Connect Google Drive'}
                    className="flex-row items-center justify-center rounded-xl px-4 py-2 active:opacity-80"
                    style={{
                      backgroundColor: NoteColors.cyan,
                      opacity: isDriveBusy ? 0.6 : 1,
                    }}
                  >
                    {isDriveBusy ? (
                      <ActivityIndicator size="small" color="#0F172A" />
                    ) : (
                      <Text className="text-xs font-bold" style={{ color: '#0F172A' }}>
                        {driveAccount ? 'Switch Account' : 'Connect Google Drive'}
                      </Text>
                    )}
                  </Pressable>

                  {driveAccount ? (
                    <Pressable
                      onPress={handleDisconnectDrive}
                      disabled={isDriveBusy}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Disconnect Google Drive"
                      className="rounded-xl border px-3.5 py-2 active:opacity-80"
                      style={{
                        borderColor: colors.borderSubtle,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                        opacity: isDriveBusy ? 0.6 : 1,
                      }}
                    >
                      <Text className="text-xs font-semibold" style={{ color: colors.textPrimary }}>
                        Disconnect
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                {driveStatusMsg ? (
                  <Text className="mt-2 text-xs" style={{ color: colors.textSecondary }}>
                    {driveStatusMsg}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        </View>

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
