import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  Star,
  Archive,
  Trash2,
  Folder,
  ChevronDown,
  Pin,
  MoreVertical,
  X,
  FolderTree,
  Tag,
} from 'lucide-react-native';
import { DBFolder } from '../../db/types';
import { NoteColors, NoteColorToken } from '../../theme/tokens';
import { NoteQueryRequest, NotePartitionCounts, NoteStatusScope } from '../../core/noteQueryEngine';

export interface NotesFilterTrackProps {
  queryRequest: NoteQueryRequest;
  partitionCounts: NotePartitionCounts;
  isDark: boolean;
  pinnedFolders: DBFolder[];
  activeFolderObj?: DBFolder | null;
  activeFolderColor?: string | null;
  renderFolderIcon: (iconName: string | null | undefined, size?: number, color?: string) => React.ReactNode;
  tags: string[];
  setStatusScopeFilter: (scope: NoteStatusScope) => void;
  setFolderFilter: (f: string | null) => void;
  toggleTagFilter: (t: string) => void;
  onOpenFolderDropdown: () => void;
  onOpenFolderExplorer: () => void;
  onOpenFolderActions: (folderKey: string) => void;
}

export const NotesFilterTrack: React.FC<NotesFilterTrackProps> = ({
  queryRequest,
  partitionCounts,
  isDark,
  pinnedFolders,
  activeFolderObj,
  activeFolderColor,
  renderFolderIcon,
  tags,
  setStatusScopeFilter,
  setFolderFilter,
  toggleTagFilter,
  onOpenFolderDropdown,
  onOpenFolderExplorer,
  onOpenFolderActions,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, flexShrink: 0, marginBottom: 24 }}
      contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}
    >
      {/* All Notes Pill */}
      <Pressable
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={() => setStatusScopeFilter('active')}
        className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${
          queryRequest.statusScope === 'active' && !queryRequest.folderPath && (!queryRequest.tags || queryRequest.tags.length === 0)
            ? 'bg-light-iconBg dark:bg-white border-transparent'
            : 'bg-transparent border-light-border dark:border-dark-border'
        }`}
      >
        <Text
          className={`text-xs font-semibold ${
            queryRequest.statusScope === 'active' && !queryRequest.folderPath && (!queryRequest.tags || queryRequest.tags.length === 0)
              ? 'text-white dark:text-[#111111]'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
          }`}
        >
          All Notes
        </Text>
        <Text
          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
            queryRequest.statusScope === 'active' && !queryRequest.folderPath && (!queryRequest.tags || queryRequest.tags.length === 0)
              ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#111111]'
              : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
          }`}
        >
          {partitionCounts.allActive}
        </Text>
      </Pressable>

      {/* Favorites Pill */}
      <Pressable
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={() => setStatusScopeFilter('favorites')}
        className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${
          queryRequest.statusScope === 'favorites'
            ? 'bg-light-iconBg dark:bg-white border-transparent'
            : 'bg-transparent border-light-border dark:border-dark-border'
        }`}
      >
        <Star
          size={12}
          color={queryRequest.statusScope === 'favorites' ? '#FFD43B' : (isDark ? '#B5B5B5' : '#626262')}
          fill={queryRequest.statusScope === 'favorites' ? '#FFD43B' : 'transparent'}
        />
        <Text
          className={`text-xs font-semibold ${
            queryRequest.statusScope === 'favorites'
              ? 'text-white dark:text-[#111111]'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
          }`}
        >
          Favorites
        </Text>
        <Text
          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
            queryRequest.statusScope === 'favorites'
              ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#111111]'
              : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
          }`}
        >
          {partitionCounts.favorites}
        </Text>
      </Pressable>

      {/* Archive Pill */}
      <Pressable
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={() => setStatusScopeFilter('archived')}
        className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${
          queryRequest.statusScope === 'archived'
            ? 'bg-cyan-500 border-transparent'
            : 'bg-transparent border-light-border dark:border-dark-border'
        }`}
      >
        <Archive size={12} color={queryRequest.statusScope === 'archived' ? '#FFFFFF' : (isDark ? '#B5B5B5' : '#626262')} />
        <Text
          className={`text-xs font-semibold ${
            queryRequest.statusScope === 'archived'
              ? 'text-white'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
          }`}
        >
          Archive
        </Text>
        {partitionCounts.archived > 0 && (
          <Text
            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
              queryRequest.statusScope === 'archived'
                ? 'bg-white/20 text-white'
                : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
            }`}
          >
            {partitionCounts.archived}
          </Text>
        )}
      </Pressable>

      {/* Trash Pill */}
      <Pressable
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={() => setStatusScopeFilter('trashed')}
        className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all ${
          queryRequest.statusScope === 'trashed'
            ? 'bg-red-500 border-transparent'
            : 'bg-transparent border-light-border dark:border-dark-border'
        }`}
      >
        <Trash2 size={12} color={queryRequest.statusScope === 'trashed' ? '#FFFFFF' : (isDark ? '#B5B5B5' : '#626262')} />
        <Text
          className={`text-xs font-semibold ${
            queryRequest.statusScope === 'trashed'
              ? 'text-white'
              : 'text-light-textSecondary dark:text-dark-textSecondary'
          }`}
        >
          Trash
        </Text>
        {partitionCounts.trashed > 0 && (
          <Text
            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
              queryRequest.statusScope === 'trashed'
                ? 'bg-white/20 text-white'
                : 'bg-black/5 dark:bg-white/10 text-light-textMuted dark:text-dark-textMuted'
            }`}
          >
            {partitionCounts.trashed}
          </Text>
        )}
      </Pressable>

      {/* Divider */}
      <View className="h-5 w-[1px] bg-light-border dark:bg-dark-border mx-1 self-center" />

      {/* Main Folder Dropdown Selector - ALWAYS VISIBLE */}
      <Pressable
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={onOpenFolderDropdown}
        accessibilityLabel="Open folder selector dropdown"
        className="flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-full border bg-light-surface/60 dark:bg-white/5 border-light-border dark:border-white/10 hover:border-cyan-500/50 active:scale-95"
      >
        <Folder size={12} color="#06B6D4" />
        <Text className="text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary">
          Folders
        </Text>
        <ChevronDown size={11} color={isDark ? '#A1A1AA' : '#71717A'} />
      </Pressable>

      {/* Active Unpinned Folder Pill (shown when user filters by a non-pinned folder) */}
      {Boolean(
        queryRequest.folderPath &&
          !pinnedFolders.some((f) => (f.path || f.name) === queryRequest.folderPath)
      ) && (
        <Pressable
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={onOpenFolderDropdown}
          onLongPress={() => onOpenFolderActions(queryRequest.folderPath!)}
          delayLongPress={350}
          accessibilityLabel={`Folder ${queryRequest.folderPath}. Tap to change, long press for options.`}
          className="flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-full border bg-light-iconBg dark:bg-white border-transparent active:scale-95"
        >
          <View className="flex-row items-center gap-1">
            {activeFolderColor && (
              <View
                style={{ backgroundColor: activeFolderColor }}
                className="w-2 h-2 rounded-full mr-0.5"
              />
            )}
            {renderFolderIcon(
              activeFolderObj?.icon,
              11,
              isDark ? '#111111' : '#FFFFFF'
            )}
          </View>

          <Text className="text-xs font-semibold text-white dark:text-[#111111]">
            {queryRequest.folderPath}
          </Text>

          {/* Status Badges on Active Folder Pill */}
          {Boolean(activeFolderObj?.is_favorite) && (
            <Star
              size={10}
              color={isDark ? '#111111' : '#FFD43B'}
              fill={isDark ? '#111111' : '#FFD43B'}
            />
          )}
          {Boolean(activeFolderObj?.is_pinned) && (
            <Pin
              size={10}
              color={isDark ? '#111111' : '#FFC96F'}
              fill={isDark ? '#111111' : '#FFC96F'}
            />
          )}
          {Boolean(activeFolderObj?.is_archived) && (
            <Archive size={10} color={isDark ? '#111111' : '#06B6D4'} />
          )}

          {/* Manage folder actions button */}
          <Pressable
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            onPress={(e) => {
              e.stopPropagation?.();
              onOpenFolderActions(queryRequest.folderPath!);
            }}
            accessibilityLabel={`Manage folder ${queryRequest.folderPath}`}
            className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:opacity-60"
          >
            <MoreVertical size={11} color={isDark ? '#111111' : '#FFFFFF'} />
          </Pressable>

          {/* Quick clear button */}
          <Pressable
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
            onPress={(e) => {
              e.stopPropagation?.();
              setFolderFilter(null);
            }}
            accessibilityLabel="Clear folder filter"
            className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:opacity-60"
          >
            <X size={11} color={isDark ? '#111111' : '#FFFFFF'} />
          </Pressable>
        </Pressable>
      )}

      {/* Pinned Folders Quick-Access Badges */}
      {pinnedFolders.map((folder) => {
        const folderKey = folder.path || folder.name;
        const isSelected = queryRequest.folderPath === folderKey;
        const folderColor = folder.color_token
          ? NoteColors[folder.color_token as NoteColorToken]
          : null;

        return (
          <Pressable
            key={folder.id || folderKey}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            onPress={() => {
              if (isSelected) {
                setFolderFilter(null);
              } else {
                setFolderFilter(folderKey);
              }
            }}
            onLongPress={() => onOpenFolderActions(folderKey)}
            delayLongPress={350}
            accessibilityLabel={`Pinned folder ${folderKey}${isSelected ? ' (active)' : ''}`}
            className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
              isSelected
                ? 'bg-light-iconBg dark:bg-white border-transparent'
                : 'bg-light-surface/60 dark:bg-white/5 border-light-border dark:border-white/10 hover:border-amber-500/40'
            }`}
          >
            <View className="flex-row items-center gap-1">
              {folderColor && (
                <View
                  style={{ backgroundColor: folderColor }}
                  className="w-2 h-2 rounded-full mr-0.5"
                />
              )}
              {renderFolderIcon(
                folder.icon,
                11,
                isSelected
                  ? isDark
                    ? '#111111'
                    : '#FFFFFF'
                  : isDark
                  ? '#D4D4D8'
                  : '#52525B'
              )}
            </View>

            <Text
              className={`text-xs font-semibold ${
                isSelected
                  ? 'text-white dark:text-[#111111]'
                  : 'text-light-textPrimary dark:text-dark-textPrimary'
              }`}
            >
              {folder.name || folder.path}
            </Text>

            {/* Pin indicator */}
            <Pin
              size={10}
              color={isSelected ? (isDark ? '#111111' : '#FFC96F') : '#FFC96F'}
              fill={isSelected ? (isDark ? '#111111' : '#FFC96F') : '#FFC96F'}
            />

            {/* If selected, show Manage & Clear buttons */}
            {isSelected && (
              <>
                <Pressable
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onOpenFolderActions(folderKey);
                  }}
                  accessibilityLabel={`Manage folder ${folderKey}`}
                  className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:opacity-60 ml-0.5"
                >
                  <MoreVertical size={11} color={isDark ? '#111111' : '#FFFFFF'} />
                </Pressable>

                <Pressable
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 6 }}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setFolderFilter(null);
                  }}
                  accessibilityLabel="Clear folder filter"
                  className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:opacity-60"
                >
                  <X size={11} color={isDark ? '#111111' : '#FFFFFF'} />
                </Pressable>
              </>
            )}
          </Pressable>
        );
      })}

      {/* Folder Explorer Tree Button */}
      <Pressable
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={onOpenFolderExplorer}
        accessibilityLabel="Open Folder Explorer Tree"
        className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-light-surface/60 dark:bg-white/5 border border-light-border dark:border-white/10 hover:border-cyan-500/50 active:scale-95"
      >
        <FolderTree size={12} color="#06B6D4" />
        <Text className="text-xs text-light-textPrimary dark:text-dark-textPrimary font-semibold">Tree</Text>
      </Pressable>

      {/* Dynamic Tag Pills */}
      {tags.length > 0 && <View className="h-5 w-[1px] bg-light-border dark:bg-dark-border mx-1 self-center" />}

      {tags.map((tag) => {
        const isSelected = (queryRequest.tags || []).some(
          (t) => t.toLowerCase() === tag.toLowerCase()
        );
        return (
          <Pressable
            key={tag}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            onPress={() => toggleTagFilter(tag)}
            className={`flex-row items-center gap-1 px-3 py-1.5 rounded-full border transition-all ${
              isSelected
                ? 'bg-cyan-500/20 border-cyan-500/50'
                : 'bg-transparent border-light-border dark:border-dark-border'
            }`}
          >
            <Tag size={10} color="#06B6D4" />
            <Text
              className={`text-xs font-semibold ${
                isSelected ? 'text-cyan-400' : 'text-light-textSecondary dark:text-dark-textSecondary'
              }`}
            >
              #{tag}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};
