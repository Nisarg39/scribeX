import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Platform, Linking } from 'react-native';
import { useTheme, NoteColors } from '../../../theme';
import { MapPin, Navigation, ExternalLink, Edit3, Check, X } from 'lucide-react-native';

interface LocationBlockProps {
  placeName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
  onUpdateLocation?: (placeName: string, address: string, lat?: number, lng?: number) => void;
}

export const LocationBlock: React.FC<LocationBlockProps> = ({
  placeName = 'San Francisco Tech Hub',
  address = '550 4th Street, San Francisco, CA 94107',
  lat = 37.7785,
  lng = -122.3998,
  isSelected = false,
  isDragging = false,
  onFocus,
  onLongPress,
  onStartDrag,
  onEndDrag,
  onDelete,
  onUpdateLocation,
}) => {
  const { isDark } = useTheme();
  const [currentPlace, setCurrentPlace] = useState(placeName);
  const [currentAddress, setCurrentAddress] = useState(address);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    setIsEditing(false);
    onUpdateLocation?.(currentPlace.trim() || 'Location Checkpoint', currentAddress.trim(), lat, lng);
  };

  const handleOpenMap = () => {
    const query = encodeURIComponent(`${currentPlace}, ${currentAddress}`);
    const mapUrl = lat && lng 
      ? `https://maps.google.com/?q=${lat},${lng}` 
      : `https://maps.google.com/?q=${query}`;
    
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(mapUrl, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(mapUrl).catch(() => {});
    }
  };

  return (
    <Pressable
      onPress={onFocus}
      style={[
        {
          borderColor: isSelected
            ? '#06B6D4'
            : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)',
        },
      ]}
      className="my-1.5 w-full rounded-2xl border p-3 transition-all group"
    >
      {isEditing ? (
        <View className="w-full">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-1.5">
              <MapPin size={13} color={NoteColors.coral} />
              <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                Edit Location Details
              </Text>
            </View>
            <Pressable onPress={() => setIsEditing(false)} className="p-1">
              <X size={13} color={isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>
          </View>

          <TextInput
            value={currentPlace}
            onChangeText={setCurrentPlace}
            onFocus={onFocus}
            placeholder="Place name (e.g. Headquarters, Cafe Lab)"
            placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
            className="p-2 rounded-lg bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10 text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary mb-2"
          />

          <TextInput
            value={currentAddress}
            onChangeText={setCurrentAddress}
            onFocus={onFocus}
            placeholder="Street address or city..."
            placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
            className="p-2 rounded-lg bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10 text-xs text-light-textPrimary dark:text-dark-textPrimary mb-2"
          />

          <View className="flex-row items-center justify-end gap-2">
            <Pressable
              onPress={() => setIsEditing(false)}
              className="px-3 py-1 rounded-full bg-light-appBg dark:bg-dark-raised"
            >
              <Text className="text-xs text-light-textSecondary dark:text-dark-textSecondary">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              className="flex-row items-center gap-1 px-3 py-1 rounded-full bg-light-iconBg dark:bg-white"
            >
              <Check size={12} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2.5} />
              <Text className="text-xs font-bold text-white dark:text-[#111111]">Save Location</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* Rendered Location Checkpoint Row */
        <View className="flex-row items-center justify-between w-full">
          {/* Left Info: Icon & Place Details */}
          <View className="flex-row items-center gap-3 flex-1 mr-3">
            <View
              style={{ backgroundColor: `${NoteColors.coral}22` }}
              className="w-10 h-10 rounded-xl items-center justify-center flex-shrink-0"
            >
              <MapPin size={18} color={NoteColors.coral} />
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text
                  numberOfLines={1}
                  className="text-xs md:text-sm font-bold text-light-textPrimary dark:text-dark-textPrimary"
                >
                  {currentPlace}
                </Text>
                <Pressable
                  onPress={() => {
                    onFocus?.();
                    setIsEditing(true);
                  }}
                  className="p-0.5 opacity-40 hover:opacity-100"
                  accessibilityLabel="Edit Location"
                >
                  <Edit3 size={11} color={isDark ? '#B5B5B5' : '#626262'} />
                </Pressable>
              </View>

              <Text
                numberOfLines={1}
                className="text-[11px] text-light-textSecondary dark:text-dark-textSecondary mt-0.5"
              >
                {currentAddress}
              </Text>

              {Boolean(lat !== undefined && lng !== undefined) ? (
                <View className="flex-row items-center gap-1 mt-1">
                  <Navigation size={9} color={isDark ? '#8EDCEB' : '#08C4E5'} />
                  <Text className="text-[10px] font-mono text-light-textMuted dark:text-dark-textMuted">
                    {lat?.toFixed(4)}°, {lng?.toFixed(4)}°
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Right Action: Open in Maps */}
          <Pressable
            onPress={handleOpenMap}
            style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
            className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10 hover:border-note-cyan/40"
          >
            <ExternalLink size={11} color={isDark ? '#F7F7F7' : '#171717'} />
            <Text className="text-[11px] font-semibold text-light-textPrimary dark:text-dark-textPrimary">
              Maps
            </Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
};

