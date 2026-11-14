import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { NormalizedSharePayload } from '../../core/share/types';

const { ScribeXShareIntent } = NativeModules;

const shareEmitter = ScribeXShareIntent ? new NativeEventEmitter(ScribeXShareIntent) : null;

export const NativeShareBridge = {
  isAvailable(): boolean {
    return Boolean(ScribeXShareIntent);
  },

  async getPendingSharePayload(): Promise<NormalizedSharePayload | null> {
    if (!ScribeXShareIntent) return null;
    try {
      const payload = await ScribeXShareIntent.getPendingSharePayload();
      return payload || null;
    } catch (e) {
      console.warn('NativeShareBridge.getPendingSharePayload error:', e);
      return null;
    }
  },

  async clearPendingSharePayload(): Promise<void> {
    if (!ScribeXShareIntent) return;
    try {
      await ScribeXShareIntent.clearPendingSharePayload();
    } catch (e) {
      console.warn('NativeShareBridge.clearPendingSharePayload error:', e);
    }
  },

  subscribe(onPayload: (payload: NormalizedSharePayload) => void): () => void {
    if (!shareEmitter) {
      return () => {};
    }

    const subscription = shareEmitter.addListener(
      'onSharePayloadReceived',
      (payload: NormalizedSharePayload) => {
        if (payload) {
          onPayload(payload);
        }
      }
    );

    return () => {
      subscription.remove();
    };
  },
};
