/**
 * ScribeX Detailed Note View / Clean Canvas Editor.
 *
 * Provides a minimal, distraction-free writing canvas for note inspection
 * and editing, stripping out legacy card and block gutter UI elements
 * while preserving debounced auto-saving and full database synchronization.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { PastelColorKey } from '../../theme/tokens';

interface BlockEditorProps {
  initialTitle: string;
  initialMarkdown: string;
  colorToken?: PastelColorKey;
  groupName?: string;
  onSave: (payload: { title: string; content_markdown: string }) => Promise<void>;
  onClose?: () => void;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
  initialTitle,
  initialMarkdown,
  groupName = 'General',
  onSave,
  onClose,
}) => {
  const { colors, isDark } = useTheme();

  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialMarkdown);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(new Date());

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);

  // Debounced auto-save runner
  const triggerAutoSave = useCallback(
    (newTitle: string, newContent: string) => {
      isDirtyRef.current = true;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        if (!isDirtyRef.current) return;
        setIsSaving(true);
        try {
          await onSave({
            title: newTitle.trim() || 'Untitled Note',
            content_markdown: newContent,
          });
          isDirtyRef.current = false;
          setLastSaved(new Date());
        } catch (err) {
          console.warn('Auto-save error:', err);
        } finally {
          setIsSaving(false);
        }
      }, 400);
    },
    [onSave]
  );

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    triggerAutoSave(newTitle, content);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    triggerAutoSave(title, newContent);
  };

  return (
    <View className="flex-1 w-full h-full bg-[#FAFAFA] dark:bg-appBg">
      {/* Minimal Top Navigation */}
      <View className="flex-row justify-between items-center px-6 pt-5 pb-4 border-b border-borderSubtle">
        <Pressable
          onPress={onClose}
          hitSlop={12}
          className="flex-row items-center gap-2 py-1 active:opacity-60"
          accessibilityLabel="Back to notes"
        >
          <ArrowLeft size={18} color={colors.textPrimary} />
          <Text className="text-[15px] font-medium text-textPrimary">Notes</Text>
        </Pressable>

        <View className="flex-row items-center gap-4">
          <Text className="text-[13px] font-medium uppercase tracking-wider text-textMuted">{groupName}</Text>
          <View className="flex-row items-center gap-1">
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <>
                <Check size={14} color="#10B981" />
                <Text className="text-xs text-textMuted">Saved</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Clean Distraction-Free Editorial Canvas */}
      <ScrollView
        contentContainerClassName="max-w-[820px] w-full self-center px-6 pt-10 pb-24"
        contentContainerStyle={{ maxWidth: 820, width: '100%', alignSelf: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          value={title}
          onChangeText={handleTitleChange}
          placeholder="Title"
          placeholderTextColor={colors.textMuted}
          className="text-[32px] font-bold leading-10 mb-5 p-0 text-textPrimary"
          style={Platform.select({ web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any })}
          multiline
        />

        <TextInput
          value={content}
          onChangeText={handleContentChange}
          placeholder="Start writing..."
          placeholderTextColor={colors.textMuted}
          multiline
          scrollEnabled={false}
          className="text-base leading-7 min-h-[300px] p-0 text-textPrimary"
          style={Platform.select({ web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any })}
        />
      </ScrollView>
    </View>
  );
};
