/**
 * ScribeX SQLite Database Types & DTOs
 * Source of truth: docs/Universal_Note_Input_Structure_and_Relations.md
 */

import { NoteColorToken } from '../theme/tokens';
import { ComposableBlock, RelationType, TaskPriority } from '../types/note';

// Database Row Types (Matching SQLite columns exactly)
export interface DBFolder {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  path: string;
  color_token: string;
  icon: string | null;
  sync_rev: number;
  created_at: string;
  updated_at: string;
}

export interface DBTag {
  id: string;
  user_id: string;
  name: string;
  color_token: string;
  created_at: string;
}

export interface DBNote {
  id: string;
  user_id: string;
  folder_id: string | null;
  folder_path: string | null;
  group_name: string | null;
  title: string;
  content_markdown: string;
  blocks_json: string; // JSON string of ComposableBlock[]
  color_token: NoteColorToken;
  is_favorite: number; // 0 or 1
  is_pinned: number; // 0 or 1
  status: 'active' | 'archived' | 'trashed';
  priority_score: number;
  sync_rev: number;
  created_at: string;
  updated_at: string;
  trashed_at: string | null;
}

export interface DBTask {
  id: string;
  user_id: string;
  note_id: string | null;
  note_title: string | null;
  note_color_token: string | null;
  block_id: string | null;
  title: string;
  is_completed: number; // 0 or 1
  priority: TaskPriority;
  due_date: string | null;
  sync_rev: number;
  created_at: string;
  updated_at: string;
}

export interface DBAsset {
  id: string;
  user_id: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256_hash: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  extracted_text: string | null;
  created_at: string;
}

export interface DBEntityRelation {
  id: string;
  user_id: string;
  source_id: string;
  relation_type: RelationType;
  target_id: string;
  created_by: 'user' | 'friday_ai';
  confidence_score: number;
  created_at: string;
}

export interface DBSyncChangelog {
  id: string;
  user_id: string;
  sync_rev: number;
  entity_type: string;
  entity_id: string;
  change_type: 'insert' | 'update' | 'delete';
  delta_payload: string;
  created_at: string;
}

// Data Transfer Objects (DTOs)
export interface CreateNoteDTO {
  id?: string;
  userId?: string;
  folderId?: string;
  folderPath?: string;
  groupName?: string;
  title: string;
  contentMarkdown?: string;
  blocks?: ComposableBlock[];
  colorToken?: NoteColorToken;
  isFavorite?: boolean;
  isPinned?: boolean;
  tags?: string[];
}

export interface UpdateNoteDTO {
  title?: string;
  contentMarkdown?: string;
  blocks?: ComposableBlock[];
  colorToken?: NoteColorToken;
  folderId?: string;
  folderPath?: string;
  isFavorite?: boolean;
  isPinned?: boolean;
  status?: 'active' | 'archived' | 'trashed';
  tags?: string[];
}

export interface CreateTaskDTO {
  id?: string;
  userId?: string;
  noteId?: string;
  noteTitle?: string;
  noteColorToken?: string;
  blockId?: string;
  title: string;
  isCompleted?: boolean;
  priority?: TaskPriority;
  dueDate?: string;
}

export interface CreateFolderDTO {
  id?: string;
  userId?: string;
  name: string;
  parentId?: string;
  path: string;
  colorToken?: string;
  icon?: string;
}

export interface CreateRelationDTO {
  id?: string;
  userId?: string;
  sourceId: string;
  relationType: RelationType;
  targetId: string;
  createdBy?: 'user' | 'friday_ai';
  confidenceScore?: number;
}
