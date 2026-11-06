import React, { useState } from 'react';
import { View, Text, Modal, Pressable, Platform, ActivityIndicator, Alert } from 'react-native';
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
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useNotesStore } from '../../state/useNotesStore';
import { workspaceBackupService } from '../../services/workspaceBackupService';
import { RestoreBackupModal } from './RestoreBackupModal';

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
    notes,
    folders,
    tasks,
    tags,
    refreshFromDB,
    emptyTrash,
  } = useNotesStore();

  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isPurgingTrash, setIsPurgingTrash] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!visible) return null;

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
      try {
        setIsPurgingTrash(true);
        await emptyTrash();
      } finally {
        setIsPurgingTrash(false);
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
          </Pressable>
        </Pressable>
      </Modal>

      {/* Embedded Restore Modal */}
      <RestoreBackupModal
        visible={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        onSuccessRestore={async () => {
          await refreshFromDB();
        }}
      />
    </>
  );
};

