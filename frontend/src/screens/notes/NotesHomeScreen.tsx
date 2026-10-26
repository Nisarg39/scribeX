/**
 * ScribeX Minimalist Workspace Canvas & Pastel Tile Notes Stream.
 *
 * Adheres strictly to the ScribeX Pastel Tile UI Design System:
 * - Soft Minimalism: restrained controls, generous whitespace, neutral frame.
 * - Prominent "Notes" editorial heading with dynamic metadata.
 * - Non-generic pastel tiles with dark typography (#191919) preserved across both themes.
 * - Universal Intake Bar with optimistic local SQLite persistence.
 * - Top-right individual dark/light mode toggle and logout actions.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Platform,
  RefreshControl,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Sun,
  Moon,
  LogOut,
  CloudOff,
  Star,
  Trash2,
  Filter,
  CheckCircle2,
  RefreshCw,
  Folder,
  Calendar,
  User as UserIcon,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useAuth } from '../../auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pastelColors, PastelColorKey, noteTileTokens } from '../../theme/tokens';
import {
  getLocalNotes,
  deleteLocalNote,
  saveLocalNote,
  clearAllLocalNotes,
} from '../../db/notesRepo';
import { ClientNote } from '../../db/types';
import { useSync } from '../../sync/useSync';
import { IntakeBar } from '../../components/intake';
import { BlockEditor } from '../../components/editor';
import { apiClient } from '../../services/apiClient';
import { ProfileScreen } from '../profile';

export const NotesHomeScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { signOut, isGuest, user } = useAuth();
  const { width } = useWindowDimensions();

  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedNote, setSelectedNote] = useState<ClientNote | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Subscribe to real-time Delta Sync Engine
  const { status: syncStatus, pendingCount, syncNow } = useSync({
    onDeltasApplied: () => {
      loadNotes();
    },
  });

  const loadNotes = useCallback(async () => {
    try {
      const allNotes = await getLocalNotes(
        selectedGroup === 'All' ? undefined : selectedGroup
      );
      setNotes(allNotes);
    } catch (err) {
      console.warn('Failed to load local notes:', err);
    }
  }, [selectedGroup]);

  useEffect(() => {
    let isMounted = true;
    const checkPurgeAndLoad = async () => {
      try {
        const hasPurged = await AsyncStorage.getItem('scribex_purged_all_notes_v2');
        if (!hasPurged) {
          await clearAllLocalNotes();
          await AsyncStorage.setItem('scribex_purged_all_notes_v2', 'true');
        }
      } catch (e) {
        console.warn('Purge check error:', e);
      }
      if (isMounted) {
        await loadNotes();
      }
    };
    checkPurgeAndLoad();
    return () => {
      isMounted = false;
    };
  }, [loadNotes]);

  const handleClearAllNotes = async () => {
    try {
      await clearAllLocalNotes();
      setNotes([]);
      setSelectedNote(null);
      // Also reset on backend
      try {
        await apiClient.post('/api/v1/sync/reset', {});
      } catch (e) {
        console.warn('Backend reset call warning:', e);
      }
    } catch (err) {
      console.error('Failed to clear notes:', err);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await syncNow();
    await loadNotes();
    setIsRefreshing(false);
  };

  const handleToggleFavorite = async (note: ClientNote) => {
    try {
      const updated = await saveLocalNote({
        id: note.id,
        title: note.title,
        content_markdown: note.content_markdown,
        group_name: note.group_name,
        color_token: note.color_token,
        is_favorite: !note.is_favorite,
      });
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await deleteLocalNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNote?.id === id) {
        setSelectedNote(null);
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const availableGroups = useMemo(() => {
    const groups = new Set<string>();
    groups.add('All');
    notes.forEach((n) => {
      if (n.group_name) groups.add(n.group_name);
    });
    return Array.from(groups);
  }, [notes]);

  // Asymmetric multi-column masonry distribution for desktop/tablet
  const isWide = width >= 768;
  const isLarge = width >= 1100;
  const columnCount = isLarge ? 3 : isWide ? 2 : 1;

  const noteColumns = useMemo(() => {
    const cols: ClientNote[][] = Array.from({ length: columnCount }, () => []);
    notes.forEach((note, index) => {
      cols[index % columnCount].push(note);
    });
    return cols;
  }, [notes, columnCount]);

  const formattedDate = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  if (isProfileOpen) {
    return <ProfileScreen onBack={() => { setIsProfileOpen(false); loadNotes(); }} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.appBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Top Bar with Status and Top-Right Actions */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          {isGuest ? (
            <View
              style={[
                styles.guestBadge,
                {
                  backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <CloudOff size={13} color={colors.textMuted} />
              <Text style={[styles.guestText, { color: colors.textSecondary }]}>
                Guest Mode (Local Only)
              </Text>
              <Pressable onPress={signOut} hitSlop={6} style={styles.upgradeLink}>
                <Text
                  style={[
                    styles.upgradeText,
                    { color: isDark ? '#FFC96F' : '#111111' },
                  ]}
                >
                  Sign in
                </Text>
              </Pressable>
            </View>
          ) : (
            <View
              style={[
                styles.syncBadge,
                {
                  backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
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
              <Text style={[styles.syncText, { color: colors.textSecondary }]}>
                {syncStatus === 'synced'
                  ? 'All Synced'
                  : syncStatus === 'syncing'
                  ? 'Syncing...'
                  : 'Offline'}
              </Text>
              {pendingCount > 0 && (
                <Text style={[styles.pendingPill, { color: colors.textMuted }]}>
                  • {pendingCount} pending
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Top-Right Controls: Profile, Theme Toggle & Logout */}
        <View style={styles.topRightControls}>
          <Pressable
            onPress={() => setIsProfileOpen(true)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                borderColor: colors.borderSubtle,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            accessibilityLabel="Layer 1 Profile"
          >
            <UserIcon size={17} color={colors.textPrimary} />
          </Pressable>

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
              <Sun size={17} color={colors.textPrimary} />
            ) : (
              <Moon size={17} color={colors.textPrimary} />
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
            <LogOut size={17} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Main Editorial Canvas Scrollview */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { maxWidth: 1160, alignSelf: 'center', width: '100%' },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.textMuted}
          />
        }
      >
        {/* Editorial Heading Section */}
        <View style={styles.headerSection}>
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>
            Notes
          </Text>
          <View style={styles.subtitleRow}>
            <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
              {formattedDate} • {notes.length} {notes.length === 1 ? 'thought' : 'thoughts'}
              {user?.name ? ` • ${user.name}` : ''}
            </Text>
            {notes.length > 0 && (
              <Pressable
                onPress={handleClearAllNotes}
                hitSlop={8}
                style={styles.clearAllButton}
                accessibilityLabel="Clear all notes"
              >
                <Trash2 size={13} color={isDark ? '#FF9277' : '#EF4444'} />
                <Text
                  style={[
                    styles.clearAllText,
                    { color: isDark ? '#FF9277' : '#EF4444' },
                  ]}
                >
                  Clear all
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Universal Intake Bar */}
        <IntakeBar
          onNoteCreated={(newNote) => {
            setNotes((prev) => [newNote, ...prev.filter((n) => n.id !== newNote.id)]);
          }}
          selectedGroup={selectedGroup}
        />

        {/* Group Filter Pills */}
        {availableGroups.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {availableGroups.map((group) => {
              const isSelected = selectedGroup === group;
              return (
                <Pressable
                  key={group}
                  onPress={() => setSelectedGroup(group)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: isSelected
                        ? colors.iconBg
                        : isDark
                        ? colors.surfaceRaised
                        : colors.surface,
                      borderColor: isSelected ? colors.iconBg : colors.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      {
                        color: isSelected ? colors.iconFg : colors.textSecondary,
                        fontWeight: isSelected ? '600' : '400',
                      },
                    ]}
                  >
                    {group}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Notes Fluid Asymmetric Rhythm (Non-Card Pastel Tiles) */}
        {notes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyPrompt, { color: colors.textMuted }]}>
              Your mind is for having ideas, not holding them.
            </Text>
            <Text style={[styles.emptySubprompt, { color: colors.textSecondary }]}>
              Type any thought, task, or paste markdown in the intake bar above.
            </Text>
          </View>
        ) : (
          <View style={styles.masonryContainer}>
            {noteColumns.map((column, colIdx) => (
              <View key={colIdx} style={styles.masonryColumn}>
                {column.map((note) => {
                  const tileBg =
                    pastelColors[note.color_token as PastelColorKey] || pastelColors.apricot;

                  return (
                    <Pressable
                      key={note.id}
                      onPress={() => setSelectedNote(note)}
                      style={({ pressed }) => [
                        styles.pastelTile,
                        {
                          backgroundColor: tileBg,
                          transform: [{ scale: pressed ? 0.985 : 1 }],
                        },
                      ]}
                    >
                      {/* Note Header: Group Pill & Favorite Star */}
                      <View style={styles.tileHeader}>
                        <View style={styles.groupCapsule}>
                          <Text style={styles.groupCapsuleText}>
                            {note.group_name || 'General'}
                          </Text>
                        </View>

                        <View style={styles.tileHeaderActions}>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(note);
                            }}
                            hitSlop={8}
                            style={[
                              styles.miniCircularButton,
                              note.is_favorite && styles.favoriteActiveButton,
                            ]}
                            accessibilityLabel="Favorite"
                          >
                            <Star
                              size={14}
                              color={
                                note.is_favorite
                                  ? noteTileTokens.favoriteIconActive
                                  : noteTileTokens.favoriteIconInactive
                              }
                              fill={
                                note.is_favorite
                                  ? noteTileTokens.favoriteIconActive
                                  : 'none'
                              }
                            />
                          </Pressable>

                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeleteNote(note.id);
                            }}
                            hitSlop={8}
                            style={styles.miniCircularButton}
                            accessibilityLabel="Delete"
                          >
                            <Trash2 size={13} color="rgba(25, 25, 25, 0.45)" />
                          </Pressable>
                        </View>
                      </View>

                      {/* Note Title & Content Body */}
                      <Text style={styles.tileTitle} numberOfLines={2}>
                        {note.title}
                      </Text>

                      {note.content_markdown ? (
                        <Text style={styles.tileSnippet} numberOfLines={6}>
                          {note.content_markdown}
                        </Text>
                      ) : null}

                      {/* Tile Footer */}
                      <View style={styles.tileFooter}>
                        <Text style={styles.tileTime}>
                          {new Date(note.updated_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                        {note.pending_sync && (
                          <Text style={styles.tileSyncHint}>• pending</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Composable Block-Based Note Editor Surface */}
      {selectedNote && (
        <Modal
          visible={Boolean(selectedNote)}
          animationType="slide"
          onRequestClose={() => setSelectedNote(null)}
        >
          <BlockEditor
            initialTitle={selectedNote.title}
            initialMarkdown={selectedNote.content_markdown}
            colorToken={selectedNote.color_token}
            groupName={selectedNote.group_name}
            onSave={async (payload) => {
              const updated = await saveLocalNote({
                id: selectedNote.id,
                title: payload.title,
                content_markdown: payload.content_markdown,
                group_name: selectedNote.group_name,
                color_token: selectedNote.color_token,
                is_favorite: selectedNote.is_favorite,
              });
              setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
              setSelectedNote(updated);
            }}
            onClose={() => setSelectedNote(null)}
          />
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 48,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  guestText: {
    fontSize: 12,
    fontWeight: '500',
  },
  upgradeLink: {
    marginLeft: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  upgradeText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '500',
  },
  pendingPill: {
    fontSize: 11,
  },
  topRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'web' ? 84 : 100,
    paddingHorizontal: 24,
    paddingBottom: 64,
  },
  headerSection: {
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: Platform.OS === 'web' ? 44 : 36,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: Platform.OS === 'web' ? 48 : 40,
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    paddingVertical: 4,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
  },
  masonryContainer: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  masonryColumn: {
    flex: 1,
    gap: 16,
  },
  pastelTile: {
    borderRadius: 22,
    padding: 20,
    width: '100%',
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupCapsule: {
    backgroundColor: 'rgba(25, 25, 25, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  groupCapsuleText: {
    fontSize: 11,
    fontWeight: '600',
    color: noteTileTokens.textPrimary,
    letterSpacing: 0.2,
  },
  tileHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniCircularButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(25, 25, 25, 0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteActiveButton: {
    backgroundColor: noteTileTokens.favoriteSurfaceActive,
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: noteTileTokens.textPrimary,
    lineHeight: 23,
    marginBottom: 8,
  },
  tileSnippet: {
    fontSize: 14,
    color: noteTileTokens.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  tileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tileTime: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(25, 25, 25, 0.55)',
  },
  tileSyncHint: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(25, 25, 25, 0.45)',
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPrompt: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubprompt: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 420,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '80%',
    borderRadius: 24,
    padding: 28,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: noteTileTokens.textPrimary,
    lineHeight: 30,
    marginBottom: 14,
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalBody: {
    fontSize: 15,
    lineHeight: 24,
    color: noteTileTokens.textPrimary,
  },
});
