import { ComposableBlock } from '../../types/note';
import { NoteColorToken } from '../../theme/tokens';
import { NormalizedSharePayload, SharedFileItem, SynthesizedNoteResult } from './types';
import {
  isWhatsAppChatTranscript,
  parseWhatsAppChat,
  isWhatsAppSelfSender,
} from './whatsappChatParser';
import { ThreadMessage } from '../../components/editor/blocks/MessageThreadBlock';

export const CHAT_FILE_REGEX = /(_chat\.txt|.*whatsapp.*\.txt)$/i;

function generateBlockId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Validates whether an inbound share payload corresponds to a native WhatsApp Export Chat.
 * Checks for transcript header signatures in text or presence of an export chat text file.
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
 * Synthesizes a WhatsApp Export Chat payload into ScribeX ComposableBlocks.
 * Returns null if the payload is not a valid WhatsApp Export Chat.
 */
export function synthesizeShareBlocks(
  payload: NormalizedSharePayload,
  explicitTranscript?: string
): SynthesizedNoteResult | null {
  const rawText = (explicitTranscript || payload.text || '').trim();
  const files = payload.files || [];

  const hasTranscriptText = isWhatsAppChatTranscript(rawText);
  let chatFile = files.find((f) => CHAT_FILE_REGEX.test(f.fileName));
  if (!chatFile && payload.subject && /whatsapp/i.test(payload.subject)) {
    chatFile = files.find((f) => /\.txt$/i.test(f.fileName));
  }
  const hasSubjectSignal = Boolean(payload.subject && /whatsapp\s*chat/i.test(payload.subject));

  // Strictly reject non-WhatsApp export payloads
  if (!hasTranscriptText && !chatFile && !hasSubjectSignal) {
    return null;
  }

  const blocks: ComposableBlock[] = [];
  const tags: string[] = ['whatsapp', 'chat-capture'];
  let noteTitle = '';
  const colorToken: NoteColorToken = 'lime';

  if (hasTranscriptText) {
    const parsedChat = parseWhatsAppChat(rawText, payload.subject);
    const threadMessages: ThreadMessage[] = parsedChat.messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      senderEmail: m.senderEmail,
      timestamp: m.timestamp,
      content: m.content,
      isMe: m.isMe ?? isWhatsAppSelfSender(m.sender),
      attachmentName: m.attachmentName,
      replyTo: m.replyTo,
    }));

    // Primary message thread block
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
        date: parsedChat.messages[0]?.timestamp || new Date().toLocaleDateString(),
        participants: parsedChat.participants,
        messages: threadMessages,
      },
    });

    // Check if any message contained a Poll
    for (const msg of parsedChat.messages) {
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

    // Append exported media attachments (excluding the transcript text file itself)
    for (const file of files) {
      if (CHAT_FILE_REGEX.test(file.fileName)) {
        continue;
      }
      const mediaBlock = createBlockFromFile(file);
      if (mediaBlock) {
        blocks.push(mediaBlock);
      }
    }

    // Title generation
    const otherParticipants = parsedChat.participants.filter((p) => !isWhatsAppSelfSender(p));
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
    } else {
      noteTitle = 'WhatsApp Chat Transcript';
    }

    return { title: noteTitle, blocks, tags, colorToken };
  }

  // Fallback if chatFile was passed without extracted rawText
  if (chatFile) {
    blocks.push({
      id: generateBlockId('file'),
      type: 'file',
      content: chatFile.fileName,
      metadata: {
        url: chatFile.uri,
        fileName: chatFile.fileName,
        sizeBytes: chatFile.fileSize || 0,
      },
    });

    for (const file of files) {
      if (file === chatFile) continue;
      const mediaBlock = createBlockFromFile(file);
      if (mediaBlock) {
        blocks.push(mediaBlock);
      }
    }

    noteTitle = `WhatsApp Chat · ${chatFile.fileName.replace(/\.txt$/i, '')}`;
    return { title: noteTitle, blocks, tags, colorToken };
  }

  // Fallback if payload subject specified a WhatsApp chat
  if (hasSubjectSignal) {
    blocks.push({
      id: generateBlockId('thread'),
      type: 'message_thread',
      content: '',
      metadata: {
        channel: 'whatsapp',
        subject: payload.subject,
        date: new Date().toLocaleDateString(),
        participants: [],
        messages: [],
      },
    });

    for (const file of files) {
      const mediaBlock = createBlockFromFile(file);
      if (mediaBlock) {
        blocks.push(mediaBlock);
      }
    }

    return { title: payload.subject!, blocks, tags, colorToken };
  }

  return null;
}

function createBlockFromFile(file: SharedFileItem): ComposableBlock | null {
  const fileName = file.fileName || 'shared-file';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mime = (file.mimeType || '').toLowerCase();

  // Images
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) {
    return {
      id: generateBlockId('img'),
      type: 'image',
      content: fileName,
      metadata: {
        url: file.uri,
        caption: fileName,
        width: 100,
        alignment: 'center',
      },
    };
  }

  // Audio / Voice notes (.opus, .ogg, .mp3, .m4a, .aac, .wav)
  if (mime.startsWith('audio/') || ['opus', 'ogg', 'mp3', 'm4a', 'aac', 'wav'].includes(ext)) {
    return {
      id: generateBlockId('audio'),
      type: 'audio',
      content: fileName,
      metadata: {
        audioUrl: file.uri,
        title: fileName,
        mimeType: mime || `audio/${ext}`,
      },
    };
  }

  // Video
  if (mime.startsWith('video/') || ['mp4', 'mov', '3gp', 'mkv', 'webm'].includes(ext)) {
    return {
      id: generateBlockId('vid'),
      type: 'video',
      content: fileName,
      metadata: {
        url: file.uri,
        caption: fileName,
        width: '100%',
        align: 'center',
      },
    };
  }

  // Generic document / file
  return {
    id: generateBlockId('file'),
    type: 'file',
    content: fileName,
    metadata: {
      url: file.uri,
      fileName,
      sizeBytes: file.fileSize || 0,
    },
  };
}
