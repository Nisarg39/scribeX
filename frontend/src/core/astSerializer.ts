/**
 * ScribeX Markdown AST Serializer & Parser
 * Bidirectional round-tripping between Extended Markdown (.md) and ComposableBlock[]
 * Source of Truth: docs/Universal_Note_Input_Structure_and_Relations.md
 */

import { ComposableBlock, BlockType, ChecklistPoint } from '../types/note';

/**
 * Coalesces adjacent checklist blocks into unified checklist container blocks
 */
export function coalesceChecklistBlocks(blocks: ComposableBlock[]): ComposableBlock[] {
  const result: ComposableBlock[] = [];
  for (const block of blocks) {
    if (block.type === 'checklist') {
      const items: ChecklistPoint[] = Array.isArray(block.metadata?.items) && block.metadata.items.length > 0
        ? block.metadata.items
        : [{
            id: block.metadata?.taskId || block.id,
            text: block.content || '',
            checked: !!block.metadata?.checked,
            priority: block.metadata?.priority || 'none',
            dueDate: block.metadata?.dueDate || 'Today',
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

    // 3. Audio / Drawing / Image with annotations
    // Drawing: ![Sketch](url) <!-- scribex:block type=drawing -->
    if (line.includes('scribex:block type=drawing')) {
      flushParagraph();
      const match = line.match(/!\[(.*?)\]\((.*?)\)/);
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'drawing',
        content: match ? match[2] : '',
        metadata: { title: match ? match[1] : 'Sketch' },
      });
      continue;
    }

    // Audio: ![Audio](url) <!-- scribex:block type=audio duration=184 -->
    if (line.includes('scribex:block type=audio')) {
      flushParagraph();
      const match = line.match(/!\[(.*?)\]\((.*?)\)/);
      const durMatch = line.match(/duration=(\d+)/);
      const transMatch = line.match(/transcription="([^"]*)"/);
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'audio',
        content: match ? match[2] : '',
        metadata: {
          durationSec: durMatch ? parseInt(durMatch[1], 10) : 94,
          transcription: transMatch ? transMatch[1] : '',
        },
      });
      continue;
    }

    // File: [FileName.pdf](url) <!-- scribex:block type=file size=1048576 -->
    if (line.includes('scribex:block type=file')) {
      flushParagraph();
      const match = line.match(/\[(.*?)\]\((.*?)\)/);
      const sizeMatch = line.match(/size=(\d+)/);
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'file',
        content: match ? match[2] : '',
        metadata: {
          fileName: match ? match[1] : 'File.pdf',
          sizeBytes: sizeMatch ? parseInt(sizeMatch[1], 10) : 1048576,
        },
      });
      continue;
    }

    // Bookmark: [Title](url) <!-- scribex:block type=bookmark description="desc" previewUrl="thumb" -->
    if (line.includes('scribex:block type=bookmark')) {
      flushParagraph();
      const match = line.match(/\[(.*?)\]\((.*?)\)/);
      const descMatch = line.match(/description="([^"]*)"/);
      const prevMatch = line.match(/previewUrl="([^"]*)"/);
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'bookmark',
        content: match ? match[2] : '',
        metadata: {
          title: match ? match[1] : 'Bookmark',
          description: descMatch ? descMatch[1] : '',
          previewUrl: prevMatch ? prevMatch[1] : '',
        },
      });
      continue;
    }

    // Annotated Image: ![Caption](url) <!-- scribex:media width=50% align=center ratio=natural -->
    const imageAnnotatedMatch = line.trim().match(/^!\[(.*?)\]\((.*?)\)\s*<!--\s*scribex:media\s+([^>]+)-->/);
    if (imageAnnotatedMatch) {
      flushParagraph();
      const metaStr = imageAnnotatedMatch[3];
      const widthMatch = metaStr.match(/width=([^\s]+)/);
      const alignMatch = metaStr.match(/align=([^\s]+)/);
      const ratioMatch = metaStr.match(/ratio=([^\s]+)/);
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'image',
        content: imageAnnotatedMatch[2],
        metadata: {
          caption: imageAnnotatedMatch[1],
          width: widthMatch ? widthMatch[1] : '100%',
          align: alignMatch ? alignMatch[1] : 'center',
          aspectRatio: ratioMatch ? ratioMatch[1] : 'natural',
        },
      });
      continue;
    }

    // Standard Image: ![Caption](url)
    const imageMatch = line.trim().match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      flushParagraph();
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'image',
        content: imageMatch[2],
        metadata: {
          caption: imageMatch[1],
          width: '100%',
          align: 'center',
          aspectRatio: 'natural',
        },
      });
      continue;
    }

    // 4. Divider (--- or ***)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      flushParagraph();
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'divider',
        content: '',
      });
      continue;
    }

    // 5. Callout Alert (> [!info] / > [!warning] / > [!success] / > [!quote])
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

    // 6. GFM Markdown Table (| Col 1 | Col 2 |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [line.trim()];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith('|') && lines[j].trim().endsWith('|')) {
        tableLines.push(lines[j].trim());
        j++;
      }

      if (tableLines.length >= 2) {
        const separatorIdx = tableLines.findIndex(tl => /^\|(\s*:?-+:?\s*\|)+$/.test(tl));
        if (separatorIdx > 0) {
          flushParagraph();
          i = j - 1;

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

    // 7. Headings (# H1 to #### H4)
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

    // 8. Checklist (- [ ] or - [x])
    const checkMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (checkMatch) {
      flushParagraph();
      const isChecked = checkMatch[1].toLowerCase() === 'x';
      let rawText = checkMatch[2].trim();
      let taskId = `task-${Date.now()}-${blocks.length + 1}`;
      let priority = 'none';
      let dueDate = 'Today';

      const taskCommentMatch = rawText.match(/<!--\s*scribex:task\s+id=([^\s]+)(?:\s+priority=([^\s]+))?(?:\s+due=([^\s]+))?\s*-->/);
      if (taskCommentMatch) {
        taskId = taskCommentMatch[1];
        if (taskCommentMatch[2]) priority = taskCommentMatch[2];
        if (taskCommentMatch[3]) dueDate = taskCommentMatch[3];
        rawText = rawText.replace(/<!--\s*scribex:task.*?-->/, '').trim();
      }

      const newItem: ChecklistPoint = {
        id: taskId,
        text: rawText,
        checked: isChecked,
        priority: priority as any,
        dueDate,
      };

      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.type === 'checklist') {
        const existingItems = Array.isArray(lastBlock.metadata?.items) ? lastBlock.metadata.items : [];
        lastBlock.metadata = { ...lastBlock.metadata, items: [...existingItems, newItem] };
        lastBlock.content = lastBlock.metadata.items.map((i: any) => i.text).join('\n');
      } else {
        blocks.push({
          id: `b-${Date.now()}-${blocks.length + 1}`,
          type: 'checklist',
          content: rawText,
          metadata: {
            items: [newItem],
          },
        });
      }
      continue;
    }

    // 9. Standard Blockquote (> Text)
    if (line.startsWith('>')) {
      flushParagraph();
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'quote',
        content: line.replace(/^>\s*/, '').trim(),
      });
      continue;
    }

    // 10. Empty Line
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

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
        const items: ChecklistPoint[] = Array.isArray(block.metadata?.items) && block.metadata.items.length > 0
          ? block.metadata.items
          : (block.content ? [{ id: block.metadata?.taskId || block.id, text: block.content, checked: !!block.metadata?.checked, priority: block.metadata?.priority || 'none', dueDate: block.metadata?.dueDate || 'Today' }] : []);
        
        const lines = items.map((item) => {
          const checked = item.checked ? 'x' : ' ';
          const taskId = item.id || `task-${Date.now()}`;
          const priority = item.priority && item.priority !== 'none' ? ` priority=${item.priority}` : '';
          const due = item.dueDate ? ` due=${item.dueDate}` : '';
          return `- [${checked}] ${item.text.trim()} <!-- scribex:task id=${taskId}${priority}${due} -->`;
        });
        chunks.push(lines.join('\n'));
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

      case 'image': {
        const url = block.content || block.metadata?.url || '';
        const caption = block.metadata?.caption || '';
        const width = block.metadata?.width || '100%';
        const align = block.metadata?.align || 'center';
        const aspectRatio = block.metadata?.aspectRatio || 'natural';
        if (width !== '100%' || align !== 'center' || aspectRatio !== 'natural') {
          chunks.push(`![${caption}](${url}) <!-- scribex:media width=${width} align=${align} ratio=${aspectRatio} -->`);
        } else {
          chunks.push(`![${caption}](${url})`);
        }
        break;
      }

      case 'drawing': {
        const url = block.content || '';
        chunks.push(`![Sketch](${url}) <!-- scribex:block type=drawing -->`);
        break;
      }

      case 'audio': {
        const url = block.content || '';
        const dur = block.metadata?.durationSec || 94;
        const trans = (block.metadata?.transcription || '').replace(/"/g, "'");
        chunks.push(`![Audio](${url}) <!-- scribex:block type=audio duration=${dur} transcription="${trans}" -->`);
        break;
      }

      case 'file': {
        const url = block.content || '#';
        const name = block.metadata?.fileName || 'Document.pdf';
        const size = block.metadata?.sizeBytes || 1048576;
        chunks.push(`[${name}](${url}) <!-- scribex:block type=file size=${size} -->`);
        break;
      }

      case 'bookmark': {
        const url = block.content || 'https://';
        const title = (block.metadata?.title || 'Web Bookmark').replace(/"/g, "'");
        const desc = (block.metadata?.description || '').replace(/"/g, "'");
        const thumb = block.metadata?.previewUrl || '';
        chunks.push(`[${title}](${url}) <!-- scribex:block type=bookmark description="${desc}" previewUrl="${thumb}" -->`);
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
