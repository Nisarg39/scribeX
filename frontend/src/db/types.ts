/**
 * Client Offline-First Database Types.
 * Platform: Cross-Platform (iOS, Android, Web)
 */

import { PastelColorKey } from '../theme/tokens';

export interface ClientNote {
  id: string;
  group_name: string;
  title: string;
  content_markdown: string;
  priority_score: number;
  color_token: PastelColorKey;
  is_favorite: boolean;
  sync_rev: number;
  pending_sync: boolean;
  created_at: string;
  updated_at: string;
}

export interface PendingMutation {
  id: string;
  entity_type: 'note';
  entity_id: string;
  mutation_type: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: Record<string, any>;
  created_at: string;
}

export interface SyncDelta {
  id: number;
  sync_rev: number;
  entity_type: string;
  entity_id: string;
  change_type: 'INSERT' | 'UPDATE' | 'DELETE';
  delta_payload: Record<string, any>;
  created_at: string;
}
