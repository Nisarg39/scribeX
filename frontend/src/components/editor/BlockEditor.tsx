import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal, Platform, Animated, Keyboard, Easing, Dimensions } from 'react-native';
import { NoteItem, ComposableBlock, BlockType, ChecklistPoint, ChecklistPointStyle } from '../../types/note';
import { useTheme, NoteColors, NoteColorToken } from '../../theme';
import { BlockRenderer } from './BlockRenderer';
import { notesRepo } from '../../db/notesRepo';
import { tasksRepo } from '../../db/tasksRepo';
import { useNotesStore } from '../../state/useNotesStore';
import { serializeBlocksToMarkdown, coalesceChecklistBlocks } from '../../core/astSerializer';
import { 
  ArrowLeft, 
  ArrowDown,
  Star, 
  Trash2, 
  Plus, 
  Check, 
  Folder,
  Pin,
  Heading,
  ListTodo,
  Code2,
  Quote as QuoteIcon,
  Minus,
  Table,
  AlertCircle,
  Sigma,
  PenTool,
  Volume2,
  Image as ImageIcon,
  Paperclip,
  Globe,
  ChevronUp,
  ChevronDown,
  X,
  Type
} from 'lucide-react-native';

interface BlockEditorProps {
  note: NoteItem;
  onClose: () => void;
  onNoteUpdated: (updated: NoteItem) => void;
  onNoteDeleted: (noteId: string) => void;
}

const PASTEL_PALETTE: NoteColorToken[] = [
  'lime',
  'apricot',
  'cyan',
  'coral',
  'lavender',
  'pink',
  'sky',
];

const COLOR_BG_CLASSES: Partial<Record<NoteColorToken, string>> = {
  lime: 'bg-note-lime',
  apricot: 'bg-note-apricot',
  cyan: 'bg-note-cyan',
  coral: 'bg-note-coral',
  lavender: 'bg-note-lavender',
  pink: 'bg-note-pink',
  sky: 'bg-note-sky',
};

const isTextTransformableBlock = (type?: BlockType): boolean => {
  return type === 'paragraph' || type === 'heading' || type === 'quote' || type === 'checklist';
};

const getDefaultBlockHeight = (type?: string): number => {
  switch (type) {
    case 'image':
      return 280;
    case 'bookmark':
      return 140;
    case 'code':
      return 150;
    case 'table':
      return 130;
    case 'checklist':
      return 70;
    case 'audio':
      return 90;
    case 'file':
      return 90;
    case 'callout':
      return 90;
    case 'equation':
      return 90;
    case 'drawing':
      return 260;
    case 'heading':
      return 50;
    case 'quote':
      return 55;
    case 'paragraph':
    default:
      return 45;
  }
};

const calculateTargetIndex = (
  fromIndex: number,
  dy: number,
  blocks: ComposableBlock[],
  heights: { [blockId: string]: number }
): number => {
  if (dy === 0 || fromIndex < 0 || fromIndex >= blocks.length) return fromIndex;

  if (dy < 0) {
    let currentY = dy;
    let target = fromIndex;
    for (let i = fromIndex - 1; i >= 0; i--) {
      const prevBlock = blocks[i];
      const prevHeight = (prevBlock ? heights[prevBlock.id] || getDefaultBlockHeight(prevBlock.type) : 60);
      if (currentY < -prevHeight / 2) {
        target = i;
        currentY += prevHeight;
      } else {
        break;
      }
    }
    return Math.max(0, target);
  } else {
    let currentY = dy;
    let target = fromIndex;
    for (let i = fromIndex + 1; i < blocks.length; i++) {
      const nextBlock = blocks[i];
      const nextHeight = (nextBlock ? heights[nextBlock.id] || getDefaultBlockHeight(nextBlock.type) : 60);
      if (currentY > nextHeight / 2) {
        target = i;
        currentY -= nextHeight;
      } else {
        break;
      }
    }
    return Math.min(blocks.length - 1, target);
  }
};

const calculateBlockShift = (
  idx: number,
  draggingIdx: number | null,
  targetIdx: number | null,
  blocks: ComposableBlock[],
  heights: { [blockId: string]: number }
): number => {
  if (draggingIdx === null || targetIdx === null || draggingIdx === targetIdx) {
    return 0;
  }
  if (idx === draggingIdx) {
    return 0;
  }

  const draggedBlock = blocks[draggingIdx];
  if (!draggedBlock) return 0;
  const draggedHeight = (heights[draggedBlock.id] || getDefaultBlockHeight(draggedBlock.type)) + 4;

  if (targetIdx > draggingIdx) {
    // Dragging downwards: blocks between draggingIdx + 1 and targetIdx slide upwards
    if (idx > draggingIdx && idx <= targetIdx) {
      return -draggedHeight;
    }
  } else if (targetIdx < draggingIdx) {
    // Dragging upwards: blocks between targetIdx and draggingIdx - 1 slide downwards
    if (idx >= targetIdx && idx < draggingIdx) {
      return draggedHeight;
    }
  }

  return 0;
};

