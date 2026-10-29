import React from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import {
  Type,
  Heading,
  Quote as QuoteIcon,
  Minus,
  List,
  ListOrdered,
  ListTodo,
  ListCollapse,
  Code2,
  Table,
  Sigma,
  AlertCircle,
  Image as ImageIcon,
  Video,
  Volume2,
  Paperclip,
  Globe,
  Link2,
  MapPin,
  PenTool,
} from 'lucide-react-native';
import { BlockType } from '../../../types/note';
import { useTheme } from '../../../theme';

export interface SlashCommandDefinition {
  id: string;
  title: string;
  description: string;
  category: 'Typography' | 'Lists & Tasks' | 'Data & Math' | 'Media & Embeds' | 'Vault & Context';
  shortcut: string;
  blockType: BlockType;
  defaultMetadata?: Record<string, any>;
  keywords: string[];
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  accentColor: string;
  accentBg: string;
}

export const SLASH_COMMANDS: SlashCommandDefinition[] = [
  // 1. Typography
  {
    id: 'paragraph',
    title: 'Text',
    description: 'Plain body text paragraph',
    category: 'Typography',
    shortcut: '/text',
    blockType: 'paragraph',
    keywords: ['text', 'paragraph', 'plain', 'p', 'body'],
    icon: Type,
    accentColor: '#06B6D4',
    accentBg: 'rgba(6, 182, 212, 0.12)',
  },
  {
    id: 'h1',
    title: 'Heading 1',
    description: 'Large primary section heading',
    category: 'Typography',
    shortcut: '/h1',
    blockType: 'heading',
    defaultMetadata: { level: 1 },
    keywords: ['heading 1', 'h1', 'title', 'large', 'header'],
    icon: Heading,
    accentColor: '#08C4E5',
    accentBg: 'rgba(8, 196, 229, 0.12)',
  },
  {
    id: 'h2',
    title: 'Heading 2',
    description: 'Medium subsection heading',
    category: 'Typography',
    shortcut: '/h2',
    blockType: 'heading',
    defaultMetadata: { level: 2 },
    keywords: ['heading 2', 'h2', 'subtitle', 'medium'],
    icon: Heading,
    accentColor: '#38BDF8',
    accentBg: 'rgba(56, 189, 248, 0.12)',
  },
  {
    id: 'h3',
    title: 'Heading 3',
    description: 'Small subsection heading',
    category: 'Typography',
    shortcut: '/h3',
    blockType: 'heading',
    defaultMetadata: { level: 3 },
    keywords: ['heading 3', 'h3', 'small', 'sub'],
    icon: Heading,
    accentColor: '#818CF8',
    accentBg: 'rgba(129, 140, 248, 0.12)',
  },
  {
    id: 'quote',
    title: 'Quote',
    description: 'Capture a standout quote or excerpt',
    category: 'Typography',
    shortcut: '/quote',
    blockType: 'quote',
    keywords: ['quote', 'blockquote', 'cite', 'callout'],
    icon: QuoteIcon,
    accentColor: '#F59E0B',
    accentBg: 'rgba(245, 158, 11, 0.12)',
  },
  {
    id: 'divider',
    title: 'Divider',
    description: 'Visual horizontal section separator',
    category: 'Typography',
    shortcut: '/divider',
    blockType: 'divider',
    keywords: ['divider', 'line', 'separator', 'hr', 'rule'],
    icon: Minus,
    accentColor: '#9CA3AF',
    accentBg: 'rgba(156, 163, 175, 0.12)',
  },

  // 2. Lists & Tasks
  {
    id: 'checklist',
    title: 'To-Do Checklist',
    description: 'Interactive checklist with completion toggle',
    category: 'Lists & Tasks',
    shortcut: '/todo',
    blockType: 'checklist',
    defaultMetadata: {
      items: [
        {
          id: `task-${Date.now()}-1`,
          text: '',
          checked: false,
          priority: 'none',
          dueDate: 'Today',
          style: 'paragraph',
        },
      ],
    },
    keywords: ['todo', 'checklist', 'task', 'check', 'action'],
    icon: ListTodo,
    accentColor: '#10B981',
    accentBg: 'rgba(16, 185, 129, 0.12)',
  },
  {
    id: 'bulleted_list',
    title: 'Bulleted List',
    description: 'Unordered list with bullet points',
    category: 'Lists & Tasks',
    shortcut: '/bullet',
    blockType: 'bulleted_list',
    defaultMetadata: {
      items: [{ id: `bullet-${Date.now()}-1`, text: '' }],
    },
    keywords: ['bullet', 'bulleted', 'list', 'ul', 'unordered'],
    icon: List,
    accentColor: '#14B8A6',
    accentBg: 'rgba(20, 184, 166, 0.12)',
  },
  {
    id: 'numbered_list',
    title: 'Numbered List',
    description: 'Ordered procedural steps with auto-indexing',
    category: 'Lists & Tasks',
    shortcut: '/numbered',
    blockType: 'numbered_list',
    defaultMetadata: {
      items: [{ id: `num-${Date.now()}-1`, text: '' }],
    },
    keywords: ['numbered', 'ordered', 'list', 'ol', 'steps', '1'],
    icon: ListOrdered,
    accentColor: '#06B6D4',
    accentBg: 'rgba(6, 182, 212, 0.12)',
  },
  {
    id: 'toggle',
    title: 'Toggle Section',
    description: 'Collapsible accordion block for details',
    category: 'Lists & Tasks',
    shortcut: '/toggle',
    blockType: 'toggle',
    defaultMetadata: {
      title: 'Toggle Section',
      isOpen: true,
    },
    keywords: ['toggle', 'accordion', 'collapse', 'details', 'hide'],
    icon: ListCollapse,
    accentColor: '#8B5CF6',
    accentBg: 'rgba(139, 92, 246, 0.12)',
  },

  // 3. Data & Math
  {
    id: 'code',
    title: 'Code Snippet',
    description: 'Monospace code block with syntax detection',
    category: 'Data & Math',
    shortcut: '/code',
    blockType: 'code',
    defaultMetadata: {
      language: 'typescript',
      fileName: '',
    },
    keywords: ['code', 'snippet', 'syntax', 'programming', 'developer', 'js', 'ts'],
    icon: Code2,
    accentColor: '#3B82F6',
    accentBg: 'rgba(59, 130, 246, 0.12)',
  },
  {
    id: 'table',
    title: 'Table Grid',
    description: 'Editable spreadsheet grid with rows and columns',
    category: 'Data & Math',
    shortcut: '/table',
    blockType: 'table',
    defaultMetadata: {
      columns: ['Header 1', 'Header 2'],
      rows: [['', '']],
    },
    keywords: ['table', 'grid', 'spreadsheet', 'data', 'matrix', 'columns'],
    icon: Table,
    accentColor: '#EC4899',
    accentBg: 'rgba(236, 72, 153, 0.12)',
  },
  {
    id: 'equation',
    title: 'Math Equation',
    description: 'LaTeX mathematical formula with live symbols',
    category: 'Data & Math',
    shortcut: '/math',
    blockType: 'equation',
    defaultMetadata: {
      displayMode: true,
    },
    keywords: ['math', 'equation', 'latex', 'formula', 'algebra', 'kaTeX'],
    icon: Sigma,
    accentColor: '#A855F7',
    accentBg: 'rgba(168, 85, 247, 0.12)',
  },
  {
    id: 'callout',
    title: 'Callout Box',
    description: 'Highlighted notice, tip, or warning',
    category: 'Data & Math',
    shortcut: '/callout',
    blockType: 'callout',
    defaultMetadata: {
      variant: 'info',
    },
    keywords: ['callout', 'alert', 'notice', 'tip', 'warning', 'info'],
    icon: AlertCircle,
    accentColor: '#0EA5E9',
    accentBg: 'rgba(14, 165, 233, 0.12)',
  },

  // 4. Media & Embeds
  {
    id: 'image',
    title: 'Image Embed',
    description: 'Visual image with scaling & caption controls',
    category: 'Media & Embeds',
    shortcut: '/image',
    blockType: 'image',
    defaultMetadata: {
      url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80',
      caption: '',
      width: '100%',
      align: 'center',
      aspectRatio: 'natural',
    },
    keywords: ['image', 'photo', 'picture', 'upload', 'embed'],
    icon: ImageIcon,
    accentColor: '#0EA5E9',
    accentBg: 'rgba(14, 165, 233, 0.12)',
  },
  {
    id: 'video',
    title: 'Video Embed',
    description: 'YouTube, Vimeo, Loom or direct MP4/WebM',
    category: 'Media & Embeds',
    shortcut: '/video',
    blockType: 'video',
    defaultMetadata: {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      caption: '',
      width: '100%',
      align: 'center',
      aspectRatio: '16:9',
    },
    keywords: ['video', 'youtube', 'loom', 'vimeo', 'mp4', 'player'],
    icon: Video,
    accentColor: '#EF4444',
    accentBg: 'rgba(239, 68, 68, 0.12)',
  },
  {
    id: 'audio',
    title: 'Voice Recording',
    description: 'Voice memo with audio player & transcript',
    category: 'Media & Embeds',
    shortcut: '/audio',
    blockType: 'audio',
    defaultMetadata: {
      durationSec: 94,
    },
    keywords: ['audio', 'voice', 'sound', 'recording', 'memo', 'podcast'],
    icon: Volume2,
    accentColor: '#A855F7',
    accentBg: 'rgba(168, 85, 247, 0.12)',
  },
  {
    id: 'file',
    title: 'File Attachment',
    description: 'PDF, specification, or document download',
    category: 'Media & Embeds',
    shortcut: '/file',
    blockType: 'file',
    defaultMetadata: {
      fileName: 'Document.pdf',
      sizeBytes: 1024000,
    },
    keywords: ['file', 'attachment', 'pdf', 'document', 'download'],
    icon: Paperclip,
    accentColor: '#F59E0B',
    accentBg: 'rgba(245, 158, 11, 0.12)',
  },
  {
    id: 'bookmark',
    title: 'Web Bookmark',
    description: 'Rich bookmark with OpenGraph title & favicon',
    category: 'Media & Embeds',
    shortcut: '/bookmark',
    blockType: 'bookmark',
    defaultMetadata: {
      url: 'https://reactnative.dev',
      title: 'React Native · Learn once, write anywhere',
      description: 'A framework for building native applications using React.',
    },
    keywords: ['bookmark', 'link', 'url', 'web', 'page'],
    icon: Globe,
    accentColor: '#6366F1',
    accentBg: 'rgba(99, 102, 241, 0.12)',
  },

  // 5. Vault & Context
  {
    id: 'note_link',
    title: 'Linked Note',
    description: 'Bidirectional reference connecting notes in vault',
    category: 'Vault & Context',
    shortcut: '/link',
    blockType: 'note_link',
    defaultMetadata: {
      targetNoteId: '',
      targetNoteTitle: '',
    },
    keywords: ['link', 'note', 'backlink', 'relation', 'vault', 'graph'],
    icon: Link2,
    accentColor: '#06B6D4',
    accentBg: 'rgba(6, 182, 212, 0.12)',
  },
  {
    id: 'location',
    title: 'Location Checkpoint',
    description: 'Geographic place name, street address & GPS',
    category: 'Vault & Context',
    shortcut: '/location',
    blockType: 'location',
    defaultMetadata: {
      placeName: 'San Francisco, CA',
      address: 'Market St, San Francisco, CA 94103',
      lat: 37.7749,
      lng: -122.4194,
    },
    keywords: ['location', 'place', 'map', 'gps', 'geo', 'address'],
    icon: MapPin,
    accentColor: '#10B981',
    accentBg: 'rgba(16, 185, 129, 0.12)',
  },
  {
    id: 'drawing',
    title: 'Drawing Canvas',
    description: 'Vector-based freehand sketch pad',
    category: 'Vault & Context',
    shortcut: '/drawing',
    blockType: 'drawing',
    keywords: ['drawing', 'sketch', 'paint', 'canvas', 'doodle'],
    icon: PenTool,
    accentColor: '#F43F5E',
    accentBg: 'rgba(244, 63, 94, 0.12)',
  },
];

