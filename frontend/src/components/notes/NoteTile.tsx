/**
 * Signature Pastel Note Tile Component.
 * Source of Truth: docs/ScribeX-Pastel-Tile-UI-Design-System.md (Section 6.4 & 10)
 *
 * Specifications:
 * - Corner radius: 18px
 * - Min-height: 232px
 * - Padding: 24px desktop / 16px mobile
 * - High-contrast near-black text (#191919) in BOTH light and dark themes
 * - Yellow star (#FFD43B) on dark circular surface (#111111) for active favorite
 * - Dark circular action button (40px) with white pencil icon for edit
 */

import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Star, Pencil } from 'lucide-react-native';
import { PastelColorKey, pastelColors, noteTileTokens } from '../../theme';
import { ClientNote } from '../../db';

interface NoteTileProps {
  note: ClientNote;
  onPress: (note: ClientNote) => void;
  onToggleFavorite: (id: string) => void;
  widthFlex?: any;
}

export const NoteTile: React.FC<NoteTileProps> = ({
  note,
  onPress,
  onToggleFavorite,
  widthFlex,
}) => {
  const colorHex =
    pastelColors[note.color_token as PastelColorKey] || pastelColors.apricot;

  const formattedDate = new Date(note.updated_at).toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
    }
  );

  return (
    <Pressable
      onPress={() => onPress(note)}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: colorHex,
          width: widthFlex || '100%',
          opacity: pressed ? 0.94 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Note: ${note.title}`}
    >
      {/* Top Row: Title + Favorite Star */}
      <View style={styles.topRow}>
        <Text
          style={[styles.title, { color: noteTileTokens.textPrimary }]}
          numberOfLines={1}
        >
          {note.title}
        </Text>

        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onToggleFavorite(note.id);
          }}
          hitSlop={8}
          style={[
            styles.favoriteCircle,
            {
              backgroundColor: note.is_favorite
                ? noteTileTokens.favoriteSurfaceActive
                : noteTileTokens.favoriteSurfaceInactive,
            },
          ]}
          accessibilityLabel="Toggle favorite"
        >
          <Star
            size={14}
            color={
              note.is_favorite
                ? noteTileTokens.favoriteIconActive
                : noteTileTokens.favoriteIconInactive
            }
            fill={
              note.is_favorite ? noteTileTokens.favoriteIconActive : 'none'
            }
          />
        </Pressable>
      </View>

      {/* Content Preview */}
      <Text
        style={[styles.contentPreview, { color: noteTileTokens.textPrimary }]}
        numberOfLines={4}
      >
        {note.content_markdown}
      </Text>

      {/* Bottom Metadata & Edit Action */}
      <View style={styles.bottomRow}>
        <Text
          style={[styles.dateText, { color: noteTileTokens.textSecondary }]}
        >
          {formattedDate}
        </Text>

        {/* Circular Dark Edit Action */}
        <View style={styles.editActionCircle}>
          <Pencil size={15} color="#FFFFFF" strokeWidth={2} />
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  tile: {
    minHeight: 232,
    borderRadius: 18,
    padding: 24,
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: -0.2,
    flex: 1,
  },
  favoriteCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentPreview: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    marginVertical: 16,
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  editActionCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
