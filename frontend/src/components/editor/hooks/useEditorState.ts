import { useState, useRef, useEffect } from 'react';
import { TextInput } from 'react-native';
import { NoteItem, ComposableBlock, BlockType, ChecklistPoint, ChecklistPointStyle } from '../../../types/note';
import { NoteColorToken } from '../../../theme';
import { notesRepo } from '../../../db/notesRepo';
import { tasksRepo } from '../../../db/tasksRepo';
import { serializeBlocksToMarkdown, coalesceChecklistBlocks } from '../../../core/astSerializer';
import { ActionHistoryManager } from '../../../core/actionTracker';
import { NoteTemplate, instantiateTemplateBlocks } from '../../../core/templates/noteTemplates';

export const isTextTransformableBlock = (type?: BlockType): boolean => {
  return type === 'paragraph' || type === 'heading' || type === 'quote' || type === 'checklist';
};

interface UseEditorStateProps {
  note: NoteItem;
  onNoteUpdated: (updated: NoteItem) => void;
  onNoteDeleted: (noteId: string) => void;
}

export const useEditorState = ({
  note,
  onNoteUpdated,
  onNoteDeleted,
}: UseEditorStateProps) => {
  const noteIdRef = useRef<string>(note.id);
  useEffect(() => {
    noteIdRef.current = note.id;
  }, [note.id]);

  const [title, setTitle] = useState(note.title || '');
  const titleRef = useRef(title);
  titleRef.current = title;

  const [colorToken, setColorToken] = useState<NoteColorToken>(note.colorToken || 'apricot');
  const colorTokenRef = useRef(colorToken);
  colorTokenRef.current = colorToken;

  const [isFavorite, setIsFavorite] = useState(note.isFavorite || false);
  const isFavoriteRef = useRef(isFavorite);
  isFavoriteRef.current = isFavorite;

  const [isPinned, setIsPinned] = useState(note.isPinned || false);
  const isPinnedRef = useRef(isPinned);
  isPinnedRef.current = isPinned;

  // Dual-Stack Action History Manager for Undo / Redo & Activity Tracking
  const actionHistory = useRef(new ActionHistoryManager()).current;
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  useEffect(() => {
    return actionHistory.subscribe(() => {
      setHistoryState({
        canUndo: actionHistory.canUndo(),
        canRedo: actionHistory.canRedo(),
      });
    });
  }, [actionHistory]);

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeChecklistPointId, setActiveChecklistPointId] = useState<string | null>(null);
  const activeBlockIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeBlockIdRef.current = activeBlockId;
  }, [activeBlockId]);

  // Focus Handoff State & Input Refs
  const [focusTarget, setFocusTarget] = useState<{
    blockId: string;
    cursorPosition?: number;
    timestamp: number;
  } | null>(null);
  const inputRefs = useRef<{ [blockId: string]: any }>({});
  const titleInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (focusTarget) {
      if (focusTarget.blockId === 'note-title') {
        titleInputRef.current?.focus();
      } else {
        const input = inputRefs.current[focusTarget.blockId];
        if (input) {
          input.focus();
          if (
            focusTarget.cursorPosition !== undefined &&
            typeof (input as any)?.setSelectionRange === 'function'
          ) {
            (input as any).setSelectionRange(
              focusTarget.cursorPosition,
              focusTarget.cursorPosition
            );
          }
        }
      }
    }
  }, [focusTarget]);

  const [blocks, setBlocks] = useState<ComposableBlock[]>(() => {
    const rawBlocks: ComposableBlock[] =
      note.blocks && note.blocks.length > 0
        ? note.blocks
        : [{ id: `b-${Date.now()}-1`, type: 'paragraph', content: note.contentMarkdown || '' }];
    return coalesceChecklistBlocks(rawBlocks);
  });

  const blocksRef = useRef<ComposableBlock[]>(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // Save changes to SQLite / Repository
  const persistChanges = async (
    newTitle: string = titleRef.current,
    newColor: NoteColorToken = colorTokenRef.current,
    newBlocks: ComposableBlock[] = blocksRef.current,
    newFav: boolean = isFavoriteRef.current,
    newPin: boolean = isPinnedRef.current
  ) => {
    // If it's a draft and still completely pristine, do NOT write to DB yet!
    const isPristine =
      !newTitle.trim() &&
      newBlocks.length === 1 &&
      newBlocks[0].type === 'paragraph' &&
      !newBlocks[0].content.trim() &&
      !actionHistory.hasActions();

    if (noteIdRef.current.startsWith('draft-') && isPristine) {
      return;
    }

    try {
      const contentMarkdown = serializeBlocksToMarkdown(newBlocks);
      const cleanTitle = newTitle.trim() || 'Untitled Note';

      let updated: NoteItem;
      if (noteIdRef.current.startsWith('draft-')) {
        // First user action on a draft! Create the real note in SQLite
        const permanentId = `note-${Date.now()}`;
        noteIdRef.current = permanentId;
        updated = await notesRepo.createNote({
          id: permanentId,
          title: cleanTitle,
          colorToken: newColor,
          blocks: newBlocks,
          contentMarkdown,
          folderPath: note.folderPath || 'General',
        });
      } else {
        // Existing note: update note in SQLite
        updated = await notesRepo.updateNote(noteIdRef.current, {
          title: cleanTitle,
          colorToken: newColor,
          blocks: newBlocks,
          contentMarkdown,
          isFavorite: newFav,
          isPinned: newPin,
        });
      }

      onNoteUpdated(updated);

      // Sync embedded checklists with global tasks table
      const checklistItems: any[] = [];
      newBlocks.forEach((b) => {
        if (b.type === 'checklist') {
          if (Array.isArray(b.metadata?.items)) {
            b.metadata.items.forEach((item: any) => {
              if (item.text && item.text.trim()) {
                checklistItems.push({
                  id: item.id,
                  text: item.text,
                  checked: !!item.checked,
                  priority: item.priority || 'none',
                  dueDate: item.dueDate || 'Today',
                });
              }
            });
          } else if (b.content && b.content.trim()) {
            checklistItems.push({
              id: b.metadata?.taskId || b.id,
              text: b.content,
              checked: !!b.metadata?.checked,
              priority: b.metadata?.priority || 'none',
              dueDate: b.metadata?.dueDate || 'Today',
            });
          }
        }
      });

      tasksRepo
        .syncNoteChecklists(noteIdRef.current, cleanTitle, newColor, checklistItems)
        .catch((err) => console.warn('Failed to sync note checklists to tasksRepo:', err));
    } catch (err) {
      console.warn('Failed to persist note changes in BlockEditor:', err);
    }
  };

  const handleUndo = () => {
    const action = actionHistory.undo();
    if (!action) return;

    actionHistory.setIsApplyingHistory(true);
    try {
      switch (action.type) {
        case 'SET_TITLE':
          setTitle(action.before);
          persistChanges(action.before, colorTokenRef.current, blocksRef.current, isFavoriteRef.current, isPinnedRef.current);
          break;
        case 'SET_COLOR':
          setColorToken(action.before);
          persistChanges(titleRef.current, action.before, blocksRef.current, isFavoriteRef.current, isPinnedRef.current);
          break;
        case 'TOGGLE_PIN':
          setIsPinned(action.before);
          persistChanges(titleRef.current, colorTokenRef.current, blocksRef.current, isFavoriteRef.current, action.before);
          break;
        case 'TOGGLE_FAVORITE':
          setIsFavorite(action.before);
          persistChanges(titleRef.current, colorTokenRef.current, blocksRef.current, action.before, isPinnedRef.current);
          break;
        case 'APPLY_TEMPLATE':
          if (action.before) {
            setTitle(action.before.title || '');
            titleRef.current = action.before.title || '';
            setColorToken(action.before.colorToken);
            colorTokenRef.current = action.before.colorToken;
            setBlocks(action.before.blocks);
            persistChanges(action.before.title || '', action.before.colorToken, action.before.blocks, isFavoriteRef.current, isPinnedRef.current);
          }
          break;
        case 'INSERT_BLOCK':
        case 'DELETE_BLOCK':
        case 'REORDER_BLOCKS':
        case 'CHANGE_BLOCK_TYPE':
        case 'UPDATE_CHECKLIST_STYLE':
          if (action.before?.blocks) {
            setBlocks(action.before.blocks);
            persistChanges(titleRef.current, colorTokenRef.current, action.before.blocks, isFavoriteRef.current, isPinnedRef.current);
          }
          break;
        case 'UPDATE_BLOCK_CONTENT':
          setBlocks((prev) => {
            const next = prev.map((b) =>
              b.id === action.blockId ? { ...b, content: action.before } : b
            );
            persistChanges(titleRef.current, colorTokenRef.current, next, isFavoriteRef.current, isPinnedRef.current);
            return next;
          });
          break;
        case 'UPDATE_IMAGE_METADATA':
        case 'UPDATE_AUDIO_METADATA':
        case 'UPDATE_DRAWING_STROKES':
        case 'UPDATE_FILE_METADATA':
          setBlocks((prev) => {
            const next = prev.map((b) =>
              b.id === action.blockId ? { ...b, metadata: action.before } : b
            );
            persistChanges(titleRef.current, colorTokenRef.current, next, isFavoriteRef.current, isPinnedRef.current);
            return next;
          });
          break;
      }
    } finally {
      actionHistory.setIsApplyingHistory(false);
    }
  };

  const handleRedo = () => {
    const action = actionHistory.redo();
    if (!action) return;

    actionHistory.setIsApplyingHistory(true);
    try {
      switch (action.type) {
        case 'SET_TITLE':
          setTitle(action.after);
          persistChanges(action.after, colorTokenRef.current, blocksRef.current, isFavoriteRef.current, isPinnedRef.current);
          break;
        case 'SET_COLOR':
          setColorToken(action.after);
          persistChanges(titleRef.current, action.after, blocksRef.current, isFavoriteRef.current, isPinnedRef.current);
          break;
        case 'TOGGLE_PIN':
          setIsPinned(action.after);
          persistChanges(titleRef.current, colorTokenRef.current, blocksRef.current, isFavoriteRef.current, action.after);
          break;
        case 'TOGGLE_FAVORITE':
          setIsFavorite(action.after);
          persistChanges(titleRef.current, colorTokenRef.current, blocksRef.current, action.after, isPinnedRef.current);
          break;
        case 'APPLY_TEMPLATE':
          if (action.after) {
            setTitle(action.after.title || '');
            titleRef.current = action.after.title || '';
            setColorToken(action.after.colorToken);
            colorTokenRef.current = action.after.colorToken;
            setBlocks(action.after.blocks);
            persistChanges(action.after.title || '', action.after.colorToken, action.after.blocks, isFavoriteRef.current, isPinnedRef.current);
          }
          break;
        case 'INSERT_BLOCK':
        case 'DELETE_BLOCK':
        case 'REORDER_BLOCKS':
        case 'CHANGE_BLOCK_TYPE':
        case 'UPDATE_CHECKLIST_STYLE':
          if (action.after?.blocks) {
            setBlocks(action.after.blocks);
            persistChanges(titleRef.current, colorTokenRef.current, action.after.blocks, isFavoriteRef.current, isPinnedRef.current);
          }
          break;
        case 'UPDATE_BLOCK_CONTENT':
          setBlocks((prev) => {
            const next = prev.map((b) =>
              b.id === action.blockId ? { ...b, content: action.after } : b
            );
            persistChanges(titleRef.current, colorTokenRef.current, next, isFavoriteRef.current, isPinnedRef.current);
            return next;
          });
          break;
        case 'UPDATE_IMAGE_METADATA':
        case 'UPDATE_AUDIO_METADATA':
        case 'UPDATE_DRAWING_STROKES':
        case 'UPDATE_FILE_METADATA':
          setBlocks((prev) => {
            const next = prev.map((b) =>
              b.id === action.blockId ? { ...b, metadata: action.after } : b
            );
            persistChanges(titleRef.current, colorTokenRef.current, next, isFavoriteRef.current, isPinnedRef.current);
            return next;
          });
          break;
      }
    } finally {
      actionHistory.setIsApplyingHistory(false);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    actionHistory.recordAction({
      tier: 1,
      type: 'SET_TITLE',
      description: 'Change Title',
      before: titleRef.current,
      after: newTitle,
      coalesceKey: 'note_title',
    });
    setTitle(newTitle);
    persistChanges(newTitle, colorTokenRef.current, blocksRef.current, isFavoriteRef.current, isPinnedRef.current);
  };

  const handleColorChange = (newColor: NoteColorToken) => {
    actionHistory.recordAction({
      tier: 1,
      type: 'SET_COLOR',
      description: `Change color to ${newColor}`,
      before: colorTokenRef.current,
      after: newColor,
    });
    setColorToken(newColor);
    persistChanges(titleRef.current, newColor, blocksRef.current, isFavoriteRef.current, isPinnedRef.current);
  };

  const handleTogglePin = () => {
    const nextPin = !isPinned;
    actionHistory.recordAction({
      tier: 1,
      type: 'TOGGLE_PIN',
      description: nextPin ? 'Pin Note' : 'Unpin Note',
      before: isPinnedRef.current,
      after: nextPin,
    });
    setIsPinned(nextPin);
    persistChanges(titleRef.current, colorTokenRef.current, blocksRef.current, isFavoriteRef.current, nextPin);
  };

  const handleToggleFavorite = () => {
    const nextFav = !isFavorite;
    actionHistory.recordAction({
      tier: 1,
      type: 'TOGGLE_FAVORITE',
      description: nextFav ? 'Favorite Note' : 'Unfavorite Note',
      before: isFavoriteRef.current,
      after: nextFav,
    });
    setIsFavorite(nextFav);
    persistChanges(titleRef.current, colorTokenRef.current, blocksRef.current, nextFav, isPinnedRef.current);
  };

  const handleReorderBlock = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    const currentBlocks = blocksRef.current;
    let nextBlocks: ComposableBlock[] = [];
    setBlocks((prevBlocks) => {
      nextBlocks = [...prevBlocks];
      const [moved] = nextBlocks.splice(fromIndex, 1);
      nextBlocks.splice(toIndex, 0, moved);
      return nextBlocks;
    });

    actionHistory.recordAction({
      tier: 2,
      type: 'REORDER_BLOCKS',
      description: 'Reorder Blocks',
      before: { blocks: currentBlocks },
      after: { blocks: nextBlocks },
    });

    if (nextBlocks.length > 0) {
      persistChanges(titleRef.current, colorTokenRef.current, nextBlocks);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    handleReorderBlock(index, index - 1);
  };

  const handleMoveDown = (index: number) => {
    if (index === blocksRef.current.length - 1) return;
    handleReorderBlock(index, index + 1);
  };

  const handleUpdateBlock = (blockId: string, updates: Partial<ComposableBlock>) => {
    let nextBlocks: ComposableBlock[] = [];
    setBlocks((prevBlocks) => {
      nextBlocks = prevBlocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b));
      return nextBlocks;
    });
    if (nextBlocks.length > 0) {
      persistChanges(titleRef.current, colorTokenRef.current, nextBlocks);
    }
  };

  const handleUpdateContent = (blockId: string, content: string) => {
    const prevBlock = blocksRef.current.find((b) => b.id === blockId);
    const prevContent = prevBlock?.content || '';

    actionHistory.recordAction({
      tier: 2,
      type: 'UPDATE_BLOCK_CONTENT',
      description: 'Edit Text',
      blockId,
      before: prevContent,
      after: content,
      coalesceKey: `content_${blockId}`,
    });

    let nextBlocks: ComposableBlock[] = [];
    setBlocks((prevBlocks) => {
      nextBlocks = prevBlocks.map((b) => (b.id === blockId ? { ...b, content } : b));
      return nextBlocks;
    });
    if (nextBlocks.length > 0) {
      persistChanges(titleRef.current, colorTokenRef.current, nextBlocks);
    }
  };

  const handleUpdateMetadata = (blockId: string, metadata: Record<string, any>) => {
    const prevBlock = blocksRef.current.find((b) => b.id === blockId);
    const prevMeta = prevBlock?.metadata || {};

    actionHistory.recordAction({
      tier: 3,
      type: 'UPDATE_IMAGE_METADATA',
      description: 'Update Block Metadata',
      blockId,
      before: prevMeta,
      after: metadata,
      coalesceKey: `meta_${blockId}`,
    });

    let nextBlocks: ComposableBlock[] = [];
    setBlocks((prevBlocks) => {
      nextBlocks = prevBlocks.map((b) =>
        b.id === blockId ? { ...b, metadata: { ...b.metadata, ...metadata } } : b
      );
      return nextBlocks;
    });
    if (nextBlocks.length > 0) {
      persistChanges(titleRef.current, colorTokenRef.current, nextBlocks);
    }
  };

  const handleChangeType = (blockId: string, type: BlockType) => {
    const currentBlocks = blocksRef.current;
    let nextBlocks: ComposableBlock[] = [];
    setBlocks((prevBlocks) => {
      nextBlocks = prevBlocks.map((b) => (b.id === blockId ? { ...b, type } : b));
      return nextBlocks;
    });
    actionHistory.recordAction({
      tier: 2,
      type: 'CHANGE_BLOCK_TYPE',
      description: `Change Type to ${type}`,
      blockId,
      before: { blocks: currentBlocks },
      after: { blocks: nextBlocks },
    });
    if (nextBlocks.length > 0) {
      persistChanges(titleRef.current, colorTokenRef.current, nextBlocks);
    }
  };

  const handleDeleteBlock = (blockId: string) => {
    const currentBlocks = blocksRef.current;
    if (currentBlocks.length <= 1) {
      const emptyBlock: ComposableBlock[] = [{ id: `b-${Date.now()}`, type: 'paragraph', content: '' }];
      actionHistory.recordAction({
        tier: 2,
        type: 'DELETE_BLOCK',
        description: 'Clear Block',
        blockId,
        before: { blocks: currentBlocks },
        after: { blocks: emptyBlock },
      });
      setBlocks(emptyBlock);
      setActiveBlockId(emptyBlock[0].id);
      persistChanges(titleRef.current, colorTokenRef.current, emptyBlock);
      return;
    }
    const nextBlocks = currentBlocks.filter((b) => b.id !== blockId);
    actionHistory.recordAction({
      tier: 2,
      type: 'DELETE_BLOCK',
      description: 'Delete Block',
      blockId,
      before: { blocks: currentBlocks },
      after: { blocks: nextBlocks },
    });
    setBlocks(nextBlocks);
    if (activeBlockId === blockId) {
      setActiveBlockId(null);
    }
    persistChanges(titleRef.current, colorTokenRef.current, nextBlocks);
  };

  const handleInsertBlock = (type: BlockType, metadata?: Record<string, any>, initialContent: string = '') => {
    const currentBlocks = blocksRef.current;
    const currentActiveId = activeBlockIdRef.current;
    const newBlock: ComposableBlock = {
      id: `b-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      content: initialContent,
      metadata,
    };

    const activeIndex = currentActiveId ? currentBlocks.findIndex((b) => b.id === currentActiveId) : -1;
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
    blocksRef.current = nextBlocks;
    activeBlockIdRef.current = newBlock.id;
    setBlocks(nextBlocks);
    setActiveBlockId(newBlock.id);
    persistChanges(titleRef.current, colorTokenRef.current, nextBlocks);
  };

  const handleConvertBlock = (
    blockId: string,
    type: BlockType,
    content: string = '',
    metadata?: Record<string, any>
  ) => {
    const currentBlocks = blocksRef.current;
    let nextBlocks: ComposableBlock[] = [];
    setBlocks((prevBlocks) => {
      nextBlocks = prevBlocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              type,
              content,
              metadata: metadata !== undefined ? metadata : b.metadata,
            }
          : b
      );
      return nextBlocks;
    });

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

    setBlocks(nextBlocks);
    const lastBlock = instantiatedBlocks[instantiatedBlocks.length - 1];
    setActiveBlockId(lastBlock.id);
    setFocusTarget({
      blockId: lastBlock.id,
      cursorPosition: lastBlock.content.length,
      timestamp: Date.now(),
    });
    persistChanges(titleRef.current, colorTokenRef.current, nextBlocks);
  };

  const handleApplyTemplate = (template: NoteTemplate) => {
    const currentBlocks = blocksRef.current;
    const newBlocks = instantiateTemplateBlocks(template);

    actionHistory.recordAction({
      tier: 1,
      type: 'APPLY_TEMPLATE',
      description: `Apply ${template.name}`,
      before: {
        title: titleRef.current,
        colorToken: colorTokenRef.current,
        blocks: currentBlocks,
      },
      after: {
        title: titleRef.current || template.name,
        colorToken: template.colorToken,
        blocks: newBlocks,
      },
    });

    if (!titleRef.current || titleRef.current === 'Untitled Note') {
      setTitle(template.name);
      titleRef.current = template.name;
    }
    setColorToken(template.colorToken);
    colorTokenRef.current = template.colorToken;
    setBlocks(newBlocks);
    if (newBlocks.length > 0) {
      const focusableBlock =
        newBlocks.find(
          (b) => b.type === 'heading' || b.type === 'paragraph' || b.type === 'quote'
        ) || newBlocks[0];

      setActiveBlockId(focusableBlock.id);
      setFocusTarget({
        blockId: focusableBlock.id,
        cursorPosition: 0,
        timestamp: Date.now(),
      });
    }
    persistChanges(
      titleRef.current || template.name,
      template.colorToken,
      newBlocks
    );
  };

  const handleInsertMultipleBlocks = (
    newBlocks: { type: BlockType; content?: string; metadata?: Record<string, any> }[],
    targetBlockId?: string | null
  ) => {
    const currentBlocks = blocksRef.current;
    if (newBlocks.length === 0) return;

    const instantiated: ComposableBlock[] = newBlocks.map((b, idx) => ({
      id: `b-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      type: b.type,
      content: b.content || '',
      metadata: b.metadata || {},
    }));

    let nextBlocks: ComposableBlock[];
    if (targetBlockId) {
      const targetIndex = currentBlocks.findIndex((b) => b.id === targetBlockId);
      if (targetIndex !== -1) {
        nextBlocks = [
          ...currentBlocks.slice(0, targetIndex + 1),
          ...instantiated,
          ...currentBlocks.slice(targetIndex + 1),
        ];
      } else {
        nextBlocks = [...currentBlocks, ...instantiated];
      }
    } else {
      nextBlocks = [...currentBlocks, ...instantiated];
    }

    actionHistory.recordAction({
      tier: 2,
      type: 'INSERT_BLOCK',
      description: `Insert ${instantiated.length} elements`,
      before: { blocks: currentBlocks },
      after: { blocks: nextBlocks },
    });

    blocksRef.current = nextBlocks;
    const lastInserted = instantiated[instantiated.length - 1];
    activeBlockIdRef.current = lastInserted.id;
    setBlocks(nextBlocks);
    setActiveBlockId(lastInserted.id);
    persistChanges(titleRef.current, colorTokenRef.current, nextBlocks);
  };

  const handleImportBlocks = (
    importedBlocks: ComposableBlock[],
    importedTitle?: string,
    importedColor?: NoteColorToken
  ) => {
    const currentBlocks = blocksRef.current;
    const currentTitle = titleRef.current;
    const nextTitle = importedTitle || currentTitle;
    const nextColor = importedColor || colorTokenRef.current;

    actionHistory.recordAction({
      tier: 1,
      type: 'APPLY_TEMPLATE',
      description: 'Import Document',
      before: {
        title: currentTitle,
        colorToken: colorTokenRef.current,
        blocks: currentBlocks,
      },
      after: {
        title: nextTitle,
        colorToken: nextColor,
        blocks: importedBlocks,
      },
    });

    if (importedTitle) {
      setTitle(importedTitle);
      titleRef.current = importedTitle;
    }
    if (importedColor) {
      setColorToken(importedColor);
      colorTokenRef.current = importedColor;
    }
    blocksRef.current = importedBlocks;
    if (importedBlocks.length > 0) {
      activeBlockIdRef.current = importedBlocks[0].id;
      setActiveBlockId(importedBlocks[0].id);
    }
    setBlocks(importedBlocks);
    persistChanges(nextTitle, nextColor, importedBlocks);
  };

  const handleSwitchActiveType = (type: BlockType, metadata?: Record<string, any>) => {
    if (!activeBlockId) {
      const defaultMeta =
        type === 'checklist' && !metadata?.items
          ? {
              items: [
                {
                  id: `task-${Date.now()}-1`,
                  text: '',
                  checked: false,
                  priority: 'none',
                  dueDate: 'Today',
                  style: 'paragraph',
                },
              ],
              ...metadata,
            }
          : metadata;
      handleInsertBlock(type, defaultMeta);
      return;
    }

    const currentBlock = blocksRef.current.find((b) => b.id === activeBlockId);
    if (!currentBlock) return;

    if (!isTextTransformableBlock(currentBlock.type)) {
      return;
    }

    const beforeBlocks = blocksRef.current;

    if (currentBlock.type === 'checklist') {
      let targetStyle: ChecklistPointStyle = 'paragraph';
      if (type === 'heading') {
        targetStyle = metadata?.level === 2 ? 'h2' : 'h1';
      } else if (type === 'quote') {
        targetStyle = 'quote';
      } else {
        targetStyle = 'paragraph';
      }

      const items: ChecklistPoint[] = Array.isArray(currentBlock.metadata?.items)
        ? [...currentBlock.metadata.items]
        : [
            {
              id: `task-${Date.now()}-1`,
              text: currentBlock.content || '',
              checked: false,
              priority: 'none',
              dueDate: 'Today',
              style: 'paragraph',
            },
          ];

      let updatedItems: ChecklistPoint[];
      if (activeChecklistPointId) {
        updatedItems = items.map((item) => {
          if (item.id === activeChecklistPointId) {
            const currentStyle = item.style || 'paragraph';
            const newStyle = currentStyle === targetStyle ? 'paragraph' : targetStyle;
            return { ...item, style: newStyle };
          }
          return item;
        });
      } else if (items.length > 0) {
        const firstStyle = items[0].style || 'paragraph';
        const newStyle = firstStyle === targetStyle ? 'paragraph' : targetStyle;
        updatedItems = items.map((item, idx) =>
          idx === 0 ? { ...item, style: newStyle } : item
        );
      } else {
        updatedItems = items;
      }

      const nextBlocks = blocksRef.current.map((b) =>
        b.id === activeBlockId
          ? {
              ...b,
              metadata: { ...b.metadata, items: updatedItems },
              content: updatedItems.map((i) => i.text).join('\n'),
            }
          : b
      );

      actionHistory.recordAction({
        tier: 2,
        type: 'UPDATE_CHECKLIST_STYLE',
        description: `Checklist point style: ${targetStyle}`,
        blockId: activeBlockId,
        before: { blocks: beforeBlocks },
        after: { blocks: nextBlocks },
      });

      setBlocks(nextBlocks);
      persistChanges(titleRef.current, colorTokenRef.current, nextBlocks);
      return;
    }

    const defaultMeta =
      type === 'checklist' && !metadata?.items
        ? {
            items: [
              {
                id: `task-${Date.now()}-1`,
                text: '',
                checked: false,
                priority: 'none',
                dueDate: 'Today',
                style: 'paragraph',
              },
            ],
            ...metadata,
          }
        : metadata;

    const nextBlocks = blocksRef.current.map((b) =>
      b.id === activeBlockId ? { ...b, type, metadata: { ...b.metadata, ...defaultMeta } } : b
    );

    actionHistory.recordAction({
      tier: 2,
      type: 'CHANGE_BLOCK_TYPE',
      description: `Change Type to ${type}`,
      blockId: activeBlockId,
      before: { blocks: beforeBlocks },
      after: { blocks: nextBlocks },
    });

    setBlocks(nextBlocks);
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

  const handleDeleteNote = async () => {
    if (!noteIdRef.current.startsWith('draft-')) {
      await notesRepo.softDeleteNote(noteIdRef.current);
    }
    onNoteDeleted(noteIdRef.current);
  };

  const currentActiveBlock = blocks.find((b) => b.id === activeBlockId);
  const isTextFormatApplicable = !currentActiveBlock || isTextTransformableBlock(currentActiveBlock.type);
  const currentActiveStyle: ChecklistPointStyle | null = (() => {
    if (!currentActiveBlock) return null;
    if (currentActiveBlock.type === 'checklist') {
      const items: ChecklistPoint[] = Array.isArray(currentActiveBlock.metadata?.items)
        ? currentActiveBlock.metadata.items
        : [];
      const activeItem = items.find((i) => i.id === activeChecklistPointId) || items[0];
      return activeItem?.style || 'paragraph';
    }
    if (currentActiveBlock.type === 'heading') {
      return currentActiveBlock.metadata?.level === 2 ? 'h2' : 'h1';
    }
    if (currentActiveBlock.type === 'quote') {
      return 'quote';
    }
    if (currentActiveBlock.type === 'paragraph') {
      return 'paragraph';
    }
    return null;
  })();

  return {
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
    handleConvertBlock,
    handleInsertAfterBlock,
    handleReplaceBlockWithBlocks,
    handleApplyTemplate,
    handleDeleteBlock,
    handleInsertBlock,
    handleInsertMultipleBlocks,
    handleImportBlocks,
    handleSwitchActiveType,
    handleSplitBlock,
    handleMergeWithPrevious,
    handleDeleteNote,
    setActiveBlockId,
    setActiveChecklistPointId,
  };
};

