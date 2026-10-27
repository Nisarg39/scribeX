/**
 * ScribeX Markdown AST Serializer & Parser
 * Bidirectional round-tripping between Extended Markdown (.md) and ComposableBlock[]
 * Source of Truth: docs/Universal_Note_Input_Structure_and_Relations.md
 */

import { ComposableBlock, BlockType } from '../types/note';

/**
 * Parses raw markdown text into an array of ComposableBlock objects
 */
export function parseMarkdownToBlocks(markdown: string): ComposableBlock[] {
  if (!markdown || !markdown.trim()) {
    return [
      {
        id: `b-${Date.now()}-1`,
        type: 'paragraph',
        content: '',
      },
    ];
  }

  const lines = markdown.split('\n');
  const blocks: ComposableBlock[] = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeBuffer: string[] = [];

  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join('\n').trim();
      if (text) {
        blocks.push({
          id: `b-${Date.now()}-${blocks.length + 1}`,
          type: 'paragraph',
          content: text,
        });
      }
      currentParagraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Code Block Fence (```)
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        blocks.push({
          id: `b-${Date.now()}-${blocks.length + 1}`,
          type: 'code',
          content: codeBuffer.join('\n'),
          metadata: { language: codeLang },
        });
        codeBuffer = [];
        codeLang = '';
        inCodeBlock = false;
      } else {
        flushParagraph();
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // 2. Divider (--- or ***)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      flushParagraph();
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'divider',
        content: '',
      });
      continue;
    }

    // 3. Headings (# H1 to #### H4)
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'heading',
        content: headingMatch[2].trim(),
        metadata: { level },
      });
      continue;
    }

    // 4. Checklist (- [ ] or - [x])
    const checkMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (checkMatch) {
      flushParagraph();
      const isChecked = checkMatch[1].toLowerCase() === 'x';
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'checklist',
        content: checkMatch[2].trim(),
        metadata: { checked: isChecked },
      });
      continue;
    }

    // 5. Blockquote (> Text)
    if (line.startsWith('>')) {
      flushParagraph();
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'quote',
        content: line.replace(/^>\s*/, '').trim(),
      });
      continue;
    }

    // 6. Empty Line (deliberate paragraph separator)
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    // Normal paragraph line
    currentParagraph.push(line);
  }

  flushParagraph();

  if (blocks.length === 0) {
    blocks.push({
      id: `b-${Date.now()}-1`,
      type: 'paragraph',
      content: '',
    });
  }

  return blocks;
}

/**
 * Serializes an array of ComposableBlock objects back into standard Markdown (.md)
 */
export function serializeBlocksToMarkdown(blocks: ComposableBlock[]): string {
  if (!blocks || blocks.length === 0) return '';

  const chunks: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const level = block.metadata?.level || 1;
        const prefix = '#'.repeat(Math.min(Math.max(level, 1), 4));
        chunks.push(`${prefix} ${block.content.trim()}`);
        break;
      }

      case 'checklist': {
        const checked = block.metadata?.checked ? 'x' : ' ';
        chunks.push(`- [${checked}] ${block.content.trim()}`);
        break;
      }

      case 'code': {
        const lang = block.metadata?.language || '';
        chunks.push(`\`\`\`${lang}\n${block.content}\n\`\`\``);
        break;
      }

      case 'quote': {
        chunks.push(`> ${block.content.trim()}`);
        break;
      }

      case 'divider': {
        chunks.push('---');
        break;
      }

      case 'paragraph':
      default: {
        if (block.content.trim()) {
          chunks.push(block.content.trim());
        }
        break;
      }
    }
  }

  return chunks.join('\n\n');
}
