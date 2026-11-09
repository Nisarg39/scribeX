/**
 * ScribeX Bidirectional Delta Sync Engine Types
 * Source of Truth: docs/Unified_Backend_and_AI_Master_Specification.md (Section 3 & Phase 2)
 */

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export type SyncEntityType = 
  | 'note'
  | 'task'
  | 'reminder'
  | 'folder'
  | 'tag'
  | 'asset'
  | 'relation';

export type SyncChangeType = 'insert' | 'update' | 'delete';

export interface SyncDelta<T = Record<string, any>> {
  id: string;
  userId: string;
  syncRev: number;
  entityType: SyncEntityType | string;
  entityId: string;
  changeType: SyncChangeType;
  deltaPayload: T;
  callerPlatform: string;
  createdAt: string;
}

export interface SyncStats {
  status: SyncStatus;
  lastSyncedAt: string | null;
  lastSyncedRev: number;
  lastPushedRev: number;
  pendingPushesCount: number;
  error: string | null;
}

export interface SyncEngineConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  userId: string;
  debounceMs?: number;
  autoSync?: boolean;
}

export type SyncEventListener = (delta: SyncDelta) => void;

