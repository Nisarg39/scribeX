import React, { useState, useRef } from 'react';
import { View, Text, Modal, Pressable, Platform, ActivityIndicator } from 'react-native';
import {
  UploadCloud,
  FileCheck,
  AlertTriangle,
  Check,
  X,
  FileText,
  Folder,
  CheckSquare,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useColorScheme } from 'nativewind';
import { workspaceBackupService, ScribeXWorkspaceBackup } from '../../services/workspaceBackupService';

interface RestoreBackupModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccessRestore: () => Promise<void>;
}

export const RestoreBackupModal: React.FC<RestoreBackupModalProps> = ({
  visible,
  onClose,
  onSuccessRestore,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [loadedBackup, setLoadedBackup] = useState<ScribeXWorkspaceBackup | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<'merge' | 'replace'>('merge');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!visible) return null;

  const handleReset = () => {
    setLoadedBackup(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoadingFile(false);
    setIsRestoring(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleProcessJsonString = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      const validation = workspaceBackupService.validateBackup(parsed);
      if (!validation.valid || !validation.backup) {
        setErrorMessage(validation.error || 'Invalid backup structure');
        setLoadedBackup(null);
      } else {
        setLoadedBackup(validation.backup);
        setErrorMessage(null);
      }
    } catch (err: any) {
      setErrorMessage('Failed to parse JSON file: ' + (err.message || 'Syntax error'));
      setLoadedBackup(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handlePickFileWeb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoadingFile(true);
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleProcessJsonString(content);
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read file from disk');
      setIsLoadingFile(false);
    };
    reader.readAsText(file);
  };

  const handlePickFileNative = async () => {
    try {
      setIsLoadingFile(true);
      setErrorMessage(null);
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', '*/*'],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        setIsLoadingFile(false);
        return;
      }

      const asset = res.assets[0];
      const rawJson = await FileSystem.readAsStringAsync(asset.uri);
      handleProcessJsonString(rawJson);
    } catch (err: any) {
      setErrorMessage('Failed to pick document: ' + (err.message || 'Unknown error'));
      setIsLoadingFile(false);
    }
  };

  const handleTriggerFilePicker = () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
    } else {
      handlePickFileNative();
    }
  };

  const handleExecuteRestore = async () => {
    if (!loadedBackup || isRestoring) return;
    try {
      setIsRestoring(true);
      setErrorMessage(null);
      const summary = await workspaceBackupService.restoreBackup(loadedBackup, strategy);
      await onSuccessRestore();
      setSuccessMessage(
        `Successfully restored ${summary.notesRestored} notes, ${summary.foldersRestored} folders, and ${summary.tasksRestored} tasks!`
      );
      setTimeout(() => {
        handleClose();
      }, 1600);
    } catch (err: any) {
      setErrorMessage('Restore failed: ' + (err?.message || 'Database error'));
      setIsRestoring(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleClose}>
      <Pressable className="flex-1 bg-black/60 justify-end sm:justify-center items-center p-0 sm:p-4" onPress={handleClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full sm:max-w-lg bg-white dark:bg-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-light-border dark:border-dark-border/40"
        >
          {/* Hidden HTML File Input for Web */}
          {Platform.OS === 'web' && (
            <input
              type="file"
              ref={fileInputRef as any}
              accept=".json"
              style={{ display: 'none' }}
              onChange={handlePickFileWeb as any}
            />
          )}

          {/* Modal Header */}
          <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-light-border/40 dark:border-dark-border/40">
            <View className="flex-row items-center gap-2.5">
              <View className="w-9 h-9 rounded-full bg-cyan-500/10 dark:bg-cyan-500/20 items-center justify-center">
                <UploadCloud size={18} color="#06B6D4" />
              </View>
              <View>
                <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Restore Workspace Backup
                </Text>
                <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                  Import an offline ScribeX JSON snapshot
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleClose}
              hitSlop={8}
              accessibilityLabel="Close restore modal"
              className="w-8 h-8 rounded-full bg-light-border/40 dark:bg-dark-raised items-center justify-center active:scale-95"
            >
              <X size={16} color={isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>
          </View>

          {/* Error Banner */}
          {errorMessage && (
            <View className="flex-row items-center gap-2.5 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
              <AlertTriangle size={16} color="#EF4444" />
              <Text className="text-xs text-red-500 font-semibold flex-1 leading-snug">
                {errorMessage}
              </Text>
            </View>
          )}

          {/* Success Banner */}
          {successMessage && (
            <View className="flex-row items-center gap-2.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <Check size={16} color="#10B981" />
              <Text className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex-1 leading-snug">
                {successMessage}
              </Text>
            </View>
          )}

          {!loadedBackup ? (
            /* File Picker Trigger Area */
            <Pressable
              onPress={handleTriggerFilePicker}
              disabled={isLoadingFile}
              accessibilityLabel="Choose backup file"
              className="p-8 rounded-2xl border-2 border-dashed border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/10 items-center justify-center active:scale-[0.99] my-2"
            >
              {isLoadingFile ? (
                <View className="items-center gap-2">
                  <ActivityIndicator size="small" color="#06B6D4" />
                  <Text className="text-xs font-semibold text-light-textMuted dark:text-dark-textMuted">
                    Reading backup file...
                  </Text>
                </View>
              ) : (
                <View className="items-center gap-2">
                  <View className="w-12 h-12 rounded-full bg-cyan-500/20 items-center justify-center mb-1">
                    <FileCheck size={24} color="#06B6D4" />
                  </View>
                  <Text className="text-sm font-bold text-light-textPrimary dark:text-dark-textPrimary">
                    Choose ScribeX JSON Backup
                  </Text>
                  <Text className="text-xs text-light-textMuted dark:text-dark-textMuted text-center max-w-xs">
                    Select a previously exported .json file to inspect and restore notes, folders, and tasks.
                  </Text>
                </View>
              )}
            </Pressable>
          ) : (
            /* File Preview & Strategy Selector */
            <View className="gap-4 my-1">
              <View className="p-3.5 rounded-2xl bg-light-surface dark:bg-dark-surface/60 border border-light-border/60 dark:border-dark-border/40">
                <Text className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-2">
                  Backup Content Preview
                </Text>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">Exported At:</Text>
                  <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                    {new Date(loadedBackup.exportedAt).toLocaleString()}
                  </Text>
                </View>

                <View className="flex-row items-center gap-3 pt-2 border-t border-light-border/40 dark:border-dark-border/30">
                  <View className="flex-row items-center gap-1.5 flex-1">
                    <FileText size={13} color="#06B6D4" />
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                      {loadedBackup.summary.notesCount} Notes
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5 flex-1">
                    <Folder size={13} color="#B18AF3" />
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                      {loadedBackup.summary.foldersCount} Folders
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5 flex-1">
                    <CheckSquare size={13} color="#E5F28B" />
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                      {loadedBackup.summary.tasksCount} Tasks
                    </Text>
                  </View>
                </View>
              </View>

              {/* Restore Strategy Selection */}
              <View>
                <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2">
                  Restore Mode
                </Text>
                <View className="gap-2">
                  <Pressable
                    onPress={() => setStrategy('merge')}
                    accessibilityLabel="Merge restore mode"
                    className={`flex-row items-center justify-between p-3 rounded-2xl border ${
                      strategy === 'merge'
                        ? 'bg-cyan-500/15 border-cyan-500/50'
                        : 'bg-light-surface dark:bg-dark-surface/40 border-light-border/60 dark:border-dark-border/30'
                    }`}
                  >
                    <View className="flex-1 mr-2">
                      <Text className="text-sm font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                        Merge Backup (Safe)
                      </Text>
                      <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
                        Keep existing notes and import missing notes and folders.
                      </Text>
                    </View>
                    {strategy === 'merge' && (
                      <View className="w-5 h-5 rounded-full bg-[#06B6D4] items-center justify-center">
                        <Check size={12} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => setStrategy('replace')}
                    accessibilityLabel="Replace restore mode"
                    className={`flex-row items-center justify-between p-3 rounded-2xl border ${
                      strategy === 'replace'
                        ? 'bg-red-500/15 border-red-500/50'
                        : 'bg-light-surface dark:bg-dark-surface/40 border-light-border/60 dark:border-dark-border/30'
                    }`}
                  >
                    <View className="flex-1 mr-2">
                      <Text className="text-sm font-semibold text-red-500">
                        Clean Replace (Wipe & Restore)
                      </Text>
                      <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
                        Erase current workspace and replace entirely with backup.
                      </Text>
                    </View>
                    {strategy === 'replace' && (
                      <View className="w-5 h-5 rounded-full bg-red-500 items-center justify-center">
                        <Check size={12} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row items-center gap-2 pt-2">
                <Pressable
                  onPress={handleReset}
                  disabled={isRestoring}
                  accessibilityLabel="Choose different file"
                  className="px-4 py-3 rounded-2xl bg-light-border/40 dark:bg-dark-raised active:scale-95"
                >
                  <Text className="text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary">
                    Change File
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleExecuteRestore}
                  disabled={isRestoring}
                  accessibilityLabel="Confirm restore"
                  className="flex-1 py-3 rounded-2xl bg-[#06B6D4] items-center justify-center active:scale-98 shadow-sm"
                >
                  {isRestoring ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text className="text-sm font-bold text-white">
                      Confirm & Restore Notebook
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

