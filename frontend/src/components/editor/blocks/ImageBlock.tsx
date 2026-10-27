import React, { useState } from 'react';
import { View, Text, TextInput, Image, Pressable, Modal } from 'react-native';
import { useTheme } from '../../../theme';
import { 
  Maximize2, 
  X, 
  Link as LinkIcon, 
  Image as ImageIcon 
} from 'lucide-react-native';

interface ImageBlockProps {
  url?: string;
  caption?: string;
  aspectRatio?: 'compact' | 'natural' | 'wide';
  onUpdateImage: (url: string, caption: string, aspectRatio?: 'compact' | 'natural' | 'wide') => void;
}

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80';

export const ImageBlock: React.FC<ImageBlockProps> = ({
  url = DEFAULT_IMAGE,
  caption = '',
  aspectRatio = 'natural',
  onUpdateImage,
}) => {
  const { isDark } = useTheme();
  const [imageUrl, setImageUrl] = useState(url || DEFAULT_IMAGE);
  const [imageCaption, setImageCaption] = useState(caption);
  const [currentRatio, setCurrentRatio] = useState(aspectRatio);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isUrlEditing, setIsUrlEditing] = useState(false);
  const [urlInput, setUrlInput] = useState(imageUrl);

  const handleSaveUrl = () => {
    const next = urlInput.trim() || DEFAULT_IMAGE;
    setImageUrl(next);
    setIsUrlEditing(false);
    onUpdateImage(next, imageCaption, currentRatio);
  };

  const handleCaptionChange = (text: string) => {
    setImageCaption(text);
    onUpdateImage(imageUrl, text, currentRatio);
  };

  const handleRatioChange = (ratio: 'compact' | 'natural' | 'wide') => {
    setCurrentRatio(ratio);
    onUpdateImage(imageUrl, imageCaption, ratio);
  };

  const containerHeight =
    currentRatio === 'compact' ? 'h-48' : currentRatio === 'wide' ? 'h-80' : 'h-64';

  return (
    <View className="my-2">
      {/* Image Container */}
      <View className={`w-full ${containerHeight} rounded-3xl overflow-hidden border border-light-border dark:border-white/10 bg-black/5 dark:bg-black/30 relative group`}>
        <Image
          source={{ uri: imageUrl }}
          className="w-full h-full object-cover"
          resizeMode="cover"
        />

        {/* Top Floating Controls */}
        <View className="absolute top-3 right-3 flex-row items-center gap-1.5 bg-black/50 backdrop-blur-md px-2 py-1 rounded-full">
          {/* Ratio Pills */}
          {(['compact', 'natural', 'wide'] as const).map((r) => (
            <Pressable
              key={r}
              onPress={() => handleRatioChange(r)}
              className={`px-2 py-0.5 rounded-full ${
                currentRatio === r ? 'bg-white text-black' : 'hover:bg-white/20'
              }`}
            >
              <Text
                className={`text-[10px] font-bold capitalize ${
                  currentRatio === r ? 'text-black' : 'text-white'
                }`}
              >
                {r}
              </Text>
            </Pressable>
          ))}

          {/* Edit URL Button */}
          <Pressable
            onPress={() => setIsUrlEditing(!isUrlEditing)}
            className="p-1 rounded-full hover:bg-white/20"
            accessibilityLabel="Change Image URL"
          >
            <LinkIcon size={12} color="#FFFFFF" />
          </Pressable>

          {/* Lightbox Zoom Button */}
          <Pressable
            onPress={() => setIsLightboxOpen(true)}
            className="p-1 rounded-full hover:bg-white/20"
            accessibilityLabel="View Fullscreen"
          >
            <Maximize2 size={12} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* URL Edit Input Bar */}
      {isUrlEditing && (
        <View className="flex-row items-center gap-2 mt-2 p-2 rounded-xl bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10">
          <ImageIcon size={13} color={isDark ? '#B5B5B5' : '#626262'} />
          <TextInput
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="Paste image URL (https://...)"
            placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
            className="flex-1 text-xs text-light-textPrimary dark:text-dark-textPrimary py-0"
            autoCapitalize="none"
          />
          <Pressable
            onPress={handleSaveUrl}
            className="px-3 py-1 rounded-lg bg-light-iconBg dark:bg-white"
          >
            <Text className="text-xs font-bold text-white dark:text-[#111111]">
              Set
            </Text>
          </Pressable>
        </View>
      )}

      {/* Caption Input */}
      <TextInput
        value={imageCaption}
        onChangeText={handleCaptionChange}
        placeholder="Write image caption..."
        placeholderTextColor={isDark ? '#858585' : '#929292'}
        className="text-center text-xs text-light-textMuted dark:text-dark-textMuted mt-1.5 py-1 italic"
      />

      {/* Fullscreen Lightbox Modal */}
      <Modal
        visible={isLightboxOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLightboxOpen(false)}
      >
        <View className="flex-1 bg-black/95 items-center justify-center p-4">
          <Pressable
            onPress={() => setIsLightboxOpen(false)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md items-center justify-center z-10 active:scale-95"
            accessibilityLabel="Close Lightbox"
          >
            <X size={20} color="#FFFFFF" />
          </Pressable>

          <Image
            source={{ uri: imageUrl }}
            className="w-full h-4/5 object-contain"
            resizeMode="contain"
          />

          {imageCaption ? (
            <Text className="text-sm text-white/80 mt-4 text-center max-w-lg">
              {imageCaption}
            </Text>
          ) : null}
        </View>
      </Modal>
    </View>
  );
};
