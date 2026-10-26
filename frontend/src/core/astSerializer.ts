/**
 * ScribeX Canonical Markdown AST Serializer & Block Registry.
 *
 * Implements bidirectional transformation between human-readable Extended Markdown
 * (stored in Git Vault and SQLite) and reactive composable NoteBlock[] objects.
 * Platform: Cross-Platform (Web, iOS, Android).
 */

export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'checklist'
  | 'task'
  | 'bulleted_list'
  | 'numbered_list'
  | 'code'
  | 'callout'
  | 'equation'
  | 'table'
  | 'divider'
  | 'audio'
  | 'transcript'
  | 'image'
  | 'file'
  | 'location';

export interface BaseBlock {
  id: string;
  block_type: BlockType;
  position: number;
}

export interface ParagraphBlock extends BaseBlock {
  block_type: 'paragraph';
  content: { text: string };
}

export interface HeadingBlock extends BaseBlock {
  block_type: 'heading';
  content: { text: string; level: 1 | 2 | 3 | 4 };
}

export interface TaskBlock extends BaseBlock {
  block_type: 'task' | 'checklist';
  content: {
    taskId: string;
    text: string;
    checked: boolean;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    dueDate?: string;
  };
}

export interface BulletedListBlock extends BaseBlock {
  block_type: 'bulleted_list';
  content: { items: string[] };
}

export interface NumberedListBlock extends BaseBlock {
  block_type: 'numbered_list';
  content: { items: string[] };
}

export interface CodeBlock extends BaseBlock {
  block_type: 'code';
  content: { code: string; language: string; fileName?: string };
}

export interface CalloutBlock extends BaseBlock {
  block_type: 'callout';
  content: {
    text: string;
    variant: 'info' | 'warning' | 'success' | 'quote';
  };
}

export interface EquationBlock extends BaseBlock {
  block_type: 'equation';
  content: { latex: string; displayMode?: boolean };
}

export interface TableBlock extends BaseBlock {
  block_type: 'table';
  content: { columns: string[]; rows: string[][] };
}

export interface DividerBlock extends BaseBlock {
  block_type: 'divider';
  content: { style?: 'subtle' | 'dashed' };
}

export interface AudioBlock extends BaseBlock {
  block_type: 'audio';
  content: { assetId?: string; durationSec?: number; caption?: string; url?: string };
}

export interface TranscriptBlock extends BaseBlock {
  block_type: 'transcript';
  content: { segments: { speaker: string; start: number; text: string }[] };
}

export interface ImageBlock extends BaseBlock {
  block_type: 'image';
  content: { assetId?: string; url?: string; caption?: string };
}

export interface FileBlock extends BaseBlock {
  block_type: 'file';
  content: { assetId?: string; fileName: string; size?: number };
}

export interface LocationBlock extends BaseBlock {
  block_type: 'location';
  content: { placeName: string; lat?: number; lng?: number };
}

export type NoteBlock =
  | ParagraphBlock
  | HeadingBlock
  | TaskBlock
  | BulletedListBlock
  | NumberedListBlock
  | CodeBlock
  | CalloutBlock
  | EquationBlock
  | TableBlock
  | DividerBlock
  | AudioBlock
  | TranscriptBlock
  | ImageBlock
  | FileBlock
  | LocationBlock;

