import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  Trash2,
  Archive,
  Folder,
  MoreVertical,
  X,
  Star,
} from 'lucide-react-native';
import { DBFolder } from '../../db/types';
import { NoteColors, NoteColorToken } from '../../theme/tokens';
import { NoteQueryRequest, NotePartitionCounts } from '../../core/noteQueryEngine';

export interface FolderContextBannersProps {
  queryRequest: NoteQueryRequest;
  partitionCounts: NotePartitionCounts;
  feedCardsCount: number;
  pinnedCardsCount: number;
  emptyTrash: () => Promise<void>;
  isDark: boolean;
  activeFolderObj?: DBFolder | null;
  onOpenFolderActions: (folderKey: string) => void;
  setFolderFilter: (f: string | null) => void;
  unarchiveFolder: (folderId: string) => Promise<{ affectedNotes: number; affectedFolders: number }>;
  favoriteFolders: DBFolder[];
  renderFolderIcon: (iconName: string | null | undefined, size?: number, color?: string) => React.ReactNode;
}

export const FolderContextBanners: React.FC<FolderContextBannersProps> = ({
  queryRequest,
  partitionCounts,
  feedCardsCount,
  pinnedCardsCount,
  emptyTrash,
  isDark,
  activeFolderObj,
  onOpenFolderActions,
  setFolderFilter,
  unarchiveFolder,
  favoriteFolders,
  renderFolderIcon,
}) => {
  return (
    <>
      {/* Trash View Action Banner */}
      {queryRequest.statusScope === 'trashed' && (
        <View className="flex-row items-center justify-between mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
          <View className="flex-row items-center gap-2.5">
            <Trash2 size={18} color="#EF4444" />
            <View>
              <Text className="text-sm font-bold text-red-500">Trash Bin</Text>
              <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                {partitionCounts.trashed} notes in trash. Permanently delete or restore them anytime.
              </Text>
            </View>
          </View>
          {partitionCounts.trashed > 0 && (
            <Pressable
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              onPress={emptyTrash}
              accessibilityLabel="Empty All Trash"
              className="px-3.5 py-1.5 rounded-full bg-red-500 active:scale-95"
            >
              <Text className="text-xs font-bold text-white">Empty Trash</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Archive View Action Banner */}
      {queryRequest.statusScope === 'archived' && (
        <View className="flex-row items-center gap-3 mb-6 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
          <Archive size={18} color="#06B6D4" />
          <View>
            <Text className="text-sm font-bold text-cyan-400">Archived Notes</Text>
            <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
              {partitionCounts.archived} notes preserved. Tap unarchive on any note to restore it to your main notebook.
            </Text>
          </View>
        </View>
      )}

      {/* Active Folder Filter Banner with Direct Manage Action */}
      {queryRequest.folderPath && queryRequest.statusScope === 'active' && (
        <View className="flex-row items-center justify-between mb-6 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
          <View className="flex-row items-center gap-3 flex-1 mr-2">
            <View className="w-9 h-9 rounded-xl bg-cyan-500/20 items-center justify-center">
              <Folder size={18} color="#06B6D4" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-bold text-light-textPrimary dark:text-dark-textPrimary" numberOfLines={1}>
                  /{queryRequest.folderPath}
                </Text>
                <Text className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">
                  {feedCardsCount + pinnedCardsCount} notes
                </Text>
              </View>
              <Text className="text-xs text-light-textMuted dark:text-dark-textMuted" numberOfLines={1}>
                Filtering thoughts & captures in this directory
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-1.5">
            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => onOpenFolderActions(queryRequest.folderPath!)}
              accessibilityLabel="Manage Folder Actions"
              className="px-3 py-1.5 rounded-full bg-light-surface dark:bg-white/10 border border-light-border dark:border-white/10 flex-row items-center gap-1 active:scale-95"
            >
              <MoreVertical size={13} color={isDark ? '#E5E7EB' : '#1F2937'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Manage
              </Text>
            </Pressable>

            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => setFolderFilter(null)}
              accessibilityLabel="Clear Folder Filter"
              className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:opacity-60"
            >
              <X size={15} color={isDark ? '#A1A1AA' : '#71717A'} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Archived Folder Filter Banner with 1-Tap Unarchive Folder Action */}
      {queryRequest.folderPath && queryRequest.statusScope === 'archived' && (
        <View className="flex-row items-center justify-between mb-6 p-4 rounded-2xl bg-cyan-500/15 border border-cyan-500/30">
          <View className="flex-row items-center gap-3 flex-1 mr-2">
            <View className="w-9 h-9 rounded-xl bg-cyan-500/25 items-center justify-center">
              <Archive size={18} color="#06B6D4" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-bold text-light-textPrimary dark:text-dark-textPrimary" numberOfLines={1}>
                  /{queryRequest.folderPath}
                </Text>
                <Text className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/25 text-cyan-400">
                  Archived Folder • {feedCardsCount + pinnedCardsCount} notes
                </Text>
              </View>
              <Text className="text-xs text-light-textMuted dark:text-dark-textMuted" numberOfLines={1}>
                Archived directory and notes preserved offline
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-1.5">
            {activeFolderObj?.id && (
              <Pressable
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={async () => {
                  await unarchiveFolder(activeFolderObj.id);
                }}
                accessibilityLabel="Unarchive Folder"
                className="px-3 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex-row items-center gap-1 active:scale-95"
              >
                <Archive size={13} color="#06B6D4" />
                <Text className="text-xs font-bold text-cyan-400">
                  Unarchive Folder
                </Text>
              </Pressable>
            )}

            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => onOpenFolderActions(queryRequest.folderPath!)}
              accessibilityLabel="Manage Folder Actions"
              className="px-3 py-1.5 rounded-full bg-light-surface dark:bg-white/10 border border-light-border dark:border-white/10 flex-row items-center gap-1 active:scale-95"
            >
              <MoreVertical size={13} color={isDark ? '#E5E7EB' : '#1F2937'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Manage
              </Text>
            </Pressable>

            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => setFolderFilter(null)}
              accessibilityLabel="Clear Folder Filter"
              className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:opacity-60"
            >
              <X size={15} color={isDark ? '#A1A1AA' : '#71717A'} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Favorite Folders Shelf (When viewing Favorites and favorite folders exist) */}
      {queryRequest.statusScope === 'favorites' && favoriteFolders.length > 0 && (
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-2.5">
            <Star size={13} color="#FFD43B" fill="#FFD43B" />
            <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted">
              Favorite Folders ({favoriteFolders.length})
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 0 }}
            contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 }}
          >
            {favoriteFolders.map((favFolder) => {
              const folderPath = favFolder.path || favFolder.name;
              const isSelected = queryRequest.folderPath === folderPath;
              const colorHex = favFolder.color_token ? NoteColors[favFolder.color_token as NoteColorToken] : undefined;

              return (
                <Pressable
                  key={favFolder.id}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  onPress={() => setFolderFilter(isSelected ? null : folderPath)}
                  onLongPress={() => onOpenFolderActions(folderPath)}
                  delayLongPress={350}
                  accessibilityLabel={`Favorite folder ${folderPath}`}
                  className={`flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-full border active:scale-95 transition-all ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500/50'
                      : 'bg-light-surface/70 dark:bg-white/5 border-light-border dark:border-white/10 hover:border-amber-500/40'
                  }`}
                >
                  <View className="flex-row items-center gap-1">
                    {colorHex && (
                      <View style={{ backgroundColor: colorHex }} className="w-2 h-2 rounded-full mr-0.5" />
                    )}
                    {renderFolderIcon(favFolder.icon, 12, isSelected ? '#FFD43B' : (colorHex || (isDark ? '#D4D4D8' : '#71717A')))}
                  </View>
                  <Text
                    className={`text-xs font-semibold ${
                      isSelected
                        ? 'text-amber-500 font-bold'
                        : 'text-light-textPrimary dark:text-dark-textPrimary'
                    }`}
                  >
                    {favFolder.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </>
  );
};
