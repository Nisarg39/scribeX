/**
 * ScribeX AST Serializer & Parser Helper Functions
 */

import { ComposableBlock, ChecklistPoint } from '../../types/note';

/**
 * Coalesces adjacent checklist blocks into unified checklist container blocks
 */
export function coalesceChecklistBlocks(blocks: ComposableBlock[]): ComposableBlock[] {
  const result: ComposableBlock[] = [];
  for (const block of blocks) {
    if (block.type === 'checklist') {
      const items: ChecklistPoint[] = Array.isArray(block.metadata?.items) && block.metadata.items.length > 0
        ? block.metadata.items.map((it: any) => ({ ...it, indent: it.indent || 0 }))
        : [{
            id: block.metadata?.taskId || block.id,
            text: block.content || '',
            checked: !!block.metadata?.checked,
            indent: block.metadata?.indent || 0,
            priority: block.metadata?.priority || 'none',
            dueDate: block.metadata?.dueDate || 'Today',
            style: block.metadata?.style || 'paragraph',
          }];

      const prev = result[result.length - 1];
      if (prev && prev.type === 'checklist') {
        const prevItems = Array.isArray(prev.metadata?.items) ? prev.metadata.items : [];
        prev.metadata = { ...prev.metadata, items: [...prevItems, ...items] };
        prev.content = prev.metadata.items.map((i: any) => i.text).join('\n');
      } else {
        result.push({
          ...block,
          content: items.map((i: any) => i.text).join('\n'),
          metadata: {
            ...block.metadata,
            items,
          },
        });
      }
    } else {
      result.push(block);
    }
  }
  return result;
}