function generateBlockId(prefix: string = 'blk'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Parses Markdown string into an array of typed NoteBlock[] objects.
 */
export function parseMarkdownToBlocks(markdown: string): NoteBlock[] {
  if (!markdown || !markdown.trim()) {
    return [
      {
        id: generateBlockId('p'),
        block_type: 'paragraph',
        position: 0,
        content: { text: '' },
      },
    ];
  }

  const rawLines = markdown.split('\n');
  const blocks: NoteBlock[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 1. Code Block Fence (```)
    if (trimmed.startsWith('```')) {
      const language = trimmed.replace(/^```/, '').trim() || 'text';
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
        codeLines.push(rawLines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({
        id: generateBlockId('code'),
        block_type: 'code',
        position: blocks.length,
        content: { code: codeLines.join('\n'), language },
      });
      continue;
    }

    // 2. Headings (# H1, ## H2, ### H3, #### H4)
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4;
      blocks.push({
        id: generateBlockId('h'),
        block_type: 'heading',
        position: blocks.length,
        content: { text: headingMatch[2].trim(), level },
      });
      i++;
      continue;
    }

    // 3. Task / Checklist Item (- [ ] or - [x])
    // Syntax: - [ ] Task title <!-- scribex:task id=tsk_... priority=... due=... -->
    const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      const isChecked = taskMatch[1].toLowerCase() === 'x';
      let rest = taskMatch[2].trim();
      let taskId = generateBlockId('tsk');
      let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
      let dueDate: string | undefined;

      const metaComment = rest.match(/<!--\s*scribex:task\s+([^>]+)-->/);
      if (metaComment) {
        rest = rest.replace(metaComment[0], '').trim();
        const metaStr = metaComment[1];
        const idMatch = metaStr.match(/id=([^\s]+)/);
        const prioMatch = metaStr.match(/priority=([^\s]+)/);
        const dueMatch = metaStr.match(/due=([^\s]+)/);
        if (idMatch) taskId = idMatch[1];
        if (prioMatch && ['low', 'medium', 'high', 'urgent'].includes(prioMatch[1])) {
          priority = prioMatch[1] as any;
        }
        if (dueMatch) dueDate = dueMatch[1];
      }

      blocks.push({
        id: generateBlockId('task'),
        block_type: 'task',
        position: blocks.length,
        content: {
          taskId,
          text: rest,
          checked: isChecked,
          priority,
          dueDate,
        },
      });
      i++;
      continue;
    }

    // 4. Callout / Alert Block (> [!variant] or > Quote)
    if (trimmed.startsWith('>')) {
      const calloutVariantMatch = trimmed.match(/^>\s*\[!([a-zA-Z]+)\]/);
      let variant: 'info' | 'warning' | 'success' | 'quote' = 'quote';
      const calloutLines: string[] = [];

      if (calloutVariantMatch) {
        const rawVariant = calloutVariantMatch[1].toLowerCase();
        if (rawVariant === 'warning' || rawVariant === 'caution') variant = 'warning';
        else if (rawVariant === 'success' || rawVariant === 'tip') variant = 'success';
        else if (rawVariant === 'info' || rawVariant === 'note') variant = 'info';
        else variant = 'quote';
        i++; // skip initial tag line
      }

      while (i < rawLines.length && rawLines[i].trim().startsWith('>')) {
        calloutLines.push(rawLines[i].replace(/^>\s?/, ''));
        i++;
      }

      blocks.push({
        id: generateBlockId('callout'),
        block_type: 'callout',
        position: blocks.length,
        content: { text: calloutLines.join('\n').trim(), variant },
      });
      continue;
    }

    // 5. Divider (--- or ***)
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      blocks.push({
        id: generateBlockId('div'),
        block_type: 'divider',
        position: blocks.length,
        content: { style: 'subtle' },
      });
      i++;
      continue;
    }

    // 6. LaTeX Equation ($$ ... $$)
    if (trimmed.startsWith('$$')) {
      let latex = trimmed.replace(/^\$\$/, '');
      if (latex.endsWith('$$') && latex.length >= 2) {
        latex = latex.slice(0, -2).trim();
        i++;
      } else {
        const eqLines = [latex];
        i++;
        while (i < rawLines.length && !rawLines[i].trim().endsWith('$$')) {
          eqLines.push(rawLines[i]);
          i++;
        }
        if (i < rawLines.length) {
          eqLines.push(rawLines[i].replace(/\$\$$/, ''));
          i++;
        }
        latex = eqLines.join('\n').trim();
      }
      blocks.push({
        id: generateBlockId('eq'),
        block_type: 'equation',
        position: blocks.length,
        content: { latex, displayMode: true },
      });
      continue;
    }

    // 7. Bulleted List (- or *)
    if (/^[-*]\s+/.test(line) && !line.includes('[ ]') && !line.includes('[x]')) {
      const items: string[] = [];
      while (
        i < rawLines.length &&
        /^[-*]\s+/.test(rawLines[i]) &&
        !rawLines[i].includes('[ ]') &&
        !rawLines[i].includes('[x]')
      ) {
        items.push(rawLines[i].replace(/^[-*]\s+/, '').trim());
        i++;
      }
      blocks.push({
        id: generateBlockId('ul'),
        block_type: 'bulleted_list',
        position: blocks.length,
        content: { items },
      });
      continue;
    }

    // 8. Numbered List (1. 2. 3.)
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < rawLines.length && /^\d+\.\s+/.test(rawLines[i])) {
        items.push(rawLines[i].replace(/^\d+\.\s+/, '').trim());
        i++;
      }
      blocks.push({
        id: generateBlockId('ol'),
        block_type: 'numbered_list',
        position: blocks.length,
        content: { items },
      });
      continue;
    }

    // 9. Markdown Image or Audio Asset
    // Supports:
    // ![Caption](url)
    // [Asset: Caption](url)
    // [Caption.png](url)
    const mediaMatch = line.match(/^!?\[(?:Asset:\s*)?([^\]]*)\]\(([^)]+)\)(.*)$/);
    if (mediaMatch) {
      const caption = mediaMatch[1] || 'Image';
      const url = mediaMatch[2];
      const meta = mediaMatch[3] || '';
      const isImgExt =
        /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(url) ||
        /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(caption);
      const isAudio =
        meta.includes('type=audio') ||
        /\.(m4a|mp3|wav|ogg|aac)(\?.*)?$/i.test(url);

      if (isAudio) {
        blocks.push({
          id: generateBlockId('audio'),
          block_type: 'audio',
          position: blocks.length,
          content: { url, caption },
        });
        i++;
        continue;
      } else if (isImgExt || line.trim().startsWith('!')) {
        blocks.push({
          id: generateBlockId('img'),
          block_type: 'image',
          position: blocks.length,
          content: { url, caption },
        });
        i++;
        continue;
      }
    }

    // 10. Empty line
    if (!trimmed) {
      i++;
      continue;
    }

    // 11. Default: Paragraph
    const paraLines: string[] = [line];
    i++;
    while (
      i < rawLines.length &&
      rawLines[i].trim() !== '' &&
      !rawLines[i].trim().startsWith('#') &&
      !rawLines[i].trim().startsWith('```') &&
      !rawLines[i].trim().startsWith('>') &&
      !rawLines[i].trim().startsWith('- [') &&
      !/^(\*\*\*|---|___)$/.test(rawLines[i].trim())
    ) {
      paraLines.push(rawLines[i]);
      i++;
    }

    blocks.push({
      id: generateBlockId('p'),
      block_type: 'paragraph',
      position: blocks.length,
      content: { text: paraLines.join('\n').trim() },
    });
  }

  return blocks.length > 0
    ? blocks
    : [
        {
          id: generateBlockId('p'),
          block_type: 'paragraph',
          position: 0,
          content: { text: '' },
        },
      ];
}

/**
 * Serializes an array of NoteBlock[] objects into standard Extended Markdown AST.
 */
export function serializeBlocksToMarkdown(blocks: NoteBlock[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.block_type) {
      case 'heading': {
        const hashes = '#'.repeat(block.content.level);
        parts.push(`${hashes} ${block.content.text}`);
        break;
      }
      case 'task':
      case 'checklist': {
        const check = block.content.checked ? 'x' : ' ';
        const metaAttrs = [
          `id=${block.content.taskId || block.id}`,
          block.content.priority ? `priority=${block.content.priority}` : '',
          block.content.dueDate ? `due=${block.content.dueDate}` : '',
        ]
          .filter(Boolean)
          .join(' ');
        parts.push(`- [${check}] ${block.content.text} <!-- scribex:task ${metaAttrs} -->`);
        break;
      }
      case 'bulleted_list': {
        const items = block.content.items.map((it) => `- ${it}`).join('\n');
        parts.push(items);
        break;
      }
      case 'numbered_list': {
        const items = block.content.items.map((it, idx) => `${idx + 1}. ${it}`).join('\n');
        parts.push(items);
        break;
      }
      case 'code': {
        const lang = block.content.language || '';
        parts.push(`\`\`\`${lang}\n${block.content.code}\n\`\`\``);
        break;
      }
      case 'callout': {
        const tag = block.content.variant || 'note';
        const lines = block.content.text.split('\n').map((l) => `> ${l}`).join('\n');
        parts.push(`> [!${tag}]\n${lines}`);
        break;
      }
      case 'equation': {
        parts.push(`$$\n${block.content.latex}\n$$`);
        break;
      }
      case 'divider': {
        parts.push('---');
        break;
      }
      case 'image': {
        parts.push(`![${block.content.caption || 'Image'}](${block.content.url || '_assets/image.png'})`);
        break;
      }
      case 'audio': {
        parts.push(
          `![Audio](${block.content.url || '_assets/recording.m4a'}) <!-- scribex:block type=audio duration=${
            block.content.durationSec || 0
          } -->`
        );
        break;
      }
      case 'paragraph':
      default: {
        if (block.content && typeof (block.content as any).text === 'string') {
          parts.push((block.content as any).text);
        }
        break;
      }
    }
  }

  return parts.join('\n\n').trim();
}
