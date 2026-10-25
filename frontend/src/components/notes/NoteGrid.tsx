/**
 * Responsive Note Grid Component.
 * Source of Truth: docs/ScribeX-Pastel-Tile-UI-Design-System.md (Section 4 & 10)
 *
 * Specifications:
 * - Desktop: 3 columns, 28px gap
 * - Tablet: 2 columns, 20px gap
 * - Mobile: 1 column, 14px gap
 */

import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { ClientNote } from '../../db';
import { NoteTile } from './NoteTile';

interface NoteGridProps {
  notes: ClientNote[];
  onSelectNote: (note: ClientNote) => void;
  onToggleFavorite: (id: string) => void;
}

export const NoteGrid: React.FC<NoteGridProps> = ({
  notes,
  onSelectNote,
  onToggleFavorite,
}) => {
  const { width } = useWindowDimensions();

  const isWide = width >= 1100;
  const isTablet = width >= 640 && width < 1100;

  const numColumns = isWide ? 3 : isTablet ? 2 : 1;
  const gap = isWide ? 28 : isTablet ? 20 : 14;

  const columnWidth =
    numColumns === 3
      ? '31.2%'
      : numColumns === 2
      ? '48.5%'
      : '100%';

  return (
    <View style={[styles.grid, { gap }]}>
      {notes.map((note) => (
        <NoteTile
          key={note.id}
          note={note}
          onPress={onSelectNote}
          onToggleFavorite={onToggleFavorite}
          widthFlex={columnWidth}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
});
