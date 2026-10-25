/**
 * Notes Home Screen - Primary Workspace.
 *
 * Implements the Pastel Tile UI Design System:
 * - Clean top search row
 * - Prominent "Notes" heading with offline status indicators
 * - Multi-column responsive grid with signature pastel note tiles
 * - Integrated user account banner & sign-out trigger
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Sun,
  Moon,
  Search,
  Plus,
  Pencil,
  Star,
  Sparkles,
  Database,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  User as UserIcon,
} from 'lucide-react-native';
import {
  useTheme,
  PastelColorKey,
  pastelColors,
  noteTileTokens,
} from '../../theme';
import {
  ClientNote,
  getLocalNotes,
  saveLocalNote,
  toggleLocalFavorite,
  seedInitialNotesIfEmpty,
} from '../../db';
import { useSync } from '../../sync';
import { useAuth } from '../../auth';

const INITIAL_SAMPLES: Array<{
  title: string;
  content: string;
  group: string;
  color: PastelColorKey;
  isFavorite?: boolean;
}> = [
  {
    title: 'Cognitive Architecture',
    content: 'Layer 1 captures raw user intentions and mental models. Layer 2 maintains continuous timeline graph.',
    group: 'Architecture',
    color: 'apricot',
    isFavorite: true,
  },
  {
    title: 'Pastel Tile Design Rule',
    content: 'Keep note backgrounds colorful in both themes. Use dark text (#191919) across both light & dark modes.',
    group: 'Design',
    color: 'coral',
  },
  {
    title: 'Offline-First SQLite',
    content: 'Direct sub-5ms local reads with zero network spinners across iOS, Android, and Web.',
    group: 'Sync',
    color: 'lime',
    isFavorite: true,
  },
  {
    title: 'Git Markdown Projection',
    content: 'Atomic commits per entity to local Git vault. Full human-readable markdown with YAML frontmatter.',
    group: 'Vault',
    color: 'lavender',
  },
  {
    title: 'Ask-Before-Write Gate',
    content: 'Ambiguity classification pauses automatic writes and triggers conversational clarification.',
    group: 'Intake',
    color: 'cyan',
  },
  {
    title: 'Voice & Document Intake',
    content: 'Multi-modal entry point supporting audio dictation, PDFs, markdown notes, and quick thought captures.',
    group: 'Multi-Modal',
    color: 'pink',
    isFavorite: true,
  },
];

export const NotesHomeScreen: React.FC = () => {
  const { theme, isDark, colors, toggleTheme } = useTheme();
  const { user, isGuest, signOut } = useAuth();
  const { width } = useWindowDimensions();

  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isWide = width >= 1024;
  const isTablet = width >= 640 && width < 1024;
  const numColumns = isWide ? 3 : isTablet ? 2 : 1;

  // Load notes directly from local offline-first SQLite database
  const loadNotes = useCallback(async () => {
    try {
      await seedInitialNotesIfEmpty(INITIAL_SAMPLES);
      const loaded = await getLocalNotes();
      setNotes(loaded);
    } catch (err) {
      console.error('Failed to load notes from local SQLite:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Memoize sync callback to maintain stable function reference
  const handleDeltasApplied = useCallback(() => {
    loadNotes();
  }, [loadNotes]);

  // Connect Real-Time Delta Sync Engine
  const {
    status: syncStatus,
    isSyncing,
    pendingCount,
    currentRev,
    syncNow,
  } = useSync({
    onDeltasApplied: handleDeltasApplied,
  });

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleToggleFavorite = async (id: string) => {
    try {
      const nextFav = await toggleLocalFavorite(id);
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_favorite: nextFav } : n))
      );
      syncNow();
    } catch (err) {
      console.error('Failed to toggle favorite in SQLite:', err);
    }
  };

  const handleCreateNote = async () => {
    try {
      const colorKeys: PastelColorKey[] = [
        'apricot',
        'coral',
        'lime',
        'lavender',
        'cyan',
        'pink',
      ];
      const nextColor = colorKeys[notes.length % colorKeys.length];
      const newNote = await saveLocalNote({
        title: `Thought #${notes.length + 1}`,
        content_markdown: 'Instant local SQLite commit with real-time delta sync.',
        group_name: 'General Reference',
        color_token: nextColor,
        is_favorite: false,
      });

      setNotes((prev) => [newNote, ...prev]);
      syncNow();
    } catch (err) {
      console.error('Failed to save note to local SQLite:', err);
    }
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content_markdown.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.group_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.appBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.workspaceWrapper,
            {
              paddingHorizontal: isWide ? 64 : isTablet ? 32 : 20,
              paddingTop: Platform.OS === 'web' ? 36 : 56,
            },
          ]}
        >
          {/* Top Search & Actions Bar */}
          <View style={styles.topRow}>
            <View
              style={[
                styles.searchBox,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <Search
                size={18}
                color={colors.textMuted}
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder="Search notes in local SQLite..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <View style={styles.headerRightActions}>
              {/* User Identity / Guest Badge */}
              <View
                style={[
                  styles.userBadge,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                  },
                ]}
              >
                <UserIcon size={14} color={colors.textSecondary} />
                <Text
                  style={[styles.userNameText, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {user?.name || (isGuest ? 'Guest' : 'User')}
                </Text>
                {isGuest && (
                  <View
                    style={[
                      styles.guestTag,
                      { backgroundColor: pastelColors.lime },
                    ]}
                  >
                    <Text
                      style={[
                        styles.guestTagText,
                        { color: noteTileTokens.textPrimary },
                      ]}
                    >
                      OFFLINE
                    </Text>
                  </View>
                )}
              </View>

              {/* Theme Toggle Button */}
              <Pressable
                onPress={toggleTheme}
                style={({ pressed }) => [
                  styles.circularButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                accessibilityLabel="Toggle Theme"
              >
                {isDark ? (
                  <Sun size={19} color={colors.textPrimary} />
                ) : (
                  <Moon size={19} color={colors.textPrimary} />
                )}
              </Pressable>

              {/* Sign Out Button */}
              <Pressable
                onPress={signOut}
                style={({ pressed }) => [
                  styles.circularButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                accessibilityLabel="Sign Out"
              >
                <LogOut size={18} color={colors.textSecondary} />
              </Pressable>

              {/* Quick Add Note Button */}
              <Pressable
                onPress={handleCreateNote}
                style={({ pressed }) => [
                  styles.circularButtonPrimary,
                  {
                    backgroundColor: colors.iconBg,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                accessibilityLabel="Create Note"
              >
                <Plus size={20} color={colors.iconFg} />
              </Pressable>
            </View>
          </View>

          {/* Heading Section */}
          <View style={styles.headingSection}>
            <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>
              Notes
            </Text>

            {/* Offline-First SQLite & Sync Doorbell Indicator Badges */}
            <View style={styles.badgesRow}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isDark ? '#2D2D2D' : '#F0F2F5',
                    borderColor: colors.borderSubtle,
                  },
                ]}
              >
                <Database size={13} color={colors.textSecondary} />
                <Text
                  style={[styles.statusBadgeText, { color: colors.textSecondary }]}
                >
                  Offline SQLite Active · {notes.length} notes
                </Text>
              </View>

              <Pressable
                onPress={syncNow}
                style={({ pressed }) => [
                  styles.statusBadge,
                  {
                    backgroundColor:
                      syncStatus === 'synced'
                        ? isDark
                          ? '#1A3324'
                          : '#EAF7EE'
                        : isDark
                        ? '#332E1A'
                        : '#FCF7E6',
                    borderColor:
                      syncStatus === 'synced' ? '#34C759' : '#FF9500',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                {isSyncing ? (
                  <RefreshCw
                    size={13}
                    color={syncStatus === 'synced' ? '#34C759' : '#FF9500'}
                    style={styles.spinning}
                  />
                ) : syncStatus === 'synced' ? (
                  <Cloud size={13} color="#34C759" />
                ) : (
                  <CloudOff size={13} color="#FF9500" />
                )}
                <Text
                  style={[
                    styles.statusBadgeText,
                    {
                      color:
                        syncStatus === 'synced' ? '#34C759' : '#FF9500',
                      fontWeight: '600',
                    },
                  ]}
                >
                  {syncStatus === 'synced'
                    ? `Live Sync (rev: ${currentRev})`
                    : `Sync: ${syncStatus} ${pendingCount > 0 ? `(${pendingCount} pending)` : ''}`}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Loading Indicator */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.textPrimary} />
            </View>
          ) : (
            /* Multi-Column Pastel Note Tiles Grid */
            <View
              style={[
                styles.notesGrid,
                {
                  gap: isWide ? 24 : 16,
                },
              ]}
            >
              {filteredNotes.map((note) => {
                const colorHex =
                  pastelColors[note.color_token as PastelColorKey] ||
                  pastelColors.apricot;

                const columnFlex =
                  numColumns === 3 ? '31.3%' : numColumns === 2 ? '48%' : '100%';

                return (
                  <View
                    key={note.id}
                    style={[
                      styles.noteTile,
                      {
                        backgroundColor: colorHex,
                        width: columnFlex as any,
                      },
                    ]}
                  >
                    {/* Top Row: Title + Favorite Star */}
                    <View style={styles.noteTopRow}>
                      <Text
                        style={[styles.noteTitle, { color: noteTileTokens.textPrimary }]}
                        numberOfLines={1}
                      >
                        {note.title}
                      </Text>

                      <Pressable
                        onPress={() => handleToggleFavorite(note.id)}
                        hitSlop={8}
                        style={styles.favoriteButton}
                        accessibilityLabel="Toggle Favorite"
                      >
                        <Star
                          size={18}
                          color={note.is_favorite ? '#000000' : 'rgba(0,0,0,0.28)'}
                          fill={note.is_favorite ? '#000000' : 'none'}
                        />
                      </Pressable>
                    </View>

                    {/* Content Preview */}
                    <Text
                      style={[styles.noteContent, { color: noteTileTokens.textPrimary }]}
                      numberOfLines={4}
                    >
                      {note.content_markdown}
                    </Text>

                    {/* Bottom Row: Metadata & Edit Action */}
                    <View style={styles.noteBottomRow}>
                      <Text
                        style={[
                          styles.noteDate,
                          { color: noteTileTokens.textSecondary },
                        ]}
                      >
                        {new Date(note.updated_at).toLocaleDateString(
                          undefined,
                          {
                            month: 'short',
                            day: 'numeric',
                          }
                        )}{' '}
                        · local
                      </Text>

                      {/* Circular Edit Action Button */}
                      <View style={styles.editActionCircle}>
                        <Pencil size={14} color="#FFFFFF" />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 64,
  },
  workspaceWrapper: {
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 40,
  },
  searchBox: {
    flex: 1,
    maxWidth: 420,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    borderWidth: 1,
    maxWidth: 160,
  },
  userNameText: {
    fontSize: 13,
    fontWeight: '600',
  },
  guestTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 2,
  },
  guestTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  circularButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularButtonPrimary: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headingSection: {
    marginBottom: 28,
  },
  pageTitle: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1.2,
    marginBottom: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
  },
  spinning: {
    transform: [{ rotate: '45deg' }],
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  noteTile: {
    minHeight: 220,
    borderRadius: 20,
    padding: 24,
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  noteTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    flex: 1,
  },
  favoriteButton: {
    padding: 2,
  },
  noteContent: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  noteBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  editActionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#191919',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
