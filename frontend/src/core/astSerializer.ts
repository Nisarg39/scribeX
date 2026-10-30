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
          durationSec: durMatch ? parseInt(durMatch[1], 10) : 0,
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

    // Note Link: [[Title|targetId]] <!-- scribex:block type=note_link folder="General" color="cyan" -->
    const noteLinkMatch = line.trim().match(/^\[\[(.*?)(?:\|(.*?))?\]\]\s*<!--\s*scribex:block\s+type=note_link\s*([^>]*)-->/);
    if (noteLinkMatch) {
      flushParagraph();
      const title = noteLinkMatch[1];
      const targetId = noteLinkMatch[2] || '';
      const metaStr = noteLinkMatch[3];
      const folderMatch = metaStr.match(/folder="([^"]*)"/);
      const colorMatch = metaStr.match(/color="([^"]*)"/);
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'note_link',
        content: targetId,
        metadata: {
          targetNoteId: targetId,
          targetNoteTitle: title,
          targetFolder: folderMatch ? folderMatch[1] : 'General',
          targetColorToken: colorMatch ? colorMatch[1] : 'cyan',
        },
      });
      continue;
    }

    // Location: 📍 [Place](url) <!-- scribex:block type=location address="..." lat=... lng=... -->
    const locMatch = line.trim().match(/^📍\s*\[(.*?)\]\((.*?)\)\s*<!--\s*scribex:block\s+type=location\s*([^>]*)-->/);
    if (locMatch) {
      flushParagraph();
      const placeName = locMatch[1];
      const metaStr = locMatch[3];
      const addrMatch = metaStr.match(/address="([^"]*)"/);
      const latMatch = metaStr.match(/lat=([^\s]+)/);
      const lngMatch = metaStr.match(/lng=([^\s]+)/);
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'location',
        content: placeName,
        metadata: {
          placeName,
          address: addrMatch ? addrMatch[1] : '',
          lat: latMatch ? parseFloat(latMatch[1]) : undefined,
          lng: lngMatch ? parseFloat(lngMatch[1]) : undefined,
        },
      });
      continue;
    }

    // Habit Tracker: <!-- scribex:block type=habit title="..." frequency="..." streak=... targetDays=... history="..." -->
    const habitMatch = line.trim().match(/^<!--\s*scribex:block\s+type=habit\s+([^>]+)-->/);
    if (habitMatch) {
      flushParagraph();
      const metaStr = habitMatch[1];
      const titleMatch = metaStr.match(/title="([^"]*)"/);
      const freqMatch = metaStr.match(/frequency="([^"]*)"/);
      const streakMatch = metaStr.match(/streak=(\d+)/);
      const targetMatch = metaStr.match(/targetDays=(\d+)/);
      const histMatch = metaStr.match(/history=(['"])(.*?)\1/);
      let history: Record<string, boolean> = {};
      try {
        if (histMatch) history = JSON.parse(histMatch[2]);
      } catch (_) {}

      const habitTitle = titleMatch ? titleMatch[1] : 'Habit Tracker';
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'habit',
        content: habitTitle,
        metadata: {
          title: habitTitle,
          frequency: (freqMatch ? freqMatch[1] : 'daily') as any,
          streak: streakMatch ? parseInt(streakMatch[1], 10) : 0,
          targetDays: targetMatch ? parseInt(targetMatch[1], 10) : 7,
          history,
        },
      });
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith('**Habit:')) {
        i++;
      }
      continue;
    }

    // In-Note Kanban Board: <!-- scribex:block type=kanban data='...' -->
    const kanbanMatch = line.trim().match(/^<!--\s*scribex:block\s+type=kanban\s+data=(['"])(.*?)\1\s*-->/);
    if (kanbanMatch) {
      flushParagraph();
      let kanbanData: any = null;
      try {
        kanbanData = JSON.parse(kanbanMatch[2]);
      } catch (_) {}

      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'kanban',
        content: 'Kanban Board',
        metadata: kanbanData || {
          columns: [
            { id: 'todo', title: 'To Do', color: '#38BDF8', cardIds: [] },
            { id: 'in_progress', title: 'In Progress', color: '#F59E0B', cardIds: [] },
            { id: 'done', title: 'Done', color: '#10B981', cardIds: [] },
          ],
          cards: {},
        },
      });
      while (i + 1 < lines.length && (lines[i + 1].trim().startsWith('### Kanban Board') || lines[i + 1].trim().startsWith('- **') || (lines[i + 1].trim() === '' && i + 2 < lines.length && lines[i + 2].trim().startsWith('- **')))) {
        i++;
      }
      continue;
    }

    // Date & Event Block: <!-- scribex:block type=event data='...' -->
    const eventMatch = line.trim().match(/^<!--\s*scribex:block\s+type=event\s+data=(['"])(.*?)\1\s*-->/);
    if (eventMatch) {
      flushParagraph();
      let eventData: any = null;
      try {
        eventData = JSON.parse(eventMatch[2]);
      } catch (_) {}
      const eventTitle = eventData?.title || 'Event / Meeting';
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'event',
        content: eventTitle,
        metadata: eventData || { title: eventTitle },
      });
      if (i + 1 < lines.length && (lines[i + 1].trim().startsWith('📅 **Event:') || lines[i + 1].trim().startsWith('**Event:'))) {
        i++;
      }
      continue;
    }

    // Contact Profile Block: <!-- scribex:block type=contact data='...' -->
    const contactMatch = line.trim().match(/^<!--\s*scribex:block\s+type=contact\s+data=(['"])(.*?)\1\s*-->/);
    if (contactMatch) {
      flushParagraph();
      let contactData: any = null;
      try {
        contactData = JSON.parse(contactMatch[2]);
      } catch (_) {}
      const contactName = contactData?.name || 'Contact';
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'contact',
        content: contactName,
        metadata: contactData || { name: contactName },
      });
      if (i + 1 < lines.length && (lines[i + 1].trim().startsWith('👤 **Contact:') || lines[i + 1].trim().startsWith('**Contact:'))) {
        i++;
      }
      continue;
    }

    // Expense / Receipt Block: <!-- scribex:block type=expense data='...' -->
    const expenseMatch = line.trim().match(/^<!--\s*scribex:block\s+type=expense\s+data=(['"])(.*?)\1\s*-->/);
    if (expenseMatch) {
      flushParagraph();
      let expenseData: any = null;
      try {
        expenseData = JSON.parse(expenseMatch[2]);
      } catch (_) {}
      const merchant = expenseData?.merchant || 'Expense';
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'expense',
        content: merchant,
        metadata: expenseData || { merchant },
      });
      if (i + 1 < lines.length && (lines[i + 1].trim().startsWith('💳 **Expense:') || lines[i + 1].trim().startsWith('**Expense:'))) {
        i++;
      }
      continue;
    }

    // Reading List Item Block: <!-- scribex:block type=reading data='...' -->
    const readingMatch = line.trim().match(/^<!--\s*scribex:block\s+type=reading\s+data=(['"])(.*?)\1\s*-->/);
    if (readingMatch) {
      flushParagraph();
      let readingData: any = null;
      try {
        readingData = JSON.parse(readingMatch[2]);
      } catch (_) {}
      const bookTitle = readingData?.title || 'Reading Item';
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'reading',
        content: bookTitle,
        metadata: readingData || { title: bookTitle },
      });
      if (i + 1 < lines.length && (lines[i + 1].trim().startsWith('📖 **Reading:') || lines[i + 1].trim().startsWith('**Reading:'))) {
        i++;
      }
      continue;
    }

    // Video / Lecture Note Block: <!-- scribex:block type=lecture_note data='...' -->
    const lectureMatch = line.trim().match(/^<!--\s*scribex:block\s+type=lecture_note\s+data=(['"])(.*?)\1\s*-->/);
    if (lectureMatch) {
      flushParagraph();
      let lectureData: any = null;
      try {
        lectureData = JSON.parse(lectureMatch[2]);
      } catch (_) {}
      const lectureTitle = lectureData?.title || 'Lecture Note';
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'lecture_note',
        content: lectureTitle,
        metadata: lectureData || { title: lectureTitle },
      });
      while (i + 1 < lines.length && (
        lines[i + 1].trim().startsWith('🎬 **Lecture:') ||
        lines[i + 1].trim().startsWith('**Lecture:') ||
        lines[i + 1].trim().startsWith('- [')
      )) {
        i++;
      }
      continue;
    }

    // Email & Message Thread Block: <!-- scribex:block type=message_thread data='...' -->
    const threadMatch = line.trim().match(/^<!--\s*scribex:block\s+type=message_thread\s+data=(['"])(.*?)\1\s*-->/);
    if (threadMatch) {
      flushParagraph();
      let threadData: any = null;
      try {
        threadData = JSON.parse(threadMatch[2]);
      } catch (_) {}
      const threadSubject = threadData?.subject || 'Message Thread';
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'message_thread',
        content: threadSubject,
        metadata: threadData || { subject: threadSubject },
      });
      while (i + 1 < lines.length && (
        lines[i + 1].trim().startsWith('💬 **Thread:') ||
        lines[i + 1].trim().startsWith('**Thread:') ||
        lines[i + 1].trim().startsWith('- **')
      )) {
        i++;
      }
      continue;
    }

    // Meeting Notes Block: <!-- scribex:block type=meeting_notes data='...' -->
    const meetingMatch = line.trim().match(/^<!--\s*scribex:block\s+type=meeting_notes\s+data=(['"])(.*?)\1\s*-->/);
    if (meetingMatch) {
      flushParagraph();
      let meetingData: any = null;
      try {
        meetingData = JSON.parse(meetingMatch[2]);
      } catch (_) {}
      const meetingTitle = meetingData?.title || 'Meeting Minutes';
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'meeting_notes',
        content: meetingTitle,
        metadata: meetingData || { title: meetingTitle },
      });
      while (i + 1 < lines.length && (
        lines[i + 1].trim().startsWith('👥 **Meeting:') ||
        lines[i + 1].trim().startsWith('**Meeting:') ||
        lines[i + 1].trim().startsWith('- [') ||
        lines[i + 1].trim().startsWith('- **') ||
        lines[i + 1].trim().startsWith('>')
      )) {
        i++;
      }
      continue;
    }

    // Spreadsheet Block: <!-- scribex:block type=sheet data='...' -->
    const sheetMatch = line.trim().match(/^<!--\s*scribex:block\s+type=sheet\s+data=(['"])(.*?)\1\s*-->/);
    if (sheetMatch) {
      flushParagraph();
      let sheetData: any = null;
      try {
        sheetData = JSON.parse(sheetMatch[2]);
      } catch (_) {}
      const sheetTitle = sheetData?.title || 'Spreadsheet';
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'sheet',
        content: sheetTitle,
        metadata: sheetData || { title: sheetTitle },
      });
      while (i + 1 < lines.length && (
        lines[i + 1].trim().startsWith('📊 **Sheet:') ||
        lines[i + 1].trim().startsWith('**Sheet:') ||
        lines[i + 1].trim().startsWith('|')
      )) {
        i++;
      }
      continue;
    }

    // Diagram & Whiteboard Block: <!-- scribex:block type=diagram data='...' -->
    const diagramMatch = line.trim().match(/^<!--\s*scribex:block\s+type=diagram\s+data=(['"])(.*?)\1\s*-->/);
    if (diagramMatch) {
      flushParagraph();
      let diagramData: any = null;
      try {
        diagramData = JSON.parse(diagramMatch[2]);
      } catch (_) {}
      const diagramTitle = diagramData?.title || 'Diagram';
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'diagram',
        content: diagramTitle,
        metadata: diagramData || { title: diagramTitle },
      });
      // Skip fallback diagram title
      if (i + 1 < lines.length && (lines[i + 1].trim().startsWith('📐 **Diagram:') || lines[i + 1].trim().startsWith('**Diagram:'))) {
        i++;
      }
      // Skip fallback mermaid code fence
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith('```mermaid')) {
        i++;
        while (i + 1 < lines.length && !lines[i + 1].trim().startsWith('```')) {
          i++;
        }
        if (i + 1 < lines.length && lines[i + 1].trim().startsWith('```')) {
          i++;
        }
      }
      continue;
    }

    // Web Clipping & Reader Mode Block: <!-- scribex:block type=web_clip data='...' -->
    const webClipMatch = line.trim().match(/^<!--\s*scribex:block\s+type=web_clip\s+data=(['"])(.*?)\1\s*-->/);
    if (webClipMatch) {
      flushParagraph();
      let clipData: any = null;
      try {
        clipData = JSON.parse(webClipMatch[2]);
      } catch (_) {}
      const clipTitle = clipData?.title || 'Web Clip';
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'web_clip',
        content: clipTitle,
        metadata: clipData || { title: clipTitle },
      });
      while (i + 1 < lines.length && (
        lines[i + 1].trim().startsWith('🌐 **Article:') ||
        lines[i + 1].trim().startsWith('**Article:') ||
        lines[i + 1].trim().startsWith('> ') ||
        lines[i + 1].trim().startsWith('- ')
      )) {
        i++;
      }
      continue;
    }

    // Voice-to-Text Dictation Block: <!-- scribex:block type=voice_dictation data='...' -->
    const dictationMatch = line.trim().match(/^<!--\s*scribex:block\s+type=voice_dictation\s+data=(['"])(.*?)\1\s*-->/);
    if (dictationMatch) {
      flushParagraph();
      let dictationData: any = null;
      try {
        dictationData = JSON.parse(dictationMatch[2]);
      } catch (_) {}
      const transcript = dictationData?.transcript || 'Voice Dictation';
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'voice_dictation',
        content: transcript,
        metadata: dictationData || { transcript },
      });
      while (i + 1 < lines.length && (
        lines[i + 1].trim().startsWith('🎙️ **Dictation') ||
        lines[i + 1].trim().startsWith('**Dictation') ||
        lines[i + 1].trim().startsWith('>')
      )) {
        i++;
      }
      continue;
    }

    // Annotated Video: ![Caption](url) <!-- scribex:media type=video width=100% align=center -->
    const videoMatch = line.trim().match(/^!\[(.*?)\]\((.*?)\)\s*<!--\s*scribex:media\s+type=video\s*([^>]*)-->/);
    if (videoMatch) {
      flushParagraph();
      const metaStr = videoMatch[3];
      const widthMatch = metaStr.match(/width=([^\s]+)/);
      const alignMatch = metaStr.match(/align=([^\s]+)/);
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'video',
        content: videoMatch[2],
        metadata: {
          caption: videoMatch[1],
          width: widthMatch ? widthMatch[1] : '100%',
          align: alignMatch ? alignMatch[1] : 'center',
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
    const checkMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (checkMatch) {
      flushParagraph();
      const leadingSpaces = checkMatch[1].length;
      let indent = Math.min(2, Math.floor(leadingSpaces / 2));
      const isChecked = checkMatch[2].toLowerCase() === 'x';
      let rawText = checkMatch[3].trim();
      let taskId = `task-${Date.now()}-${blocks.length + 1}`;
      let priority = 'none';
      let dueDate = 'Today';
      let style: any = 'paragraph';

      const taskCommentMatch = rawText.match(/<!--\s*scribex:task\s+([^>]+)-->/);
      if (taskCommentMatch) {
        const metaStr = taskCommentMatch[1];
        const idMatch = metaStr.match(/id=([^\s]+)/);
        const prioMatch = metaStr.match(/priority=([^\s]+)/);
        const dueMatch = metaStr.match(/due=([^\s]+)/);
        const styleMatch = metaStr.match(/style=([^\s]+)/);
        const indentMatch = metaStr.match(/indent=(\d+)/);

        if (idMatch) taskId = idMatch[1];
        if (prioMatch) priority = prioMatch[1];
        if (dueMatch) dueDate = dueMatch[1];
        if (indentMatch) indent = parseInt(indentMatch[1], 10);
        if (styleMatch && ['paragraph', 'h1', 'h2', 'quote'].includes(styleMatch[1])) {
          style = styleMatch[1];
        }
        rawText = rawText.replace(/<!--\s*scribex:task.*?-->/, '').trim();
      }

      if (style === 'paragraph') {
        if (rawText.startsWith('# ')) {
          style = 'h1';
          rawText = rawText.slice(2).trim();
        } else if (rawText.startsWith('## ')) {
          style = 'h2';
          rawText = rawText.slice(3).trim();
        } else if (rawText.startsWith('> ')) {
          style = 'quote';
          rawText = rawText.slice(2).trim();
        }
      }

      const newItem: ChecklistPoint = {
        id: taskId,
        text: rawText,
        checked: isChecked,
        indent: Math.max(0, Math.min(2, indent)),
        priority: priority as any,
        dueDate,
        style,
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

    // 9. Collapsible Toggle (<details><summary>Title</summary>Content</details>)
    if (line.trim().startsWith('<details>')) {
      flushParagraph();
      let summaryTitle = 'Toggle';
      const contentLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim().includes('</details>')) {
        const cur = lines[j];
        const summaryMatch = cur.match(/<summary>(.*?)<\/summary>/i);
        if (summaryMatch) {
          summaryTitle = summaryMatch[1].trim();
        } else {
          contentLines.push(cur);
        }
        j++;
      }
      i = j;
      blocks.push({
        id: `b-${Date.now()}-${blocks.length + 1}`,
        type: 'toggle',
        content: contentLines.join('\n').trim(),
        metadata: { title: summaryTitle, isOpen: false },
      });
      continue;
    }

    // 10. Bulleted List (- item or * item)
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch && !line.match(/^(\*{3,}|-{3,})$/)) {
      flushParagraph();
      const itemText = bulletMatch[1].trim();
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.type === 'bulleted_list') {
        const existingItems = Array.isArray(lastBlock.metadata?.items) ? lastBlock.metadata.items : [];
        lastBlock.metadata = { ...lastBlock.metadata, items: [...existingItems, itemText] };
        lastBlock.content = lastBlock.metadata.items.join('\n');
      } else {
        blocks.push({
          id: `b-${Date.now()}-${blocks.length + 1}`,
          type: 'bulleted_list',
          content: itemText,
          metadata: {
            items: [itemText],
          },
        });
      }
      continue;
    }

    // 11. Numbered List (1. item or 1) item)
    const numberedMatch = line.match(/^(\d+)[\.\)]\s+(.+)$/);
    if (numberedMatch) {
      flushParagraph();
      const itemText = numberedMatch[2].trim();
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.type === 'numbered_list') {
        const existingItems = Array.isArray(lastBlock.metadata?.items) ? lastBlock.metadata.items : [];
        lastBlock.metadata = { ...lastBlock.metadata, items: [...existingItems, itemText] };
        lastBlock.content = lastBlock.metadata.items.map((it: string, idx: number) => `${idx + 1}. ${it}`).join('\n');
      } else {
        blocks.push({
          id: `b-${Date.now()}-${blocks.length + 1}`,
          type: 'numbered_list',
          content: `1. ${itemText}`,
          metadata: {
            items: [itemText],
          },
        });
      }
      continue;
    }

    // 12. Standard Blockquote (> Text)
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
          : (block.content ? [{ id: block.metadata?.taskId || block.id, text: block.content, checked: !!block.metadata?.checked, indent: block.metadata?.indent || 0, priority: block.metadata?.priority || 'none', dueDate: block.metadata?.dueDate || 'Today' }] : []);
        
        const lines = items.map((item) => {
          const checked = item.checked ? 'x' : ' ';
          const taskId = item.id || `task-${Date.now()}`;
          const priority = item.priority && item.priority !== 'none' ? ` priority=${item.priority}` : '';
          const due = item.dueDate ? ` due=${item.dueDate}` : '';
          const style = item.style && item.style !== 'paragraph' ? ` style=${item.style}` : '';
          const indent = Math.max(0, Math.min(2, item.indent || 0));
          const indentPrefix = '  '.repeat(indent);
          const indentAttr = indent > 0 ? ` indent=${indent}` : '';
          return `${indentPrefix}- [${checked}] ${item.text.trim()} <!-- scribex:task id=${taskId}${style}${priority}${due}${indentAttr} -->`;
        });
        chunks.push(lines.join('\n'));
        break;
      }

      case 'habit': {
        const title = (block.metadata?.title || block.content || 'Habit').replace(/"/g, "'");
        const freq = block.metadata?.frequency || 'daily';
        const streak = block.metadata?.streak ?? 0;
        const target = block.metadata?.targetDays ?? 7;
        const histJson = JSON.stringify(block.metadata?.history || {}).replace(/'/g, "\\'");
        chunks.push(`<!-- scribex:block type=habit title="${title}" frequency="${freq}" streak=${streak} targetDays=${target} history='${histJson}' -->\n**Habit: ${title}** (${freq} • 🔥 ${streak} days)`);
        break;
      }

      case 'kanban': {
        const data = block.metadata || {
          columns: [
            { id: 'todo', title: 'To Do', color: '#38BDF8', cardIds: [] },
            { id: 'in_progress', title: 'In Progress', color: '#F59E0B', cardIds: [] },
            { id: 'done', title: 'Done', color: '#10B981', cardIds: [] },
          ],
          cards: {},
        };
        const dataJson = JSON.stringify(data).replace(/'/g, "\\'");
        const summaryLines: string[] = ['### Kanban Board'];
        if (Array.isArray(data.columns)) {
          for (const col of data.columns) {
            const cardTitles = (col.cardIds || []).map((id: string) => data.cards?.[id]?.title).filter(Boolean);
            summaryLines.push(`- **${col.title}**: ${cardTitles.join(', ') || '(empty)'}`);
          }
        }
        chunks.push(`<!-- scribex:block type=kanban data='${dataJson}' -->\n${summaryLines.join('\n')}`);
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
        const dur = block.metadata?.durationSec ?? 0;
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

      case 'bulleted_list': {
        const rawItems: any[] = Array.isArray(block.metadata?.items) && block.metadata.items.length > 0
          ? block.metadata.items
          : (block.content ? block.content.split('\n') : []);
        const items = rawItems.map(it => typeof it === 'string' ? it.replace(/^[-*•]\s*/, '') : it.text || '');
        chunks.push(items.filter(Boolean).map(it => `- ${it.trim()}`).join('\n'));
        break;
      }

      case 'numbered_list': {
        const rawItems: any[] = Array.isArray(block.metadata?.items) && block.metadata.items.length > 0
          ? block.metadata.items
          : (block.content ? block.content.split('\n') : []);
        const items = rawItems.map(it => typeof it === 'string' ? it.replace(/^\d+[\.\)]\s*/, '') : it.text || '');
        chunks.push(items.filter(Boolean).map((it, idx) => `${idx + 1}. ${it.trim()}`).join('\n'));
        break;
      }

      case 'toggle': {
        const toggleTitle = block.metadata?.title || 'Details';
        chunks.push(`<details>\n<summary>${toggleTitle}</summary>\n${block.content || ''}\n</details>`);
        break;
      }

      case 'video': {
        const url = block.content || block.metadata?.url || '';
        const caption = block.metadata?.caption || '';
        const width = block.metadata?.width || '100%';
        const align = block.metadata?.align || 'center';
        chunks.push(`![${caption}](${url}) <!-- scribex:media type=video width=${width} align=${align} -->`);
        break;
      }

      case 'note_link': {
        const targetId = block.metadata?.targetNoteId || block.content || '';
        const title = block.metadata?.targetNoteTitle || 'Untitled Note';
        const folder = block.metadata?.targetFolder || 'General';
        const color = block.metadata?.targetColorToken || 'cyan';
        chunks.push(`[[${title}|${targetId}]] <!-- scribex:block type=note_link folder="${folder}" color="${color}" -->`);
        break;
      }

      case 'location': {
        const place = block.metadata?.placeName || block.content || 'Location Checkpoint';
        const address = (block.metadata?.address || '').replace(/"/g, "'");
        const lat = block.metadata?.lat ?? 37.7785;
        const lng = block.metadata?.lng ?? -122.3998;
        chunks.push(`📍 [${place}](geo:${lat},${lng}) <!-- scribex:block type=location address="${address}" lat=${lat} lng=${lng} -->`);
        break;
      }

      case 'event': {
        const data = block.metadata || { title: block.content || 'Event' };
        const dataJson = JSON.stringify(data).replace(/'/g, "\\'");
        const title = data.title || block.content || 'Event';
        const dateStr = data.startDate ? `${data.startDate}${data.startTime ? ' ' + data.startTime : ''}` : '';
        const locStr = data.location ? ` @ ${data.location}` : '';
        chunks.push(`<!-- scribex:block type=event data='${dataJson}' -->\n📅 **Event: ${title}** (${dateStr}${locStr})`);
        break;
      }

      case 'contact': {
        const data = block.metadata || { name: block.content || 'Contact' };
        const dataJson = JSON.stringify(data).replace(/'/g, "\\'");
        const name = data.name || block.content || 'Contact';
        const roleStr = data.role ? `${data.role}${data.company ? ' @ ' + data.company : ''}` : data.company || '';
        const emailStr = data.email ? ` • ${data.email}` : '';
        chunks.push(`<!-- scribex:block type=contact data='${dataJson}' -->\n👤 **Contact: ${name}** (${roleStr}${emailStr})`);
        break;
      }

      case 'expense': {
        const data = block.metadata || { merchant: block.content || 'Expense' };
        const dataJson = JSON.stringify(data).replace(/'/g, "\\'");
        const merchant = data.merchant || block.content || 'Expense';
        const amtStr = `${data.currency || '$'}${data.amount || '0.00'}`;
        const catStr = data.category ? ` • ${data.category}` : '';
        chunks.push(`<!-- scribex:block type=expense data='${dataJson}' -->\n💳 **Expense: ${merchant}** (${amtStr}${catStr})`);
        break;
      }

      case 'reading': {
        const data = block.metadata || { title: block.content || 'Reading Item' };
        const dataJson = JSON.stringify(data).replace(/'/g, "\\'");
        const title = data.title || block.content || 'Book';
        const authorStr = data.author ? ` by ${data.author}` : '';
        const progressStr = data.currentPage && data.totalPages ? ` • ${data.currentPage}/${data.totalPages} pages` : '';
        chunks.push(`<!-- scribex:block type=reading data='${dataJson}' -->\n📖 **Reading: ${title}**${authorStr} (${data.status || 'reading'}${progressStr})`);
        break;
      }

      case 'lecture_note': {
        const data = block.metadata || { title: block.content || 'Lecture Note' };
        const dataJson = JSON.stringify(data).replace(/'/g, "\\'");
        const title = data.title || block.content || 'Lecture Note';
        const speakerStr = data.speaker ? ` (${data.speaker})` : '';
        const checkpoints = Array.isArray(data.checkpoints) ? data.checkpoints : [];
        const cpLines = checkpoints.map((c: any) => `- [${c.timestamp || '00:00'}] ${c.note || ''}`);
        const summary = [`🎬 **Lecture: ${title}**${speakerStr}`, ...cpLines].join('\n');
        chunks.push(`<!-- scribex:block type=lecture_note data='${dataJson}' -->\n${summary}`);
        break;
      }

      case 'message_thread': {
        const data = block.metadata || { subject: block.content || 'Message Thread' };
        const dataJson = JSON.stringify(data).replace(/'/g, "\\'");
        const subject = data.subject || block.content || 'Message Thread';
        const channelStr = data.channel ? ` (${data.channel})` : '';
        const messages = Array.isArray(data.messages) ? data.messages : [];
        const msgLines = messages.map((m: any) => `- **${m.sender || 'User'}** (${m.timestamp || ''}): ${m.content || ''}`);
        const summary = [`💬 **Thread: ${subject}**${channelStr}`, ...msgLines].join('\n');
        chunks.push(`<!-- scribex:block type=message_thread data='${dataJson}' -->\n${summary}`);
        break;
      }

      case 'meeting_notes': {
        const data = block.metadata || { title: block.content || 'Meeting Minutes' };
        const dataJson = JSON.stringify(data).replace(/'/g, "\\'");
        const title = data.title || block.content || 'Meeting Minutes';
        const dateStr = data.date ? ` (${data.date})` : '';
        const summary = data.summary ? `> ${data.summary}` : '';
        const decisions = Array.isArray(data.decisions) ? data.decisions.map((d: string) => `- [x] Decision: ${d}`) : [];
        const actions = Array.isArray(data.actionItems) ? data.actionItems.map((a: any) => `- [${a.checked ? 'x' : ' '}] @${a.assignee}: ${a.text}`) : [];
        const transcript = Array.isArray(data.transcript) ? data.transcript.map((t: any) => `- **${t.speaker}** (${t.timestamp}): ${t.text}`) : [];
        const lines = [
          `👥 **Meeting: ${title}**${dateStr}`,
          summary,
          ...decisions,
          ...actions,
          ...transcript,
        ].filter(Boolean);
        chunks.push(`<!-- scribex:block type=meeting_notes data='${dataJson}' -->\n${lines.join('\n')}`);
        break;
      }

      case 'sheet': {
        const data = block.metadata || { title: block.content || 'Spreadsheet' };
        const dataJson = JSON.stringify(data).replace(/'/g, "\\'");
        const title = data.title || block.content || 'Spreadsheet';
        const activeTab = Array.isArray(data.tabs) ? data.tabs.find((t: any) => t.id === data.activeTabId) || data.tabs[0] : null;
        const summaryLines = [`📊 **Sheet: ${title}**`];
        if (activeTab && Array.isArray(activeTab.columns) && Array.isArray(activeTab.rows)) {
          const header = `| ${activeTab.columns.map((c: any) => c.name).join(' | ')} |`;
          const sep = `| ${activeTab.columns.map(() => '---').join(' | ')} |`;
          const rows = activeTab.rows.slice(0, 5).map((r: any[]) => `| ${r.join(' | ')} |`);
          summaryLines.push(header, sep, ...rows);
        }
        chunks.push(`<!-- scribex:block type=sheet data='${dataJson}' -->\n${summaryLines.join('\n')}`);
        break;
      }

      case 'diagram': {
        const data = block.metadata || { title: block.content || 'Diagram' };
        const dataJson = JSON.stringify(data).replace(/'/g, "\\'");
        const title = data.title || block.content || 'Diagram';
        const code = data.code || 'flowchart TD\n  A --> B';
        chunks.push(`<!-- scribex:block type=diagram data='${dataJson}' -->\n📐 **Diagram: ${title}**\n\`\`\`mermaid\n${code}\n\`\`\``);
        break;
      }

      case 'web_clip': {
        const data = block.metadata || { title: block.content || 'Web Article Clip' };
        const dataJson = JSON.stringify(data).replace(/'/g, "\\'");
        const title = data.title || block.content || 'Web Article Clip';
        const domainStr = data.domain ? ` (${data.domain})` : '';
        const bylineStr = data.author ? ` by ${data.author}` : '';
        const quotes = Array.isArray(data.highlights) ? data.highlights.map((h: string) => `> "${h}"`) : [];
        const lines = [
          `🌐 **Article: ${title}**${domainStr}${bylineStr}`,
          ...quotes,
        ].filter(Boolean);
        chunks.push(`<!-- scribex:block type=web_clip data='${dataJson}' -->\n${lines.join('\n')}`);
        break;
      }

      case 'voice_dictation': {
        const data = block.metadata || { transcript: block.content || '' };
        const dataJson = JSON.stringify(data).replace(/'/g, "\\'");
        const transcript = data.transcript || block.content || '';
        const dur = data.durationSec ? ` (${data.durationSec}s)` : '';
        chunks.push(`<!-- scribex:block type=voice_dictation data='${dataJson}' -->\n🎙️ **Dictation${dur}:**\n> ${transcript}`);
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
