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
  CloudCheck,
} from 'lucide-react-native';
import {
  ThemeProvider,
  useTheme,
  PastelColorKey,
  pastelColors,
} from './src/theme';
import {
  ClientNote,
  getLocalNotes,
  saveLocalNote,
  toggleLocalFavorite,
  seedInitialNotesIfEmpty,
  getPendingMutations,
} from './src/db';

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
    title: 'LanceDB Vector Hybrid',
    content: 'Zero-cloud local vector search indexing markdown chunks alongside fast BM25 keyword matching.',
    group: 'AI',
    color: 'pink',
  },
];

function NotesWorkspace() {
  const {
    isDark,
    colors,
    noteTileTokens,
    radii,
    typography,
    toggleTheme,
  } = useTheme();

  const { width } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const isWide = width >= 1024;
  const isTablet = width >= 640 && width < 1024;
  const numColumns = isWide ? 3 : isTablet ? 2 : 1;

  // Load notes directly from local offline-first SQLite database
  const loadNotes = useCallback(async () => {
    try {
      await seedInitialNotesIfEmpty(INITIAL_SAMPLES);
      const loaded = await getLocalNotes();
      setNotes(loaded);
      const pending = await getPendingMutations();
      setPendingCount(pending.length);
    } catch (err) {
      console.error('Failed to load notes from local SQLite:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleToggleFavorite = async (id: string) => {
    try {
      const nextFav = await toggleLocalFavorite(id);
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_favorite: nextFav } : n))
      );
      const pending = await getPendingMutations();
      setPendingCount(pending.length);
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
        title: `Offline Thought #${notes.length + 1}`,
        content_markdown: 'Instant local SQLite commit with sub-5ms query latency.',
        group_name: 'General Reference',
        color_token: nextColor,
        is_favorite: false,
      });

      setNotes((prev) => [newNote, ...prev]);
      const pending = await getPendingMutations();
      setPendingCount(pending.length);
    } catch (err) {
      console.error('Failed to save note to local SQLite:', err);
    }
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content_markdown.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.canvas, { backgroundColor: colors.appBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingHorizontal: isWide ? 64 : isTablet ? 32 : 20,
            paddingVertical: isWide ? 48 : 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Control Bar: Search & Theme Toggle & Add Action */}
        <View style={styles.topBar}>
          <View
            style={[
              styles.searchContainer,
              {
                backgroundColor: colors.surfaceRaised,
                borderRadius: radii.search,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[
                styles.searchInput,
                {
                  color: colors.textPrimary,
                  fontFamily: Platform.select({
                    ios: 'System',
                    android: 'sans-serif',
                    default: 'Inter, -apple-system, sans-serif',
                  }),
                },
              ]}
              placeholder="Search notes in local SQLite..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.actionsGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.borderSubtle,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={toggleTheme}
            >
              {isDark ? (
                <Sun size={20} color={colors.textPrimary} />
              ) : (
                <Moon size={20} color={colors.textPrimary} />
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add new note"
              style={({ pressed }) => [
                styles.createButton,
                {
                  backgroundColor: colors.iconBg,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={handleCreateNote}
            >
              <Plus size={22} color={colors.iconFg} />
            </Pressable>
          </View>
        </View>

        {/* Page Title & Status Row */}
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.pageTitle,
              isWide ? typography.pageTitle : typography.pageTitleMobile,
              { color: colors.textPrimary },
            ]}
          >
            Notes
          </Text>

          <View style={styles.metaBadges}>
            <View style={styles.badgeRow}>
              <Database size={15} color={colors.textSecondary} />
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                Offline SQLite Active • {notes.length} {notes.length === 1 ? 'note' : 'notes'}
              </Text>
            </View>

            {pendingCount > 0 && (
              <View style={[styles.badgeRow, styles.pendingBadge]}>
                <Sparkles size={14} color="#D97706" />
                <Text style={[styles.badgeText, { color: '#D97706', fontWeight: '600' }]}>
                  {pendingCount} pending delta {pendingCount === 1 ? 'sync' : 'syncs'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Note Tiles Grid */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.textPrimary} />
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {filteredNotes.map((note) => {
              const tileBg = pastelColors[note.color_token] || pastelColors.apricot;
              const formattedDate = new Date(note.updated_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <View
                  key={note.id}
                  style={[
                    styles.tileWrapper,
                    {
                      width:
                        numColumns === 3
                          ? '31.5%'
                          : numColumns === 2
                          ? '48.5%'
                          : '100%',
                      marginBottom: 24,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.noteTile,
                      {
                        backgroundColor: tileBg,
                        borderRadius: radii.noteTile,
                      },
                    ]}
                  >
                    {/* Top Row: Title + Dark Circular Favorite Button */}
                    <View style={styles.tileHeader}>
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.tileTitle,
                          typography.noteTitle,
                          { color: noteTileTokens.textPrimary },
                        ]}
                      >
                        {note.title}
                      </Text>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          note.is_favorite ? 'Unmark favorite' : 'Mark favorite'
                        }
                        hitSlop={6}
                        style={({ pressed }) => [
                          styles.tileFavoriteButton,
                          {
                            backgroundColor: note.is_favorite
                              ? noteTileTokens.favoriteSurfaceActive
                              : noteTileTokens.favoriteSurfaceInactive,
                            opacity: pressed ? 0.75 : 1,
                          },
                        ]}
                        onPress={() => handleToggleFavorite(note.id)}
                      >
                        <Star
                          size={16}
                          color={
                            note.is_favorite
                              ? noteTileTokens.favoriteIconActive
                              : noteTileTokens.favoriteIconInactive
                          }
                          fill={
                            note.is_favorite
                              ? noteTileTokens.favoriteIconActive
                              : 'transparent'
                          }
                        />
                      </Pressable>
                    </View>

                    {/* Body Preview */}
                    <Text
                      numberOfLines={4}
                      style={[
                        styles.tileSnippet,
                        typography.noteBodyPreview,
                        { color: noteTileTokens.textPrimary },
                      ]}
                    >
                      {note.content_markdown}
                    </Text>

                    {/* Bottom Metadata & Action Row */}
                    <View style={styles.tileFooter}>
                      <Text
                        style={[
                          styles.tileDate,
                          typography.dateMetadata,
                          { color: noteTileTokens.textSecondary },
                        ]}
                      >
                        {formattedDate} {note.pending_sync ? '• local' : ''}
                      </Text>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit note: ${note.title}`}
                        style={({ pressed }) => [
                          styles.tileActionButton,
                          {
                            backgroundColor: noteTileTokens.actionBg,
                            borderRadius: radii.circularAction,
                            opacity: pressed ? 0.75 : 1,
                          },
                        ]}
                      >
                        <Pencil size={15} color={noteTileTokens.actionFg} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <NotesWorkspace />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 16,
  },
  searchContainer: {
    flex: 1,
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
    outlineStyle: 'none' as any,
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    marginBottom: 32,
  },
  pageTitle: {
    marginBottom: 8,
  },
  metaBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tileWrapper: {},
  noteTile: {
    minHeight: 230,
    padding: 22,
    justifyContent: 'space-between',
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  tileTitle: {
    flex: 1,
  },
  tileSnippet: {
    flex: 1,
    marginBottom: 16,
  },
  tileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileDate: {
    fontWeight: '500',
  },
  tileActionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileFavoriteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
