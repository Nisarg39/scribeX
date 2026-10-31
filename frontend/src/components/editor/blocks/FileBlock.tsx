import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useTheme, NoteColors } from '../../../theme';
import { 
  FileText, 
  FileSpreadsheet, 
  FileCode, 
  Download, 
  Paperclip, 
  ExternalLink 
} from 'lucide-react-native';

interface FileBlockProps {
  fileName?: string;
  sizeBytes?: number;
  url?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
  onUpdateFile: (fileName: string, sizeBytes: number, url?: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const FileBlock: React.FC<FileBlockProps> = ({
  fileName = 'Document_Attachment.pdf',
  sizeBytes = 1845600,
  url = '#',
  isSelected = false,
  isDragging = false,
  onFocus,
  onLongPress,
  onStartDrag,
  onEndDrag,
  onDelete,
  onUpdateFile,
}) => {
  const { isDark } = useTheme();
  const [name, setName] = useState(fileName);
  const [isEditing, setIsEditing] = useState(false);

  const ext = name.split('.').pop()?.toLowerCase() || '';

  const getFileBadge = () => {
    if (ext === 'pdf') {
      return { icon: FileText, color: NoteColors.coral, label: 'PDF' };
    }
    if (['csv', 'xlsx', 'xls'].includes(ext)) {
      return { icon: FileSpreadsheet, color: NoteColors.lime, label: 'SHEET' };
    }
    if (['ts', 'js', 'py', 'json', 'sql'].includes(ext)) {
      return { icon: FileCode, color: NoteColors.sky, label: 'CODE' };
    }
    return { icon: Paperclip, color: NoteColors.lavender, label: ext.toUpperCase() || 'FILE' };
  };

  const badge = getFileBadge();
  const IconComponent = badge.icon;

  const handleNameBlur = () => {
    setIsEditing(false);
    onUpdateFile(name.trim() || 'Document.pdf', sizeBytes, url);
  };

  const handlePickNativeFile = async () => {
    if (Platform.OS === 'web') return;
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        setName(asset.name);
        onUpdateFile(asset.name, asset.size || sizeBytes, asset.uri);
      }
    } catch (err) {
      console.warn('Mobile file picker error:', err);
    }
  };

  const handleDownload = async () => {
    if (Platform.OS === 'web' && url && url !== '#') {
      window.open(url, '_blank');
      return;
    }
    if (Platform.OS !== 'web') {
      if (url && url !== '#' && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(url).catch(() => {});
      } else {
        await handlePickNativeFile();
      }
    }
  };

  return (
    <Pressable
      onPress={onFocus}
      style={[
        {
          borderColor: isSelected
            ? '#06B6D4'
            : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)'),
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)',
        },
      ]}
      className="my-1 w-full rounded-2xl border p-3 flex-row items-center justify-between transition-all group"
    >
      {/* Left: Icon & File Info */}
      <View className="flex-row items-center gap-3 flex-1 mr-3">
        {/* Color-coded Icon Capsule */}
        <View
          style={{ backgroundColor: `${badge.color}20` }}
          className="w-10 h-10 rounded-xl items-center justify-center flex-shrink-0"
        >
          <IconComponent size={18} color={badge.color} />
        </View>

        {/* File Name & Size */}
        <View className="flex-1">
          {isEditing ? (
            <TextInput
              value={name}
              onChangeText={setName}
              onBlur={handleNameBlur}
              onFocus={onFocus}
              autoFocus
              className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary py-0 border-b border-note-cyan"
            />
          ) : (
            <Pressable onPress={() => { onFocus?.(); setIsEditing(true); }}>
              <Text 
                numberOfLines={1} 
                className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary tracking-tight hover:underline"
              >
                {name}
              </Text>
            </Pressable>
          )}

          <View className="flex-row items-center gap-2 mt-0.5">
            <Text className="text-[10px] font-bold text-light-textMuted dark:text-dark-textMuted uppercase tracking-wider">
              {badge.label}
            </Text>
            <View className="w-1 h-1 rounded-full bg-light-textMuted dark:bg-dark-textMuted opacity-40" />
            <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
              {formatBytes(sizeBytes)}
            </Text>
          </View>
        </View>
      </View>

      {/* Right: Quick Action Pill */}
      <Pressable
        onPress={handleDownload}
        style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
        className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10 hover:border-note-cyan/50"
      >
        <Download size={12} color={isDark ? '#F7F7F7' : '#171717'} />
        <Text className="text-[11px] font-semibold text-light-textPrimary dark:text-dark-textPrimary">
          Download
        </Text>
      </Pressable>
    </Pressable>
  );
};
