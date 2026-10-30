import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Platform, ScrollView } from 'react-native';
import { useTheme } from '../../../theme';
import { 
  Users, 
  Mic, 
  Play, 
  Pause, 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  Clock, 
  Sparkles, 
  ChevronRight,
  ListOrdered,
  FileText,
  UserCheck
} from 'lucide-react-native';

export interface SpeakerTranscriptSegment {
  id: string;
  speaker: string;
  timestamp: string;
  seconds: number;
  text: string;
  color?: string;
}

export interface MeetingActionItem {
  id: string;
  text: string;
  assignee: string;
  checked: boolean;
}

export interface MeetingNotesBlockMetadata {
  title?: string;
  date?: string;
  duration?: string;
  participants?: string[];
  summary?: string;
  decisions?: string[];
  actionItems?: MeetingActionItem[];
  transcript?: SpeakerTranscriptSegment[];
  activeSegmentId?: string;
}

interface MeetingNotesBlockProps {
  metadata?: MeetingNotesBlockMetadata;
  content?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onDelete?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onUpdateMeeting?: (updates: MeetingNotesBlockMetadata) => void;
}

const SPEAKER_COLORS = ['#38BDF8', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899'];

const DEFAULT_PARTICIPANTS = ['Sarah Chen', 'Marcus Vance', 'Elena Rostova'];

const DEFAULT_DECISIONS = [
  'Adopt local SQLite replica architecture for sub-5ms write responsiveness.',
  'Move heavy vector embedding calculations to asynchronous LanceDB worker threads.',
];

const DEFAULT_ACTIONS: MeetingActionItem[] = [
  { id: 'act-1', text: 'Benchmark IndexedDB write latency on Safari & Chrome', assignee: 'Sarah', checked: true },
  { id: 'act-2', text: 'Implement AST round-trip serializer for meeting blocks', assignee: 'Marcus', checked: true },
  { id: 'act-3', text: 'Review conflict resolution heuristics for edge sync', assignee: 'Elena', checked: false },
];

const DEFAULT_TRANSCRIPT: SpeakerTranscriptSegment[] = [
  {
    id: 'seg-1',
    speaker: 'Sarah Chen',
    timestamp: '00:15',
    seconds: 15,
    text: 'Let us confirm the local storage architecture before closing the Q4 sprint.',
    color: '#38BDF8',
  },
  {
    id: 'seg-2',
    speaker: 'Marcus Vance',
    timestamp: '01:20',
    seconds: 80,
    text: 'The sub-5ms local SQLite transactions are passing all regression benchmarks on mobile and web.',
    color: '#8B5CF6',
  },
  {
    id: 'seg-3',
    speaker: 'Elena Rostova',
    timestamp: '03:45',
    seconds: 225,
    text: 'Agreed. Next we integrate the speaker diarization pipeline into universal note exports.',
    color: '#10B981',
  },
];

export const MeetingNotesBlock: React.FC<MeetingNotesBlockProps> = ({
  metadata,
  content = '',
  isSelected = false,
  isDragging = false,
  onFocus,
  onDelete,
  onStartDrag,
  onUpdateMeeting,
}) => {
  const { isDark } = useTheme();

  const title = metadata?.title || content || 'Architecture Review & Sprint Sync';
  const date = metadata?.date || 'Oct 30, 2026 · 10:00 AM';
  const duration = metadata?.duration || '45m';
  const participants = metadata?.participants || DEFAULT_PARTICIPANTS;
  const summary = metadata?.summary || 'Team aligned on offline-first SQLite synchronization with asynchronous background LanceDB indexing for instant notes responsiveness.';
  const decisions = metadata?.decisions || DEFAULT_DECISIONS;
  const actionItems = metadata?.actionItems || DEFAULT_ACTIONS;
  const transcript = metadata?.transcript || DEFAULT_TRANSCRIPT;
  const activeSegmentId = metadata?.activeSegmentId || transcript[0]?.id || '';

  const [localTitle, setLocalTitle] = useState(title);
  const [localDate, setLocalDate] = useState(date);
  const [localSummary, setLocalSummary] = useState(summary);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlaybackSec, setCurrentPlaybackSec] = useState(15);
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'actions'>('summary');
  const [newParticipant, setNewParticipant] = useState('');
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);

  const commitUpdates = (partial: Partial<MeetingNotesBlockMetadata>) => {
    onUpdateMeeting?.({
      title: localTitle,
      date: localDate,
      duration,
      participants,
      summary: localSummary,
      decisions,
      actionItems,
      transcript,
      activeSegmentId,
      ...partial,
    });
  };

  const handleToggleAction = (id: string) => {
    onFocus?.();
    const next = actionItems.map(a => a.id === id ? { ...a, checked: !a.checked } : a);
    commitUpdates({ actionItems: next });
  };

  const handleUpdateAction = (id: string, updates: Partial<MeetingActionItem>) => {
    const next = actionItems.map(a => a.id === id ? { ...a, ...updates } : a);
    commitUpdates({ actionItems: next });
  };

  const handleAddAction = () => {
    onFocus?.();
    const newAct: MeetingActionItem = {
      id: `act-${Date.now()}`,
      text: 'New assigned follow-up item',
      assignee: participants[0] || 'Team',
      checked: false,
    };
    commitUpdates({ actionItems: [...actionItems, newAct] });
  };

  const handleDeleteAction = (id: string) => {
    commitUpdates({ actionItems: actionItems.filter(a => a.id !== id) });
  };

  const handleAddDecision = () => {
    onFocus?.();
    const next = [...decisions, 'New agreed team decision'];
    commitUpdates({ decisions: next });
  };

  const handleUpdateDecision = (index: number, text: string) => {
    const next = [...decisions];
    next[index] = text;
    commitUpdates({ decisions: next });
  };

  const handleDeleteDecision = (index: number) => {
    const next = decisions.filter((_, i) => i !== index);
    commitUpdates({ decisions: next });
  };

  const handleAddTranscriptSegment = () => {
    onFocus?.();
    const last = transcript[transcript.length - 1];
    const nextSec = last ? last.seconds + 60 : 60;
    const m = Math.floor(nextSec / 60);
    const s = Math.floor(nextSec % 60);
    const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    const nextSpeaker = participants[transcript.length % participants.length] || 'Speaker';
    const color = SPEAKER_COLORS[transcript.length % SPEAKER_COLORS.length];

    const newSeg: SpeakerTranscriptSegment = {
      id: `seg-${Date.now()}`,
      speaker: nextSpeaker,
      timestamp: timeStr,
      seconds: nextSec,
      text: 'Transcribed dialogue from meeting participant...',
      color,
    };
    commitUpdates({ transcript: [...transcript, newSeg], activeSegmentId: newSeg.id });
  };

  const handleUpdateSegment = (id: string, updates: Partial<SpeakerTranscriptSegment>) => {
    const next = transcript.map(s => s.id === id ? { ...s, ...updates } : s);
    commitUpdates({ transcript: next });
  };

  const handleDeleteSegment = (id: string) => {
    commitUpdates({ transcript: transcript.filter(s => s.id !== id) });
  };

  const handleAddParticipant = () => {
    const trimmed = newParticipant.trim();
    if (!trimmed) return;
    const next = [...participants, trimmed];
    setNewParticipant('');
    setIsAddingParticipant(false);
    commitUpdates({ participants: next });
  };

  const handleRemoveParticipant = (idx: number) => {
    const next = participants.filter((_, i) => i !== idx);
    commitUpdates({ participants: next });
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
            ? '#38BDF8'
            : isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.08)',
          backgroundColor: isDark ? 'rgba(18, 18, 22, 0.7)' : 'rgba(250, 250, 252, 0.9)',
        }}
        className="rounded-2xl border transition-all overflow-hidden p-4"
      >
        {/* Top Header: Badge, Date, Duration & Actions */}
        <View className="flex-row items-start justify-between gap-3 mb-2 pb-2.5 border-b border-light-border dark:border-white/5">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1.5 flex-wrap">
              {/* Meeting Minutes Badge */}
              <View className="flex-row items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30">
                <Users size={11} color="#38BDF8" />
                <Text className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400">
                  Meeting Minutes
                </Text>
              </View>

              {/* Date & Time pill */}
              <TextInput
                value={localDate}
                onChangeText={(t) => {
                  setLocalDate(t);
                  commitUpdates({ date: t });
                }}
                onFocus={onFocus}
                placeholder="Date & Time"
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                className="text-[11px] font-mono text-light-textMuted dark:text-dark-textMuted px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/5"
              />

              {/* Duration Pill */}
              <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/5">
                <Clock size={10} color={isDark ? '#A1A1AA' : '#71717A'} />
                <Text className="text-[10px] font-mono text-light-textMuted dark:text-dark-textMuted">
                  {duration}
                </Text>
              </View>
            </View>

            {/* Meeting Title Input */}
            <TextInput
              value={localTitle}
              onChangeText={(t) => {
                setLocalTitle(t);
                commitUpdates({ title: t });
              }}
              onFocus={onFocus}
              placeholder="Meeting Title / Topic..."
              placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
              className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary py-0.5"
            />
          </View>

          {/* Delete Block Button */}
          {Boolean(onDelete) && (
            <Pressable
              onPress={onDelete}
              className="p-1.5 rounded-lg hover:bg-rose-500/10"
            >
              <Trash2 size={14} color="#EF4444" />
            </Pressable>
          )}
        </View>

        {/* Participants Row with "+ Add Person" */}
        <View className="flex-row items-center gap-1.5 mb-3 flex-wrap">
          <Text className="text-[10px] uppercase font-bold text-light-textMuted dark:text-dark-textMuted mr-1">
            Attendees:
          </Text>
          {participants.map((p, idx) => {
            const col = SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
            return (
              <View
                key={idx}
                style={{ backgroundColor: col + '18', borderColor: col + '40' }}
                className="flex-row items-center gap-1 px-2 py-0.5 rounded-full border"
              >
                <View style={{ backgroundColor: col }} className="w-1.5 h-1.5 rounded-full" />
                <Text style={{ color: col }} className="text-[11px] font-medium">
                  {p}
                </Text>
                <Pressable onPress={() => handleRemoveParticipant(idx)} className="opacity-60 hover:opacity-100">
                  <Text style={{ color: col }} className="text-[10px] font-bold">×</Text>
                </Pressable>
              </View>
            );
          })}

          {isAddingParticipant ? (
            <View className="flex-row items-center gap-1">
              <TextInput
                value={newParticipant}
                onChangeText={setNewParticipant}
                placeholder="Name..."
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                className="text-xs px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/10"
              />
              <Pressable
                onPress={handleAddParticipant}
                className="px-2 py-0.5 rounded-lg bg-sky-500"
              >
                <Text className="text-[10px] font-bold text-white">Add</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setIsAddingParticipant(true)}
              className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/10"
            >
              <Text className="text-[10px] font-medium text-light-textMuted dark:text-dark-textMuted">
                + Add
              </Text>
            </Pressable>
          )}
        </View>

        {/* Audio Recording / Playback Simulation Bar */}
        <View className="flex-row items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/10 mb-3">
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setIsPlaying(!isPlaying)}
              className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center shadow"
            >
              {isPlaying ? (
                <Pause size={12} color="#FFFFFF" />
              ) : (
                <Play size={12} color="#FFFFFF" />
              )}
            </Pressable>
            <View>
              <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                Meeting Audio Synchronized
              </Text>
              <Text className="text-[10px] font-mono text-light-textMuted dark:text-dark-textMuted">
                00:{currentPlaybackSec.toString().padStart(2, '0')} / {duration} • 3 Speakers diarized
              </Text>
            </View>
          </View>

          {/* Audio Waveform visualization bars */}
          <View className="flex-row items-center gap-1">
            {[12, 20, 16, 24, 8, 18, 14, 22, 10, 19, 15, 23].map((h, i) => (
              <View
                key={i}
                style={{
                  height: isPlaying ? (h * ((i % 3) + 1)) / 3 : h * 0.6,
                  backgroundColor: isPlaying ? '#38BDF8' : isDark ? '#52525B' : '#D1D5DB',
                }}
                className="w-1 rounded-full transition-all"
              />
            ))}
          </View>
        </View>

        {/* Navigation Tabs: Summary | Decisions & Actions | Diarized Transcript */}
        <View className="flex-row items-center gap-2 mb-3 border-b border-light-border dark:border-white/5 pb-2">
          {(['summary', 'actions', 'transcript'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const labels = {
              summary: 'Summary & Decisions',
              actions: `Action Items (${actionItems.filter(a => !a.checked).length} pending)`,
              transcript: `Diarized Transcript (${transcript.length})`,
            };
            return (
              <Pressable
                key={tab}
                onPress={() => {
                  onFocus?.();
                  setActiveTab(tab);
                }}
                style={{
                  backgroundColor: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                  borderColor: isActive ? 'rgba(56, 189, 248, 0.4)' : 'transparent',
                }}
                className="px-2.5 py-1 rounded-lg border"
              >
                <Text
                  style={{ color: isActive ? '#38BDF8' : isDark ? '#A1A1AA' : '#71717A' }}
                  className="text-xs font-bold"
                >
                  {labels[tab]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* TAB 1: Executive Summary & Decisions */}
        {activeTab === 'summary' && (
          <View className="space-y-3">
            {/* Executive Summary */}
            <View>
              <Text className="text-[10px] uppercase font-bold tracking-wider text-light-textMuted dark:text-dark-textMuted mb-1">
                Executive Summary
              </Text>
              <TextInput
                value={localSummary}
                onChangeText={(t) => {
                  setLocalSummary(t);
                  commitUpdates({ summary: t });
                }}
                onFocus={onFocus}
                multiline
                placeholder="High-level meeting takeaway..."
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                className="text-xs leading-relaxed text-light-textPrimary dark:text-dark-textPrimary p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/10"
              />
            </View>

            {/* Decisions Made */}
            <View className="mt-2">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-[10px] uppercase font-bold tracking-wider text-light-textMuted dark:text-dark-textMuted">
                  Decisions Agreed ({decisions.length})
                </Text>
                <Pressable
                  onPress={handleAddDecision}
                  className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20"
                >
                  <Plus size={10} color="#10B981" />
                  <Text className="text-[10px] font-bold text-emerald-400">Add Decision</Text>
                </Pressable>
              </View>

              <View className="space-y-1.5">
                {decisions.map((dec, i) => (
                  <View
                    key={i}
                    className="flex-row items-center gap-2 p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15"
                  >
                    <View className="w-4 h-4 rounded-full bg-emerald-500/20 items-center justify-center">
                      <Text className="text-[10px] font-bold text-emerald-400">✓</Text>
                    </View>
                    <TextInput
                      value={dec}
                      onChangeText={(t) => handleUpdateDecision(i, t)}
                      onFocus={onFocus}
                      className="flex-1 text-xs text-light-textPrimary dark:text-dark-textPrimary p-0"
                    />
                    <Pressable onPress={() => handleDeleteDecision(i)} className="opacity-40 hover:opacity-100">
                      <Trash2 size={12} color="#EF4444" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* TAB 2: Action Items */}
        {activeTab === 'actions' && (
          <View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[10px] uppercase font-bold tracking-wider text-light-textMuted dark:text-dark-textMuted">
                Assigned Action Items
              </Text>
              <Pressable
                onPress={handleAddAction}
                className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20"
              >
                <Plus size={10} color="#38BDF8" />
                <Text className="text-[10px] font-bold text-sky-400">Add Action</Text>
              </Pressable>
            </View>

            <View className="space-y-2">
              {actionItems.map((act) => (
                <View
                  key={act.id}
                  className="flex-row items-center gap-2 p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/10"
                >
                  <Pressable onPress={() => handleToggleAction(act.id)}>
                    {act.checked ? (
                      <CheckSquare size={16} color="#10B981" />
                    ) : (
                      <Square size={16} color={isDark ? '#71717A' : '#A1A1AA'} />
                    )}
                  </Pressable>

                  <TextInput
                    value={act.text}
                    onChangeText={(t) => handleUpdateAction(act.id, { text: t })}
                    onFocus={onFocus}
                    className={`flex-1 text-xs text-light-textPrimary dark:text-dark-textPrimary p-0 ${
                      act.checked ? 'line-through opacity-50' : ''
                    }`}
                  />

                  {/* Assignee Badge Pill */}
                  <TextInput
                    value={act.assignee}
                    onChangeText={(a) => handleUpdateAction(act.id, { assignee: a })}
                    onFocus={onFocus}
                    placeholder="@Assignee"
                    placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                    className="text-[10px] font-bold text-violet-400 px-2 py-0.5 rounded-lg bg-violet-500/10 border border-violet-500/20"
                  />

                  <Pressable onPress={() => handleDeleteAction(act.id)} className="opacity-40 hover:opacity-100">
                    <Trash2 size={12} color="#EF4444" />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* TAB 3: Diarized Speaker Transcript Stream */}
        {activeTab === 'transcript' && (
          <View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[10px] uppercase font-bold tracking-wider text-light-textMuted dark:text-dark-textMuted">
                Speaker Synchronized Transcript
              </Text>
              <Pressable
                onPress={handleAddTranscriptSegment}
                className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20"
              >
                <Plus size={10} color="#38BDF8" />
                <Text className="text-[10px] font-bold text-sky-400">Add Segment</Text>
              </Pressable>
            </View>

            <View className="relative pl-3 space-y-2.5">
              {/* Vertical Guide */}
              <View
                style={{
                  position: 'absolute',
                  left: 4,
                  top: 8,
                  bottom: 8,
                  width: 2,
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                }}
              />

              {transcript.map((seg) => {
                const isActive = seg.id === activeSegmentId;
                const col = seg.color || '#38BDF8';
                return (
                  <View key={seg.id} className="relative pl-3">
                    {/* Node Dot */}
                    <View
                      style={{
                        position: 'absolute',
                        left: -11,
                        top: 6,
                        backgroundColor: col,
                        width: 6,
                        height: 6,
                      }}
                      className="rounded-full"
                    />

                    {/* Segment Header */}
                    <View className="flex-row items-center justify-between mb-1">
                      <View className="flex-row items-center gap-2">
                        <TextInput
                          value={seg.speaker}
                          onChangeText={(s) => handleUpdateSegment(seg.id, { speaker: s })}
                          onFocus={onFocus}
                          style={{ color: col }}
                          className="text-xs font-bold p-0"
                        />
                        <Pressable
                          onPress={() => {
                            onFocus?.();
                            setCurrentPlaybackSec(seg.seconds);
                            commitUpdates({ activeSegmentId: seg.id });
                          }}
                          className="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/5 flex-row items-center gap-0.5"
                        >
                          <Play size={8} color={col} />
                          <Text className="text-[10px] font-mono text-light-textMuted dark:text-dark-textMuted">
                            {seg.timestamp}
                          </Text>
                        </Pressable>
                      </View>

                      <Pressable onPress={() => handleDeleteSegment(seg.id)} className="opacity-40 hover:opacity-100">
                        <Trash2 size={11} color="#EF4444" />
                      </Pressable>
                    </View>

                    {/* Spoken Text */}
                    <TextInput
                      value={seg.text}
                      onChangeText={(text) => handleUpdateSegment(seg.id, { text })}
                      onFocus={onFocus}
                      multiline
                      className="text-xs leading-relaxed text-light-textPrimary dark:text-dark-textPrimary p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/10"
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
};

