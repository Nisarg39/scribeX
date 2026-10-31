/**
 * ScribeX Dedicated Search & Card Preview Indexer (Save-Time & Sync Ingest)
 * Strictly separated from the Editor AST Serializer (astSerializer.ts).
 *
 * Responsibilities:
 * 1. Extract human-readable, tiered searchable tokens across all 34 block types
 *    while strictly ignoring base64 media payloads, binary URIs, SVG stroke coordinates,
 *    and internal HTML comment syntax (`<!-- scribex:block ... -->`).
 * 2. Generate clean, human-readable 2-line preview summaries (`cleanPreviewText`)
 *    for Home screen Note Cards so raw HTML comments never leak onto cards.
 */

import { NoteItem, ComposableBlock, BlockType } from '../types/note';

export interface IndexedBlockEntry {
  blockId: string;
  blockType: BlockType;
  label: string;          // Human label for badge, e.g. "Sketch", "Audio", "Task", "Diagram"
  primaryTitle: string;   // Tier 3 high-priority block title / media caption / filename
  bodyText: string;       // Tier 4 body content / transcript / OCR text / table cells
}

export interface NoteSearchDocument {
  noteId: string;
  updatedAt: string;
  // Tier 1: Note Title (+100 exact/prefix, +75 substring)
  titleLower: string;
  // Tier 2: Organization (+60 tags / folderPath)
  folderLower: string;
  tagsLower: string[];
  // Tier 3: Media Captions, Filenames & Structured Block Titles (+45)
  blockTitlesLower: string;
  // Tier 4: Body Text, Lists, Code, Transcripts & OCR (+20)
  bodyTextLower: string;
  // Combined normalized plain-text string for SQLite `search_text` persistence & quick check
  combinedSearchText: string;
  // Per-block granular entries for extracting the exact Matched-Block Snippet Badge
  blockEntries: IndexedBlockEntry[];
  // Distinct block types present in this note (enables AI / filter queries like `hasBlockTypes: ['audio']`)
  presentBlockTypes: BlockType[];
  // Pre-cleaned 2-line card preview (free of `<!-- scribex:block -->` or base64 noise)
  cleanPreviewText: string;
}

/**
 * Strips raw HTML comments (`<!-- ... -->`), base64 data URIs, and markdown image/link URLs
 * from a raw string so only human-readable text remains.
 */
export function stripInternalMarkup(raw: string): string {
  if (!raw) return '';
  return raw
    // Remove <!-- scribex:... --> or any HTML comments
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Remove base64 data URIs
    .replace(/data:[a-zA-Z0-9/+.-]+;base64,[a-zA-Z0-9+/=]+/g, ' ')
    // Replace markdown images ![caption](url) with just caption
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Replace markdown links [label](url) with just label
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // Remove blockquote callout tags like > [!info]
    .replace(/^>\s*\[![a-zA-Z]+\]\s*/gm, '')
    // Collapse multiple spaces
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Checks whether a string looks like a non-searchable binary URL, base64 data URI, or raw JSON path array.
 */
function isBinaryOrCoordinateNoise(val: string): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('[{"id":') ||
    trimmed.startsWith('[{"d":')
  ) {
    return true;
  }
  return false;
}

/**
 * Extracts a structured `IndexedBlockEntry` from a single `ComposableBlock`.
 * Covers all 34 block types across Divisions A, B, C, and D.
 */
