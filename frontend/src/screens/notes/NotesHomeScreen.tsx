/**
 * ScribeX Main Workspace Shell (Complete Clean Slate).
 *
 * All legacy UI (header, profile screen, cards) removed.
 * Ready for complete redesign planning from the ground up.
 */

import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../theme';
import { clearAllLocalNotes } from '../../db/notesRepo';

export const NotesHomeScreen: React.FC = () => {
  const { isDark } = useTheme();

  useEffect(() => {
    clearAllLocalNotes().catch((e) => console.warn('Local purge warning:', e));
  }, []);

  return (
    <View className="flex-1 w-full h-full bg-appBg">
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
};

