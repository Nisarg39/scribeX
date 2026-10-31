import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Platform, ScrollView } from 'react-native';
import { useTheme } from '../../../theme';
import { 
  Globe, 
  ExternalLink, 
  Clock, 
  User, 
  Quote, 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Trash2, 
  Sparkles,
  BookmarkCheck
} from 'lucide-react-native';

export interface WebClipBlockMetadata {
  url?: string;
  title?: string;
  domain?: string;
  author?: string;
  publishedDate?: string;
  readingTime?: string;
  clippedAt?: string;
  highlights?: string[];
  readerContent?: string;
}

interface WebClipBlockProps {
  metadata?: WebClipBlockMetadata;
  content?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onDelete?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onUpdateWebClip?: (updates: WebClipBlockMetadata) => void;
}

const DEFAULT_HIGHLIGHTS = [
  'Sub-5ms write performance is only achievable when avoiding network round-trips entirely on keystrokes.',
  'Local SQLite replicas coupled with asynchronous vector projections deliver unmatched tactile responsiveness.',
];

const DEFAULT_READER_CONTENT = `Modern productivity software has suffered from severe latency bloat as applications transitioned from native desktop executables to cloud-dependent web wrappers.

By implementing an offline-first architecture centered around SQLite compiled to WebAssembly, local state updates achieve instant sub-5ms tactile feedback. Background intake queues asynchronously compute embeddings and sync changes without blocking the primary user interface.`;

