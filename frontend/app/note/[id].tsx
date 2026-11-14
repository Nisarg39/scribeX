import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, NoteColors } from '../../src/theme';
import { useSecurity } from '../../src/context';
import { useNotesStore } from '../../src/state/useNotesStore';
import { notesRepo } from '../../src/db/notesRepo';
import { NoteItem } from '../../src/types/note';
import { BlockEditor } from '../../src/components/editor/BlockEditor';
import { inspectNoteLockState } from '../../src/core/security/vaultLockHelpers';
import { ArrowLeft, FileQuestion, Lock, ShieldCheck } from 'lucide-react-native';

export default function NoteEditorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    unlockedNoteIds,
    unlockedFolderPaths,
    promptUnlockNote,
    relockNoteOnEditorExit,
  } = useSecurity();
  const { notes, folders, updateNote, deleteNote, refreshFromDB } = useNotesStore();

  const [localNote, setLocalNote] = useState<NoteItem | null>(null);
  const [isResolving, setIsResolving] = useState<boolean>(true);
  const didAutoPromptRef = useRef<string | null>(null);
  const isClosingRef = useRef<boolean>(false);

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

  // Immediate-on-exit auto-relock lifecycle when leaving the Note Editor
  useEffect(() => {
    const activeId = localNote?.id;
    return () => {
      isClosingRef.current = true;
      if (activeId && !activeId.startsWith('draft-')) {
        relockNoteOnEditorExit(activeId);
      }
    };
  }, [localNote?.id, relockNoteOnEditorExit]);

  const lockInspection =
    localNote && !localNote.id.startsWith('draft-')
      ? inspectNoteLockState(localNote, folders, unlockedNoteIds, unlockedFolderPaths)
      : null;
  const isRouteNoteLocked = Boolean(lockInspection?.isEffectivelyLocked);

  // If navigated directly to a locked note (e.g., notification/deep-link/URL), prompt immediately once
  useEffect(() => {
    if (
      !isClosingRef.current &&
      !isResolving &&
      localNote &&
      isRouteNoteLocked &&
      didAutoPromptRef.current !== localNote.id
    ) {
      didAutoPromptRef.current = localNote.id;
      promptUnlockNote(localNote, folders);
    }
  }, [isResolving, localNote, isRouteNoteLocked, folders, promptUnlockNote]);

  const handleClose = () => {
    isClosingRef.current = true;
    if (localNote?.id && !localNote.id.startsWith('draft-')) {
      relockNoteOnEditorExit(localNote.id);
    }
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

  // Locked Note Gate — never mounts BlockEditor / sensitive body until verified
  if (isRouteNoteLocked) {
    return (
      <View
        className="flex-1 bg-light-surface dark:bg-dark-surface items-center justify-center px-7"
        style={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <View
          className="w-16 h-16 rounded-2xl items-center justify-center mb-5 border"
          style={{
            backgroundColor: isDark ? '#303030' : '#F8FAFC',
            borderColor: isDark ? '#3A3A3A' : '#E8E8E8',
          }}
        >
          <Lock size={28} color={NoteColors.lavender} strokeWidth={2.2} />
        </View>

        <Text
          className="text-2xl font-black text-light-textPrimary dark:text-dark-textPrimary tracking-tight text-center mb-1.5"
        >
          {localNote.title || 'Protected Note'}
        </Text>

        <Text className="text-sm text-light-textSecondary dark:text-dark-textSecondary text-center max-w-sm mb-6">
          {lockInspection?.lockReason === 'folder' && lockInspection.blockingFolders.length > 0
            ? `Protected inside locked folder "${lockInspection.blockingFolders[0].path}".`
            : localNote.lockType === 'custom'
            ? 'This note is locked with a Custom PIN or Password.'
            : 'Enter your Master Credential to view or edit this note.'}
        </Text>

        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handleClose}
            accessibilityLabel="Back to Notes"
            className="flex-row items-center gap-2 px-5 py-3 rounded-full bg-light-border dark:bg-dark-raised active:opacity-80"
          >
            <ArrowLeft size={16} color={isDark ? '#F7F7F7' : '#171717'} strokeWidth={2.2} />
            <Text className="text-sm font-bold text-light-textPrimary dark:text-dark-textPrimary">
              Back
            </Text>
          </Pressable>

          <Pressable
            onPress={() => promptUnlockNote(localNote, folders)}
            accessibilityLabel="Unlock Note"
            style={{ backgroundColor: NoteColors.lavender }}
            className="flex-row items-center gap-2 px-6 py-3 rounded-full active:opacity-85"
          >
            <ShieldCheck size={17} color="#171717" strokeWidth={2.3} />
            <Text className="text-sm font-extrabold text-[#171717]">Unlock Note</Text>
          </Pressable>
        </View>
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

