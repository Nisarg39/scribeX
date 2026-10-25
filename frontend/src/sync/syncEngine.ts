/**
 * Real-Time Delta Sync Engine & Client State Machine.
 *
 * Implements:
 * 1. WebSocket Doorbell Listener: Receives lightweight SYNC_PING broadcasts from VPS (< 20ms).
 * 2. Instant Catch-Up Handshake: Queries GET /api/v1/sync/deltas?since_rev=X and reconciles SQLite.
 * 3. Offline Mutation Queue Drain: Flushes queued local mutations to POST /api/v1/sync/push upon reconnection.
 * 4. Lifecycle Reconnect: Uses React Native AppState to sync whenever the app returns from background.
 */

export type AppStateStatus = 'active' | 'background' | 'inactive';
let AppState: any = null;
let Platform: any = { OS: 'web' };
try {
  const rn = require('react-native');
  if (rn?.AppState) AppState = rn.AppState;
  if (rn?.Platform) Platform = rn.Platform;
} catch (e) {}
import { syncConfig } from './config';
import {
  getCurrentSyncRev,
  getPendingMutations,
  clearPendingMutations,
  applyServerDeltas,
} from '../db';
import { SyncDelta } from '../db/types';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export interface SyncEvent {
  status: SyncStatus;
  currentRev: number;
  pendingCount: number;
  lastSyncedAt: Date | null;
  deltasApplied?: number;
  errorMessage?: string;
}

export type SyncListener = (event: SyncEvent) => void;

class SyncEngine {
  private status: SyncStatus = 'offline';
  private ws: WebSocket | null = null;
  private listeners: Set<SyncListener> = new Set();
  private isSyncing = false;
  private queuedSync = false;
  private lastSyncedAt: Date | null = null;
  private reconnectTimeout: any = null;
  private heartbeatInterval: any = null;
  private reconnectDelay = syncConfig.reconnectBaseDelayMs;
  private appStateSubscription: any = null;
  private isStarted = false;
  private currentRev = 0;
  private pendingCount = 0;

  constructor() {
    this.handleAppStateChange = this.handleAppStateChange.bind(this);
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  public getCurrentRev(): number {
    return this.currentRev;
  }

  public getPendingCount(): number {
    return this.pendingCount;
  }

  public getLastSyncedAt(): Date | null {
    return this.lastSyncedAt;
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener({
      status: this.status,
      currentRev: this.currentRev,
      pendingCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
    });
    this.emitEvent();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitEvent(deltasApplied?: number, errorMessage?: string) {
    (async () => {
      try {
        const currentRev = await getCurrentSyncRev();
        const pending = await getPendingMutations();
        this.currentRev = currentRev;
        this.pendingCount = pending.length;
        const event: SyncEvent = {
          status: this.status,
          currentRev,
          pendingCount: pending.length,
          lastSyncedAt: this.lastSyncedAt,
          deltasApplied,
          errorMessage,
        };
        for (const listener of this.listeners) {
          try {
            listener(event);
          } catch (err) {
            console.warn('SyncListener error:', err);
          }
        }
      } catch (err) {
        // Fallback emit if db not ready
        const event: SyncEvent = {
          status: this.status,
          currentRev: this.currentRev,
          pendingCount: this.pendingCount,
          lastSyncedAt: this.lastSyncedAt,
          deltasApplied,
          errorMessage,
        };
        for (const listener of this.listeners) {
          listener(event);
        }
      }
    })();
  }

  /**
   * Start the real-time sync engine: connects WebSocket doorbell & listens to lifecycle events.
   */
  public start(): void {
    if (this.isStarted) return;
    this.isStarted = true;

    // 1. Connect WebSocket Doorbell
    this.connectWebSocket();

    // 2. Subscribe to React Native AppState (foreground wake-up)
    if (Platform.OS !== 'web') {
      this.appStateSubscription = AppState.addEventListener(
        'change',
        this.handleAppStateChange
      );
    } else if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.syncNow();
      });
      window.addEventListener('online', () => {
        this.connectWebSocket();
        this.syncNow();
      });
      window.addEventListener('offline', () => {
        this.status = 'offline';
        this.emitEvent();
      });
    }

