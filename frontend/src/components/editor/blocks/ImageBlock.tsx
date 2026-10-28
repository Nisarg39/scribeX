import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Image, Pressable, Modal, DimensionValue, PanResponder } from 'react-native';
import { useTheme } from '../../../theme';
import { 
  Maximize2, 
  X, 
  Link as LinkIcon, 
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  MoveHorizontal,
  Trash2
} from 'lucide-react-native';

export type ImageWidth = '33%' | '50%' | '75%' | '100%';
export type ImageAlign = 'left' | 'center' | 'right';
export type ImageRatio = 'compact' | 'natural' | 'wide';

interface ImageBlockProps {
  url?: string;
  caption?: string;
  width?: ImageWidth;
  align?: ImageAlign;
  aspectRatio?: ImageRatio;
  isSelected?: boolean;
  onUpdateImage: (
    url: string,
    caption: string,
    width: ImageWidth,
    align: ImageAlign,
    aspectRatio: ImageRatio
  ) => void;
  onFocus?: () => void;
  onLongPress?: () => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
}

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80';

export const ImageBlock: React.FC<ImageBlockProps> = ({
  url = DEFAULT_IMAGE,
  caption = '',
  width = '100%',
  align = 'center',
  aspectRatio = 'natural',
  isSelected = false,
  onUpdateImage,
  onFocus,
  onLongPress,
  onEndDrag,
  onDelete,
}) => {
  const { isDark } = useTheme();
  const [imageUrl, setImageUrl] = useState(url || DEFAULT_IMAGE);
  const [imageCaption, setImageCaption] = useState(caption);
  const [currentWidth, setCurrentWidth] = useState<ImageWidth>(width);
  const [currentAlign, setCurrentAlign] = useState<ImageAlign>(align);
  const [currentRatio, setCurrentRatio] = useState<ImageRatio>(aspectRatio);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isUrlEditing, setIsUrlEditing] = useState(false);
  const [urlInput, setUrlInput] = useState(imageUrl);

  const handleSaveUrl = () => {
    const next = urlInput.trim() || DEFAULT_IMAGE;
    setImageUrl(next);
    setIsUrlEditing(false);
    onUpdateImage(next, imageCaption, currentWidth, currentAlign, currentRatio);
  };

  const handleCaptionChange = (text: string) => {
    setImageCaption(text);
    onUpdateImage(imageUrl, text, currentWidth, currentAlign, currentRatio);
  };

  const handleWidthChange = (w: ImageWidth) => {
    setCurrentWidth(w);
    onUpdateImage(imageUrl, imageCaption, w, currentAlign, currentRatio);
  };

  const handleAlignChange = (a: ImageAlign) => {
    setCurrentAlign(a);
    onUpdateImage(imageUrl, imageCaption, currentWidth, a, currentRatio);
  };

  const handleRatioChange = (r: ImageRatio) => {
    setCurrentRatio(r);
    onUpdateImage(imageUrl, imageCaption, currentWidth, currentAlign, r);
  };

  const resizePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_evt, gestureState) => {
          if (gestureState.dx > 35) {
            if (currentWidth === '33%') handleWidthChange('50%');
            else if (currentWidth === '50%') handleWidthChange('75%');
            else if (currentWidth === '75%') handleWidthChange('100%');
          } else if (gestureState.dx < -35) {
            if (currentWidth === '100%') handleWidthChange('75%');
            else if (currentWidth === '75%') handleWidthChange('50%');
            else if (currentWidth === '50%') handleWidthChange('33%');
          }
        },
      }),
    [currentWidth, handleWidthChange]
  );

  const containerHeight =
    currentRatio === 'compact' ? 'h-48' : currentRatio === 'wide' ? 'h-80' : 'h-64';

  const widthStyle: { width: DimensionValue } = {
    width: currentWidth === '33%' ? '33.33%' : currentWidth === '50%' ? '50%' : currentWidth === '75%' ? '75%' : '100%',
  };

  const alignContainerClass =
    currentAlign === 'left' ? 'items-start' : currentAlign === 'right' ? 'items-end' : 'items-center';

  return (
    <View className={`my-3 w-full ${alignContainerClass}`}>
      {/* Resizable Image Wrapper */}
      <Pressable 
        onPress={onFocus}
        onLongPress={onLongPress}
        onPressOut={onEndDrag}
        delayLongPress={280}
        style={widthStyle} 
        className={`relative group rounded-2xl ${
          isSelected ? 'ring-2 ring-note-cyan shadow-md' : ''
        }`}
      >
        {/* Interactive Width Resize Handle */}
        {isSelected && (
          <View
            {...resizePanResponder.panHandlers}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 rounded-full bg-note-cyan shadow-lg shadow-note-cyan/30 items-center justify-center cursor-ew-resize z-30"
            accessibilityLabel="Drag horizontally to resize image width"
          >
            <MoveHorizontal size={13} color="#000000" strokeWidth={2.6} />
          </View>
        )}

        <View className={`w-full ${containerHeight} rounded-2xl overflow-hidden border border-light-border dark:border-white/10 bg-black/5 dark:bg-black/30 relative shadow-sm`}>
          <Image
            source={{ uri: imageUrl }}
            className="w-full h-full object-cover"
            resizeMode="cover"
          />

          {/* Floating Media Toolbar */}
          <View className="absolute top-2.5 right-2.5 flex-row items-center flex-wrap gap-1 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full shadow-lg">
            {/* Width Selector Pills */}
            {(['33%', '50%', '75%', '100%'] as const).map((w) => (
              <Pressable
                key={w}
                onPress={() => handleWidthChange(w)}
                className={`px-1.5 py-0.5 rounded-full ${
                  currentWidth === w ? 'bg-white' : 'hover:bg-white/20'
                }`}
              >
                <Text
                  className={`text-[9px] font-bold ${
                    currentWidth === w ? 'text-black' : 'text-white/80'
                  }`}
                >
                  {w}
                </Text>
              </Pressable>
            ))}

            <View className="w-[1px] h-3 bg-white/20 mx-0.5" />

            {/* Alignment Icons */}
            <Pressable
              onPress={() => handleAlignChange('left')}
              className={`p-1 rounded-full ${currentAlign === 'left' ? 'bg-white/30' : 'hover:bg-white/20'}`}
              accessibilityLabel="Align Left"
            >
              <AlignLeft size={11} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={() => handleAlignChange('center')}
              className={`p-1 rounded-full ${currentAlign === 'center' ? 'bg-white/30' : 'hover:bg-white/20'}`}
              accessibilityLabel="Align Center"
            >
              <AlignCenter size={11} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={() => handleAlignChange('right')}
              className={`p-1 rounded-full ${currentAlign === 'right' ? 'bg-white/30' : 'hover:bg-white/20'}`}
              accessibilityLabel="Align Right"
            >
              <AlignRight size={11} color="#FFFFFF" />
            </Pressable>

            <View className="w-[1px] h-3 bg-white/20 mx-0.5" />

            {/* Edit URL */}
            <Pressable
              onPress={() => setIsUrlEditing(!isUrlEditing)}
              className="p-1 rounded-full hover:bg-white/20"
              accessibilityLabel="Change Image URL"
            >
              <LinkIcon size={11} color="#FFFFFF" />
            </Pressable>

            {/* Fullscreen Lightbox */}
            <Pressable
              onPress={() => setIsLightboxOpen(true)}
              className="p-1 rounded-full hover:bg-white/20"
              accessibilityLabel="View Fullscreen"
            >
              <Maximize2 size={11} color="#FFFFFF" />
            </Pressable>

            {/* Delete Image */}
            {onDelete && (
              <Pressable
                onPress={onDelete}
                className="p-1 rounded-full hover:bg-red-500/30"
                accessibilityLabel="Delete Image"
              >
                <Trash2 size={11} color="#FF6B6B" />
              </Pressable>
            )}
          </View>
        </View>

        {/* URL Edit Input Bar */}
        {isUrlEditing && (
          <View className="flex-row items-center gap-2 mt-2 p-2 rounded-xl bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10 shadow-md">
            <ImageIcon size={13} color={isDark ? '#B5B5B5' : '#626262'} />
            <TextInput
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="Paste image URL (https://...)"
              placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
              className="flex-1 text-xs text-light-textPrimary dark:text-dark-textPrimary py-0 outline-none"
              autoCapitalize="none"
            />
            <Pressable
              onPress={handleSaveUrl}
              style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
              className="px-3 py-1 rounded-lg bg-light-iconBg dark:bg-white"
            >
              <Text className="text-xs font-bold text-white dark:text-[#111111]">
                Apply
              </Text>
            </Pressable>
          </View>
        )}

        {/* Editorial Caption Input */}
        <TextInput
          value={imageCaption}
          onChangeText={handleCaptionChange}
          placeholder="Add caption or credit..."
          placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
          className="text-center text-xs text-light-textMuted dark:text-dark-textMuted mt-1.5 py-0.5 italic outline-none"
        />
      </Pressable>

      {/* Fullscreen Lightbox Modal */}
      {isLightboxOpen && (
        <Modal
          visible={isLightboxOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsLightboxOpen(false)}
        >
          <View className="flex-1 bg-black/95 items-center justify-center p-4">
            <Pressable
              onPress={() => setIsLightboxOpen(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md items-center justify-center z-10"
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
      )}
    </View>
  );
};

