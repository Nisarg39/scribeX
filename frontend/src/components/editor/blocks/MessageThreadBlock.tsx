import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Platform } from 'react-native';
import { useTheme } from '../../../theme';
import { 
  Mail, 
  MessageSquare, 
  Send, 
  Plus, 
  Trash2, 
  User, 
  Clock, 
  Hash, 
  Check, 
  CornerDownRight,
  AtSign,
  ChevronDown
} from 'lucide-react-native';

export type MessageChannel = 'email' | 'slack' | 'imessage' | 'telegram' | 'teams';

export interface ThreadMessage {
  id: string;
  sender: string;
  senderEmail?: string;
  timestamp: string;
  content: string;
  isMe?: boolean;
}

export interface MessageThreadBlockMetadata {
  channel?: MessageChannel;
  subject?: string;
  participants?: string[];
  date?: string;
  messages?: ThreadMessage[];
}

interface MessageThreadBlockProps {
  metadata?: MessageThreadBlockMetadata;
  content?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onDelete?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onUpdateThread?: (updates: MessageThreadBlockMetadata) => void;
}

const CHANNELS: MessageChannel[] = ['email', 'slack', 'imessage', 'telegram', 'teams'];

const CHANNEL_CONFIG: Record<MessageChannel, { label: string; icon: any; color: string; bg: string }> = {
  email: { label: 'Email Thread', icon: Mail, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
  slack: { label: 'Slack Capture', icon: Hash, color: '#E01E5A', bg: 'rgba(224, 30, 90, 0.12)' },
  imessage: { label: 'iMessage', icon: MessageSquare, color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.12)' },
  telegram: { label: 'Telegram', icon: Send, color: '#229ED9', bg: 'rgba(34, 158, 217, 0.12)' },
  teams: { label: 'Teams Chat', icon: MessageSquare, color: '#6264A7', bg: 'rgba(98, 100, 167, 0.12)' },
};

const DEFAULT_MESSAGES: ThreadMessage[] = [
  {
    id: 'msg-1',
    sender: 'Sarah Chen',
    senderEmail: 'sarah.chen@acme.corp',
    timestamp: 'Yesterday 10:14 AM',
    content: 'We finished the benchmark on local SQLite replication. Write latency is sub-5ms across all test workloads.',
    isMe: false,
  },
  {
    id: 'msg-2',
    sender: 'Marcus Vance',
    senderEmail: 'marcus@acme.corp',
    timestamp: 'Yesterday 10:28 AM',
    content: 'Excellent. Does that include the full-text search indexing on AST comment projections or just the raw tables?',
    isMe: true,
  },
  {
    id: 'msg-3',
    sender: 'Sarah Chen',
    senderEmail: 'sarah.chen@acme.corp',
    timestamp: 'Yesterday 10:35 AM',
    content: 'Both! LanceDB handles the vector embeddings in the background queue so the main write thread never gets blocked.',
    isMe: false,
  },
];

export const MessageThreadBlock: React.FC<MessageThreadBlockProps> = ({
  metadata,
  content = '',
  isSelected = false,
  isDragging = false,
  onFocus,
  onDelete,
  onStartDrag,
  onUpdateThread,
}) => {
  const { isDark } = useTheme();

  const channel: MessageChannel = metadata?.channel || 'email';
  const subject = metadata?.subject || content || 'Re: ScribeX Local Storage & SQLite Engine Performance';
  const participants = metadata?.participants || ['Sarah Chen', 'Marcus Vance'];
  const date = metadata?.date || 'Oct 28, 2026';
  const messages: ThreadMessage[] = metadata?.messages && metadata.messages.length > 0
    ? metadata.messages
    : DEFAULT_MESSAGES;

  const [localSubject, setLocalSubject] = useState(subject);
  const [localDate, setLocalDate] = useState(date);
  const [replyInput, setReplyInput] = useState('');
  const [isAddingReply, setIsAddingReply] = useState(false);

  const channelInfo = CHANNEL_CONFIG[channel] || CHANNEL_CONFIG.email;
  const ChannelIcon = channelInfo.icon;

  const commitUpdates = (partial: Partial<MessageThreadBlockMetadata>) => {
    onUpdateThread?.({
      channel,
      subject: localSubject,
      participants,
      date: localDate,
      messages,
      ...partial,
    });
  };

  const handleCycleChannel = () => {
    onFocus?.();
    const curIdx = CHANNELS.indexOf(channel);
    const next = CHANNELS[(curIdx + 1) % CHANNELS.length];
    commitUpdates({ channel: next });
  };

  const handleUpdateMessage = (id: string, updates: Partial<ThreadMessage>) => {
    const next = messages.map(m => m.id === id ? { ...m, ...updates } : m);
    commitUpdates({ messages: next });
  };

  const handleDeleteMessage = (id: string) => {
    const next = messages.filter(m => m.id !== id);
    commitUpdates({ messages: next });
  };

  const handleToggleSender = (id: string) => {
    onFocus?.();
    const next = messages.map(m => m.id === id ? { ...m, isMe: !m.isMe } : m);
    commitUpdates({ messages: next });
  };

  const handleAddReply = () => {
    const trimmed = replyInput.trim();
    if (!trimmed) return;
    const newMsg: ThreadMessage = {
      id: `msg-${Date.now()}`,
      sender: 'Me',
      senderEmail: 'user@scribex.local',
      timestamp: 'Just now',
      content: trimmed,
      isMe: true,
    };
    const next = [...messages, newMsg];
    setReplyInput('');
    setIsAddingReply(false);
    commitUpdates({ messages: next });
  };

  const getInitials = (name: string): string => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
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
            ? '#8B5CF6'
            : isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.08)',
          backgroundColor: isDark ? 'rgba(18, 18, 22, 0.7)' : 'rgba(250, 250, 252, 0.9)',
        }}
        className="rounded-2xl border transition-all overflow-hidden p-4"
      >
        {/* Thread Header: Channel Badge, Subject & Actions */}
        <View className="flex-row items-start justify-between gap-3 mb-3 pb-3 border-b border-light-border dark:border-white/5">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1.5 flex-wrap">
              {/* Channel Cycle Pill */}
              <Pressable
                onPress={handleCycleChannel}
                style={{
                  backgroundColor: channelInfo.bg,
                  borderColor: channelInfo.color + '40',
                }}
                className="flex-row items-center gap-1 px-2.5 py-0.5 rounded-full border"
              >
                <ChannelIcon size={11} color={channelInfo.color} />
                <Text style={{ color: channelInfo.color }} className="text-[10px] font-mono font-bold uppercase tracking-wider">
                  {channelInfo.label}
                </Text>
                <ChevronDown size={10} color={channelInfo.color} />
              </Pressable>

              {/* Date / Timestamp Pill */}
              <TextInput
                value={localDate}
                onChangeText={(t) => {
                  setLocalDate(t);
                  commitUpdates({ date: t });
                }}
                onFocus={onFocus}
                placeholder="Date"
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                className="text-[11px] font-mono text-light-textMuted dark:text-dark-textMuted px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/5"
              />

              {/* Participants summary chips */}
              {participants.map((p, i) => (
                <View
                  key={i}
                  className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20"
                >
                  <Text className="text-[10px] font-medium text-violet-400">
                    {p}
                  </Text>
                </View>
              ))}
            </View>

            {/* Subject Line Input */}
            <TextInput
              value={localSubject}
              onChangeText={(t) => {
                setLocalSubject(t);
                commitUpdates({ subject: t });
              }}
              onFocus={onFocus}
              placeholder="Thread Subject or Topic..."
              placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
              className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary py-0.5"
            />
          </View>

          {/* Delete Block */}
          {Boolean(onDelete) && (
            <Pressable
              onPress={onDelete}
              className="p-1.5 rounded-lg active:opacity-70 hover:bg-rose-500/10"
            >
              <Trash2 size={14} color="#EF4444" />
            </Pressable>
          )}
        </View>

        {/* Message Stream with Vertical Thread Guide */}
        <View className="relative pl-3 space-y-3">
          {/* Vertical Guide Line */}
          <View
            style={{
              position: 'absolute',
              left: 5,
              top: 10,
              bottom: 10,
              width: 2,
              backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)',
            }}
          />

          {messages.map((msg) => {
            const isMe = !!msg.isMe;
            const initials = getInitials(msg.sender);

            return (
              <View
                key={msg.id}
                className={`flex-row items-start gap-2.5 my-1.5 relative group ${
                  isMe ? 'pl-4' : ''
                }`}
              >
                {/* Timeline node */}
                <View
                  style={{
                    position: 'absolute',
                    left: isMe ? -27 : -11,
                    top: 10,
                    backgroundColor: isMe ? '#8B5CF6' : isDark ? '#38BDF8' : '#0284C7',
                    width: 6,
                    height: 6,
                  }}
                  className="rounded-full z-10"
                />

                {/* Sender Avatar Initials Chip */}
                <Pressable
                  onPress={() => handleToggleSender(msg.id)}
                  style={{
                    backgroundColor: isMe ? 'rgba(139, 92, 246, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                    borderColor: isMe ? 'rgba(139, 92, 246, 0.4)' : 'rgba(56, 189, 248, 0.3)',
                  }}
                  className="w-7 h-7 rounded-full border items-center justify-center shrink-0 mt-0.5"
                >
                  <Text
                    style={{ color: isMe ? '#C4B5FD' : '#38BDF8' }}
                    className="text-[10px] font-mono font-bold"
                  >
                    {initials}
                  </Text>
                </Pressable>

                {/* Message Bubble Container */}
                <View
                  style={{
                    backgroundColor: isMe
                      ? isDark
                        ? 'rgba(139, 92, 246, 0.08)'
                        : 'rgba(139, 92, 246, 0.05)'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.03)'
                      : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isMe
                      ? 'rgba(139, 92, 246, 0.2)'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.05)',
                  }}
                  className="flex-1 rounded-2xl border p-2.5"
                >
                  {/* Sender metadata row */}
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-row items-center gap-1.5 flex-wrap">
                      <TextInput
                        value={msg.sender}
                        onChangeText={(sender) => handleUpdateMessage(msg.id, { sender })}
                        onFocus={onFocus}
                        className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary p-0"
                      />
                      {Boolean(msg.senderEmail) && (
                        <TextInput
                          value={msg.senderEmail}
                          onChangeText={(senderEmail) => handleUpdateMessage(msg.id, { senderEmail })}
                          onFocus={onFocus}
                          className="text-[10px] font-mono text-light-textMuted dark:text-dark-textMuted p-0"
                        />
                      )}
                    </View>

                    <View className="flex-row items-center gap-2">
                      <TextInput
                        value={msg.timestamp}
                        onChangeText={(timestamp) => handleUpdateMessage(msg.id, { timestamp })}
                        onFocus={onFocus}
                        className="text-[10px] font-mono text-light-textMuted dark:text-dark-textMuted p-0"
                      />

                      {/* Direction toggle badge (Me / Other) */}
                      <Pressable
                        onPress={() => handleToggleSender(msg.id)}
                        className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase ${
                          isMe ? 'bg-violet-500/20 text-violet-300' : 'bg-black/10 dark:bg-white/10 text-muted'
                        }`}
                      >
                        <Text className="text-[9px] text-light-textMuted dark:text-dark-textMuted">
                          {isMe ? 'Me' : 'Reply'}
                        </Text>
                      </Pressable>

                      {/* Delete Message Button */}
                      <Pressable
                        onPress={() => handleDeleteMessage(msg.id)}
                        className="opacity-40 hover:opacity-100 p-0.5 rounded"
                      >
                        <Trash2 size={11} color={isDark ? '#A1A1AA' : '#71717A'} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Message Body Content Input */}
                  <TextInput
                    value={msg.content}
                    onChangeText={(content) => handleUpdateMessage(msg.id, { content })}
                    onFocus={onFocus}
                    multiline
                    placeholder="Message content..."
                    placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                    className="text-xs leading-relaxed text-light-textPrimary dark:text-dark-textPrimary py-0.5"
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* Reply Ingest Box / Composer */}
        {isAddingReply ? (
          <View className="mt-3 pt-3 border-t border-light-border dark:border-white/5 pl-4 flex-row items-start gap-2">
            <View className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 items-center justify-center shrink-0 mt-1">
              <CornerDownRight size={12} color="#8B5CF6" />
            </View>
            <View className="flex-1">
              <TextInput
                value={replyInput}
                onChangeText={setReplyInput}
                onFocus={onFocus}
                placeholder="Type a new response or forwarded message..."
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                multiline
                className="text-xs text-light-textPrimary dark:text-dark-textPrimary p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/10 mb-2"
              />
              <View className="flex-row items-center justify-end gap-2">
                <Pressable
                  onPress={() => {
                    setIsAddingReply(false);
                    setReplyInput('');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5"
                >
                  <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleAddReply}
                  className="px-3 py-1 rounded-lg bg-violet-600 flex-row items-center gap-1"
                >
                  <Send size={11} color="#FFFFFF" />
                  <Text className="text-[11px] font-bold text-white">Post to Thread</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View className="mt-3 pt-2 border-t border-light-border dark:border-white/5 flex-row items-center justify-between">
            <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted font-mono">
              {messages.length} messages in thread • Chronological capture
            </Text>
            <Pressable
              onPress={() => setIsAddingReply(true)}
              className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20"
            >
              <Plus size={11} color="#8B5CF6" />
              <Text className="text-[11px] font-bold text-violet-400">Add Reply</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
};

