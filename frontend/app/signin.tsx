import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/context';
import { googleDriveVaultService } from '../src/services/drive/googleDriveVaultService';
import { Sun, Moon, ArrowRight, AlertCircle, X, ShieldCheck, HardDrive } from 'lucide-react-native';

const GoogleMark: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <Path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <Path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <Path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </Svg>
);

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const {
    user,
    userId,
    signInWithGoogle,
    continueAsGuest,
    isSigningIn,
    authError,
    clearAuthError,
    isAuthenticated,
  } = useAuth();

  const [step, setStep] = useState<'auth' | 'drive_select'>('auth');
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  // After Google OAuth completes, prompt for Google Drive account selection once during onboarding
  useEffect(() => {
    let active = true;
    async function checkDriveOnboarding() {
      if (!isAuthenticated || !userId || userId === 'user-default') return;
      const done = await googleDriveVaultService.hasCompletedDriveOnboarding(userId);
      if (!active) return;
      if (done) {
        router.replace('/home');
      } else {
        setStep('drive_select');
      }
    }
    checkDriveOnboarding();
    return () => {
      active = false;
    };
  }, [isAuthenticated, userId, router]);

  const handleSkip = async () => {
    clearAuthError();
    await continueAsGuest();
    router.replace('/home');
  };

  const handleGoogleSignIn = async () => {
    const ok = await signInWithGoogle();
    if (ok && Platform.OS !== 'web' && userId && userId !== 'user-default') {
      const done = await googleDriveVaultService.hasCompletedDriveOnboarding(userId);
      if (done) {
        router.replace('/home');
      } else {
        setStep('drive_select');
      }
    }
  };

  const handleConnectDriveAccount = async () => {
    setDriveError(null);
    setIsConnectingDrive(true);
    try {
      const res = await googleDriveVaultService.connectOrSwitchDriveAccount(userId);
      if (res.ok) {
        router.replace('/home');
      } else if (res.error) {
        setDriveError(res.error);
      }
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleSkipDriveSetup = async () => {
    await googleDriveVaultService.markDriveOnboardingCompleted(userId);
    router.replace('/home');
  };

  const activeError = step === 'drive_select' ? driveError : authError;

  return (
    <View
      className="flex-1 bg-light-appBg dark:bg-dark-appBg justify-between px-8 py-6"
      style={{
        paddingTop: Math.max(insets.top, 24),
        paddingBottom: Math.max(insets.bottom, 32),
      }}
    >
      {/* Top Header - Theme Toggle */}
      <View className="flex-row items-center justify-between">
        <Text className="text-xs uppercase tracking-widest font-semibold text-light-textMuted dark:text-dark-textMuted">
          {step === 'drive_select' ? 'Step 2 · Media Vault' : 'Authentication'}
        </Text>

        <Pressable
          onPress={toggleTheme}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Toggle color scheme"
          className="w-10 h-10 rounded-full bg-light-iconBg dark:bg-dark-iconBg items-center justify-center active:scale-95"
        >
          {isDark ? (
            <Sun size={18} color="#FFFFFF" strokeWidth={2} />
          ) : (
            <Moon size={18} color="#FFFFFF" strokeWidth={2} />
          )}
        </Pressable>
      </View>

      {/* Main Editorial Prompt */}
      <View className="max-w-md w-full self-center">
        {step === 'drive_select' ? (
          <>
            <View className="w-12 h-12 rounded-2xl bg-cyan-500/15 items-center justify-center mb-4">
              <HardDrive size={24} color="#06B6D4" strokeWidth={2.2} />
            </View>
            <Text className="text-4xl font-extrabold text-light-textPrimary dark:text-dark-textPrimary tracking-tight mb-3">
              Connect Google Drive Vault.
            </Text>
            <Text className="text-base text-light-textSecondary dark:text-dark-textSecondary leading-relaxed mb-6">
              Signed in as {user?.email || 'Google User'}. Select which Google Drive account stores your photos, audio memos, videos & exports in ScribeX_Vault/ so device storage stays ultra-lean.
            </Text>
          </>
        ) : (
          <>
            <Text className="text-5xl font-extrabold text-light-textPrimary dark:text-dark-textPrimary tracking-tight mb-4">
              Welcome to ScribeX.
            </Text>
            <Text className="text-base text-light-textSecondary dark:text-dark-textSecondary leading-relaxed mb-6">
              Sign in with Google to unlock real-time Cloud Sync across devices, Google Drive media backups, and Friday AI.
            </Text>
          </>
        )}

        {activeError ? (
          <View
            accessibilityRole="alert"
            className="flex-row items-start gap-2.5 p-3.5 rounded-2xl border border-red-400/40 bg-red-500/10"
          >
            <AlertCircle size={18} color="#EF4444" strokeWidth={2} style={{ marginTop: 2 }} />
            <Text className="flex-1 text-xs leading-relaxed text-red-600 dark:text-red-400 font-medium">
              {activeError}
            </Text>
            <Pressable
              onPress={() => (step === 'drive_select' ? setDriveError(null) : clearAuthError())}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Dismiss sign-in error"
              className="p-1 active:opacity-70"
            >
              <X size={16} color="#EF4444" strokeWidth={2} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Action Buttons */}
      {step === 'drive_select' ? (
        <View className="max-w-md w-full self-center gap-3">
          <Pressable
            onPress={handleConnectDriveAccount}
            disabled={isConnectingDrive}
            accessibilityRole="button"
            accessibilityLabel="Choose Google Drive Account"
            className="w-full py-4 rounded-2xl bg-light-iconBg dark:bg-dark-iconBg flex-row items-center justify-center gap-3 active:scale-98 shadow-sm"
            style={{ opacity: isConnectingDrive ? 0.75 : 1, minHeight: 54 }}
          >
            {isConnectingDrive ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <GoogleMark size={19} />
            )}
            <Text className="text-base font-semibold text-white">
              {isConnectingDrive ? 'Connecting Google Drive...' : 'Choose Google Drive Account'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSkipDriveSetup}
            disabled={isConnectingDrive}
            accessibilityRole="button"
            accessibilityLabel="Skip Google Drive setup for now"
            className="w-full py-3.5 rounded-2xl border border-light-border dark:border-dark-border flex-row items-center justify-center gap-2 active:scale-98"
            style={{ minHeight: 50 }}
          >
            <Text className="text-sm font-medium text-light-textSecondary dark:text-dark-textSecondary">
              Skip Drive Setup for Now
            </Text>
            <ArrowRight size={16} color={isDark ? '#9CA3AF' : '#6B7280'} strokeWidth={2} />
          </Pressable>

          <View className="flex-row items-center justify-center gap-1.5 pt-2">
            <ShieldCheck size={14} color={isDark ? '#6B7280' : '#9CA3AF'} strokeWidth={2} />
            <Text className="text-xs text-light-textMuted dark:text-dark-textMuted text-center">
              You can connect or switch your Google Drive account anytime in Settings.
            </Text>
          </View>
        </View>
      ) : (
        <View className="max-w-md w-full self-center gap-3">
          <Pressable
            onPress={handleGoogleSignIn}
            disabled={isSigningIn}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            className="w-full py-4 rounded-2xl bg-light-iconBg dark:bg-dark-iconBg flex-row items-center justify-center gap-3 active:scale-98 shadow-sm"
            style={{ opacity: isSigningIn ? 0.75 : 1, minHeight: 54 }}
          >
            {isSigningIn ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <GoogleMark size={19} />
            )}
            <Text className="text-base font-semibold text-white">
              {isSigningIn ? 'Connecting to Google...' : 'Continue with Google'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSkip}
            disabled={isSigningIn}
            accessibilityRole="button"
            accessibilityLabel="Skip and use offline mode"
            className="w-full py-3.5 rounded-2xl border border-light-border dark:border-dark-border flex-row items-center justify-center gap-2 active:scale-98"
            style={{ minHeight: 50 }}
          >
            <Text className="text-sm font-medium text-light-textSecondary dark:text-dark-textSecondary">
              Skip & Use Offline Mode
            </Text>
            <ArrowRight size={16} color={isDark ? '#9CA3AF' : '#6B7280'} strokeWidth={2} />
          </Pressable>

          <View className="flex-row items-center justify-center gap-1.5 pt-2">
            <ShieldCheck size={14} color={isDark ? '#6B7280' : '#9CA3AF'} strokeWidth={2} />
            <Text className="text-xs text-light-textMuted dark:text-dark-textMuted text-center">
              Cloud Sync and Friday AI require Google Sign-In. Skipping keeps your vault 100% local on this device.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