export function extractBlockIndexEntry(block: ComposableBlock): IndexedBlockEntry | null {
  const meta = block.metadata || {};
  const rawContent = block.content || '';
  const safeContent = isBinaryOrCoordinateNoise(rawContent) ? '' : stripInternalMarkup(rawContent);

  switch (block.type) {
    // =========================================================================
    // DIVISION D: Pure Structural (Not Searchable)
    // =========================================================================
    case 'divider':
      return null;

    // =========================================================================
    // DIVISION C: Media, Audio, Camera & Binary Blocks (Metadata-Only Search)
    // =========================================================================
    case 'image': {
      const caption = (meta.caption || meta.title || '').trim();
      return {
        blockId: block.id,
        blockType: 'image',
        label: 'Image',
        primaryTitle: caption,
        bodyText: '',
      };
    }

    case 'video': {
      const caption = (meta.caption || meta.title || '').trim();
      const transcript = (meta.transcript || '').trim();
      return {
        blockId: block.id,
        blockType: 'video',
        label: 'Video',
        primaryTitle: caption,
        bodyText: transcript,
      };
    }

    case 'audio': {
      const title = (meta.caption || meta.title || '').trim();
      const transcription = (meta.transcription || '').trim();
      return {
        blockId: block.id,
        blockType: 'audio',
        label: 'Audio',
        primaryTitle: title,
        bodyText: transcription,
      };
    }

    case 'voice_dictation': {
      const transcript = (meta.transcript || safeContent || '').trim();
      return {
        blockId: block.id,
        blockType: 'voice_dictation',
        label: 'Voice Dictation',
        primaryTitle: '',
        bodyText: transcript,
      };
    }

    case 'scan': {
      const docName = (meta.documentName || meta.title || '').trim();
      const ocrText = (meta.ocrText || safeContent || '').trim();
      return {
        blockId: block.id,
        blockType: 'scan',
        label: 'Scan',
        primaryTitle: docName,
        bodyText: ocrText,
      };
    }

    case 'file': {
      const fileName = (meta.fileName || meta.title || '').trim();
      return {
        blockId: block.id,
        blockType: 'file',
        label: 'File',
        primaryTitle: fileName,
        bodyText: '',
      };
    }

    case 'drawing': {
      const caption = (meta.caption || (meta.title !== 'Sketch' ? meta.title : '') || '').trim();
      return {
        blockId: block.id,
        blockType: 'drawing',
        label: 'Sketch',
        primaryTitle: caption,
        bodyText: '',
      };
    }

    // =========================================================================
    // DIVISION A: Core Text, Lists, Code & Equations
    // =========================================================================
    case 'heading': {
      return {
        blockId: block.id,
        blockType: 'heading',
        label: 'Heading',
        primaryTitle: safeContent,
        bodyText: '',
      };
    }

    case 'paragraph':
    case 'quote':
    case 'callout': {
      return {
        blockId: block.id,
        blockType: block.type,
        label: block.type === 'callout' ? 'Callout' : block.type === 'quote' ? 'Quote' : 'Text',
        primaryTitle: '',
        bodyText: safeContent,
      };
    }

    case 'code': {
      const fileName = (meta.fileName || '').trim();
      const lang = (meta.language || '').trim();
      return {
        blockId: block.id,
        blockType: 'code',
        label: 'Code',
        primaryTitle: fileName || lang,
        bodyText: rawContent.trim(),
      };
    }

    case 'equation': {
      return {
        blockId: block.id,
        blockType: 'equation',
        label: 'Equation',
        primaryTitle: '',
        bodyText: rawContent.trim(),
      };
    }

    case 'checklist': {
      const items: any[] = Array.isArray(meta.items) ? meta.items : [];
      const itemTexts = items.map((it) => (it?.text || '').trim()).filter(Boolean);
      const combined = itemTexts.length > 0 ? itemTexts.join(' • ') : safeContent;
      return {
        blockId: block.id,
        blockType: 'checklist',
        label: 'Task',
        primaryTitle: '',
        bodyText: combined,
      };
    }

    case 'bulleted_list':
    case 'numbered_list': {
      const items: any[] = Array.isArray(meta.items) ? meta.items : [];
      const itemTexts = items
        .map((it) => (typeof it === 'string' ? it.trim() : (it?.text || '').trim()))
        .filter(Boolean);
      const combined = itemTexts.length > 0 ? itemTexts.join(' • ') : safeContent;
      return {
        blockId: block.id,
        blockType: block.type,
        label: 'List',
        primaryTitle: '',
        bodyText: combined,
      };
    }

    case 'toggle': {
      const toggleTitle = (meta.title || '').trim();
      return {
        blockId: block.id,
        blockType: 'toggle',
        label: 'Toggle',
        primaryTitle: toggleTitle,
        bodyText: safeContent,
      };
    }

    case 'table': {
      const cols: string[] = Array.isArray(meta.columns) ? meta.columns : [];
      const rows: string[][] = Array.isArray(meta.rows) ? meta.rows : [];
      const flatCells = [...cols, ...rows.flat()].map((c) => (c || '').trim()).filter(Boolean);
      return {
        blockId: block.id,
        blockType: 'table',
        label: 'Table',
        primaryTitle: cols.join(' | '),
        bodyText: flatCells.join(' '),
      };
    }

    // =========================================================================
    // DIVISION B: Structured, Productivity & Knowledge Blocks
    // =========================================================================
    case 'habit': {
      const title = (meta.title || safeContent || '').trim();
      return {
        blockId: block.id,
        blockType: 'habit',
        label: 'Habit',
        primaryTitle: title,
        bodyText: (meta.frequency || '').trim(),
      };
    }

    case 'kanban': {
      const cols: any[] = Array.isArray(meta.columns) ? meta.columns : [];
      const cards: Record<string, any> = meta.cards || {};
      const colTitles = cols.map((c) => c?.title || '').filter(Boolean);
      const cardTexts = Object.values(cards)
        .map((c: any) => [c?.title, c?.tag].filter(Boolean).join(' '))
        .filter(Boolean);
      return {
        blockId: block.id,
        blockType: 'kanban',
        label: 'Kanban',
        primaryTitle: cardTexts.join(' • '),
        bodyText: colTitles.join(' '),
      };
    }

    case 'event': {
      const title = (meta.title || safeContent || '').trim();
      const details = [meta.location, meta.startDate, meta.notes, ...(Array.isArray(meta.attendees) ? meta.attendees : [])]
        .filter(Boolean)
        .join(' ');
      return {
        blockId: block.id,
        blockType: 'event',
        label: 'Event',
        primaryTitle: title,
        bodyText: details,
      };
    }

    case 'contact': {
      const name = (meta.name || safeContent || '').trim();
      const details = [meta.role, meta.company, meta.email, meta.phone, meta.handle, meta.notes]
        .filter(Boolean)
        .join(' ');
      return {
        blockId: block.id,
        blockType: 'contact',
        label: 'Contact',
        primaryTitle: name,
        bodyText: details,
      };
    }

    case 'expense': {
      const merchant = (meta.merchant || safeContent || '').trim();
      const details = [meta.category, meta.amount, meta.currency, meta.notes, meta.date]
        .filter(Boolean)
        .join(' ');
      return {
        blockId: block.id,
        blockType: 'expense',
        label: 'Expense',
        primaryTitle: merchant,
        bodyText: details,
      };
    }

    case 'reading': {
      const title = (meta.title || safeContent || '').trim();
      const details = [meta.author, meta.status, meta.notes, meta.sourceUrl]
        .filter(Boolean)
        .join(' ');
      return {
        blockId: block.id,
        blockType: 'reading',
        label: 'Reading',
        primaryTitle: title,
        bodyText: details,
      };
    }

    case 'lecture_note': {
      const title = (meta.title || safeContent || '').trim();
      const checkpoints: any[] = Array.isArray(meta.checkpoints) ? meta.checkpoints : [];
      const cpText = checkpoints.map((c) => c?.note || '').filter(Boolean).join(' • ');
      const details = [meta.speaker, meta.summary, cpText].filter(Boolean).join(' ');
      return {
        blockId: block.id,
        blockType: 'lecture_note',
        label: 'Lecture',
        primaryTitle: title,
        bodyText: details,
      };
    }

    case 'message_thread': {
      const subject = (meta.subject || safeContent || '').trim();
      const messages: any[] = Array.isArray(meta.messages) ? meta.messages : [];
      const msgText = messages
        .map((m) => [m?.sender, m?.content].filter(Boolean).join(': '))
        .filter(Boolean)
        .join(' • ');
      return {
        blockId: block.id,
        blockType: 'message_thread',
        label: 'Thread',
        primaryTitle: subject,
        bodyText: [meta.channel, msgText].filter(Boolean).join(' '),
      };
    }

    case 'meeting_notes': {
      const title = (meta.title || safeContent || '').trim();
      const decisions = Array.isArray(meta.decisions) ? meta.decisions.join(' ') : '';
      const actions = Array.isArray(meta.actionItems)
        ? meta.actionItems.map((a: any) => [a?.assignee, a?.text].filter(Boolean).join(' ')).join(' ')
        : '';
      const transcript = Array.isArray(meta.transcript)
        ? meta.transcript.map((t: any) => [t?.speaker, t?.text].filter(Boolean).join(' ')).join(' ')
        : '';
      const attendees = Array.isArray(meta.attendees) ? meta.attendees.join(' ') : '';
      return {
        blockId: block.id,
        blockType: 'meeting_notes',
        label: 'Meeting',
        primaryTitle: title,
        bodyText: [meta.summary, attendees, decisions, actions, transcript].filter(Boolean).join(' '),
      };
    }

    case 'sheet': {
      const title = (meta.title || safeContent || '').trim();
      const tabs: any[] = Array.isArray(meta.tabs) ? meta.tabs : [];
      const sheetCells = tabs
        .flatMap((t) => [
          t?.name || '',
          ...(Array.isArray(t?.columns) ? t.columns.map((c: any) => c?.name || '') : []),
          ...(Array.isArray(t?.rows) ? t.rows.flat().map((v: any) => String(v ?? '')) : []),
        ])
        .filter(Boolean)
        .join(' ');
      return {
        blockId: block.id,
        blockType: 'sheet',
        label: 'Spreadsheet',
        primaryTitle: title,
        bodyText: sheetCells,
      };
    }

    case 'diagram': {
      const title = (meta.title || safeContent || '').trim();
      const code = (meta.code || '').trim();
      return {
        blockId: block.id,
        blockType: 'diagram',
        label: 'Diagram',
        primaryTitle: title,
        bodyText: code,
      };
    }

    case 'web_clip': {
      const title = (meta.title || safeContent || '').trim();
      const highlights = Array.isArray(meta.highlights) ? meta.highlights.join(' ') : '';
      return {
        blockId: block.id,
        blockType: 'web_clip',
        label: 'Web Clip',
        primaryTitle: title,
        bodyText: [meta.domain, meta.author, highlights, meta.summary].filter(Boolean).join(' '),
      };
    }

    case 'bookmark': {
      const title = (meta.title || '').trim();
      const desc = (meta.description || '').trim();
      return {
        blockId: block.id,
        blockType: 'bookmark',
        label: 'Bookmark',
        primaryTitle: title,
        bodyText: desc,
      };
    }

    case 'location': {
      const placeName = (meta.placeName || safeContent || '').trim();
      const address = (meta.address || '').trim();
      return {
        blockId: block.id,
        blockType: 'location',
        label: 'Location',
        primaryTitle: placeName,
        bodyText: address,
      };
    }

    case 'note_link': {
      const targetTitle = (meta.targetNoteTitle || safeContent || '').trim();
      return {
        blockId: block.id,
        blockType: 'note_link',
        label: 'Linked Note',
        primaryTitle: targetTitle,
        bodyText: (meta.targetFolder || '').trim(),
      };
    }

    default: {
      if (!safeContent) return null;
      return {
        blockId: block.id,
        blockType: block.type,
        label: 'Note',
        primaryTitle: '',
        bodyText: safeContent,
      };
    }
  }
}

