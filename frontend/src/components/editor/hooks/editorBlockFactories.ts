/**
 * ScribeX Editor Block Metadata Factories & Predicates
 */

import { BlockType, ChecklistPoint } from '../../../types/note';

export const isTextTransformableBlock = (type?: BlockType): boolean => {
  return type === 'paragraph' || type === 'heading' || type === 'quote' || type === 'checklist';
};

/**
 * Creates default metadata structures for newly inserted or converted blocks
 */
export function createDefaultBlockMetadata(type: BlockType, content: string = ''): Record<string, any> | undefined {
  switch (type) {
    case 'checklist': {
      const items: ChecklistPoint[] = content
        ? content.split('\n').filter(Boolean).map((text, idx) => ({
            id: `task-${Date.now()}-${idx}`,
            text: text.trim(),
            checked: false,
            priority: 'none' as const,
            dueDate: 'Today',
            indent: 0,
            style: 'paragraph' as const,
          }))
        : [
            {
              id: `task-${Date.now()}-0`,
              text: '',
              checked: false,
              priority: 'none' as const,
              dueDate: 'Today',
              indent: 0,
              style: 'paragraph' as const,
            },
          ];
      return { items };
    }

    case 'heading': {
      return { level: 1 };
    }

    case 'table': {
      return {
        headers: ['Column 1', 'Column 2', 'Column 3'],
        rows: [
          ['', '', ''],
          ['', '', ''],
        ],
      };
    }

    case 'kanban': {
      return {
        columns: [
          { id: 'todo', title: 'To Do', cards: [] },
          { id: 'in_progress', title: 'In Progress', cards: [] },
          { id: 'done', title: 'Done', cards: [] },
        ],
      };
    }

    case 'habit': {
      return {
        frequency: 'daily',
        streak: 0,
        completedDates: [],
      };
    }

    case 'code': {
      return {
        language: 'typescript',
      };
    }

    case 'callout': {
      return {
        icon: '💡',
        intent: 'info',
      };
    }

    case 'sheet': {
      return {
        rowCount: 5,
        colCount: 4,
        cells: {},
      };
    }

    case 'message_thread': {
      return {
        channel: 'notes',
        messages: [],
      };
    }

    default:
      return undefined;
  }
}
