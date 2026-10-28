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
} from 'lucide-react-native';
import { BlockType } from '../../../types/note';
import { useTheme } from '../../../theme';

interface InsertPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBlockId: string | null;
  onInsertBlock: (type: BlockType, metadata?: Record<string, any>) => void;
}

export const InsertPaletteModal: React.FC<InsertPaletteModalProps> = ({
  isOpen,
  onClose,
  activeBlockId,
  onInsertBlock,
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
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

