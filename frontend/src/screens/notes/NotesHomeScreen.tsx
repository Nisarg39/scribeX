/**
 * Notes Home Screen - Primary Workspace.
 * Source of Truth: docs/ScribeX-Pastel-Tile-UI-Design-System.md
 *
 * Implements:
 * - Desktop navigation rail (Sidebar, 104px, thin 1px divider)
 * - Clean top search row before the page title with zero native browser blue outline
 * - Large, iconic, bold "Notes" page heading
 * - Multi-column responsive grid with signature vivid pastel note tiles
 * - Focused note reader & editor surface
 * - High-contrast dark text (#191919) on all pastel tiles across light and dark modes
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Search,
  Plus,
  Sun,
  Moon,
  LogOut,
  Sparkles,
} from 'lucide-react-native';
import {
  useTheme,
  PastelColorKey,
  pastelColors,
} from '../../theme';
import {
  ClientNote,
  getLocalNotes,
  saveLocalNote,
  deleteLocalNote,
  toggleLocalFavorite,
  seedInitialNotesIfEmpty,
} from '../../db';
import { useSync } from '../../sync';
import { useAuth } from '../../auth';
import { Sidebar } from '../../components/shell/Sidebar';
import { NoteGrid } from '../../components/notes/NoteGrid';
import { NoteEditor } from '../../components/editor/NoteEditor';
import { webInputReset } from '../../core/webStyles';

const INITIAL_SAMPLES: Array<{
  title: string;
  content: string;
  group: string;
  color: PastelColorKey;
  isFavorite?: boolean;
}> = [
  {
    title: 'Cognitive Architecture',
    content:
      'Layer 1 captures raw user intentions and mental models. Layer 2 maintains continuous timeline graph.',
    group: 'Architecture',
    color: 'apricot',
    isFavorite: true,
  },
  {
    title: 'Pastel Tile Design Rule',
    content:
      'Keep note backgrounds colorful in both themes. Use dark text (#191919) across both light & dark modes.',
    group: 'Design',
    color: 'coral',
  },
  {
    title: 'Offline-First SQLite',
    content:
      'Direct sub-5ms local reads with zero network spinners across iOS, Android, and Web.',
    group: 'Sync',
    color: 'lime',
    isFavorite: true,
  },
  {
    title: 'Git Markdown Projection',
    content:
      'Atomic commits per entity to local Git vault. Full human-readable markdown with YAML frontmatter.',
    group: 'Vault',
    color: 'lavender',
  },
  {
    title: 'Ask-Before-Write Gate',
    content:
      'Ambiguity classification pauses automatic writes and triggers conversational clarification.',
    group: 'Intake',
    color: 'cyan',
  },
  {
    title: 'Voice & Document Intake',
    content:
      'Multi-modal entry point supporting audio dictation, PDFs, markdown notes, and quick thought captures.',
    group: 'Multi-Modal',
    color: 'pink',
    isFavorite: true,
  },
];

export const NotesHomeScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const { width } = useWindowDimensions();

  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeEditingNote, setActiveEditingNote] = useState<ClientNote | null>(
    null
  );

  const searchInputRef = useRef<any>(null);
  const isDesktop = width >= 768;

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
  const { syncNow } = useSync({
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
      if (activeEditingNote && activeEditingNote.id === id) {
        setActiveEditingNote((prev) =>
          prev ? { ...prev, is_favorite: nextFav } : null
        );
      }
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
      setActiveEditingNote(newNote);
      syncNow();
    } catch (err) {
      console.error('Failed to save note to local SQLite:', err);
    }
  };

  const handleSaveNote = async (
    updated: Partial<ClientNote> & { id: string; title: string }
  ) => {
    try {
      await saveLocalNote(updated);
      setNotes((prev) =>
        prev.map((n) => (n.id === updated.id ? ({ ...n, ...updated } as ClientNote) : n))
      );
      syncNow();
    } catch (err) {
      console.error('Failed to update note in local SQLite:', err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await deleteLocalNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setActiveEditingNote(null);
      syncNow();
    } catch (err) {
      console.error('Failed to delete note from local SQLite:', err);
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

      {/* Desktop Navigation Rail (approx 104px wide) */}
      {isDesktop && <Sidebar onAddNote={handleCreateNote} />}

      {/* Main Workspace Surface */}
      <View
        style={[
          styles.mainSurface,
          {
            backgroundColor: colors.surface,
          },
        ]}
      >
        {activeEditingNote ? (
          /* Focused Note Editor Surface */
          <NoteEditor
            note={activeEditingNote}
            onBack={() => setActiveEditingNote(null)}
            onSave={handleSaveNote}
            onDelete={handleDeleteNote}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : (
          /* Primary Notes Grid View */
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingHorizontal: isDesktop ? 64 : 20,
                paddingTop: isDesktop ? 40 : 20,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Mobile-Only Top Navigation Bar */}
            {!isDesktop && (
              <View style={styles.mobileTopBar}>
                <View style={styles.mobileBrandRow}>
                  <View
                    style={[
                      styles.mobileBrandBadge,
                      { backgroundColor: pastelColors.apricot },
                    ]}
                  >
                    <Sparkles size={16} color="#111111" />
                  </View>
                  <Text
                    style={[
                      styles.mobileBrandText,
                      { color: colors.textPrimary },
                    ]}
                  >
                    ScribeX
                  </Text>
                </View>

                <View style={styles.mobileActionsRow}>
                  <Pressable
                    onPress={toggleTheme}
                    hitSlop={8}
                    style={[
                      styles.mobileCircleBtn,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceRaised
                          : '#F0F2F5',
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
                    style={[
                      styles.mobileCircleBtn,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceRaised
                          : '#F0F2F5',
                      },
                    ]}
                    accessibilityLabel="Sign Out"
                  >
                    <LogOut size={16} color={colors.textSecondary} />
                  </Pressable>

                  <Pressable
                    onPress={handleCreateNote}
                    style={[
                      styles.mobileCircleBtnPrimary,
                      { backgroundColor: colors.iconBg },
                    ]}
                    accessibilityLabel="Add Note"
                  >
                    <Plus size={20} color={colors.iconFg} strokeWidth={2.2} />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Top Search Field (Restrained, placed before page title) */}
            <View style={styles.searchRow}>
              <Pressable
                onPress={() => searchInputRef.current?.focus()}
                style={[
                  styles.searchBox,
                  {
                    backgroundColor: isDark
                      ? colors.surfaceRaised
                      : colors.surface,
                    borderColor: isSearchFocused
                      ? isDark
                        ? '#F7F7F7'
                        : '#171717'
                      : colors.borderSubtle,
                    borderWidth: isSearchFocused ? 1.5 : 1,
                  },
                ]}
              >
                <Search
                  size={16}
                  color={colors.textMuted}
                  style={styles.searchIcon}
                />
                <TextInput
                  ref={searchInputRef}
                  style={[
                    styles.searchInput,
                    { color: colors.textPrimary },
                    webInputReset,
                  ]}
                  placeholder="Search notes in local SQLite..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  selectionColor={isDark ? '#F7F7F7' : '#171717'}
                />
              </Pressable>
            </View>

            {/* Large Bold Left-Aligned Page Heading */}
            <View style={styles.headingSection}>
              <Text
                style={[
                  styles.pageTitle,
                  {
                    color: colors.textPrimary,
                    fontSize: isDesktop ? 48 : 36,
                    lineHeight: isDesktop ? 52 : 40,
                  },
                ]}
              >
                Notes
              </Text>
            </View>

            {/* Loading Indicator or Responsive Note Grid */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.textPrimary} />
              </View>
            ) : (
              <NoteGrid
                notes={filteredNotes}
                onSelectNote={(note) => setActiveEditingNote(note)}
                onToggleFavorite={handleToggleFavorite}
              />
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
    width: '100%',
  },
  mainSurface: {
    flex: 1,
    height: '100%',
  },
  scrollContent: {
    paddingBottom: 64,
  },
  mobileTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: Platform.OS === 'web' ? 12 : 36,
  },
  mobileBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mobileBrandBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileBrandText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  mobileActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mobileCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileCircleBtnPrimary: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchRow: {
    marginBottom: 24,
  },
  searchBox: {
    maxWidth: 420,
    height: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  headingSection: {
    marginBottom: 32,
  },
  pageTitle: {
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  loadingContainer: {
    paddingVertical: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
