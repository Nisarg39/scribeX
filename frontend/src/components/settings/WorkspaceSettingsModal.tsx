import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, Platform, ActivityIndicator, Alert, ScrollView } from 'react-native';
import {
  Database,
  DownloadCloud,
  UploadCloud,
  Trash2,
  RefreshCw,
  X,
  Check,
  Folder,
  FileText,
  CheckSquare,
  Tag,
  AlertTriangle,
  HardDrive,
  MessageSquare,
  Lock,
  Cloud,
  LogIn,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useAuth, useSecurity } from '../../context';
import { useNotesStore } from '../../state/useNotesStore';
import { workspaceBackupService } from '../../services/workspaceBackupService';
import { shareIngestService } from '../../services/share/ShareIngestService';
import { syncEngine } from '../../services/sync/syncEngine';
import { RestoreBackupModal } from './RestoreBackupModal';
import { getAncestorFolderPaths, normalizeFolderPath } from '../../core/security/vaultLockHelpers';

interface WorkspaceSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const WorkspaceSettingsModal: React.FC<WorkspaceSettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const {
    user,
    isAuthenticated,
    isGuest,
    driveAccount,
    isDriveConnected,
    connectOrSwitchDrive,
    disconnectDrive,
    refreshDriveState,
  } = useAuth();
  const {
    refreshSecurityConfig,
    promptUnlockNote,
    securityConfig,
    unlockedNoteIds,
    unlockedFolderPaths,
    relockNoteSession,
    relockFolderSession,
  } = useSecurity();

  const {
    notes,
    folders,
    tasks,
    tags,
    lockedNoteIds,
    queryRequest,
    refreshFromDB,
    emptyTrash,
    addNoteWithBlocks,
  } = useNotesStore();

  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isPurgingTrash, setIsPurgingTrash] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSimulatingShare, setIsSimulatingShare] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);

  const isGuestLocked = !isAuthenticated || isGuest;

  useEffect(() => {
    if (!visible || isGuestLocked) return;
    void refreshDriveState();
  }, [visible, isGuestLocked, refreshDriveState]);

  if (!visible) return null;

  const handleConnectOrSwitchDrive = async () => {
    if (isGuestLocked) return;
    setIsConnectingDrive(true);
    try {
      const res = await connectOrSwitchDrive();
      if (res.ok && res.account) {
        setExportNotice(`Connected Drive Vault: ${res.account.email}`);
        setTimeout(() => setExportNotice(null), 3000);
      } else if (res.error) {
        setExportNotice(res.error);
        setTimeout(() => setExportNotice(null), 3500);
      }
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (isGuestLocked) return;
    await disconnectDrive();
    setExportNotice('Disconnected Google Drive. Cloud Sync paused until reconnected.');
    setTimeout(() => setExportNotice(null), 3000);
  };

  const handleSyncNow = async () => {
    if (isGuestLocked || !isDriveConnected || isSyncingNow) return;
    setIsSyncingNow(true);
    try {
      const pushed = await syncEngine.flushNow();
      await syncEngine.pullWorkspaceMetadataFromCloud().catch(() => {});
      await refreshFromDB();
      setExportNotice(pushed > 0 ? `Synced ${pushed} update(s) to cloud` : 'Cloud vault up to date');
      setTimeout(() => setExportNotice(null), 3000);
    } catch (err: any) {
      setExportNotice(err?.message || 'Sync paused (offline)');
      setTimeout(() => setExportNotice(null), 3500);
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleSimulateWhatsAppShare = async () => {
    try {
      setIsSimulatingShare(true);
      const testPayload = {
        batchId: `sim-share-${Date.now()}`,
        subject: 'Sprint 42 Architecture & Delivery',
        text: `[14/11/26, 10:15:30 AM] Sarah: Hey team, benchmark on local SQLite replication passed with *sub-5ms latency* across all platforms.
[14/11/26, 10:16:12 AM] Marcus: That is huge! Are we shipping WhatsApp export chat capture in this cycle?
[14/11/26, 10:17:00 AM] Sarah: Yes, fully parsed into composable blocks.
POLL: Ready for release?
OPTION: Ship to Beta (9 votes)
OPTION: Run 1 more audit (2 votes)`,
        files: [],
      };

      onClose();
      await shareIngestService.ingestSharePayload(
        testPayload,
        addNoteWithBlocks,
        (noteId) => {
          router.push(`/note/${noteId}`);
        }
      );
    } catch (err) {
      console.warn('Simulate share error:', err);
    } finally {
      setIsSimulatingShare(false);
    }
  };

  const activeNotesCount = notes.filter((n) => n.status === 'active').length;
  const archivedNotesCount = notes.filter((n) => n.status === 'archived').length;
  const trashedNotesCount = notes.filter((n) => n.status === 'trashed').length;
  const pendingTasksCount = tasks.filter((t) => !t.isCompleted).length;

  const engineType =
    Platform.OS === 'web'
      ? 'SQLite WebAssembly (sql.js / Wasm + IndexedDB)'
      : `Native SQLite WAL (${Platform.OS === 'android' ? 'Android' : 'iOS'})`;

  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      setExportNotice(null);
      const res = await workspaceBackupService.exportAndSaveBackup();
      if (res.success) {
        setExportNotice(`Exported ${res.filename}`);
        setTimeout(() => setExportNotice(null), 3000);
      }
    } catch (err: any) {
      setExportNotice('Export failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfirmEmptyTrash = async () => {
    if (trashedNotesCount === 0 || isPurgingTrash) return;

    const executePurge = async () => {
      const preNoteIds = new Set(unlockedNoteIds);
      const preFolderPaths = new Set(unlockedFolderPaths);
      const touchedNoteIds = new Set<string>();
      const touchedFolderPaths = new Set<string>();
      const activeFolderPath = normalizeFolderPath(queryRequest.folderPath);

      try {
        const lockedTrashed = notes.filter(
          (n) => n.status === 'trashed' && lockedNoteIds.has(n.id)
        );
        if (lockedTrashed.length > 0) {
          onClose();
          for (const lockedCandidate of lockedTrashed) {
            touchedNoteIds.add(lockedCandidate.id);
            for (const anc of getAncestorFolderPaths(normalizeFolderPath(lockedCandidate.folderPath))) {
              touchedFolderPaths.add(anc);
            }
            const ok = await promptUnlockNote(lockedCandidate, folders);
            if (!ok) return;
          }
        }
        setIsPurgingTrash(true);
        await emptyTrash();
      } finally {
        setIsPurgingTrash(false);
        if (securityConfig.autoRelockSeconds === 0) {
          for (const id of touchedNoteIds) {
            if (!preNoteIds.has(id)) {
              relockNoteSession(id);
            }
          }
          for (const fp of touchedFolderPaths) {
            if (
              !preFolderPaths.has(fp) &&
              !(activeFolderPath && (activeFolderPath === fp || activeFolderPath.startsWith(`${fp}/`)))
            ) {
              relockFolderSession(fp);
            }
          }
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Are you sure you want to permanently delete all ${trashedNotesCount} notes in Trash? This cannot be undone.`
      );
      if (confirmed) {
        await executePurge();
      }
    } else {
      Alert.alert(
        'Empty Trash',
        `Permanently delete all ${trashedNotesCount} notes in Trash? This action is irreversible.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Empty Trash', style: 'destructive', onPress: executePurge },
        ]
      );
    }
  };

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);
      await refreshFromDB();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  return (
    <>
      <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
        <Pressable className="flex-1 bg-black/60 justify-end sm:justify-center items-center p-0 sm:p-4" onPress={onClose}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-white dark:bg-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-light-border dark:border-dark-border/40 max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-light-border/40 dark:border-dark-border/40">
              <View className="flex-row items-center gap-2.5">
                <View className="w-9 h-9 rounded-full bg-cyan-500/10 dark:bg-cyan-500/20 items-center justify-center">
                  <Database size={18} color="#06B6D4" />
                </View>
                <View>
                  <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                    Workspace & Storage
                  </Text>
                  <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                    Local database engine & offline data safety
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityLabel="Close settings modal"
                className="w-8 h-8 rounded-full bg-light-border/40 dark:bg-dark-raised items-center justify-center active:scale-95"
              >
                <X size={16} color={isDark ? '#B5B5B5' : '#626262'} />
              </Pressable>
            </View>

            {/* Export Notice Banner */}
            {exportNotice && (
              <View className="flex-row items-center gap-2.5 p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-3">
                <Check size={16} color="#06B6D4" />
                <Text className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold flex-1">
                  {exportNotice}
                </Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {/* Section 0: Cloud Sync & Google Drive Media Vault (Auth-Gated) */}
            <View className="p-3.5 rounded-2xl bg-light-surface dark:bg-dark-surface/60 border border-light-border/60 dark:border-dark-border/30 mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2">
                  {isGuestLocked ? (
                    <Lock size={14} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  ) : (
                    <Cloud size={15} color="#06B6D4" />
                  )}
                  <Text className="text-xs font-bold uppercase tracking-wider text-light-textPrimary dark:text-dark-textPrimary">
                    Cloud Sync & Google Drive Vault
                  </Text>
                </View>
                {!isGuestLocked && (
                  <Pressable
                    onPress={handleSyncNow}
                    disabled={isSyncingNow || !isDriveConnected}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Sync workspace now"
                    className="px-2.5 py-1 rounded-full bg-cyan-500/15 active:opacity-75"
                    style={{ opacity: !isDriveConnected ? 0.45 : 1 }}
                  >
                    <Text className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
                      {!isDriveConnected ? 'Sync Paused' : isSyncingNow ? 'Syncing...' : 'Sync Now'}
                    </Text>
                  </Pressable>
                )}
              </View>

              {isGuestLocked ? (
                <View>
                  <Text className="text-xs text-light-textMuted dark:text-dark-textMuted mb-3 leading-relaxed">
                    Sign in with Google to unlock Cloud Sync, Google Drive Media Vault & Friday AI. Offline mode keeps all notes strictly on this device.
                  </Text>
                  <Pressable
                    onPress={() => {
                      onClose();
                      router.push('/signin');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Sign in with Google to enable Sync and AI"
                    className="flex-row items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-light-iconBg dark:bg-white active:opacity-85"
                  >
                    <LogIn size={14} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2.2} />
                    <Text className="text-xs font-bold text-white dark:text-[#111111]">
                      Sign in with Google to Unlock
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View className="gap-2.5">
                  <Text className="text-xs text-light-textSecondary dark:text-dark-textSecondary">
                    Supabase Account: {user?.email || 'Authenticated Google User'}
                  </Text>
                  <View className="flex-row items-center justify-between pt-2 border-t border-light-border/40 dark:border-dark-border/20">
                    <View className="flex-row items-center gap-2 flex-1 pr-2">
                      <HardDrive size={15} color={driveAccount ? '#10B981' : '#9CA3AF'} />
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                          {driveAccount ? `Drive: ${driveAccount.email}` : 'Google Drive Not Connected'}
                        </Text>
                        <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
                          {driveAccount
                            ? 'Media uploads to ScribeX_Vault/ and cleans device storage'
                            : 'Cloud Sync paused — connect Google Drive to resume'}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <Pressable
                        onPress={handleConnectOrSwitchDrive}
                        disabled={isConnectingDrive}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Switch Google Drive Account"
                        className="px-3 py-1.5 rounded-xl bg-cyan-500/15 active:opacity-80"
                      >
                        <Text className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
                          {isConnectingDrive ? '...' : driveAccount ? 'Switch Account' : 'Connect'}
                        </Text>
                      </Pressable>
                      {driveAccount && (
                        <Pressable
                          onPress={handleDisconnectDrive}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel="Disconnect Google Drive"
                          className="px-2.5 py-1.5 rounded-xl bg-red-500/10 active:opacity-80"
                        >
                          <Text className="text-[11px] font-semibold text-red-500">Disconnect</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Section 1: Local Engine Status */}
            <View className="p-3.5 rounded-2xl bg-light-surface dark:bg-dark-surface/60 border border-light-border/60 dark:border-dark-border/30 mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2">
                  <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <Text className="text-xs font-bold uppercase tracking-wider text-light-textPrimary dark:text-dark-textPrimary">
                    Local Storage Engine
                  </Text>
                </View>
                <Pressable
                  onPress={handleManualRefresh}
                  disabled={isRefreshing}
                  accessibilityLabel="Refresh database"
                  className="p-1 rounded-full active:scale-90"
                >
                  <RefreshCw
                    size={13}
                    color={isDark ? '#A1A1AA' : '#71717A'}
                    className={isRefreshing ? 'animate-spin' : ''}
                  />
                </Pressable>
              </View>

              <Text className="text-xs text-light-textMuted dark:text-dark-textMuted mb-3">
                {engineType}
              </Text>

              {/* Statistics Chips */}
              <View className="flex-row flex-wrap gap-2 pt-2 border-t border-light-border/40 dark:border-dark-border/20">
                <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/5">
                  <FileText size={12} color="#06B6D4" />
                  <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                    {activeNotesCount} Active
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/5">
                  <Folder size={12} color="#B18AF3" />
                  <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                    {folders.length} Folders
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/5">
                  <CheckSquare size={12} color="#E5F28B" />
                  <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                    {pendingTasksCount} Tasks Pending
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/5">
                  <Tag size={12} color="#FF9277" />
                  <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                    {tags.length} Tags
                  </Text>
                </View>
                {archivedNotesCount > 0 && (
                  <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/5">
                    <Text className="text-xs font-medium text-light-textMuted dark:text-dark-textMuted">
                      {archivedNotesCount} Archived
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Section 2: Data Portability & Full Backup */}
            <View className="mb-4">
              <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2">
                Data Portability & Backup
              </Text>

              <View className="gap-2">
                {/* Export Full Backup Button */}
                <Pressable
                  onPress={handleExportBackup}
                  disabled={isExporting}
                  accessibilityLabel="Export full notebook backup"
                  className="flex-row items-center justify-between p-3.5 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/30 active:scale-[0.99]"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-8 h-8 rounded-full bg-cyan-500/20 items-center justify-center">
                      <DownloadCloud size={16} color="#06B6D4" />
                    </View>
                    <View>
                      <Text className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                        Export Full Backup (.json)
                      </Text>
                      <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
                        Complete snapshot of all notes, folders, tasks & relations
                      </Text>
                    </View>
                  </View>
                  {isExporting && <ActivityIndicator size="small" color="#06B6D4" />}
                </Pressable>

                {/* Restore Backup Button */}
                <Pressable
                  onPress={() => setIsRestoreModalOpen(true)}
                  accessibilityLabel="Restore workspace from backup"
                  className="flex-row items-center justify-between p-3.5 rounded-2xl bg-light-surface dark:bg-dark-surface/40 border border-light-border dark:border-dark-border/40 hover:border-cyan-500/50 active:scale-[0.99]"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-8 h-8 rounded-full bg-light-border/60 dark:bg-dark-raised items-center justify-center">
                      <UploadCloud size={16} color={isDark ? '#F7F7F7' : '#171717'} />
                    </View>
                    <View>
                      <Text className="text-sm font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                        Restore from Backup
                      </Text>
                      <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
                        Merge or cleanly restore a previous ScribeX JSON export
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            </View>

            {/* Section 3: Trash & Database Maintenance */}
            <View>
              <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2">
                Maintenance & Trash
              </Text>

              <Pressable
                onPress={handleConfirmEmptyTrash}
                disabled={trashedNotesCount === 0 || isPurgingTrash}
                accessibilityLabel="Empty trash"
                className={`flex-row items-center justify-between p-3.5 rounded-2xl border active:scale-[0.99] ${
                  trashedNotesCount > 0
                    ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/15'
                    : 'bg-light-surface/40 dark:bg-dark-surface/20 border-light-border/30 dark:border-dark-border/20 opacity-50'
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className={`w-8 h-8 rounded-full items-center justify-center ${
                      trashedNotesCount > 0 ? 'bg-red-500/20' : 'bg-black/5 dark:bg-white/5'
                    }`}
                  >
                    <Trash2 size={16} color={trashedNotesCount > 0 ? '#EF4444' : '#858585'} />
                  </View>
                  <View>
                    <Text
                      className={`text-sm font-bold ${
                        trashedNotesCount > 0
                          ? 'text-red-500'
                          : 'text-light-textMuted dark:text-dark-textMuted'
                      }`}
                    >
                      Empty Trash ({trashedNotesCount} {trashedNotesCount === 1 ? 'note' : 'notes'})
                    </Text>
                    <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
                      Permanently purge all trashed items and cascade delete checklists
                    </Text>
                  </View>
                </View>
                {isPurgingTrash && <ActivityIndicator size="small" color="#EF4444" />}
              </Pressable>
            </View>

            {/* Section 4: WhatsApp Export Chat Simulation */}
            <View className="mt-4">
              <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2">
                WhatsApp Export Chat Simulation
              </Text>

              <Pressable
                onPress={handleSimulateWhatsAppShare}
                disabled={isSimulatingShare}
                accessibilityLabel="Simulate WhatsApp Export Chat"
                className="flex-row items-center justify-between p-3.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 active:scale-[0.99]"
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-8 h-8 rounded-full bg-emerald-500/20 items-center justify-center">
                    <MessageSquare size={16} color="#10B981" />
                  </View>
                  <View>
                    <Text className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      Simulate WhatsApp Chat Export
                    </Text>
                    <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
                      Test multi-message chat transcript, poll & block synthesis in 1 tap
                    </Text>
                  </View>
                </View>
                {isSimulatingShare && <ActivityIndicator size="small" color="#10B981" />}
              </Pressable>
            </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Embedded Restore Modal */}
      <RestoreBackupModal
        visible={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        onSuccessRestore={async () => {
          for (const id of Array.from(unlockedNoteIds)) {
            relockNoteSession(id);
          }
          for (const fp of Array.from(unlockedFolderPaths)) {
            relockFolderSession(fp);
          }
          await refreshFromDB();
          await refreshSecurityConfig();
        }}
      />
    </>
  );
};

