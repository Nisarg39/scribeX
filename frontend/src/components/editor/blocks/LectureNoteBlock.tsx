import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, Platform, ScrollView, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../../theme';
import { 
  Play, 
  Video, 
  Clock, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Edit3, 
  Check, 
  Bookmark, 
  Sparkles,
  Layers,
  ChevronRight
} from 'lucide-react-native';

export type CheckpointCategory = 'Concept' | 'Question' | 'Theorem' | 'Exam' | 'Summary';

export interface LectureCheckpoint {
  id: string;
  timestamp: string; // e.g. "02:15"
  seconds: number;   // 135
  note: string;
  category?: CheckpointCategory;
}

export interface LectureNoteBlockMetadata {
  videoUrl?: string;
  title?: string;
  speaker?: string;
  checkpoints?: LectureCheckpoint[];
  activeCheckpointId?: string;
}

interface LectureNoteBlockProps {
  metadata?: LectureNoteBlockMetadata;
  content?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onDelete?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onUpdateLecture?: (updates: LectureNoteBlockMetadata) => void;
}

const CATEGORIES: CheckpointCategory[] = ['Concept', 'Question', 'Theorem', 'Exam', 'Summary'];

const CATEGORY_COLORS: Record<CheckpointCategory, { text: string; bg: string; border: string }> = {
  Concept: { text: '#38BDF8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.25)' },
  Question: { text: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)' },
  Theorem: { text: '#A855F7', bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.25)' },
  Exam: { text: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.25)' },
  Summary: { text: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)' },
};

function parseTimestampToSeconds(ts: string): number {
  if (!ts) return 0;
  const parts = ts.trim().split(':').map(p => parseInt(p, 10) || 0);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

function formatSecondsToTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getEmbedInfo(url: string, startSeconds: number = 0) {
  if (!url) return { embedUrl: '', isYoutube: false };

  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (ytMatch && ytMatch[1]) {
    const startParam = startSeconds > 0 ? `&start=${startSeconds}&autoplay=1` : '';
    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0${startParam}`,
      isYoutube: true,
      videoId: ytMatch[1],
    };
  }

  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}#t=${startSeconds}s`,
      isYoutube: false,
    };
  }

  return { embedUrl: url, isYoutube: false };
}

const DEFAULT_CHECKPOINTS: LectureCheckpoint[] = [
  {
    id: 'cp-1',
    timestamp: '01:15',
    seconds: 75,
    note: 'System model assumptions & network partition failure modes',
    category: 'Concept',
  },
  {
    id: 'cp-2',
    timestamp: '05:40',
    seconds: 340,
    note: 'Raft consensus leader election invariants & heartbeat leases',
    category: 'Theorem',
  },
  {
    id: 'cp-3',
    timestamp: '12:20',
    seconds: 740,
    note: 'Why split-brain is prevented during 3-node quorums',
    category: 'Question',
  },
];

