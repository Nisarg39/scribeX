import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme';
import { Sun, Moon } from 'lucide-react-native';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isDark, toggleTheme, mode, colors } = useTheme();

  return (
    <View 
      className="flex-1 bg-light-appBg dark:bg-dark-appBg items-center justify-center p-6"
      style={{
        paddingTop: Math.max(insets.top, 24),
        paddingBottom: Math.max(insets.bottom, 24),
      }}
    >
      {/* Centered Minimalist Theme Control Card */}
      <View 
        className="w-full max-w-md p-8 rounded-3xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border items-center"
      >
        <Text 
          className="text-4xl font-extrabold text-light-textPrimary dark:text-dark-textPrimary tracking-tight mb-2"
        >
          Notes
        </Text>
        
        <Text 
          className="text-sm text-light-textSecondary dark:text-dark-textSecondary mb-8 text-center"
        >
          Theme: <Text className="font-semibold capitalize text-light-textPrimary dark:text-dark-textPrimary">{mode} Mode</Text>
        </Text>

        {/* Circular Theme Toggle Button adhering to Design System Specs */}
        <Pressable
          onPress={toggleTheme}
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          className="w-14 h-14 rounded-full bg-light-iconBg dark:bg-dark-iconBg items-center justify-center active:scale-95 transition-transform"
        >
          {isDark ? (
            <Sun size={22} color="#FFFFFF" strokeWidth={2} />
          ) : (
            <Moon size={22} color="#FFFFFF" strokeWidth={2} />
          )}
        </Pressable>

        <Text 
          className="text-xs text-light-textMuted dark:text-dark-textMuted mt-4"
        >
          Tap to toggle mode
        </Text>
      </View>
    </View>
  );
}
