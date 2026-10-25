/**
 * Blank Authenticated Workspace Screen.
 *
 * Displays a clean blank canvas after logging in, with only:
 * - Individual Dark / Light mode switch in the top right corner
 * - Logout button in the top right corner
 */

import React from 'react';
import { StyleSheet, View, Pressable, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Sun, Moon, LogOut } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useAuth } from '../../auth';

export const NotesHomeScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { signOut } = useAuth();

  return (
    <View style={[styles.container, { backgroundColor: colors.appBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Top Right Controls: Theme Toggle & Logout */}
      <View style={styles.topRightControls}>
        <Pressable
          onPress={toggleTheme}
          hitSlop={8}
          style={({ pressed }) => [
            styles.iconButton,
            {
              backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
              borderColor: colors.borderSubtle,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
          accessibilityLabel="Toggle Theme"
        >
          {isDark ? (
            <Sun size={18} color={colors.textPrimary} />
          ) : (
            <Moon size={18} color={colors.textPrimary} />
          )}
        </Pressable>

        <Pressable
          onPress={signOut}
          hitSlop={8}
          style={({ pressed }) => [
            styles.iconButton,
            {
              backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
              borderColor: colors.borderSubtle,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
          accessibilityLabel="Sign Out"
        >
          <LogOut size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  topRightControls: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 24 : 52,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 100,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
});
