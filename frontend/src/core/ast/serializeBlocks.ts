/**
 * ScribeX ComposableBlock[] to Extended Markdown (.md) Serializer
 */

import { ComposableBlock, ChecklistPoint } from "../../types/note";

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
        const rawCaption = (block.metadata?.caption || '').replace(/"/g, "'");
        const label = (rawCaption || block.metadata?.title || 'Sketch').replace(/\]/g, '');
        const captionAttr = rawCaption ? ` caption="${rawCaption}"` : '';
        chunks.push(`![${label}](${url}) <!-- scribex:block type=drawing${captionAttr} -->`);
        break;
      }

      case 'audio': {
        const url = block.content || '';
        const label = (block.metadata?.caption || block.metadata?.title || 'Audio').replace(/\]/g, '');
        const dur = block.metadata?.durationSec ?? 0;
        const trans = (block.metadata?.transcription || '').replace(/"/g, "'");
        chunks.push(`![${label}](${url}) <!-- scribex:block type=audio duration=${dur} transcription="${trans}" -->`);
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

      case 'scan': {
        const data = block.metadata || { ocrText: block.content || '' };
        const dataJson = JSON.stringify(data).replace(/'/g, "\\'");
        const docName = data.documentName || 'Scanned Document';
        const ocrText = data.ocrText || block.content || '';
        const imgUrl = data.imageUrl ? `\n![Scan](${data.imageUrl})` : '';
        const lines = [
          `📄 **Document Scan: ${docName}**${imgUrl}`,
          ocrText ? `> **Extracted OCR Text:**\n> ${ocrText.split('\n').join('\n> ')}` : '',
        ].filter(Boolean);
        chunks.push(`<!-- scribex:block type=scan data='${dataJson}' -->\n${lines.join('\n')}`);
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
