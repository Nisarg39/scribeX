/**
 * Desktop Navigation Rail / Sidebar Component.
 * Source of Truth: docs/ScribeX-Pastel-Tile-UI-Design-System.md (Section 4 & 6.1)
 *
 * Specifications:
 * - Width: 96-112px (configured at 104px)
 * - Single 1px subtle divider
 * - ScribeX brand at top
 * - Circular dark Add Note action (44px)
 * - Bottom utilities: quiet sync indicator, theme toggle, user sign-out
 */

import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import {
  Sparkles,
  Plus,
  Sun,
  Moon,
  LogOut,
  Cloud,
  CloudOff,
  RefreshCw,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useAuth } from '../../auth';
import { useSync } from '../../sync';

interface SidebarProps {
  onAddNote: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onAddNote }) => {
  const { colors, isDark, toggleTheme, pastelColors } = useTheme();
  const { user, isGuest, signOut } = useAuth();
  const { status: syncStatus, isSyncing, syncNow } = useSync();

  return (
    <View
      style={[
        styles.railContainer,
        {
          backgroundColor: colors.surface,
          borderRightColor: colors.borderSubtle,
        },
      ]}
    >
      {/* Top Brand & Actions */}
      <View style={styles.topSection}>
        {/* Brand Icon & Name */}
        <View style={styles.brandContainer}>
          <View
            style={[
              styles.brandBadge,
              { backgroundColor: pastelColors.apricot },
            ]}
          >
            <Sparkles size={18} color="#111111" />
          </View>
          <Text style={[styles.brandText, { color: colors.textPrimary }]}>
            ScribeX
          </Text>
        </View>

        {/* Circular Dark Add-Note Action Button */}
        <Pressable
          onPress={onAddNote}
          style={({ pressed }) => [
            styles.addNoteButton,
            {
              backgroundColor: colors.iconBg,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          accessibilityLabel="Add new note"
        >
          <Plus size={22} color={colors.iconFg} strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* Bottom Quiet Utilities */}
      <View style={styles.bottomSection}>
        {/* Sync Doorbell Indicator */}
        <Pressable
          onPress={syncNow}
          hitSlop={8}
          style={({ pressed }) => [
            styles.utilityCircle,
            {
              backgroundColor: isDark ? colors.surfaceRaised : '#F0F2F5',
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityLabel={`Sync status: ${syncStatus}`}
        >
          {isSyncing ? (
            <RefreshCw size={16} color="#FF9500" style={styles.spinning} />
          ) : syncStatus === 'synced' ? (
            <Cloud size={16} color="#34C759" />
          ) : (
            <CloudOff size={16} color="#FF9500" />
          )}
        </Pressable>

        {/* Theme Toggle Button */}
        <Pressable
          onPress={toggleTheme}
          hitSlop={8}
          style={({ pressed }) => [
            styles.utilityCircle,
            {
              backgroundColor: isDark ? colors.surfaceRaised : '#F0F2F5',
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityLabel="Toggle color theme"
        >
          {isDark ? (
            <Sun size={17} color={colors.textPrimary} />
          ) : (
            <Moon size={17} color={colors.textPrimary} />
          )}
        </Pressable>

        {/* User Sign-Out Action */}
        <Pressable
          onPress={signOut}
          hitSlop={8}
          style={({ pressed }) => [
            styles.utilityCircle,
            {
              backgroundColor: isDark ? colors.surfaceRaised : '#F0F2F5',
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityLabel="Sign out of ScribeX"
        >
          <LogOut size={16} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  railContainer: {
    width: 104,
    height: '100%',
    borderRightWidth: 1,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topSection: {
    alignItems: 'center',
    gap: 36,
  },
  brandContainer: {
    alignItems: 'center',
    gap: 8,
  },
  brandBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  addNoteButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bottomSection: {
    alignItems: 'center',
    gap: 16,
  },
  utilityCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinning: {
    transform: [{ rotate: '45deg' }],
  },
});
