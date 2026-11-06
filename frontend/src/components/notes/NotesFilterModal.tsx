import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, Platform, Dimensions } from 'react-native';
import {
  SlidersHorizontal,
  X,
  Check,
  RotateCcw,
  Volume2,
  CheckSquare,
  PenTool,
  Image as ImageIcon,
  Code,
  Table,
  Calculator,
  Calendar,
  Layers,
  DollarSign,
  BookOpen,
  Bookmark,
  Folder,
  Tag,
  Star,
  Archive,
  Trash2,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { BlockType } from '../../types/note';
import { DBFolder } from '../../db/types';
import { NoteStatusScope, NoteQueryRequest } from '../../core/noteQueryEngine';

interface FilterOptionItem {
  id: BlockType;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
}

export const BLOCK_FILTER_OPTIONS: FilterOptionItem[] = [
  { id: 'audio', label: 'Audio & Voice', icon: Volume2 },
  { id: 'checklist', label: 'Checklists', icon: CheckSquare },
  { id: 'drawing', label: 'Sketches', icon: PenTool },
  { id: 'image', label: 'Images & Scans', icon: ImageIcon },
  { id: 'code', label: 'Code Snippets', icon: Code },
  { id: 'sheet', label: 'Spreadsheets', icon: Table },
  { id: 'equation', label: 'Math Formulas', icon: Calculator },
  { id: 'meeting_notes', label: 'Meeting Notes', icon: Calendar },
  { id: 'kanban', label: 'Kanban Boards', icon: Layers },
  { id: 'expense', label: 'Expenses', icon: DollarSign },
  { id: 'reading', label: 'Reading Queue', icon: BookOpen },
  { id: 'web_clip', label: 'Web Bookmarks', icon: Bookmark },
];

interface NotesFilterModalProps {
  visible: boolean;
  queryRequest: NoteQueryRequest;
  folders: DBFolder[];
  tags: string[];
  onClose: () => void;
  onToggleBlockType: (blockType: BlockType) => void;
  onToggleTag: (tag: string) => void;
  onSelectFolder: (folderPath: string | null) => void;
  onSelectStatusScope: (scope: NoteStatusScope) => void;
  onResetFilters: () => void;
}

export const NotesFilterModal: React.FC<NotesFilterModalProps> = ({
  visible,
  queryRequest,
  folders,
  tags,
  onClose,
  onToggleBlockType,
  onToggleTag,
  onSelectFolder,
  onSelectStatusScope,
  onResetFilters,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!visible) return null;

  const activeBlockTypes = queryRequest.hasBlockTypes || [];
  const activeTags = queryRequest.tags || [];
  const activeFolderPath = queryRequest.folderPath || null;
  const activeStatus = queryRequest.statusScope;

  const totalActiveFilters =
    activeBlockTypes.length +
    activeTags.length +
    (activeFolderPath ? 1 : 0) +
    (activeStatus !== 'active' ? 1 : 0);

  const screenHeight = Dimensions.get('window').height;
  const isWeb = Platform.OS === 'web';

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60 justify-end sm:justify-center items-center p-0 sm:p-4" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={
            !isWeb
              ? {
                  height: Math.min(screenHeight * 0.78, 620),
                  maxHeight: screenHeight * 0.85,
                }
              : undefined
          }
          className="w-full sm:max-w-lg bg-white dark:bg-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-light-border dark:border-dark-border/40 max-h-[85vh] flex-col"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-light-border/40 dark:border-dark-border/40">
            <View className="flex-row items-center gap-2.5">
              <View className="w-9 h-9 rounded-full bg-cyan-500/10 dark:bg-cyan-500/20 items-center justify-center">
                <SlidersHorizontal size={18} color="#06B6D4" />
              </View>
              <View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                    Filter Notes
                  </Text>
                  {totalActiveFilters > 0 && (
                    <View className="px-2 py-0.5 rounded-full bg-cyan-500/20">
                      <Text className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
                        {totalActiveFilters} Active
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                  Filter by content type, folder, or tag
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Close filter modal"
              className="w-8 h-8 rounded-full bg-light-border/40 dark:bg-dark-raised items-center justify-center active:scale-95"
            >
              <X size={16} color={isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>
          </View>

          {/* Scrollable Filters Body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 16 }}
            className="flex-1 pr-1"
          >
            {/* Section 1: Content & Block Types */}
            <View className="mb-5">
              <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2.5">
                Content & Block Types
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {BLOCK_FILTER_OPTIONS.map((option) => {
                  const isSelected = activeBlockTypes.includes(option.id);
                  const IconComponent = option.icon;

                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => onToggleBlockType(option.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Filter by ${option.label}`}
                      className={`flex-row items-center gap-2 px-3 py-2 rounded-2xl border active:scale-95 ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-500/50 shadow-sm'
                          : 'bg-light-surface dark:bg-dark-surface/50 border-light-border dark:border-dark-border/40'
                      }`}
                    >
                      <IconComponent
                        size={14}
                        color={isSelected ? '#06B6D4' : isDark ? '#A1A1AA' : '#71717A'}
                      />
                      <Text
                        className={`text-xs font-semibold ${
                          isSelected
                            ? 'text-cyan-600 dark:text-cyan-400 font-bold'
                            : 'text-light-textSecondary dark:text-dark-textSecondary'
                        }`}
                      >
                        {option.label}
                      </Text>
                      {isSelected && <Check size={12} color="#06B6D4" strokeWidth={3} />}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Section 2: Status Scope */}
            <View className="mb-5">
              <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2.5">
                Note Status
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {[
                  { id: 'active' as NoteStatusScope, label: 'All Active Notes', icon: Check },
                  { id: 'favorites' as NoteStatusScope, label: 'Starred Favorites', icon: Star },
                  { id: 'archived' as NoteStatusScope, label: 'Archive', icon: Archive },
                  { id: 'trashed' as NoteStatusScope, label: 'Trash', icon: Trash2 },
                ].map((item) => {
                  const isSelected = activeStatus === item.id;
                  const IconComp = item.icon;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => onSelectStatusScope(item.id)}
                      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border active:scale-95 ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-500/50'
                          : 'bg-light-surface dark:bg-dark-surface/50 border-light-border dark:border-dark-border/40'
                      }`}
                    >
                      <IconComp
                        size={12}
                        color={isSelected ? '#06B6D4' : isDark ? '#A1A1AA' : '#71717A'}
                      />
                      <Text
                        className={`text-xs font-semibold ${
                          isSelected
                            ? 'text-cyan-600 dark:text-cyan-400 font-bold'
                            : 'text-light-textSecondary dark:text-dark-textSecondary'
                        }`}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Section 3: Folders Filter */}
            {folders.length > 0 && (
              <View className="mb-5">
                <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2.5">
                  Folder Filter
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() => onSelectFolder(null)}
                    className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border active:scale-95 ${
                      activeFolderPath === null
                        ? 'bg-cyan-500/20 border-cyan-500/50'
                        : 'bg-light-surface dark:bg-dark-surface/50 border-light-border dark:border-dark-border/40'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        activeFolderPath === null
                          ? 'text-cyan-600 dark:text-cyan-400 font-bold'
                          : 'text-light-textSecondary dark:text-dark-textSecondary'
                      }`}
                    >
                      All Folders
                    </Text>
                  </Pressable>

                  {folders.map((f) => {
                    const isSelected = activeFolderPath === f.path;
                    return (
                      <Pressable
                        key={f.id}
                        onPress={() => onSelectFolder(isSelected ? null : f.path)}
                        className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border active:scale-95 ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-500/50'
                            : 'bg-light-surface dark:bg-dark-surface/50 border-light-border dark:border-dark-border/40'
                        }`}
                      >
                        <Folder
                          size={12}
                          color={isSelected ? '#06B6D4' : isDark ? '#A1A1AA' : '#71717A'}
                        />
                        <Text
                          className={`text-xs font-semibold ${
                            isSelected
                              ? 'text-cyan-600 dark:text-cyan-400 font-bold'
                              : 'text-light-textSecondary dark:text-dark-textSecondary'
                          }`}
                        >
                          {f.name || f.path}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Section 4: Tags Filter */}
            {tags.length > 0 && (
              <View className="mb-2">
                <Text className="text-xs font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2.5">
                  Tags Filter
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {tags.map((t) => {
                    const isSelected = activeTags.some(
                      (tag) => tag.toLowerCase() === t.toLowerCase()
                    );
                    return (
                      <Pressable
                        key={t}
                        onPress={() => onToggleTag(t)}
                        className={`flex-row items-center gap-1 px-3 py-1.5 rounded-full border active:scale-95 ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-500/50'
                            : 'bg-light-surface dark:bg-dark-surface/50 border-light-border dark:border-dark-border/40'
                        }`}
                      >
                        <Tag
                          size={11}
                          color={isSelected ? '#06B6D4' : isDark ? '#A1A1AA' : '#71717A'}
                        />
                        <Text
                          className={`text-xs font-semibold ${
                            isSelected
                              ? 'text-cyan-600 dark:text-cyan-400 font-bold'
                              : 'text-light-textSecondary dark:text-dark-textSecondary'
                          }`}
                        >
                          #{t}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Controls */}
          <View className="flex-row items-center justify-between pt-4 mt-2 border-t border-light-border/40 dark:border-dark-border/30">
            <Pressable
              onPress={onResetFilters}
              disabled={totalActiveFilters === 0}
              accessibilityLabel="Reset all filters"
              className={`flex-row items-center gap-1.5 px-3 py-2 rounded-2xl active:scale-95 ${
                totalActiveFilters > 0 ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <RotateCcw size={14} color={isDark ? '#B5B5B5' : '#626262'} />
              <Text className="text-xs font-bold text-light-textSecondary dark:text-dark-textSecondary">
                Reset All
              </Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              accessibilityLabel="Apply filters and close"
              className="px-6 py-2.5 rounded-2xl bg-[#06B6D4] items-center justify-center active:scale-98 shadow-sm"
            >
              <Text className="text-xs font-bold text-white">
                {totalActiveFilters > 0 ? `Apply (${totalActiveFilters})` : 'Done'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

