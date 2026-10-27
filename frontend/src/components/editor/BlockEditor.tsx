/**
 * ScribeX Detailed Note View / Clean Canvas Editor.
 *
 * Provides a minimal, distraction-free writing canvas for note inspection
 * and editing, stripping out legacy card and block gutter UI elements
 * while preserving debounced auto-saving and full database synchronization.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
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
    <View style={[styles.container, { backgroundColor: isDark ? colors.appBg : '#FAFAFA' }]}>
      {/* Minimal Top Navigation */}
      <View style={[styles.topBar, { borderBottomColor: colors.borderSubtle }]}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityLabel="Back to notes"
        >
          <ArrowLeft size={18} color={colors.textPrimary} />
          <Text style={[styles.backText, { color: colors.textPrimary }]}>Notes</Text>
        </Pressable>

        <View style={styles.topRightInfo}>
          <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{groupName}</Text>
          <View style={styles.saveStatus}>
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <>
                <Check size={14} color="#10B981" />
                <Text style={[styles.savedText, { color: colors.textMuted }]}>Saved</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Clean Distraction-Free Editorial Canvas */}
      <ScrollView
        contentContainerStyle={styles.canvasScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          value={title}
          onChangeText={handleTitleChange}
          placeholder="Title"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.titleInput,
            {
              color: colors.textPrimary,
              ...Platform.select({
                web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
              }),
            },
          ]}
          multiline
        />

        <TextInput
          value={content}
          onChangeText={handleContentChange}
          placeholder="Start writing..."
          placeholderTextColor={colors.textMuted}
          multiline
          scrollEnabled={false}
          style={[
            styles.contentInput,
            {
              color: colors.textPrimary,
              ...Platform.select({
                web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
              }),
            },
          ]}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 20 : 54,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 15,
    fontWeight: '500',
  },
  topRightInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  saveStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedText: {
    fontSize: 12,
  },
  canvasScroll: {
    maxWidth: 820,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 100,
  },
  titleInput: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    marginBottom: 20,
    padding: 0,
  },
  contentInput: {
    fontSize: 16,
    lineHeight: 28,
    minHeight: 300,
    padding: 0,
  },
});
