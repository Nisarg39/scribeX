/**
 * Pastel Color Swatch Picker Component.
 * Source of Truth: docs/ScribeX-Pastel-Tile-UI-Design-System.md (Section 2 & 10)
 */

import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Check } from 'lucide-react-native';
import { PastelColorKey, pastelColors } from '../../theme';

interface ColorPickerProps {
  selectedColor: PastelColorKey;
  onSelectColor: (color: PastelColorKey) => void;
}

const COLOR_KEYS: PastelColorKey[] = [
  'apricot',
  'coral',
  'lime',
  'lavender',
  'cyan',
  'pink',
  'sky',
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  selectedColor,
  onSelectColor,
}) => {
  return (
    <View style={styles.container}>
      {COLOR_KEYS.map((key) => {
        const isSelected = selectedColor === key;
        const colorHex = pastelColors[key];

        return (
          <Pressable
            key={key}
            onPress={() => onSelectColor(key)}
            hitSlop={6}
            style={({ pressed }) => [
              styles.swatch,
              {
                backgroundColor: colorHex,
                transform: [{ scale: pressed ? 0.9 : 1 }],
                borderColor: isSelected ? '#111111' : 'transparent',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Select color ${key}`}
          >
            {isSelected && <Check size={12} color="#111111" strokeWidth={3} />}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
