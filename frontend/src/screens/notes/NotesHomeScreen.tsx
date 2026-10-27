/**
 * ScribeX Main Notes Canvas (Clean Slate for UI/UX Redesign).
 *
 * Stripped of all legacy pastel card tiles, box capsules, and masonry borders.
 * Serves as a clean, functional substrate ready for the new UI/UX design architecture.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
  RefreshControl,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Sun,
  Moon,
  LogOut,
  Trash2,
  User as UserIcon,
  RefreshCw,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useAuth } from '../../auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

function getCleanSnippet(markdown: string): string {
  if (!markdown) return '';
  return markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[(?:Asset:\s*)?[^\]]+\]\([^)]+\)/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s*\[![a-zA-Z]+\]\s*/g, '')
    .replace(/^>\s*$/gm, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/PNG[\s\S]*?IHDR[\s\S]*/gi, '')
    .replace(/IHDR[\s\S]*?PLTE[\s\S]*/gi, '')
    .replace(/PLTE[\s\S]*/gi, '')
    .replace(/^\s*[\r\n]/gm, '')
    .trim();
}

export const NotesHomeScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { signOut, isGuest, user } = useAuth();

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

  if (isProfileOpen) {
    return <ProfileScreen onBack={() => { setIsProfileOpen(false); loadNotes(); }} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.appBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Minimal Header Utility Bar */}
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

      {/* Main Editorial Canvas Scrollview */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.textMuted}
          />
        }
      >
        {/* Workspace Title & Stats */}
        <View style={styles.headerSection}>
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Notes</Text>
          <View style={styles.headerMetaRow}>
            <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
              {notes.length} {notes.length === 1 ? 'thought' : 'thoughts'}
              {user?.name ? ` • ${user.name}` : ''}
            </Text>

            {notes.length > 0 && (
              <Pressable
                onPress={handleClearAllNotes}
                hitSlop={8}
                style={styles.clearAllBtn}
                accessibilityLabel="Clear all notes"
              >
                <Trash2 size={13} color={colors.textMuted} />
                <Text style={[styles.clearAllText, { color: colors.textMuted }]}>Clear all</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Quick Intake Bar */}
        <View style={styles.intakeContainer}>
          <IntakeBar
            onNoteCreated={(newNote) => {
              setNotes((prev) => [newNote, ...prev.filter((n) => n.id !== newNote.id)]);
            }}
            selectedGroup={selectedGroup}
          />
        </View>

        {/* Clean Non-Card Notes List */}
        {notes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyPrompt, { color: colors.textMuted }]}>
              Clean slate. Capture a thought above to begin.
            </Text>
          </View>
        ) : (
          <View style={styles.notesList}>
            {notes.map((note) => {
              let cleanTitle = getCleanSnippet(note.title) || 'Untitled Note';
              if (cleanTitle.includes('PNG') || /[\x00-\x1F\x7F-\x9F]/.test(cleanTitle)) {
                cleanTitle = cleanTitle.replace(/[\x00-\x1F\x7F-\x9F]/g, '').replace(/PNG/gi, '').trim() || 'Untitled Note';
              }
              const cleanSnippet = getCleanSnippet(note.content_markdown);

              return (
                <Pressable
                  key={note.id}
                  onPress={() => setSelectedNote(note)}
                  style={({ pressed }) => [
                    styles.noteRow,
                    {
                      borderBottomColor: colors.borderSubtle,
                      opacity: pressed ? 0.65 : 1,
                    },
                  ]}
                >
                  <View style={styles.noteContent}>
                    <Text style={[styles.noteTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {cleanTitle}
                    </Text>

                    {cleanSnippet ? (
                      <Text style={[styles.noteSnippet, { color: colors.textSecondary }]} numberOfLines={2}>
                        {cleanSnippet}
                      </Text>
                    ) : null}

                    <View style={styles.noteMetaRow}>
                      <Text style={[styles.noteMetaText, { color: colors.textMuted }]}>
                        {note.group_name || 'General'} •{' '}
                        {new Date(note.updated_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                      {note.pending_sync ? (
                        <Text style={[styles.pendingHint, { color: colors.textMuted }]}>• pending</Text>
                      ) : null}
                    </View>
                  </View>

                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteNote(note.id);
                    }}
                    hitSlop={10}
                    style={styles.deleteRowBtn}
                    accessibilityLabel="Delete note"
                  >
                    <Trash2 size={15} color={colors.textMuted} />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Distraction-Free Detailed Note View Modal */}
      {selectedNote && (
        <Modal
          visible={Boolean(selectedNote)}
          animationType="fade"
          onRequestClose={() => setSelectedNote(null)}
        >
          <BlockEditor
            initialTitle={selectedNote.title}
            initialMarkdown={selectedNote.content_markdown}
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
  scrollContent: {
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 80,
  },
  headerSection: {
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginBottom: 4,
  },
  headerMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageSubtitle: {
    fontSize: 14,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  clearAllText: {
    fontSize: 12,
  },
  intakeContainer: {
    marginBottom: 28,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyPrompt: {
    fontSize: 14,
  },
  notesList: {
    width: '100%',
  },
  noteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  noteContent: {
    flex: 1,
    paddingRight: 16,
  },
  noteTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  noteSnippet: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  noteMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteMetaText: {
    fontSize: 12,
  },
  pendingHint: {
    fontSize: 12,
  },
  deleteRowBtn: {
    padding: 8,
  },
});
