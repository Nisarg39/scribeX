import React from 'react';
import { ComposableBlock, BlockType } from '../../../types/note';
import { NoteColorToken } from '../../../theme';
import { ActionHistoryManager } from '../../../core/actionTracker';

export interface UseEditorBlockMutationsProps {
  blocksRef: React.MutableRefObject<ComposableBlock[]>;
  setBlocks: React.Dispatch<React.SetStateAction<ComposableBlock[]>>;
  activeBlockIdRef: React.MutableRefObject<string | null>;
  setActiveBlockId: (id: string | null) => void;
  setFocusTarget: (target: { blockId: string; cursorPosition?: number; timestamp: number } | null) => void;
  actionHistory: ActionHistoryManager;
  persistChanges: (title: string, colorToken: NoteColorToken, blocks: ComposableBlock[]) => Promise<void>;
  titleRef: React.MutableRefObject<string>;
  colorTokenRef: React.MutableRefObject<NoteColorToken>;
}

export function useEditorBlockMutations({
  blocksRef,
  setBlocks,
  activeBlockIdRef,
  setActiveBlockId,
  setFocusTarget,
  actionHistory,
  persistChanges,
  titleRef,
  colorTokenRef,
}: UseEditorBlockMutationsProps) {
  const handleConvertBlock = (
    blockId: string,
    type: BlockType,
    content: string = '',
    metadata?: Record<string, any>
  ) => {
    const currentBlocks = blocksRef.current;
    const nextBlocks: ComposableBlock[] = currentBlocks.map((b) =>
      b.id === blockId
        ? {
            ...b,
            type,
            content,
            metadata: metadata !== undefined ? metadata : b.metadata,
          }
        : b
    );
    blocksRef.current = nextBlocks;
    setBlocks(nextBlocks);

    actionHistory.recordAction({
      tier: 2,
      type: 'CHANGE_BLOCK_TYPE',
      description: `Convert to ${type}`,
      blockId,
      before: { blocks: currentBlocks },
      after: { blocks: nextBlocks },
    });

    setActiveBlockId(blockId);
    setFocusTarget({
      blockId,
      cursorPosition: content.length,
      timestamp: Date.now(),
    });

    if (nextBlocks.length > 0) {
      persistChanges(titleRef.current, colorTokenRef.current, nextBlocks);
    }
  };

  const handleInsertAfterBlock = (
    currentBlockId: string,
    type: BlockType,
    content: string = '',
    metadata?: Record<string, any>
  ) => {
    const currentBlocks = blocksRef.current;
    const activeIndex = currentBlocks.findIndex((b) => b.id === currentBlockId);
    const newBlock: ComposableBlock = {
      id: `b-${Date.now()}-${currentBlocks.length + 1}`,
      type,
      content,
      metadata,
    };

    let nextBlocks: ComposableBlock[];
    if (activeIndex !== -1) {
      nextBlocks = [
        ...currentBlocks.slice(0, activeIndex + 1),
        newBlock,
        ...currentBlocks.slice(activeIndex + 1),
      ];
    } else {
      nextBlocks = [...currentBlocks, newBlock];
    }

    actionHistory.recordAction({
      tier: 2,
      type: 'INSERT_BLOCK',
      description: `Insert ${type}`,
      blockId: newBlock.id,
      before: { blocks: currentBlocks },
      after: { blocks: nextBlocks },
    });

    blocksRef.current = nextBlocks;
    activeBlockIdRef.current = newBlock.id;
    setBlocks(nextBlocks);
    setActiveBlockId(newBlock.id);
    setFocusTarget({
      blockId: newBlock.id,
      cursorPosition: content.length,
      timestamp: Date.now(),
    });
    persistChanges(titleRef.current, colorTokenRef.current, nextBlocks);
  };

  const handleReplaceBlockWithBlocks = (
    blockId: string,
    rawBlocks: { type: BlockType; content: string; metadata?: Record<string, any> }[]
  ) => {
    const currentBlocks = blocksRef.current;
    const activeIndex = currentBlocks.findIndex((b) => b.id === blockId);
    if (activeIndex === -1 || rawBlocks.length === 0) return;

    const instantiatedBlocks: ComposableBlock[] = rawBlocks.map((b, idx) => ({
      id: idx === 0 ? blockId : `b-${Date.now()}-${idx}`,
      type: b.type,
      content: b.content,
      metadata: b.metadata,
    }));

    const nextBlocks = [
      ...currentBlocks.slice(0, activeIndex),
      ...instantiatedBlocks,
      ...currentBlocks.slice(activeIndex + 1),
    ];

    actionHistory.recordAction({
      tier: 2,
      type: 'CHANGE_BLOCK_TYPE',
      description: 'Markdown Conversion',
      blockId,
      before: { blocks: currentBlocks },
      after: { blocks: nextBlocks },
    });

    blocksRef.current = nextBlocks;
    setBlocks(nextBlocks);
    const lastBlock = instantiatedBlocks[instantiatedBlocks.length - 1];
    activeBlockIdRef.current = lastBlock.id;
    setActiveBlockId(lastBlock.id);
    setFocusTarget({
      blockId: lastBlock.id,
      cursorPosition: lastBlock.content.length,
      timestamp: Date.now(),
    });
    persistChanges(titleRef.current, colorTokenRef.current, nextBlocks);
  };

  const handleSplitBlock = (index: number, splitPosition: number = 0) => {
    const currentBlocks = blocksRef.current;
    const currentBlock = currentBlocks[index];
    if (!currentBlock) return;

    const fullContent = currentBlock.content || '';
    const beforeText = fullContent.slice(0, splitPosition);
    const afterText = fullContent.slice(splitPosition);

    const newBlockId = `b-${Date.now()}-${currentBlocks.length + 1}`;
    const newBlock: ComposableBlock = {
      id: newBlockId,
      type: 'paragraph',
      content: afterText,
    };

    const nextBlocks = [
      ...currentBlocks.slice(0, index),
      { ...currentBlock, content: beforeText },
      newBlock,
      ...currentBlocks.slice(index + 1),
    ];

    actionHistory.recordAction({
      tier: 2,
      type: 'INSERT_BLOCK',
      description: 'Split Block',
      blockId: newBlockId,
      before: { blocks: currentBlocks },
      after: { blocks: nextBlocks },
    });

    blocksRef.current = nextBlocks;
    activeBlockIdRef.current = newBlockId;
    setBlocks(nextBlocks);
    setActiveBlockId(newBlockId);
    persistChanges(titleRef.current, colorTokenRef.current, nextBlocks);

    setFocusTarget({
      blockId: newBlockId,
      cursorPosition: 0,
      timestamp: Date.now(),
    });
  };

  const handleMergeWithPrevious = (index: number) => {
    if (index === 0) {
      setFocusTarget({
        blockId: 'note-title',
        cursorPosition: titleRef.current.length,
        timestamp: Date.now(),
      });
      return;
    }

    const currentBlocks = blocksRef.current;
    const currentBlock = currentBlocks[index];
    const prevBlock = currentBlocks[index - 1];
    if (!currentBlock || !prevBlock) return;

    const isTextCompatible = (type: BlockType) =>
      type === 'paragraph' || type === 'heading' || type === 'quote';

    if (isTextCompatible(currentBlock.type) && isTextCompatible(prevBlock.type)) {
      const prevContent = prevBlock.content || '';
      const currentContent = currentBlock.content || '';
      const junctionPosition = prevContent.length;
      const mergedContent = prevContent + currentContent;

      const updatedPrevBlock = { ...prevBlock, content: mergedContent };
      const nextBlocks = [
        ...currentBlocks.slice(0, index - 1),
        updatedPrevBlock,
        ...currentBlocks.slice(index + 1),
      ];

      actionHistory.recordAction({
        tier: 2,
        type: 'DELETE_BLOCK',
        description: 'Merge Block with Previous',
        blockId: currentBlock.id,
        before: { blocks: currentBlocks },
        after: { blocks: nextBlocks },
      });

      blocksRef.current = nextBlocks;
      activeBlockIdRef.current = prevBlock.id;
      setBlocks(nextBlocks);
      setActiveBlockId(prevBlock.id);
      persistChanges(titleRef.current, colorTokenRef.current, nextBlocks);

      setFocusTarget({
        blockId: prevBlock.id,
        cursorPosition: junctionPosition,
        timestamp: Date.now(),
      });
      return;
    }

    if (!currentBlock.content || currentBlock.content.trim() === '') {
      const nextBlocks = currentBlocks.filter((_, i) => i !== index);

      actionHistory.recordAction({
        tier: 2,
        type: 'DELETE_BLOCK',
        description: 'Delete Empty Block',
        blockId: currentBlock.id,
        before: { blocks: currentBlocks },
        after: { blocks: nextBlocks },
      });

      blocksRef.current = nextBlocks;
      activeBlockIdRef.current = prevBlock.id;
      setBlocks(nextBlocks);
      setActiveBlockId(prevBlock.id);
      persistChanges(titleRef.current, colorTokenRef.current, nextBlocks);

      const targetPos = prevBlock.content ? prevBlock.content.length : 0;
      setFocusTarget({
        blockId: prevBlock.id,
        cursorPosition: targetPos,
        timestamp: Date.now(),
      });
      return;
    }

    setActiveBlockId(prevBlock.id);
    setFocusTarget({
      blockId: prevBlock.id,
      cursorPosition: prevBlock.content ? prevBlock.content.length : 0,
      timestamp: Date.now(),
    });
  };

  return {
    handleConvertBlock,
    handleInsertAfterBlock,
    handleReplaceBlockWithBlocks,
    handleSplitBlock,
    handleMergeWithPrevious,
  };
}
