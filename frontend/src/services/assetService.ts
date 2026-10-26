/**
 * ScribeX Multi-Modal Asset Service.
 *
 * Handles binary asset uploads (images, audio recordings, documents, PDFs)
 * and listens for server-side OCR/Whisper ASSET_PROCESSED notifications.
 */

import { appConfig } from '../core/config';
import { loadSession } from '../auth/sessionStorage';

export interface UploadedAsset {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  extracted_text?: string | null;
  created_at?: string;
}

export type AssetProcessedListener = (event: {
  asset_id: string;
  note_id?: string;
  block_id?: string;
  file_name: string;
  storage_key: string;
  extracted_text?: string;
  mime_type: string;
}) => void;

class AssetService {
  private listeners: Set<AssetProcessedListener> = new Set();

  /**
   * Upload an asset file via multipart/form-data.
   * Works universally across Web (File/Blob) and React Native Native ({ uri, name, type }).
   */
  async uploadAsset(
    filePayload: any,
    noteId?: string,
    blockId?: string
  ): Promise<UploadedAsset> {
    const session = await loadSession();
    const formData = new FormData();

    if (filePayload instanceof Blob || (typeof File !== 'undefined' && filePayload instanceof File)) {
      formData.append('file', filePayload);
    } else if (filePayload.uri) {
      // React Native asset format
      formData.append('file', {
        uri: filePayload.uri,
        name: filePayload.name || 'upload.bin',
        type: filePayload.type || 'application/octet-stream',
      } as any);
    } else {
      throw new Error('Unsupported file payload format for upload');
    }

    if (noteId) formData.append('note_id', noteId);
    if (blockId) formData.append('block_id', blockId);

    const headers: Record<string, string> = {};
    if (session?.token) {
      headers['Authorization'] = `Bearer ${session.token}`;
    }
    if (session?.user?.id) {
      headers['X-User-ID'] = session.user.id;
    }

    const response = await fetch(`${appConfig.apiUrl}/api/v1/assets/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `Asset upload failed with HTTP ${response.status}`);
    }

    return response.json() as Promise<UploadedAsset>;
  }

  /**
   * Fetch current processing status of an asset.
   */
  async getAssetStatus(assetId: string): Promise<UploadedAsset> {
    const session = await loadSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;
    if (session?.user?.id) headers['X-User-ID'] = session.user.id;

    const response = await fetch(`${appConfig.apiUrl}/api/v1/assets/${assetId}/status`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get asset status for ${assetId}`);
    }

    return response.json() as Promise<UploadedAsset>;
  }

  /**
   * Subscribe to incoming ASSET_PROCESSED WebSocket events.
   */
  subscribe(listener: AssetProcessedListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Internal notify called when a WebSocket event is received.
   */
  notifyAssetProcessed(event: any): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (e) {
        console.warn('Asset listener error:', e);
      }
    });
  }
}

export const assetService = new AssetService();