/**
 * Generates a clean, human-readable 2-line preview for Home screen Note Cards.
 * Never leaks `<!-- scribex:block ... -->` HTML comments or base64 data URIs.
 */
export function formatCleanNotePreview(note: Pick<NoteItem, 'blocks' | 'contentMarkdown'>): string {
  const blocks = Array.isArray(note.blocks) ? note.blocks : [];

  if (blocks.length > 0) {
    const previewLines: string[] = [];

    for (const block of blocks) {
      if (previewLines.length >= 2) break;
      const entry = extractBlockIndexEntry(block);
      if (!entry) continue;

      if (
        block.type === 'paragraph' ||
        block.type === 'heading' ||
        block.type === 'quote' ||
        block.type === 'callout'
      ) {
        const text = (entry.primaryTitle || entry.bodyText).trim();
        if (text) previewLines.push(text);
      } else if (block.type === 'checklist' || block.type === 'bulleted_list' || block.type === 'numbered_list') {
        if (entry.bodyText) previewLines.push(entry.bodyText);
      } else {
        // Structured or Media block summary line
        const summary = entry.primaryTitle || entry.bodyText;
        if (summary) {
          previewLines.push(`${entry.label}: ${summary}`);
        } else {
          previewLines.push(`${entry.label} attached`);
        }
      }
    }

    if (previewLines.length > 0) {
      return previewLines.join('\n').slice(0, 180);
    }
  }

  // Fallback to cleaned contentMarkdown if blocks array wasn't populated
  const cleanedMd = stripInternalMarkup(note.contentMarkdown || '');
  return cleanedMd ? cleanedMd.slice(0, 180) : 'Empty note';
}

