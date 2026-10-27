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

  let inEquationBlock = false;
  let equationBuffer: string[] = [];

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
          metadata: { language: codeLang || 'typescript' },
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

    // 2. Equation Block ($$)
    if (line.trim() === '$$') {
      if (inEquationBlock) {
        blocks.push({
          id: `b-${Date.now()}-${blocks.length + 1}`,
          type: 'equation',
          content: equationBuffer.join('\n').trim(),
          metadata: { displayMode: true },
        });
        equationBuffer = [];
        inEquationBlock = false;
      } else {
        flushParagraph();
        inEquationBlock = true;
      }
      continue;
    }

    if (inEquationBlock) {
      equationBuffer.push(line);
      continue;
    }

    // Single-line equation: $$ ... $$
    const singleLineEq = line.trim().match(/^\$\$(.+)\$\$$/);
    if (singleLineEq) {
      flushParagraph();
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'equation',
        content: singleLineEq[1].trim(),
        metadata: { displayMode: true },
      });
      continue;
    }

    // 3. Divider (--- or ***)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      flushParagraph();
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'divider',
        content: '',
      });
      continue;
    }

    // 4. Callout Alert (> [!info] / > [!warning] / > [!success] / > [!quote])
    const calloutHeaderMatch = line.match(/^>\s*\[!(info|warning|success|quote|note|tip|caution)\]/i);
    if (calloutHeaderMatch) {
      flushParagraph();
      const rawVariant = calloutHeaderMatch[1].toLowerCase();
      const variant = rawVariant === 'note' || rawVariant === 'tip' ? 'info' 
                    : rawVariant === 'caution' ? 'warning' 
                    : rawVariant;
      
      const calloutLines: string[] = [];
      // Read rest of callout block
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) {
        i++;
        calloutLines.push(lines[i].replace(/^>\s?/, ''));
      }

      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'callout',
        content: calloutLines.join('\n').trim(),
        metadata: { variant },
      });
      continue;
    }

    // 5. GFM Markdown Table (| Col 1 | Col 2 |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      // Check if subsequent lines form a table (need at least 2 lines with a separator |---|)
      const tableLines: string[] = [line.trim()];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith('|') && lines[j].trim().endsWith('|')) {
        tableLines.push(lines[j].trim());
        j++;
      }

      if (tableLines.length >= 2) {
        // Has header and separator
        const separatorIdx = tableLines.findIndex(tl => /^\|(\s*:?-+:?\s*\|)+$/.test(tl));
        if (separatorIdx > 0) {
          flushParagraph();
          i = j - 1; // Advance outer loop

          // Parse columns and rows
          const headerLine = tableLines[0];
          const columns = headerLine
            .split('|')
            .slice(1, -1)
            .map(c => c.trim());

          const rows: string[][] = [];
          for (let r = separatorIdx + 1; r < tableLines.length; r++) {
            const rowCells = tableLines[r]
              .split('|')
              .slice(1, -1)
              .map(c => c.trim());
            // Align length to columns
            while (rowCells.length < columns.length) rowCells.push('');
            rows.push(rowCells.slice(0, columns.length));
          }

          blocks.push({
            id: `b-${Date.now()}-${blocks.length + 1}`,
            type: 'table',
            content: tableLines.join('\n'),
            metadata: { columns, rows },
          });
          continue;
        }
      }
    }

    // 6. Headings (# H1 to #### H4)
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

    // 7. Checklist (- [ ] or - [x])
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

    // 8. Standard Blockquote (> Text)
    if (line.startsWith('>')) {
      flushParagraph();
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'quote',
        content: line.replace(/^>\s*/, '').trim(),
      });
      continue;
    }

    // 9. Empty Line (deliberate paragraph separator)
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
        const lang = block.metadata?.language || 'typescript';
        chunks.push(`\`\`\`${lang}\n${block.content}\n\`\`\``);
        break;
      }

      case 'callout': {
        const variant = block.metadata?.variant || 'info';
        const innerContent = block.content.trim() || 'Insight';
        const lines = innerContent.split('\n').map(l => `> ${l}`).join('\n');
        chunks.push(`> [!${variant}]\n${lines}`);
        break;
      }

      case 'table': {
        if (block.metadata?.columns && Array.isArray(block.metadata.columns)) {
          const cols: string[] = block.metadata.columns;
          const rows: string[][] = block.metadata.rows || [];
          const header = `| ${cols.join(' | ')} |`;
          const sep = `| ${cols.map(() => '---').join(' | ')} |`;
          const rowLines = rows.map(r => `| ${r.join(' | ')} |`);
          chunks.push([header, sep, ...rowLines].join('\n'));
        } else if (block.content.trim()) {
          chunks.push(block.content.trim());
        }
        break;
      }

      case 'equation': {
        const formula = block.content.trim();
        chunks.push(`$$\n${formula}\n$$`);
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
