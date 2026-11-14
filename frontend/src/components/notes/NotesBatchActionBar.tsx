import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  ArrowLeft,
  CheckSquare,
  FolderInput,
  Pin,
  Archive,
  Share2,
  Trash2,
  RotateCcw,
} from 'lucide-react-native';

export interface NotesBatchActionBarProps {
  isSelectionMode: boolean;
  selectedNoteIds: Set<string>;
  isDark: boolean;
  isAllVisibleSelected: boolean;
  statusScope: string;
  onClearSelection: () => void;
  onToggleSelectAll: () => void;
  onOpenMoveFolderModal: () => void;
  onBatchTogglePin: () => void;
  onBatchArchive: () => void;
  onBatchShare: () => void;
  onBatchRestore: () => void;
  onBatchDelete: () => void;
}

export const NotesBatchActionBar: React.FC<NotesBatchActionBarProps> = ({
  isSelectionMode,
  selectedNoteIds,
  isDark,
  isAllVisibleSelected,
  statusScope,
  onClearSelection,
  onToggleSelectAll,
  onOpenMoveFolderModal,
  onBatchTogglePin,
  onBatchArchive,
  onBatchShare,
  onBatchRestore,
  onBatchDelete,
}) => {
  if (!isSelectionMode) return null;

  return (
    <View
      style={{
        zIndex: 100,
        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
        borderColor: isDark ? 'rgba(6, 182, 212, 0.4)' : 'rgba(6, 182, 212, 0.3)',
      }}
      className="mb-3 px-3 py-2 rounded-2xl border shadow-lg flex-row items-center justify-between overflow-hidden"
    >
      {/* Left: Back / Cancel Button + Selection Count Badge */}
      <View className="flex-row items-center gap-1.5 flex-shrink-0 mr-1">
        <Pressable
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={onClearSelection}
          accessibilityLabel="Deselect all and go back to normal mode"
          className="flex-row items-center gap-1 px-2 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
        >
          <ArrowLeft size={16} color={isDark ? '#F3F4F6' : '#111827'} strokeWidth={2.2} />
          <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
            Back
          </Text>
        </Pressable>

        <View className="h-4 w-[1px] bg-light-border dark:bg-dark-border" />

        <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15">
          <View className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <Text className="text-[11px] font-bold text-cyan-500 dark:text-cyan-400">
            {selectedNoteIds.size}
          </Text>
        </View>
      </View>

      {/* Right: Actions Cluster (Scrollable horizontally on narrow devices to guarantee zero container overflow) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 1 }}
        contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
      >
        {/* Select All / Deselect All Toggle */}
        <Pressable
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          onPress={onToggleSelectAll}
          accessibilityLabel={isAllVisibleSelected ? 'Deselect All' : 'Select All'}
          className="p-1.5 rounded-xl flex-row items-center gap-1 hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
        >
          <CheckSquare size={16} color="#06B6D4" />
          <Text className="text-xs font-semibold text-cyan-500 dark:text-cyan-400 hidden sm:flex">
            {isAllVisibleSelected ? 'Deselect All' : 'Select All'}
          </Text>
        </Pressable>

        {/* Move to Folder */}
        <Pressable
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          onPress={onOpenMoveFolderModal}
          accessibilityLabel="Move Selected Notes to Folder"
          className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
        >
          <FolderInput size={16} color={isDark ? '#E5E7EB' : '#1F2937'} />
        </Pressable>

        {/* Pin / Unpin */}
        <Pressable
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          onPress={onBatchTogglePin}
          accessibilityLabel="Pin or Unpin Selected Notes"
          className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
        >
          <Pin size={16} color={isDark ? '#E5E7EB' : '#1F2937'} />
        </Pressable>

        {/* Archive / Unarchive */}
        <Pressable
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          onPress={onBatchArchive}
          accessibilityLabel={statusScope === 'archived' ? 'Unarchive Selected Notes' : 'Archive Selected Notes'}
          className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
        >
          <Archive size={16} color={isDark ? '#E5E7EB' : '#1F2937'} />
        </Pressable>

        {/* Share */}
        <Pressable
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          onPress={onBatchShare}
          accessibilityLabel="Share Selected Notes"
          className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
        >
          <Share2 size={16} color={isDark ? '#E5E7EB' : '#1F2937'} />
        </Pressable>

        {/* Delete / Trash */}
        {statusScope === 'trashed' ? (
          <View className="flex-row items-center gap-1">
            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              onPress={onBatchRestore}
              accessibilityLabel="Restore Selected Notes"
              className="px-2 py-1.5 rounded-xl flex-row items-center gap-1 bg-black/5 dark:bg-white/10 active:scale-95"
            >
              <RotateCcw size={14} color={isDark ? '#F3F4F6' : '#111827'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">Restore</Text>
            </Pressable>
            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              onPress={onBatchDelete}
              accessibilityLabel="Permanently Delete Selected Notes"
              className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 active:scale-95"
            >
              <Trash2 size={16} color="#EF4444" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            onPress={onBatchDelete}
            accessibilityLabel="Move Selected Notes to Trash"
            className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 active:scale-95"
          >
            <Trash2 size={16} color="#EF4444" />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
};
