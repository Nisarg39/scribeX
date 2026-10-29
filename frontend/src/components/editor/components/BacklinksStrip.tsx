import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { GitFork, ArrowUpRight, FileText } from 'lucide-react-native';
import { NoteColors, useTheme } from '../../../theme';
import { useNotesStore } from '../../../state/useNotesStore';
import { ComposableBlock, NoteItem } from '../../../types/note';

interface BacklinksStripProps {
  currentNoteId: string;
  className?: string;
}

export const BacklinksStrip: React.FC<BacklinksStripProps> = ({
  currentNoteId,
  className = '',
}) => {
  const router = useRouter();
  const { isDark } = useTheme();
  const { notes } = useNotesStore();

  // Find all other notes in the vault that contain a note_link pointing to currentNoteId
  const backlinks = useMemo(() => {
    return notes.filter((n: NoteItem) => {
      if (n.id === currentNoteId) return false;
      const blocks: ComposableBlock[] = Array.isArray(n.blocks) ? n.blocks : [];
      return blocks.some(
        (b) => b.type === 'note_link' && b.metadata?.targetNoteId === currentNoteId
      );
    });
  }, [notes, currentNoteId]);

  if (backlinks.length === 0) {
    return null;
  }

  return (
    <View
      style={{
        borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      }}
      className={`mt-10 pt-6 border-t select-none ${className}`}
    >
      {/* Header Label with GitFork icon */}
      <View className="flex-row items-center gap-1.5 mb-3">
        <GitFork size={12} color="#06B6D4" />
        <Text className="text-[11px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted">
          Backlinks & Linked References • {backlinks.length} {backlinks.length === 1 ? 'Note' : 'Notes'}
        </Text>
      </View>

      {/* Referencing Note Pills */}
      <View className="flex-row flex-wrap items-center gap-2">
        {backlinks.map((refNote) => {
          const color = (NoteColors as Record<string, string>)[refNote.colorToken] || '#06B6D4';

          return (
            <Pressable
              key={refNote.id}
              onPress={() => router.push(`/note/${refNote.id}` as any)}
              style={({ pressed }) => [
                {
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
              className="flex-row items-center gap-2.5 px-3 py-2 rounded-xl border hover:border-note-cyan/60 hover:bg-note-cyan/5 transition-all group"
            >
              {/* Note Swatch */}
              <View
                style={{ backgroundColor: color }}
                className="w-2 h-2 rounded-full flex-shrink-0"
              />

              <View className="flex-row items-center gap-1.5">
                <Text
                  numberOfLines={1}
                  className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary group-hover:text-note-cyan max-w-[200px]"
                >
                  {refNote.title || 'Untitled Note'}
                </Text>
                <ArrowUpRight size={11} color={isDark ? '#8EDCEB' : '#08C4E5'} />
              </View>

              {/* Folder indicator */}
              <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted font-medium">
                in {refNote.folderPath || 'General'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
