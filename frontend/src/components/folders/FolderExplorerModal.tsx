import React, { useState, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import {
  FolderTree,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  MoreVertical,
  X,
  Plus,
  Star,
  Pin,
  Archive,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { DBFolder } from '../../db/types';
import { NoteItem } from '../../types/note';
import { NoteColors, NoteColorToken } from '../../theme/tokens';
import { renderFolderIcon } from './FolderActionSheet';

interface FolderExplorerModalProps {
  visible: boolean;
  folders: DBFolder[];
  notes: NoteItem[];
  activeFolderPath?: string | null;
  onClose: () => void;
  onSelectFolder: (folderPath: string) => void;
  onOpenFolderActions: (folderPath: string) => void;
  onOpenCreateSubfolder: (parentPath?: string) => void;
}

interface TreeNode {
  name: string;
  fullPath: string;
  folderRecord?: DBFolder;
  directNotesCount: number;
  totalNotesCount: number;
  children: Map<string, TreeNode>;
}

export const FolderExplorerModal: React.FC<FolderExplorerModalProps> = ({
  visible,
  folders,
  notes,
  activeFolderPath,
  onClose,
  onSelectFolder,
  onOpenFolderActions,
  onOpenCreateSubfolder,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  // Build tree from notes and folders
  const rootTree = useMemo(() => {
    const rawPaths = Array.from(
      new Set([
        'General',
        ...folders.map((f) => f.path || f.name),
        ...notes
          .filter((n) => n.status !== 'trashed' && n.status !== 'archived')
          .map((n) => n.folderPath)
          .filter(Boolean) as string[],
      ])
    );

    const folderMap = new Map<string, DBFolder>();
    folders.forEach((f) => {
      const p = f.path || f.name;
      if (p) folderMap.set(p, f);
    });

    const activeNotes = notes.filter((n) => n.status !== 'trashed');

    const root: TreeNode = {
      name: 'Root',
      fullPath: '',
      directNotesCount: 0,
      totalNotesCount: 0,
      children: new Map(),
    };

    rawPaths.forEach((path) => {
      if (!path) return;
      const parts = path.split('/').map((s) => s.trim()).filter(Boolean);
      let curr = root;
      let accum = '';

      parts.forEach((part) => {
        accum = accum ? `${accum}/${part}` : part;
        if (!curr.children.has(part)) {
          curr.children.set(part, {
            name: part,
            fullPath: accum,
            folderRecord: folderMap.get(accum),
            directNotesCount: 0,
            totalNotesCount: 0,
            children: new Map(),
          });
        }
        curr = curr.children.get(part)!;
      });
    });

    // Populate note counts
    const calculateCounts = (node: TreeNode) => {
      if (node.fullPath) {
        node.directNotesCount = activeNotes.filter(
          (n) => n.folderPath === node.fullPath
        ).length;
        let nested = 0;
        node.children.forEach((child) => {
          calculateCounts(child);
          nested += child.totalNotesCount;
        });
        node.totalNotesCount = node.directNotesCount + nested;
      } else {
        node.children.forEach((child) => calculateCounts(child));
      }
    };

    calculateCounts(root);
    return root;
  }, [folders, notes]);

  if (!visible) return null;

  const toggleCollapse = (fullPath: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(fullPath)) {
        next.delete(fullPath);
      } else {
        next.add(fullPath);
      }
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth = 0) => {
    const hasChildren = node.children.size > 0;
    const isCollapsed = collapsedPaths.has(node.fullPath);
    const isSelected = activeFolderPath === node.fullPath;
    const folderColor = node.folderRecord?.color_token
      ? NoteColors[node.folderRecord.color_token as NoteColorToken] || '#06B6D4'
      : '#06B6D4';

    return (
      <View key={node.fullPath}>
        <View
          style={{ paddingLeft: depth * 18 }}
          className={`flex-row items-center justify-between py-2.5 px-3 rounded-2xl mb-1 border ${
            isSelected
              ? 'bg-cyan-500/15 border-cyan-500/40'
              : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10'
          }`}
        >
          {/* Left: Expand Arrow + Icon + Title */}
          <Pressable
            onPress={() => onSelectFolder(node.fullPath)}
            className="flex-row items-center gap-2.5 flex-1 pr-2"
          >
            {hasChildren ? (
              <Pressable
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => toggleCollapse(node.fullPath)}
                className="w-5 h-5 items-center justify-center rounded-md active:bg-black/10 dark:active:bg-white/10"
              >
                {isCollapsed ? (
                  <ChevronRight size={13} color={isDark ? '#A1A1AA' : '#71717A'} />
                ) : (
                  <ChevronDown size={13} color={isDark ? '#A1A1AA' : '#71717A'} />
                )}
              </Pressable>
            ) : (
              <View className="w-5" />
            )}

            <View
              style={{ backgroundColor: `${folderColor}22` }}
              className="w-7 h-7 rounded-xl items-center justify-center border border-black/5 dark:border-white/10"
            >
              {renderFolderIcon(node.folderRecord?.icon, 14, folderColor)}
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text
                  className={`text-xs font-semibold ${
                    isSelected
                      ? 'text-cyan-400 font-bold'
                      : 'text-light-textPrimary dark:text-dark-textPrimary'
                  }`}
                  numberOfLines={1}
                >
                  {node.name}
                </Text>
                {Boolean(node.folderRecord?.is_favorite) && (
                  <Star size={11} color="#FFD43B" fill="#FFD43B" />
                )}
                {Boolean(node.folderRecord?.is_pinned) && (
                  <Pin size={11} color="#FFC96F" fill="#FFC96F" />
                )}
                {Boolean(node.folderRecord?.is_archived) && (
                  <Archive size={11} color="#06B6D4" />
                )}
              </View>
              <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted" numberOfLines={1}>
                {node.totalNotesCount} {node.totalNotesCount === 1 ? 'note' : 'notes'}
                {hasChildren ? ` • ${node.children.size} subfolders` : ''}
              </Text>
            </View>
          </Pressable>

          {/* Right: Quick Add Subfolder + Menu Actions */}
          <View className="flex-row items-center gap-1">
            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => onOpenCreateSubfolder(node.fullPath)}
              accessibilityLabel={`Add subfolder under ${node.name}`}
              className="w-7 h-7 rounded-full items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 active:scale-95"
            >
              <FolderPlus size={13} color={isDark ? '#A1A1AA' : '#71717A'} />
            </Pressable>

            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => onOpenFolderActions(node.fullPath)}
              accessibilityLabel={`Manage folder ${node.name}`}
              className="w-7 h-7 rounded-full items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 active:scale-95"
            >
              <MoreVertical size={13} color={isDark ? '#A1A1AA' : '#71717A'} />
            </Pressable>
          </View>
        </View>

        {/* Child Subfolders */}
        {hasChildren &&
          !isCollapsed &&
          Array.from(node.children.values()).map((child) =>
            renderNode(child, depth + 1)
          )}
      </View>
    );
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
        className="flex-1 bg-black/65 items-center justify-center p-3 sm:p-4 backdrop-blur-md"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: isDark ? '#161618' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.12)',
            maxHeight: '85%',
          }}
          className="w-full max-w-lg rounded-3xl border p-5 shadow-2xl"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-light-border dark:border-white/10">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-2xl bg-cyan-500/15 items-center justify-center border border-cyan-500/25">
                <FolderTree size={20} color="#06B6D4" />
              </View>
              <View>
                <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Folder Explorer
                </Text>
                <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                  Browse, organize & manage your directory tree
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

          {/* New Root Folder Shortcut */}
          <Pressable
            onPress={() => onOpenCreateSubfolder()}
            className="flex-row items-center justify-center gap-2 p-2.5 rounded-2xl bg-cyan-500/10 border border-dashed border-cyan-500/30 hover:bg-cyan-500/15 active:scale-95 mb-3"
          >
            <Plus size={14} color="#06B6D4" />
            <Text className="text-xs font-bold text-cyan-400">
              Create New Root Folder
            </Text>
          </Pressable>

          {/* Tree View Scroll */}
          <ScrollView
            style={{ maxHeight: 380 }}
            contentContainerStyle={{ paddingBottom: 10 }}
            showsVerticalScrollIndicator={false}
          >
            {Array.from(rootTree.children.values()).map((rootChild) =>
              renderNode(rootChild, 0)
            )}
          </ScrollView>

          {/* Footer Close Button */}
          <View className="pt-3 border-t border-light-border dark:border-white/10 flex-row justify-end">
            <Pressable
              onPress={onClose}
              className="px-5 py-2.5 rounded-full bg-black/5 dark:bg-white/5 active:bg-black/10 dark:active:bg-white/10"
            >
              <Text className="text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary">
                Done
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
