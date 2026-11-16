import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { NormalizedSharePayload, SynthesizedNoteResult } from '../../core/share/types';
import {
  synthesizeShareBlocks,
  isValidSharePayload,
  buildSharePayloadFromIosFileUrl,
} from '../../core/share/shareBlockSynthesizer';
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
  private processedIosFileUrls = new Set<string>();
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
   * Handles iOS `file://` URLs delivered into `Documents/Inbox/` via CFBundleDocumentTypes
   * when the user exports a WhatsApp chat (.zip/.txt) or shares files on iOS.
   */
  private async ingestIosFileUrl(
    fileUrl: string,
    addNoteWithBlocks: AddNoteWithBlocksFn,
    onNavigate: NavigateFn,
    onSharePrompt?: OnSharePromptFn
  ): Promise<void> {
    if (!fileUrl || !fileUrl.startsWith('file://') || Platform.OS !== 'ios') return;
    if (this.processedIosFileUrls.has(fileUrl)) return;
    this.processedIosFileUrls.add(fileUrl);

    try {
      const initialPayload = buildSharePayloadFromIosFileUrl(fileUrl);
      if (!initialPayload || !initialPayload.files?.[0]) return;

      const fileName = initialPayload.files[0].fileName;
      const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const mediaDir = `${FileSystem.documentDirectory}shared_media/`;

      await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true }).catch(() => {});
      const destUri = `${mediaDir}${Date.now()}_${sanitizedName}`;

      let persistedUri = fileUrl;
      let fileSize = 0;

      try {
        await FileSystem.copyAsync({ from: fileUrl, to: destUri });
        persistedUri = destUri;
        const info = await FileSystem.getInfoAsync(destUri);
        if (info.exists && typeof info.size === 'number') {
          fileSize = info.size;
        }
        // Clean up temporary Inbox file if it came from Documents/Inbox
        if (fileUrl.includes('/Documents/Inbox/')) {
          await FileSystem.deleteAsync(fileUrl, { idempotent: true }).catch(() => {});
        }
      } catch (copyErr) {
        console.warn('ShareIngestService: Failed copying iOS Inbox file, using source URI', copyErr);
      }

      const payload = buildSharePayloadFromIosFileUrl(fileUrl, persistedUri, fileSize);
      if (payload && isValidSharePayload(payload)) {
        await this.ingestSharePayload(payload, addNoteWithBlocks, onNavigate, onSharePrompt);
      }
    } catch (err) {
      console.warn('ShareIngestService: Failed to ingest iOS file URL', err);
    }
  }

  /**
   * Initializes the native and deep-link listeners for all inbound share payloads (Android & iOS).
   */
  public initialize(
    addNoteWithBlocks: AddNoteWithBlocksFn,
    onNavigate: NavigateFn,
    onSharePrompt?: OnSharePromptFn
  ): () => void {
    // 1. Cold start check from Android / iOS App Group Native bridge
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

    // 3. Deep link & iOS Documents/Inbox file:// URL listener
    const handleUrl = ({ url }: { url: string }) => {
      if (!url) return;
      if (url.startsWith('scribex://share-ingest')) {
        NativeShareBridge.getPendingSharePayload().then((payload) => {
          if (payload && isValidSharePayload(payload)) {
            this.ingestSharePayload(payload, addNoteWithBlocks, onNavigate, onSharePrompt);
          }
        });
      } else if (url.startsWith('file://') && Platform.OS === 'ios') {
        this.ingestIosFileUrl(url, addNoteWithBlocks, onNavigate, onSharePrompt);
      }
    };

    const urlSubscription = Linking.addEventListener('url', handleUrl);

    // Initial URL check (cold start from iOS share sheet or deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
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