    // 3. Initial sync
    this.syncNow();
  }

  /**
   * Stop the engine and disconnect all listeners.
   */
  public stop(): void {
    this.isStarted = false;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.appStateSubscription) this.appStateSubscription.remove();

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // Ignore close error
      }
      this.ws = null;
    }
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'active') {
      console.log('App returned to foreground: initiating catch-up handshake');
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connectWebSocket();
      }
      this.syncNow();
    }
  }

  /**
   * WebSocket Doorbell Connection & Auto-Reconnect Loop.
   */
  private connectWebSocket(): void {
    if (!this.isStarted) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const url = `${syncConfig.wsUrl}?user_id=${encodeURIComponent(syncConfig.defaultUserId)}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('WebSocket Doorbell connected to VPS');
        this.reconnectDelay = syncConfig.reconnectBaseDelayMs;
        if (this.status === 'offline') {
          this.status = 'synced';
          this.emitEvent();
        }

        // Start heartbeat ping
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send(JSON.stringify({ type: 'PING' }));
            } catch (e) {
              // Ignore
            }
          }
        }, syncConfig.heartbeatIntervalMs);

        // Perform immediate catch-up upon connection
        this.syncNow();
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'SYNC_PING') {
            console.log(`Doorbell SYNC_PING received from VPS! latest_sync_rev: ${data.latest_sync_rev}`);
            const localRev = await getCurrentSyncRev();
            if (data.latest_sync_rev > localRev) {
              await this.syncNow();
            }
          }
        } catch (err) {
          console.warn('Error handling WebSocket message:', err);
        }
      };

      this.ws.onclose = () => {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Suppress noisy browser {"isTrusted": true} event dump when offline or server unreachable
        if (this.ws) {
          try {
            this.ws.close();
          } catch (e) {}
        }
      };
    } catch (err) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.isStarted) return;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 1.5,
        syncConfig.reconnectMaxDelayMs
      );
      this.connectWebSocket();
    }, this.reconnectDelay);
  }

  /**
   * Core Reconcile Loop:
   * 1. Drains pending local mutations to POST /api/v1/sync/push.
   * 2. Catches up missing server deltas from GET /api/v1/sync/deltas?since_rev=X.
   */
  public async syncNow(): Promise<void> {
    if (this.isSyncing) {
      this.queuedSync = true;
      return;
    }

    this.isSyncing = true;
    this.status = 'syncing';
    this.emitEvent();

    let deltasCount = 0;

    try {
      // Step A: Drain Offline Mutation Queue
      const pendingMutations = await getPendingMutations();
      if (pendingMutations.length > 0) {
        console.log(`Flushing ${pendingMutations.length} pending mutations to VPS...`);
        const pushPayload = {
          mutations: pendingMutations.map((m) => ({
            entity_type: m.entity_type,
            entity_id: m.entity_id,
            change_type: m.mutation_type,
            payload: m.payload,
            client_timestamp: m.created_at,
          })),
        };

        const pushResponse = await fetch(`${syncConfig.apiUrl}/api/v1/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': syncConfig.defaultUserId,
          },
          body: JSON.stringify(pushPayload),
        });

        if (pushResponse.ok) {
          const pushData = await pushResponse.json();
          const clearedIds = pendingMutations.map((m) => m.id);
          await clearPendingMutations(clearedIds);
          console.log(`Successfully flushed ${pushData.applied_count} mutations. Current rev: ${pushData.current_sync_rev}`);
        } else {
          console.warn(`Push sync returned HTTP ${pushResponse.status}`);
        }
      }

      // Step B: Reconnection Catch-Up Handshake
      const localRev = await getCurrentSyncRev();
      const deltasResponse = await fetch(
        `${syncConfig.apiUrl}/api/v1/sync/deltas?since_rev=${localRev}&limit=200`,
        {
          method: 'GET',
          headers: {
            'X-User-ID': syncConfig.defaultUserId,
          },
        }
      );

      if (deltasResponse.ok) {
        const deltasData = await deltasResponse.json();
        const deltas: SyncDelta[] = deltasData.deltas || [];
        deltasCount = deltas.length;

        if (deltasCount > 0) {
          console.log(`Applying ${deltasCount} missing server deltas (rev: ${deltasData.current_sync_rev})...`);
          await applyServerDeltas(deltas, deltasData.current_sync_rev);
        }

        this.status = 'synced';
        this.lastSyncedAt = new Date();
        this.emitEvent(deltasCount);
      } else {
        throw new Error(`Server returned HTTP ${deltasResponse.status}`);
      }
    } catch (err: any) {
      this.status = 'offline';
      this.emitEvent(0, err?.message || 'Network request failed');
    } finally {
      this.isSyncing = false;
      if (this.queuedSync) {
        this.queuedSync = false;
        setTimeout(() => this.syncNow(), 200);
      }
    }
  }
}

// Global singleton sync engine instance
export const syncEngine = new SyncEngine();
