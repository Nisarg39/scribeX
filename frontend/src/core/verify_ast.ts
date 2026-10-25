/**
 * Standalone Verification Script for Extended Markdown AST Round-Trip Serializer.
 */

import {
  parseMarkdownToBlocks,
  serializeBlocksToMarkdown,
  NoteBlock,
} from './astSerializer';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('--- Testing ScribeX Canonical Markdown AST Serializer ---');

// 1. Test parsing complex markdown
const inputMarkdown = `# Project ScribeX Architecture

Here is the operational core architecture for Friday.

## Tasks and Next Steps
- [ ] Implement AST parser <!-- scribex:task id=tsk_101 priority=urgent -->
- [x] Configure delta sync engine <!-- scribex:task id=tsk_102 priority=high -->

> [!info]
> Note tiles always preserve vivid pastel colors across both light and dark themes.

\`\`\`typescript
export const greeting = "Hello Friday";
\`\`\`

$$
E = mc^2
$$

- First bullet item
- Second bullet item

1. Step one
2. Step two

---`;

const blocks = parseMarkdownToBlocks(inputMarkdown);
console.log(`Parsed ${blocks.length} blocks successfully.`);

// Verify block types
assert(blocks[0].block_type === 'heading', 'Block 0 should be heading');
assert((blocks[0] as any).content.level === 1, 'Block 0 should be level 1');

assert(blocks[1].block_type === 'paragraph', 'Block 1 should be paragraph');

assert(blocks[2].block_type === 'heading', 'Block 2 should be heading H2');
assert((blocks[2] as any).content.level === 2, 'Block 2 should be level 2');

assert(blocks[3].block_type === 'task', 'Block 3 should be task');
assert((blocks[3] as any).content.checked === false, 'Block 3 should be unchecked');
assert((blocks[3] as any).content.taskId === 'tsk_101', 'Block 3 taskId should be tsk_101');
assert((blocks[3] as any).content.priority === 'urgent', 'Block 3 priority should be urgent');

assert(blocks[4].block_type === 'task', 'Block 4 should be task');
assert((blocks[4] as any).content.checked === true, 'Block 4 should be checked');
assert((blocks[4] as any).content.taskId === 'tsk_102', 'Block 4 taskId should be tsk_102');

assert(blocks[5].block_type === 'callout', 'Block 5 should be callout');
assert((blocks[5] as any).content.variant === 'info', 'Block 5 variant should be info');

assert(blocks[6].block_type === 'code', 'Block 6 should be code');
assert((blocks[6] as any).content.language === 'typescript', 'Block 6 language should be typescript');

assert(blocks[7].block_type === 'equation', 'Block 7 should be equation');
assert((blocks[7] as any).content.latex.includes('E = mc^2'), 'Block 7 should contain formula');

assert(blocks[8].block_type === 'bulleted_list', 'Block 8 should be bulleted_list');
assert((blocks[8] as any).content.items.length === 2, 'Block 8 should have 2 items');

assert(blocks[9].block_type === 'numbered_list', 'Block 9 should be numbered_list');
assert((blocks[9] as any).content.items.length === 2, 'Block 9 should have 2 items');

assert(blocks[10].block_type === 'divider', 'Block 10 should be divider');

console.log('All block parsing assertions passed.');

// 2. Test serialization round-trip
const serialized = serializeBlocksToMarkdown(blocks);
console.log('Serialized markdown output:\n', serialized);

assert(serialized.includes('# Project ScribeX Architecture'), 'Should contain H1');
assert(serialized.includes('<!-- scribex:task id=tsk_101 priority=urgent -->'), 'Should preserve task metadata');
assert(serialized.includes('- [x] Configure delta sync engine'), 'Should preserve checked task');
assert(serialized.includes('> [!info]'), 'Should preserve callout');
assert(serialized.includes('```typescript'), 'Should preserve code fence');
assert(serialized.includes('$$'), 'Should preserve LaTeX equation');

// 3. Re-parse serialized output to verify idempotency
const reParsed = parseMarkdownToBlocks(serialized);
assert(reParsed.length === blocks.length, `Re-parsed length (${reParsed.length}) should match original (${blocks.length})`);

console.log('\n--- AST ROUND-TRIP VERIFICATION 100% SUCCESSFUL ---');
