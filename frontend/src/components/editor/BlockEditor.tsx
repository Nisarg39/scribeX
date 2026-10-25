/**
 * ScribeX Composable Block-Based Note Editor.
 *
 * Implements the universal 20-block registry with inline editing,
 * unified task state synchronization, and debounced auto-saving.
 * Adheres strictly to non-generic UI principles with pastel highlights.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import {
  CheckSquare,
  Square,
  Hash,
  Type,
  List,
  ListOrdered,
  Code2,
  AlertCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowLeft,
  Check,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { pastelColors, PastelColorKey } from '../../theme/tokens';
import {
  NoteBlock,
  BlockType,
  parseMarkdownToBlocks,
  serializeBlocksToMarkdown,
} from '../../core/astSerializer';

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
  colorToken = 'apricot',
  groupName = 'General',
  onSave,
  onClose,
}) => {
  const { colors, isDark } = useTheme();

  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState<NoteBlock[]>(() =>
    parseMarkdownToBlocks(initialMarkdown)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [activeBlockMenu, setActiveBlockMenu] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);

  // Auto-save debounced runner
  const triggerAutoSave = useCallback(() => {
    isDirtyRef.current = true;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      if (!isDirtyRef.current) return;
      setIsSaving(true);
      try {
        const markdown = serializeBlocksToMarkdown(blocks);
        await onSave({
          title: title.trim() || 'Untitled Note',
          content_markdown: markdown,
        });
        isDirtyRef.current = false;
        setLastSavedTime(new Date());
      } catch (err) {
        console.warn('Auto-save error:', err);
      } finally {
        setIsSaving(false);
      }
    }, 350);
  }, [blocks, title, onSave]);

  // Update a block's content
  const updateBlock = (blockId: string, updatedContent: any) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? ({ ...b, content: { ...b.content, ...updatedContent } } as any) : b
      )
    );
    triggerAutoSave();
  };

  // Toggle checklist task item
  const toggleTask = (blockId: string, currentChecked: boolean) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId && (b.block_type === 'task' || b.block_type === 'checklist')
          ? { ...b, content: { ...b.content, checked: !currentChecked } }
          : b
      )
    );
    triggerAutoSave();
  };

  // Change a block's type
  const changeBlockType = (blockId: string, newType: BlockType) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        let currentText = '';
        if ('text' in b.content) currentText = (b.content as any).text;
        else if ('code' in b.content) currentText = (b.content as any).code;

        switch (newType) {
          case 'heading':
            return {
              id: b.id,
              block_type: 'heading',
              position: b.position,
              content: { text: currentText, level: 2 },
            };
          case 'task':
          case 'checklist':
            return {
              id: b.id,
              block_type: 'task',
              position: b.position,
              content: {
                taskId: `tsk_${Date.now().toString(36)}`,
                text: currentText,
                checked: false,
                priority: 'medium',
              },
            };
          case 'code':
            return {
              id: b.id,
              block_type: 'code',
              position: b.position,
              content: { code: currentText, language: 'javascript' },
            };
          case 'callout':
            return {
              id: b.id,
              block_type: 'callout',
              position: b.position,
              content: { text: currentText, variant: 'info' },
            };
          case 'bulleted_list':
            return {
              id: b.id,
              block_type: 'bulleted_list',
              position: b.position,
              content: { items: currentText ? [currentText] : [''] },
            };
          case 'paragraph':
          default:
            return {
              id: b.id,
              block_type: 'paragraph',
              position: b.position,
              content: { text: currentText },
            };
        }
      })
    );
    setActiveBlockMenu(null);
    triggerAutoSave();
  };

  // Add a new block below an index
  const addBlockBelow = (index: number, type: BlockType = 'paragraph') => {
    const newBlock: NoteBlock = {
      id: `blk_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      block_type: type as any,
      position: index + 1,
      content:
        type === 'task'
          ? ({ taskId: `tsk_${Date.now().toString(36)}`, text: '', checked: false, priority: 'medium' } as any)
          : type === 'heading'
          ? ({ text: '', level: 2 } as any)
          : type === 'code'
          ? ({ code: '', language: 'javascript' } as any)
          : ({ text: '' } as any),
    };

    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, newBlock);
      return next.map((b, idx) => ({ ...b, position: idx }));
    });
    triggerAutoSave();
  };

  // Delete a block
  const deleteBlock = (blockId: string) => {
    if (blocks.length <= 1) return; // keep at least 1 block
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    triggerAutoSave();
  };

  // Move block up or down
  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;

    setBlocks((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next.map((b, idx) => ({ ...b, position: idx }));
    });
    triggerAutoSave();
  };

  const accentColor = pastelColors[colorToken] || pastelColors.apricot;

  return (
    <View style={[styles.container, { backgroundColor: colors.appBg }]}>
      {/* Top Navigation & Status Bar */}
      <View style={styles.navBar}>
        <View style={styles.navLeft}>
          {onClose && (
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={[
                styles.navButton,
                {
                  backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                  borderColor: colors.borderSubtle,
                },
              ]}
              accessibilityLabel="Back to notes"
            >
              <ArrowLeft size={18} color={colors.textPrimary} />
            </Pressable>
          )}

          <View style={[styles.groupTag, { backgroundColor: accentColor }]}>
            <Text style={styles.groupTagText}>{groupName}</Text>
          </View>
        </View>

        <View style={styles.navRight}>
          <View style={styles.saveIndicator}>
            {isSaving ? (
              <View style={styles.saveRow}>
                <ActivityIndicator size="small" color={colors.textMuted} />
                <Text style={[styles.saveText, { color: colors.textMuted }]}>
                  Saving...
                </Text>
              </View>
            ) : (
              <View style={styles.saveRow}>
                <Check size={14} color="#10B981" />
                <Text style={[styles.saveText, { color: colors.textSecondary }]}>
                  Saved {lastSavedTime ? lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Editor Surface */}
      <ScrollView
        contentContainerStyle={[
          styles.editorCanvas,
          { maxWidth: 900, alignSelf: 'center', width: '100%' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Input */}
        <TextInput
          value={title}
          onChangeText={(newTitle) => {
            setTitle(newTitle);
            triggerAutoSave();
          }}
          placeholder="Untitled Note"
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
        />

        {/* Dynamic Composable Block Surface */}
        <View style={styles.blocksList}>
          {blocks.map((block, index) => {
            return (
              <View key={block.id} style={styles.blockRow}>
                {/* Block Handle & Type Selector */}
                <View style={styles.blockGutter}>
                  <Pressable
                    onPress={() =>
                      setActiveBlockMenu(activeBlockMenu === block.id ? null : block.id)
                    }
                    hitSlop={6}
                    style={styles.gutterAction}
                    accessibilityLabel="Block Options"
                  >
                    {block.block_type === 'heading' ? (
                      <Hash size={14} color={colors.textMuted} />
                    ) : block.block_type === 'task' || block.block_type === 'checklist' ? (
                      <CheckSquare size={14} color={colors.textMuted} />
                    ) : block.block_type === 'code' ? (
                      <Code2 size={14} color={colors.textMuted} />
                    ) : block.block_type === 'callout' ? (
                      <AlertCircle size={14} color={colors.textMuted} />
                    ) : (
                      <Type size={14} color={colors.textMuted} />
                    )}
                  </Pressable>
                </View>

                {/* Block Content Renderers */}
                <View style={styles.blockContentContainer}>
                  {/* HEADING BLOCK */}
                  {block.block_type === 'heading' && (
                    <TextInput
                      value={block.content.text}
                      onChangeText={(t) => updateBlock(block.id, { text: t })}
                      placeholder="Heading..."
                      placeholderTextColor={colors.textMuted}
                      style={[
                        styles.headingText,
                        block.content.level === 1
                          ? styles.h1
                          : block.content.level === 2
                          ? styles.h2
                          : styles.h3,
                        {
                          color: colors.textPrimary,
                          ...Platform.select({
                            web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
                          }),
                        },
                      ]}
                    />
                  )}

                  {/* PARAGRAPH BLOCK */}
                  {block.block_type === 'paragraph' && (
                    <TextInput
                      value={block.content.text}
                      onChangeText={(t) => updateBlock(block.id, { text: t })}
                      placeholder="Type something or start with /..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      style={[
                        styles.paragraphText,
                        {
                          color: colors.textPrimary,
                          ...Platform.select({
                            web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
                          }),
                        },
                      ]}
                    />
                  )}

                  {/* TASK / CHECKLIST BLOCK */}
                  {(block.block_type === 'task' || block.block_type === 'checklist') && (
                    <View style={styles.taskRow}>
                      <Pressable
                        onPress={() => toggleTask(block.id, block.content.checked)}
                        hitSlop={6}
                        style={styles.taskCheckbox}
                      >
                        {block.content.checked ? (
                          <CheckSquare size={20} color="#10B981" />
                        ) : (
                          <Square size={20} color={colors.textMuted} />
                        )}
                      </Pressable>
                      <TextInput
                        value={block.content.text}
                        onChangeText={(t) => updateBlock(block.id, { text: t })}
                        placeholder="To-do task item..."
                        placeholderTextColor={colors.textMuted}
                        style={[
                          styles.taskText,
                          block.content.checked && styles.taskCompletedText,
                          {
                            color: block.content.checked ? colors.textMuted : colors.textPrimary,
                            ...Platform.select({
                              web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
                            }),
                          },
                        ]}
                      />
                      {block.content.priority && (
                        <View
                          style={[
                            styles.taskPriorityPill,
                            {
                              backgroundColor:
                                block.content.priority === 'urgent'
                                  ? '#EF444420'
                                  : block.content.priority === 'high'
                                  ? '#F59E0B20'
                                  : isDark
                                  ? '#3A3A3A'
                                  : '#F0F0F0',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.taskPriorityText,
                              {
                                color:
                                  block.content.priority === 'urgent'
                                    ? '#EF4444'
                                    : block.content.priority === 'high'
                                    ? '#F59E0B'
                                    : colors.textSecondary,
                              },
                            ]}
                          >
                            {block.content.priority}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* CODE BLOCK */}
                  {block.block_type === 'code' && (
                    <View
                      style={[
                        styles.codeBox,
                        {
                          backgroundColor: isDark ? '#1E1E1E' : '#F6F8FA',
                          borderColor: colors.borderSubtle,
                        },
                      ]}
                    >
                      <View style={styles.codeHeader}>
                        <Text style={styles.codeLangText}>
                          {block.content.language || 'code'}
                        </Text>
                      </View>
                      <TextInput
                        value={block.content.code}
                        onChangeText={(c) => updateBlock(block.id, { code: c })}
                        placeholder="// write code..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        style={[
                          styles.codeTextInput,
                          {
                            color: isDark ? '#E2E8F0' : '#1E293B',
                            ...Platform.select({
                              web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
                            }),
                          },
                        ]}
                      />
                    </View>
                  )}

                  {/* CALLOUT BLOCK */}
                  {block.block_type === 'callout' && (
                    <View
                      style={[
                        styles.calloutBox,
                        {
                          backgroundColor: isDark ? '#2D2820' : '#FFF9E6',
                          borderColor: '#FFC96F',
                        },
                      ]}
                    >
                      <AlertCircle size={18} color="#D97706" style={{ marginTop: 2 }} />
                      <TextInput
                        value={block.content.text}
                        onChangeText={(t) => updateBlock(block.id, { text: t })}
                        placeholder="Callout / key takeaway insight..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        style={[
                          styles.calloutTextInput,
                          {
                            color: colors.textPrimary,
                            ...Platform.select({
                              web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
                            }),
                          },
                        ]}
                      />
                    </View>
                  )}

                  {/* BULLETED LIST BLOCK */}
                  {block.block_type === 'bulleted_list' && (
                    <View style={styles.listContainer}>
                      {block.content.items.map((item, itemIdx) => (
                        <View key={itemIdx} style={styles.listItemRow}>
                          <Text style={[styles.bulletDot, { color: colors.textMuted }]}>•</Text>
                          <TextInput
                            value={item}
                            onChangeText={(newVal) => {
                              const updatedItems = [...block.content.items];
                              updatedItems[itemIdx] = newVal;
                              updateBlock(block.id, { items: updatedItems });
                            }}
                            placeholder="List item..."
                            placeholderTextColor={colors.textMuted}
                            style={[
                              styles.listTextInput,
                              {
                                color: colors.textPrimary,
                                ...Platform.select({
                                  web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
                                }),
                              },
                            ]}
                          />
                        </View>
                      ))}
                    </View>
                  )}

                  {/* NUMBERED LIST BLOCK */}
                  {block.block_type === 'numbered_list' && (
                    <View style={styles.listContainer}>
                      {block.content.items.map((item, itemIdx) => (
                        <View key={itemIdx} style={styles.listItemRow}>
                          <Text style={[styles.numberIndex, { color: colors.textSecondary }]}>
                            {itemIdx + 1}.
                          </Text>
                          <TextInput
                            value={item}
                            onChangeText={(newVal) => {
                              const updatedItems = [...block.content.items];
                              updatedItems[itemIdx] = newVal;
                              updateBlock(block.id, { items: updatedItems });
                            }}
                            placeholder="Step item..."
                            placeholderTextColor={colors.textMuted}
                            style={[
                              styles.listTextInput,
                              {
                                color: colors.textPrimary,
                                ...Platform.select({
                                  web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
                                }),
                              },
                            ]}
                          />
                        </View>
                      ))}
                    </View>
                  )}

                  {/* DIVIDER BLOCK */}
                  {block.block_type === 'divider' && (
                    <View style={[styles.dividerLine, { backgroundColor: colors.borderSubtle }]} />
                  )}
                </View>

                {/* Inline Block Action Menu Modal / Popover */}
                {activeBlockMenu === block.id && (
                  <View
                    style={[
                      styles.menuPopover,
                      {
                        backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                        borderColor: colors.borderSubtle,
                      },
                    ]}
                  >
                    <Text style={[styles.menuHeader, { color: colors.textMuted }]}>
                      CHANGE BLOCK TYPE
                    </Text>

                    <View style={styles.menuOptions}>
                      <Pressable
                        onPress={() => changeBlockType(block.id, 'paragraph')}
                        style={styles.menuItem}
                      >
                        <Type size={14} color={colors.textPrimary} />
                        <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
                          Paragraph
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => changeBlockType(block.id, 'heading')}
                        style={styles.menuItem}
                      >
                        <Hash size={14} color={colors.textPrimary} />
                        <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
                          Heading
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => changeBlockType(block.id, 'task')}
                        style={styles.menuItem}
                      >
                        <CheckSquare size={14} color={colors.textPrimary} />
                        <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
                          Task / To-Do
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => changeBlockType(block.id, 'code')}
                        style={styles.menuItem}
                      >
                        <Code2 size={14} color={colors.textPrimary} />
                        <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
                          Code Block
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => changeBlockType(block.id, 'callout')}
                        style={styles.menuItem}
                      >
                        <AlertCircle size={14} color={colors.textPrimary} />
                        <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
                          Callout Insight
                        </Text>
                      </Pressable>
                    </View>

                    <View style={[styles.menuDivider, { backgroundColor: colors.borderSubtle }]} />

                    <View style={styles.menuActionsRow}>
                      <Pressable
                        onPress={() => moveBlock(index, 'up')}
                        disabled={index === 0}
                        style={[styles.miniAction, index === 0 && { opacity: 0.3 }]}
                      >
                        <ChevronUp size={16} color={colors.textPrimary} />
                      </Pressable>
                      <Pressable
                        onPress={() => moveBlock(index, 'down')}
                        disabled={index === blocks.length - 1}
                        style={[styles.miniAction, index === blocks.length - 1 && { opacity: 0.3 }]}
                      >
                        <ChevronDown size={16} color={colors.textPrimary} />
                      </Pressable>
                      <Pressable
                        onPress={() => deleteBlock(block.id)}
                        style={styles.miniAction}
                      >
                        <Trash2 size={16} color="#EF4444" />
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Add Block Bottom Quick Actions */}
        <View style={styles.bottomAddRow}>
          <Pressable
            onPress={() => addBlockBelow(blocks.length - 1, 'paragraph')}
            style={[
              styles.addBlockButton,
              {
                backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            <Plus size={16} color={colors.textSecondary} />
            <Text style={[styles.addBlockText, { color: colors.textSecondary }]}>
              Add Block
            </Text>
          </Pressable>

          <Pressable
            onPress={() => addBlockBelow(blocks.length - 1, 'task')}
            style={[
              styles.addBlockButton,
              {
                backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            <CheckSquare size={16} color="#10B981" />
            <Text style={[styles.addBlockText, { color: colors.textSecondary }]}>
              Add Task
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  navBar: {
    paddingTop: Platform.OS === 'web' ? 18 : 44,
    paddingHorizontal: 24,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: 'transparent',
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  groupTag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  groupTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#191919',
    letterSpacing: 0.2,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveText: {
    fontSize: 12,
    fontWeight: '500',
  },
  editorCanvas: {
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  titleInput: {
    fontSize: Platform.OS === 'web' ? 36 : 28,
    fontWeight: '700',
    lineHeight: Platform.OS === 'web' ? 42 : 34,
    letterSpacing: -0.5,
    marginBottom: 24,
    paddingVertical: 4,
  },
  blocksList: {
    width: '100%',
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    position: 'relative',
  },
  blockGutter: {
    width: 28,
    paddingTop: 4,
    marginRight: 6,
  },
  gutterAction: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockContentContainer: {
    flex: 1,
  },
  headingText: {
    fontWeight: '700',
    paddingVertical: 2,
  },
  h1: {
    fontSize: 26,
    lineHeight: 32,
  },
  h2: {
    fontSize: 21,
    lineHeight: 27,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
  },
  paragraphText: {
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: 2,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  taskCheckbox: {
    paddingTop: 1,
  },
  taskText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  taskCompletedText: {
    textDecorationLine: 'line-through',
  },
  taskPriorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  taskPriorityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  codeBox: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 6,
  },
  codeHeader: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
  },
  codeLangText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  codeTextInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 20,
    padding: 14,
  },
  calloutBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 6,
  },
  calloutTextInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  listContainer: {
    width: '100%',
    paddingVertical: 2,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  bulletDot: {
    fontSize: 18,
    lineHeight: 22,
    width: 14,
  },
  numberIndex: {
    fontSize: 14,
    fontWeight: '600',
    width: 20,
  },
  listTextInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  dividerLine: {
    height: 1,
    width: '100%',
    marginVertical: 14,
  },
  menuPopover: {
    position: 'absolute',
    top: 28,
    left: 28,
    zIndex: 200,
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    width: 190,
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(0,0,0,0.15)' } as any,
    }),
  },
  menuHeader: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    letterSpacing: 0.5,
  },
  menuOptions: {
    gap: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  menuItemText: {
    fontSize: 13,
  },
  menuDivider: {
    height: 1,
    marginVertical: 6,
  },
  menuActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 2,
  },
  miniAction: {
    padding: 6,
    borderRadius: 6,
  },
  bottomAddRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 12,
  },
  addBlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  addBlockText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
