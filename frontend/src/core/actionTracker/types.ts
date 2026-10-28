/**
 * ScribeX Action Tracker Types
 * Source of truth: docs/Universal_Note_Input_Structure_and_Relations.md
 */

import { ComposableBlock, BlockType, ChecklistPointStyle } from '../../types/note';
import { NoteColorToken } from '../../theme/tokens';

export type ActionTier = 1 | 2 | 3;

export type ActionType = 
  // Tier 1: Container / Note-Level
  | 'SET_TITLE'
  | 'SET_COLOR'
  | 'SET_FOLDER'
  | 'TOGGLE_PIN'
  | 'TOGGLE_FAVORITE'
  
  // Tier 2: Block Structural Mutations
  | 'INSERT_BLOCK'
  | 'DELETE_BLOCK'
  | 'REORDER_BLOCKS'
  | 'UPDATE_BLOCK_CONTENT'
  | 'CHANGE_BLOCK_TYPE'
  | 'UPDATE_CHECKLIST_STYLE'
  
  // Tier 3: Asset & Media Metadata
  | 'UPDATE_IMAGE_METADATA'
  | 'UPDATE_AUDIO_METADATA'
  | 'UPDATE_DRAWING_STROKES'
  | 'UPDATE_FILE_METADATA';

export interface NoteSnapshot {
  title: string;
  colorToken: NoteColorToken;
  blocks: ComposableBlock[];
  isFavorite?: boolean;
  isPinned?: boolean;
}

export interface EditorAction {
  id: string;
  tier: ActionTier;
  type: ActionType;
  timestamp: number;
  description: string;
  blockId?: string;
  before: any;
  after: any;
  coalesceKey?: string;
}

