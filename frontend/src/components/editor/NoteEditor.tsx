/**
 * Focused Note Editor & Reading Surface Component.
 * Source of Truth: docs/ScribeX-Pastel-Tile-UI-Design-System.md (Section 6.8)
 *
 * Specifications:
 * - Quiet, focused reading surface (no form-heavy clutter)
 * - Prominent left-aligned title with zero browser blue focus ring
 * - Muted date metadata row
 * - Comfortable body line height (26px) with zero browser blue focus ring
 * - Circular top actions: back arrow, pastel color picker, delete button
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { ArrowLeft, Trash2, Star, Check } from 'lucide-react-native';
import {
  useTheme,
  PastelColorKey,
  pastelColors,
  noteTileTokens,
} from '../../theme';
import { ClientNote } from '../../db';
import { ColorPicker } from './ColorPicker';
import { webInputReset } from '../../core/webStyles';

interface NoteEditorProps {
  note: ClientNote;
  onBack: () => void;
  onSave: (updated: Partial<ClientNote> & { id: string; title: string }) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  onBack,
  onSave,
  onDelete,
  onToggleFavorite,
}) => {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content_markdown);
  const [colorToken, setColorToken] = useState<PastelColorKey>(
    (note.color_token as PastelColorKey) || 'apricot'
  );
  const [isSaved, setIsSaved] = useState(true);

  const isWide = width >= 768;
  const saveTimeoutRef = useRef<any>(null);

  const triggerAutoSave = (
    newTitle: string,
    newContent: string,
    newColor: PastelColorKey
  ) => {
    setIsSaved(false);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      onSave({
        id: note.id,
        title: newTitle,
        content_markdown: newContent,
        color_token: newColor,
      });
      setIsSaved(true);
    }, 400);
  };

  const handleTitleChange = (text: string) => {
    setTitle(text);
    triggerAutoSave(text, content, colorToken);
  };

  const handleContentChange = (text: string) => {
    setContent(text);
    triggerAutoSave(title, text, colorToken);
  };

  const handleColorSelect = (color: PastelColorKey) => {
    setColorToken(color);
    triggerAutoSave(title, content, color);
  };

  const formattedDate = new Date(note.updated_at).toLocaleDateString(
    undefined,
    {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Top Header Actions */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => [
              styles.actionCircle,
              {
                backgroundColor: isDark ? colors.surfaceRaised : '#F0F2F5',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityLabel="Back to notes"
          >
            <ArrowLeft size={18} color={colors.textPrimary} />
          </Pressable>

          {/* Color Palette Picker */}
          <ColorPicker
            selectedColor={colorToken}
            onSelectColor={handleColorSelect}
          />
        </View>

        <View style={styles.headerRight}>
          {/* Saved Status Indicator */}
          <View style={styles.saveStatusRow}>
            <Check size={14} color={isSaved ? '#34C759' : colors.textMuted} />
            <Text
              style={[
                styles.saveStatusText,
                { color: isSaved ? '#34C759' : colors.textMuted },
              ]}
            >
              {isSaved ? 'Saved' : 'Saving...'}
            </Text>
          </View>

          {/* Favorite Toggle Action */}
          <Pressable
            onPress={() => onToggleFavorite(note.id)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.actionCircle,
              {
                backgroundColor: note.is_favorite
                  ? noteTileTokens.favoriteSurfaceActive
                  : isDark
                  ? colors.surfaceRaised
                  : '#F0F2F5',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityLabel="Toggle favorite"
          >
            <Star
              size={16}
              color={
                note.is_favorite
                  ? noteTileTokens.favoriteIconActive
                  : colors.textSecondary
              }
              fill={
                note.is_favorite ? noteTileTokens.favoriteIconActive : 'none'
              }
            />
          </Pressable>

          {/* Delete Action Button */}
          <Pressable
            onPress={() => onDelete(note.id)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.actionCircle,
              {
                backgroundColor: isDark ? colors.surfaceRaised : '#F0F2F5',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityLabel="Delete note"
          >
            <Trash2 size={16} color="#FF3B30" />
          </Pressable>
        </View>
      </View>

      {/* Editor Content Surface */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          { maxWidth: isWide ? 760 : '100%' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Pastel Color Accent Pill */}
        <View
          style={[
            styles.accentPill,
            { backgroundColor: pastelColors[colorToken] },
          ]}
        >
          <Text style={styles.accentPillText}>{note.group_name || 'General'}</Text>
        </View>

        {/* Title Input - Prominent, Left-Aligned with zero blue focus ring */}
        <TextInput
          style={[
            styles.titleInput,
            { color: colors.textPrimary },
            webInputReset,
          ]}
          value={title}
          onChangeText={handleTitleChange}
          placeholder="Note title..."
          placeholderTextColor={colors.textMuted}
          multiline
          selectionColor={isDark ? '#F7F7F7' : '#171717'}
        />

        {/* Date Metadata */}
        <Text style={[styles.dateText, { color: colors.textSecondary }]}>
          {formattedDate} · Local SQLite Replica
        </Text>

        {/* Body Input - Comfortable reading height with zero blue focus ring */}
        <TextInput
          style={[
            styles.bodyInput,
            { color: colors.textPrimary },
            webInputReset,
          ]}
          value={content}
          onChangeText={handleContentChange}
          placeholder="Start writing or capturing thoughts..."
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          selectionColor={isDark ? '#F7F7F7' : '#171717'}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 6,
  },
  saveStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  scrollContainer: {
    paddingHorizontal: 32,
    paddingVertical: 28,
    alignSelf: 'center',
    width: '100%',
  },
  accentPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    marginBottom: 16,
  },
  accentPillText: {
    color: '#191919',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  titleInput: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 8,
    padding: 0,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 24,
  },
  bodyInput: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 28,
    minHeight: 400,
    padding: 0,
  },
});
