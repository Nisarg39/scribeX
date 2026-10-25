import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  useWindowDimensions,
  Platform,
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
} from 'lucide-react-native';
import {
  ThemeProvider,
  useTheme,
  PastelColorKey,
  pastelColors,
} from './src/theme';

interface SampleNote {
  id: string;
  title: string;
  snippet: string;
  date: string;
  color: PastelColorKey;
  isFavorite?: boolean;
}

const SAMPLE_NOTES: SampleNote[] = [
  {
    id: '1',
    title: 'Cognitive Architecture',
    snippet: 'Layer 1 captures raw user intentions and mental models. Layer 2 maintains continuous timeline graph.',
    date: 'Oct 25, 2026',
    color: 'apricot',
    isFavorite: true,
  },
  {
    id: '2',
    title: 'Pastel Tile Design Rule',
    snippet: 'Keep note backgrounds colorful in both themes. Use dark text (#191919) across both light & dark modes.',
    date: 'Oct 24, 2026',
    color: 'coral',
  },
  {
    id: '3',
    title: 'Offline-First SQLite',
    snippet: 'Direct sub-5ms local reads with zero network spinners. Background WebSocket doorbell pings for sync.',
    date: 'Oct 22, 2026',
    color: 'lime',
    isFavorite: true,
  },
  {
    id: '4',
    title: 'Git Markdown Projection',
    snippet: 'Atomic commits per entity to local Git vault. Full human-readable markdown with YAML frontmatter.',
    date: 'Oct 20, 2026',
    color: 'lavender',
  },
  {
    id: '5',
    title: 'Ask-Before-Write Gate',
    snippet: 'Ambiguity classification pauses automatic writes and triggers conversational clarification.',
    date: 'Oct 19, 2026',
    color: 'cyan',
  },
  {
    id: '6',
    title: 'LanceDB Vector Hybrid',
    snippet: 'Zero-cloud local vector search indexing markdown chunks alongside fast BM25 keyword matching.',
    date: 'Oct 18, 2026',
    color: 'pink',
  },
];

function NotesWorkspace() {
  const {
    isDark,
    colors,
    noteTileTokens,
    radii,
    spacing,
    typography,
    toggleTheme,
  } = useTheme();

  const { width } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState<SampleNote[]>(SAMPLE_NOTES);

  const isWide = width >= 1024;
  const isTablet = width >= 640 && width < 1024;

  const numColumns = isWide ? 3 : isTablet ? 2 : 1;

  const toggleFavorite = (id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isFavorite: !n.isFavorite } : n))
    );
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.snippet.toLowerCase().includes(searchQuery.toLowerCase())
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
              placeholder="Search notes..."
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
              onPress={() => {
                const colorKeys: PastelColorKey[] = [
                  'apricot',
                  'coral',
                  'lime',
                  'lavender',
                  'cyan',
                  'pink',
                ];
                const nextColor =
                  colorKeys[notes.length % colorKeys.length];
                const newNote: SampleNote = {
                  id: String(Date.now()),
                  title: `New Note #${notes.length + 1}`,
                  snippet: 'Captured via ScribeX instant pastel editor.',
                  date: 'Today',
                  color: nextColor,
                };
                setNotes([newNote, ...notes]);
              }}
            >
              <Plus size={22} color={colors.iconFg} />
            </Pressable>
          </View>
        </View>

        {/* Page Title Row */}
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
          <View style={styles.badgeRow}>
            <Sparkles size={16} color={colors.textSecondary} />
            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
              {notes.length} {notes.length === 1 ? 'note' : 'notes'} • {isDark ? 'Dark Mode' : 'Light Mode'}
            </Text>
          </View>
        </View>

        {/* Note Tiles Grid */}
        <View style={styles.gridContainer}>
          {filteredNotes.map((note) => {
            const tileBg = pastelColors[note.color];
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
                  {/* Top Row: Title + Favorite Toggle */}
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
                        note.isFavorite ? 'Unmark favorite' : 'Mark favorite'
                      }
                      hitSlop={6}
                      style={({ pressed }) => [
                        styles.tileFavoriteButton,
                        {
                          backgroundColor: note.isFavorite
                            ? noteTileTokens.favoriteSurfaceActive
                            : noteTileTokens.favoriteSurfaceInactive,
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}
                      onPress={() => toggleFavorite(note.id)}
                    >
                      <Star
                        size={16}
                        color={
                          note.isFavorite
                            ? noteTileTokens.favoriteIconActive
                            : noteTileTokens.favoriteIconInactive
                        }
                        fill={
                          note.isFavorite
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
                    {note.snippet}
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
                      {note.date}
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
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '500',
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
