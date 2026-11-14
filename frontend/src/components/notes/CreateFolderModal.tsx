import React from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput } from 'react-native';
import {
  Folder,
  FolderPlus,
  FolderInput,
  X,
  ChevronRight,
  CornerDownRight,
  Check,
} from 'lucide-react-native';

export interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  selectedParentPath: string;
  setSelectedParentPath: (p: string) => void;
  parentBreadcrumbSegments: { name: string; path: string }[];
  currentLevelSubfolders: string[];
  allFolderNames: string[];
  newFolderName: string;
  setNewFolderName: (n: string) => void;
  onCreateFolder: () => void;
  onCreateAndClose: () => void;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  isDark,
  selectedParentPath,
  setSelectedParentPath,
  parentBreadcrumbSegments,
  currentLevelSubfolders,
  allFolderNames,
  newFolderName,
  setNewFolderName,
  onCreateFolder,
  onCreateAndClose,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={isOpen}
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/60 items-center justify-center p-4 backdrop-blur-sm"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: isDark ? '#18181B' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
          }}
          className="w-full max-w-md rounded-3xl border p-6 shadow-2xl"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <FolderPlus size={18} color="#06B6D4" />
              <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                New Folder
              </Text>
            </View>
            <Pressable
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={onClose}
              className="w-7 h-7 rounded-full items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 active:bg-black/15 dark:active:bg-white/15"
            >
              <X size={16} color={isDark ? '#A1A1AA' : '#71717A'} />
            </Pressable>
          </View>

          <Text className="text-xs text-light-textMuted dark:text-dark-textMuted mb-3">
            Select an existing directory below to traverse into it, or keep Root Directory (/) selected to create a top-level folder.
          </Text>

          {/* Interactive Breadcrumb Path Bar */}
          <View className="mb-3 p-2.5 rounded-xl bg-light-appBg dark:bg-white/[0.04] border border-light-border dark:border-white/10">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-1.5">
              Parent Location
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, flexShrink: 0 }}
              contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Pressable
                onPress={() => setSelectedParentPath('')}
                className={`flex-row items-center gap-1 px-2.5 py-1 rounded-lg border ${
                  selectedParentPath === ''
                    ? 'bg-cyan-500/20 border-cyan-500/50'
                    : 'bg-light-surface dark:bg-white/5 border-light-border dark:border-white/10 active:scale-95'
                }`}
              >
                <Folder size={11} color="#06B6D4" />
                <Text
                  className={`text-xs font-bold ${
                    selectedParentPath === ''
                      ? 'text-cyan-400'
                      : 'text-light-textSecondary dark:text-dark-textSecondary'
                  }`}
                >
                  Root (/)
                </Text>
              </Pressable>

              {parentBreadcrumbSegments.map((seg) => {
                const isCurrent = seg.path === selectedParentPath;
                return (
                  <React.Fragment key={seg.path}>
                    <ChevronRight size={12} color={isDark ? '#71717A' : '#A1A1AA'} />
                    <Pressable
                      onPress={() => setSelectedParentPath(seg.path)}
                      className={`flex-row items-center gap-1 px-2.5 py-1 rounded-lg border ${
                        isCurrent
                          ? 'bg-cyan-500/20 border-cyan-500/50'
                          : 'bg-light-surface dark:bg-white/5 border-light-border dark:border-white/10 active:scale-95'
                      }`}
                    >
                      <Folder size={11} color="#06B6D4" />
                      <Text
                        className={`text-xs font-bold ${
                          isCurrent
                            ? 'text-cyan-400'
                            : 'text-light-textSecondary dark:text-dark-textSecondary'
                        }`}
                      >
                        {seg.name}
                      </Text>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </ScrollView>
          </View>

          {/* Subfolders inside the currently selected directory (Infinite Depth Traversal) */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted">
                {selectedParentPath
                  ? `Subfolders inside /${selectedParentPath} (Tap to enter)`
                  : 'Existing Root Folders (Tap to enter)'}
              </Text>
              {selectedParentPath !== '' && (
                <Pressable
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => {
                    const parts = selectedParentPath.split('/').filter(Boolean);
                    parts.pop();
                    setSelectedParentPath(parts.join('/'));
                  }}
                  className="px-2 py-0.5 rounded bg-light-surface dark:bg-white/10 active:scale-95"
                >
                  <Text className="text-[10px] font-bold text-cyan-400">↑ Up One Level</Text>
                </Pressable>
              )}
            </View>

            {currentLevelSubfolders.length > 0 ? (
              <ScrollView
                style={{ maxHeight: 150 }}
                contentContainerStyle={{ gap: 6 }}
                showsVerticalScrollIndicator={false}
              >
                {currentLevelSubfolders.map((subPath) => {
                  const leafName = subPath.split('/').pop() || subPath;
                  const childCount = allFolderNames.filter(
                    (f) => f.startsWith(`${subPath}/`) && !f.slice(subPath.length + 1).includes('/')
                  ).length;

                  return (
                    <Pressable
                      key={subPath}
                      onPress={() => setSelectedParentPath(subPath)}
                      className="flex-row items-center justify-between px-3 py-2 rounded-xl bg-light-surface dark:bg-white/[0.04] border border-light-border dark:border-white/10 hover:border-cyan-500/40 active:bg-cyan-500/10"
                    >
                      <View className="flex-row items-center gap-2 flex-1">
                        <Folder size={14} color="#06B6D4" />
                        <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                          {leafName}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        {childCount > 0 && (
                          <Text className="text-[10px] font-medium text-light-textMuted dark:text-dark-textMuted">
                            {childCount} {childCount === 1 ? 'subfolder' : 'subfolders'}
                          </Text>
                        )}
                        <ChevronRight size={13} color={isDark ? '#A1A1AA' : '#71717A'} />
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <View className="py-3 px-3 rounded-xl bg-light-surface/50 dark:bg-white/[0.02] border border-dashed border-light-border dark:border-white/10 flex-row items-center gap-2">
                <CornerDownRight size={13} color={isDark ? '#71717A' : '#A1A1AA'} />
                <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                  Innermost directory reached — no deeper subfolders inside /{selectedParentPath}.
                </Text>
              </View>
            )}
          </View>

          {/* New Folder Name Input */}
          <Text className="text-[10px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-1.5">
            New Folder Name
          </Text>
          <TextInput
            placeholder={
              selectedParentPath
                ? `New folder inside /${selectedParentPath}...`
                : 'New folder name in Root (/)...'
            }
            placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
            value={newFolderName}
            onChangeText={setNewFolderName}
            autoFocus
            onSubmitEditing={onCreateAndClose}
            className="text-sm font-medium text-light-textPrimary dark:text-dark-textPrimary px-3 py-2.5 rounded-xl bg-light-appBg dark:bg-white/5 border border-light-border dark:border-white/10 mb-2 outline-none"
            style={{ outlineStyle: 'none' } as any}
          />

          {/* Live Target Path Preview */}
          <View className="flex-row items-center gap-1.5 mb-4 px-1">
            <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
              Target path:
            </Text>
            <Text className="text-[11px] font-mono font-bold text-cyan-400" numberOfLines={1}>
              /{selectedParentPath ? `${selectedParentPath}/` : ''}
              {newFolderName.trim().replace(/^\/+|\/+$/g, '') || '<new-folder>'}
            </Text>
          </View>

          {/* Modal Actions */}
          <View className="flex-row flex-wrap items-center justify-end gap-2">
            <Pressable
              onPress={onClose}
              className="px-3.5 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10"
            >
              <Text className="text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary">
                Cancel
              </Text>
            </Pressable>

            {/* Create & Enter */}
            <Pressable
              onPress={onCreateFolder}
              disabled={!newFolderName.trim()}
              className={`flex-row items-center gap-1 px-3.5 py-2 rounded-full border ${
                newFolderName.trim()
                  ? 'border-cyan-500/50 bg-cyan-500/15 active:scale-95'
                  : 'border-white/10 bg-white/5 opacity-40'
              }`}
            >
              <FolderPlus size={13} color="#06B6D4" />
              <Text className="text-xs font-bold text-cyan-400">Create & Open</Text>
            </Pressable>

            {/* Create & Done */}
            <Pressable
              onPress={onCreateAndClose}
              disabled={!newFolderName.trim()}
              className={`flex-row items-center gap-1.5 px-4 py-2 rounded-full ${
                newFolderName.trim() ? 'bg-cyan-500 active:scale-95' : 'bg-white/10 opacity-40'
              }`}
            >
              <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
              <Text className="text-xs font-bold text-white">Create Folder</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export interface BatchMoveFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  selectedCount: number;
  allFolderNames: string[];
  quickNewFolderName: string;
  setQuickNewFolderName: (n: string) => void;
  onExecuteBatchMove: (folderPath: string) => void;
  onCreateAndMove: () => void;
}

export const BatchMoveFolderModal: React.FC<BatchMoveFolderModalProps> = ({
  isOpen,
  onClose,
  isDark,
  selectedCount,
  allFolderNames,
  quickNewFolderName,
  setQuickNewFolderName,
  onExecuteBatchMove,
  onCreateAndMove,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={isOpen}
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/60 items-center justify-center p-4 backdrop-blur-sm"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: isDark ? '#18181B' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
          }}
          className="w-full max-w-md rounded-3xl border p-6 shadow-2xl"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <FolderInput size={18} color="#06B6D4" />
              <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                Move {selectedCount} {selectedCount === 1 ? 'Note' : 'Notes'}
              </Text>
            </View>
            <Pressable
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={onClose}
              className="w-7 h-7 rounded-full items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 active:bg-black/15 dark:active:bg-white/15"
            >
              <X size={16} color={isDark ? '#A1A1AA' : '#71717A'} />
            </Pressable>
          </View>

          <Text className="text-xs text-light-textMuted dark:text-dark-textMuted mb-3">
            Select a destination folder below to move all selected notes.
          </Text>

          {/* Folder Options List */}
          <ScrollView
            style={{ maxHeight: 220 }}
            contentContainerStyle={{ gap: 6 }}
            showsVerticalScrollIndicator={false}
            className="mb-4"
          >
            {/* General / Root Directory */}
            <Pressable
              onPress={() => onExecuteBatchMove('General')}
              className="flex-row items-center justify-between px-3.5 py-2.5 rounded-xl bg-light-surface dark:bg-white/[0.04] border border-light-border dark:border-white/10 hover:border-cyan-500/40 active:bg-cyan-500/10"
            >
              <View className="flex-row items-center gap-2.5">
                <Folder size={15} color="#06B6D4" />
                <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                  General (Root)
                </Text>
              </View>
              <ChevronRight size={13} color={isDark ? '#A1A1AA' : '#71717A'} />
            </Pressable>

            {/* Existing Folders */}
            {allFolderNames
              .filter((f) => f !== 'General')
              .map((folderPath) => (
                <Pressable
                  key={folderPath}
                  onPress={() => onExecuteBatchMove(folderPath)}
                  className="flex-row items-center justify-between px-3.5 py-2.5 rounded-xl bg-light-surface dark:bg-white/[0.04] border border-light-border dark:border-white/10 hover:border-cyan-500/40 active:bg-cyan-500/10"
                >
                  <View className="flex-row items-center gap-2.5">
                    <Folder size={15} color="#06B6D4" />
                    <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                      /{folderPath}
                    </Text>
                  </View>
                  <ChevronRight size={13} color={isDark ? '#A1A1AA' : '#71717A'} />
                </Pressable>
              ))}
          </ScrollView>

          {/* Quick Create & Move */}
          <Text className="text-[10px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-1.5">
            Or Move To New Folder
          </Text>
          <View className="flex-row items-center gap-2 mb-4">
            <TextInput
              placeholder="New folder name..."
              placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
              value={quickNewFolderName}
              onChangeText={setQuickNewFolderName}
              onSubmitEditing={onCreateAndMove}
              className="flex-1 text-xs font-medium text-light-textPrimary dark:text-dark-textPrimary px-3 py-2 rounded-xl bg-light-appBg dark:bg-white/5 border border-light-border dark:border-white/10 outline-none"
              style={{ outlineStyle: 'none' } as any}
            />
            <Pressable
              onPress={onCreateAndMove}
              disabled={!quickNewFolderName.trim()}
              className={`px-3.5 py-2 rounded-xl border ${
                quickNewFolderName.trim()
                  ? 'border-cyan-500/50 bg-cyan-500/20 active:scale-95'
                  : 'border-white/10 bg-white/5 opacity-40'
              }`}
            >
              <Text className="text-xs font-bold text-cyan-400">Create & Move</Text>
            </Pressable>
          </View>

          {/* Close / Cancel Button */}
          <View className="flex-row justify-end">
            <Pressable
              onPress={onClose}
              className="px-4 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10"
            >
              <Text className="text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary">
                Cancel
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
