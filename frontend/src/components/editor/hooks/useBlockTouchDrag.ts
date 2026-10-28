import { useEffect, useRef, useMemo } from 'react';
import { Platform, PanResponder, Animated, Easing } from 'react-native';
import { BlockType } from '../../../types/note';

interface UseBlockTouchDragProps {
  blockType?: BlockType;
  isActive?: boolean;
  isDragging?: boolean;
  isAnyDragging?: boolean;
  dragOffsetY?: number;
  dragAnimY?: Animated.Value;
  shiftOffset?: number;
  onStartDrag?: (initialClientY?: number) => void;
  onDragMove?: (dy: number, clientY?: number) => void;
  onEndDrag?: () => void;
  onFocus?: () => void;
}

export const useBlockTouchDrag = ({
  blockType,
  isActive = false,
  isDragging = false,
  isAnyDragging = false,
  dragOffsetY = 0,
  dragAnimY,
  shiftOffset = 0,
  onStartDrag,
  onDragMove,
  onEndDrag,
  onFocus,
}: UseBlockTouchDragProps) => {
  const onStartDragRef = useRef(onStartDrag);
  onStartDragRef.current = onStartDrag;
  const onDragMoveRef = useRef(onDragMove);
  onDragMoveRef.current = onDragMove;
  const onEndDragRef = useRef(onEndDrag);
  onEndDragRef.current = onEndDrag;

  const isDraggingRef = useRef(isDragging);
  isDraggingRef.current = isDragging;

  const longPressTimerRef = useRef<any>(null);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const shiftAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    shiftAnim.stopAnimation();
    if (isDragging) {
      shiftAnim.setValue(0);
      return;
    }
    // When no drag is active across the editor (drop occurred), snap to 0 immediately
    // so there's zero transition lag after React commits the reordered blocks
    if (!isAnyDragging) {
      shiftAnim.setValue(0);
      return;
    }
    // While dragging is active, smoothly animate slot shifts in and out
    Animated.timing(shiftAnim, {
      toValue: shiftOffset,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [shiftOffset, isDragging, isAnyDragging]);

  const handleStartDragFromChild = (clientY?: number) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    isDraggingRef.current = true;
    if (clientY) {
      touchStartRef.current = { x: 0, y: clientY };
    }
    onStartDragRef.current?.(clientY);
  };

  const handleTouchStart = (e: any) => {
    if (Platform.OS === 'web') return;

    // If this is an active text block currently being edited, don't hijack text selection
    const isEditingTextBlock =
      isActive &&
      (blockType === 'paragraph' || blockType === 'heading' || blockType === 'quote');
    if (isEditingTextBlock) return;

    const pageX = e.nativeEvent?.pageX || 0;
    const pageY = e.nativeEvent?.pageY || 0;
    touchStartRef.current = { x: pageX, y: pageY };

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      handleStartDragFromChild(pageY);
    }, 260);
  };

  const handleTouchMove = (e: any) => {
    if (Platform.OS === 'web') return;

    if (isDraggingRef.current) {
      const pageY = e.nativeEvent?.pageY || 0;
      const dy = pageY - touchStartRef.current.y;
      onDragMoveRef.current?.(dy, pageY);
      return;
    }

    if (longPressTimerRef.current) {
      const pageX = e.nativeEvent?.pageX || 0;
      const pageY = e.nativeEvent?.pageY || 0;
      const dx = pageX - touchStartRef.current.x;
      const dy = pageY - touchStartRef.current.y;

      if (Math.hypot(dx, dy) > 8) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (Platform.OS === 'web') return;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      onEndDragRef.current?.();
    }
    touchStartRef.current = { x: 0, y: 0 };
  };

  const handleTouchCancel = () => {
    if (Platform.OS === 'web') return;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      onEndDragRef.current?.();
    }
    touchStartRef.current = { x: 0, y: 0 };
  };

  const nativePanResponder = useMemo(() => {
    if (Platform.OS === 'web') return null;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      // Capture all moves if this block is currently being dragged
      onMoveShouldSetPanResponder: () => isDraggingRef.current,
      onMoveShouldSetPanResponderCapture: () => isDraggingRef.current,

      // Prevent ScrollView from stealing touch while dragging
      onPanResponderTerminationRequest: () => !isDraggingRef.current,

      onPanResponderGrant: (evt) => {
        const pageY = evt?.nativeEvent?.pageY || 0;
        if (!touchStartRef.current.y && pageY) {
          touchStartRef.current = { x: evt?.nativeEvent?.pageX || 0, y: pageY };
        }
      },

      onPanResponderMove: (evt, gestureState) => {
        if (isDraggingRef.current) {
          const clientY = evt?.nativeEvent?.pageY ?? (gestureState.moveY || 0);
          const dy = touchStartRef.current.y ? clientY - touchStartRef.current.y : gestureState.dy;
          onDragMoveRef.current?.(dy, clientY);
        }
      },

      onPanResponderRelease: () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          onEndDragRef.current?.();
        }
        touchStartRef.current = { x: 0, y: 0 };
      },

      onPanResponderTerminate: () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          onEndDragRef.current?.();
        }
        touchStartRef.current = { x: 0, y: 0 };
      },
    });
  }, []);

  const activeCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (activeCleanupRef.current) {
        activeCleanupRef.current();
        activeCleanupRef.current = null;
      }
    };
  }, []);

  // Direct element long-press drag handler for Web
  const handleBlockPointerDown = (e: any) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Only handle primary button (left mouse click)
    if (e.button !== undefined && e.button !== 0) return;

    // Do NOT drag if clicking directly on a text input or textarea
    const targetTag = e.target?.tagName?.toUpperCase?.() || '';
    if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || e.target?.isContentEditable) {
      return;
    }

    const startX = e.clientX ?? e.nativeEvent?.clientX ?? 0;
    const startY = e.clientY ?? e.nativeEvent?.clientY ?? 0;

    let isDragActive = false;
    let longPressTimer: any = null;

    if (activeCleanupRef.current) {
      activeCleanupRef.current();
      activeCleanupRef.current = null;
    }

    // Start 240ms timer for long press
    longPressTimer = setTimeout(() => {
      isDragActive = true;
      onStartDragRef.current?.(startY);
    }, 240);

    const onPointerMove = (moveEvt: MouseEvent | PointerEvent) => {
      const currentX = moveEvt.clientX ?? (moveEvt as any).pageX ?? 0;
      const currentY = moveEvt.clientY ?? (moveEvt as any).pageY ?? 0;
      const dx = currentX - startX;
      const dy = currentY - startY;

      if (!isDragActive) {
        if (Math.hypot(dx, dy) > 6) {
          clearTimeout(longPressTimer);
        }
      } else {
        moveEvt.preventDefault();
        onDragMoveRef.current?.(dy, currentY);
      }
    };

    const cleanup = () => {
      clearTimeout(longPressTimer);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      activeCleanupRef.current = null;
    };

    const onPointerUp = (upEvt: MouseEvent | PointerEvent) => {
      cleanup();
      if (isDragActive) {
        upEvt.preventDefault();
        onEndDragRef.current?.();
      } else {
        onFocus?.();
      }
    };

    activeCleanupRef.current = cleanup;

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('mousemove', onPointerMove, { passive: false });
    window.addEventListener('mouseup', onPointerUp, { passive: false });
  };

  const dragContainerStyle = useMemo(() => {
    if (isDragging) {
      return {
        transform: [{ translateY: dragAnimY || dragOffsetY || 0 }],
        zIndex: 999,
        elevation: 8,
        opacity: 0.96,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      };
    }
    return {
      transform: [{ translateY: shiftAnim }],
      zIndex: 1,
    };
  }, [isDragging, dragAnimY, dragOffsetY]);

  const touchHandlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  };

  const gestureHandlers =
    Platform.OS === 'web'
      ? ({
          onPointerDown: handleBlockPointerDown,
          onMouseDown: handleBlockPointerDown,
        } as any)
      : (nativePanResponder?.panHandlers || {});

  return {
    dragContainerStyle,
    touchHandlers,
    gestureHandlers,
    handleStartDragFromChild,
  };
};

