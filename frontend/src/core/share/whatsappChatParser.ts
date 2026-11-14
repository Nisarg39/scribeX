import { ParsedWhatsAppChat, WhatsAppParsedMessage, WhatsAppPollData } from './types';

// Unicode control characters common in WhatsApp exports
const DIRECTIONAL_MARKS_REGEX = /[\u200E\u200F\u202A-\u202E\uFEFF]/g;
const UNUSUAL_SPACES_REGEX = /[\u202F\u00A0\u2007\u2009]/g;

// Universal regexes for WhatsApp headers
// 1. Bracketed: [Date, Time] Sender: Message OR [Time, Date] Sender: Message (comma optional)
const BRACKETED_HEADER_RE = /^\[(\d{1,4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,4}|\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?),?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?|\d{1,4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,4})\]\s+([^:]+?):\s*([\s\S]*)$/;

// 2. Dash: Date, Time - Sender: Message (supporting ASCII dash -, en-dash –, em-dash —)
const DASH_HEADER_RE = /^(\d{1,4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\s+[\-–—]\s+([^:]+?):\s*([\s\S]*)$/;

// System lines without sender (e.g. End-to-end encryption notices)
const SYSTEM_ENCRYPTION_RE = /end-to-end encrypted|security code changed|created group|added you to group|cifrado|chiffré|protegidas/i;

// Attachment marker regexes
const IOS_ATTACHED_RE = /<attached:\s*([^>]+)>/i;
const ANDROID_ATTACHED_RE = /^([^\r\n]+?)\s+\((?:file attached|attachment)\)$/im;
const MEDIA_OMITTED_RE = /<(?:media|archivo|médias|medien)\s+omitted>|(?:image|audio|video|document|contact|sticker|archivo|imagen)\s+(?:omitted|omitido|omis|weggelassen)/i;

const SELF_SENDERS = new Set(['you', 'me', 'tú', 'tu', 'du', 'vous', 'você', 'voce']);

/**
 * Checks whether a sender string identifies the local device user ("You", "Me", localized).
 */
export function isWhatsAppSelfSender(sender?: string): boolean {
  if (!sender) return false;
  return SELF_SENDERS.has(sender.trim().toLowerCase());
}

/**
 * Sanitizes invisible WhatsApp control characters and non-breaking spaces.
 */
export function sanitizeWhatsAppText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(DIRECTIONAL_MARKS_REGEX, '')
    .replace(UNUSUAL_SPACES_REGEX, ' ');
}

/**
 * Normalizes WhatsApp inline markdown syntax (*bold*, ~strike~) to GitHub Flavored Markdown (**bold**, ~~strike~~).
 * Strictly requires delimiters to touch non-whitespace content to avoid corrupting arithmetic (e.g. 5 * 4 * 3).
 */
export function normalizeWhatsAppMarkdown(text: string): string {
  if (!text) return '';
  let out = text;

  // Replace *bold* with **bold**
  out = out.replace(/(?<![*\w])\*([^\s*](?:[^*\r\n]*?[^\s*])?)\*(?![*\w])/g, '**$1**');

  // Replace ~strike~ with ~~strike~~
  out = out.replace(/(?<![~\w])~([^\s~](?:[^~\r\n]*?[^\s~])?)~(?![~\w])/g, '~~$1~~');

  return out;
}

/**
 * Detects and parses a WhatsApp Poll structure.
 */
export function parseWhatsAppPoll(rawText: string): WhatsAppPollData | null {
  const clean = sanitizeWhatsAppText(rawText).trim();
  const allLines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const pollIndex = allLines.findIndex((l) => /^POLL:/i.test(l));
  if (pollIndex === -1) {
    return null;
  }

  const lines = allLines.slice(pollIndex);
  if (lines.length < 2) return null;

  // First line is POLL: (or POLL: Question)
  let question = lines[0].replace(/^POLL:\s*/i, '').trim();
  let optionStartIndex = 1;

  if (!question && lines.length > 1) {
    question = lines[1];
    optionStartIndex = 2;
  }

  const options: Array<{ text: string; votes?: number }> = [];

  for (let i = optionStartIndex; i < lines.length; i++) {
    const line = lines[i];
    const optionMatch = line.match(/^OPTION:\s*(.+?)(?:\s*\((\d+)\s*votes?\))?$/i);
    if (optionMatch) {
      options.push({
        text: optionMatch[1].trim(),
        votes: optionMatch[2] !== undefined ? parseInt(optionMatch[2], 10) : undefined,
      });
    } else if (line.startsWith('• ') || line.startsWith('- ')) {
      const stripped = line.substring(2).trim();
      const voteMatch = stripped.match(/^(.+?)(?:\s*\((\d+)\s*votes?\))?$/i);
      if (voteMatch) {
        options.push({
          text: voteMatch[1].trim(),
          votes: voteMatch[2] !== undefined ? parseInt(voteMatch[2], 10) : undefined,
        });
      }
    }
  }

  if (options.length === 0) return null;

  return {
    question: question || 'WhatsApp Poll',
    options,
  };
}

/**
 * Checks if a string contains structured WhatsApp chat transcript headers.
 */
export function isWhatsAppChatTranscript(rawText: string): boolean {
  if (!rawText) return false;
  const sanitized = sanitizeWhatsAppText(rawText);
  const lines = sanitized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 50);

  for (const trimmed of lines) {
    if (BRACKETED_HEADER_RE.test(trimmed) || DASH_HEADER_RE.test(trimmed)) {
      return true;
    }
  }
  return false;
}