interface SlashCommandPaletteProps {
  query: string;
  selectedIndex: number;
  onSelect: (cmd: SlashCommandDefinition) => void;
  onHoverIndex?: (index: number) => void;
}

export const SlashCommandPalette: React.FC<SlashCommandPaletteProps> = ({
  query,
  selectedIndex,
  onSelect,
  onHoverIndex,
}) => {
  const { isDark } = useTheme();

  const filteredCommands = React.useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter((cmd) => {
      return (
        cmd.title.toLowerCase().includes(clean) ||
        cmd.shortcut.toLowerCase().includes(clean) ||
        cmd.category.toLowerCase().includes(clean) ||
        cmd.keywords.some((k) => k.toLowerCase().includes(clean))
      );
    });
  }, [query]);

  if (filteredCommands.length === 0) {
    return (
      <View
        style={{
          backgroundColor: isDark ? 'rgba(20, 20, 22, 0.96)' : 'rgba(255, 255, 255, 0.96)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        }}
        className="mt-2 p-3 rounded-2xl border shadow-xl w-full max-w-md select-none"
      >
        <Text className="text-xs text-light-textMuted dark:text-dark-textMuted italic">
          No matching block for &ldquo;/{query}&rdquo;
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: isDark ? 'rgba(22, 22, 24, 0.96)' : 'rgba(255, 255, 255, 0.97)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.4 : 0.15,
        shadowRadius: 20,
      }}
      className="mt-2 w-full max-w-lg rounded-2xl border overflow-hidden z-30 select-none backdrop-blur-xl"
    >
      {/* Palette Top Info Bar */}
      <View
        style={{
          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
        }}
        className="flex-row items-center justify-between px-3 py-1.5 border-b"
      >
        <Text className="text-[10px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted">
          Insert Block • {filteredCommands.length} Options
        </Text>
        <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted hidden sm:flex">
          ↑ ↓ to navigate • Enter to pick • Esc to exit
        </Text>
      </View>

      {/* Commands Scroll List */}
      <ScrollView
        className="max-h-64"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        {filteredCommands.map((cmd, idx) => {
          const isSelected = idx === selectedIndex;
          const IconComponent = cmd.icon;

          return (
            <Pressable
              key={cmd.id}
              onPress={() => onSelect(cmd)}
              onHoverIn={() => onHoverIndex?.(idx)}
              {...(Platform.OS === 'web'
                ? ({
                    onMouseDown: (e: any) => e.preventDefault(),
                  } as any)
                : {})}
              style={[
                {
                  backgroundColor: isSelected
                    ? isDark
                      ? 'rgba(6, 182, 212, 0.12)'
                      : 'rgba(6, 182, 212, 0.08)'
                    : 'transparent',
                  borderLeftWidth: 3,
                  borderLeftColor: isSelected ? '#06B6D4' : 'transparent',
                },
              ]}
              className="flex-row items-center justify-between px-3 py-2 transition-colors cursor-pointer group"
            >
              <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                {/* Accent Icon Container */}
                <View
                  style={{ backgroundColor: cmd.accentBg }}
                  className="w-7 h-7 rounded-lg items-center justify-center flex-shrink-0"
                >
                  <IconComponent size={14} color={cmd.accentColor} strokeWidth={2} />
                </View>

                {/* Title & Description */}
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text
                      className={`text-xs font-bold ${
                        isSelected
                          ? 'text-note-cyan'
                          : 'text-light-textPrimary dark:text-dark-textPrimary'
                      }`}
                    >
                      {cmd.title}
                    </Text>
                    <Text className="text-[9px] font-semibold text-light-textMuted dark:text-dark-textMuted uppercase opacity-60">
                      {cmd.category}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    className="text-[10px] text-light-textSecondary dark:text-dark-textSecondary"
                  >
                    {cmd.description}
                  </Text>
                </View>
              </View>

              {/* Shortcut Tag */}
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                }}
                className="px-1.5 py-0.5 rounded font-mono"
              >
                <Text className="text-[10px] font-mono text-light-textMuted dark:text-dark-textMuted">
                  {cmd.shortcut}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