export const BlockEditor: React.FC<BlockEditorProps> = ({
  note,
  onClose,
  onNoteUpdated,
  onNoteDeleted,
}) => {
  const { isDark } = useTheme();
  const { refreshFromDB } = useNotesStore();

  const [title, setTitle] = useState(note.title);
  const [colorToken, setColorToken] = useState<NoteColorToken>(note.colorToken);
  const [isFavorite, setIsFavorite] = useState(note.isFavorite);
  const [isPinned, setIsPinned] = useState(note.isPinned);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeChecklistPointId, setActiveChecklistPointId] = useState<string | null>(null);
  const activeBlockIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeBlockIdRef.current = activeBlockId;
  }, [activeBlockId]);
  const [isInsertPaletteOpen, setIsInsertPaletteOpen] = useState(false);

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
          if (focusTarget.cursorPosition !== undefined && typeof (input as any)?.setSelectionRange === 'function') {
            (input as any).setSelectionRange(focusTarget.cursorPosition, focusTarget.cursorPosition);
          }
        }
      }
    }
  }, [focusTarget]);

  // Drag-and-Drop Reorder & Autoscroll State
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const dragAnimY = useRef(new Animated.Value(0)).current;
  const draggingIndexRef = useRef<number | null>(null);
  const dropTargetIndexRef = useRef<number | null>(null);
  const blockHeightsRef = useRef<{ [blockId: string]: number }>({});
  const scrollViewRef = useRef<ScrollView>(null);

  const currentScrollY = useRef(0);
  const startScrollY = useRef(0);
  const currentPointerY = useRef(0);
  const rawDyRef = useRef(0);
  const scrollViewLayoutRef = useRef<{ y: number; height: number }>({ y: 0, height: 600 });
  const scrollContentHeightRef = useRef<number>(0);
  const scrollAnimationRef = useRef<number | null>(null);
  const autoScrollActiveRef = useRef(false);

  const [blocks, setBlocks] = useState<ComposableBlock[]>(() => {
    const rawBlocks: ComposableBlock[] = note.blocks && note.blocks.length > 0
      ? note.blocks
      : [{ id: `b-${Date.now()}-1`, type: 'paragraph', content: note.contentMarkdown || '' }];
    return coalesceChecklistBlocks(rawBlocks);
  });

  const blocksRef = useRef<ComposableBlock[]>(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const getScrollElement = (): HTMLElement | null => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      return null;
    }
    const byId = document.getElementById('scribex-editor-scrollview');
    if (byId instanceof HTMLElement) return byId;

    const ref = scrollViewRef.current as any;
    if (ref?.getScrollableNode) {
      const el = ref.getScrollableNode();
      if (el instanceof HTMLElement) return el;
    }
    if (ref instanceof HTMLElement) return ref;
    return null;
  };

  const getViewportBounds = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const el = getScrollElement();
      if (el && typeof el.getBoundingClientRect === 'function') {
        const rect = el.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
        };
      }
      return {
        top: 110,
        bottom: window.innerHeight - 20,
        height: window.innerHeight - 130,
      };
    }

    const windowHeight = Dimensions.get('window').height;
    const topY = scrollViewLayoutRef.current.y > 0 ? scrollViewLayoutRef.current.y : 110;
    const bottomY = scrollViewLayoutRef.current.height > 0
      ? topY + scrollViewLayoutRef.current.height
      : windowHeight;

    return {
      top: topY,
      bottom: Math.min(bottomY, windowHeight),
      height: bottomY - topY,
    };
  };

  const stopAutoScrollLoop = () => {
    autoScrollActiveRef.current = false;
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
  };

  const startAutoScrollLoop = () => {
    if (autoScrollActiveRef.current) return;
    autoScrollActiveRef.current = true;

    const step = () => {
      const fromIndex = draggingIndexRef.current;
      if (fromIndex === null) {
        stopAutoScrollLoop();
        return;
      }

      const currentBlocks = blocksRef.current;
      const bounds = getViewportBounds();
      const clientY = currentPointerY.current;
      // Tight, intentional 50px boundary zone so autoscroll only triggers at the true edge
      const BOUNDS_THRESHOLD = 50;

      let velocity = 0;
      // Scroll UP: Only if finger is near top boundary AND user has actively dragged upwards
      if (clientY < bounds.top + BOUNDS_THRESHOLD && rawDyRef.current < -10) {
        const dist = (bounds.top + BOUNDS_THRESHOLD) - clientY;
        const progress = Math.min(Math.max(dist / BOUNDS_THRESHOLD, 0), 1.5);
        velocity = -Math.round(2 + progress * 10);
      } 
      // Scroll DOWN: Only if finger is near bottom boundary AND user has actively dragged downwards
      else if (clientY > bounds.bottom - BOUNDS_THRESHOLD && rawDyRef.current > 10) {
        const dist = clientY - (bounds.bottom - BOUNDS_THRESHOLD);
        const progress = Math.min(Math.max(dist / BOUNDS_THRESHOLD, 0), 1.5);
        velocity = Math.round(2 + progress * 10);
      }

      // Autoscroll Boundary Limits: halt autoscroll ONLY when the container is physically at its top/bottom scroll edge
      if (Platform.OS === 'web') {
        const el = getScrollElement();
        if (el) {
          const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
          if (velocity < 0 && el.scrollTop <= 0) {
            velocity = 0;
          } else if (velocity > 0 && maxScroll > 0 && el.scrollTop >= maxScroll) {
            velocity = 0;
          }
        }
      } else {
        // Native mobile: stop at true scroll bounds
        const maxScroll = Math.max(0, scrollContentHeightRef.current - scrollViewLayoutRef.current.height);
        if (velocity < 0 && currentScrollY.current <= 0) {
          velocity = 0;
        } else if (velocity > 0 && maxScroll > 0 && currentScrollY.current >= maxScroll) {
          velocity = 0;
        }
      }

      if (velocity !== 0) {
        if (Platform.OS === 'web') {
          const el = getScrollElement();
          if (el) {
            el.scrollTop += velocity;
            currentScrollY.current = el.scrollTop;
          } else {
            currentScrollY.current = Math.max(0, currentScrollY.current + velocity);
            scrollViewRef.current?.scrollTo({ y: currentScrollY.current, animated: false });
          }
        } else {
          // Native Android & iOS: clamp to maximum valid content scroll bounds
          const maxScroll = Math.max(0, scrollContentHeightRef.current - scrollViewLayoutRef.current.height);
          const nextScrollY = maxScroll > 0
            ? Math.min(maxScroll, Math.max(0, currentScrollY.current + velocity))
            : Math.max(0, currentScrollY.current + velocity);
          currentScrollY.current = nextScrollY;
          scrollViewRef.current?.scrollTo({ y: nextScrollY, animated: false });
        }

        // Keep dragged block and target index synced with the continuous scroll
        const scrollDelta = currentScrollY.current - startScrollY.current;
        const totalDy = rawDyRef.current + scrollDelta;
        dragAnimY.setValue(totalDy);

        const newTarget = calculateTargetIndex(fromIndex, totalDy, currentBlocks, blockHeightsRef.current);
        if (newTarget !== dropTargetIndexRef.current) {
          dropTargetIndexRef.current = newTarget;
          setDropTargetIndex(newTarget);
        }
      }

      scrollAnimationRef.current = requestAnimationFrame(step);
    };

    scrollAnimationRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    return () => {
      stopAutoScrollLoop();
    };
  }, []);

  // Global window pointer tracking on Web while dragging to prevent boundary dead-zones
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || draggingIndex === null) return;

    const handleGlobalPointerMove = (e: MouseEvent | PointerEvent) => {
      currentPointerY.current = e.clientY;
    };

    const handleGlobalPointerUp = () => {
      handleEndDrag();
    };

    window.addEventListener('pointermove', handleGlobalPointerMove, { passive: true });
    window.addEventListener('mousemove', handleGlobalPointerMove, { passive: true });
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('mouseup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('mousemove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('mouseup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [draggingIndex]);

  const handleReportHeight = (blockId: string, height: number) => {
    if (blockId && height > 0) {
      blockHeightsRef.current[blockId] = height;
    }
  };

  const handleStartDrag = (index: number, initialClientY?: number) => {
    if (Platform.OS !== 'web') {
      Keyboard.dismiss();
    }
    draggingIndexRef.current = index;
    dropTargetIndexRef.current = index;
    setDraggingIndex(index);
    setDropTargetIndex(index);
    dragAnimY.setValue(0);
    rawDyRef.current = 0;

    if (Platform.OS === 'web') {
      const el = getScrollElement();
      if (el) {
        currentScrollY.current = el.scrollTop;
      }
    }
    startScrollY.current = currentScrollY.current;

    const startY = initialClientY ?? (typeof window !== 'undefined' ? (window as any).lastPointerY ?? (window.innerHeight / 2) : 250);
    currentPointerY.current = startY;

    if (blocks[index]) {
      setActiveBlockId(blocks[index].id);
    }

    startAutoScrollLoop();
  };

  const handleDragMove = (dy: number, clientY?: number) => {
    const fromIndex = draggingIndexRef.current;
    if (fromIndex === null) return;

    rawDyRef.current = dy;
    if (clientY !== undefined) {
      currentPointerY.current = clientY;
    }

    const currentBlocks = blocksRef.current;
    const scrollDelta = currentScrollY.current - startScrollY.current;
    const totalDy = dy + scrollDelta;

    // Direct GPU animation update (Zero React re-render!)
    dragAnimY.setValue(totalDy);

    // Calculate if slot changed; ONLY re-render React if newTarget differs!
    const newTarget = calculateTargetIndex(fromIndex, totalDy, currentBlocks, blockHeightsRef.current);
    if (newTarget !== dropTargetIndexRef.current) {
      dropTargetIndexRef.current = newTarget;
      setDropTargetIndex(newTarget);
    }

    startAutoScrollLoop();
  };

  const handleEndDrag = () => {
    stopAutoScrollLoop();
    const fromIndex = draggingIndexRef.current;
    const toIndex = dropTargetIndexRef.current;

    if (fromIndex !== null && toIndex !== null && fromIndex !== toIndex) {
      handleReorderBlock(fromIndex, toIndex);
    }

    draggingIndexRef.current = null;
    dropTargetIndexRef.current = null;
    setDraggingIndex(null);
    setDropTargetIndex(null);
    rawDyRef.current = 0;
    dragAnimY.setValue(0);

    // Reset drag animation offset on the next animation frame after React commits the reordered list
    // This completely eliminates native driver race-conditions and glitch jumps on mobile!
    requestAnimationFrame(() => {
      dragAnimY.setValue(0);
    });
  };

  const handleDeselectAll = () => {
    stopAutoScrollLoop();
    dragAnimY.stopAnimation();

    setActiveBlockId(null);
    setActiveChecklistPointId(null);
    setDraggingIndex(null);
    setDropTargetIndex(null);
    draggingIndexRef.current = null;
    dropTargetIndexRef.current = null;
    rawDyRef.current = 0;
    dragAnimY.setValue(0);

    requestAnimationFrame(() => {
      dragAnimY.setValue(0);
    });
  };

  // Clear element selection when clicking anywhere else on the screen (outside active block & toolbar)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const handleGlobalPointerDown = (e: MouseEvent | PointerEvent) => {
      // If no block is currently selected, nothing to deselect
      if (!activeBlockIdRef.current) return;

      // Only handle primary button (left mouse click or touch)
      if (e.button !== undefined && e.button !== 0) return;

      // If user is currently dragging to reorder, do not deselect
      if (draggingIndexRef.current !== null) return;

      const rawTarget = e.target as HTMLElement | null;
      if (!rawTarget) return;
      const target = (rawTarget.nodeType === 3 ? rawTarget.parentElement : rawTarget) as HTMLElement | null;
      if (!target) return;

      // 1. Don't deselect if user clicks on any input, textarea, or editable element (e.g. note title input)
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable || 
        target.closest?.('input, textarea, [contenteditable="true"]')
      ) {
        return;
      }

      // 2. Don't deselect if user clicks on the vertical scrollbar
      const scrollEl = getScrollElement();
      if (scrollEl) {
        const rect = scrollEl.getBoundingClientRect();
        if (e.clientX >= rect.left + scrollEl.clientWidth && e.clientX <= rect.right) {
          return;
        }
      }
      if (e.clientX >= document.documentElement.clientWidth) {
        return;
      }

      // 3. Check if the click is inside the currently selected active block
      const currentActiveId = activeBlockIdRef.current;
      const activeBlockEl = document.getElementById(`scribex-block-${currentActiveId}`);
      if (activeBlockEl && activeBlockEl.contains(target)) {
        return;
      }
      if (target.closest?.(`[data-scribex-block-id="${currentActiveId}"]`)) {
        return;
      }

      // 4. Check if the click is inside the toolbar / command bar / action headers
      if (target.closest?.('[data-scribex-toolbar]')) {
        return;
      }

      // 5. Check if the click is inside an active modal dialog (like Insert Palette)
      if (target.closest?.('[data-scribex-modal]') || target.closest?.('[role="dialog"]') || target.closest?.('[aria-modal="true"]')) {
        return;
      }

      // 6. If the user clicked inside another block, let that block's own click/focus handler run
      const otherBlockEl = target.closest?.('[data-scribex-block-id]');
      if (otherBlockEl) {
        return;
      }

      // Target was clicked anywhere else in the screen!
      handleDeselectAll();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeBlockIdRef.current) {
        handleDeselectAll();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };

    window.addEventListener('pointerdown', handleGlobalPointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handleGlobalPointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleReorderBlock = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    let nextBlocks: ComposableBlock[] = [];
    setBlocks((prevBlocks) => {
      nextBlocks = [...prevBlocks];
      const [moved] = nextBlocks.splice(fromIndex, 1);
      nextBlocks.splice(toIndex, 0, moved);
      return nextBlocks;
    });
    if (nextBlocks.length > 0) {
      persistChanges(title, colorToken, nextBlocks);
    }
  };

  // Save changes to SQLite / Repository
  const persistChanges = async (
    newTitle: string = title,
    newColor: NoteColorToken = colorToken,
    newBlocks: ComposableBlock[] = blocks,
    newFav: boolean = isFavorite,
    newPin: boolean = isPinned
  ) => {
    try {
      const contentMarkdown = serializeBlocksToMarkdown(newBlocks);
      const updated = await notesRepo.updateNote(note.id, {
        title: newTitle.trim() || 'Untitled Note',
        colorToken: newColor,
        blocks: newBlocks,
        contentMarkdown,
        isFavorite: newFav,
        isPinned: newPin,
      });
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

      tasksRepo.syncNoteChecklists(note.id, newTitle, newColor, checklistItems)
        .catch((err) => console.warn('Failed to sync note checklists to tasksRepo:', err));
    } catch (err) {
      console.warn('Failed to persist note changes in BlockEditor:', err);
    }
  };

  // Block Mutation Helpers
  const handleUpdateBlock = (blockId: string, updates: Partial<ComposableBlock>) => {
    let nextBlocks: ComposableBlock[] = [];
    setBlocks((prevBlocks) => {
      nextBlocks = prevBlocks.map((b) =>
        b.id === blockId ? { ...b, ...updates } : b
      );
      return nextBlocks;
    });
    if (nextBlocks.length > 0) {
      persistChanges(title, colorToken, nextBlocks);
    }
  };

  const handleUpdateContent = (blockId: string, content: string) => {
    let nextBlocks: ComposableBlock[] = [];
    setBlocks((prevBlocks) => {
      nextBlocks = prevBlocks.map((b) => (b.id === blockId ? { ...b, content } : b));
      return nextBlocks;
    });
    if (nextBlocks.length > 0) {
      persistChanges(title, colorToken, nextBlocks);
    }
  };

  const handleUpdateMetadata = (blockId: string, metadata: Record<string, any>) => {
    let nextBlocks: ComposableBlock[] = [];
    setBlocks((prevBlocks) => {
      nextBlocks = prevBlocks.map((b) =>
        b.id === blockId ? { ...b, metadata: { ...b.metadata, ...metadata } } : b
      );
      return nextBlocks;
    });
    if (nextBlocks.length > 0) {
      persistChanges(title, colorToken, nextBlocks);
    }
  };

  const handleChangeType = (blockId: string, type: BlockType) => {
    let nextBlocks: ComposableBlock[] = [];
    setBlocks((prevBlocks) => {
      nextBlocks = prevBlocks.map((b) => (b.id === blockId ? { ...b, type } : b));
      return nextBlocks;
    });
    if (nextBlocks.length > 0) {
      persistChanges(title, colorToken, nextBlocks);
    }
  };

  const handleDeleteBlock = (blockId: string) => {
    if (blocks.length <= 1) {
      // Keep at least one empty block
      const emptyBlock: ComposableBlock[] = [{ id: `b-${Date.now()}`, type: 'paragraph', content: '' }];
      setBlocks(emptyBlock);
      setActiveBlockId(emptyBlock[0].id);
      persistChanges(title, colorToken, emptyBlock);
      return;
    }
    const nextBlocks = blocks.filter((b) => b.id !== blockId);
    setBlocks(nextBlocks);
    if (activeBlockId === blockId) {
      setActiveBlockId(null);
    }
    persistChanges(title, colorToken, nextBlocks);
  };

  // Inserts a new block immediately below the active block (or at the bottom if none)
  const handleInsertBlock = (type: BlockType, metadata?: Record<string, any>) => {
    const newBlock: ComposableBlock = {
      id: `b-${Date.now()}-${blocks.length + 1}`,
      type,
      content: '',
      metadata,
    };

    const activeIndex = activeBlockId ? blocks.findIndex((b) => b.id === activeBlockId) : -1;
    let nextBlocks: ComposableBlock[];
    if (activeIndex !== -1) {
      nextBlocks = [
        ...blocks.slice(0, activeIndex + 1),
        newBlock,
        ...blocks.slice(activeIndex + 1),
      ];
    } else {
      nextBlocks = [...blocks, newBlock];
    }

    setBlocks(nextBlocks);
    setActiveBlockId(newBlock.id);
    setIsInsertPaletteOpen(false);
    persistChanges(title, colorToken, nextBlocks);
  };

  // Convert current active block to new type or apply text style to active checklist point
  const handleSwitchActiveType = (type: BlockType, metadata?: Record<string, any>) => {
    if (!activeBlockId) {
      const defaultMeta = type === 'checklist' && !metadata?.items
        ? { items: [{ id: `task-${Date.now()}-1`, text: '', checked: false, priority: 'none', dueDate: 'Today', style: 'paragraph' }], ...metadata }
        : metadata;
      handleInsertBlock(type, defaultMeta);
      return;
    }

    const currentBlock = blocks.find((b) => b.id === activeBlockId);
    if (!currentBlock) return;

    // Strict Guard: Never transform or replace non-text elements (image, audio, file, bookmark, table, code, equation, drawing, divider, etc.)
    if (!isTextTransformableBlock(currentBlock.type)) {
      return;
    }

    // If currently inside a checklist block, apply the text style (paragraph, h1, h2, quote)
    // to the active checkpoint input rather than removing the checklist element!
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
        : [{ id: `task-${Date.now()}-1`, text: currentBlock.content || '', checked: false, priority: 'none', dueDate: 'Today', style: 'paragraph' }];

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

      const nextBlocks = blocks.map((b) =>
        b.id === activeBlockId
          ? {
              ...b,
              metadata: { ...b.metadata, items: updatedItems },
              content: updatedItems.map((i) => i.text).join('\n'),
            }
          : b
      );

      setBlocks(nextBlocks);
      persistChanges(title, colorToken, nextBlocks);
      return;
    }

    const defaultMeta = type === 'checklist' && !metadata?.items
      ? { items: [{ id: `task-${Date.now()}-1`, text: '', checked: false, priority: 'none', dueDate: 'Today', style: 'paragraph' }], ...metadata }
      : metadata;

    const nextBlocks = blocks.map((b) =>
      b.id === activeBlockId
        ? { ...b, type, metadata: { ...b.metadata, ...defaultMeta } }
        : b
    );
    setBlocks(nextBlocks);
    persistChanges(title, colorToken, nextBlocks);
  };

  // Focus Handoff: Enter splits the block at cursor position into a new block below
  const handleSplitBlock = (index: number, splitPosition: number = 0) => {
    const currentBlock = blocks[index];
    if (!currentBlock) return;

    const fullContent = currentBlock.content || '';
    const beforeText = fullContent.slice(0, splitPosition);
    const afterText = fullContent.slice(splitPosition);

    const newBlockId = `b-${Date.now()}-${blocks.length + 1}`;
    const newBlock: ComposableBlock = {
      id: newBlockId,
      type: 'paragraph',
      content: afterText,
    };

    const nextBlocks = [
      ...blocks.slice(0, index),
      { ...currentBlock, content: beforeText },
      newBlock,
      ...blocks.slice(index + 1),
    ];

    setBlocks(nextBlocks);
    setActiveBlockId(newBlockId);
    persistChanges(title, colorToken, nextBlocks);

    // Hand off focus to newly created block at cursor 0
    setFocusTarget({
      blockId: newBlockId,
      cursorPosition: 0,
      timestamp: Date.now(),
    });
  };

  // Focus Handoff: Backspace at start merges current block into previous block
  const handleMergeWithPrevious = (index: number) => {
    if (index === 0) {
      // If at start of the very first block, hand off focus to Note Title
      setFocusTarget({
        blockId: 'note-title',
        cursorPosition: title.length,
        timestamp: Date.now(),
      });
      return;
    }

    const currentBlock = blocks[index];
    const prevBlock = blocks[index - 1];
    if (!currentBlock || !prevBlock) return;

    const isTextCompatible = (type: BlockType) =>
      type === 'paragraph' || type === 'heading' || type === 'quote';

    // 1. Text into Text: Merge contents seamlessly
    if (isTextCompatible(currentBlock.type) && isTextCompatible(prevBlock.type)) {
      const prevContent = prevBlock.content || '';
      const currentContent = currentBlock.content || '';
      const junctionPosition = prevContent.length;
      const mergedContent = prevContent + currentContent;

      const updatedPrevBlock = { ...prevBlock, content: mergedContent };
      const nextBlocks = [
        ...blocks.slice(0, index - 1),
        updatedPrevBlock,
        ...blocks.slice(index + 1),
      ];

      setBlocks(nextBlocks);
      setActiveBlockId(prevBlock.id);
      persistChanges(title, colorToken, nextBlocks);

      // Hand off focus to the junction point in previous block
      setFocusTarget({
        blockId: prevBlock.id,
        cursorPosition: junctionPosition,
        timestamp: Date.now(),
      });
      return;
    }

    // 2. Empty block: Delete it and return focus to previous block
    if (!currentBlock.content || currentBlock.content.trim() === '') {
      const nextBlocks = blocks.filter((_, i) => i !== index);
      setBlocks(nextBlocks);
      setActiveBlockId(prevBlock.id);
      persistChanges(title, colorToken, nextBlocks);

      const targetPos = prevBlock.content ? prevBlock.content.length : 0;
      setFocusTarget({
        blockId: prevBlock.id,
        cursorPosition: targetPos,
        timestamp: Date.now(),
      });
      return;
    }

    // 3. Fallback: Simply hand off focus to previous block
    setActiveBlockId(prevBlock.id);
    setFocusTarget({
      blockId: prevBlock.id,
      cursorPosition: prevBlock.content ? prevBlock.content.length : 0,
      timestamp: Date.now(),
    });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const nextBlocks = [...blocks];
    const temp = nextBlocks[index - 1];
    nextBlocks[index - 1] = nextBlocks[index];
    nextBlocks[index] = temp;
    setBlocks(nextBlocks);
    persistChanges(title, colorToken, nextBlocks);
  };

  const handleMoveDown = (index: number) => {
    if (index === blocks.length - 1) return;
    const nextBlocks = [...blocks];
    const temp = nextBlocks[index + 1];
    nextBlocks[index + 1] = nextBlocks[index];
    nextBlocks[index] = temp;
    setBlocks(nextBlocks);
    persistChanges(title, colorToken, nextBlocks);
  };

  const handleToggleFavorite = () => {
    const next = !isFavorite;
    setIsFavorite(next);
    persistChanges(title, colorToken, blocks, next, isPinned);
  };

  const handleTogglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    persistChanges(title, colorToken, blocks, isFavorite, next);
  };

  const handleColorChange = (color: NoteColorToken) => {
    setColorToken(color);
    persistChanges(title, color, blocks, isFavorite, isPinned);
  };

  const handleDeleteNote = async () => {
    await notesRepo.softDeleteNote(note.id);
    onNoteDeleted(note.id);
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

  return (
    <View className="flex-1 w-full bg-light-surface dark:bg-dark-surface relative">
      {/* Top Editorial Header Bar */}
      <View 
        nativeID="scribex-editor-header"
        dataSet={{ scribexToolbar: 'true' }}
        {...({ 'data-scribex-toolbar': 'true' } as any)}
        className="flex-row items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border z-10 bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-md"
      >
        {/* Back Button */}
        <Pressable
          onPress={onClose}
          accessibilityLabel="Back to notes"
          className="w-10 h-10 rounded-full bg-light-appBg dark:bg-dark-raised items-center justify-center shadow-sm"
          style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
        >
          <ArrowLeft size={18} color={isDark ? '#F7F7F7' : '#171717'} strokeWidth={2.2} />
        </Pressable>

        {/* Pastel Color Swatches */}
        <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/5 shrink-0">
          {PASTEL_PALETTE.map((color) => {
            const isSelected = colorToken === color;
            return (
              <Pressable
                key={color}
                onPress={() => handleColorChange(color)}
                accessibilityLabel={`Color ${color}`}
                style={({ pressed }) => [
                  { backgroundColor: NoteColors[color] },
                  pressed ? { transform: [{ scale: 0.9 }] } : undefined,
                ]}
                className={`w-6 h-6 rounded-full items-center justify-center shrink-0 ${COLOR_BG_CLASSES[color] || ''} ${
                  isSelected ? 'border-2 border-black dark:border-white scale-110' : ''
                }`}
              >
                {isSelected && <Check size={12} color="#191919" strokeWidth={3} />}
              </Pressable>
            );
          })}
        </View>

        {/* Right Action Icons: Pin, Favorite, Delete, Done */}
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={handleTogglePin}
            accessibilityLabel="Toggle Pin"
            className="w-9 h-9 rounded-full items-center justify-center hover:bg-black/5 dark:hover:bg-white/5"
            style={({ pressed }) => pressed ? { transform: [{ scale: 0.9 }] } : undefined}
          >
            <Pin 
              size={17} 
              color={isPinned ? '#FFC96F' : (isDark ? '#B5B5B5' : '#626262')} 
              fill={isPinned ? '#FFC96F' : 'transparent'} 
            />
          </Pressable>

          <Pressable
            onPress={handleToggleFavorite}
            accessibilityLabel="Toggle Favorite"
            className="w-9 h-9 rounded-full items-center justify-center hover:bg-black/5 dark:hover:bg-white/5"
            style={({ pressed }) => pressed ? { transform: [{ scale: 0.9 }] } : undefined}
          >
            <Star 
              size={18} 
              color={isFavorite ? '#FFD43B' : (isDark ? '#B5B5B5' : '#626262')} 
              fill={isFavorite ? '#FFD43B' : 'transparent'} 
            />
          </Pressable>

          <Pressable
            onPress={handleDeleteNote}
            accessibilityLabel="Delete Note"
            className="w-9 h-9 rounded-full items-center justify-center hover:bg-red-500/10"
            style={({ pressed }) => pressed ? { transform: [{ scale: 0.9 }] } : undefined}
          >
            <Trash2 size={17} color="#EF4444" />
          </Pressable>

          <Pressable
            onPress={onClose}
            accessibilityLabel="Done"
            className="px-4 py-1.5 rounded-full bg-light-iconBg dark:bg-white items-center justify-center ml-1 shadow-sm"
            style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
          >
            <Text className="text-xs font-bold text-white dark:text-[#111111]">
              Done
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Top Sticky Editorial Command Bar (Zero collision with bottom navigation) */}
      <View 
        nativeID="scribex-editor-command-bar"
        dataSet={{ scribexToolbar: 'true' }}
        {...({ 'data-scribex-toolbar': 'true' } as any)}
        className="flex-row items-center justify-between px-6 py-2.5 border-b border-light-border/70 dark:border-white/10 bg-light-appBg/95 dark:bg-[#18181A]/95 backdrop-blur-md z-20"
      >
        {/* Left: Primary Insert Element */}
        <Pressable
          onPress={() => setIsInsertPaletteOpen(!isInsertPaletteOpen)}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-light-iconBg dark:bg-white shadow-sm"
          style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
        >
          <Plus size={13} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2.5} />
          <Text className="text-xs font-bold text-white dark:text-[#111111]">
            Insert
          </Text>
        </Pressable>

        {/* Center: Style Switchers */}
        <View className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-light-surface dark:bg-dark-raised border border-light-border/70 dark:border-white/5 ${
          isTextFormatApplicable ? 'opacity-100' : 'opacity-40'
        }`}>
          <Pressable
            disabled={!isTextFormatApplicable}
            onPress={() => handleSwitchActiveType('paragraph')}
            className={`px-2.5 py-1 rounded-full ${
              currentActiveStyle === 'paragraph'
                ? 'bg-light-appBg dark:bg-white/15'
                : isTextFormatApplicable ? 'hover:bg-black/5 dark:hover:bg-white/10' : ''
            }`}
            style={({ pressed }) => pressed && isTextFormatApplicable ? { transform: [{ scale: 0.95 }] } : undefined}
            accessibilityLabel={isTextFormatApplicable ? "Normal Text" : "Text styling not applicable"}
          >
            <Text className={`text-xs ${
              currentActiveStyle === 'paragraph'
                ? 'font-bold text-light-textPrimary dark:text-white'
                : 'font-semibold text-light-textSecondary dark:text-dark-textSecondary'
            }`}>
              Text
            </Text>
          </Pressable>

          <Pressable
            disabled={!isTextFormatApplicable}
            onPress={() => handleSwitchActiveType('heading', { level: 1 })}
            className={`px-2.5 py-1 rounded-full ${
              currentActiveStyle === 'h1'
                ? 'bg-light-appBg dark:bg-white/15'
                : isTextFormatApplicable ? 'hover:bg-black/5 dark:hover:bg-white/10' : ''
            }`}
            style={({ pressed }) => pressed && isTextFormatApplicable ? { transform: [{ scale: 0.95 }] } : undefined}
            accessibilityLabel={isTextFormatApplicable ? "Heading 1" : "Text styling not applicable"}
          >
            <Text className={`text-xs ${
              currentActiveStyle === 'h1'
                ? 'font-black text-light-textPrimary dark:text-white'
                : 'font-black text-light-textPrimary dark:text-dark-textPrimary opacity-70'
            }`}>
              H1
            </Text>
          </Pressable>

          <Pressable
            disabled={!isTextFormatApplicable}
            onPress={() => handleSwitchActiveType('heading', { level: 2 })}
            className={`px-2.5 py-1 rounded-full ${
              currentActiveStyle === 'h2'
                ? 'bg-light-appBg dark:bg-white/15'
                : isTextFormatApplicable ? 'hover:bg-black/5 dark:hover:bg-white/10' : ''
            }`}
            style={({ pressed }) => pressed && isTextFormatApplicable ? { transform: [{ scale: 0.95 }] } : undefined}
            accessibilityLabel={isTextFormatApplicable ? "Heading 2" : "Text styling not applicable"}
          >
            <Text className={`text-xs ${
              currentActiveStyle === 'h2'
                ? 'font-bold text-light-textPrimary dark:text-white'
                : 'font-bold text-light-textPrimary dark:text-dark-textPrimary opacity-70'
            }`}>
              H2
            </Text>
          </Pressable>

          <Pressable
            disabled={!isTextFormatApplicable}
            onPress={() => handleSwitchActiveType('quote')}
            className={`p-1 rounded-full ${
              currentActiveStyle === 'quote'
                ? 'bg-light-appBg dark:bg-white/15'
                : isTextFormatApplicable ? 'hover:bg-black/5 dark:hover:bg-white/10' : ''
            }`}
            style={({ pressed }) => pressed && isTextFormatApplicable ? { transform: [{ scale: 0.95 }] } : undefined}
            accessibilityLabel={isTextFormatApplicable ? "Quote" : "Text styling not applicable"}
          >
            <QuoteIcon size={13} color={currentActiveStyle === 'quote' ? (isDark ? '#F7F7F7' : '#171717') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>
        </View>

        {/* Right: Quick Task, Media, and Block Reorder/Delete */}
        <View className="flex-row items-center gap-1.5">
          {/* Quick Task Button */}
          <Pressable
            onPress={() => handleInsertBlock('checklist', {
              items: [{ id: `task-${Date.now()}-1`, text: '', checked: false, priority: 'none', dueDate: 'Today' }]
            })}
            className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-light-surface dark:bg-dark-raised border border-light-border/70 dark:border-white/5"
            style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
            accessibilityLabel="Add Task Checklist"
          >
            <ListTodo size={12} color={isDark ? '#6EE7B7' : '#059669'} />
            <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
              Task
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleInsertBlock('image', { url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80', caption: '', width: '100%', align: 'center', aspectRatio: 'natural' })}
            className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-light-surface dark:bg-dark-raised border border-light-border/70 dark:border-white/5"
            style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
            accessibilityLabel="Add Image"
          >
            <ImageIcon size={12} color={isDark ? '#38BDF8' : '#0284C7'} />
            <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
              Media
            </Text>
          </Pressable>

          {activeBlockId && (
            <>
              <View className="w-[1px] h-4 bg-black/10 dark:bg-white/15 mx-0.5" />
              <Pressable
                onPress={() => {
                  const idx = blocks.findIndex((b) => b.id === activeBlockId);
                  if (idx > 0) handleMoveUp(idx);
                }}
                className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                style={({ pressed }) => pressed ? { transform: [{ scale: 0.9 }] } : undefined}
                accessibilityLabel="Move Up"
              >
                <ChevronUp size={13} color={isDark ? '#B5B5B5' : '#626262'} />
              </Pressable>
              <Pressable
                onPress={() => {
                  const idx = blocks.findIndex((b) => b.id === activeBlockId);
                  if (idx < blocks.length - 1) handleMoveDown(idx);
                }}
                className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                style={({ pressed }) => pressed ? { transform: [{ scale: 0.9 }] } : undefined}
                accessibilityLabel="Move Down"
              >
                <ChevronDown size={13} color={isDark ? '#B5B5B5' : '#626262'} />
              </Pressable>
              <Pressable
                onPress={() => handleDeleteBlock(activeBlockId)}
                className="p-1 rounded-full hover:bg-red-500/20"
                style={({ pressed }) => pressed ? { transform: [{ scale: 0.9 }] } : undefined}
                accessibilityLabel="Delete Block"
              >
                <Trash2 size={13} color="#EF4444" />
              </Pressable>
            </>
          )}
        </View>
      </View>

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
        <Pressable 
          onPress={handleDeselectAll}
          className="flex-row items-center gap-2 mb-4 self-start"
        >
          <View 
            style={{ backgroundColor: NoteColors[colorToken] }}
            className="flex-row items-center gap-1.5 px-3 py-1 rounded-full shadow-sm"
          >
            <Folder size={11} color="#191919" />
            <Text className="text-xs font-bold text-[#191919]">
              {note.folderPath || 'General'}
            </Text>
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
          onChangeText={(newTitle) => {
            setTitle(newTitle);
            persistChanges(newTitle, colorToken, blocks);
          }}
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

        {/* Continuous Stream of Editorial Blocks (No Outer Card Wrappers) */}
        <View className="mb-4">
          {blocks.map((block, idx) => {
            const isDragging = draggingIndex === idx;
            const shiftOffset = calculateBlockShift(idx, draggingIndex, dropTargetIndex, blocks, blockHeightsRef.current);

            return (
              <React.Fragment key={block.id}>
                <BlockRenderer
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
                    setDraggingIndex(null);
                    setDropTargetIndex(null);
                    draggingIndexRef.current = null;
                    dropTargetIndexRef.current = null;
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
              </React.Fragment>
            );
          })}
        </View>

        {/* Canvas tap area below blocks */}
        <Pressable
          onPress={handleDeselectAll}
          className="w-full h-8"
          accessibilityLabel="Click canvas to deselect"
        />
      </ScrollView>

      {/* Modern Insert Palette Modal (Distraction-Free) */}
      {isInsertPaletteOpen && (
        <Modal
          visible={isInsertPaletteOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsInsertPaletteOpen(false)}
        >
          <Pressable
            onPress={() => setIsInsertPaletteOpen(false)}
            className="flex-1 bg-black/60 backdrop-blur-sm justify-end md:justify-center items-center p-4"
          >
            <Pressable
              dataSet={{ scribexModal: 'true' }}
              {...({ 'data-scribex-modal': 'true' } as any)}
              onPress={(e) => e.stopPropagation()}
              className="w-full max-w-xl rounded-3xl bg-light-surface dark:bg-[#1E1E20] border border-light-border dark:border-white/10 shadow-2xl p-6 overflow-hidden"
            >
              {/* Header */}
              <View className="flex-row items-center justify-between pb-4 border-b border-light-border dark:border-white/10 mb-4">
                <View>
                  <Text className="text-lg font-extrabold text-light-textPrimary dark:text-dark-textPrimary">
                    Insert Element
                  </Text>
                  <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                    {activeBlockId ? 'Insert immediately after current selection' : 'Insert at the end of the story'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsInsertPaletteOpen(false)}
                  style={({ pressed }) => pressed ? { transform: [{ scale: 0.9 }] } : undefined}
                  className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 items-center justify-center"
                >
                  <X size={16} color={isDark ? '#FFFFFF' : '#111111'} />
                </Pressable>
              </View>

              <ScrollView className="max-h-[460px]" showsVerticalScrollIndicator={false}>
                {/* Category: Media & Rich Embeds */}
                <Text className="text-[11px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2 px-1">
                  Media & Rich Embeds
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-5">
                  <Pressable
                    onPress={() => handleInsertBlock('image', { url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80', caption: '', width: '100%', align: 'center', aspectRatio: 'natural' })}
                    style={({ pressed }) => pressed ? { transform: [{ scale: 0.97 }] } : undefined}
                    className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
                  >
                    <View className="w-8 h-8 rounded-xl bg-sky-500/15 items-center justify-center mb-2">
                      <ImageIcon size={16} color="#0EA5E9" />
                    </View>
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Image</Text>
                    <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Resizable (33%, 50%, 75%, 100%)</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleInsertBlock('audio', { durationSec: 94 })}
                    style={({ pressed }) => pressed ? { transform: [{ scale: 0.97 }] } : undefined}
                    className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
                  >
                    <View className="w-8 h-8 rounded-xl bg-purple-500/15 items-center justify-center mb-2">
                      <Volume2 size={16} color="#A855F7" />
                    </View>
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Voice Note</Text>
                    <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Waveform & transcript</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleInsertBlock('file', { fileName: 'Specification.pdf', sizeBytes: 1845600 })}
                    style={({ pressed }) => pressed ? { transform: [{ scale: 0.97 }] } : undefined}
                    className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
                  >
                    <View className="w-8 h-8 rounded-xl bg-amber-500/15 items-center justify-center mb-2">
                      <Paperclip size={16} color="#F59E0B" />
                    </View>
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Attachment</Text>
                    <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">PDF or file document</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleInsertBlock('bookmark', { url: 'https://reactnative.dev' })}
                    style={({ pressed }) => pressed ? { transform: [{ scale: 0.97 }] } : undefined}
                    className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
                  >
                    <View className="w-8 h-8 rounded-xl bg-indigo-500/15 items-center justify-center mb-2">
                      <Globe size={16} color="#6366F1" />
                    </View>
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Web Link</Text>
                    <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Rich bookmark card</Text>
                  </Pressable>
                </View>

                {/* Category: Writing & Structure */}
                <Text className="text-[11px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2 px-1">
                  Writing & Structure
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-5">
                  <Pressable
                    onPress={() => handleInsertBlock('paragraph')}
                    style={({ pressed }) => pressed ? { transform: [{ scale: 0.97 }] } : undefined}
                    className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
                  >
                    <Type size={16} color={isDark ? '#E5E5E5' : '#171717'} className="mb-2" />
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Paragraph</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleInsertBlock('heading', { level: 1 })}
                    style={({ pressed }) => pressed ? { transform: [{ scale: 0.97 }] } : undefined}
                    className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
                  >
                    <Heading size={16} color={isDark ? '#E5E5E5' : '#171717'} className="mb-2" />
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Heading 1</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleInsertBlock('heading', { level: 2 })}
                    style={({ pressed }) => pressed ? { transform: [{ scale: 0.97 }] } : undefined}
                    className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
                  >
                    <Heading size={14} color={isDark ? '#E5E5E5' : '#171717'} className="mb-2" />
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Heading 2</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleInsertBlock('quote')}
                    style={({ pressed }) => pressed ? { transform: [{ scale: 0.97 }] } : undefined}
                    className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
                  >
                    <QuoteIcon size={16} color="#A78BFA" className="mb-2" />
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Quote</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleInsertBlock('divider')}
                    style={({ pressed }) => pressed ? { transform: [{ scale: 0.97 }] } : undefined}
                    className="flex-1 min-w-[110px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
                  >
                    <Minus size={16} color={isDark ? '#9CA3AF' : '#6B7280'} className="mb-2" />
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Divider</Text>
                  </Pressable>
                </View>

                {/* Category: Productivity & Technical */}
                <Text className="text-[11px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2 px-1">
                  Productivity & Technical
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-2">
                  <Pressable
                    onPress={() => handleInsertBlock('checklist', {
                      items: [{ id: `task-${Date.now()}-1`, text: '', checked: false, priority: 'none', dueDate: 'Today' }]
                    })}
                    style={({ pressed }) => pressed ? { transform: [{ scale: 0.97 }] } : undefined}
                    className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
                  >
                    <View className="w-8 h-8 rounded-xl bg-emerald-500/15 items-center justify-center mb-2">
                      <ListTodo size={16} color="#10B981" />
                    </View>
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Checklist Task</Text>
                    <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Syncs with global Tasks</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleInsertBlock('code', { language: 'typescript' })}
                    style={({ pressed }) => pressed ? { transform: [{ scale: 0.97 }] } : undefined}
                    className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
                  >
                    <View className="w-8 h-8 rounded-xl bg-cyan-500/15 items-center justify-center mb-2">
                      <Code2 size={16} color="#06B6D4" />
                    </View>
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Code Block</Text>
                    <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Syntax highlighted</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleInsertBlock('table', { columns: ['Header 1', 'Header 2'], rows: [['', '']] })}
                    style={({ pressed }) => pressed ? { transform: [{ scale: 0.97 }] } : undefined}
                    className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
                  >
                    <View className="w-8 h-8 rounded-xl bg-blue-500/15 items-center justify-center mb-2">
                      <Table size={16} color="#3B82F6" />
                    </View>
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Data Table</Text>
                    <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Matrix grid editor</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleInsertBlock('callout', { variant: 'info' })}
                    style={({ pressed }) => pressed ? { transform: [{ scale: 0.97 }] } : undefined}
                    className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
                  >
                    <View className="w-8 h-8 rounded-xl bg-rose-500/15 items-center justify-center mb-2">
                      <AlertCircle size={16} color="#F43F5E" />
                    </View>
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Callout</Text>
                    <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Highlighted note box</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleInsertBlock('equation', { displayMode: true })}
                    style={({ pressed }) => pressed ? { transform: [{ scale: 0.97 }] } : undefined}
                    className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
                  >
                    <View className="w-8 h-8 rounded-xl bg-orange-500/15 items-center justify-center mb-2">
                      <Sigma size={16} color="#F97316" />
                    </View>
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">LaTeX Formula</Text>
                    <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Math equation</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleInsertBlock('drawing', { paths: [] })}
                    style={({ pressed }) => pressed ? { transform: [{ scale: 0.97 }] } : undefined}
                    className="flex-1 min-w-[150px] p-3 rounded-2xl bg-light-appBg dark:bg-[#252528] border border-light-border dark:border-white/5"
                  >
                    <View className="w-8 h-8 rounded-xl bg-teal-500/15 items-center justify-center mb-2">
                      <PenTool size={16} color="#14B8A6" />
                    </View>
                    <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">Canvas Sketch</Text>
                    <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">Hand-drawn sketch</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
};
