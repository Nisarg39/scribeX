import React, { useState } from 'react';
import { View, Text, TextInput, Image, Pressable, Platform } from 'react-native';
import { useTheme } from '../../../theme';
import { 
  Globe, 
  ExternalLink, 
  Compass, 
  Link2, 
  Edit3, 
  Check 
} from 'lucide-react-native';

interface BookmarkBlockProps {
  url?: string;
  title?: string;
  description?: string;
  previewUrl?: string;
  isSelected?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
  onUpdateBookmark: (url: string, title?: string, description?: string, previewUrl?: string) => void;
}

export const BookmarkBlock: React.FC<BookmarkBlockProps> = ({
  url = 'https://reactnative.dev',
  title = 'React Native · Learn once, write anywhere',
  description = 'A framework for building native applications using React.',
  previewUrl = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
  isSelected = false,
  onFocus,
  onLongPress,
  onEndDrag,
  onDelete,
  onUpdateBookmark,
}) => {
  const { isDark } = useTheme();
  const [currentUrl, setCurrentUrl] = useState(url);
  const [currentTitle, setCurrentTitle] = useState(title);
  const [currentDesc, setCurrentDesc] = useState(description);
  const [currentThumb, setCurrentThumb] = useState(previewUrl);
  const [isEditing, setIsEditing] = useState(!url || url === '');

  // Extract clean hostname for domain badge
  const domain = React.useMemo(() => {
    try {
      const u = new URL(currentUrl);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return currentUrl.replace(/^https?:\/\//, '').split('/')[0] || 'link';
    }
  }, [currentUrl]);

  const handleSave = () => {
    let formattedUrl = currentUrl.trim();
    if (formattedUrl && !formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
      setCurrentUrl(formattedUrl);
    }

    // Auto-generate title if default
    let updatedTitle = currentTitle;
    if (!currentTitle || currentTitle === 'Web Bookmark') {
      try {
        const u = new URL(formattedUrl);
        updatedTitle = `${u.hostname.replace(/^www\./, '')} - Web Page`;
        setCurrentTitle(updatedTitle);
      } catch {
        updatedTitle = formattedUrl;
      }
    }

    setIsEditing(false);
    onUpdateBookmark(formattedUrl, updatedTitle, currentDesc, currentThumb);
  };

  const handleOpenLink = () => {
    if (Platform.OS === 'web') {
      window.open(currentUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <View className="w-full">
      {/* Edit Mode URL Bar */}
      {isEditing ? (
        <View className="p-3">
          <View className="flex-row items-center gap-2 mb-2">
            <Link2 size={13} color={isDark ? '#8EDCEB' : '#08C4E5'} />
            <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
              Bookmark URL
            </Text>
          </View>

          <TextInput
            value={currentUrl}
            onFocus={onFocus}
            onChangeText={setCurrentUrl}
            placeholder="Paste web URL (https://...)"
            placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
            className="p-2.5 rounded-xl bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10 text-xs font-mono text-light-textPrimary dark:text-dark-textPrimary mb-2"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View className="flex-row items-center justify-end gap-2">
            <Pressable
              onPress={() => setIsEditing(false)}
              className="px-3 py-1.5 rounded-full bg-light-appBg dark:bg-dark-raised"
            >
              <Text className="text-xs text-light-textSecondary dark:text-dark-textSecondary">
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
              className="flex-row items-center gap-1 px-4 py-1.5 rounded-full bg-light-iconBg dark:bg-white"
            >
              <Check size={13} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2.5} />
              <Text className="text-xs font-bold text-white dark:text-[#111111]">
                Save Bookmark
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* Rendered Rich Bookmark Card */
        <Pressable
          onPress={() => {
            onFocus?.();
            handleOpenLink();
          }}
          className="flex-row items-center p-3.5 group"
        >
          {/* Left Text Column */}
          <View className="flex-1 mr-3 justify-between min-h-[70px]">
            <View>
              {/* Domain & Favicon */}
              <View className="flex-row items-center gap-1.5 mb-1">
                <Globe size={11} color={isDark ? '#8EDCEB' : '#08C4E5'} />
                <Text className="text-[11px] font-bold text-light-textMuted dark:text-dark-textMuted uppercase tracking-wider">
                  {domain}
                </Text>
              </View>

              {/* Title */}
              <Text
                numberOfLines={1}
                className="text-xs md:text-sm font-bold text-light-textPrimary dark:text-dark-textPrimary mb-1"
              >
                {currentTitle}
              </Text>

              {/* Description */}
              <Text
                numberOfLines={2}
                className="text-[11px] text-light-textSecondary dark:text-dark-textSecondary leading-relaxed"
              >
                {currentDesc}
              </Text>
            </View>

            {/* Bottom URL link & Edit Trigger */}
            <View className="flex-row items-center gap-3 mt-2">
              <View className="flex-row items-center gap-1">
                <ExternalLink size={10} color={isDark ? '#B5B5B5' : '#626262'} />
                <Text
                  numberOfLines={1}
                  className="text-[10px] text-light-textMuted dark:text-dark-textMuted max-w-[180px]"
                >
                  {currentUrl}
                </Text>
              </View>

              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="p-1 rounded opacity-50 hover:opacity-100"
                accessibilityLabel="Edit Bookmark"
              >
                <Edit3 size={11} color={isDark ? '#B5B5B5' : '#626262'} />
              </Pressable>
            </View>
          </View>

          {/* Right Thumbnail Preview */}
          {currentThumb ? (
            <View className="w-20 h-20 rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 border border-light-border/40 dark:border-white/5">
              <Image
                source={{ uri: currentThumb }}
                className="w-full h-full object-cover"
                resizeMode="cover"
              />
            </View>
          ) : null}
        </Pressable>
      )}
    </View>
  );
};
