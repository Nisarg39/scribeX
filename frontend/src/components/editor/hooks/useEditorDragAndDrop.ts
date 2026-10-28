import { useState, useRef, useEffect } from 'react';
import { Animated, Platform, Dimensions, ScrollView, Keyboard } from 'react-native';
import { ComposableBlock } from '../../../types/note';

export const getDefaultBlockHeight = (type?: string): number => {
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

export const calculateTargetIndex = (
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
      const prevHeight = prevBlock ? heights[prevBlock.id] || getDefaultBlockHeight(prevBlock.type) : 60;
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
      const nextHeight = nextBlock ? heights[nextBlock.id] || getDefaultBlockHeight(nextBlock.type) : 60;
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

export const calculateBlockShift = (
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

interface UseEditorDragAndDropProps {
  blocksRef: React.MutableRefObject<ComposableBlock[]>;
  onReorderBlock: (fromIndex: number, toIndex: number) => void;
  onBlockSelected?: (blockId: string) => void;
}

export const useEditorDragAndDrop = ({
  blocksRef,
  onReorderBlock,
  onBlockSelected,
}: UseEditorDragAndDropProps) => {
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
    const bottomY =
      scrollViewLayoutRef.current.height > 0
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
        const dist = bounds.top + BOUNDS_THRESHOLD - clientY;
        const progress = Math.min(Math.max(dist / BOUNDS_THRESHOLD, 0), 1.5);
        velocity = -Math.min(18, 4 + progress * 14);
      }
      // Scroll DOWN: Only if finger is near bottom boundary AND user has actively dragged downwards
      else if (clientY > bounds.bottom - BOUNDS_THRESHOLD && rawDyRef.current > 10) {
        const dist = clientY - (bounds.bottom - BOUNDS_THRESHOLD);
        const progress = Math.min(Math.max(dist / BOUNDS_THRESHOLD, 0), 1.5);
        velocity = Math.min(18, 4 + progress * 14);
      }

      if (velocity !== 0) {
        const newScrollY = Math.max(
          0,
          Math.min(
            currentScrollY.current + velocity,
            Math.max(0, scrollContentHeightRef.current - bounds.height)
          )
        );

        if (newScrollY !== currentScrollY.current) {
          currentScrollY.current = newScrollY;

          if (Platform.OS === 'web') {
            const el = getScrollElement();
            if (el) {
              el.scrollTop = newScrollY;
            }
          } else {
            scrollViewRef.current?.scrollTo({ y: newScrollY, animated: false });
          }

          const scrollDelta = currentScrollY.current - startScrollY.current;
          const totalDy = rawDyRef.current + scrollDelta;
          dragAnimY.setValue(totalDy);

          const newTarget = calculateTargetIndex(
            fromIndex,
            totalDy,
            currentBlocks,
            blockHeightsRef.current
          );
          if (newTarget !== dropTargetIndexRef.current) {
            dropTargetIndexRef.current = newTarget;
            setDropTargetIndex(newTarget);
          }
        }
      }

      if (draggingIndexRef.current !== null) {
        scrollAnimationRef.current = requestAnimationFrame(step);
      } else {
        stopAutoScrollLoop();
      }
    };

    scrollAnimationRef.current = requestAnimationFrame(step);
  };

  // Web Global Pointer Move/Up Listeners
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    if (draggingIndex === null) {
      stopAutoScrollLoop();
      return;
    }

    const handleGlobalPointerMove = (e: MouseEvent | PointerEvent) => {
      const clientY = e.clientY ?? (e as any).pageY ?? 0;
      currentPointerY.current = clientY;
    };

    const handleGlobalPointerUp = () => {
      if (draggingIndexRef.current !== null) {
        handleEndDrag();
      }
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

    const startY =
      initialClientY ??
      (typeof window !== 'undefined'
        ? (window as any).lastPointerY ?? window.innerHeight / 2
        : 250);
    currentPointerY.current = startY;

    const block = blocksRef.current[index];
    if (block) {
      onBlockSelected?.(block.id);
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

    // Direct GPU animation update (Zero React re-render)
    dragAnimY.setValue(totalDy);

    // Calculate if slot changed; ONLY re-render React if newTarget differs!
    const newTarget = calculateTargetIndex(
      fromIndex,
      totalDy,
      currentBlocks,
      blockHeightsRef.current
    );
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
      onReorderBlock(fromIndex, toIndex);
    }

    draggingIndexRef.current = null;
    dropTargetIndexRef.current = null;
    setDraggingIndex(null);
    setDropTargetIndex(null);
    rawDyRef.current = 0;
    dragAnimY.setValue(0);

    // Reset drag animation offset on the next animation frame after React commits the reordered list
    requestAnimationFrame(() => {
      dragAnimY.setValue(0);
    });
  };

  const resetDragState = () => {
    stopAutoScrollLoop();
    dragAnimY.stopAnimation();
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

  const calculateShift = (idx: number) => {
    return calculateBlockShift(
      idx,
      draggingIndex,
      dropTargetIndex,
      blocksRef.current,
      blockHeightsRef.current
    );
  };

  return {
    draggingIndex,
    dropTargetIndex,
    dragAnimY,
    draggingIndexRef,
    dropTargetIndexRef,
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
  };
};

