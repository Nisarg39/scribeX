import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, Share } from 'react-native';
import {
  FolderPlus,
  Edit3,
  FolderInput,
  Copy,
  Trash2,
  X,
  Folder,
  Palette,
  Check,
  CheckSquare,
  Share2,
  Briefcase,
  BookOpen,
  Code2,
  DollarSign,
  Compass,
  Heart,
  Star,
  Sparkles,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { FolderNoteStats } from '../../db/types';
import { NoteColors, NoteColorToken } from '../../theme/tokens';

export const FOLDER_ICONS = [
  { id: 'folder', name: 'Default', icon: Folder },
  { id: 'briefcase', name: 'Work', icon: Briefcase },
  { id: 'book', name: 'Study', icon: BookOpen },
  { id: 'code', name: 'Code', icon: Code2 },
  { id: 'finance', name: 'Finance', icon: DollarSign },
  { id: 'travel', name: 'Travel', icon: Compass },
  { id: 'heart', name: 'Personal', icon: Heart },
  { id: 'star', name: 'Priority', icon: Star },
] as const;

export type FolderIconId = (typeof FOLDER_ICONS)[number]['id'];

export const renderFolderIcon = (
  iconName: string | null | undefined,
  size = 16,
  color = '#06B6D4'
) => {
  switch (iconName) {
    case 'briefcase':
      return <Briefcase size={size} color={color} />;
    case 'book':
      return <BookOpen size={size} color={color} />;
    case 'code':
      return <Code2 size={size} color={color} />;
    case 'finance':
      return <DollarSign size={size} color={color} />;
    case 'travel':
      return <Compass size={size} color={color} />;
    case 'heart':
      return <Heart size={size} color={color} />;
    case 'star':
      return <Star size={size} color={color} />;
    default:
      return <Folder size={size} color={color} />;
  }
};

interface FolderActionSheetProps {
  visible: boolean;
  folderId?: string;
  folderPath: string;
  currentColorToken?: string;
  currentIcon?: string | null;
  stats: FolderNoteStats | null;
  onClose: () => void;
  onOpenCreateSubfolder: (parentPath: string) => void;
  onOpenRename: (folderPath: string, folderId?: string) => void;
  onOpenMove: (folderPath: string, folderId?: string) => void;
  onDuplicate: (folderPath: string, folderId?: string) => void;
  onOpenDelete: (folderPath: string, folderId?: string) => void;
  onSelectAllNotes?: (folderPath: string) => void;
  onExportFolder?: (folderPath: string) => void;
  onChangeColor?: (colorToken: string) => void;
  onChangeIcon?: (icon: string | null) => void;
}

export const FolderActionSheet: React.FC<FolderActionSheetProps> = ({
  visible,
  folderId,
  folderPath,
  currentColorToken = 'cyan',
  currentIcon = null,
  stats,
  onClose,
  onOpenCreateSubfolder,
  onOpenRename,
  onOpenMove,
  onDuplicate,
  onOpenDelete,
  onSelectAllNotes,
  onExportFolder,
  onChangeColor,
  onChangeIcon,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!visible) return null;

  const folderName = folderPath.split('/').pop() || folderPath;
  const isRootGeneral = folderPath.toLowerCase() === 'general';
  const totalNotes = stats?.totalNotesCount ?? 0;
  const subfolders = stats?.subfoldersCount ?? 0;

  const handleAction = (cb: () => void) => {
    onClose();
    setTimeout(cb, 100);
  };

  const folderAccentHex = currentColorToken
    ? NoteColors[currentColorToken as NoteColorToken] || '#06B6D4'
    : '#06B6D4';

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/65 items-center justify-end sm:justify-center p-3 sm:p-4 backdrop-blur-md"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: isDark ? '#161618' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.12)',
            maxHeight: '92%',
          }}
          className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border p-5 shadow-2xl"
        >
          {/* Mobile Handle Indicator */}
          <View className="items-center sm:hidden mb-2">
            <View className="w-10 h-1 rounded-full bg-zinc-600/40" />
          </View>

          {/* Folder Header */}
          <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-light-border dark:border-white/10">
            <View className="flex-row items-center gap-3 flex-1 mr-2">
              <View
                style={{ backgroundColor: `${folderAccentHex}22`, borderColor: `${folderAccentHex}44` }}
                className="w-11 h-11 rounded-2xl items-center justify-center border"
              >
                {renderFolderIcon(currentIcon, 20, folderAccentHex)}
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary" numberOfLines={1}>
                  {folderName}
                </Text>
                <View className="flex-row items-center gap-2 mt-0.5">
                  <Text className="text-[11px] font-mono text-cyan-400" numberOfLines={1}>
                    /{folderPath}
                  </Text>
                  <Text className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 font-bold text-light-textSecondary dark:text-dark-textSecondary">
                    {totalNotes} {totalNotes === 1 ? 'note' : 'notes'}
                  </Text>
                  {subfolders > 0 && (
                    <Text className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 font-bold text-light-textMuted dark:text-dark-textMuted">
                      {subfolders} {subfolders === 1 ? 'subfolder' : 'subfolders'}
                    </Text>
                  )}
                </View>
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

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
            {/* Actions List */}
            <View className="gap-1.5 mb-4">
              {/* 1. New Subfolder */}
              <Pressable
                onPress={() => handleAction(() => onOpenCreateSubfolder(folderPath))}
                className="flex-row items-center justify-between p-3 rounded-2xl bg-light-surface dark:bg-white/[0.03] border border-light-border dark:border-white/10 active:bg-cyan-500/10 active:scale-[0.99]"
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-8 h-8 rounded-xl bg-cyan-500/15 items-center justify-center">
                    <FolderPlus size={16} color="#06B6D4" />
                  </View>
                  <View>
                    <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                      Create Subfolder
                    </Text>
                    <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                      Add a folder inside /{folderPath}
                    </Text>
                  </View>
                </View>
              </Pressable>

              {/* 2. Select All Notes in Folder (If notes exist) */}
              {totalNotes > 0 && onSelectAllNotes && (
                <Pressable
                  onPress={() => handleAction(() => onSelectAllNotes(folderPath))}
                  className="flex-row items-center justify-between p-3 rounded-2xl bg-light-surface dark:bg-white/[0.03] border border-light-border dark:border-white/10 active:bg-cyan-500/10 active:scale-[0.99]"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-8 h-8 rounded-xl bg-cyan-500/15 items-center justify-center">
                      <CheckSquare size={16} color="#06B6D4" />
                    </View>
                    <View>
                      <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                        Select All Notes ({totalNotes})
                      </Text>
                      <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                        Enter multi-selection mode with all notes selected
                      </Text>
                    </View>
                  </View>
                </Pressable>
              )}

              {/* 3. Export / Share Folder */}
              {totalNotes > 0 && onExportFolder && (
                <Pressable
                  onPress={() => handleAction(() => onExportFolder(folderPath))}
                  className="flex-row items-center justify-between p-3 rounded-2xl bg-light-surface dark:bg-white/[0.03] border border-light-border dark:border-white/10 active:bg-cyan-500/10 active:scale-[0.99]"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-8 h-8 rounded-xl bg-cyan-500/15 items-center justify-center">
                      <Share2 size={16} color="#06B6D4" />
                    </View>
                    <View>
                      <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                        Export Folder
                      </Text>
                      <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                        Share all notes in this folder as a text bundle
                      </Text>
                    </View>
                  </View>
                </Pressable>
              )}

              {/* 4. Rename Folder (Disabled for General) */}
              {!isRootGeneral && (
                <Pressable
                  onPress={() => handleAction(() => onOpenRename(folderPath, folderId))}
                  className="flex-row items-center justify-between p-3 rounded-2xl bg-light-surface dark:bg-white/[0.03] border border-light-border dark:border-white/10 active:bg-cyan-500/10 active:scale-[0.99]"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-8 h-8 rounded-xl bg-cyan-500/15 items-center justify-center">
                      <Edit3 size={16} color="#06B6D4" />
                    </View>
                    <View>
                      <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                        Rename Folder
                      </Text>
                      <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                        Change folder name and update note paths
                      </Text>
                    </View>
                  </View>
                </Pressable>
              )}

              {/* 5. Move / Reparent (Disabled for General) */}
              {!isRootGeneral && (
                <Pressable
                  onPress={() => handleAction(() => onOpenMove(folderPath, folderId))}
                  className="flex-row items-center justify-between p-3 rounded-2xl bg-light-surface dark:bg-white/[0.03] border border-light-border dark:border-white/10 active:bg-cyan-500/10 active:scale-[0.99]"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-8 h-8 rounded-xl bg-cyan-500/15 items-center justify-center">
                      <FolderInput size={16} color="#06B6D4" />
                    </View>
                    <View>
                      <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                        Move Folder
                      </Text>
                      <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                        Reparent to another directory or root
                      </Text>
                    </View>
                  </View>
                </Pressable>
              )}

              {/* 6. Duplicate Folder */}
              <Pressable
                onPress={() => handleAction(() => onDuplicate(folderPath, folderId))}
                className="flex-row items-center justify-between p-3 rounded-2xl bg-light-surface dark:bg-white/[0.03] border border-light-border dark:border-white/10 active:bg-cyan-500/10 active:scale-[0.99]"
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-8 h-8 rounded-xl bg-cyan-500/15 items-center justify-center">
                    <Copy size={16} color="#06B6D4" />
                  </View>
                  <View>
                    <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                      Duplicate Folder
                    </Text>
                    <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                      Clone folder and copy all {totalNotes} contained notes
                    </Text>
                  </View>
                </View>
              </Pressable>

              {/* 7. Delete Folder (Disabled for General) */}
              {!isRootGeneral && (
                <Pressable
                  onPress={() => handleAction(() => onOpenDelete(folderPath, folderId))}
                  className="flex-row items-center justify-between p-3 rounded-2xl bg-red-500/10 border border-red-500/20 active:bg-red-500/20 active:scale-[0.99] mt-1"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-8 h-8 rounded-xl bg-red-500/20 items-center justify-center">
                      <Trash2 size={16} color="#EF4444" />
                    </View>
                    <View>
                      <Text className="text-xs font-semibold text-red-500">
                        Delete Folder...
                      </Text>
                      <Text className="text-[10px] text-red-400/80">
                        Shows options for {totalNotes} contained {totalNotes === 1 ? 'note' : 'notes'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              )}
            </View>

            {/* Folder Icon Selector */}
            {onChangeIcon && (
              <View className="pt-3 border-t border-light-border dark:border-white/10 mb-3">
                <View className="flex-row items-center gap-1.5 mb-2">
                  <Sparkles size={12} color={isDark ? '#A1A1AA' : '#71717A'} />
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted">
                    Folder Icon
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0, flexShrink: 0 }}
                  contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingVertical: 2 }}
                >
                  {FOLDER_ICONS.map((item) => {
                    const isSelected = (currentIcon || 'folder') === item.id;
                    const IconComp = item.icon;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => onChangeIcon(item.id === 'folder' ? null : item.id)}
                        className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border active:scale-95 ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-500'
                            : 'bg-black/5 dark:bg-white/5 border-light-border dark:border-white/10'
                        }`}
                      >
                        <IconComp size={13} color={isSelected ? '#06B6D4' : (isDark ? '#A1A1AA' : '#71717A')} />
                        <Text className={`text-[11px] font-semibold ${
                          isSelected ? 'text-cyan-400' : 'text-light-textSecondary dark:text-dark-textSecondary'
                        }`}>
                          {item.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Color Accent Picker */}
            {onChangeColor && (
              <View className="pt-2 border-t border-light-border dark:border-white/10">
                <View className="flex-row items-center gap-1.5 mb-2">
                  <Palette size={12} color={isDark ? '#A1A1AA' : '#71717A'} />
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted">
                    Color Accent
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0, flexShrink: 0 }}
                  contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingVertical: 2 }}
                >
                  {(['lime', 'apricot', 'cyan', 'coral', 'lavender', 'pink', 'sky'] as NoteColorToken[]).map((col) => {
                    const isSelected = currentColorToken === col;
                    const tokenHex = NoteColors[col];
                    return (
                      <Pressable
                        key={col}
                        onPress={() => onChangeColor(col)}
                        style={{
                          backgroundColor: tokenHex,
                          width: 28,
                          height: 28,
                        }}
                        className="rounded-full items-center justify-center border border-black/10 dark:border-white/20 active:scale-95"
                      >
                        {isSelected && <Check size={14} color="#111111" strokeWidth={3} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </ScrollView>

          {/* Close button */}
          <Pressable
            onPress={onClose}
            className="mt-3 py-2.5 rounded-full items-center justify-center bg-black/5 dark:bg-white/5 active:bg-black/10 dark:active:bg-white/10"
          >
            <Text className="text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary">
              Dismiss
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
