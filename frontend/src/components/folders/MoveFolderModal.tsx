import React, { useState, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { FolderInput, X, Folder, ChevronRight, CornerDownRight, Check } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';

interface MoveFolderModalProps {
  visible: boolean;
  folderId?: string;
  folderPath: string;
  allFolderPaths: string[];
  onClose: () => void;
  onConfirmMove: (newParentPath: string | null) => Promise<void>;
}

export const MoveFolderModal: React.FC<MoveFolderModalProps> = ({
  visible,
  folderId,
  folderPath,
  allFolderPaths,
  onClose,
  onConfirmMove,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const folderName = folderPath.split('/').pop() || folderPath;
  const currentParentPath = folderPath.includes('/')
    ? folderPath.split('/').slice(0, -1).join('/')
    : null;

  const [selectedParent, setSelectedParent] = useState<string | null>(currentParentPath);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter out invalid destinations (self and all descendants to prevent cyclic graphs)
  const validParentOptions = useMemo(() => {
    return allFolderPaths.filter((path) => {
      if (!path) return false;
      if (path === folderPath) return false;
      if (path.startsWith(`${folderPath}/`)) return false;
      return true;
    });
  }, [allFolderPaths, folderPath]);

  if (!visible) return null;

  const targetPath = selectedParent ? `${selectedParent}/${folderName}` : folderName;
  const isUnchanged = targetPath === folderPath;

  const handleMove = async () => {
    if (isUnchanged || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onConfirmMove(selectedParent);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to move folder');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/65 items-center justify-center p-4 backdrop-blur-md"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: isDark ? '#161618' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.12)',
            minHeight: 320,
          }}
          className="w-full max-w-md rounded-3xl border p-6 shadow-2xl"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2.5">
              <View className="w-10 h-10 rounded-2xl bg-cyan-500/15 items-center justify-center border border-cyan-500/20">
                <FolderInput size={18} color="#06B6D4" />
              </View>
              <View style={{ flexShrink: 0 }}>
                <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Move Folder
                </Text>
                <Text className="text-xs font-mono text-light-textMuted dark:text-dark-textMuted" numberOfLines={1}>
                  Moving: /{folderPath}
                </Text>
              </View>
            </View>

            <Pressable
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={onClose}
              className="w-7 h-7 rounded-full items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 active:opacity-60"
            >
              <X size={16} color={isDark ? '#A1A1AA' : '#71717A'} />
            </Pressable>
          </View>

          <Text className="text-xs text-light-textSecondary dark:text-dark-textSecondary mb-3">
            Choose a new parent destination below to reparent this folder:
          </Text>

          {/* Destination Selection List */}
          <ScrollView
            style={{ maxHeight: 220 }}
            contentContainerStyle={{ gap: 6 }}
            showsVerticalScrollIndicator={false}
            className="mb-3"
          >
            {/* Root Option */}
            <Pressable
              onPress={() => setSelectedParent(null)}
              className={`flex-row items-center justify-between px-3.5 py-2.5 rounded-xl border active:scale-[0.99] ${
                selectedParent === null
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-light-border dark:border-white/10 bg-light-surface dark:bg-white/[0.03]'
              }`}
            >
              <View className="flex-row items-center gap-2.5">
                <Folder size={15} color={selectedParent === null ? '#06B6D4' : (isDark ? '#A1A1AA' : '#71717A')} />
                <View>
                  <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                    Root Directory (/)
                  </Text>
                  <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                    Move to top-level folder
                  </Text>
                </View>
              </View>
              {selectedParent === null && <Check size={14} color="#06B6D4" strokeWidth={2.5} />}
            </Pressable>

            {/* Valid Parent Folders */}
            {validParentOptions.map((parentCandidate) => {
              const isSelected = selectedParent === parentCandidate;
              return (
                <Pressable
                  key={parentCandidate}
                  onPress={() => setSelectedParent(parentCandidate)}
                  className={`flex-row items-center justify-between px-3.5 py-2.5 rounded-xl border active:scale-[0.99] ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-light-border dark:border-white/10 bg-light-surface dark:bg-white/[0.03]'
                  }`}
                >
                  <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                    <Folder size={14} color={isSelected ? '#06B6D4' : (isDark ? '#A1A1AA' : '#71717A')} />
                    <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary" numberOfLines={1}>
                      /{parentCandidate}
                    </Text>
                  </View>
                  {isSelected && <Check size={14} color="#06B6D4" strokeWidth={2.5} />}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Path Preview */}
          <View className="p-3 rounded-2xl bg-light-surface/60 dark:bg-white/[0.04] border border-light-border dark:border-white/10 mb-3">
            <View className="flex-row items-center gap-1.5 mb-1">
              <CornerDownRight size={12} color="#06B6D4" />
              <Text className="text-[10px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted">
                New Target Location
              </Text>
            </View>
            <Text className="text-xs font-mono font-bold text-cyan-400" numberOfLines={1}>
              /{targetPath}
            </Text>
          </View>

          {errorMsg && (
            <Text className="text-xs font-medium text-red-500 mb-3 px-1">
              {errorMsg}
            </Text>
          )}

          {/* Action Buttons */}
          <View className="flex-row items-center justify-end gap-2.5 pt-2 border-t border-light-border dark:border-white/10">
            <Pressable
              onPress={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10"
            >
              <Text className="text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary">
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={handleMove}
              disabled={isUnchanged || isSubmitting}
              className={`flex-row items-center gap-2 px-4 py-2.5 rounded-full ${
                isUnchanged || isSubmitting
                  ? 'bg-zinc-500/20 opacity-50'
                  : 'bg-cyan-500 active:bg-cyan-600 active:scale-95 shadow-md'
              }`}
            >
              <FolderInput size={14} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">
                {isSubmitting ? 'Moving...' : 'Move Folder'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

