import { NoteColorToken } from '../theme/tokens';
import { NoteItem, TaskItem } from '../types/note';
import { WELCOME_STARTER_NOTE, WELCOME_STARTER_TASKS } from './starterNote';

export { WELCOME_STARTER_NOTE, WELCOME_STARTER_TASKS };

export const PASTEL_PALETTE: NoteColorToken[] = [
  'lime',
  'apricot',
  'cyan',
  'coral',
  'lavender',
  'pink',
  'sky',
];

export const INITIAL_NOTES: NoteItem[] = [WELCOME_STARTER_NOTE];
export const INITIAL_TASKS: TaskItem[] = WELCOME_STARTER_TASKS;
