import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

interface UseEditorInteractionsProps {
  activeBlockIdRef: React.MutableRefObject<string | null>;
  draggingIndexRef: React.MutableRefObject<number | null>;
  onDeselectAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  getScrollElement?: () => HTMLElement | null;
}

export const useEditorInteractions = ({
  activeBlockIdRef,
  draggingIndexRef,
  onDeselectAll,
  onUndo,
  onRedo,
  getScrollElement,
}: UseEditorInteractionsProps) => {
  const onUndoRef = useRef(onUndo);
  onUndoRef.current = onUndo;
  const onRedoRef = useRef(onRedo);
  onRedoRef.current = onRedo;

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

      // 1. Don't deselect if user clicks on any input, textarea, or editable element
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest?.('input, textarea, [contenteditable="true"]')
      ) {
        return;
      }

      // 2. Don't deselect if user clicks on the vertical scrollbar
      const scrollEl = getScrollElement?.();
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
      if (
        target.closest?.('[data-scribex-modal]') ||
        target.closest?.('[role="dialog"]') ||
        target.closest?.('[aria-modal="true"]')
      ) {
        return;
      }

      // 6. If the user clicked inside another block, let that block's own click/focus handler run
      const otherBlockEl = target.closest?.('[data-scribex-block-id]');
      if (otherBlockEl) {
        return;
      }

      // Target was clicked anywhere else in the screen!
      onDeselectAll();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Cmd+Z (Mac) or Ctrl+Z (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        onUndoRef.current?.();
        return;
      }
      // Redo: Cmd+Shift+Z or Ctrl+Shift+Z or Ctrl+Y
      if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        onRedoRef.current?.();
        return;
      }

      if (e.key === 'Escape' && activeBlockIdRef.current) {
        onDeselectAll();
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
};

