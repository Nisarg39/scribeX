import { Linking } from 'react-native';
import { NormalizedSharePayload, SynthesizedNoteResult } from '../../core/share/types';
import { synthesizeShareBlocks, isValidSharePayload } from '../../core/share/shareBlockSynthesizer';
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
type OnSharePromptFn = (synthesized: SynthesizedNoteResult, payload: NormalizedSharePayload) => void;

class ShareIngestService {
  private processedBatchIds = new Set<string>();
  private isProcessing = false;

  /**
   * Synthesizes AST blocks from any inbound OS share payload (WhatsApp export .zip/.txt,
   * individual media, voice notes, documents, links, or text messages).
   * If `onSharePrompt` is provided, delegates destination choice (New vs Existing Note) to the UI modal.
   */
  public async ingestSharePayload(
    payload: NormalizedSharePayload,
    addNoteWithBlocks: AddNoteWithBlocksFn,
    onNavigate: NavigateFn,
    onSharePrompt?: OnSharePromptFn
  ): Promise<NoteItem | null> {
    if (!payload || !payload.batchId) return null;

    if (this.processedBatchIds.has(payload.batchId)) {
      return null;
    }
    this.processedBatchIds.add(payload.batchId);

    try {
      this.isProcessing = true;

      const synthesized = synthesizeShareBlocks(payload);
      if (!synthesized) {
        return null;
      }

      if (onSharePrompt) {
        onSharePrompt(synthesized, payload);
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

  /**
   * Initializes the native and deep-link listeners for all inbound share payloads.
   */
  public initialize(
    addNoteWithBlocks: AddNoteWithBlocksFn,
    onNavigate: NavigateFn,
    onSharePrompt?: OnSharePromptFn
  ): () => void {
    // 1. Cold start check from Android / Native bridge
    NativeShareBridge.getPendingSharePayload().then((payload) => {
      if (payload && isValidSharePayload(payload)) {
        this.ingestSharePayload(payload, addNoteWithBlocks, onNavigate, onSharePrompt);
      }
    });

    // 2. Warm start listener from Native bridge
    const unsubscribeNative = NativeShareBridge.subscribe((payload) => {
      if (payload && isValidSharePayload(payload)) {
        this.ingestSharePayload(payload, addNoteWithBlocks, onNavigate, onSharePrompt);
      }
    });

    // 3. Deep link listener (iOS App Group handoff: scribex://share-ingest?batchId=...)
    const handleUrl = ({ url }: { url: string }) => {
      if (url && url.startsWith('scribex://share-ingest')) {
        NativeShareBridge.getPendingSharePayload().then((payload) => {
          if (payload && isValidSharePayload(payload)) {
            this.ingestSharePayload(payload, addNoteWithBlocks, onNavigate, onSharePrompt);
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