export const LectureNoteBlock: React.FC<LectureNoteBlockProps> = ({
  metadata,
  content = '',
  isSelected = false,
  isDragging = false,
  onFocus,
  onDelete,
  onStartDrag,
  onUpdateLecture,
}) => {
  const { isDark } = useTheme();

  const videoUrl = metadata?.videoUrl || 'https://www.youtube.com/watch?v=R2Cq3ALIazA';
  const title = metadata?.title || content || 'Distributed Consensus & Fault Tolerance';
  const speaker = metadata?.speaker || 'MIT 6.824 · Prof. Robert Morris';
  const checkpoints: LectureCheckpoint[] = metadata?.checkpoints && metadata.checkpoints.length > 0
    ? metadata.checkpoints
    : DEFAULT_CHECKPOINTS;
  
  const [activeCpId, setActiveCpId] = useState<string>(metadata?.activeCheckpointId || checkpoints[0]?.id || '');
  const [activeSeconds, setActiveSeconds] = useState<number>(() => {
    const found = checkpoints.find(c => c.id === activeCpId);
    return found ? found.seconds : 0;
  });

  const [localTitle, setLocalTitle] = useState(title);
  const [localSpeaker, setLocalSpeaker] = useState(speaker);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(videoUrl);

  const embedInfo = useMemo(() => getEmbedInfo(videoUrl, activeSeconds), [videoUrl, activeSeconds]);

  const commitUpdates = (partial: Partial<LectureNoteBlockMetadata>) => {
    onUpdateLecture?.({
      videoUrl,
      title: localTitle,
      speaker: localSpeaker,
      checkpoints,
      activeCheckpointId: activeCpId,
      ...partial,
    });
  };

  const handleSeek = (cp: LectureCheckpoint) => {
    onFocus?.();
    setActiveCpId(cp.id);
    setActiveSeconds(cp.seconds);
    commitUpdates({ activeCheckpointId: cp.id });
  };

  const handleUpdateCheckpoint = (id: string, updates: Partial<LectureCheckpoint>) => {
    const next = checkpoints.map(cp => {
      if (cp.id !== id) return cp;
      const updated = { ...cp, ...updates };
      if (updates.timestamp !== undefined) {
        updated.seconds = parseTimestampToSeconds(updates.timestamp);
      }
      return updated;
    });
    commitUpdates({ checkpoints: next });
  };

  const handleAddCheckpoint = () => {
    onFocus?.();
    const lastSec = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1].seconds + 120 : 60;
    const newCp: LectureCheckpoint = {
      id: `cp-${Date.now()}`,
      timestamp: formatSecondsToTimestamp(lastSec),
      seconds: lastSec,
      note: 'Key insight or checkpoint note',
      category: 'Concept',
    };
    const next = [...checkpoints, newCp];
    setActiveCpId(newCp.id);
    setActiveSeconds(newCp.seconds);
    commitUpdates({ checkpoints: next, activeCheckpointId: newCp.id });
  };

  const handleDeleteCheckpoint = (id: string) => {
    const next = checkpoints.filter(cp => cp.id !== id);
    commitUpdates({ checkpoints: next });
  };

  const handleCycleCategory = (id: string, currentCategory?: CheckpointCategory) => {
    onFocus?.();
    const curIdx = currentCategory ? CATEGORIES.indexOf(currentCategory) : -1;
    const nextCategory = CATEGORIES[(curIdx + 1) % CATEGORIES.length];
    handleUpdateCheckpoint(id, { category: nextCategory });
  };

  const handleSaveUrl = () => {
    const trimmed = urlInput.trim();
    if (trimmed) {
      setIsEditingUrl(false);
      commitUpdates({ videoUrl: trimmed });
    }
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
            ? '#06B6D4'
            : isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.08)',
          backgroundColor: isDark ? 'rgba(18, 18, 22, 0.7)' : 'rgba(250, 250, 252, 0.9)',
        }}
        className="rounded-2xl border transition-all overflow-hidden p-4"
      >
        {/* Top Header: Badge, Title & Speaker */}
        <View className="flex-row items-start justify-between gap-3 mb-3">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1.5 flex-wrap">
              {/* Lecture Badge */}
              <View className="flex-row items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30">
                <Video size={11} color="#06B6D4" />
                <Text className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                  Lecture Note
                </Text>
              </View>

              {/* Speaker / Course pill */}
              <TextInput
                value={localSpeaker}
                onChangeText={(t) => {
                  setLocalSpeaker(t);
                  commitUpdates({ speaker: t });
                }}
                onFocus={onFocus}
                placeholder="Speaker / Course"
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                className="text-[11px] font-medium text-light-textMuted dark:text-dark-textMuted px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/5"
              />
            </View>

            {/* Lecture Title Input */}
            <TextInput
              value={localTitle}
              onChangeText={(t) => {
                setLocalTitle(t);
                commitUpdates({ title: t });
              }}
              onFocus={onFocus}
              placeholder="Lecture or Video Title"
              placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
              className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary py-0.5"
            />
          </View>

          {/* Quick Actions (URL Edit & Delete Block) */}
          <View className="flex-row items-center gap-1">
            <Pressable
              onPress={() => setIsEditingUrl(!isEditingUrl)}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10"
            >
              <Edit3 size={14} color={isDark ? '#A1A1AA' : '#71717A'} />
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

        {/* Video URL Editor Bar */}
        {isEditingUrl && (
          <View className="flex-row items-center gap-2 mb-3 p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/10">
            <TextInput
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="Paste YouTube, Vimeo, or MP4 URL..."
              placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
              className="flex-1 text-xs text-light-textPrimary dark:text-dark-textPrimary font-mono px-2 py-1"
            />
            <Pressable
              onPress={handleSaveUrl}
              className="px-3 py-1 rounded-lg bg-cyan-500 flex-row items-center gap-1"
            >
              <Check size={12} color="#FFFFFF" />
              <Text className="text-[11px] font-bold text-white">Save</Text>
            </Pressable>
          </View>
        )}

        {/* Responsive Content: Video Frame + Timestamp Timeline */}
        <View className="w-full flex-col lg:flex-row gap-4 items-stretch">
          {/* Left: Video Player Embed */}
          <View className="w-full lg:w-[48%] rounded-xl overflow-hidden bg-black/80 aspect-video relative justify-center items-center border border-light-border dark:border-white/10 shadow-inner">
            {Platform.OS === 'web' && embedInfo.embedUrl ? (
              <iframe
                src={embedInfo.embedUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
                title={localTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : Platform.OS !== 'web' && embedInfo.embedUrl ? (
              <View className="w-full h-full relative bg-black">
                <WebView
                  source={{
                    html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"><style>*{margin:0;padding:0;background:#000;overflow:hidden;}iframe{width:100vw;height:100vh;border:0;}</style></head><body><iframe src="${embedInfo.embedUrl}" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></body></html>`,
                    baseUrl: 'https://www.youtube-nocookie.com',
                  }}
                  originWhitelist={['*']}
                  style={{ flex: 1, backgroundColor: '#000000' }}
                  allowsFullscreenVideo
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  javaScriptEnabled
                  domStorageEnabled
                />
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  if (videoUrl) Linking.openURL(videoUrl).catch(() => {});
                }}
                className="items-center justify-center p-6 text-center"
              >
                <View className="w-12 h-12 rounded-full bg-cyan-500/20 items-center justify-center mb-2">
                  <Play size={20} color="#06B6D4" />
                </View>
                <Text className="text-xs font-semibold text-white/80">
                  Video Player ({formatSecondsToTimestamp(activeSeconds)})
                </Text>
                <Text className="text-[10px] text-white/50 text-center mt-1">
                  Click any checkpoint below to seek to timestamp
                </Text>
              </Pressable>
            )}
          </View>

          {/* Right: Interactive Timestamped Notes Timeline */}
          <View className="flex-1 justify-between">
            <View>
              <View className="flex-row items-center justify-between pb-2 mb-2 border-b border-light-border dark:border-white/5">
                <View className="flex-row items-center gap-1.5">
                  <Clock size={12} color={isDark ? '#A1A1AA' : '#71717A'} />
                  <Text className="text-[11px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted">
                    Lecture Checkpoints ({checkpoints.length})
                  </Text>
                </View>
                <Pressable
                  onPress={handleAddCheckpoint}
                  className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 active:opacity-70 hover:bg-cyan-500/20 border border-cyan-500/20"
                >
                  <Plus size={11} color="#06B6D4" />
                  <Text className="text-[10px] font-bold text-cyan-400">Add Mark</Text>
                </Pressable>
              </View>

              {/* Timeline Items */}
              <View className="relative pl-3">
                {/* Vertical Timeline Guide Track */}
                <View
                  style={{
                    position: 'absolute',
                    left: 5,
                    top: 8,
                    bottom: 8,
                    width: 2,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                  }}
                />

                {checkpoints.map((cp, idx) => {
                  const isActive = cp.id === activeCpId;
                  const cat = cp.category || 'Concept';
                  const catStyle = CATEGORY_COLORS[cat];

                  return (
                    <View
                      key={cp.id}
                      className="flex-row items-start gap-2 mb-2.5 relative group"
                    >
                      {/* Timeline Dot Indicator */}
                      <View
                        style={{
                          left: -11,
                          top: 7,
                          backgroundColor: isActive ? '#06B6D4' : isDark ? '#3F3F46' : '#D1D5DB',
                          width: isActive ? 8 : 6,
                          height: isActive ? 8 : 6,
                        }}
                        className="rounded-full absolute z-10"
                      />

                      {/* Timestamp Scrub Pill */}
                      <Pressable
                        onPress={() => handleSeek(cp)}
                        style={{
                          backgroundColor: isActive ? '#06B6D4' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                          borderColor: isActive ? '#06B6D4' : 'transparent',
                        }}
                        className="px-2 py-1 rounded-lg border flex-row items-center gap-1"
                      >
                        <Play size={9} color={isActive ? '#FFFFFF' : '#06B6D4'} fill={isActive ? '#FFFFFF' : '#06B6D4'} />
                        <TextInput
                          value={cp.timestamp}
                          onChangeText={(ts) => handleUpdateCheckpoint(cp.id, { timestamp: ts })}
                          onFocus={onFocus}
                          className={`text-[11px] font-mono font-bold p-0 ${
                            isActive ? 'text-white' : 'text-cyan-500'
                          }`}
                        />
                      </Pressable>

                      {/* Category Pill */}
                      <Pressable
                        onPress={() => handleCycleCategory(cp.id, cp.category)}
                        style={{
                          backgroundColor: catStyle.bg,
                          borderColor: catStyle.border,
                        }}
                        className="px-1.5 py-0.5 rounded border"
                      >
                        <Text style={{ color: catStyle.text }} className="text-[9px] font-bold uppercase">
                          {cat}
                        </Text>
                      </Pressable>

                      {/* Checkpoint Note Text Input */}
                      <View className="flex-1">
                        <TextInput
                          value={cp.note}
                          onChangeText={(note) => handleUpdateCheckpoint(cp.id, { note })}
                          onFocus={onFocus}
                          multiline
                          placeholder="Note or insight at this timestamp..."
                          placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                          className="text-xs text-light-textPrimary dark:text-dark-textPrimary py-0.5 leading-snug"
                        />
                      </View>

                      {/* Delete Checkpoint */}
                      <Pressable
                        onPress={() => handleDeleteCheckpoint(cp.id)}
                        className="opacity-40 hover:opacity-100 p-1 rounded"
                      >
                        <Trash2 size={12} color={isDark ? '#A1A1AA' : '#71717A'} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Bottom Footer Tip */}
            <View className="flex-row items-center justify-between pt-2 border-t border-light-border dark:border-white/5 mt-1">
              <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted font-mono">
                Click timecode to scrub • {checkpoints.length} marks linked
              </Text>
              <Pressable
                onPress={() => {
                  if (!videoUrl) return;
                  if (Platform.OS === 'web') {
                    window.open(videoUrl, '_blank');
                  } else {
                    Linking.openURL(videoUrl).catch(() => {});
                  }
                }}
                className="flex-row items-center gap-1 opacity-70 hover:opacity-100 active:opacity-100"
              >
                <Text className="text-[10px] font-medium text-cyan-500">Source Stream</Text>
                <ExternalLink size={10} color="#06B6D4" />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