/**
 * Builds the complete, save-time `NoteSearchDocument` for a `NoteItem`.
 */
export function buildNoteSearchDocument(note: NoteItem): NoteSearchDocument {
  const titleLower = (note.title || '').trim().toLowerCase();
  const folderLower = (note.folderPath || 'General').trim().toLowerCase();
  const tagsLower = (note.tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean);

  const blockEntries: IndexedBlockEntry[] = [];
  const presentTypesSet = new Set<BlockType>();

  const blocks = Array.isArray(note.blocks) ? note.blocks : [];
  for (const block of blocks) {
    if (!block || !block.type) continue;
    presentTypesSet.add(block.type);
    const entry = extractBlockIndexEntry(block);
    if (entry && (entry.primaryTitle || entry.bodyText)) {
      blockEntries.push(entry);
    }
  }

  const blockTitlesLower = blockEntries
    .map((e) => e.primaryTitle.toLowerCase())
    .filter(Boolean)
    .join(' ');

  const bodyTextLower = blockEntries
    .map((e) => e.bodyText.toLowerCase())
    .filter(Boolean)
    .join(' ');

  const combinedSearchText = [
    titleLower,
    folderLower,
    tagsLower.join(' '),
    blockTitlesLower,
    bodyTextLower,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanPreviewText = formatCleanNotePreview(note);

  return {
    noteId: note.id,
    updatedAt: note.updatedAt || '',
    titleLower,
    folderLower,
    tagsLower,
    blockTitlesLower,
    bodyTextLower,
    combinedSearchText,
    blockEntries,
    presentBlockTypes: Array.from(presentTypesSet),
    cleanPreviewText,
  };
}

