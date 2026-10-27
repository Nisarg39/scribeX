import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Platform } from 'react-native';
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

  return (
    <View className="my-2 p-3.5 rounded-2xl border border-light-border dark:border-white/10 bg-light-surface dark:bg-[#181818] flex-row items-center justify-between">
      {/* Left: Icon & File Info */}
      <View className="flex-row items-center gap-3 flex-1 mr-3">
        {/* Color-coded Icon Container */}
        <View
          style={{ backgroundColor: `${badge.color}25` }}
          className="w-10 h-10 rounded-xl items-center justify-center"
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
              autoFocus
              className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary py-0 border-b border-note-cyan"
            />
          ) : (
            <Pressable onPress={() => setIsEditing(true)}>
              <Text 
                numberOfLines={1} 
                className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary tracking-tight hover:underline"
              >
                {name}
              </Text>
            </Pressable>
          )}

          <View className="flex-row items-center gap-2 mt-0.5">
            <Text className="text-[10px] font-bold text-light-textMuted dark:text-dark-textMuted uppercase">
              {badge.label}
            </Text>
            <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
              • {formatBytes(sizeBytes)}
            </Text>
          </View>
        </View>
      </View>

      {/* Right Action: Download / Open */}
      <Pressable
        onPress={() => {
          if (Platform.OS === 'web' && url && url !== '#') {
            window.open(url, '_blank');
          }
        }}
        className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10 active:scale-95"
        accessibilityLabel="Download File"
      >
        <Download size={12} color={isDark ? '#F7F7F7' : '#171717'} />
        <Text className="text-[11px] font-semibold text-light-textPrimary dark:text-dark-textPrimary">
          Download
        </Text>
      </Pressable>
    </View>
  );
};
