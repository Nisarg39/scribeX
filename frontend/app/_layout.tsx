import '../global.css';
import React from 'react';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../src/theme';
import { AuthProvider } from '../src/context';
import { View } from 'react-native';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

// Disable Reanimated strict logger warning flood in DEV to protect JS bridge responsiveness
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

function RootContent() {
  const { isDark } = useTheme();

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
          <RootContent />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
