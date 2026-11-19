import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, NoteColors } from '../../src/theme';
import { useAuth, useSecurity } from '../../src/context';
import { useNotesStore } from '../../src/state/useNotesStore';
import { notesRepo } from '../../src/db/notesRepo';
import { leanCacheManager } from '../../src/db/leanCacheManager';
import { syncEngine } from '../../src/services/sync/syncEngine';
import { googleDriveVaultService } from '../../src/services/drive/googleDriveVaultService';
import { isSupabaseConfigured } from '../../src/services/supabase/supabaseClient';
import { NoteItem } from '../../src/types/note';
import { BlockEditor } from '../../src/components/editor/BlockEditor';
import { inspectNoteLockState } from '../../src/core/security/vaultLockHelpers';
import { ArrowLeft, FileQuestion, Lock, ShieldCheck, WifiOff, RefreshCw } from 'lucide-react-native';

export default function NoteEditorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, isAuthenticated, isGuest } = useAuth();
  const {
    unlockedNoteIds,
    unlockedFolderPaths,
    promptUnlockNote,
    relockNoteOnEditorExit,
  } = useSecurity();
  const {
    notes,
    folders,
    updateNote,
    deleteNote,
    refreshFromDB,
    registerActiveEditorNote,
    getPageOneNoteIds,
  } = useNotesStore();

  const [localNote, setLocalNote] = useState<NoteItem | null>(null);
  const [isResolving, setIsResolving] = useState<boolean>(true);
  const [isOfflineUnavailable, setIsOfflineUnavailable] = useState<boolean>(false);
  const [retryNonce, setRetryNonce] = useState<number>(0);
  const didAutoPromptRef = useRef<string | null>(null);
  const isClosingRef = useRef<boolean>(false);

  // Look up note from store, local SQLite, or on-demand Supabase cloud hydration
  useEffect(() => {
    let isMounted = true;

    async function resolveNote() {
      if (!id) {
        if (isMounted) setIsResolving(false);
        return;
      }

      if (isMounted) {
        setIsResolving(true);
        setIsOfflineUnavailable(false);
      }

      // If we already have a hydrated non-dehydrated note loaded for this ID (and not retrying), skip
      if (localNote && retryNonce === 0) {
        if (localNote.id === id && !localNote.isDehydrated) {
          if (isMounted) setIsResolving(false);
          return;
        }
        if (id === 'new' && localNote.id.startsWith('draft-')) {
          if (isMounted) setIsResolving(false);
          return;
        }
      }

      // 1. Handling for a brand new note (Pristine In-Memory Draft)
      if (id === 'new') {
        const draftId = `draft-${Date.now()}`;
        const draftNote: NoteItem = {
          id: draftId,
          userId: isAuthenticated && !isGuest ? userId : 'user-default',
          folderPath: 'General',
          title: '',
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

      registerActiveEditorNote(id);

      try {
        const storeMatch = notes.find((n) => n.id === id);
        const dbMatch = await notesRepo.getNoteById(id);
        const hasPendingLocalEdits = await syncEngine.hasPendingChanges('note', id);

        // If Guest Mode OR (dirty local copy is non-dehydrated with full blocks), open immediately (<2ms) from local SQLite
        const localNonDehydrated =
          dbMatch && !dbMatch.isDehydrated && dbMatch.blocks.length > 0
            ? dbMatch
            : storeMatch && !storeMatch.isDehydrated && storeMatch.blocks.length > 0
            ? storeMatch
            : null;

        if (isGuest || !isAuthenticated || (hasPendingLocalEdits && localNonDehydrated)) {
          let candidate = localNonDehydrated || dbMatch || storeMatch || null;

          if (candidate && isAuthenticated && !isGuest && userId && candidate.blocks?.length > 0) {
            const hydratedMediaBlocks = await googleDriveVaultService.hydrateNoteMediaToTempCache(
              candidate.id,
              candidate.blocks,
              userId
            );
            candidate = { ...candidate, blocks: hydratedMediaBlocks };
          }

          if (isMounted) {
            if (candidate) {
              setLocalNote(candidate);
            }
            setIsResolving(false);
          }
          return;
        }

        // Logged-In Mode (Clean): Hydrate full `blocks_json` on demand from Supabase
        if (isSupabaseConfigured()) {
          try {
            const cloudNote = await syncEngine.fetchFullNoteFromCloud(id);
            if (cloudNote) {
              const hydrated = await leanCacheManager.hydrateNoteForEditing(cloudNote);
              const hydratedMediaBlocks = userId
                ? await googleDriveVaultService.hydrateNoteMediaToTempCache(
                    hydrated.id,
                    hydrated.blocks,
                    userId
                  )
                : hydrated.blocks;
              const hydratedWithMedia: NoteItem = {
                ...hydrated,
                blocks: hydratedMediaBlocks,
              };
              if (isMounted) {
                setLocalNote(hydratedWithMedia);
                updateNote(hydratedWithMedia);
                setIsResolving(false);
              }
              return;
            }
            // Note no longer exists on cloud and was not dirty locally
            if (isMounted) {
              setLocalNote(null);
              setIsResolving(false);
            }
            return;
          } catch (cloudErr) {
            console.warn(`Cloud hydration offline/failed for note ${id}:`, cloudErr);
            // Fall back cleanly if non-dehydrated blocks happen to exist in local working cache
            if (dbMatch && !dbMatch.isDehydrated && dbMatch.blocks.length > 0) {
              if (isMounted) {
                setLocalNote(dbMatch);
                setIsResolving(false);
              }
              return;
            }
            if (isMounted) {
              setIsOfflineUnavailable(true);
              setIsResolving(false);
            }
            return;
          }
        }

        // Fallback if Supabase credentials are unset
        const fallbackNote = dbMatch || storeMatch || null;
        if (isMounted) {
          setLocalNote(fallbackNote);
          setIsResolving(false);
        }
      } catch (err) {
        console.warn(`Failed to resolve note ${id}:`, err);
        if (isMounted) setIsResolving(false);
      }
    }

    resolveNote();

    return () => {
      isMounted = false;
    };
  }, [id, retryNonce, isAuthenticated, isGuest, userId]);

  // Flush pending deltas immediately when app moves to background while Editor is open
  useEffect(() => {
    if (isGuest || !isAuthenticated) return;

    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        syncEngine.flushNow().catch(() => {});
      }
    });

    return () => {
      sub.remove();
    };
  }, [isAuthenticated, isGuest]);

  // Immediate-on-exit auto-relock + Cloud Flush + Lean Local Eviction + Drive Temp Cache Purge on Editor unmount
  useEffect(() => {
    isClosingRef.current = false;
    const activeId = localNote?.id;
    return () => {
      isClosingRef.current = true;
      if (activeId && !activeId.startsWith('draft-')) {
        relockNoteOnEditorExit(activeId);
        googleDriveVaultService.purgeNoteTempCache(activeId).catch(() => {});
        if (isAuthenticated && !isGuest) {
          syncEngine
            .flushNow()
            .catch(() => {})
            .finally(() => {
              leanCacheManager
                .dehydrateNoteAfterSync(activeId, getPageOneNoteIds())
                .catch(() => {});
            });
        }
      }
      registerActiveEditorNote(null);
    };
  }, [localNote?.id, relockNoteOnEditorExit, isAuthenticated, isGuest, getPageOneNoteIds, registerActiveEditorNote]);

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

  const handleClose = async () => {
    isClosingRef.current = true;
    const activeId = localNote?.id;
    if (activeId && !activeId.startsWith('draft-')) {
      relockNoteOnEditorExit(activeId);
      await googleDriveVaultService.purgeNoteTempCache(activeId).catch(() => {});
      if (isAuthenticated && !isGuest) {
        await syncEngine.flushNow().catch(() => {});
        await leanCacheManager.dehydrateNoteAfterSync(activeId, getPageOneNoteIds()).catch(() => {});
      }
    }
    registerActiveEditorNote(null);
    refreshFromDB();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  const handleNoteUpdated = (updated: NoteItem) => {
    setLocalNote(updated);
    if (updated.id && !updated.id.startsWith('draft-')) {
      registerActiveEditorNote(updated.id);
    }
    updateNote(updated);
    // When a draft receives its first committed action, replace URL from /note/new to /note/<realId>
    if (id === 'new' && updated.id && !updated.id.startsWith('draft-')) {
      router.replace(`/note/${updated.id}`);
    }
  };

  const handleNoteDeleted = (noteId: string) => {
    registerActiveEditorNote(null);
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

  // Offline Evicted Cloud Note State
  if (isOfflineUnavailable) {
    return (
      <View
        className="flex-1 bg-light-appBg dark:bg-dark-appBg items-center justify-center px-6"
        style={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <View className="w-16 h-16 rounded-full bg-light-surface dark:bg-dark-surface items-center justify-center mb-4 shadow-sm border border-light-border dark:border-dark-border">
          <WifiOff size={28} color={isDark ? '#B5B5B5' : '#626262'} />
        </View>
        <Text className="text-xl font-bold text-light-textPrimary dark:text-white tracking-tight text-center mb-2">
          Reconnect to load this note from cloud
        </Text>
        <Text className="text-sm text-light-textMuted dark:text-dark-textMuted text-center max-w-sm mb-6">
          Your device stays lean by storing older notes in Supabase. Reconnect to the internet to fetch and edit this note.
        </Text>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.replace('/home')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back to Notes"
            className="flex-row items-center gap-2 px-5 py-3 rounded-full bg-light-border dark:bg-dark-raised active:opacity-80"
          >
            <ArrowLeft size={16} color={isDark ? '#F7F7F7' : '#171717'} strokeWidth={2.2} />
            <Text className="text-sm font-bold text-light-textPrimary dark:text-dark-textPrimary">
              Back to Notes
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setRetryNonce((n) => n + 1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Retry loading note"
            className="flex-row items-center gap-2 px-5 py-3 rounded-full bg-light-iconBg dark:bg-white shadow-sm active:opacity-85"
          >
            <RefreshCw size={16} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2.2} />
            <Text className="text-sm font-bold text-white dark:text-[#111111]">Retry</Text>
          </Pressable>
        </View>
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
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to Notes"
          className="flex-row items-center gap-2 px-5 py-3 rounded-full bg-light-iconBg dark:bg-white shadow-sm"
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.96 }] } : undefined)}
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

