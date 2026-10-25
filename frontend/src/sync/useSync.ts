/**
 * React Hook for Real-Time Delta Sync.
 *
 * Exposes sync state machine values and manual pull-to-refresh triggers.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { syncEngine, SyncStatus, SyncEvent } from './syncEngine';

interface UseSyncOptions {
  onDeltasApplied?: (count: number) => void;
  autoStart?: boolean;
}

export interface UseSyncReturn {
  status: SyncStatus;
  isSyncing: boolean;
  isOnline: boolean;
  pendingCount: number;
  currentRev: number;
  lastSyncedAt: Date | null;
  syncNow: () => Promise<void>;
}

export function useSync(options: UseSyncOptions = {}): UseSyncReturn {
  const { onDeltasApplied, autoStart = true } = options;

  // Keep a stable ref to callback so inline function references never re-trigger the subscription effect
  const onDeltasAppliedRef = useRef(onDeltasApplied);
  useEffect(() => {
    onDeltasAppliedRef.current = onDeltasApplied;
  }, [onDeltasApplied]);

  const [state, setState] = useState<SyncEvent>(() => ({
    status: syncEngine.getStatus(),
    currentRev: syncEngine.getCurrentRev(),
    pendingCount: syncEngine.getPendingCount(),
    lastSyncedAt: syncEngine.getLastSyncedAt(),
  }));

  useEffect(() => {
    if (autoStart) {
      syncEngine.start();
    }

    const unsubscribe = syncEngine.subscribe((event: SyncEvent) => {
      // Guard against redundant state updates to prevent re-render cascades
      setState((prev) => {
        if (
          prev.status === event.status &&
          prev.currentRev === event.currentRev &&
          prev.pendingCount === event.pendingCount &&
          prev.lastSyncedAt?.getTime() === event.lastSyncedAt?.getTime() &&
          prev.errorMessage === event.errorMessage &&
          prev.deltasApplied === event.deltasApplied
        ) {
          return prev;
        }
        return event;
      });

      if (event.deltasApplied && event.deltasApplied > 0 && onDeltasAppliedRef.current) {
        onDeltasAppliedRef.current(event.deltasApplied);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [autoStart]);

  const syncNow = useCallback(async () => {
    await syncEngine.syncNow();
  }, []);

  return {
    status: state.status,
    isSyncing: state.status === 'syncing',
    isOnline: state.status === 'synced' || state.status === 'syncing',
    pendingCount: state.pendingCount,
    currentRev: state.currentRev,
    lastSyncedAt: state.lastSyncedAt,
    syncNow,
  };
}
