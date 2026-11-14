import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/context';
import { Sun, Moon, LogIn, ArrowRight } from 'lucide-react-native';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const { signIn, continueAsGuest } = useAuth();

  const handleSkip = async () => {
    await continueAsGuest();
    router.replace('/home');
  };

  const handleSignIn = async () => {
    await signIn();
    router.replace('/home');
  };

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
          Authentication
        </Text>
        
        <Pressable
          onPress={toggleTheme}
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
        <Text className="text-5xl font-extrabold text-light-textPrimary dark:text-dark-textPrimary tracking-tight mb-4">
          Welcome back.
        </Text>
        <Text className="text-base text-light-textSecondary dark:text-dark-textSecondary leading-relaxed">
          Open your local vault and resume your stream of thoughts offline with sub-2ms speed.
        </Text>
      </View>

      {/* Action Buttons: Primary Skip as Guest & Secondary Sign In */}
      <View className="max-w-md w-full self-center gap-3">
        <Pressable
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip and continue as guest"
          className="w-full py-4 rounded-2xl bg-light-iconBg dark:bg-dark-iconBg flex-row items-center justify-center gap-2 active:scale-98 shadow-sm"
        >
          <Text className="text-base font-semibold text-white">
            Skip & Open Vault
          </Text>
          <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.2} />
        </Pressable>

        <Pressable
          onPress={handleSignIn}
          accessibilityRole="button"
          accessibilityLabel="Sign in with account"
          className="w-full py-3.5 rounded-2xl border border-light-border dark:border-dark-border flex-row items-center justify-center gap-2 active:scale-98"
        >
          <LogIn size={16} color={isDark ? '#9CA3AF' : '#6B7280'} strokeWidth={2} />
          <Text className="text-sm font-medium text-light-textSecondary dark:text-dark-textSecondary">
            Sign In with Account
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
