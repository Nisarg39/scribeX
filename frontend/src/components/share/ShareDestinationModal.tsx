import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme, NoteColors, NoteColorToken } from '../../theme';
import { SynthesizedNoteResult } from '../../core/share/types';
import { NoteItem, ComposableBlock } from '../../types/note';
import { DBFolder } from '../../db/types';
import {
  FilePlus2,
  FolderPlus,
  Search,
  Check,
  X,
  FileArchive,
  Image as ImageIcon,
  Video as VideoIcon,
  Mic,
  FileText,
  Folder,
  Sparkles,
} from 'lucide-react-native';

interface ShareDestinationModalProps {
  visible: boolean;
  synthesized: SynthesizedNoteResult | null;
  notes: NoteItem[];
  folders: DBFolder[];
  onClose: () => void;
  onSaveNewNote: (params: {
    title: string;
    folderPath: string;
    blocks: ComposableBlock[];
    colorToken: NoteColorToken;
    tags: string[];
  }) => Promise<void>;
  onAppendToExistingNote: (
    noteId: string,
    blocks: ComposableBlock[],
    tags: string[]
  ) => Promise<void>;
}

export const ShareDestinationModal: React.FC<ShareDestinationModalProps> = ({
  visible,
  synthesized,
  notes,
  folders,
  onClose,
  onSaveNewNote,
  onAppendToExistingNote,
}) => {
  const { isDark } = useTheme();
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [noteTitle, setNoteTitle] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('General');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeNotes = useMemo(
    () => notes.filter((n) => n.status === 'active'),
    [notes]
  );

  useEffect(() => {
    if (visible && synthesized) {
      setMode('new');
      setNoteTitle(synthesized.title || 'Shared Note');
      setSelectedFolder('General');
      setSearchQuery('');
      setSelectedNoteId(activeNotes[0]?.id || null);
      setIsSubmitting(false);
    }
  }, [visible, synthesized, activeNotes]);

  const folderOptions = useMemo(() => {
    const paths = new Set<string>(['General']);
    for (const f of folders) {
      if (f.path && !f.is_archived) {
        paths.add(f.path);
      }
    }
    return Array.from(paths);
  }, [folders]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeNotes.slice(0, 30);
    return activeNotes
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.folderPath && n.folderPath.toLowerCase().includes(q))
      )
      .slice(0, 30);
  }, [activeNotes, searchQuery]);

  const payloadSummary = useMemo(() => {
    if (!synthesized) return { label: 'Shared item', icon: FileText };
    const blocks = synthesized.blocks || [];
    const imgCount = blocks.filter((b) => b.type === 'image').length;
    const vidCount = blocks.filter((b) => b.type === 'video').length;
    const audCount = blocks.filter((b) => b.type === 'audio').length;
    const fileBlocks = blocks.filter((b) => b.type === 'file');

    if (fileBlocks.length > 0) {
      const firstFile = fileBlocks[0].metadata?.fileName || 'Attachment';
      const isZip = /\.zip$/i.test(firstFile);
      return {
        label:
          fileBlocks.length === 1
            ? firstFile
            : `${firstFile} (+${fileBlocks.length - 1} files)`,
        icon: isZip ? FileArchive : FileText,
      };
    }
    if (imgCount > 0) {
      return {
        label: `${imgCount} shared image${imgCount > 1 ? 's' : ''}`,
        icon: ImageIcon,
      };
    }
    if (vidCount > 0) {
      return {
        label: `${vidCount} shared video${vidCount > 1 ? 's' : ''}`,
        icon: VideoIcon,
      };
    }
    if (audCount > 0) {
      return {
        label: `${audCount} voice recording${audCount > 1 ? 's' : ''}`,
        icon: Mic,
      };
    }
    return {
      label: `${blocks.length} content block${blocks.length > 1 ? 's' : ''}`,
      icon: Sparkles,
    };
  }, [synthesized]);

  if (!visible || !synthesized) return null;

  const SummaryIcon = payloadSummary.icon;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (mode === 'new') {
        await onSaveNewNote({
          title: noteTitle.trim() || synthesized.title || 'Shared Note',
          folderPath: selectedFolder || 'General',
          blocks: synthesized.blocks,
          colorToken: synthesized.colorToken || 'lime',
          tags: synthesized.tags || ['shared'],
        });
      } else if (mode === 'existing' && selectedNoteId) {
        await onAppendToExistingNote(
          selectedNoteId,
          synthesized.blocks,
          synthesized.tags || ['shared']
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/60"
      >
        <View
          style={{
            backgroundColor: isDark ? '#14161B' : '#FFFFFF',
            borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          }}
          className="w-full rounded-t-3xl border-t px-5 pt-5 pb-8 max-h-[85%]"
        >
          {/* Top Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1 mr-3">
              <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                Save Shared Content
              </Text>
              <View className="flex-row items-center gap-1.5 mt-1">
                <SummaryIcon size={13} color={NoteColors.lime} />
                <Text
                  numberOfLines={1}
                  className="text-xs font-medium text-light-textSecondary dark:text-dark-textSecondary flex-1"
                >
                  {payloadSummary.label}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="w-8 h-8 rounded-full items-center justify-center bg-light-surface dark:bg-dark-raised"
            >
              <X size={16} color={isDark ? '#A1A1AA' : '#52525B'} />
            </Pressable>
          </View>

          {/* Segmented Destination Switcher (Default: Save in New Note) */}
          <View className="flex-row p-1 rounded-2xl bg-light-surface dark:bg-dark-raised mb-4">
            <Pressable
              onPress={() => setMode('new')}
              style={
                mode === 'new'
                  ? {
                      backgroundColor: isDark ? '#222630' : '#FFFFFF',
                    }
                  : undefined
              }
              className="flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl"
            >
              <FilePlus2
                size={15}
                color={
                  mode === 'new'
                    ? '#06B6D4'
                    : isDark
                    ? '#A1A1AA'
                    : '#71717A'
                }
              />
              <Text
                className={`text-xs font-bold ${
                  mode === 'new'
                    ? 'text-light-textPrimary dark:text-dark-textPrimary'
                    : 'text-light-textMuted dark:text-dark-textMuted'
                }`}
              >
                New Note
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setMode('existing')}
              style={
                mode === 'existing'
                  ? {
                      backgroundColor: isDark ? '#222630' : '#FFFFFF',
                    }
                  : undefined
              }
              className="flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl"
            >
              <FolderPlus
                size={15}
                color={
                  mode === 'existing'
                    ? '#06B6D4'
                    : isDark
                    ? '#A1A1AA'
                    : '#71717A'
                }
              />
              <Text
                className={`text-xs font-bold ${
                  mode === 'existing'
                    ? 'text-light-textPrimary dark:text-dark-textPrimary'
                    : 'text-light-textMuted dark:text-dark-textMuted'
                }`}
              >
                Existing Note
              </Text>
            </Pressable>
          </View>

          {mode === 'new' ? (
            <View className="mb-5">
              <Text className="text-[11px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-1.5">
                Note Title
              </Text>
              <TextInput
                value={noteTitle}
                onChangeText={setNoteTitle}
                placeholder="Enter note title..."
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-raised text-sm font-semibold text-light-textPrimary dark:text-dark-textPrimary mb-4"
              />

              <Text className="text-[11px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2">
                Folder Destination
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0, flexShrink: 0 }}
                contentContainerStyle={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {folderOptions.map((folder) => {
                  const isActive = selectedFolder === folder;
                  return (
                    <Pressable
                      key={folder}
                      onPress={() => setSelectedFolder(folder)}
                      style={{
                        flexShrink: 0,
                        backgroundColor: isActive
                          ? '#06B6D4'
                          : isDark
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(0,0,0,0.04)',
                      }}
                      className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                    >
                      <Folder
                        size={12}
                        color={isActive ? '#0F172A' : isDark ? '#A1A1AA' : '#52525B'}
                      />
                      <Text
                        style={{ color: isActive ? '#0F172A' : undefined }}
                        className={`text-xs font-semibold ${
                          isActive
                            ? ''
                            : 'text-light-textSecondary dark:text-dark-textSecondary'
                        }`}
                      >
                        {folder}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <View className="mb-5">
              {/* Search Existing Notes */}
              <View className="flex-row items-center px-3 py-2 rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-raised mb-3">
                <Search size={14} color={isDark ? '#71717A' : '#A1A1AA'} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search existing notes..."
                  placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                  className="flex-1 ml-2 text-xs font-medium text-light-textPrimary dark:text-dark-textPrimary py-0"
                />
              </View>

              <ScrollView
                style={{ maxHeight: 220 }}
                showsVerticalScrollIndicator={false}
              >
                {filteredNotes.length === 0 ? (
                  <View className="py-8 items-center justify-center">
                    <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                      No matching active notes found.
                    </Text>
                  </View>
                ) : (
                  filteredNotes.map((note) => {
                    const isSelected = selectedNoteId === note.id;
                    return (
                      <Pressable
                        key={note.id}
                        onPress={() => setSelectedNoteId(note.id)}
                        style={{
                          backgroundColor: isSelected
                            ? isDark
                              ? 'rgba(6, 182, 212, 0.14)'
                              : 'rgba(6, 182, 212, 0.08)'
                            : 'transparent',
                          borderBottomColor: isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(0,0,0,0.05)',
                        }}
                        className="flex-row items-center justify-between py-2.5 px-3 rounded-xl border-b"
                      >
                        <View className="flex-1 mr-3">
                          <Text
                            numberOfLines={1}
                            className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary"
                          >
                            {note.title || 'Untitled Note'}
                          </Text>
                          <Text
                            numberOfLines={1}
                            className="text-[10px] text-light-textMuted dark:text-dark-textMuted mt-0.5"
                          >
                            {note.folderPath || 'General'} · {note.updatedAt}
                          </Text>
                        </View>
                        {isSelected && (
                          <View className="w-5 h-5 rounded-full bg-note-cyan items-center justify-center">
                            <Check size={12} color="#0F172A" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}

          {/* Action Footer */}
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={onClose}
              className="px-4 py-3 rounded-xl border border-light-border dark:border-dark-border items-center justify-center"
            >
              <Text className="text-xs font-bold text-light-textSecondary dark:text-dark-textSecondary">
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              disabled={isSubmitting || (mode === 'existing' && !selectedNoteId)}
              style={{
                backgroundColor:
                  mode === 'existing' && !selectedNoteId ? '#52525B' : '#06B6D4',
              }}
              className="flex-1 py-3 rounded-xl items-center justify-center flex-row gap-2"
            >
              <Text className="text-xs font-bold text-slate-950">
                {mode === 'new' ? 'Save in New Note' : 'Add to Selected Note'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