/**
 * Parses full multi-message WhatsApp chat transcripts.
 */
export function parseWhatsAppChat(rawText: string, chatSubject?: string): ParsedWhatsAppChat {
  const sanitized = sanitizeWhatsAppText(rawText);
  const rawLines = sanitized.split(/\r?\n/);

  const messages: WhatsAppParsedMessage[] = [];
  const participantsSet = new Set<string>();
  let hasMediaAttachments = false;
  let inferredSubject = chatSubject;

  let currentMsg: WhatsAppParsedMessage | null = null;
  let msgSeq = 1;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentMsg) {
        currentMsg.content += '\n';
      }
      continue;
    }

    // Try Bracketed Header
    let match = trimmed.match(BRACKETED_HEADER_RE);
    let datePart = '';
    let timePart = '';
    let senderPart = '';
    let bodyPart = '';

    if (match) {
      datePart = match[1];
      timePart = match[2];
      senderPart = match[3].trim();
      bodyPart = match[4];
    } else {
      // Try Dash Header
      match = trimmed.match(DASH_HEADER_RE);
      if (match) {
        datePart = match[1];
        timePart = match[2];
        senderPart = match[3].trim();
        bodyPart = match[4];
      }
    }

    if (match && senderPart) {
      // Filter out system encryption alerts
      if (SYSTEM_ENCRYPTION_RE.test(senderPart) || SYSTEM_ENCRYPTION_RE.test(bodyPart)) {
        continue;
      }

      if (currentMsg) {
        messages.push(finalizeMessage(currentMsg));
      }

      participantsSet.add(senderPart);

      // Check for inline attachment tags
      let attachmentName: string | undefined;
      const iosAttach = bodyPart.match(IOS_ATTACHED_RE);
      if (iosAttach) {
        attachmentName = iosAttach[1].trim();
        bodyPart = bodyPart.replace(IOS_ATTACHED_RE, '').trim();
        hasMediaAttachments = true;
      } else {
        const androidAttach = bodyPart.match(ANDROID_ATTACHED_RE);
        if (androidAttach) {
          attachmentName = androidAttach[1].trim();
          bodyPart = bodyPart.replace(ANDROID_ATTACHED_RE, '').trim();
          hasMediaAttachments = true;
        } else if (MEDIA_OMITTED_RE.test(bodyPart)) {
          hasMediaAttachments = true;
        }
      }

      const isMe = isWhatsAppSelfSender(senderPart);

      currentMsg = {
        id: `wa-msg-${msgSeq++}`,
        sender: senderPart,
        timestamp: `${datePart} ${timePart}`.trim(),
        content: bodyPart,
        isMe,
        attachmentName,
      };
    } else {
      // Look for group creation line to extract subject if absent
      if (!inferredSubject) {
        const groupMatch = trimmed.match(/(?:created group|erstellte die Gruppe|a créé le groupe|creó el grupo)\s+["“]([^"”]+)["”]/i);
        if (groupMatch) {
          inferredSubject = groupMatch[1].trim();
        }
      }

      // Multiline message continuation
      if (currentMsg) {
        // Check if this continuation line is an Android attachment marker: "IMG-xxx.jpg (file attached)"
        const androidAttach = trimmed.match(ANDROID_ATTACHED_RE);
        if (androidAttach) {
          currentMsg.attachmentName = androidAttach[1].trim();
          hasMediaAttachments = true;
        } else {
          currentMsg.content += (currentMsg.content ? '\n' : '') + line;
        }
      }
    }
  }

  if (currentMsg) {
    messages.push(finalizeMessage(currentMsg));
  }

  return {
    subject: inferredSubject,
    participants: Array.from(participantsSet),
    messages,
    hasMediaAttachments,
  };
}

function finalizeMessage(msg: WhatsAppParsedMessage): WhatsAppParsedMessage {
  // Check if content is a WhatsApp poll
  const poll = parseWhatsAppPoll(msg.content);
  if (poll) {
    msg.poll = poll;
  }
  msg.content = normalizeWhatsAppMarkdown(msg.content.trim());
  return msg;
}
