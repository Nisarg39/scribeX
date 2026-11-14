import { ComposableBlock } from '../../types/note';
import { NoteColorToken } from '../../theme/tokens';

export interface SharedFileItem {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}

export interface NormalizedSharePayload {
  batchId: string;
  text?: string;
  subject?: string;
  files: SharedFileItem[];
  createdAt?: string;
}

export interface WhatsAppPollData {
  question: string;
  options: Array<{
    text: string;
    votes?: number;
  }>;
}

export interface WhatsAppParsedMessage {
  id: string;
  sender: string;
  senderEmail?: string;
  timestamp: string;
  content: string;
  isMe?: boolean;
  attachmentName?: string;
  replyTo?: string;
  poll?: WhatsAppPollData;
}

export interface ParsedWhatsAppChat {
  subject?: string;
  participants: string[];
  messages: WhatsAppParsedMessage[];
  hasMediaAttachments: boolean;
}

export interface SynthesizedNoteResult {
  title: string;
  blocks: ComposableBlock[];
  tags: string[];
  colorToken?: NoteColorToken;
}
