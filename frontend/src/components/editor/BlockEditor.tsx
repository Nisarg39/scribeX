import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { NoteItem, ComposableBlock, BlockType } from '../../types/note';
import { useTheme, NoteColors, NoteColorToken } from '../../theme';
import { BlockRenderer } from './BlockRenderer';
import { notesRepo } from '../../db/notesRepo';
import { tasksRepo } from '../../db/tasksRepo';
import { useNotesStore } from '../../state/useNotesStore';
import { serializeBlocksToMarkdown } from '../../core/astSerializer';
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
  Globe
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
  const [blocks, setBlocks] = useState<ComposableBlock[]>(
    note.blocks && note.blocks.length > 0
      ? note.blocks
      : [{ id: `b-${Date.now()}-1`, type: 'paragraph', content: note.contentMarkdown || '' }]
  );

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
      const checklistItems = newBlocks
        .filter((b) => b.type === 'checklist')
        .map((b) => ({
          id: b.metadata?.taskId || b.id,
          text: b.content,
          checked: !!b.metadata?.checked,
          priority: b.metadata?.priority || 'none',
          dueDate: b.metadata?.dueDate || 'Today',
        }));

      tasksRepo.syncNoteChecklists(note.id, newTitle, newColor, checklistItems)
        .then(() => refreshFromDB())
        .catch((err) => console.warn('Failed to sync note checklists to tasksRepo:', err));
    } catch (err) {
      console.warn('Failed to persist note changes in BlockEditor:', err);
    }
  };

  // Block Mutation Helpers
  const handleUpdateContent = (blockId: string, content: string) => {
    const nextBlocks = blocks.map((b) => (b.id === blockId ? { ...b, content } : b));
    setBlocks(nextBlocks);
    persistChanges(title, colorToken, nextBlocks);
  };

  const handleUpdateMetadata = (blockId: string, metadata: Record<string, any>) => {
    const nextBlocks = blocks.map((b) =>
      b.id === blockId ? { ...b, metadata: { ...b.metadata, ...metadata } } : b
    );
    setBlocks(nextBlocks);
    persistChanges(title, colorToken, nextBlocks);
  };

  const handleChangeType = (blockId: string, type: BlockType) => {
    const nextBlocks = blocks.map((b) => (b.id === blockId ? { ...b, type } : b));
    setBlocks(nextBlocks);
    persistChanges(title, colorToken, nextBlocks);
  };

  const handleDeleteBlock = (blockId: string) => {
    if (blocks.length <= 1) {
      // Keep at least one empty block
      const emptyBlock: ComposableBlock[] = [{ id: `b-${Date.now()}`, type: 'paragraph', content: '' }];
      setBlocks(emptyBlock);
      persistChanges(title, colorToken, emptyBlock);
      return;
    }
    const nextBlocks = blocks.filter((b) => b.id !== blockId);
    setBlocks(nextBlocks);
    persistChanges(title, colorToken, nextBlocks);
  };

  const handleAddBlock = (type: BlockType, metadata?: Record<string, any>) => {
    const newBlock: ComposableBlock = {
      id: `b-${Date.now()}-${blocks.length + 1}`,
      type,
      content: '',
      metadata,
    };
    const nextBlocks = [...blocks, newBlock];
    setBlocks(nextBlocks);
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
    <View className="flex-1 bg-light-surface dark:bg-dark-surface">
      {/* Top Editor Bar */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border">
        {/* Back Button */}
        <Pressable
          onPress={onClose}
          accessibilityLabel="Back to notes"
          className="w-10 h-10 rounded-full bg-light-appBg dark:bg-dark-raised items-center justify-center active:scale-95"
        >
          <ArrowLeft size={18} color={isDark ? '#F7F7F7' : '#171717'} strokeWidth={2.2} />
        </Pressable>

        {/* Pastel Color Swatches */}
        <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-light-appBg dark:bg-dark-raised">
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
            className="px-4 py-1.5 rounded-full bg-light-iconBg dark:bg-white items-center justify-center active:scale-95 ml-1"
          >
            <Text className="text-xs font-bold text-white dark:text-[#111111]">
              Done
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Editor Content Area */}
      <ScrollView 
        className="flex-1 px-6 md:px-12 pt-6"
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Folder Badge & Metadata */}
        <View className="flex-row items-center gap-2 mb-3">
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
          placeholderTextColor={isDark ? '#858585' : '#929292'}
          value={title}
          onChangeText={(newTitle) => {
            setTitle(newTitle);
            persistChanges(newTitle, colorToken, blocks);
          }}
          className="text-3xl md:text-4xl font-extrabold text-light-textPrimary dark:text-dark-textPrimary tracking-tight mb-6 py-2"
        />

        {/* Stream of Composable Blocks */}
        <View className="mb-8">
          {blocks.map((block, idx) => (
            <BlockRenderer
              key={block.id}
              block={block}
              index={idx}
              totalBlocks={blocks.length}
              onUpdateContent={(content) => handleUpdateContent(block.id, content)}
              onUpdateMetadata={(metadata) => handleUpdateMetadata(block.id, metadata)}
              onChangeType={(type) => handleChangeType(block.id, type)}
              onDelete={() => handleDeleteBlock(block.id)}
              onMoveUp={() => handleMoveUp(idx)}
              onMoveDown={() => handleMoveDown(idx)}
            />
          ))}
        </View>

        {/* Floating Quick Block Insertion Ribbon */}
        <View className="p-3 rounded-2xl bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-dark-border">
          <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2 px-1">
            Insert Composable Block
          </Text>

          <View className="flex-row items-center flex-wrap gap-2">
            <Pressable
              onPress={() => handleAddBlock('paragraph')}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border active:scale-95"
            >
              <Plus size={13} color={isDark ? '#F7F7F7' : '#171717'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Paragraph
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddBlock('heading', { level: 2 })}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border active:scale-95"
            >
              <Heading size={13} color={isDark ? '#F7F7F7' : '#171717'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Heading
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddBlock('checklist', { checked: false })}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border active:scale-95"
            >
              <ListTodo size={13} color={isDark ? '#F7F7F7' : '#171717'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Checklist
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddBlock('code', { language: 'typescript' })}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border active:scale-95"
            >
              <Code2 size={13} color={isDark ? '#F7F7F7' : '#171717'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Code Block
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddBlock('quote')}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border active:scale-95"
            >
              <QuoteIcon size={13} color={isDark ? '#F7F7F7' : '#171717'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Quote
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddBlock('table', { columns: ['Header 1', 'Header 2'], rows: [['', '']] })}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border active:scale-95"
            >
              <Table size={13} color={isDark ? '#F7F7F7' : '#171717'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Table
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddBlock('callout', { variant: 'info' })}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border active:scale-95"
            >
              <AlertCircle size={13} color={isDark ? '#F7F7F7' : '#171717'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Callout
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddBlock('equation', { displayMode: true })}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border active:scale-95"
            >
              <Sigma size={13} color={isDark ? '#F7F7F7' : '#171717'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                LaTeX Formula
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddBlock('drawing', { paths: [] })}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border active:scale-95"
            >
              <PenTool size={13} color={isDark ? '#F7F7F7' : '#171717'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Sketch
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddBlock('audio', { durationSec: 94 })}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border active:scale-95"
            >
              <Volume2 size={13} color={isDark ? '#F7F7F7' : '#171717'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Voice Note
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddBlock('image', { url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80', caption: '', aspectRatio: 'natural' })}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border active:scale-95"
            >
              <ImageIcon size={13} color={isDark ? '#F7F7F7' : '#171717'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Image
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddBlock('file', { fileName: 'Architecture_Spec.pdf', sizeBytes: 1845600 })}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border active:scale-95"
            >
              <Paperclip size={13} color={isDark ? '#F7F7F7' : '#171717'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                File
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddBlock('bookmark', { url: 'https://reactnative.dev' })}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border active:scale-95"
            >
              <Globe size={13} color={isDark ? '#F7F7F7' : '#171717'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Bookmark
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddBlock('divider')}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border active:scale-95"
            >
              <Minus size={13} color={isDark ? '#F7F7F7' : '#171717'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Divider
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
