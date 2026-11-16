import { ComposableBlock } from '../../types/note';
import { NoteColorToken } from '../../theme/tokens';
import { NormalizedSharePayload, SharedFileItem, SynthesizedNoteResult } from './types';
import {
  isWhatsAppChatTranscript,
  parseWhatsAppChat,
  parseWhatsAppPoll,
  isWhatsAppSelfSender,
  normalizeWhatsAppMarkdown,
} from './whatsappChatParser';
import { ThreadMessage } from '../../components/editor/blocks/MessageThreadBlock';

export const CHAT_FILE_REGEX = /(_chat\.txt|.*whatsapp.*\.(txt|zip))$/i;

function generateBlockId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Checks if an inbound payload is a valid share (either files or text/subject).
 */
export function isValidSharePayload(payload: NormalizedSharePayload | null | undefined): boolean {
  if (!payload) return false;
  const hasText = Boolean((payload.text || '').trim());
  const hasFiles = Array.isArray(payload.files) && payload.files.length > 0;
  return hasText || hasFiles;
}

/**
 * Identifies whether an inbound share payload comes from a WhatsApp Export Chat
 * (.zip archive, .txt file, subject header, or copied multi-message transcript).
 */
export function isWhatsAppExportPayload(payload: NormalizedSharePayload): boolean {
  if (!payload) return false;
  const rawText = (payload.text || '').trim();
  if (rawText && isWhatsAppChatTranscript(rawText)) {
    return true;
  }
  const files = payload.files || [];
  if (files.some((f) => CHAT_FILE_REGEX.test(f.fileName))) {
    return true;
  }
  if (payload.subject && /whatsapp\s*chat/i.test(payload.subject)) {
    return true;
  }
  return false;
}

/**
 * Universal Share Block Synthesizer:
 * 1. WhatsApp Export Chat files (.zip or .txt): Stored strictly as intact `file` blocks (zero OOM risk).
 * 2. Individual shared media/files (images, videos, .opus/.mp3 audio, PDFs/docs): Stored with `content = file.uri`
 *    so local sandbox URIs survive Markdown serialization and play/render natively.
 * 3. Shared text messages, polls, or links: Synthesized into `bookmark`, `message_thread`, `checklist`, or `paragraph` blocks.
 */
