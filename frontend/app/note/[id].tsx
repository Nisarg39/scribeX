import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { useNotesStore } from '../../src/state/useNotesStore';
import { notesRepo } from '../../src/db/notesRepo';
import { NoteItem } from '../../src/types/note';
import { BlockEditor } from '../../src/components/editor/BlockEditor';
import { ArrowLeft, FileQuestion } from 'lucide-react-native';

export default function NoteEditorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { notes, updateNote, deleteNote, addNote, refreshFromDB } = useNotesStore();

  const [localNote, setLocalNote] = useState<NoteItem | null>(null);
  const [isResolving, setIsResolving] = useState<boolean>(true);

  // Look up note from store or directly from repository
  useEffect(() => {
    let isMounted = true;

    async function resolveNote() {
      if (!id) {
        setIsResolving(false);
        return;
      }

      // If we already have this note loaded into local state, skip redundant resolution
      if (localNote) {
        if (localNote.id === id) {
          setIsResolving(false);
          return;
        }
        if (id === 'new' && localNote.id.startsWith('draft-')) {
          setIsResolving(false);
          return;
        }
      }

      // 1. Handling for a brand new note (Pristine In-Memory Draft)
      if (id === 'new') {
        const draftId = `draft-${Date.now()}`;
        const draftNote: NoteItem = {
          id: draftId,
          userId: 'user-default',
          folderPath: 'General',
          title: '', // Empty initial title so "Note Title..." placeholder is shown
          contentMarkdown: '',
          blocks: [{ id: `b-${Date.now()}`, type: 'paragraph', content: '' }],
          colorToken: 'apricot',
          isFavorite: false,
          isPinned: false,
          status: 'active',
          tags: [],
          createdAt: 'Just now',
          updatedAt: 'Just now',
        };

        if (isMounted) {
          setLocalNote(draftNote);
          setIsResolving(false);
        }
        return;
      }

      // 2. Check in memory notes store first
      const storeMatch = notes.find((n) => n.id === id);
      if (storeMatch) {
        if (isMounted) {
          setLocalNote(storeMatch);
          setIsResolving(false);
        }
        return;
      }

      // 3. Fallback to SQLite DB directly (useful for direct web page refresh or link sharing)
      try {
        const dbMatch = await notesRepo.getNoteById(id);
        if (isMounted) {
          if (dbMatch) {
            setLocalNote(dbMatch);
            updateNote(dbMatch);
          }
          setIsResolving(false);
        }
      } catch (err) {
        console.warn(`Failed to resolve note ${id} from repository:`, err);
        if (isMounted) setIsResolving(false);
      }
    }

    resolveNote();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleClose = () => {
    refreshFromDB();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  const handleNoteUpdated = (updated: NoteItem) => {
    setLocalNote(updated);
    updateNote(updated);
    // When a draft receives its first committed action, replace URL from /note/new to /note/<realId>
    if (id === 'new' && updated.id && !updated.id.startsWith('draft-')) {
      router.replace(`/note/${updated.id}`);
    }
  };

  const handleNoteDeleted = (noteId: string) => {
    deleteNote(noteId);
    router.replace('/home');
  };

  // Loading state
  if (isResolving) {
    return (
      <View 
        className="flex-1 bg-light-appBg dark:bg-dark-appBg items-center justify-center"
        style={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <ActivityIndicator size="large" color={isDark ? '#FFFFFF' : '#111111'} />
      </View>
    );
  }

  // Not Found state
  if (!localNote) {
    return (
      <View 
        className="flex-1 bg-light-appBg dark:bg-dark-appBg items-center justify-center px-6"
        style={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <View className="w-16 h-16 rounded-full bg-light-surface dark:bg-dark-surface items-center justify-center mb-4 shadow-sm border border-light-border dark:border-dark-border">
          <FileQuestion size={28} color={isDark ? '#B5B5B5' : '#626262'} />
        </View>
        <Text className="text-xl font-bold text-light-textPrimary dark:text-white tracking-tight mb-2">
          Note Not Found
        </Text>
        <Text className="text-sm text-light-textMuted dark:text-dark-textMuted text-center max-w-sm mb-6">
          This note may have been deleted or moved to another workspace.
        </Text>
        <Pressable
          onPress={() => router.replace('/home')}
          className="flex-row items-center gap-2 px-5 py-2.5 rounded-full bg-light-iconBg dark:bg-white shadow-sm"
          style={({ pressed }) => pressed ? { transform: [{ scale: 0.96 }] } : undefined}
        >
          <ArrowLeft size={16} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2.2} />
          <Text className="text-sm font-bold text-white dark:text-[#111111]">
            Back to Notes
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View 
      className="flex-1 bg-light-surface dark:bg-dark-surface relative"
      style={{
        paddingTop: Math.max(insets.top, 0),
        paddingBottom: Math.max(insets.bottom, 0),
      }}
    >
      {/* Full-bleed editor: no outer card */}
      <View className="flex-1">
        <View className="flex-1 relative">
          <BlockEditor
            key={localNote.id}
            note={localNote}
            onClose={handleClose}
            onNoteUpdated={handleNoteUpdated}
            onNoteDeleted={handleNoteDeleted}
          />
        </View>
      </View>
    </View>
  );
}

