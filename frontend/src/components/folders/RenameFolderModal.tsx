import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, TextInput } from 'react-native';
import { Edit3, X, Check, Folder } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';

interface RenameFolderModalProps {
  visible: boolean;
  folderId?: string;
  currentPath: string;
  onClose: () => void;
  onConfirmRename: (newName: string) => Promise<void>;
}

export const RenameFolderModal: React.FC<RenameFolderModalProps> = ({
  visible,
  folderId,
  currentPath,
  onClose,
  onConfirmRename,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const segments = currentPath.split('/').filter(Boolean);
  const currentName = segments[segments.length - 1] || currentPath;
  const parentPath = segments.slice(0, -1).join('/');

  const [newName, setNewName] = useState(currentName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setNewName(currentName);
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [visible, currentName]);

  if (!visible) return null;

  const cleanName = newName.trim().replace(/^\/+|\/+$/g, '');
  const previewPath = parentPath ? `${parentPath}/${cleanName || '<name>'}` : cleanName || '<name>';
  const isInvalid = !cleanName || cleanName === currentName || cleanName.includes('/');

  const handleSave = async () => {
    if (isInvalid || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onConfirmRename(cleanName);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to rename folder');
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
            minHeight: 220,
          }}
          className="w-full max-w-md rounded-3xl border p-6 shadow-2xl"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2.5">
              <View className="w-10 h-10 rounded-2xl bg-cyan-500/15 items-center justify-center border border-cyan-500/20">
                <Edit3 size={18} color="#06B6D4" />
              </View>
              <View style={{ flexShrink: 0 }}>
                <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Rename Folder
                </Text>
                <Text className="text-xs font-mono text-light-textMuted dark:text-dark-textMuted" numberOfLines={1}>
                  Current: /{currentPath}
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

          {/* Input */}
          <Text className="text-[10px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-1.5 px-1">
            New Folder Name
          </Text>
          <TextInput
            value={newName}
            onChangeText={(text) => {
              setNewName(text);
              if (errorMsg) setErrorMsg(null);
            }}
            autoFocus
            onSubmitEditing={handleSave}
            placeholder="Enter new folder name..."
            placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
            className="text-sm font-medium text-light-textPrimary dark:text-dark-textPrimary px-3.5 py-2.5 rounded-xl bg-light-appBg dark:bg-white/5 border border-light-border dark:border-white/10 mb-2"
          />

          {/* Path Preview */}
          <View className="flex-row items-center gap-1.5 mb-4 px-1">
            <Folder size={12} color={isDark ? '#71717A' : '#A1A1AA'} />
            <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
              New path:
            </Text>
            <Text className="text-[11px] font-mono font-bold text-cyan-400" numberOfLines={1}>
              /{previewPath}
            </Text>
          </View>

          {errorMsg && (
            <Text className="text-xs font-medium text-red-500 mb-3 px-1">
              {errorMsg}
            </Text>
          )}

          {/* Actions */}
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
              onPress={handleSave}
              disabled={isInvalid || isSubmitting}
              className={`flex-row items-center gap-2 px-4 py-2.5 rounded-full ${
                isInvalid || isSubmitting
                  ? 'bg-zinc-500/20 opacity-50'
                  : 'bg-cyan-500 active:bg-cyan-600 active:scale-95 shadow-md'
              }`}
            >
              <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
              <Text className="text-xs font-bold text-white">
                {isSubmitting ? 'Saving...' : 'Rename'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

