/**
 * ScribeX Action History Manager
 * Dual-stack reversible command ledger with intelligent keystroke coalescing.
 */

import { EditorAction } from './types';

const MAX_STACK_SIZE = 50;
const COALESCE_WINDOW_MS = 750;

export class ActionHistoryManager {
  private undoStack: EditorAction[] = [];
  private redoStack: EditorAction[] = [];
  private listeners: Set<() => void> = new Set();
  private isApplyingHistory: boolean = false;

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.warn('ActionHistoryManager listener error:', err);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getIsApplyingHistory(): boolean {
    return this.isApplyingHistory;
  }

  public setIsApplyingHistory(applying: boolean) {
    this.isApplyingHistory = applying;
  }

  public recordAction(actionData: Omit<EditorAction, 'id' | 'timestamp'>) {
    // If currently applying an undo/redo operation, do not record it as a new action
    if (this.isApplyingHistory) return;

    const now = Date.now();
    const top = this.undoStack[this.undoStack.length - 1];

    // Coalesce rapid consecutive keystrokes on the same target within 750ms
    if (
      top &&
      actionData.coalesceKey &&
      top.coalesceKey === actionData.coalesceKey &&
      now - top.timestamp < COALESCE_WINDOW_MS
    ) {
      top.after = actionData.after;
      top.timestamp = now;
      this.notify();
      return;
    }

    const action: EditorAction = {
      ...actionData,
      id: `act-${now}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
    };

    this.undoStack.push(action);

    // Limit maximum history depth to 50 actions to preserve memory
    if (this.undoStack.length > MAX_STACK_SIZE) {
      this.undoStack.shift();
    }

    // New actions invalidate redo stack
    this.redoStack = [];
    this.notify();
  }

  public undo(): EditorAction | null {
    if (this.undoStack.length === 0) return null;

    const action = this.undoStack.pop()!;
    this.redoStack.push(action);
    this.notify();
    return action;
  }

  public redo(): EditorAction | null {
    if (this.redoStack.length === 0) return null;

    const action = this.redoStack.pop()!;
    this.undoStack.push(action);
    this.notify();
    return action;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public hasActions(): boolean {
    return this.undoStack.length > 0;
  }

  public getUndoCount(): number {
    return this.undoStack.length;
  }

  public getRedoCount(): number {
    return this.redoStack.length;
  }

  public clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}

