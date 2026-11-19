/**
 * ScribeX Bidirectional Delta Sync Engine Types
 * Source of Truth: docs/Unified_Backend_and_AI_Master_Specification.md (Section 3 & Phase 2)
 */

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'offline_guest'
  | 'drive_required'
  | 'error';

export type SyncEntityType =
  | 'note'
  | 'task'
  | 'reminder'
  | 'folder'
  | 'tag'
  | 'asset'
  | 'relation'
  | 'workspace_security'
  | 'in_app_notification'
  | 'search_history';

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
  isGuest?: boolean;
  isDriveConnected?: boolean;
  debounceMs?: number;
  autoSync?: boolean;
}

export interface PaginatedNotesQuery {
  status?: 'active' | 'archived' | 'trashed' | null;
  folderId?: string | null;
  folderPath?: string | null;
  isFavorite?: boolean | null;
  searchQuery?: string | null;
  limit?: number;
  offset?: number;
}

export type SyncEventListener = (delta: SyncDelta) => void;
