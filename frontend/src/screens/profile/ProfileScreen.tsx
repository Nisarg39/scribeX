/**
 * ScribeX Profile Screen (Clean Slate).
 *
 * Cleared of legacy layout and ready for complete UI/UX redesign.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';

interface ProfileScreenProps {
  onBack?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = () => {
  const { colors } = useTheme();

  return (
    <View
      className="flex-1 w-full h-full bg-appBg"
      style={[styles.container, { backgroundColor: colors.appBg }]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