export function synthesizeShareBlocks(
  payload: NormalizedSharePayload
): SynthesizedNoteResult | null {
  if (!isValidSharePayload(payload)) {
    return null;
  }

  const rawText = (payload.text || '').trim();
  const files = payload.files || [];
  const blocks: ComposableBlock[] = [];

  const isWhatsAppFileExport =
    files.some((f) => CHAT_FILE_REGEX.test(f.fileName) || /\.(zip|txt)$/i.test(f.fileName)) &&
    (files.some((f) => CHAT_FILE_REGEX.test(f.fileName)) ||
      Boolean(payload.subject && /whatsapp/i.test(payload.subject)));

  // Case 1: File attachments exist (WhatsApp .zip/.txt export OR individual shared media/documents)
  if (files.length > 0) {
    for (const file of files) {
      const block = createBlockFromFile(file);
      if (block) {
        blocks.push(block);
      }
    }

    // If the user shared individual media/files along with a caption/message text
    // (and it is not a WhatsApp export file blurb or identical to the filename), append the caption text.
    if (rawText && !isWhatsAppFileExport) {
      const isDuplicateFileName = files.some((f) => f.fileName === rawText);
      if (!isDuplicateFileName) {
        appendTextBlocks(rawText, payload.subject, blocks);
      }
    }

    const tags = isWhatsAppFileExport
      ? ['whatsapp', 'chat-export']
      : deriveTagsForFiles(files);
    const colorToken: NoteColorToken = isWhatsAppFileExport ? 'lime' : 'sky';
    const title = deriveTitleForFileShare(files, payload.subject, rawText, isWhatsAppFileExport);

    return { title, blocks, tags, colorToken };
  }

  // Case 2: Text-only share (copied WhatsApp messages, poll, URL link, or individual message text)
  if (rawText) {
    // 2a. Multi-message copied WhatsApp transcript (when shared as text without a .zip/.txt file)
    if (isWhatsAppChatTranscript(rawText)) {
      const parsedChat = parseWhatsAppChat(rawText, payload.subject);
      // Cap inline message thread at 200 messages to protect editor memory
      const safeMessages = parsedChat.messages.slice(-200);
      const threadMessages: ThreadMessage[] = safeMessages.map((m) => ({
        id: m.id,
        sender: m.sender,
        senderEmail: m.senderEmail,
        timestamp: m.timestamp,
        content: m.content,
        isMe: m.isMe ?? isWhatsAppSelfSender(m.sender),
        attachmentName: m.attachmentName,
        replyTo: m.replyTo,
      }));

      blocks.push({
        id: generateBlockId('thread'),
        type: 'message_thread',
        content: '',
        metadata: {
          channel: 'whatsapp',
          subject:
            parsedChat.subject ||
            (parsedChat.participants.length > 0
              ? `Chat with ${parsedChat.participants.join(', ')}`
              : 'WhatsApp Chat'),
          date: safeMessages[0]?.timestamp || new Date().toLocaleDateString(),
          participants: parsedChat.participants,
          messages: threadMessages,
        },
      });

      for (const msg of safeMessages) {
        if (msg.poll) {
          blocks.push({
            id: generateBlockId('poll-hdr'),
            type: 'heading',
            content: `Poll: ${msg.poll.question}`,
            metadata: { level: 2 },
          });

          blocks.push({
            id: generateBlockId('poll-checklist'),
            type: 'checklist',
            content: '',
            metadata: {
              items: msg.poll.options.map((opt) => ({
                id: generateBlockId('poll-opt'),
                text: opt.votes !== undefined ? `${opt.text} (${opt.votes} votes)` : opt.text,
                checked: false,
              })),
            },
          });
        }
      }

      const otherParticipants = parsedChat.participants.filter((p) => !isWhatsAppSelfSender(p));
      let noteTitle = 'WhatsApp Chat Transcript';
      if (parsedChat.subject) {
        noteTitle = `WhatsApp Chat · ${parsedChat.subject}`;
      } else if (parsedChat.participants.length === 2 && !parsedChat.participants.some(isWhatsAppSelfSender)) {
        noteTitle = `WhatsApp Chat · ${parsedChat.participants[0]} & ${parsedChat.participants[1]}`;
      } else if (otherParticipants.length === 1) {
        noteTitle = `WhatsApp · ${otherParticipants[0]}`;
      } else if (otherParticipants.length > 1) {
        noteTitle = `WhatsApp Chat · ${otherParticipants.slice(0, 2).join(' & ')}`;
      } else if (parsedChat.participants.length === 1) {
        noteTitle = `WhatsApp · ${parsedChat.participants[0]}`;
      }

      return {
        title: noteTitle,
        blocks,
        tags: ['whatsapp', 'chat-capture'],
        colorToken: 'lime',
      };
    }

    // 2b. Standalone URL share -> Bookmark block
    if (/^https?:\/\/\S+$/i.test(rawText)) {
      let hostname = 'Shared Link';
      try {
        hostname = new URL(rawText).hostname.replace(/^www\./, '');
      } catch {
        // ignore URL parse error
      }
      blocks.push({
        id: generateBlockId('bm'),
        type: 'bookmark',
        content: rawText,
        metadata: {
          url: rawText,
          title: payload.subject || hostname,
          description: rawText,
          domain: hostname,
        },
      });

      return {
        title: payload.subject || `Shared Link · ${hostname}`,
        blocks,
        tags: ['shared', 'bookmark'],
        colorToken: 'lavender',
      };
    }

    // 2c. Standalone Poll share or Generic Message / Text share
    appendTextBlocks(rawText, payload.subject, blocks);
    const firstLine = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) || 'Shared Note';
    const cleanFirstLine = firstLine.replace(/^[#*~>-]+\s*/, '').slice(0, 60);
    const title = payload.subject?.trim() || cleanFirstLine || 'Shared Note';

    return {
      title,
      blocks,
      tags: ['shared'],
      colorToken: 'apricot',
    };
  }

  return null;
}

function appendTextBlocks(rawText: string, _subject: string | undefined, blocks: ComposableBlock[]) {
  const poll = parseWhatsAppPoll(rawText);
  if (poll) {
    blocks.push({
      id: generateBlockId('poll-hdr'),
      type: 'heading',
      content: `Poll: ${poll.question}`,
      metadata: { level: 2 },
    });
    blocks.push({
      id: generateBlockId('poll-checklist'),
      type: 'checklist',
      content: '',
      metadata: {
        items: poll.options.map((opt) => ({
          id: generateBlockId('poll-opt'),
          text: opt.votes !== undefined ? `${opt.text} (${opt.votes} votes)` : opt.text,
          checked: false,
        })),
      },
    });
    return;
  }

  const normalized = normalizeWhatsAppMarkdown(rawText);
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const para of paragraphs) {
    if (/^https?:\/\/\S+$/i.test(para)) {
      blocks.push({
        id: generateBlockId('bm'),
        type: 'bookmark',
        content: para,
        metadata: {
          url: para,
          title: para,
        },
      });
    } else {
      blocks.push({
        id: generateBlockId('p'),
        type: 'paragraph',
        content: para,
      });
    }
  }
}

function deriveTagsForFiles(files: SharedFileItem[]): string[] {
  const tags = new Set<string>(['shared']);
  for (const f of files) {
    const ext = (f.fileName.split('.').pop() || '').toLowerCase();
    const mime = (f.mimeType || '').toLowerCase();
    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) {
      tags.add('media');
    } else if (mime.startsWith('video/') || ['mp4', 'mov', '3gp', 'mkv', 'webm'].includes(ext)) {
      tags.add('video');
    } else if (mime.startsWith('audio/') || ['opus', 'ogg', 'mp3', 'm4a', 'aac', 'wav'].includes(ext)) {
      tags.add('voice-note');
    } else {
      tags.add('attachment');
    }
  }
  return Array.from(tags);
}

