import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useTheme, NoteColors } from '../../../theme';
import {
  Kanban as KanbanIcon,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
} from 'lucide-react-native';

export interface KanbanCard {
  id: string;
  title: string;
  priority?: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  cardIds: string[];
}

export interface KanbanMetadata {
  columns: KanbanColumn[];
  cards: Record<string, KanbanCard>;
}

interface KanbanBlockProps {
  metadata?: KanbanMetadata;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onDelete?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onUpdateKanban?: (metadata: KanbanMetadata) => void;
}

const DEFAULT_KANBAN: KanbanMetadata = {
  columns: [
    { id: 'todo', title: 'To Do', color: '#38BDF8', cardIds: ['k-1'] },
    { id: 'in_progress', title: 'In Progress', color: '#F59E0B', cardIds: ['k-2'] },
    { id: 'done', title: 'Done', color: '#10B981', cardIds: ['k-3'] },
  ],
  cards: {
    'k-1': { id: 'k-1', title: 'Define interface architecture' },
    'k-2': { id: 'k-2', title: 'Implement composable blocks' },
    'k-3': { id: 'k-3', title: 'Setup local SQLite storage' },
  },
};

export const KanbanBlock: React.FC<KanbanBlockProps> = ({
  metadata,
  isSelected = false,
  isDragging = false,
  onFocus,
  onDelete,
  onStartDrag,
  onUpdateKanban,
}) => {
  const { isDark } = useTheme();

  // Active state data with default fallback
  const kanbanData: KanbanMetadata = useMemo(() => {
    if (metadata && Array.isArray(metadata.columns) && metadata.columns.length > 0 && metadata.cards) {
      return metadata;
    }
    return DEFAULT_KANBAN;
  }, [metadata]);

  const [addingToColId, setAddingToColId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');

  const commitUpdate = (nextData: KanbanMetadata) => {
    onUpdateKanban?.(nextData);
  };

  const handleAddCard = (columnId: string) => {
    if (!newCardTitle.trim()) {
      setAddingToColId(null);
      return;
    }
    const cardId = `k-${Date.now()}`;
    const nextCards = {
      ...kanbanData.cards,
      [cardId]: { id: cardId, title: newCardTitle.trim() },
    };
    const nextColumns = kanbanData.columns.map((col) =>
      col.id === columnId ? { ...col, cardIds: [...col.cardIds, cardId] } : col
    );
    setNewCardTitle('');
    setAddingToColId(null);
    commitUpdate({ columns: nextColumns, cards: nextCards });
  };

  const handleUpdateCardTitle = (cardId: string, title: string) => {
    if (!kanbanData.cards[cardId]) return;
    const nextCards = {
      ...kanbanData.cards,
      [cardId]: { ...kanbanData.cards[cardId], title },
    };
    commitUpdate({ ...kanbanData, cards: nextCards });
  };

  const handleDeleteCard = (cardId: string, columnId: string) => {
    const nextColumns = kanbanData.columns.map((col) =>
      col.id === columnId
        ? { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) }
        : col
    );
    const nextCards = { ...kanbanData.cards };
    delete nextCards[cardId];
    commitUpdate({ columns: nextColumns, cards: nextCards });
  };

  const handleMoveCard = (cardId: string, fromColId: string, direction: 'left' | 'right') => {
    onFocus?.();
    const colIndices = kanbanData.columns.map((c) => c.id);
    const currentIdx = colIndices.indexOf(fromColId);
    if (currentIdx === -1) return;

    const targetIdx = direction === 'left' ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= kanbanData.columns.length) return;

    const targetColId = kanbanData.columns[targetIdx].id;

    const nextColumns = kanbanData.columns.map((col) => {
      if (col.id === fromColId) {
        return { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) };
      }
      if (col.id === targetColId) {
        return { ...col, cardIds: [...col.cardIds, cardId] };
      }
      return col;
    });

    commitUpdate({ ...kanbanData, columns: nextColumns });
  };

  const totalCards = Object.keys(kanbanData.cards).length;

  const containerStyle = useMemo(() => {
    return {
      borderColor: isSelected
        ? isDark
          ? 'rgba(6, 182, 212, 0.7)'
          : 'rgba(6, 182, 212, 0.85)'
        : 'transparent',
      backgroundColor: isSelected
        ? isDark
          ? 'rgba(6, 182, 212, 0.04)'
          : 'rgba(240, 253, 250, 0.5)'
        : isDark
        ? 'rgba(255, 255, 255, 0.02)'
        : 'rgba(0, 0, 0, 0.02)',
    };
  }, [isSelected, isDark]);

  return (
    <View
      style={containerStyle}
      className="py-3 px-3 my-2 rounded-2xl border-2 transition-all cursor-default"
    >
      {/* Block Header Strip */}
      <View className="flex-row items-center justify-between mb-3 px-1">
        <View className="flex-row items-center gap-2">
          <View className="w-2 h-2 rounded-full bg-note-cyan shadow-sm shadow-note-cyan" />
          <Text className="text-[11px] uppercase tracking-wider font-bold text-light-textMuted dark:text-dark-textMuted">
            In-Note Kanban Board
          </Text>
          <View className="px-2 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/60 dark:border-white/5">
            <Text className="text-[10px] font-semibold text-light-textSecondary dark:text-dark-textSecondary">
              {totalCards} total tasks
            </Text>
          </View>
        </View>

        {onDelete && (
          <Pressable
            onPress={onDelete}
            className="p-1 rounded-full opacity-40 hover:opacity-100 hover:bg-red-500/10"
            style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
            accessibilityLabel="Delete Kanban block"
          >
            <Trash2 size={13} color={isDark ? '#B5B5B5' : '#626262'} />
          </Pressable>
        )}
      </View>

      {/* Kanban Swimlanes / Columns */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, width: '100%' }}
        className="flex-row"
      >
        {kanbanData.columns.map((column, colIdx) => {
          const cardCount = column.cardIds.length;
          const isDoneCol = column.id === 'done';

          return (
            <View
              key={column.id}
              className="flex-1 min-w-[220px] rounded-xl p-2 bg-light-appBg/50 dark:bg-dark-raised/50 border border-light-border/50 dark:border-white/5"
            >
              {/* Column Header */}
              <View className="flex-row items-center justify-between pb-2 mb-2 border-b border-light-border/40 dark:border-white/5 px-1">
                <View className="flex-row items-center gap-1.5">
                  <View
                    style={{ backgroundColor: column.color }}
                    className="w-2 h-2 rounded-full"
                  />
                  <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                    {column.title}
                  </Text>
                  <View className="px-1.5 py-0.2 rounded-full bg-light-surface dark:bg-dark-surface border border-light-border/50 dark:border-white/5">
                    <Text className="text-[10px] font-semibold text-light-textMuted dark:text-dark-textMuted">
                      {cardCount}
                    </Text>
                  </View>
                </View>

                {/* Quick Add Button */}
                <Pressable
                  onPress={() => {
                    onFocus?.();
                    setAddingToColId(column.id);
                  }}
                  className="p-1 rounded-full opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
                  style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
                  accessibilityLabel={`Add task to ${column.title}`}
                >
                  <Plus size={13} color={isDark ? '#D4D4D8' : '#52525B'} strokeWidth={2.4} />
                </Pressable>
              </View>

              {/* Card Items inside Column */}
              <View className="space-y-1.5 min-h-[40px]">
                {column.cardIds.map((cardId) => {
                  const card = kanbanData.cards[cardId];
                  if (!card) return null;

                  return (
                    <View
                      key={cardId}
                      className="p-2 rounded-lg bg-light-surface dark:bg-[#1E1E21] border border-light-border/60 dark:border-white/5 group shadow-xs"
                    >
                      {/* Card Content & Action Bar */}
                      <TextInput
                        value={card.title}
                        onChangeText={(t) => handleUpdateCardTitle(cardId, t)}
                        onFocus={onFocus}
                        multiline
                        scrollEnabled={false}
                        placeholder="Task name..."
                        placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                        className={`text-xs md:text-sm outline-none py-0.5 leading-snug ${
                          isDoneCol
                            ? 'line-through text-light-textMuted dark:text-dark-textMuted'
                            : 'text-light-textPrimary dark:text-dark-textPrimary font-medium'
                        }`}
                      />

                      {/* Directional Move Controls + Delete */}
                      <View className="flex-row items-center justify-between mt-1.5 pt-1 border-t border-light-border/20 dark:border-white/5">
                        {/* Move Left Button */}
                        {colIdx > 0 ? (
                          <Pressable
                            onPress={() => handleMoveCard(cardId, column.id, 'left')}
                            className="flex-row items-center gap-0.5 p-1 rounded opacity-50 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
                            style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
                            accessibilityLabel="Move task to previous column"
                          >
                            <ArrowLeft size={11} color={isDark ? '#A1A1AA' : '#71717A'} />
                            <Text className="text-[9px] font-semibold text-light-textMuted dark:text-dark-textMuted hidden sm:flex">
                              {kanbanData.columns[colIdx - 1]?.title}
                            </Text>
                          </Pressable>
                        ) : (
                          <View className="w-4" />
                        )}

                        <View className="flex-row items-center gap-1">
                          {/* Delete Card */}
                          <Pressable
                            onPress={() => handleDeleteCard(cardId, column.id)}
                            className="p-1 rounded opacity-30 hover:opacity-100 hover:bg-red-500/10"
                            style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
                            accessibilityLabel="Delete task"
                          >
                            <Trash2 size={11} color={isDark ? '#A1A1AA' : '#71717A'} />
                          </Pressable>

                          {/* Move Right Button */}
                          {colIdx < kanbanData.columns.length - 1 && (
                            <Pressable
                              onPress={() => handleMoveCard(cardId, column.id, 'right')}
                              className="flex-row items-center gap-0.5 p-1 rounded opacity-50 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
                              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
                              accessibilityLabel="Move task to next column"
                            >
                              <Text className="text-[9px] font-semibold text-light-textMuted dark:text-dark-textMuted hidden sm:flex">
                                {kanbanData.columns[colIdx + 1]?.title}
                              </Text>
                              <ArrowRight size={11} color={isDark ? '#A1A1AA' : '#71717A'} />
                            </Pressable>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}

                {/* Inline Add Card Input when active */}
                {addingToColId === column.id ? (
                  <View className="p-2 rounded-lg bg-light-surface dark:bg-[#1E1E21] border border-note-cyan shadow-sm">
                    <TextInput
                      autoFocus
                      value={newCardTitle}
                      onChangeText={setNewCardTitle}
                      onSubmitEditing={() => handleAddCard(column.id)}
                      onBlur={() => handleAddCard(column.id)}
                      placeholder="Enter task title and press Enter..."
                      placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                      className="text-xs text-light-textPrimary dark:text-dark-textPrimary outline-none py-1"
                    />
                    <View className="flex-row justify-end gap-1 mt-1">
                      <Pressable
                        onPress={() => handleAddCard(column.id)}
                        className="px-2 py-0.5 rounded bg-note-cyan"
                      >
                        <Text className="text-[10px] font-bold text-black">Add</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      onFocus?.();
                      setAddingToColId(column.id);
                    }}
                    className="py-1.5 px-2 rounded-lg items-center justify-center opacity-50 hover:opacity-100 border border-dashed border-light-border dark:border-white/10"
                    style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : undefined)}
                  >
                    <Text className="text-[11px] font-semibold text-light-textMuted dark:text-dark-textMuted">
                      + Add task
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

