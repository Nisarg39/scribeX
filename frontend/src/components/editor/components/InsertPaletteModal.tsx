import React from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import {
  X,
  Image as ImageIcon,
  Volume2,
  Paperclip,
  Globe,
  Type,
  Heading,
  Quote as QuoteIcon,
  Minus,
  ListTodo,
  Code2,
  Table,
  AlertCircle,
  Sigma,
  PenTool,
  List,
  ListOrdered,
  ListCollapse,
  Video,
  Link2,
  MapPin,
  Flame,
  Kanban,
  Calendar,
  User,
  Receipt,
  BookOpen,
} from 'lucide-react-native';
import { BlockType } from '../../../types/note';
import { useTheme } from '../../../theme';
import { NoteTemplate } from '../../../core/templates/noteTemplates';
import { TemplatePicker } from './TemplatePicker';

interface InsertPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBlockId: string | null;
  onInsertBlock: (type: BlockType, metadata?: Record<string, any>) => void;
  onSelectTemplate?: (template: NoteTemplate) => void;
}

export const InsertPaletteModal: React.FC<InsertPaletteModalProps> = ({
  isOpen,
  onClose,
  activeBlockId,
  onInsertBlock,
  onSelectTemplate,
}) => {
  const { isDark } = useTheme();

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/60 backdrop-blur-sm justify-end md:justify-center items-center p-4"
      >
        <Pressable
          dataSet={{ scribexModal: 'true' }}
          {...({ 'data-scribex-modal': 'true' } as any)}
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-xl rounded-3xl bg-light-surface dark:bg-[#1E1E20] border border-light-border dark:border-white/10 shadow-2xl p-6 overflow-hidden"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between pb-4 border-b border-light-border dark:border-white/10 mb-4">
            <View>
              <Text className="text-lg font-extrabold text-light-textPrimary dark:text-dark-textPrimary">
                Insert Element
              </Text>
              <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                {activeBlockId
                  ? 'Insert immediately after current selection'
                  : 'Insert at the end of the story'}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
              className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 items-center justify-center"
            >
              <X size={16} color={isDark ? '#FFFFFF' : '#111111'} />
            </Pressable>
          </View>

          <ScrollView className="max-h-[460px]" showsVerticalScrollIndicator={false}>
            {/* Category: Media & Rich Embeds */}
            <Text className="text-[11px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2 px-1">
              Media & Rich Embeds
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-5">
              <Pressable
                onPress={() =>
                  onInsertBlock('image', {
                    url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80',
                    caption: '',
                    width: '100%',
                    align: 'center',
                    aspectRatio: 'natural',
                  })
                }
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-sky-500/15 items-center justify-center mb-2">
                  <ImageIcon size={16} color="#0EA5E9" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Image
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  Resizable (33%, 50%, 75%, 100%)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onInsertBlock('audio', { durationSec: 94 })}
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-purple-500/15 items-center justify-center mb-2">
                  <Volume2 size={16} color="#A855F7" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Voice Note
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  Waveform & transcript
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  onInsertBlock('file', { fileName: 'Specification.pdf', sizeBytes: 1845600 })
                }
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-amber-500/15 items-center justify-center mb-2">
                  <Paperclip size={16} color="#F59E0B" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Attachment
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  PDF or file document
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onInsertBlock('bookmark', { url: 'https://reactnative.dev' })}
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-indigo-500/15 items-center justify-center mb-2">
                  <Globe size={16} color="#6366F1" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Web Link
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  Rich bookmark card
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  onInsertBlock('video', {
                    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    caption: '',
                    width: '100%',
                    align: 'center',
                  })
                }
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-red-500/15 items-center justify-center mb-2">
                  <Video size={16} color="#EF4444" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Video Embed
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  YouTube, Vimeo, Loom, MP4
                </Text>
              </Pressable>
            </View>

            {/* Category: Writing & Structure */}
            <Text className="text-[11px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2 px-1">
              Writing & Structure
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-5">
              <Pressable
                onPress={() => onInsertBlock('paragraph')}
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <Type size={16} color={isDark ? '#E5E5E5' : '#171717'} className="mb-2" />
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Paragraph
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onInsertBlock('heading', { level: 1 })}
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <Heading size={16} color={isDark ? '#E5E5E5' : '#171717'} className="mb-2" />
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Heading 1
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onInsertBlock('heading', { level: 2 })}
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <Heading size={14} color={isDark ? '#E5E5E5' : '#171717'} className="mb-2" />
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Heading 2
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onInsertBlock('quote')}
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <QuoteIcon size={16} color="#A78BFA" className="mb-2" />
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Quote
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onInsertBlock('bulleted_list', { items: [''] })}
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <List size={16} color={isDark ? '#E5E5E5' : '#171717'} className="mb-2" />
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Bullet List
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onInsertBlock('numbered_list', { items: [''] })}
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <ListOrdered size={16} color={isDark ? '#E5E5E5' : '#171717'} className="mb-2" />
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Numbered List
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onInsertBlock('toggle', { title: 'Toggle Section', isOpen: true })}
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <ListCollapse size={16} color={isDark ? '#8EDCEB' : '#08C4E5'} className="mb-2" />
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Toggle
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onInsertBlock('divider')}
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <Minus size={16} color={isDark ? '#9CA3AF' : '#6B7280'} className="mb-2" />
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Divider
                </Text>
              </Pressable>
            </View>

            {/* Category: Productivity & Technical */}
            <Text className="text-[11px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2 px-1">
              Productivity & Technical
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              <Pressable
                onPress={() =>
                  onInsertBlock('checklist', {
                    items: [
                      {
                        id: `task-${Date.now()}-1`,
                        text: '',
                        checked: false,
                        priority: 'none',
                        dueDate: 'Today',
                      },
                    ],
                  })
                }
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-emerald-500/15 items-center justify-center mb-2">
                  <ListTodo size={16} color="#10B981" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Checklist Task
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  Syncs with global Tasks
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  onInsertBlock('habit', {
                    title: 'Daily Habit',
                    frequency: 'daily',
                    streak: 0,
                    targetDays: 7,
                    history: {},
                  })
                }
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-amber-500/15 items-center justify-center mb-2">
                  <Flame size={16} color="#F59E0B" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Habit Tracker
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  7-day streak matrix
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  onInsertBlock('kanban', {
                    columns: [
                      { id: 'todo', title: 'To Do', color: '#38BDF8', cardIds: ['k-1'] },
                      { id: 'in_progress', title: 'In Progress', color: '#F59E0B', cardIds: ['k-2'] },
                      { id: 'done', title: 'Done', color: '#10B981', cardIds: ['k-3'] },
                    ],
                    cards: {
                      'k-1': { id: 'k-1', title: 'Action item 1' },
                      'k-2': { id: 'k-2', title: 'Action item 2' },
                      'k-3': { id: 'k-3', title: 'Action item 3' },
                    },
                  })
                }
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-cyan-500/15 items-center justify-center mb-2">
                  <Kanban size={16} color="#06B6D4" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Kanban Board
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  Interactive lane workflow
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onInsertBlock('code', { language: 'typescript' })}
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-cyan-500/15 items-center justify-center mb-2">
                  <Code2 size={16} color="#06B6D4" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Code Block
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  Syntax highlighted
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  onInsertBlock('table', {
                    columns: ['Header 1', 'Header 2'],
                    rows: [['', '']],
                  })
                }
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-blue-500/15 items-center justify-center mb-2">
                  <Table size={16} color="#3B82F6" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Data Table
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  Matrix grid editor
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onInsertBlock('callout', { variant: 'info' })}
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-rose-500/15 items-center justify-center mb-2">
                  <AlertCircle size={16} color="#F43F5E" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Callout
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  Highlighted note box
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onInsertBlock('equation', { displayMode: true })}
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-orange-500/15 items-center justify-center mb-2">
                  <Sigma size={16} color="#F97316" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  LaTeX Formula
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  Math equation
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onInsertBlock('drawing', { paths: [] })}
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-teal-500/15 items-center justify-center mb-2">
                  <PenTool size={16} color="#14B8A6" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Canvas Sketch
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  Hand-drawn sketch
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onInsertBlock('note_link', { targetNoteTitle: 'Link to note' })}
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-cyan-500/15 items-center justify-center mb-2">
                  <Link2 size={16} color="#06B6D4" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Linked Note
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  Bidirectional reference
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  onInsertBlock('location', {
                    placeName: 'Location Checkpoint',
                    address: 'San Francisco, CA',
                    lat: 37.7785,
                    lng: -122.3998,
                  })
                }
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-rose-500/15 items-center justify-center mb-2">
                  <MapPin size={16} color="#F43F5E" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Location Pin
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  Place & coordinates
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  onInsertBlock('event', {
                    title: 'Sprint Review & Sync',
                    startDate: new Date().toISOString().split('T')[0],
                    startTime: '10:00',
                    endTime: '11:00',
                    isAllDay: false,
                    location: 'Room 4B / Zoom',
                    reminder: '15m before',
                  })
                }
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-cyan-500/15 items-center justify-center mb-2">
                  <Calendar size={16} color="#06B6D4" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Event / Calendar
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  Date, time & location
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  onInsertBlock('contact', {
                    name: 'Alex Morgan',
                    role: 'Lead Architect',
                    company: 'Distributed Labs',
                    email: 'alex@example.com',
                    phone: '',
                    notes: '',
                  })
                }
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-purple-500/15 items-center justify-center mb-2">
                  <User size={16} color="#8B5CF6" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Person Profile
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  Contact card & context
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  onInsertBlock('expense', {
                    merchant: 'Server Hosting / SaaS',
                    amount: '49.99',
                    currency: '$',
                    category: 'Tech',
                    date: new Date().toISOString().split('T')[0],
                    status: 'cleared',
                  })
                }
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-emerald-500/15 items-center justify-center mb-2">
                  <Receipt size={16} color="#10B981" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Expense Record
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  Financial receipt & status
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  onInsertBlock('reading', {
                    title: 'Designing Data-Intensive Applications',
                    author: 'Martin Kleppmann',
                    status: 'reading',
                    currentPage: 120,
                    totalPages: 560,
                    rating: 5,
                  })
                }
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : undefined)}
                className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
              >
                <View className="w-8 h-8 rounded-xl bg-sky-500/15 items-center justify-center mb-2">
                  <BookOpen size={16} color="#0284C7" />
                </View>
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Reading Queue
                </Text>
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                  Book progress & ratings
                </Text>
              </Pressable>
            </View>

            {/* Quick Template Scaffolding Section */}
            {Boolean(onSelectTemplate) ? (
              <View className="pt-2 border-t border-light-border dark:border-white/5">
                <TemplatePicker
                  onSelectTemplate={(tpl) => {
                    onSelectTemplate?.(tpl);
                    onClose();
                  }}
                />
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