function deriveTitleForFileShare(
  files: SharedFileItem[],
  subject: string | undefined,
  rawText: string,
  isWhatsAppFileExport: boolean
): string {
  if (subject && subject.trim()) {
    return subject.trim();
  }
  const primary = files[0];
  const baseName = primary.fileName.replace(/\.[^.]+$/, '');
  if (isWhatsAppFileExport) {
    if (/whatsapp/i.test(baseName)) {
      return baseName;
    }
    return `WhatsApp Chat · ${baseName}`;
  }
  if (rawText && rawText.trim() && rawText.trim() !== primary.fileName) {
    return rawText.trim().split(/\r?\n/)[0].slice(0, 60);
  }
  if (files.length === 1) {
    return primary.fileName;
  }
  return `${primary.fileName} (+${files.length - 1} more)`;
}

/**
 * Converts a single shared file into a ScribeX ComposableBlock.
 * CRITICAL: `content` MUST be set to `file.uri` (the local sandbox `file://` URI)
 * so that `serializeBlocksToMarkdown()` and `BlockRenderer` preserve the playable/renderable path.
 */
export function createBlockFromFile(file: SharedFileItem): ComposableBlock | null {
  const fileName = file.fileName || 'shared-file';
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';
  const mime = (file.mimeType || '').toLowerCase();

  // WhatsApp exports (.zip / .txt) and generic archives are always stored as intact FileBlocks
  if (ext === 'zip' || ext === 'txt' || mime === 'application/zip' || mime === 'text/plain') {
    return {
      id: generateBlockId('file'),
      type: 'file',
      content: file.uri,
      metadata: {
        url: file.uri,
        fileName,
        sizeBytes: file.fileSize || 0,
      },
    };
  }

  // Images
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) {
    return {
      id: generateBlockId('img'),
      type: 'image',
      content: file.uri,
      metadata: {
        url: file.uri,
        caption: fileName,
        fileName,
        width: '100%',
        align: 'center',
        aspectRatio: 'natural',
      },
    };
  }

  // Audio / Voice notes (.opus, .ogg, .mp3, .m4a, .aac, .wav)
  if (mime.startsWith('audio/') || ['opus', 'ogg', 'mp3', 'm4a', 'aac', 'wav'].includes(ext)) {
    return {
      id: generateBlockId('audio'),
      type: 'audio',
      content: file.uri,
      metadata: {
        audioUrl: file.uri,
        url: file.uri,
        title: fileName,
        fileName,
        mimeType: mime || (ext === 'opus' ? 'audio/ogg' : `audio/${ext}`),
      },
    };
  }

  // Video
  if (mime.startsWith('video/') || ['mp4', 'mov', '3gp', 'mkv', 'webm'].includes(ext)) {
    return {
      id: generateBlockId('vid'),
      type: 'video',
      content: file.uri,
      metadata: {
        url: file.uri,
        caption: fileName,
        fileName,
        width: '100%',
        align: 'center',
      },
    };
  }

  // Generic document / file (.pdf, .docx, etc.)
  return {
    id: generateBlockId('file'),
    type: 'file',
    content: file.uri,
    metadata: {
      url: file.uri,
      fileName,
      sizeBytes: file.fileSize || 0,
    },
  };
}

/**
 * Infers an accurate MIME type from a filename extension.
 */
export function inferMimeTypeFromFileName(fileName: string): string {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'zip':
      return 'application/zip';
    case 'txt':
      return 'text/plain';
    case 'opus':
    case 'ogg':
      return 'audio/ogg';
    case 'mp3':
      return 'audio/mpeg';
    case 'm4a':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'wav':
      return 'audio/wav';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case '3gp':
      return 'video/3gpp';
    case 'mkv':
      return 'video/x-matroska';
    case 'webm':
      return 'video/webm';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'heic':
      return 'image/heic';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Builds a NormalizedSharePayload from an iOS `file://` URL (e.g. `Documents/Inbox/` handoff
 * via CFBundleDocumentTypes when exporting from WhatsApp or sharing files on iOS).
 */
export function buildSharePayloadFromIosFileUrl(
  fileUrl: string,
  persistedUri?: string,
  fileSize: number = 0
): NormalizedSharePayload | null {
  if (!fileUrl || !fileUrl.startsWith('file://')) return null;

  const withoutQuery = fileUrl.split('?')[0];
  const rawSegment = withoutQuery.split('/').pop() || '';
  let decodedName = rawSegment;
  try {
    decodedName = decodeURIComponent(rawSegment);
  } catch {
    decodedName = rawSegment;
  }

  const fileName = decodedName.trim() || `shared_${Date.now()}`;
  const mimeType = inferMimeTypeFromFileName(fileName);
  const targetUri = persistedUri || fileUrl;

  return {
    batchId: `ios-inbox-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    files: [
      {
        uri: targetUri,
        fileName,
        mimeType,
        fileSize,
      },
    ],
    createdAt: new Date().toISOString(),
  };
}
