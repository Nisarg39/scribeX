/**
 * React Hook for Real-Time Delta Sync.
 *
 * Exposes sync state machine values and manual pull-to-refresh triggers.
 */

import { useState, useEffect, useCallback } from 'react';
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

  const [state, setState] = useState<SyncEvent>({
    status: syncEngine.getStatus(),
    currentRev: 0,
    pendingCount: 0,
    lastSyncedAt: syncEngine.getLastSyncedAt(),
  });

  useEffect(() => {
    if (autoStart) {
      syncEngine.start();
    }

    const unsubscribe = syncEngine.subscribe((event: SyncEvent) => {
      setState(event);
      if (event.deltasApplied && event.deltasApplied > 0 && onDeltasApplied) {
        onDeltasApplied(event.deltasApplied);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [autoStart, onDeltasApplied]);

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
