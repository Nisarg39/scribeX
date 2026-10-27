import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal } from 'react-native';
import { NoteItem, ComposableBlock, BlockType } from '../../types/note';
import { useTheme, NoteColors, NoteColorToken } from '../../theme';
import { BlockRenderer } from './BlockRenderer';
import { notesRepo } from '../../db/notesRepo';
import { tasksRepo } from '../../db/tasksRepo';
import { useNotesStore } from '../../state/useNotesStore';
import { serializeBlocksToMarkdown, coalesceChecklistBlocks } from '../../core/astSerializer';
import { 
  ArrowLeft, 
  Star, 
  Trash2, 
  Plus, 
  Check, 
  Folder,
  Pin,
  Heading,
  ListTodo,
  Code2,
  Quote as QuoteIcon,
  Minus,
  Table,
  AlertCircle,
  Sigma,
  PenTool,
  Volume2,
  Image as ImageIcon,
  Paperclip,
  Globe,
  ChevronUp,
  ChevronDown,
  X,
  Type
} from 'lucide-react-native';

interface BlockEditorProps {
  note: NoteItem;
  onClose: () => void;
  onNoteUpdated: (updated: NoteItem) => void;
  onNoteDeleted: (noteId: string) => void;
}

const PASTEL_PALETTE: NoteColorToken[] = [
  'lime',
  'apricot',
  'cyan',
  'coral',
  'lavender',
  'pink',
  'sky',
];

