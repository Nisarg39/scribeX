import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/context';
import { Sun, Moon, LogOut, RotateCcw } from 'lucide-react-native';

export default function HomeContainerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const { signOut, resetAllState } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/signin');
  };

  const handleResetFlow = async () => {
    await resetAllState();
    router.replace('/onboarding');
  };

  return (
    <View 
      className="flex-1 bg-light-appBg dark:bg-dark-appBg"
      style={{
        paddingTop: Math.max(insets.top, 24),
        paddingBottom: Math.max(insets.bottom, 24),
      }}
    >
      {/* Outer Padding Container */}
      <View className="flex-1 px-6 md:px-14">
        {/* Main Workspace Canvas (adheres to Soft Minimalism & 24px radius shell) */}
        <View className="flex-1 rounded-3xl bg-light-surface dark:bg-dark-surface p-8 justify-between border border-light-border dark:border-dark-border">
          
          {/* Header Bar */}
          <View className="flex-row items-center justify-between">
            <Text className="text-4xl md:text-5xl font-extrabold text-light-textPrimary dark:text-dark-textPrimary tracking-tight">
              Notes
            </Text>

            {/* Top Controls: Dark/Light Mode Switch + Sign Out */}
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={toggleTheme}
                accessibilityRole="button"
                accessibilityLabel="Toggle theme"
                className="w-11 h-11 rounded-full bg-light-iconBg dark:bg-dark-iconBg items-center justify-center active:scale-95 transition-transform"
              >
                {isDark ? (
                  <Sun size={20} color="#FFFFFF" strokeWidth={2} />
                ) : (
                  <Moon size={20} color="#FFFFFF" strokeWidth={2} />
                )}
              </Pressable>

              <Pressable
                onPress={handleSignOut}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                className="w-11 h-11 rounded-full bg-light-border dark:bg-dark-raised items-center justify-center active:scale-95 transition-transform"
              >
                <LogOut size={18} color={isDark ? '#B5B5B5' : '#626262'} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          {/* Empty Canvas Workspace - Ready for Step 2+ UI Design Planning */}
          <View className="flex-1 items-center justify-center">
            {/* Kept intentionally empty for UI planning */}
          </View>

          {/* Minimal Dev Helper Footer for testing onboarding reset */}
          <View className="flex-row items-center justify-end">
            <Pressable
              onPress={handleResetFlow}
              className="flex-row items-center gap-1.5 py-1.5 px-3 rounded-full opacity-60 hover:opacity-100 active:opacity-100 transition-opacity"
            >
              <RotateCcw size={12} color={isDark ? '#858585' : '#929292'} />
              <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                Reset Onboarding Flow
              </Text>
            </Pressable>
          </View>

        </View>
      </View>
    </View>
  );
}
