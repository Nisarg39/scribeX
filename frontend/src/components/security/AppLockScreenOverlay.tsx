import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  ShieldCheck,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { NoteColors } from '../../theme/tokens';
import { CredentialKind } from '../../db/types';
import { securityRateLimiter } from '../../core/security/pinCrypto';

interface AppLockScreenOverlayProps {
  credentialKind: CredentialKind | null;
  masterHint: string | null;
  onUnlockAttempt: (candidate: string) => {
    ok: boolean;
    error?: string;
    lockoutRemainingMs?: number;
  };
}

export const AppLockScreenOverlay: React.FC<AppLockScreenOverlayProps> = ({
  credentialKind,
  masterHint,
  onUnlockAttempt,
}) => {
  const { colors, isDark } = useTheme();
  const [candidate, setCandidate] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [lockoutRemainingMs, setLockoutRemainingMs] = useState(() =>
    securityRateLimiter.getLockoutRemainingMs('app_lock')
  );

  useEffect(() => {
    if (lockoutRemainingMs <= 0) return;

    const timer = setInterval(() => {
      const rem = securityRateLimiter.getLockoutRemainingMs('app_lock');
      setLockoutRemainingMs(rem);
      if (rem <= 0) {
        setErrorText(null);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [lockoutRemainingMs]);

  const handleSubmit = () => {
    if (lockoutRemainingMs > 0) return;
    if (!candidate.trim()) {
      setErrorText('Enter your Workspace Master PIN or Password.');
      return;
    }

    const res = onUnlockAttempt(candidate);
    if (!res.ok) {
      setCandidate('');
      if (res.lockoutRemainingMs && res.lockoutRemainingMs > 0) {
        setLockoutRemainingMs(res.lockoutRemainingMs);
      }
      setErrorText(res.error || 'Incorrect Master credential.');
    } else {
      setCandidate('');
      setErrorText(null);
    }
  };

  const isPin = credentialKind !== 'password';
  const cooldownSec = Math.ceil(lockoutRemainingMs / 1000);

  return (
    <SafeAreaView
      className="flex-1 bg-light-appBg dark:bg-dark-appBg"
      edges={['top', 'bottom', 'left', 'right']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center items-center px-7"
      >
        <View className="w-full max-w-[380px] items-center">
          {/* Brand Shield Emblem */}
          <View
            className="w-16 h-16 rounded-3xl items-center justify-center mb-5"
            style={{
              backgroundColor: isDark ? '#303030' : '#FFFFFF',
              borderWidth: 1,
              borderColor: colors.borderSubtle,
            }}
          >
            <Lock size={28} color={NoteColors.lavender} />
          </View>

          <Text
            className="text-[26px] font-black tracking-tight text-center"
            style={{ color: colors.textPrimary }}
          >
            ScribeX Vault Locked
          </Text>
          <Text
            className="text-[14px] text-center mt-1.5 mb-7"
            style={{ color: colors.textSecondary }}
          >
            Enter your Master {isPin ? 'PIN' : 'Password'} to access your workspace.
          </Text>

          {/* Input Bar */}
          <View
            className="w-full flex-row items-center rounded-2xl border px-4 h-13"
            style={{
              backgroundColor: colors.surface,
              borderColor: errorText ? NoteColors.coral : colors.borderSubtle,
              minHeight: 52,
            }}
          >
            <ShieldCheck size={18} color={NoteColors.cyan} />
            <TextInput
              value={candidate}
              onChangeText={(txt) => {
                setCandidate(txt);
                if (errorText && lockoutRemainingMs <= 0) setErrorText(null);
              }}
              placeholder={isPin ? 'Master 4–6 digit PIN' : 'Master Password'}
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showSecret}
              keyboardType={isPin ? 'number-pad' : 'default'}
              maxLength={isPin ? 6 : 64}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              editable={lockoutRemainingMs <= 0}
              onSubmitEditing={handleSubmit}
              className="flex-1 mx-3 text-[16px] font-bold tracking-wider outline-none"
              style={{ color: colors.textPrimary, outlineStyle: 'none' } as any}
            />
            <Pressable
              onPress={() => setShowSecret((p) => !p)}
              hitSlop={8}
              accessibilityLabel={showSecret ? 'Hide Master PIN/Password' : 'Show Master PIN/Password'}
              className="w-8 h-8 items-center justify-center active:opacity-70"
            >
              {showSecret ? (
                <EyeOff size={18} color={colors.textMuted} />
              ) : (
                <Eye size={18} color={colors.textMuted} />
              )}
            </Pressable>
          </View>

          {masterHint ? (
            <View className="w-full mt-3 items-center">
              <Pressable
                onPress={() => setShowHint((p) => !p)}
                hitSlop={8}
                className="flex-row items-center gap-1.5 py-1 active:opacity-70"
              >
                <HelpCircle size={14} color={NoteColors.cyan} />
                <Text className="text-[12.5px] font-semibold" style={{ color: NoteColors.cyan }}>
                  {showHint ? 'Hide Master Hint' : 'Show Master Hint'}
                </Text>
              </Pressable>
              {showHint ? (
                <Text className="text-[12.5px] mt-1 text-center" style={{ color: colors.textSecondary }}>
                  Hint: {masterHint}
                </Text>
              ) : null}
            </View>
          ) : null}

          {errorText || lockoutRemainingMs > 0 ? (
            <View className="w-full flex-row items-center justify-center gap-2 mt-3.5 px-3.5 py-2.5 rounded-xl bg-red-500/10">
              <AlertTriangle size={15} color={NoteColors.coral} />
              <Text className="text-[12.5px] font-semibold" style={{ color: NoteColors.coral }}>
                {lockoutRemainingMs > 0
                  ? `Locked out for ${cooldownSec}s after 5 failed attempts.`
                  : errorText}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={lockoutRemainingMs > 0}
            className="w-full h-12 rounded-full items-center justify-center mt-6 active:opacity-85"
            style={{
              backgroundColor:
                lockoutRemainingMs > 0 ? colors.borderSubtle : NoteColors.apricot,
              opacity: lockoutRemainingMs > 0 ? 0.6 : 1,
            }}
          >
            <Text className="text-[15px] font-extrabold text-[#171717]">
              Unlock Workspace
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
