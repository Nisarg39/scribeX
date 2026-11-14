import React from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import {
  Search,
  X,
  Mic,
  SlidersHorizontal,
  ArrowDownUp,
  Clock,
} from 'lucide-react-native';
import { BlockType } from '../../types/note';
import { NoteSortBy } from '../../core/noteQueryEngine';

export interface NotesSearchBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isSearchActive: boolean;
  isVoiceSearching: boolean;
  onToggleVoiceSearch: () => void;
  recordSearchHistory: (q: string) => void;
  isDark: boolean;
  activeFiltersCount: number;
  onOpenFilterModal: () => void;
  onOpenSortModal: () => void;
  sortBy?: NoteSortBy;
  getSortLabel: (s?: NoteSortBy) => string;
  hasBlockTypes?: BlockType[];
  tags?: string[];
  toggleBlockTypeFilter: (bt: BlockType) => void;
  toggleTagFilter: (t: string) => void;
  resetQueryRequest: () => void;
  recentSearches: string[];
  deleteSearchHistoryItem: (q: string) => void;
  clearSearchHistory: () => void;
}

export const NotesSearchBar: React.FC<NotesSearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  isSearchActive,
  isVoiceSearching,
  onToggleVoiceSearch,
  recordSearchHistory,
  isDark,
  activeFiltersCount,
  onOpenFilterModal,
  onOpenSortModal,
  sortBy,
  getSortLabel,
  hasBlockTypes,
  tags,
  toggleBlockTypeFilter,
  toggleTagFilter,
  resetQueryRequest,
  recentSearches,
  deleteSearchHistoryItem,
  clearSearchHistory,
}) => {
  return (
    <View className="mb-6">
      <View className="flex-row items-center gap-2">
        <View
          style={{
            borderColor: isVoiceSearching
              ? '#F43F5E'
              : isSearchActive
                ? '#06B6D4'
                : isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.08)',
          }}
          className="flex-1 flex-row items-center px-3.5 py-2 rounded-2xl bg-light-surface dark:bg-dark-raised border shadow-sm"
        >
          <Search
            size={18}
            color={
              isSearchActive
                ? '#06B6D4'
                : isDark
                  ? '#858585'
                  : '#929292'
            }
          />

          <TextInput
            placeholder={
              isVoiceSearching
                ? 'Listening for voice search query...'
                : 'Search notes, tasks, audio, sketches, or files...'
            }
            placeholderTextColor={isVoiceSearching ? '#F43F5E' : isDark ? '#858585' : '#929292'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => {
              if (searchQuery.trim()) recordSearchHistory(searchQuery.trim());
            }}
            returnKeyType="search"
            className="flex-1 text-base font-medium text-light-textPrimary dark:text-dark-textPrimary px-3 py-1 outline-none"
            style={{ outlineStyle: 'none' } as any}
          />

          {searchQuery.length > 0 && (
            <Pressable
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => setSearchQuery('')}
              accessibilityLabel="Clear Search Query"
              className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 items-center justify-center mr-1.5 active:scale-90"
            >
              <X size={14} color={isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>
          )}

          {/* Voice-to-Text Search Mic Button */}
          <Pressable
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={onToggleVoiceSearch}
            accessibilityLabel="Voice to Text Search"
            className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full transition-all active:scale-95 ${
              isVoiceSearching
                ? 'bg-rose-500'
                : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15'
            }`}
          >
            <Mic
              size={15}
              color={isVoiceSearching ? '#FFFFFF' : isDark ? '#E4E4E7' : '#27272A'}
            />
            {isVoiceSearching && (
              <Text className="text-[11px] font-bold text-white">Listening</Text>
            )}
          </Pressable>
        </View>

        {/* Filter Button (Prominently visible right next to search) */}
        <Pressable
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={onOpenFilterModal}
          accessibilityRole="button"
          accessibilityLabel="Filter Notes"
          className={`flex-row items-center justify-center gap-1.5 h-[44px] px-3.5 rounded-2xl border active:scale-95 shadow-sm ${
            activeFiltersCount > 0
              ? 'bg-cyan-500/15 border-cyan-500/50'
              : 'bg-light-surface dark:bg-dark-raised border-light-border/60 dark:border-white/10'
          }`}
        >
          <SlidersHorizontal
            size={15}
            color={activeFiltersCount > 0 ? '#06B6D4' : isDark ? '#E4E4E7' : '#27272A'}
          />
          <Text
            className={`text-xs font-semibold ${
              activeFiltersCount > 0
                ? 'text-cyan-500 font-bold'
                : 'text-light-textPrimary dark:text-dark-textPrimary'
            }`}
          >
            Filter
          </Text>
          {activeFiltersCount > 0 && (
            <View className="w-5 h-5 rounded-full bg-[#06B6D4] items-center justify-center">
              <Text className="text-[10px] font-bold text-white">
                {activeFiltersCount}
              </Text>
            </View>
          )}
        </Pressable>

        {/* Sort Button (Prominently visible right next to search) */}
        <Pressable
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={onOpenSortModal}
          accessibilityRole="button"
          accessibilityLabel="Sort Notes"
          className={`flex-row items-center justify-center gap-1.5 h-[44px] px-3.5 rounded-2xl border active:scale-95 shadow-sm ${
            sortBy && sortBy !== 'updated_desc'
              ? 'bg-cyan-500/15 border-cyan-500/50'
              : 'bg-light-surface dark:bg-dark-raised border-light-border/60 dark:border-white/10'
          }`}
        >
          <ArrowDownUp
            size={15}
            color={
              sortBy && sortBy !== 'updated_desc'
                ? '#06B6D4'
                : isDark
                  ? '#E4E4E7'
                  : '#27272A'
            }
          />
          <Text
            className={`text-xs font-semibold hidden md:flex ${
              sortBy && sortBy !== 'updated_desc'
                ? 'text-cyan-500 font-bold'
                : 'text-light-textPrimary dark:text-dark-textPrimary'
            }`}
          >
            {getSortLabel(sortBy)}
          </Text>
        </Pressable>
      </View>

      {/* Active Filter Chips Bar (Shown when any block type, tag, or folder filter is active) */}
      {activeFiltersCount > 0 && (
        <View className="flex-row flex-wrap items-center gap-2 mt-2.5 px-0.5">
          <Text className="text-[11px] font-semibold text-light-textMuted dark:text-dark-textMuted mr-0.5">
            Active Filters:
          </Text>
          {(hasBlockTypes || []).map((bt) => (
            <Pressable
              key={bt}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              onPress={() => toggleBlockTypeFilter(bt)}
              className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 active:scale-95"
            >
              <Text className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 capitalize">
                {bt.replace('_', ' ')}
              </Text>
              <X size={11} color="#06B6D4" />
            </Pressable>
          ))}
          {(tags || []).map((t) => (
            <Pressable
              key={t}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              onPress={() => toggleTagFilter(t)}
              className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 active:scale-95"
            >
              <Text className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
                #{t}
              </Text>
              <X size={11} color="#06B6D4" />
            </Pressable>
          ))}
          <Pressable
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            onPress={resetQueryRequest}
            className="px-2 py-0.5 rounded-full active:opacity-70"
          >
            <Text className="text-[11px] font-bold text-light-textMuted dark:text-dark-textMuted underline">
              Clear All
            </Text>
          </Pressable>
        </View>
      )}

      {/* Recent Searches Strip (Shown when search input is empty and history exists) */}
      {!isSearchActive && recentSearches.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0, marginTop: 10 }}
          contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 }}
        >
          <View className="flex-row items-center gap-1 mr-1">
            <Clock size={11} color={isDark ? '#71717A' : '#A1A1AA'} />
            <Text className="text-[11px] font-medium text-light-textMuted dark:text-dark-textMuted">
              Recent:
            </Text>
          </View>
          {recentSearches.map((q) => (
            <View
              key={q}
              className="flex-row items-center rounded-full bg-light-surface dark:bg-dark-raised border border-light-border dark:border-white/10"
            >
              <Pressable
                onPress={() => setSearchQuery(q)}
                className="pl-2.5 pr-1.5 py-1 active:scale-95"
              >
                <Text className="text-[11px] font-medium text-light-textSecondary dark:text-dark-textSecondary">
                  {q}
                </Text>
              </Pressable>
              <Pressable
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => deleteSearchHistoryItem(q)}
                accessibilityLabel={`Remove recent search ${q}`}
                className="pr-2 py-1 active:opacity-60"
              >
                <X size={10} color={isDark ? '#71717A' : '#A1A1AA'} />
              </Pressable>
            </View>
          ))}
          <Pressable
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={clearSearchHistory}
            className="px-2 py-1 rounded-full active:opacity-70"
          >
            <Text className="text-[11px] font-semibold text-light-textMuted dark:text-dark-textMuted">
              Clear
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
};