export const BlockEditor: React.FC<BlockEditorProps> = ({
  note,
  onClose,
  onNoteUpdated,
  onNoteDeleted,
}) => {
  const { isDark } = useTheme();
  const { refreshFromDB } = useNotesStore();

  const [title, setTitle] = useState(note.title);
  const [colorToken, setColorToken] = useState<NoteColorToken>(note.colorToken);
  const [isFavorite, setIsFavorite] = useState(note.isFavorite);
  const [isPinned, setIsPinned] = useState(note.isPinned);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isInsertPaletteOpen, setIsInsertPaletteOpen] = useState(false);
  const [blocks, setBlocks] = useState<ComposableBlock[]>(() => {
    const rawBlocks: ComposableBlock[] = note.blocks && note.blocks.length > 0
      ? note.blocks
      : [{ id: `b-${Date.now()}-1`, type: 'paragraph', content: note.contentMarkdown || '' }];
    return coalesceChecklistBlocks(rawBlocks);
  });

  // Save changes to SQLite / Repository
  const persistChanges = async (
    newTitle: string = title,
    newColor: NoteColorToken = colorToken,
    newBlocks: ComposableBlock[] = blocks,
    newFav: boolean = isFavorite,
    newPin: boolean = isPinned
  ) => {
    try {
      const contentMarkdown = serializeBlocksToMarkdown(newBlocks);
      const updated = await notesRepo.updateNote(note.id, {
        title: newTitle.trim() || 'Untitled Note',
        colorToken: newColor,
        blocks: newBlocks,
        contentMarkdown,
        isFavorite: newFav,
        isPinned: newPin,
      });
      onNoteUpdated(updated);

      // Sync embedded checklists with global tasks table
      const checklistItems: any[] = [];
      newBlocks.forEach((b) => {
        if (b.type === 'checklist') {
          if (Array.isArray(b.metadata?.items)) {
            b.metadata.items.forEach((item: any) => {
              if (item.text && item.text.trim()) {
                checklistItems.push({
                  id: item.id,
                  text: item.text,
                  checked: !!item.checked,
                  priority: item.priority || 'none',
                  dueDate: item.dueDate || 'Today',
                });
              }
            });
          } else if (b.content && b.content.trim()) {
            checklistItems.push({
              id: b.metadata?.taskId || b.id,
              text: b.content,
              checked: !!b.metadata?.checked,
              priority: b.metadata?.priority || 'none',
              dueDate: b.metadata?.dueDate || 'Today',
            });
          }
        }
      });

      tasksRepo.syncNoteChecklists(note.id, newTitle, newColor, checklistItems)
        .then(() => refreshFromDB())
        .catch((err) => console.warn('Failed to sync note checklists to tasksRepo:', err));
    } catch (err) {
      console.warn('Failed to persist note changes in BlockEditor:', err);
    }
  };

  // Block Mutation Helpers
  const handleUpdateBlock = (blockId: string, updates: Partial<ComposableBlock>) => {
    setBlocks((prevBlocks) => {
      const nextBlocks = prevBlocks.map((b) =>
        b.id === blockId ? { ...b, ...updates } : b
      );
      persistChanges(title, colorToken, nextBlocks);
      return nextBlocks;
    });
  };

  const handleUpdateContent = (blockId: string, content: string) => {
    setBlocks((prevBlocks) => {
      const nextBlocks = prevBlocks.map((b) => (b.id === blockId ? { ...b, content } : b));
      persistChanges(title, colorToken, nextBlocks);
      return nextBlocks;
    });
  };

  const handleUpdateMetadata = (blockId: string, metadata: Record<string, any>) => {
    setBlocks((prevBlocks) => {
      const nextBlocks = prevBlocks.map((b) =>
        b.id === blockId ? { ...b, metadata: { ...b.metadata, ...metadata } } : b
      );
      persistChanges(title, colorToken, nextBlocks);
      return nextBlocks;
    });
  };

  const handleChangeType = (blockId: string, type: BlockType) => {
    setBlocks((prevBlocks) => {
      const nextBlocks = prevBlocks.map((b) => (b.id === blockId ? { ...b, type } : b));
      persistChanges(title, colorToken, nextBlocks);
      return nextBlocks;
    });
  };

  const handleDeleteBlock = (blockId: string) => {
    if (blocks.length <= 1) {
      // Keep at least one empty block
      const emptyBlock: ComposableBlock[] = [{ id: `b-${Date.now()}`, type: 'paragraph', content: '' }];
      setBlocks(emptyBlock);
      setActiveBlockId(emptyBlock[0].id);
      persistChanges(title, colorToken, emptyBlock);
      return;
    }
    const nextBlocks = blocks.filter((b) => b.id !== blockId);
    setBlocks(nextBlocks);
    if (activeBlockId === blockId) {
      setActiveBlockId(null);
    }
    persistChanges(title, colorToken, nextBlocks);
  };

  // Inserts a new block immediately below the active block (or at the bottom if none)
  const handleInsertBlock = (type: BlockType, metadata?: Record<string, any>) => {
    const newBlock: ComposableBlock = {
      id: `b-${Date.now()}-${blocks.length + 1}`,
      type,
      content: '',
      metadata,
    };

    const activeIndex = activeBlockId ? blocks.findIndex((b) => b.id === activeBlockId) : -1;
    let nextBlocks: ComposableBlock[];
    if (activeIndex !== -1) {
      nextBlocks = [
        ...blocks.slice(0, activeIndex + 1),
        newBlock,
        ...blocks.slice(activeIndex + 1),
      ];
    } else {
      nextBlocks = [...blocks, newBlock];
    }

    setBlocks(nextBlocks);
    setActiveBlockId(newBlock.id);
    setIsInsertPaletteOpen(false);
    persistChanges(title, colorToken, nextBlocks);
  };

  // Convert current active block to new type or insert if none active
  const handleSwitchActiveType = (type: BlockType, metadata?: Record<string, any>) => {
    const defaultMeta = type === 'checklist' && !metadata?.items
      ? { items: [{ id: `task-${Date.now()}-1`, text: '', checked: false, priority: 'none', dueDate: 'Today' }], ...metadata }
      : metadata;
    if (!activeBlockId) {
      handleInsertBlock(type, defaultMeta);
      return;
    }
    const nextBlocks = blocks.map((b) =>
      b.id === activeBlockId
        ? { ...b, type, metadata: { ...b.metadata, ...defaultMeta } }
        : b
    );
    setBlocks(nextBlocks);
    persistChanges(title, colorToken, nextBlocks);
  };

  // Enter press: insert a new paragraph immediately below
  const handleEnterPress = (index: number) => {
    const newBlock: ComposableBlock = {
      id: `b-${Date.now()}-${blocks.length + 1}`,
      type: 'paragraph',
      content: '',
    };
    const nextBlocks = [
      ...blocks.slice(0, index + 1),
      newBlock,
      ...blocks.slice(index + 1),
    ];
    setBlocks(nextBlocks);
    setActiveBlockId(newBlock.id);
    persistChanges(title, colorToken, nextBlocks);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const nextBlocks = [...blocks];
    const temp = nextBlocks[index - 1];
    nextBlocks[index - 1] = nextBlocks[index];
    nextBlocks[index] = temp;
    setBlocks(nextBlocks);
    persistChanges(title, colorToken, nextBlocks);
  };

  const handleMoveDown = (index: number) => {
    if (index === blocks.length - 1) return;
    const nextBlocks = [...blocks];
    const temp = nextBlocks[index + 1];
    nextBlocks[index + 1] = nextBlocks[index];
    nextBlocks[index] = temp;
    setBlocks(nextBlocks);
    persistChanges(title, colorToken, nextBlocks);
  };

  const handleToggleFavorite = () => {
    const next = !isFavorite;
    setIsFavorite(next);
    persistChanges(title, colorToken, blocks, next, isPinned);
  };

  const handleTogglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    persistChanges(title, colorToken, blocks, isFavorite, next);
  };

  const handleColorChange = (color: NoteColorToken) => {
    setColorToken(color);
    persistChanges(title, color, blocks, isFavorite, isPinned);
  };

  const handleDeleteNote = async () => {
    await notesRepo.softDeleteNote(note.id);
    onNoteDeleted(note.id);
    onClose();
  };

  return (
    <View className="flex-1 bg-light-surface dark:bg-dark-surface relative">
      {/* Top Editorial Header Bar */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border z-10 bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-md">
        {/* Back Button */}
        <Pressable
          onPress={onClose}
          accessibilityLabel="Back to notes"
          className="w-10 h-10 rounded-full bg-light-appBg dark:bg-dark-raised items-center justify-center active:scale-95 shadow-sm"
        >
          <ArrowLeft size={18} color={isDark ? '#F7F7F7' : '#171717'} strokeWidth={2.2} />
        </Pressable>

        {/* Pastel Color Swatches */}
        <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/5">
          {PASTEL_PALETTE.map((color) => {
            const isSelected = colorToken === color;
            return (
              <Pressable
                key={color}
                onPress={() => handleColorChange(color)}
                style={{ backgroundColor: NoteColors[color] }}
                className={`w-6 h-6 rounded-full items-center justify-center active:scale-90 transition-transform ${
                  isSelected ? 'border-2 border-black dark:border-white scale-110' : ''
                }`}
              >
                {isSelected && <Check size={12} color="#191919" strokeWidth={3} />}
              </Pressable>
            );
          })}
        </View>

        {/* Right Action Icons: Pin, Favorite, Delete, Done */}
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={handleTogglePin}
            accessibilityLabel="Toggle Pin"
            className="w-9 h-9 rounded-full items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 active:scale-90"
          >
            <Pin 
              size={17} 
              color={isPinned ? '#FFC96F' : (isDark ? '#B5B5B5' : '#626262')} 
              fill={isPinned ? '#FFC96F' : 'transparent'} 
            />
          </Pressable>

          <Pressable
            onPress={handleToggleFavorite}
            accessibilityLabel="Toggle Favorite"
            className="w-9 h-9 rounded-full items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 active:scale-90"
          >
            <Star 
              size={18} 
              color={isFavorite ? '#FFD43B' : (isDark ? '#B5B5B5' : '#626262')} 
              fill={isFavorite ? '#FFD43B' : 'transparent'} 
            />
          </Pressable>

          <Pressable
            onPress={handleDeleteNote}
            accessibilityLabel="Delete Note"
            className="w-9 h-9 rounded-full items-center justify-center hover:bg-red-500/10 active:scale-90"
          >
            <Trash2 size={17} color="#EF4444" />
          </Pressable>

          <Pressable
            onPress={onClose}
            accessibilityLabel="Done"
            className="px-4 py-1.5 rounded-full bg-light-iconBg dark:bg-white items-center justify-center active:scale-95 ml-1 shadow-sm"
          >
            <Text className="text-xs font-bold text-white dark:text-[#111111]">
              Done
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Top Sticky Editorial Command Bar (Zero collision with bottom navigation) */}
      <View className="flex-row items-center justify-between px-6 py-2.5 border-b border-light-border/70 dark:border-white/10 bg-light-appBg/95 dark:bg-[#18181A]/95 backdrop-blur-md z-20">
        {/* Left: Primary Insert Element */}
        <Pressable
          onPress={() => setIsInsertPaletteOpen(!isInsertPaletteOpen)}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-light-iconBg dark:bg-white active:scale-95 shadow-sm"
        >
          <Plus size={13} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2.5} />
          <Text className="text-xs font-bold text-white dark:text-[#111111]">
            Insert
          </Text>
        </Pressable>

        {/* Center: Style Switchers */}
        <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-light-surface dark:bg-dark-raised border border-light-border/70 dark:border-white/5">
          <Pressable
            onPress={() => handleSwitchActiveType('paragraph')}
            className="px-2.5 py-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
            accessibilityLabel="Normal Text"
          >
            <Text className="text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary">
              Text
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleSwitchActiveType('heading', { level: 1 })}
            className="px-2.5 py-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
            accessibilityLabel="Heading 1"
          >
            <Text className="text-xs font-black text-light-textPrimary dark:text-dark-textPrimary">
              H1
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleSwitchActiveType('heading', { level: 2 })}
            className="px-2.5 py-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
            accessibilityLabel="Heading 2"
          >
            <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
              H2
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleSwitchActiveType('quote')}
            className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
            accessibilityLabel="Quote"
          >
            <QuoteIcon size={13} color={isDark ? '#B5B5B5' : '#626262'} />
          </Pressable>
        </View>

        {/* Right: Quick Task, Media, and Block Reorder/Delete */}
        <View className="flex-row items-center gap-1.5">
          {/* Quick Task Button */}
          <Pressable
            onPress={() => handleInsertBlock('checklist', {
              items: [{ id: `task-${Date.now()}-1`, text: '', checked: false, priority: 'none', dueDate: 'Today' }]
            })}
            className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-light-surface dark:bg-dark-raised border border-light-border/70 dark:border-white/5 active:scale-95"
            accessibilityLabel="Add Task Checklist"
          >
            <ListTodo size={12} color={isDark ? '#6EE7B7' : '#059669'} />
            <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
              Task
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleInsertBlock('image', { url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80', caption: '', width: '100%', align: 'center', aspectRatio: 'natural' })}
            className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-light-surface dark:bg-dark-raised border border-light-border/70 dark:border-white/5 active:scale-95"
            accessibilityLabel="Add Image"
          >
            <ImageIcon size={12} color={isDark ? '#38BDF8' : '#0284C7'} />
            <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
              Media
            </Text>
          </Pressable>

          {activeBlockId && (
            <>
              <View className="w-[1px] h-4 bg-black/10 dark:bg-white/15 mx-0.5" />
              <Pressable
                onPress={() => {
                  const idx = blocks.findIndex((b) => b.id === activeBlockId);
                  if (idx > 0) handleMoveUp(idx);
                }}
                className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-90"
                accessibilityLabel="Move Up"
              >
                <ChevronUp size={13} color={isDark ? '#B5B5B5' : '#626262'} />
              </Pressable>
              <Pressable
                onPress={() => {
                  const idx = blocks.findIndex((b) => b.id === activeBlockId);
                  if (idx < blocks.length - 1) handleMoveDown(idx);
                }}
                className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-90"
                accessibilityLabel="Move Down"
              >
                <ChevronDown size={13} color={isDark ? '#B5B5B5' : '#626262'} />
              </Pressable>
              <Pressable
                onPress={() => handleDeleteBlock(activeBlockId)}
                className="p-1 rounded-full hover:bg-red-500/20 active:scale-90"
                accessibilityLabel="Delete Block"
              >
                <Trash2 size={13} color="#EF4444" />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Editor Main Continuous Canvas */}
      <ScrollView 
        className="flex-1 px-6 md:px-16 lg:px-24 pt-6"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Folder Badge & Metadata */}
        <View className="flex-row items-center gap-2 mb-4">
          <View 
            style={{ backgroundColor: NoteColors[colorToken] }}
            className="flex-row items-center gap-1.5 px-3 py-1 rounded-full shadow-sm"
          >
            <Folder size={11} color="#191919" />
            <Text className="text-xs font-bold text-[#191919]">
              {note.folderPath || 'General'}
            </Text>
          </View>
          <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
            • Last updated {note.updatedAt || 'Just now'}
          </Text>
        </View>

        {/* Large Bold Editorial Title */}
        <TextInput
          placeholder="Note Title..."
          placeholderTextColor={isDark ? '#626262' : '#929292'}
          value={title}
          onChangeText={(newTitle) => {
            setTitle(newTitle);
            persistChanges(newTitle, colorToken, blocks);
          }}
          className="text-3xl md:text-5xl font-black text-light-textPrimary dark:text-dark-textPrimary tracking-tight mb-4 py-2 outline-none"
        />

        {/* Continuous Stream of Editorial Blocks (No Outer Card Wrappers) */}
        <View className="mb-12">
          {blocks.map((block, idx) => (
            <BlockRenderer
              key={block.id}
              block={block}
              index={idx}
              totalBlocks={blocks.length}
              isActive={block.id === activeBlockId}
              onFocus={() => setActiveBlockId(block.id)}
              onEnterPress={() => handleEnterPress(idx)}
              onUpdateBlock={(updates) => handleUpdateBlock(block.id, updates)}
              onUpdateContent={(content) => handleUpdateContent(block.id, content)}
              onUpdateMetadata={(metadata) => handleUpdateMetadata(block.id, metadata)}
              onChangeType={(type) => handleChangeType(block.id, type)}
              onDelete={() => handleDeleteBlock(block.id)}
              onMoveUp={() => handleMoveUp(idx)}
              onMoveDown={() => handleMoveDown(idx)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Modern Insert Palette Modal (Distraction-Free) */}
      <Modal
        visible={isInsertPaletteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsInsertPaletteOpen(false)}
      >
        <Pressable
          onPress={() => setIsInsertPaletteOpen(false)}
          className="flex-1 bg-black/60 backdrop-blur-sm justify-end md:justify-center items-center p-4"
        >
          <Pressable
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
                  {activeBlockId ? 'Insert immediately after current selection' : 'Insert at the end of the story'}
                </Text>
              </View>
              <Pressable
                onPress={() => setIsInsertPaletteOpen(false)}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 items-center justify-center active:scale-90"
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
                  onPress={() => handleInsertBlock('image', { url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80', caption: '', width: '100%', align: 'center', aspectRatio: 'natural' })}
                  className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5 active:scale-95"
                >
                  <View className="w-8 h-8 rounded-xl bg-sky-500/15 items-center justify-center mb-2">
                    <ImageIcon size={16} color="#0EA5E9" />
                  </View>
                  <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Image</Text>
                  <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Resizable (33%, 50%, 75%, 100%)</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleInsertBlock('audio', { durationSec: 94 })}
                  className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5 active:scale-95"
                >
                  <View className="w-8 h-8 rounded-xl bg-purple-500/15 items-center justify-center mb-2">
                    <Volume2 size={16} color="#A855F7" />
                  </View>
                  <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Voice Note</Text>
                  <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Waveform & transcript</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleInsertBlock('file', { fileName: 'Specification.pdf', sizeBytes: 1845600 })}
                  className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5 active:scale-95"
                >
                  <View className="w-8 h-8 rounded-xl bg-amber-500/15 items-center justify-center mb-2">
                    <Paperclip size={16} color="#F59E0B" />
                  </View>
                  <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Attachment</Text>
                  <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">PDF or file document</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleInsertBlock('bookmark', { url: 'https://reactnative.dev' })}
                  className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5 active:scale-95"
                >
                  <View className="w-8 h-8 rounded-xl bg-indigo-500/15 items-center justify-center mb-2">
                    <Globe size={16} color="#6366F1" />
                  </View>
                  <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Web Link</Text>
                  <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Rich bookmark card</Text>
                </Pressable>
              </View>

              {/* Category: Writing & Structure */}
              <Text className="text-[11px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2 px-1">
                Writing & Structure
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-5">
                <Pressable
                  onPress={() => handleInsertBlock('paragraph')}
                  className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5 active:scale-95"
                >
                  <Type size={16} color={isDark ? '#E5E5E5' : '#171717'} className="mb-2" />
                  <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Paragraph</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleInsertBlock('heading', { level: 1 })}
                  className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5 active:scale-95"
                >
                  <Heading size={16} color={isDark ? '#E5E5E5' : '#171717'} className="mb-2" />
                  <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Heading 1</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleInsertBlock('heading', { level: 2 })}
                  className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5 active:scale-95"
                >
                  <Heading size={14} color={isDark ? '#E5E5E5' : '#171717'} className="mb-2" />
                  <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Heading 2</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleInsertBlock('quote')}
                  className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5 active:scale-95"
                >
                  <QuoteIcon size={16} color="#A78BFA" className="mb-2" />
                  <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Quote</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleInsertBlock('divider')}
                  className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5 active:scale-95"
                >
                  <Minus size={16} color={isDark ? '#9CA3AF' : '#6B7280'} className="mb-2" />
                  <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Divider</Text>
                </Pressable>
              </View>

              {/* Category: Productivity & Technical */}
              <Text className="text-[11px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2 px-1">
                Productivity & Technical
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-2">
                <Pressable
                  onPress={() => handleInsertBlock('checklist', {
                    items: [{ id: `task-${Date.now()}-1`, text: '', checked: false, priority: 'none', dueDate: 'Today' }]
                  })}
                  className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5 active:scale-95"
                >
                  <View className="w-8 h-8 rounded-xl bg-emerald-500/15 items-center justify-center mb-2">
                    <ListTodo size={16} color="#10B981" />
                  </View>
                  <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Checklist Task</Text>
                  <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Syncs with global Tasks</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleInsertBlock('code', { language: 'typescript' })}
                  className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5 active:scale-95"
                >
                  <View className="w-8 h-8 rounded-xl bg-cyan-500/15 items-center justify-center mb-2">
                    <Code2 size={16} color="#06B6D4" />
                  </View>
                  <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Code Block</Text>
                  <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Syntax highlighted</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleInsertBlock('table', { columns: ['Header 1', 'Header 2'], rows: [['', '']] })}
                  className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5 active:scale-95"
                >
                  <View className="w-8 h-8 rounded-xl bg-blue-500/15 items-center justify-center mb-2">
                    <Table size={16} color="#3B82F6" />
                  </View>
                  <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Data Table</Text>
                  <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Matrix grid editor</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleInsertBlock('callout', { variant: 'info' })}
                  className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5 active:scale-95"
                >
                  <View className="w-8 h-8 rounded-xl bg-rose-500/15 items-center justify-center mb-2">
                    <AlertCircle size={16} color="#F43F5E" />
                  </View>
                  <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Callout</Text>
                  <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Highlighted note box</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleInsertBlock('equation', { displayMode: true })}
                  className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5 active:scale-95"
                >
                  <View className="w-8 h-8 rounded-xl bg-orange-500/15 items-center justify-center mb-2">
                    <Sigma size={16} color="#F97316" />
                  </View>
                  <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">LaTeX Formula</Text>
                  <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Math equation</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleInsertBlock('drawing', { paths: [] })}
                  className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5 active:scale-95"
                >
                  <View className="w-8 h-8 rounded-xl bg-teal-500/15 items-center justify-center mb-2">
                    <PenTool size={16} color="#14B8A6" />
                  </View>
                  <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Canvas Sketch</Text>
                  <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Hand-drawn sketch</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};
