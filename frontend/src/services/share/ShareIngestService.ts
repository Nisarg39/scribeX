import { Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { NormalizedSharePayload } from '../../core/share/types';
import { synthesizeShareBlocks, isWhatsAppExportPayload, CHAT_FILE_REGEX } from '../../core/share/shareBlockSynthesizer';
import { isWhatsAppChatTranscript } from '../../core/share/whatsappChatParser';
import { NativeShareBridge } from './NativeShareBridge';
import { NoteItem, ComposableBlock } from '../../types/note';
import { NoteColorToken } from '../../theme/tokens';

type AddNoteWithBlocksFn = (params: {
  title?: string;
  blocks: ComposableBlock[];
  colorToken?: NoteColorToken;
  folderPath?: string;
  tags?: string[];
}) => Promise<NoteItem>;

type NavigateFn = (noteId: string) => void;

class ShareIngestService {
  private processedBatchIds = new Set<string>();
  private isProcessing = false;

  /**
   * Ingests a WhatsApp Export Chat payload, synthesizes AST blocks, creates the note, and triggers navigation.
   * Rejects non-WhatsApp payloads cleanly.
   */
  public async ingestSharePayload(
    payload: NormalizedSharePayload,
    addNoteWithBlocks: AddNoteWithBlocksFn,
    onNavigate: NavigateFn
  ): Promise<NoteItem | null> {
    if (!payload || !payload.batchId) return null;

    if (this.processedBatchIds.has(payload.batchId)) {
      return null;
    }
    this.processedBatchIds.add(payload.batchId);

    try {
      this.isProcessing = true;

      let transcriptText = payload.text;
      let chatFile = payload.files?.find((f) =>
        CHAT_FILE_REGEX.test(f.fileName)
      );
      if (!chatFile && payload.subject && /whatsapp/i.test(payload.subject)) {
        chatFile = payload.files?.find((f) => /\.txt$/i.test(f.fileName));
      }

      if ((!transcriptText || !isWhatsAppChatTranscript(transcriptText)) && chatFile?.uri) {
        const fileContent = await this.readTranscriptFile(chatFile.uri);
        if (fileContent) {
          transcriptText = fileContent;
        }
      }

      const synthesized = synthesizeShareBlocks(payload, transcriptText);
      if (!synthesized) {
        return null;
      }

      const createdNote = await addNoteWithBlocks({
        title: synthesized.title,
        blocks: synthesized.blocks,
        colorToken: synthesized.colorToken,
        folderPath: 'General',
        tags: synthesized.tags,
      });

      if (createdNote && createdNote.id) {
        onNavigate(createdNote.id);
      }

      return createdNote;
    } catch (err) {
      console.warn('ShareIngestService: Failed to ingest share payload', err);
      return null;
    } finally {
      this.isProcessing = false;
    }
  }

  private async readTranscriptFile(uri: string): Promise<string | null> {
    try {
      return await FileSystem.readAsStringAsync(uri);
    } catch (err) {
      console.warn('ShareIngestService: Could not read transcript file', err);
      return null;
    }
  }

  /**
   * Initializes the native and deep-link listeners.
   */
  public initialize(
    addNoteWithBlocks: AddNoteWithBlocksFn,
    onNavigate: NavigateFn
  ): () => void {
    // 1. Cold start check from Android / Native bridge
    NativeShareBridge.getPendingSharePayload().then((payload) => {
      if (payload && isWhatsAppExportPayload(payload)) {
        this.ingestSharePayload(payload, addNoteWithBlocks, onNavigate);
      }
    });

    // 2. Warm start listener from Native bridge
    const unsubscribeNative = NativeShareBridge.subscribe((payload) => {
      if (payload && isWhatsAppExportPayload(payload)) {
        this.ingestSharePayload(payload, addNoteWithBlocks, onNavigate);
      }
    });

    // 3. Deep link listener (iOS App Group handoff: scribex://share-ingest?batchId=...)
    const handleUrl = ({ url }: { url: string }) => {
      if (url && url.startsWith('scribex://share-ingest')) {
        NativeShareBridge.getPendingSharePayload().then((payload) => {
          if (payload && isWhatsAppExportPayload(payload)) {
            this.ingestSharePayload(payload, addNoteWithBlocks, onNavigate);
          }
        });
      }
    };

    const urlSubscription = Linking.addEventListener('url', handleUrl);

    // Initial URL check
    Linking.getInitialURL().then((url) => {
      if (url && url.startsWith('scribex://share-ingest')) {
        handleUrl({ url });
      }
    });

    return () => {
      unsubscribeNative();
      urlSubscription.remove();
    };
  }
}

export const shareIngestService = new ShareIngestService();
