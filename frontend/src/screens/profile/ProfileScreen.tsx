/**
 * ScribeX Profile Screen (Clean Slate).
 *
 * Cleared of legacy layout and ready for complete UI/UX redesign.
 */

import React from 'react';
import { View } from 'react-native';

interface ProfileScreenProps {
  onBack?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = () => {
  return <View className="flex-1 w-full h-full bg-appBg" />;
};

