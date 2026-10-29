import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, Platform, DimensionValue } from 'react-native';
import { useTheme } from '../../../theme';
import { 
  Play, 
  Video, 
  Link as LinkIcon, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Edit3, 
  Check, 
  X,
  ExternalLink 
} from 'lucide-react-native';

export type VideoWidth = '50%' | '75%' | '100%';
export type VideoAlign = 'left' | 'center' | 'right';

interface VideoBlockProps {
  url?: string;
  caption?: string;
  width?: VideoWidth;
  align?: VideoAlign;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
  onUpdateVideo: (url: string, caption: string, width: VideoWidth, align: VideoAlign) => void;
}

const DEFAULT_VIDEO = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

function getEmbedUrl(rawUrl: string): { embedUrl: string; isEmbeddable: boolean; type: 'youtube' | 'vimeo' | 'loom' | 'direct' } {
  if (!rawUrl) return { embedUrl: '', isEmbeddable: false, type: 'direct' };

  // 1. YouTube
  const ytMatch = rawUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`,
      isEmbeddable: true,
      type: 'youtube',
    };
  }

  // 2. Vimeo
  const vimeoMatch = rawUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      isEmbeddable: true,
      type: 'vimeo',
    };
  }

  // 3. Loom
  const loomMatch = rawUrl.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  if (loomMatch && loomMatch[1]) {
    return {
      embedUrl: `https://www.loom.com/embed/${loomMatch[1]}`,
      isEmbeddable: true,
      type: 'loom',
    };
  }

  // 4. Direct video link (mp4, webm, mov)
  return {
    embedUrl: rawUrl,
    isEmbeddable: /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(rawUrl),
    type: 'direct',
  };
}

export const VideoBlock: React.FC<VideoBlockProps> = ({
  url = DEFAULT_VIDEO,
  caption = '',
  width = '100%',
  align = 'center',
  isSelected = false,
  isDragging = false,
  onFocus,
  onLongPress,
  onStartDrag,
  onEndDrag,
  onDelete,
  onUpdateVideo,
}) => {
  const { isDark } = useTheme();
  const [videoUrl, setVideoUrl] = useState(url);
  const [videoCaption, setVideoCaption] = useState(caption);
  const [currentWidth, setCurrentWidth] = useState<VideoWidth>(width);
  const [currentAlign, setCurrentAlign] = useState<VideoAlign>(align);
  const [isEditingUrl, setIsEditingUrl] = useState(!url || url === '');
  const [urlInput, setUrlInput] = useState(videoUrl);

  const embedInfo = useMemo(() => getEmbedUrl(videoUrl), [videoUrl]);

  const handleSaveUrl = () => {
    const next = urlInput.trim() || DEFAULT_VIDEO;
    setVideoUrl(next);
    setIsEditingUrl(false);
    onUpdateVideo(next, videoCaption, currentWidth, currentAlign);
  };

  const handleCaptionChange = (text: string) => {
    setVideoCaption(text);
    onUpdateVideo(videoUrl, text, currentWidth, currentAlign);
  };

  const handleWidthChange = (w: VideoWidth) => {
    setCurrentWidth(w);
    onUpdateVideo(videoUrl, videoCaption, w, currentAlign);
  };

  const handleAlignChange = (a: VideoAlign) => {
    setCurrentAlign(a);
    onUpdateVideo(videoUrl, videoCaption, currentWidth, a);
  };

  const widthStyle: { width: DimensionValue } = {
    width: currentWidth === '50%' ? '50%' : currentWidth === '75%' ? '75%' : '100%',
  };

  const alignContainerClass =
    currentAlign === 'left' ? 'items-start' : currentAlign === 'right' ? 'items-end' : 'items-center';

  return (
    <View className={`my-2 w-full ${alignContainerClass}`}>
      <Pressable
        onPress={onFocus}
        style={[widthStyle, { borderColor: isSelected ? '#06B6D4' : 'transparent' }]}
        className="relative group rounded-2xl border-2 transition-all"
      >
        {/* Floating Media Toolbar on Selection */}
        {isSelected && (
          <View className="absolute top-2.5 right-2.5 flex-row items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full shadow-lg z-30">
            {/* Width pills */}
            {(['50%', '75%', '100%'] as const).map((w) => (
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

            {/* Alignments */}
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

            {/* Edit URL button */}
            <Pressable
              onPress={() => setIsEditingUrl(true)}
              className="p-1 rounded-full hover:bg-white/20"
              accessibilityLabel="Edit Video Link"
            >
              <LinkIcon size={11} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {/* Video Canvas Container */}
        <View className="w-full aspect-video rounded-2xl overflow-hidden bg-black/10 dark:bg-black/40 border border-light-border dark:border-white/10 relative shadow-sm">
          {Platform.OS === 'web' && embedInfo.isEmbeddable ? (
            embedInfo.type === 'direct' ? (
              <video
                src={embedInfo.embedUrl}
                controls
                className="w-full h-full object-cover"
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <iframe
                src={embedInfo.embedUrl}
                title={videoCaption || 'Embedded Video'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            )
          ) : (
            <View className="w-full h-full items-center justify-center p-6">
              <View className="w-12 h-12 rounded-full bg-note-cyan/20 items-center justify-center mb-2">
                <Play size={22} color="#06B6D4" fill="#06B6D4" />
              </View>
              <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary text-center" numberOfLines={1}>
                {videoUrl}
              </Text>
              <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted mt-1">
                Tap to preview in browser or player
              </Text>
            </View>
          )}
        </View>

        {/* URL Edit Overlay if active */}
        {Boolean(isEditingUrl) ? (
          <View className="mt-2 p-3 rounded-xl bg-light-surface dark:bg-dark-raised border border-light-border dark:border-white/10">
            <View className="flex-row items-center gap-1.5 mb-1.5">
              <Video size={13} color={isDark ? '#8EDCEB' : '#08C4E5'} />
              <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                Video URL (YouTube, Vimeo, Loom, or direct MP4)
              </Text>
            </View>
            <TextInput
              value={urlInput}
              onChangeText={setUrlInput}
              onFocus={onFocus}
              placeholder="Paste video link (https://...)"
              placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
              className="p-2 rounded-lg bg-light-appBg dark:bg-dark-surface border border-light-border dark:border-white/10 text-xs font-mono text-light-textPrimary dark:text-dark-textPrimary mb-2"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View className="flex-row items-center justify-end gap-2">
              <Pressable
                onPress={() => setIsEditingUrl(false)}
                className="px-3 py-1 rounded-full bg-light-appBg dark:bg-dark-surface"
              >
                <Text className="text-xs text-light-textSecondary dark:text-dark-textSecondary">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveUrl}
                className="flex-row items-center gap-1 px-3 py-1 rounded-full bg-light-iconBg dark:bg-white"
              >
                <Check size={12} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2.5} />
                <Text className="text-xs font-bold text-white dark:text-[#111111]">Set Video</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Inline Caption Field */}
        <TextInput
          value={videoCaption}
          onChangeText={handleCaptionChange}
          onFocus={onFocus}
          placeholder="Add video caption or notes..."
          placeholderTextColor={isDark ? '#555555' : '#B5B5B5'}
          className="text-center text-xs text-light-textMuted dark:text-dark-textMuted mt-1.5 py-0"
        />
      </Pressable>
    </View>
  );
};

