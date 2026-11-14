import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  Clock,
  FileText,
  FolderLock,
  KeyRound,
  Lock,
  LockOpen,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../src/theme';
import { NoteColors } from '../../src/theme/tokens';
import { useSecurity } from '../../src/context';
import { useNotesStore } from '../../src/state/useNotesStore';
import { securityRepo } from '../../src/db/securityRepo';
import { DBFolder } from '../../src/db/types';
import { NoteItem } from '../../src/types/note';
import {
  countNotesUnderFolder,
  isFolderEffectivelyLocked,
} from '../../src/core/security/vaultLockHelpers';

const AUTO_RELOCK_OPTIONS = [
  { seconds: 0, label: 'Immediate on Exit' },
  { seconds: 60, label: '1 min' },
  { seconds: 300, label: '5 mins' },
  { seconds: 900, label: '15 mins' },
  { seconds: -1, label: 'On Background' },
];

export default function ManagePinPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const {
    securityConfig,
    hasMasterConfigured,
    unlockedNoteIds,
    unlockedFolderPaths,
    activeUnlockedCount,
    setupMasterCredential,
    clearMasterCredential,
    setAppLockEnabled,
    setAutoRelockSeconds,
    setBiometricsEnabled,
    lockNow,
    promptConfigureLock,
    promptVerifyTargetCredential,
    promptVerifyMaster,
    promptSetupOrChangeMaster,
    promptUnlockNote,
    promptUnlockFolder,
  } = useSecurity();

  const {
    notes,
    folders,
    lockNote,
    unlockNoteForever,
    lockFolder,
    unlockFolderForever,
  } = useNotesStore();

  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showNotePicker, setShowNotePicker] = useState(false);
  const [notePickerQuery, setNotePickerQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const lockedFolders = useMemo(
    () => folders.filter((f) => f.is_locked === 1),
    [folders]
  );
  const unlockedCandidatesFolders = useMemo(
    () => folders.filter((f) => f.is_locked !== 1 && !f.is_archived),
    [folders]
  );

  const directlyLockedNotes = useMemo(
    () => notes.filter((n) => n.isLocked && n.status !== 'trashed'),
    [notes]
  );
  const unlockedCandidateNotes = useMemo(
    () => notes.filter((n) => !n.isLocked && n.status !== 'trashed'),
    [notes]
  );

  const filteredCandidateNotes = useMemo(() => {
    const q = notePickerQuery.trim().toLowerCase();
    if (!q) return unlockedCandidateNotes;
    return unlockedCandidateNotes.filter((n) => {
      const title = (n.title || 'Untitled Note').toLowerCase();
      const folder = (n.folderPath || 'General').toLowerCase();
      return title.includes(q) || folder.includes(q);
    });
  }, [unlockedCandidateNotes, notePickerQuery]);

  const inheritedLockedByFolderCount = useMemo(
    () =>
      notes.filter(
        (n) =>
          !n.isLocked &&
          n.status !== 'trashed' &&
          isFolderEffectivelyLocked(n.folderPath, folders, new Set())
      ).length,
    [notes, folders]
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings');
    }
  };

  const handleToggleAppLock = async (nextVal: boolean) => {
    setStatusMessage(null);
    if (nextVal) {
      if (!hasMasterConfigured) {
        const created = await promptSetupOrChangeMaster('create');
        if (!created) return;
      }
      await setAppLockEnabled(true);
      setStatusMessage('App Startup Lock enabled.');
      return;
    }

    // Require Master verification before disabling App Startup Lock
    if (hasMasterConfigured) {
      const ok = await promptVerifyMaster({
        title: 'Disable App Startup Lock',
        subtitle: 'Confirm your Master PIN or Password before disabling startup protection.',
        confirmLabel: 'Disable Lock',
      });
      if (!ok) return;
    }

    await setAppLockEnabled(false);
    setStatusMessage('App Startup Lock disabled.');
  };

  const handleClearMaster = async () => {
    setStatusMessage(null);
    if (!hasMasterConfigured) return;

    const verified = await promptVerifyMaster({
      title: 'Clear Master Credential',
      subtitle: 'Verify your current Master credential before removing it.',
      confirmLabel: 'Continue',
    });
    if (!verified) return;

    const masterCounts = await securityRepo.countMasterLockedItems();
    if (masterCounts.total > 0) {
      if (Platform.OS === 'web') {
        const confirmed =
          typeof window !== 'undefined'
            ? window.confirm(
                `${masterCounts.folders} folder(s) and ${masterCounts.notes} note(s) currently use your Master Credential. Clearing Master will permanently unlock those items (Custom-locked items remain strictly untouched). Continue?`
              )
            : true;
        if (!confirmed) return;
        await clearMasterCredential({ unlockMasterLockedItems: true });
        setStatusMessage('Master credential cleared and Master-locked items unlocked.');
        return;
      }
      Alert.alert(
        'Unlock Master-Locked Items?',
        `${masterCounts.folders} folder(s) and ${masterCounts.notes} note(s) currently use your Master Credential. Clearing Master will permanently unlock those items (Custom-locked items remain strictly untouched).`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear & Unlock Master Items',
            style: 'destructive',
            onPress: async () => {
              await clearMasterCredential({ unlockMasterLockedItems: true });
              setStatusMessage('Master credential cleared and Master-locked items unlocked.');
            },
          },
        ]
      );
      return;
    }

    await clearMasterCredential({ unlockMasterLockedItems: false });
    setStatusMessage('Master credential cleared.');
  };

  const handleLockFolderPick = async (folder: DBFolder) => {
    const payload = await promptConfigureLock({
      targetLabel: `Folder: ${folder.path}`,
      entityType: 'folder',
    });
    if (!payload) return;
    await lockFolder(folder.id, folder.path, payload);
    setShowFolderPicker(false);
    setStatusMessage(`Folder "${folder.name}" locked.`);
  };

  const handleUnlockFolderForever = async (folder: DBFolder) => {
    const lockType = folder.lock_type === 'custom' ? 'custom' : 'master';
    const verified = await promptVerifyTargetCredential({
      title: `Remove Lock: "${folder.name}"`,
      subtitle:
        lockType === 'custom'
          ? 'Enter this folder’s Custom PIN/Password to permanently unlock it.'
          : 'Enter your Workspace Master credential to permanently unlock this folder.',
      lockType,
      credentialKind: folder.lock_credential_kind,
      customHash: folder.lock_hash,
      customSalt: folder.lock_salt,
      hint: folder.lock_hint,
      rateLimitKey: `folder:${folder.id}`,
      confirmLabel: 'Unlock Forever',
    });
    if (!verified) return;
    await unlockFolderForever(folder.id);
    setStatusMessage(`Removed lock from folder "${folder.name}".`);
  };

  const handleChangeFolderLock = async (folder: DBFolder) => {
    const lockType = folder.lock_type === 'custom' ? 'custom' : 'master';
    const verified = await promptVerifyTargetCredential({
      title: `Verify "${folder.name}"`,
      subtitle:
        lockType === 'custom'
          ? 'Custom PIN/Password required before changing this folder’s lock.'
          : 'Verify your Master credential before changing this folder’s lock.',
      lockType,
      credentialKind: folder.lock_credential_kind,
      customHash: folder.lock_hash,
      customSalt: folder.lock_salt,
      hint: folder.lock_hint,
      rateLimitKey: `folder:${folder.id}`,
      confirmLabel: 'Verify',
    });
    if (!verified) return;

    const payload = await promptConfigureLock({
      targetLabel: `Change Lock — Folder: ${folder.path}`,
      entityType: 'folder',
      initialLockType: lockType,
      initialHint: folder.lock_hint,
    });
    if (!payload) return;
    await lockFolder(folder.id, folder.path, payload);
    setStatusMessage(`Updated lock for folder "${folder.name}".`);
  };

  const handleLockNotePick = async (note: NoteItem) => {
    const payload = await promptConfigureLock({
      targetLabel: note.title || 'Untitled Note',
      entityType: 'note',
    });
    if (!payload) return;
    await lockNote(note.id, payload);
    setShowNotePicker(false);
    setNotePickerQuery('');
    setStatusMessage(`Note "${note.title || 'Untitled Note'}" locked.`);
  };

  const handleUnlockNoteForever = async (note: NoteItem) => {
    const lockType = note.lockType === 'custom' ? 'custom' : 'master';
    const verified = await promptVerifyTargetCredential({
      title: `Remove Lock: "${note.title || 'Untitled Note'}"`,
      subtitle:
        lockType === 'custom'
          ? 'Strict Custom Isolation: requires this note’s Custom PIN/Password.'
          : 'Enter your Master credential to permanently unlock this note.',
      lockType,
      credentialKind: note.lockCredentialKind,
      customHash: note.lockHash,
      customSalt: note.lockSalt,
      hint: note.lockHint,
      rateLimitKey: `note:${note.id}`,
      confirmLabel: 'Unlock Forever',
    });
    if (!verified) return;
    await unlockNoteForever(note.id);
    setStatusMessage(`Removed lock from "${note.title || 'Untitled Note'}".`);
  };

  const handleChangeNoteLock = async (note: NoteItem) => {
    const lockType = note.lockType === 'custom' ? 'custom' : 'master';
    const verified = await promptVerifyTargetCredential({
      title: `Verify "${note.title || 'Untitled Note'}"`,
      subtitle:
        lockType === 'custom'
          ? 'Custom PIN/Password required before changing this note’s lock.'
          : 'Verify Master credential before updating this note’s lock.',
      lockType,
      credentialKind: note.lockCredentialKind,
      customHash: note.lockHash,
      customSalt: note.lockSalt,
      hint: note.lockHint,
      rateLimitKey: `note:${note.id}`,
      confirmLabel: 'Verify',
    });
    if (!verified) return;

    const payload = await promptConfigureLock({
      targetLabel: `Change Lock — ${note.title || 'Untitled Note'}`,
      entityType: 'note',
      initialLockType: lockType,
      initialHint: note.lockHint,
    });
    if (!payload) return;
    await lockNote(note.id, payload);
    setStatusMessage(`Updated lock for "${note.title || 'Untitled Note'}".`);
  };

  const handleOpenLockedNote = async (note: NoteItem) => {
    const ok = await promptUnlockNote(note, folders);
    if (ok) {
      router.push(`/note/${note.id}`);
    }
  };

  return (
    <View
      className="flex-1 bg-light-surface dark:bg-dark-surface"
      style={{ paddingTop: Math.max(insets.top, 8), paddingBottom: insets.bottom }}
    >
      {/* Top Bar */}
      <View
        className="flex-row items-center justify-between px-4 md:px-8 pb-3 border-b"
        style={{ borderColor: colors.borderSubtle }}
      >
        <View className="flex-row items-center gap-3 flex-1 pr-2">
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Back to Settings"
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-75"
            style={{ backgroundColor: isDark ? '#303030' : '#F1F3F7' }}
          >
            <ChevronLeft size={20} color={colors.textPrimary} strokeWidth={2.2} />
          </Pressable>
          <View className="flex-1">
            <Text
              className="text-[19px] font-black tracking-tight"
              style={{ color: colors.textPrimary }}
            >
              Manage PIN / Password
            </Text>
            <Text className="text-[12px]" style={{ color: colors.textMuted }}>
              Zero-knowledge Master & Custom vault controls
            </Text>
          </View>
        </View>

        {((securityConfig.appLockEnabled && hasMasterConfigured) || activeUnlockedCount > 0) && (
          <Pressable
            onPress={lockNow}
            accessibilityRole="button"
            accessibilityLabel="Lock All Sessions Now"
            className="flex-row items-center gap-1.5 px-3 py-2 rounded-full active:opacity-80"
            style={{
              backgroundColor: isDark ? 'rgba(177, 138, 243, 0.16)' : '#F2ECFE',
            }}
          >
            <Lock size={14} color={NoteColors.lavender} strokeWidth={2.3} />
            <Text className="text-[12px] font-extrabold" style={{ color: NoteColors.lavender }}>
              Lock Now
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        className="flex-1 px-4 md:px-8"
        contentContainerStyle={{ paddingVertical: 18, paddingBottom: 40 }}
      >
        {statusMessage ? (
          <View
            className="flex-row items-center justify-between px-3.5 py-2.5 rounded-2xl mb-4"
            style={{
              backgroundColor: isDark ? 'rgba(8, 196, 229, 0.14)' : '#ECFEFF',
            }}
          >
            <Text className="text-[12.5px] font-bold flex-1" style={{ color: NoteColors.cyan }}>
              {statusMessage}
            </Text>
            <Pressable onPress={() => setStatusMessage(null)} hitSlop={8}>
              <Text className="text-[12px] font-bold" style={{ color: colors.textMuted }}>
                Dismiss
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* SECTION 1: MASTER CREDENTIAL & APP STARTUP LOCK */}
        <View className="pb-5 mb-5 border-b" style={{ borderColor: colors.borderSubtle }}>
          <View className="flex-row items-center gap-2 mb-3">
            <KeyRound size={16} color={NoteColors.cyan} strokeWidth={2.2} />
            <Text
              className="text-[13px] font-extrabold uppercase tracking-wider"
              style={{ color: colors.textMuted }}
            >
              Master Credential & App Startup
            </Text>
          </View>

          <View className="flex-row items-center justify-between py-2.5">
            <View className="flex-1 pr-3">
              <Text className="text-[15.5px] font-bold" style={{ color: colors.textPrimary }}>
                {hasMasterConfigured
                  ? `Master ${
                      securityConfig.masterCredentialType === 'password' ? 'Password' : 'PIN'
                    } Configured`
                  : 'No Master Credential Set'}
              </Text>
              <Text className="text-[12.5px] mt-0.5" style={{ color: colors.textSecondary }}>
                {hasMasterConfigured
                  ? securityConfig.masterHint
                    ? 'Hint saved • Works across Logged-In and Guest mode'
                    : 'Active across both Logged-In and Guest modes'
                  : 'Create one Master PIN or Password for App Startup Lock and quick locks.'}
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={async () => {
                  const ok = await promptSetupOrChangeMaster(
                    hasMasterConfigured ? 'change' : 'create'
                  );
                  if (ok) {
                    setStatusMessage(
                      hasMasterConfigured
                        ? 'Master credential updated.'
                        : 'Master credential created.'
                    );
                  }
                }}
                className="px-3.5 py-2 rounded-full active:opacity-80"
                style={{ backgroundColor: NoteColors.cyan }}
              >
                <Text className="text-[12.5px] font-extrabold text-[#171717]">
                  {hasMasterConfigured ? 'Change' : 'Set Up Master'}
                </Text>
              </Pressable>

              {hasMasterConfigured && (
                <Pressable
                  onPress={handleClearMaster}
                  className="px-3 py-2 rounded-full border active:opacity-75"
                  style={{ borderColor: colors.borderSubtle }}
                >
                  <Text className="text-[12.5px] font-bold" style={{ color: NoteColors.coral }}>
                    Clear
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* App Startup Lock Switch */}
          <View className="flex-row items-center justify-between py-3 mt-1">
            <View className="flex-1 pr-4">
              <Text className="text-[15px] font-bold" style={{ color: colors.textPrimary }}>
                Require Lock on App Startup
              </Text>
              <Text className="text-[12px] mt-0.5" style={{ color: colors.textSecondary }}>
                Locks workspace on launch and background return (both Account & Guest mode).
              </Text>
            </View>
            <Switch
              value={securityConfig.appLockEnabled}
              onValueChange={handleToggleAppLock}
              trackColor={{ false: colors.borderSubtle, true: NoteColors.cyan }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Biometrics Preference */}
          <View className="flex-row items-center justify-between py-2">
            <View className="flex-1 pr-4">
              <Text className="text-[14.5px] font-bold" style={{ color: colors.textPrimary }}>
                Biometric Unlock Preference
              </Text>
              <Text className="text-[11.5px] mt-0.5" style={{ color: colors.textMuted }}>
                Master PIN/Password always stays required as the active fallback on this runtime.
              </Text>
            </View>
            <Switch
              value={securityConfig.biometricsEnabled}
              onValueChange={async (val) => {
                await setBiometricsEnabled(val);
              }}
              trackColor={{ false: colors.borderSubtle, true: NoteColors.lavender }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* SECTION 2: AUTO-RELOCK LIFECYCLE */}
        <View className="pb-5 mb-5 border-b" style={{ borderColor: colors.borderSubtle }}>
          <View className="flex-row items-center gap-2 mb-2.5">
            <Clock size={16} color={NoteColors.apricot} strokeWidth={2.2} />
            <Text
              className="text-[13px] font-extrabold uppercase tracking-wider"
              style={{ color: colors.textMuted }}
            >
              Session Auto-Relock Policy
            </Text>
          </View>
          <Text className="text-[12.5px] mb-3" style={{ color: colors.textSecondary }}>
            Choose how long an unlocked note or folder stays accessible before re-locking automatically.
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {AUTO_RELOCK_OPTIONS.map((opt) => {
              const selected = securityConfig.autoRelockSeconds === opt.seconds;
              return (
                <Pressable
                  key={opt.seconds}
                  onPress={() => setAutoRelockSeconds(opt.seconds)}
                  className="px-3.5 py-2 rounded-full border active:opacity-80"
                  style={{
                    backgroundColor: selected
                      ? NoteColors.apricot
                      : isDark
                      ? '#2C2C2C'
                      : '#F8FAFC',
                    borderColor: selected ? 'transparent' : colors.borderSubtle,
                  }}
                >
                  <Text
                    className="text-[12.5px] font-bold"
                    style={{ color: selected ? '#171717' : colors.textSecondary }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* SECTION 3: LOCKED FOLDERS REGISTRY */}
        <View className="pb-5 mb-5 border-b" style={{ borderColor: colors.borderSubtle }}>
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <FolderLock size={16} color={NoteColors.lavender} strokeWidth={2.2} />
              <Text
                className="text-[13px] font-extrabold uppercase tracking-wider"
                style={{ color: colors.textMuted }}
              >
                Locked Folders ({lockedFolders.length})
              </Text>
            </View>

            <Pressable
              onPress={() => setShowFolderPicker((prev) => !prev)}
              className="flex-row items-center gap-1 px-3 py-1.5 rounded-full active:opacity-80"
              style={{
                backgroundColor: isDark ? '#303030' : '#EEF1F6',
              }}
            >
              <Plus size={14} color={colors.textPrimary} strokeWidth={2.5} />
              <Text className="text-[12px] font-bold" style={{ color: colors.textPrimary }}>
                {showFolderPicker ? 'Hide Picker' : 'Lock Folder'}
              </Text>
            </Pressable>
          </View>

          {showFolderPicker && (
            <View
              className="p-3 rounded-2xl border mb-3"
              style={{
                backgroundColor: isDark ? '#282828' : '#F8FAFC',
                borderColor: colors.borderSubtle,
              }}
            >
              <Text className="text-[12px] font-bold mb-2" style={{ color: colors.textSecondary }}>
                Select an unlocked folder to protect:
              </Text>
              {unlockedCandidatesFolders.length === 0 ? (
                <Text className="text-[12px]" style={{ color: colors.textMuted }}>
                  All active folders are already locked.
                </Text>
              ) : (
                <View className="gap-1.5">
                  {unlockedCandidatesFolders.map((folder) => (
                    <Pressable
                      key={folder.id}
                      onPress={() => handleLockFolderPick(folder)}
                      className="flex-row items-center justify-between px-3 py-2 rounded-xl border active:opacity-75"
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.borderSubtle,
                      }}
                    >
                      <Text className="text-[13px] font-semibold" style={{ color: colors.textPrimary }}>
                        {folder.path}
                      </Text>
                      <Text className="text-[11.5px] font-bold" style={{ color: NoteColors.cyan }}>
                        Lock
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {lockedFolders.length === 0 ? (
            <Text className="text-[13px] py-2" style={{ color: colors.textMuted }}>
              No folders are currently locked. Locking a folder protects every note and subfolder inside it.
            </Text>
          ) : (
            <View className="gap-2.5">
              {lockedFolders.map((folder) => {
                const isCustom = folder.lock_type === 'custom';
                const isSessionUnlocked = unlockedFolderPaths.has(folder.path);
                const noteCount = countNotesUnderFolder(folder.path, notes);

                return (
                  <View
                    key={folder.id}
                    className="p-3.5 rounded-2xl border"
                    style={{
                      backgroundColor: isDark ? '#2B2B2B' : '#FAFBFD',
                      borderColor: colors.borderSubtle,
                    }}
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-2">
                        <View className="flex-row items-center gap-2 flex-wrap">
                          <Text
                            className="text-[14.5px] font-extrabold"
                            style={{ color: colors.textPrimary }}
                          >
                            {folder.path}
                          </Text>
                          <View
                            className="px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: isCustom
                                ? 'rgba(177, 138, 243, 0.16)'
                                : 'rgba(8, 196, 229, 0.14)',
                            }}
                          >
                            <Text
                              className="text-[10.5px] font-bold"
                              style={{
                                color: isCustom ? NoteColors.lavender : NoteColors.cyan,
                              }}
                            >
                              {isCustom ? 'Custom PIN/Pass' : 'Master'}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-[12px] mt-1" style={{ color: colors.textMuted }}>
                          {noteCount} note{noteCount === 1 ? '' : 's'} protected •{' '}
                          {isSessionUnlocked ? 'Temporarily unlocked' : 'Locked'}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => promptUnlockFolder(folder, folders)}
                        hitSlop={8}
                        className="px-2.5 py-1 rounded-full active:opacity-75"
                        style={{ backgroundColor: isDark ? '#383838' : '#EEF1F6' }}
                      >
                        <Text className="text-[11px] font-bold" style={{ color: colors.textPrimary }}>
                          {isSessionUnlocked ? 'Verified' : 'Session Unlock'}
                        </Text>
                      </Pressable>
                    </View>

                    <View className="flex-row items-center gap-2 mt-3">
                      <Pressable
                        onPress={() => handleChangeFolderLock(folder)}
                        className="flex-row items-center gap-1 px-3 py-1.5 rounded-full border active:opacity-75"
                        style={{ borderColor: colors.borderSubtle }}
                      >
                        <RefreshCw size={12} color={colors.textSecondary} />
                        <Text className="text-[12px] font-bold" style={{ color: colors.textSecondary }}>
                          Change Lock
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleUnlockFolderForever(folder)}
                        className="flex-row items-center gap-1 px-3 py-1.5 rounded-full active:opacity-75"
                        style={{ backgroundColor: 'rgba(255, 146, 119, 0.16)' }}
                      >
                        <Unlock size={12} color={NoteColors.coral} />
                        <Text className="text-[12px] font-bold" style={{ color: NoteColors.coral }}>
                          Unlock Forever
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* SECTION 4: LOCKED NOTES REGISTRY */}
        <View>
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <FileText size={16} color={NoteColors.cyan} strokeWidth={2.2} />
              <Text
                className="text-[13px] font-extrabold uppercase tracking-wider"
                style={{ color: colors.textMuted }}
              >
                Locked Notes ({directlyLockedNotes.length})
              </Text>
            </View>

            <Pressable
              onPress={() => {
                setShowNotePicker((prev) => !prev);
                setNotePickerQuery('');
              }}
              className="flex-row items-center gap-1 px-3 py-1.5 rounded-full active:opacity-80"
              style={{
                backgroundColor: isDark ? '#303030' : '#EEF1F6',
              }}
            >
              <Plus size={14} color={colors.textPrimary} strokeWidth={2.5} />
              <Text className="text-[12px] font-bold" style={{ color: colors.textPrimary }}>
                {showNotePicker ? 'Hide Picker' : 'Lock Note'}
              </Text>
            </Pressable>
          </View>

          {inheritedLockedByFolderCount > 0 && (
            <View
              className="flex-row items-center gap-2 px-3 py-2 rounded-xl mb-3"
              style={{
                backgroundColor: isDark ? 'rgba(177, 138, 243, 0.12)' : '#F5F3FF',
              }}
            >
              <ShieldAlert size={14} color={NoteColors.lavender} />
              <Text className="text-[12px] font-semibold flex-1" style={{ color: colors.textSecondary }}>
                {inheritedLockedByFolderCount} additional note
                {inheritedLockedByFolderCount === 1 ? ' is' : 's are'} also automatically locked inside locked folders above.
              </Text>
            </View>
          )}

          {showNotePicker && (
            <View
              className="p-3 rounded-2xl border mb-3"
              style={{
                backgroundColor: isDark ? '#282828' : '#F8FAFC',
                borderColor: colors.borderSubtle,
              }}
            >
              <Text className="text-[12px] font-bold mb-2" style={{ color: colors.textSecondary }}>
                Select an unlocked note to protect:
              </Text>
              {unlockedCandidateNotes.length === 0 ? (
                <Text className="text-[12px]" style={{ color: colors.textMuted }}>
                  No unlocked notes available.
                </Text>
              ) : (
                <View>
                  <View
                    className="flex-row items-center gap-2 px-3 py-1.5 rounded-xl border mb-2"
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.borderSubtle,
                    }}
                  >
                    <Search size={14} color={colors.textMuted} />
                    <TextInput
                      value={notePickerQuery}
                      onChangeText={setNotePickerQuery}
                      placeholder="Search notes by title or folder..."
                      placeholderTextColor={colors.textMuted}
                      className="flex-1 text-[13px] py-1 outline-none"
                      style={{ color: colors.textPrimary, outlineStyle: 'none' } as any}
                    />
                    {notePickerQuery.length > 0 && (
                      <Pressable
                        onPress={() => setNotePickerQuery('')}
                        hitSlop={8}
                        className="w-6 h-6 rounded-full items-center justify-center active:opacity-70"
                      >
                        <X size={13} color={colors.textMuted} />
                      </Pressable>
                    )}
                  </View>

                  {filteredCandidateNotes.length === 0 ? (
                    <Text className="text-[12px] py-2" style={{ color: colors.textMuted }}>
                      No unlocked notes match &ldquo;{notePickerQuery.trim()}&rdquo;.
                    </Text>
                  ) : (
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      style={{ maxHeight: 280 }}
                      contentContainerStyle={{ gap: 6 }}
                    >
                      {filteredCandidateNotes.map((note) => (
                        <Pressable
                          key={note.id}
                          onPress={() => handleLockNotePick(note)}
                          className="flex-row items-center justify-between px-3 py-2 rounded-xl border active:opacity-75"
                          style={{
                            backgroundColor: colors.surface,
                            borderColor: colors.borderSubtle,
                          }}
                        >
                          <View className="flex-1 pr-2">
                            <Text
                              numberOfLines={1}
                              className="text-[13px] font-semibold"
                              style={{ color: colors.textPrimary }}
                            >
                              {note.title || 'Untitled Note'}
                            </Text>
                            <Text className="text-[11px]" style={{ color: colors.textMuted }}>
                              {note.folderPath || 'General'}
                            </Text>
                          </View>
                          <Text className="text-[11.5px] font-bold" style={{ color: NoteColors.cyan }}>
                            Lock
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>
          )}

          {directlyLockedNotes.length === 0 ? (
            <Text className="text-[13px] py-2" style={{ color: colors.textMuted }}>
              No notes are individually locked yet.
            </Text>
          ) : (
            <View className="gap-2.5">
              {directlyLockedNotes.map((note) => {
                const isCustom = note.lockType === 'custom';
                const isSessionUnlocked = unlockedNoteIds.has(note.id);

                return (
                  <View
                    key={note.id}
                    className="p-3.5 rounded-2xl border"
                    style={{
                      backgroundColor: isDark ? '#2B2B2B' : '#FAFBFD',
                      borderColor: colors.borderSubtle,
                    }}
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-2">
                        <View className="flex-row items-center gap-2 flex-wrap">
                          <Text
                            numberOfLines={1}
                            className="text-[14.5px] font-extrabold"
                            style={{ color: colors.textPrimary }}
                          >
                            {note.title || 'Untitled Note'}
                          </Text>
                          <View
                            className="px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: isCustom
                                ? 'rgba(177, 138, 243, 0.16)'
                                : 'rgba(8, 196, 229, 0.14)',
                            }}
                          >
                            <Text
                              className="text-[10.5px] font-bold"
                              style={{
                                color: isCustom ? NoteColors.lavender : NoteColors.cyan,
                              }}
                            >
                              {isCustom ? 'Custom PIN/Pass' : 'Master'}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-[12px] mt-1" style={{ color: colors.textMuted }}>
                          {note.folderPath || 'General'} •{' '}
                          {isSessionUnlocked ? 'Temporarily unlocked' : 'Locked'}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => handleOpenLockedNote(note)}
                        hitSlop={8}
                        className="px-2.5 py-1 rounded-full active:opacity-75"
                        style={{ backgroundColor: isDark ? '#383838' : '#EEF1F6' }}
                      >
                        <Text className="text-[11px] font-bold" style={{ color: colors.textPrimary }}>
                          Open
                        </Text>
                      </Pressable>
                    </View>

                    <View className="flex-row items-center gap-2 mt-3">
                      <Pressable
                        onPress={() => handleChangeNoteLock(note)}
                        className="flex-row items-center gap-1 px-3 py-1.5 rounded-full border active:opacity-75"
                        style={{ borderColor: colors.borderSubtle }}
                      >
                        <RefreshCw size={12} color={colors.textSecondary} />
                        <Text className="text-[12px] font-bold" style={{ color: colors.textSecondary }}>
                          Change Lock
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleUnlockNoteForever(note)}
                        className="flex-row items-center gap-1 px-3 py-1.5 rounded-full active:opacity-75"
                        style={{ backgroundColor: 'rgba(255, 146, 119, 0.16)' }}
                      >
                        <LockOpen size={12} color={NoteColors.coral} />
                        <Text className="text-[12px] font-bold" style={{ color: NoteColors.coral }}>
                          Unlock Forever
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
