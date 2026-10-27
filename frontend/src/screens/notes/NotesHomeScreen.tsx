/**
 * ScribeX Main Workspace Shell.
 *
 * Keeps only the top header utility bar (brand, sync status, profile, theme toggle, and signout).
 * The main canvas is completely cleared, ready for the upcoming UI/UX design architecture.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useAuth } from '../../auth';
import { clearAllLocalNotes } from '../../db/notesRepo';
import { useSync } from '../../sync/useSync';
import { ProfileScreen } from '../profile';

export const NotesHomeScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Subscribe to real-time Delta Sync Engine
  const { status: syncStatus, pendingCount } = useSync({});

  // Ensure all local notes and pending queues are purged on mount
  useEffect(() => {
    clearAllLocalNotes().catch((e) => console.warn('Local purge warning:', e));
  }, []);

  if (isProfileOpen) {
    return <ProfileScreen onBack={() => setIsProfileOpen(false)} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.appBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header Section */}
      <View style={[styles.topBar, { borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.topLeft}>
          <Text style={[styles.appName, { color: colors.textPrimary }]}>ScribeX</Text>
          <View style={styles.syncIndicator}>
            <View
              style={[
                styles.syncDot,
                {
                  backgroundColor:
                    syncStatus === 'synced'
                      ? '#10B981'
                      : syncStatus === 'syncing'
                      ? '#F59E0B'
                      : '#6B7280',
                },
              ]}
            />
            <Text style={[styles.syncStatusText, { color: colors.textMuted }]}>
              {syncStatus === 'synced'
                ? 'Synced'
                : syncStatus === 'syncing'
                ? 'Syncing'
                : 'Offline'}
              {pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.topRight}>
          <Pressable
            onPress={() => setIsProfileOpen(true)}
            hitSlop={8}
            style={styles.headerBtn}
            accessibilityLabel="Profile"
          >
            <UserIcon size={16} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={toggleTheme}
            hitSlop={8}
            style={styles.headerBtn}
            accessibilityLabel="Toggle Theme"
          >
            {isDark ? (
              <Sun size={16} color={colors.textPrimary} />
            ) : (
              <Moon size={16} color={colors.textPrimary} />
            )}
          </Pressable>

          <Pressable
            onPress={signOut}
            hitSlop={8}
            style={styles.headerBtn}
            accessibilityLabel="Sign Out"
          >
            <LogOut size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Main Canvas Area (Clean Slate for New UI/UX Design) */}
      <View style={styles.canvasArea} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 16 : 50,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  syncStatusText: {
    fontSize: 12,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerBtn: {
    padding: 6,
  },
  canvasArea: {
    flex: 1,
    width: '100%',
  },
});
