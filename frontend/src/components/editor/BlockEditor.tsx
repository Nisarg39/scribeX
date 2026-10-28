import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { NoteItem } from '../../types/note';
import { useTheme, NoteColors } from '../../theme';
import { Folder } from 'lucide-react-native';
import { BlockRenderer } from './BlockRenderer';
import {
  EditorHeader,
  EditorCommandBar,
  InsertPaletteModal,
} from './components';
import {
  useEditorState,
  useEditorDragAndDrop,
  useEditorInteractions,
} from './hooks';

export interface BlockEditorProps {
  note: NoteItem;
  onClose: () => void;
  onNoteUpdated: (updated: NoteItem) => void;
  onNoteDeleted: (noteId: string) => void;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
  note,
  onClose,
  onNoteUpdated,
  onNoteDeleted,
}) => {
  const { isDark } = useTheme();
  const [isInsertPaletteOpen, setIsInsertPaletteOpen] = useState(false);

  // 1. Note Container & Block Mutations Hook (with 3-tier action history & pristine draft protection)
  const {
    title,
    colorToken,
    isFavorite,
    isPinned,
    blocks,
    blocksRef,
    activeBlockId,
    activeChecklistPointId,
    activeBlockIdRef,
    focusTarget,
    setFocusTarget,
    inputRefs,
    titleInputRef,
    historyState,
    isTextFormatApplicable,
    currentActiveStyle,
    handleUndo,
    handleRedo,
    handleTitleChange,
    handleColorChange,
    handleTogglePin,
    handleToggleFavorite,
    handleReorderBlock,
    handleMoveUp,
    handleMoveDown,
    handleUpdateBlock,
    handleUpdateContent,
    handleUpdateMetadata,
    handleChangeType,
    handleDeleteBlock,
    handleInsertBlock,
    handleSwitchActiveType,
    handleSplitBlock,
    handleMergeWithPrevious,
    handleDeleteNote,
    setActiveBlockId,
    setActiveChecklistPointId,
  } = useEditorState({
    note,
    onNoteUpdated,
    onNoteDeleted,
  });

  // 2. Editor Drag-and-Drop & Autoscroll Subsystem (Exact 50px bounds threshold, GPU dragAnimY)
  const {
    draggingIndex,
    dragAnimY,
    draggingIndexRef,
    scrollViewRef,
    currentScrollY,
    scrollContentHeightRef,
    scrollViewLayoutRef,
    handleStartDrag,
    handleDragMove,
    handleEndDrag,
    handleReportHeight,
    calculateShift,
    resetDragState,
    getScrollElement,
  } = useEditorDragAndDrop({
    blocksRef,
    onReorderBlock: handleReorderBlock,
    onBlockSelected: setActiveBlockId,
  });

  const handleDeselectAll = () => {
    resetDragState();
    setActiveBlockId(null);
    setActiveChecklistPointId(null);
  };

  // 3. Global Interactions Hook (Click-outside element deselection & keyboard shortcuts)
  useEditorInteractions({
    activeBlockIdRef,
    draggingIndexRef,
    onDeselectAll: handleDeselectAll,
    onUndo: handleUndo,
    onRedo: handleRedo,
    getScrollElement,
  });

  const activeIndex = activeBlockId ? blocks.findIndex((b) => b.id === activeBlockId) : -1;
  const canMoveUp = activeIndex > 0;
  const canMoveDown = activeIndex !== -1 && activeIndex < blocks.length - 1;

  return (
    <View className="flex-1 w-full bg-light-surface dark:bg-dark-surface relative">
      {/* Top Editorial Header Bar */}
      <EditorHeader
        colorToken={colorToken}
        isPinned={isPinned}
        isFavorite={isFavorite}
        onClose={onClose}
        onColorChange={handleColorChange}
        onTogglePin={handleTogglePin}
        onToggleFavorite={handleToggleFavorite}
        onDeleteNote={handleDeleteNote}
      />

      {/* Top Sticky Editorial Command Bar */}
      <EditorCommandBar
        isTextFormatApplicable={isTextFormatApplicable}
        currentActiveStyle={currentActiveStyle}
        canUndo={historyState.canUndo}
        canRedo={historyState.canRedo}
        hasActiveBlock={!!activeBlockId}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onOpenInsertPalette={() => setIsInsertPaletteOpen(true)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSwitchActiveType={handleSwitchActiveType}
        onInsertQuickTask={() =>
          handleInsertBlock('checklist', {
            items: [
              {
                id: `task-${Date.now()}-1`,
                text: '',
                checked: false,
                priority: 'none',
                dueDate: 'Today',
              },
            ],
          })
        }
        onInsertQuickMedia={() =>
          handleInsertBlock('image', {
            url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80',
            caption: '',
            width: '100%',
            align: 'center',
            aspectRatio: 'natural',
          })
        }
        onMoveUp={() => {
          if (canMoveUp) handleMoveUp(activeIndex);
        }}
        onMoveDown={() => {
          if (canMoveDown) handleMoveDown(activeIndex);
        }}
        onDeleteActiveBlock={() => {
          if (activeBlockId) handleDeleteBlock(activeBlockId);
        }}
      />

      {/* Editor Main Continuous Canvas */}
      <ScrollView
        ref={scrollViewRef}
        nativeID="scribex-editor-scrollview"
        id="scribex-editor-scrollview"
        scrollEnabled={draggingIndex === null}
        keyboardShouldPersistTaps="always"
        onScroll={(e) => {
          currentScrollY.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        onContentSizeChange={(_w, h) => {
          scrollContentHeightRef.current = h;
        }}
        onLayout={(e) => {
          scrollViewLayoutRef.current = e.nativeEvent.layout;
        }}
        className="flex-1 w-full px-6 md:px-16 lg:px-24 pt-6"
        contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Folder Badge & Metadata */}
        <Pressable onPress={handleDeselectAll} className="flex-row items-center gap-2 mb-4 self-start">
          <View
            style={{ backgroundColor: NoteColors[colorToken] }}
            className="flex-row items-center gap-1.5 px-3 py-1 rounded-full shadow-sm"
          >
            <Folder size={11} color="#191919" />
            <Text className="text-xs font-bold text-[#191919]">{note.folderPath || 'General'}</Text>
          </View>
          <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
            • Last updated {note.updatedAt || 'Just now'}
          </Text>
        </Pressable>

        {/* Large Bold Editorial Title */}
        <TextInput
          ref={titleInputRef}
          nativeID="scribex-note-title-input"
          id="scribex-note-title-input"
          placeholder="Note Title..."
          placeholderTextColor={isDark ? '#626262' : '#929292'}
          value={title}
          onFocus={() => {
            setActiveBlockId(null);
            setActiveChecklistPointId(null);
          }}
          onChangeText={handleTitleChange}
          onSubmitEditing={() => {
            if (blocks.length > 0) {
              setFocusTarget({
                blockId: blocks[0].id,
                cursorPosition: 0,
                timestamp: Date.now(),
              });
            }
          }}
          className="text-3xl md:text-5xl font-black text-light-textPrimary dark:text-dark-textPrimary tracking-tight mb-4 py-2 outline-none"
        />

        {/* Continuous Stream of Editorial Blocks */}
        <View className="mb-4">
          {blocks.map((block, idx) => {
            const isDragging = draggingIndex === idx;
            const shiftOffset = calculateShift(idx);

            return (
              <BlockRenderer
                key={block.id}
                block={block}
                index={idx}
                totalBlocks={blocks.length}
                isActive={block.id === activeBlockId}
                activePointId={block.id === activeBlockId ? activeChecklistPointId : null}
                onFocusPoint={(pointId) => {
                  setActiveChecklistPointId(pointId);
                }}
                isDragging={isDragging}
                isAnyDragging={draggingIndex !== null}
                dragAnimY={dragAnimY}
                shiftOffset={shiftOffset}
                inputRef={(el) => {
                  inputRefs.current[block.id] = el;
                }}
                focusSelection={
                  focusTarget?.blockId === block.id && focusTarget.cursorPosition !== undefined
                    ? { start: focusTarget.cursorPosition, end: focusTarget.cursorPosition }
                    : undefined
                }
                onClearFocusTarget={() => {
                  if (focusTarget?.blockId === block.id) setFocusTarget(null);
                }}
                onSplitBlock={(pos) => handleSplitBlock(idx, pos)}
                onBackspaceAtStart={() => handleMergeWithPrevious(idx)}
                onStartDrag={(clientY) => handleStartDrag(idx, clientY)}
                onDragMove={handleDragMove}
                onEndDrag={handleEndDrag}
                onReportHeight={(h) => handleReportHeight(block.id, h)}
                onFocus={() => {
                  resetDragState();
                  setActiveBlockId(block.id);
                  if (block.type !== 'checklist') {
                    setActiveChecklistPointId(null);
                  }
                }}
                onEnterPress={() => handleSplitBlock(idx, 0)}
                onUpdateBlock={(updates) => handleUpdateBlock(block.id, updates)}
                onUpdateContent={(content) => handleUpdateContent(block.id, content)}
                onUpdateMetadata={(metadata) => handleUpdateMetadata(block.id, metadata)}
                onChangeType={(type) => handleChangeType(block.id, type)}
                onDelete={() => handleDeleteBlock(block.id)}
                onMoveUp={() => handleMoveUp(idx)}
                onMoveDown={() => handleMoveDown(idx)}
              />
            );
          })}
        </View>

        {/* Canvas tap area below blocks to deselect */}
        <Pressable
          onPress={handleDeselectAll}
          className="w-full h-8"
          accessibilityLabel="Click canvas to deselect"
        />
      </ScrollView>

      {/* Modern Insert Palette Modal */}
      <InsertPaletteModal
        isOpen={isInsertPaletteOpen}
        onClose={() => setIsInsertPaletteOpen(false)}
        activeBlockId={activeBlockId}
        onInsertBlock={(type, metadata) => {
          handleInsertBlock(type, metadata);
          setIsInsertPaletteOpen(false);
        }}
      />
    </View>
  );
};
