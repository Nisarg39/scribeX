/**
 * ScribeX Core Types
 * Source of truth: docs/Universal_Note_Input_Structure_and_Relations.md
 */

import { NoteColorToken } from '../theme/tokens';
export type { NoteColorToken };

export type RelationType = 
  | 'relates_to'
  | 'supersedes'
  | 'derived_from'
  | 'part_of'
  | 'contradicts';

export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';
export type ChecklistPointStyle = 'paragraph' | 'h1' | 'h2' | 'quote';

export interface ChecklistPoint {
  id: string;
  text: string;
  checked: boolean;
  indent?: number; // 0 = root, 1 = nested sub-task, 2 = deep sub-task
  priority?: TaskPriority;
  dueDate?: string;
  style?: ChecklistPointStyle;
}

export interface TaskItem {
  id: string;
  userId: string;
  noteId?: string; // Origin note id if projected from a checklist block
  noteTitle?: string; // Origin note title for visual chip
  noteColorToken?: NoteColorToken;
  blockId?: string;
  title: string;
  isCompleted: boolean;
  priority: TaskPriority;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type BlockType = 
  | 'paragraph'
  | 'heading'
  | 'checklist'
  | 'habit'
  | 'kanban'
  | 'event'
  | 'contact'
  | 'expense'
  | 'reading'
  | 'lecture_note'
  | 'message_thread'
  | 'meeting_notes'
  | 'sheet'
  | 'diagram'
  | 'web_clip'
  | 'voice_dictation'
  | 'bulleted_list'
  | 'numbered_list'
  | 'toggle'
  | 'code'
  | 'quote'
  | 'divider'
  | 'callout'
  | 'table'
  | 'equation'
  | 'drawing'
  | 'bookmark'
  | 'audio'
  | 'image'
  | 'video'
  | 'file'
  | 'note_link'
  | 'location'
  | 'relation';

export interface ComposableBlock {
  id: string;
  type: BlockType;
  content: string; // Markdown / raw text / JSON serialized
  metadata?: Record<string, any>;
}

export interface NoteItem {
  id: string;
  userId: string;
  folderId?: string;
  folderPath?: string; // e.g. "Work/Projects/ScribeX"
  title: string;
  contentMarkdown: string;
  blocks: ComposableBlock[];
  colorToken: NoteColorToken;
  isFavorite: boolean;
  isPinned: boolean;
  status: 'active' | 'archived' | 'trashed';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
