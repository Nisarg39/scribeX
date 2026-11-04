import React, { useState } from 'react';
import { View, Text, Modal, Pressable, Platform } from 'react-native';
import { AlertTriangle, Trash2, FolderInput, X, ShieldAlert, Folder } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { FolderNoteStats } from '../../db/types';

interface DeleteFolderModalProps {
  visible: boolean;
  folderId?: string;
  folderPath: string;
  stats: FolderNoteStats | null;
  onClose: () => void;
  onConfirmDelete: (noteAction: 'moveToGeneral' | 'trash') => Promise<void>;
}

export const DeleteFolderModal: React.FC<DeleteFolderModalProps> = ({
  visible,
  folderId,
  folderPath,
  stats,
  onClose,
  onConfirmDelete,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [noteAction, setNoteAction] = useState<'moveToGeneral' | 'trash'>('moveToGeneral');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!visible) return null;

  const folderName = folderPath.split('/').pop() || folderPath;
  const totalNotes = stats?.totalNotesCount ?? 0;
  const directNotes = stats?.directNotesCount ?? 0;
  const nestedNotes = stats?.nestedNotesCount ?? 0;
  const subfolders = stats?.subfoldersCount ?? 0;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onConfirmDelete(noteAction);
      onClose();
    } catch (err) {
      console.error('Delete folder error:', err);
    } finally {
      setIsDeleting(false);
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
            minHeight: 280,
          }}
          className="w-full max-w-md rounded-3xl border p-6 shadow-2xl"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2.5">
              <View className="w-10 h-10 rounded-2xl bg-red-500/15 items-center justify-center border border-red-500/20">
                <Trash2 size={20} color="#EF4444" />
              </View>
              <View style={{ flexShrink: 0 }}>
                <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Delete Folder
                </Text>
                <Text className="text-xs font-mono text-light-textMuted dark:text-dark-textMuted" numberOfLines={1}>
                  /{folderPath}
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

          {/* Folder Context & Note Count Banner */}
          <View
            style={{
              backgroundColor: totalNotes > 0 ? (isDark ? 'rgba(245, 158, 11, 0.1)' : '#FEF3C7') : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#F4F4F5'),
              borderColor: totalNotes > 0 ? (isDark ? 'rgba(245, 158, 11, 0.3)' : '#FCD34D') : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7'),
            }}
            className="rounded-2xl border p-3.5 mb-4"
          >
            <View className="flex-row items-start gap-2.5">
              {totalNotes > 0 ? (
                <AlertTriangle size={18} color="#F59E0B" className="mt-0.5" />
              ) : (
                <Folder size={18} color={isDark ? '#A1A1AA' : '#71717A'} className="mt-0.5" />
              )}
              <View className="flex-1">
                <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary mb-1">
                  {totalNotes > 0
                    ? `This folder contains ${totalNotes} ${totalNotes === 1 ? 'note' : 'notes'}`
                    : 'This folder is empty'}
                </Text>
                <Text className="text-[11px] leading-relaxed text-light-textSecondary dark:text-dark-textSecondary">
                  {totalNotes > 0 ? (
                    <>
                      {directNotes} direct {directNotes === 1 ? 'note' : 'notes'}
                      {subfolders > 0 ? ` and ${nestedNotes} notes across ${subfolders} nested subfolders.` : '.'}
                    </>
                  ) : (
                    'No active notes will be affected by deleting this folder.'
                  )}
                </Text>
              </View>
            </View>
          </View>

          {/* Note Handling Options (Only displayed when notes exist) */}
          {totalNotes > 0 && (
            <View className="mb-5">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2 px-1">
                What should happen to the notes?
              </Text>

              {/* Option 1: Move notes to General (Default & Safe) */}
              <Pressable
                onPress={() => setNoteAction('moveToGeneral')}
                className={`flex-row items-center justify-between p-3 rounded-2xl border mb-2 active:scale-[0.99] ${
                  noteAction === 'moveToGeneral'
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-light-border dark:border-white/10 bg-light-surface dark:bg-white/[0.03]'
                }`}
              >
                <View className="flex-row items-center gap-3 flex-1">
                  <View className={`w-8 h-8 rounded-xl items-center justify-center ${
                    noteAction === 'moveToGeneral' ? 'bg-cyan-500/20' : 'bg-black/5 dark:bg-white/5'
                  }`}>
                    <FolderInput size={16} color={noteAction === 'moveToGeneral' ? '#06B6D4' : (isDark ? '#A1A1AA' : '#71717A')} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                      Keep Notes (Move to General)
                    </Text>
                    <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
                      Safely preserve all {totalNotes} notes in the root General directory.
                    </Text>
                  </View>
                </View>
                <View className={`w-4 h-4 rounded-full border items-center justify-center ${
                  noteAction === 'moveToGeneral' ? 'border-cyan-500 bg-cyan-500' : 'border-zinc-500'
                }`}>
                  {noteAction === 'moveToGeneral' && <View className="w-1.5 h-1.5 rounded-full bg-white" />}
                </View>
              </Pressable>

              {/* Option 2: Trash Notes */}
              <Pressable
                onPress={() => setNoteAction('trash')}
                className={`flex-row items-center justify-between p-3 rounded-2xl border active:scale-[0.99] ${
                  noteAction === 'trash'
                    ? 'border-red-500 bg-red-500/10'
                    : 'border-light-border dark:border-white/10 bg-light-surface dark:bg-white/[0.03]'
                }`}
              >
                <View className="flex-row items-center gap-3 flex-1">
                  <View className={`w-8 h-8 rounded-xl items-center justify-center ${
                    noteAction === 'trash' ? 'bg-red-500/20' : 'bg-black/5 dark:bg-white/5'
                  }`}>
                    <Trash2 size={16} color={noteAction === 'trash' ? '#EF4444' : (isDark ? '#A1A1AA' : '#71717A')} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                      Move All Notes to Trash
                    </Text>
                    <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
                      Soft-delete all {totalNotes} notes (recoverable from the Trash view).
                    </Text>
                  </View>
                </View>
                <View className={`w-4 h-4 rounded-full border items-center justify-center ${
                  noteAction === 'trash' ? 'border-red-500 bg-red-500' : 'border-zinc-500'
                }`}>
                  {noteAction === 'trash' && <View className="w-1.5 h-1.5 rounded-full bg-white" />}
                </View>
              </Pressable>
            </View>
          )}

          {/* Action Buttons */}
          <View className="flex-row items-center justify-end gap-2.5 pt-2 border-t border-light-border dark:border-white/10">
            <Pressable
              onPress={onClose}
              disabled={isDeleting}
              className="px-4 py-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10"
            >
              <Text className="text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary">
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDelete}
              disabled={isDeleting}
              className={`flex-row items-center gap-2 px-4 py-2.5 rounded-full bg-red-600 active:bg-red-700 shadow-md active:scale-95 ${
                isDeleting ? 'opacity-50' : ''
              }`}
            >
              <Trash2 size={14} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">
                {isDeleting ? 'Deleting...' : 'Delete Folder'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