export const WebClipBlock: React.FC<WebClipBlockProps> = ({
  metadata,
  content = '',
  isSelected = false,
  isDragging = false,
  onFocus,
  onDelete,
  onStartDrag,
  onUpdateWebClip,
}) => {
  const { isDark } = useTheme();

  const url = metadata?.url || 'https://danluu.com/productivity-velocity/';
  const title = metadata?.title || content || 'Engineering Velocity & Tactile Latency at Scale';
  const domain = metadata?.domain || 'danluu.com';
  const author = metadata?.author || 'Dan Luu';
  const publishedDate = metadata?.publishedDate || 'Oct 2026';
  const readingTime = metadata?.readingTime || '6 min read';
  const highlights = metadata?.highlights && metadata.highlights.length > 0
    ? metadata.highlights
    : DEFAULT_HIGHLIGHTS;
  const readerContent = metadata?.readerContent || DEFAULT_READER_CONTENT;

  const [localTitle, setLocalTitle] = useState(title);
  const [localAuthor, setLocalAuthor] = useState(author);
  const [localReaderContent, setLocalReaderContent] = useState(readerContent);
  const [isReaderExpanded, setIsReaderExpanded] = useState(true);
  const [newHighlight, setNewHighlight] = useState('');
  const [isAddingHighlight, setIsAddingHighlight] = useState(false);

  const commitUpdates = (partial: Partial<WebClipBlockMetadata>) => {
    onUpdateWebClip?.({
      url,
      title: localTitle,
      domain,
      author: localAuthor,
      publishedDate,
      readingTime,
      highlights,
      readerContent: localReaderContent,
      ...partial,
    });
  };

  const handleAddHighlight = () => {
    const trimmed = newHighlight.trim();
    if (!trimmed) return;
    const next = [...highlights, trimmed];
    setNewHighlight('');
    setIsAddingHighlight(false);
    commitUpdates({ highlights: next });
  };

  const handleDeleteHighlight = (idx: number) => {
    const next = highlights.filter((_, i) => i !== idx);
    commitUpdates({ highlights: next });
  };

  const handleUpdateHighlight = (idx: number, text: string) => {
    const next = [...highlights];
    next[idx] = text;
    commitUpdates({ highlights: next });
  };

  return (
    <Pressable
      onPress={onFocus}
      onLongPress={() => onStartDrag?.()}
      delayLongPress={250}
      className="my-3 w-full"
    >
      <View
        style={{
          borderColor: isSelected
            ? '#A855F7'
            : isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.08)',
          backgroundColor: isDark ? 'rgba(18, 18, 22, 0.7)' : 'rgba(250, 250, 252, 0.9)',
        }}
        className="rounded-2xl border transition-all overflow-hidden p-4"
      >
        {/* Header Bar: Domain, Byline, Reading Time & Source Link */}
        <View className="flex-row items-start justify-between gap-3 mb-2.5 pb-2.5 border-b border-light-border dark:border-white/5">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1.5 flex-wrap">
              {/* Web Clip Badge */}
              <View className="flex-row items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30">
                <BookmarkCheck size={11} color="#A855F7" />
                <Text className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400">
                  Web Article Clip
                </Text>
              </View>

              {/* Domain Pill */}
              <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/5">
                <Globe size={10} color={isDark ? '#A1A1AA' : '#71717A'} />
                <Text className="text-[10px] font-mono text-light-textMuted dark:text-dark-textMuted">
                  {domain}
                </Text>
              </View>

              {/* Author Byline */}
              <TextInput
                value={localAuthor}
                onChangeText={(a) => {
                  setLocalAuthor(a);
                  commitUpdates({ author: a });
                }}
                onFocus={onFocus}
                placeholder="Author Byline"
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                className="text-[11px] text-light-textMuted dark:text-dark-textMuted px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/5"
              />

              {/* Reading Time */}
              <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/5">
                <Clock size={10} color={isDark ? '#A1A1AA' : '#71717A'} />
                <Text className="text-[10px] font-mono text-light-textMuted dark:text-dark-textMuted">
                  {readingTime}
                </Text>
              </View>
            </View>

            {/* Article Headline */}
            <TextInput
              value={localTitle}
              onChangeText={(t) => {
                setLocalTitle(t);
                commitUpdates({ title: t });
              }}
              onFocus={onFocus}
              placeholder="Article Headline..."
              placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
              className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary py-0.5"
            />
          </View>

          {/* Source Link & Delete */}
          <View className="flex-row items-center gap-1">
            <Pressable
              onPress={() => {
                if (Platform.OS === 'web' && url) {
                  window.open(url, '_blank');
                }
              }}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10"
            >
              <ExternalLink size={14} color="#A855F7" />
            </Pressable>
            {Boolean(onDelete) && (
              <Pressable
                onPress={onDelete}
                className="p-1.5 rounded-lg active:opacity-70 hover:bg-rose-500/10"
              >
                <Trash2 size={14} color="#EF4444" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Highlighted Quote Excerpts */}
        <View className="mb-3">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-1.5">
              <Quote size={11} color="#A855F7" />
              <Text className="text-[10px] uppercase font-bold tracking-wider text-light-textMuted dark:text-dark-textMuted">
                Selected Clippings & Highlights ({highlights.length})
              </Text>
            </View>
            <Pressable
              onPress={() => setIsAddingHighlight(true)}
              className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20"
            >
              <Plus size={10} color="#A855F7" />
              <Text className="text-[10px] font-bold text-purple-400">Add Quote</Text>
            </Pressable>
          </View>

          <View className="space-y-2">
            {highlights.map((hl, i) => (
              <View
                key={i}
                className="flex-row items-start gap-2 p-2.5 rounded-xl bg-purple-500/5 border-l-2 border-purple-500 border-t border-r border-b border-light-border dark:border-white/5"
              >
                <TextInput
                  value={hl}
                  onChangeText={(t) => handleUpdateHighlight(i, t)}
                  onFocus={onFocus}
                  multiline
                  className="flex-1 text-xs italic text-light-textPrimary dark:text-dark-textPrimary p-0 leading-relaxed"
                />
                <Pressable onPress={() => handleDeleteHighlight(i)} className="opacity-40 hover:opacity-100 mt-0.5">
                  <Trash2 size={11} color="#EF4444" />
                </Pressable>
              </View>
            ))}

            {isAddingHighlight && (
              <View className="p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/10">
                <TextInput
                  value={newHighlight}
                  onChangeText={setNewHighlight}
                  placeholder="Paste or type captured quotation..."
                  placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                  multiline
                  className="text-xs text-light-textPrimary dark:text-dark-textPrimary mb-2"
                />
                <View className="flex-row items-center justify-end gap-2">
                  <Pressable onPress={() => setIsAddingHighlight(false)} className="px-2 py-0.5 rounded">
                    <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleAddHighlight} className="px-2.5 py-0.5 rounded-lg bg-purple-600">
                    <Text className="text-[10px] font-bold text-white">Save Highlight</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Reader Mode Content Drawer */}
        <View className="border-t border-light-border dark:border-white/5 pt-2">
          <Pressable
            onPress={() => setIsReaderExpanded(!isReaderExpanded)}
            className="flex-row items-center justify-between py-1"
          >
            <View className="flex-row items-center gap-1.5">
              <BookOpen size={12} color={isDark ? '#A1A1AA' : '#71717A'} />
              <Text className="text-[11px] font-bold text-light-textPrimary dark:text-dark-textPrimary">
                Sanitized Reader Content
              </Text>
            </View>
            {isReaderExpanded ? (
              <ChevronUp size={14} color={isDark ? '#A1A1AA' : '#71717A'} />
            ) : (
              <ChevronDown size={14} color={isDark ? '#A1A1AA' : '#71717A'} />
            )}
          </Pressable>

          {isReaderExpanded && (
            <TextInput
              value={localReaderContent}
              onChangeText={(rc) => {
                setLocalReaderContent(rc);
                commitUpdates({ readerContent: rc });
              }}
              onFocus={onFocus}
              multiline
              placeholder="Sanitized article content..."
              placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
              className="mt-2 text-xs leading-relaxed text-light-textPrimary dark:text-dark-textPrimary p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/10 font-sans"
            />
          )}
        </View>
      </View>
    </Pressable>
  );
};

