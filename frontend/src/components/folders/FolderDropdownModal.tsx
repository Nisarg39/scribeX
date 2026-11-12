import React, { useState, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput } from 'react-native';
import {
  Folder,
  FolderPlus,
  FolderTree,
  MoreVertical,
  Check,
  X,
  Search,
  ChevronRight,
  Layers,
  Star,
  Pin,
  Archive,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { DBFolder } from '../../db/types';
import { NoteItem } from '../../types/note';
import { NoteColors, NoteColorToken } from '../../theme/tokens';
import { renderFolderIcon } from './FolderActionSheet';

export interface FolderDropdownModalProps {
  visible: boolean;
  folders: DBFolder[];
  allFolderNames: string[];
  selectedFolderPath?: string | null;
  notes: NoteItem[];
  onClose: () => void;
  onSelectFolder: (folderPath: string | null) => void;
  onOpenFolderActions: (folderPath: string) => void;
  onOpenCreateFolder: () => void;
  onOpenFolderTree?: () => void;
}

export const FolderDropdownModal: React.FC<FolderDropdownModalProps> = ({
  visible,
  folders,
  allFolderNames,
  selectedFolderPath,
  notes,
  onClose,
  onSelectFolder,
  onOpenFolderActions,
  onOpenCreateFolder,
  onOpenFolderTree,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');

  // Precompute note counts per folder (active notes only)
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const activeNotes = notes.filter((n) => n.status !== 'trashed');

    allFolderNames.forEach((path) => {
      counts[path] = activeNotes.filter(
        (n) => n.folderPath === path || n.folderPath?.startsWith(`${path}/`)
      ).length;
    });

    return counts;
  }, [allFolderNames, notes]);

  const totalActiveNotesCount = useMemo(() => {
    return notes.filter((n) => n.status !== 'trashed').length;
  }, [notes]);

  // Sorted and filtered folder list: Pinned folders anchored at top, then alphabetical
  const sortedFolders = useMemo(() => {
    return [...allFolderNames].sort((a, b) => {
      const folderA = folders.find((f) => (f.path || f.name) === a);
      const folderB = folders.find((f) => (f.path || f.name) === b);
      const isPinnedA = folderA ? (folderA.is_pinned ? 1 : 0) : 0;
      const isPinnedB = folderB ? (folderB.is_pinned ? 1 : 0) : 0;
      if (isPinnedA !== isPinnedB) {
        return isPinnedB - isPinnedA;
      }
      return a.localeCompare(b);
    });
  }, [allFolderNames, folders]);

  // Filtered folder list based on quick search
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return sortedFolders;
    const q = searchQuery.toLowerCase().trim();
    return sortedFolders.filter((name) => name.toLowerCase().includes(q));
  }, [sortedFolders, searchQuery]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/60 justify-end sm:justify-center items-center p-0 sm:p-4 backdrop-blur-sm"
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full sm:max-w-md bg-white dark:bg-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-light-border dark:border-dark-border/40"
          style={{ maxHeight: '85%' }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-light-border/40 dark:border-dark-border/40">
            <View className="flex-row items-center gap-2.5">
              <View className="w-9 h-9 rounded-2xl bg-cyan-500/10 dark:bg-cyan-500/20 items-center justify-center border border-cyan-500/20">
                <Folder size={18} color="#06B6D4" />
              </View>
              <View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                    Folders
                  </Text>
                  <View className="px-2 py-0.5 rounded-full bg-cyan-500/15">
                    <Text className="text-[10px] font-bold text-cyan-500">
                      {allFolderNames.length}
                    </Text>
                  </View>
                </View>
                <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                  Filter notes by directory or manage folders
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Close folders menu"
              className="w-8 h-8 rounded-full bg-light-border/40 dark:bg-white/10 items-center justify-center active:scale-95"
            >
              <X size={16} color={isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>
          </View>

          {/* Quick Search (when 4+ folders) */}
          {allFolderNames.length >= 4 && (
            <View className="flex-row items-center px-3 py-2 mb-3 rounded-xl bg-light-surface dark:bg-white/5 border border-light-border/60 dark:border-white/10">
              <Search size={14} color={isDark ? '#A1A1AA' : '#71717A'} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search folders..."
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                className="flex-1 ml-2 text-xs text-light-textPrimary dark:text-dark-textPrimary p-0"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  hitSlop={8}
                  className="p-1"
                >
                  <X size={12} color={isDark ? '#A1A1AA' : '#71717A'} />
                </Pressable>
              )}
            </View>
          )}

          {/* Scrollable Folder Options */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            className="max-h-72"
            contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
          >
            {/* "All Folders" Option */}
            {!searchQuery.trim() && (
              <Pressable
                onPress={() => {
                  onSelectFolder(null);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel="Show All Folders"
                className={`flex-row items-center justify-between p-3 rounded-2xl border active:scale-[0.99] transition-all ${
                  !selectedFolderPath
                    ? 'bg-cyan-500/15 border-cyan-500/40 dark:bg-cyan-500/20'
                    : 'bg-light-surface/60 dark:bg-white/5 border-light-border/50 dark:border-white/10 hover:border-cyan-500/30'
                }`}
              >
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View className={`w-8 h-8 rounded-xl items-center justify-center ${
                    !selectedFolderPath ? 'bg-cyan-500/20' : 'bg-black/5 dark:bg-white/10'
                  }`}>
                    <Layers size={15} color={!selectedFolderPath ? '#06B6D4' : (isDark ? '#A1A1AA' : '#71717A')} />
                  </View>
                  <View className="flex-1">
                    <Text className={`text-xs font-bold ${
                      !selectedFolderPath
                        ? 'text-cyan-500'
                        : 'text-light-textPrimary dark:text-dark-textPrimary'
                    }`}>
                      All Folders
                    </Text>
                    <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted" numberOfLines={1}>
                      View all thoughts & captures
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-2">
                  <View className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10">
                    <Text className="text-[10px] font-semibold text-light-textMuted dark:text-dark-textMuted">
                      {totalActiveNotesCount}
                    </Text>
                  </View>
                  {!selectedFolderPath && (
                    <Check size={16} color="#06B6D4" strokeWidth={2.5} />
                  )}
                </View>
              </Pressable>
            )}

            {/* Folder Items */}
            {filteredFolders.map((folderName) => {
              const isSelected = selectedFolderPath === folderName;
              const folderObj = folders.find(
                (f) => (f.path || f.name) === folderName
              );
              const customColorHex = folderObj?.color_token
                ? NoteColors[folderObj.color_token as NoteColorToken]
                : undefined;
              const count = folderCounts[folderName] || 0;

              // Check if nested path
              const isNested = folderName.includes('/');
              const segments = folderName.split('/');
              const leafName = segments[segments.length - 1];
              const parentPath = segments.slice(0, -1).join('/');

              return (
                <Pressable
                  key={folderName}
                  onPress={() => {
                    onSelectFolder(folderName);
                    onClose();
                  }}
                  onLongPress={() => {
                    onClose();
                    onOpenFolderActions(folderName);
                  }}
                  delayLongPress={350}
                  accessibilityRole="button"
                  accessibilityLabel={`Folder ${folderName}, ${count} notes. Long press for options.`}
                  className={`flex-row items-center justify-between p-3 rounded-2xl border active:scale-[0.99] transition-all ${
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-500/40 dark:bg-cyan-500/20'
                      : 'bg-light-surface/60 dark:bg-white/5 border-light-border/50 dark:border-white/10 hover:border-cyan-500/30'
                  }`}
                >
                  <View className="flex-row items-center gap-3 flex-1 mr-2">
                    <View
                      className="w-8 h-8 rounded-xl items-center justify-center"
                      style={{
                        backgroundColor: customColorHex
                          ? `${customColorHex}25`
                          : isSelected
                          ? 'rgba(6, 182, 212, 0.2)'
                          : isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      {renderFolderIcon(
                        folderObj?.icon,
                        15,
                        customColorHex || (isSelected ? '#06B6D4' : isDark ? '#D4D4D8' : '#52525B')
                      )}
                    </View>

                    <View className="flex-1">
                      <View className="flex-row items-center gap-1.5">
                        {customColorHex && (
                          <View
                            style={{ backgroundColor: customColorHex }}
                            className="w-2 h-2 rounded-full"
                          />
                        )}
                        <Text
                          numberOfLines={1}
                          className={`text-xs font-semibold ${
                            isSelected
                              ? 'text-cyan-500'
                              : 'text-light-textPrimary dark:text-dark-textPrimary'
                          }`}
                        >
                          {leafName}
                        </Text>

                        {/* Favorite Star Badge */}
                        {Boolean(folderObj?.is_favorite) && (
                          <Star size={11} color="#FFD43B" fill="#FFD43B" />
                        )}

                        {/* Pinned Badge */}
                        {Boolean(folderObj?.is_pinned) && (
                          <Pin size={11} color="#FFC96F" fill="#FFC96F" />
                        )}

                        {/* Archived Badge */}
                        {Boolean(folderObj?.is_archived) && (
                          <Archive size={11} color="#06B6D4" />
                        )}
                      </View>

                      {isNested && (
                        <Text
                          numberOfLines={1}
                          className="text-[10px] text-light-textMuted dark:text-dark-textMuted mt-0.5"
                        >
                          {parentPath}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Actions & Badge */}
                  <View className="flex-row items-center gap-1.5">
                    <View className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10">
                      <Text className="text-[10px] font-semibold text-light-textMuted dark:text-dark-textMuted">
                        {count} {count === 1 ? 'note' : 'notes'}
                      </Text>
                    </View>

                    {isSelected && (
                      <Check size={16} color="#06B6D4" strokeWidth={2.5} />
                    )}

                    {/* Manage Folder Actions Button */}
                    <Pressable
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        onClose();
                        onOpenFolderActions(folderName);
                      }}
                      accessibilityLabel={`Manage folder ${folderName}`}
                      className="w-7 h-7 rounded-full items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 ml-1"
                    >
                      <MoreVertical size={14} color={isDark ? '#A1A1AA' : '#71717A'} />
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}

            {filteredFolders.length === 0 && (
              <View className="py-6 items-center justify-center">
                <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                  No folders matching "{searchQuery}"
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer Shortcuts */}
          <View className="flex-row items-center gap-2 mt-4 pt-3 border-t border-light-border/40 dark:border-dark-border/40">
            {/* Create New Folder */}
            <Pressable
              onPress={() => {
                onClose();
                onOpenCreateFolder();
              }}
              accessibilityLabel="Create New Folder"
              className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 hover:bg-cyan-500/20 active:scale-95"
            >
              <FolderPlus size={14} color="#06B6D4" />
              <Text className="text-xs font-bold text-cyan-500">
                New Folder
              </Text>
            </Pressable>

            {/* Folder Explorer Tree */}
            {onOpenFolderTree && (
              <Pressable
                onPress={() => {
                  onClose();
                  onOpenFolderTree();
                }}
                accessibilityLabel="Open Folder Tree Hierarchy"
                className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-light-surface/80 dark:bg-white/5 border border-light-border dark:border-white/10 hover:border-cyan-500/40 active:scale-95"
              >
                <FolderTree size={14} color="#06B6D4" />
                <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                  Folder Tree
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

