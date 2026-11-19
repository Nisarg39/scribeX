/**
 * ScribeX Bidirectional Delta Sync Engine
 * Source of Truth: docs/Unified_Backend_and_AI_Master_Specification.md (Section 3.2 & Phase 2)
 *
 * Manages event-sourced delta synchronization between Local SQLite Outbox and Supabase Realtime CDC.
 * Guarantees:
 * - Strict Auth Gate (dormant in Guest Mode with zero network calls)
 * - 1.5s typing debounce + immediate flushNow() on Editor exit / app background
 * - Outbox Queue Cleanup (deletes committed local sync_changelog rows on Cloud 200 OK ACK)
 * - Multi-Device Realtime CDC reconciliation (~50ms) across Notes, Folders, Tasks, Reminders & Master PIN
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { dbClient } from '../../db/client';
import { tagsRepo } from '../../db/tagsRepo';
import {
  DBEntityRelation,
  DBFolder,
  DBInAppNotification,
  DBNote,
  DBReminder,
  DBSearchHistory,
  DBTask,
  DBWorkspaceSecurity,
} from '../../db/types';
import { NoteItem } from '../../types/note';
import { notificationService } from '../notifications/NotificationService';
import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient';
import {
  reconcileOfflineNotesWithCloud,
  type CloudReconciliationSummary,
} from './noteMergeReconciler';
import {
  PaginatedNotesQuery,
  SyncDelta,
  SyncEngineConfig,
  SyncEventListener,
  SyncStats,
  SyncStatus,
} from './syncTypes';

const STORAGE_LAST_PUSHED_REV = '@scribex_sync_last_pushed_rev';
const STORAGE_LAST_SYNCED_REV = '@scribex_sync_last_synced_rev';

export class SyncEngine {
  private status: SyncStatus = 'idle';
  private config: SyncEngineConfig = {
    userId: 'user-default',
    isGuest: true,
    isDriveConnected: false,
    debounceMs: 1500,
    autoSync: true,
  };
  private lastPushedRev: number = 0;
  private lastSyncedRev: number = 0;
  private lastSyncedAt: string | null = null;
  private lastError: string | null = null;
  private listeners: Set<SyncEventListener> = new Set();
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private isPushing: boolean = false;
  private realtimeChannel: any = null;
  public readonly deviceSessionId: string = `client_${Platform.OS}_${Math.random().toString(36).slice(2, 10)}`;

  private isGuestOrUnauthenticated(): boolean {
    return Boolean(this.config.isGuest || !this.config.userId || this.config.userId === 'user-default');
  }

  /**
   * Hard runtime gate: Cloud Sync MUST NOT run unless user is authenticated AND Google Drive is connected.
   */
  private isSyncGateBlocked(): boolean {
    return this.isGuestOrUnauthenticated() || !this.config.isDriveConnected;
  }

  public isCloudSyncEnabled(): boolean {
    return !this.isSyncGateBlocked();
  }

  public getActiveUserId(): string {
    return this.isGuestOrUnauthenticated() ? 'user-default' : this.config.userId;
  }

  /**
   * Initializes the sync engine, enforcing both the Strict Auth Gate and Mandatory Google Drive Gate
   */
  public async initialize(config?: Partial<SyncEngineConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (this.isSyncGateBlocked()) {
      if (this.pushTimer) {
        clearTimeout(this.pushTimer);
        this.pushTimer = null;
      }
      this.status = this.isGuestOrUnauthenticated() ? 'offline_guest' : 'drive_required';
      this.disconnectRealtimeCDC();
      return;
    }

    try {
      const [storedPushed, storedSynced] = await Promise.all([
        AsyncStorage.getItem(STORAGE_LAST_PUSHED_REV),
        AsyncStorage.getItem(STORAGE_LAST_SYNCED_REV),
      ]);

      if (storedPushed) this.lastPushedRev = parseInt(storedPushed, 10) || 0;
      if (storedSynced) this.lastSyncedRev = parseInt(storedSynced, 10) || 0;
      this.status = 'idle';
    } catch (err: any) {
      console.warn('[SyncEngine] Failed to restore sync revs from storage:', err);
      this.status = 'idle';
    }
  }

  /**
   * Returns current sync telemetry and statistics
   */
  public getStats(): SyncStats {
    return {
      status: this.status,
      lastSyncedAt: this.lastSyncedAt,
      lastSyncedRev: this.lastSyncedRev,
      lastPushedRev: this.lastPushedRev,
      pendingPushesCount: 0,
      error: this.lastError,
    };
  }

  /**
   * Checks whether the local Outbox (sync_changelog) has uncommitted changes.
   * Used by the Lean Cache Eviction Manager to protect dirty notes from eviction.
   */
  public async hasPendingChanges(entityType?: string, entityId?: string): Promise<boolean> {
    try {
      if (entityType && entityId) {
        const row = await dbClient.queryFirst<{ cnt: number }>(
          `SELECT COUNT(*) AS cnt FROM sync_changelog WHERE entity_type = ? AND entity_id = ?;`,
          [entityType, entityId]
        );
        return (row?.cnt || 0) > 0;
      }
      if (entityType) {
        const row = await dbClient.queryFirst<{ cnt: number }>(
          `SELECT COUNT(*) AS cnt FROM sync_changelog WHERE entity_type = ?;`,
          [entityType]
        );
        return (row?.cnt || 0) > 0;
      }
      const row = await dbClient.queryFirst<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM sync_changelog;`
      );
      return (row?.cnt || 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Schedules a 1.5s debounced background push of local uncommitted deltas
   */
  public schedulePush(delayMs: number = this.config.debounceMs || 1500): void {
    if (this.isSyncGateBlocked()) {
      this.status = this.isGuestOrUnauthenticated() ? 'offline_guest' : 'drive_required';
      return;
    }

    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
    }
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.pushPendingDeltas().catch((err) => {
        console.warn('[SyncEngine] Background push failed:', err);
      });
    }, delayMs);
  }

  /**
   * Immediately flushes any pending debounced deltas to Supabase (e.g., on Editor exit or app backgrounding)
   */
  public async flushNow(): Promise<number> {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
    return this.pushPendingDeltas();
  }

  /**
   * Pushes all uncommitted entries from local sync_changelog Outbox to Supabase RPCs in batches of 100
   * and deletes each committed row from local sync_changelog upon 200 OK ACK.
   */
  public async pushPendingDeltas(): Promise<number> {
    if (this.isSyncGateBlocked()) {
      this.status = this.isGuestOrUnauthenticated() ? 'offline_guest' : 'drive_required';
      return 0;
    }
    if (this.isPushing) return 0;

    this.isPushing = true;
    this.status = 'syncing';
    this.lastError = null;

    const UPSERT_PRIORITY: Record<string, number> = {
      folder: 1,
      workspace_security: 2,
      note: 3,
      task: 4,
      reminder: 5,
      relation: 6,
      in_app_notification: 7,
      search_history: 8,
    };

    try {
      let pushedCount = 0;
      const MAX_BATCHES = 50;

      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        if (this.isSyncGateBlocked()) {
          this.status = this.isGuestOrUnauthenticated() ? 'offline_guest' : 'drive_required';
          break;
        }

        const rows = await dbClient.query<any>(
          `SELECT * FROM sync_changelog ORDER BY rowid ASC LIMIT 100;`
        );

        if (!rows || rows.length === 0) {
          break;
        }

        const deltas: SyncDelta[] = rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          syncRev: r.sync_rev,
          entityType: r.entity_type,
          entityId: r.entity_id,
          changeType: r.change_type,
          deltaPayload:
            typeof r.delta_payload === 'string' ? JSON.parse(r.delta_payload) : r.delta_payload,
          callerPlatform: this.deviceSessionId,
          createdAt: r.created_at,
        }));

        deltas.sort((a, b) => {
          const aIsDel = a.changeType === 'delete';
          const bIsDel = b.changeType === 'delete';
          if (aIsDel !== bIsDel) return aIsDel ? 1 : -1;
          const pa = UPSERT_PRIORITY[a.entityType] ?? 99;
          const pb = UPSERT_PRIORITY[b.entityType] ?? 99;
          return aIsDel ? pb - pa : pa - pb;
        });

        for (const delta of deltas) {
          if (this.isSyncGateBlocked()) {
            this.status = this.isGuestOrUnauthenticated() ? 'offline_guest' : 'drive_required';
            break;
          }
          if (isSupabaseConfigured()) {
            await this.pushSingleDeltaToSupabase(delta);
          }

          // Remove committed Outbox entry from local SQLite so zero changelog bloat remains on device
          await dbClient.run(`DELETE FROM sync_changelog WHERE id = ?;`, [delta.id]);
          pushedCount++;

          if (delta.syncRev > this.lastPushedRev) {
            this.lastPushedRev = delta.syncRev;
          }
        }

        if (rows.length < 100) {
          break;
        }
      }

      if (pushedCount > 0) {
        await AsyncStorage.setItem(STORAGE_LAST_PUSHED_REV, this.lastPushedRev.toString());
        this.lastSyncedAt = new Date().toISOString();
      }
      if (!this.isSyncGateBlocked()) {
        this.status = 'idle';
      }
      this.isPushing = false;
      return pushedCount;
    } catch (err: any) {
      this.lastError = err?.message || 'Push sync failed';
      this.status = 'error';
      this.isPushing = false;
      throw err;
    }
  }

  private async rekeyLocalFolderId(oldId: string, newId: string): Promise<void> {
    if (!oldId || !newId || oldId === newId) return;
    await dbClient.withTransaction(async () => {
      await dbClient.run(`UPDATE folders SET id = ? WHERE id = ?;`, [newId, oldId]);
      await dbClient.run(`UPDATE folders SET parent_id = ? WHERE parent_id = ?;`, [newId, oldId]);
      await dbClient.run(`UPDATE notes SET folder_id = ? WHERE folder_id = ?;`, [newId, oldId]);
      await dbClient.run(
        `UPDATE sync_changelog SET entity_id = ? WHERE entity_type = 'folder' AND entity_id = ?;`,
        [newId, oldId]
      );
    });
  }

  private async ensureFolderSyncedToSupabase(
    folderId: string,
    visited: Set<string> = new Set(),
    didRemintId: boolean = false
  ): Promise<boolean> {
    if (!folderId || visited.has(folderId)) return false;
    visited.add(folderId);

    const folder = await dbClient.queryFirst<DBFolder>(
      `SELECT * FROM folders WHERE id = ?;`,
      [folderId]
    );
    if (!folder) return false;

    let parentId: string | null = folder.parent_id || null;
    if (parentId) {
      const parentOk = await this.ensureFolderSyncedToSupabase(parentId, visited);
      if (!parentOk) parentId = null;
    }

    const { data, error } = await supabase.rpc('rpc_upsert_folder', {
      p_id: folder.id,
      p_name: folder.name,
      p_path: folder.path,
      p_parent_id: parentId,
      p_color_token: folder.color_token,
      p_icon: folder.icon,
      p_is_favorite: Boolean(folder.is_favorite),
      p_is_pinned: Boolean(folder.is_pinned),
      p_is_archived: Boolean(folder.is_archived),
      p_is_locked: Boolean(folder.is_locked),
      p_lock_type: folder.lock_type || null,
      p_lock_credential_kind: folder.lock_credential_kind || null,
      p_lock_hash: folder.lock_hash || null,
      p_lock_salt: folder.lock_salt || null,
      p_lock_hint: folder.lock_hint || null,
      p_ai_context_excluded: Boolean(folder.ai_context_excluded),
      p_caller_platform: this.deviceSessionId,
    });

    const isCrossTenantPkCollision =
      !didRemintId &&
      ((!error && !data) ||
        (error && (error.code === '23505' || error.message?.includes('duplicate key'))));

    if (isCrossTenantPkCollision) {
      const remintedId = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await this.rekeyLocalFolderId(folder.id, remintedId);
      const retryVisited = new Set<string>(visited);
      retryVisited.delete(folderId);
      return this.ensureFolderSyncedToSupabase(remintedId, retryVisited, true);
    }

    if (error) throw new Error(error.message);
    if (data?.sync_rev) {
      await dbClient.run(`UPDATE folders SET sync_rev = ? WHERE id = ?;`, [
        data.sync_rev,
        folder.id,
      ]);
    }
    return true;
  }

  private async rekeyLocalNoteId(oldId: string, newId: string): Promise<void> {
    if (!oldId || !newId || oldId === newId) return;
    await dbClient.withTransaction(async () => {
      await dbClient.run(`UPDATE notes SET id = ? WHERE id = ?;`, [newId, oldId]);
      await dbClient.run(`UPDATE note_tags SET note_id = ? WHERE note_id = ?;`, [newId, oldId]);
      await dbClient.run(`UPDATE tasks SET note_id = ? WHERE note_id = ?;`, [newId, oldId]);
      await dbClient.run(`UPDATE reminders SET note_id = ? WHERE note_id = ?;`, [newId, oldId]);
      await dbClient.run(
        `UPDATE reminders SET target_id = ? WHERE target_type = 'note' AND target_id = ?;`,
        [newId, oldId]
      );
      await dbClient.run(
        `UPDATE sync_changelog SET entity_id = ? WHERE entity_type = 'note' AND entity_id = ?;`,
        [newId, oldId]
      );
    });
  }

  private async pushCreateNote(
    note: DBNote,
    parsedBlocks: any[],
    tags: string[],
    overrideFolderId?: string | null,
    didRemintId: boolean = false
  ): Promise<void> {
    const targetFolderId = overrideFolderId !== undefined ? overrideFolderId : note.folder_id;
    const { data, error } = await supabase.rpc('rpc_create_note', {
      p_id: note.id,
      p_title: note.title,
      p_content_markdown: note.content_markdown,
      p_blocks_json: parsedBlocks,
      p_folder_id: targetFolderId,
      p_folder_path: note.folder_path,
      p_tags: tags,
      p_color_token: note.color_token,
      p_is_favorite: Boolean(note.is_favorite),
      p_is_pinned: Boolean(note.is_pinned),
      p_status: note.status,
      p_reminder_at: note.reminder_at,
      p_is_locked: Boolean(note.is_locked),
      p_lock_type: note.lock_type || null,
      p_lock_credential_kind: note.lock_credential_kind || null,
      p_lock_hash: note.lock_hash || null,
      p_lock_salt: note.lock_salt || null,
      p_lock_hint: note.lock_hint || null,
      p_ai_context_excluded: Boolean(note.ai_context_excluded),
      p_caller_platform: this.deviceSessionId,
    });

    const isCrossTenantPkCollision =
      !didRemintId &&
      ((!error && !data) || (error && (error.code === '23505' || error.message?.includes('duplicate key'))));

    if (isCrossTenantPkCollision) {
      const remintedId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await this.rekeyLocalNoteId(note.id, remintedId);
      const remintedNote: DBNote = { ...note, id: remintedId };
      await this.pushCreateNote(remintedNote, parsedBlocks, tags, overrideFolderId, true);
      return;
    }

    if (error) {
      const isFolderFk =
        overrideFolderId === undefined &&
        (error.code === '23503' || error.message?.includes('notes_folder_id_fkey'));
      if (isFolderFk) {
        const folderSynced = note.folder_id
          ? await this.ensureFolderSyncedToSupabase(note.folder_id)
          : false;
        await this.pushCreateNote(
          note,
          parsedBlocks,
          tags,
          folderSynced ? note.folder_id : null,
          didRemintId
        );
        return;
      }
      throw new Error(error.message);
    }
    if (data?.sync_rev) {
      await dbClient.run(`UPDATE notes SET sync_rev = ? WHERE id = ?;`, [
        data.sync_rev,
        note.id,
      ]);
    }
  }

  /**
   * Executes the matching Supabase PostgreSQL Stored Procedure (RPC) for a single Outbox delta
   */
  private async pushSingleDeltaToSupabase(delta: SyncDelta): Promise<void> {
    if (delta.changeType === 'delete') {
      if (delta.entityType === 'folder') {
        const deletedPath = delta.deltaPayload?.deletedPath || delta.deltaPayload?.deleted_path;
        const noteAction =
          delta.deltaPayload?.noteAction || delta.deltaPayload?.note_action || 'moveToGeneral';
        const isCascadeRoot = delta.deltaPayload?.isCascadeRoot !== false;
        if (deletedPath && isCascadeRoot) {
          const { error } = await supabase.rpc('rpc_delete_folder_cascade', {
            p_folder_id: delta.entityId,
            p_folder_path: deletedPath,
            p_note_action: noteAction,
            p_caller_platform: this.deviceSessionId,
          });
          if (error) throw new Error(error.message);
        } else if (!deletedPath) {
          const { error } = await supabase.rpc('rpc_delete_entity', {
            p_entity_type: 'folder',
            p_entity_id: delta.entityId,
            p_caller_platform: this.deviceSessionId,
          });
          if (error) throw new Error(error.message);
        }
        return;
      }

      if (delta.entityType === 'in_app_notification') {
        const { error } = await supabase.rpc('rpc_delete_in_app_notification', {
          p_id: delta.entityId === 'all' ? null : delta.entityId,
          p_caller_platform: this.deviceSessionId,
        });
        if (error) throw new Error(error.message);
        return;
      }

      if (delta.entityType === 'search_history') {
        const isAll = delta.entityId === 'all';
        const { error } = await supabase.rpc('rpc_delete_search_history', {
          p_query_text: isAll
            ? null
            : delta.deltaPayload?.queryText || delta.deltaPayload?.query_text || null,
          p_id: isAll ? null : delta.entityId,
          p_caller_platform: this.deviceSessionId,
        });
        if (error) throw new Error(error.message);
        return;
      }

      if (delta.entityType === 'relation') {
        const { error } = await supabase.rpc('rpc_delete_entity_relation', {
          p_id: delta.entityId,
          p_caller_platform: this.deviceSessionId,
        });
        if (error) throw new Error(error.message);
        return;
      }

      if (['note', 'task', 'reminder'].includes(delta.entityType)) {
        const { error } = await supabase.rpc('rpc_delete_entity', {
          p_entity_type: delta.entityType,
          p_entity_id: delta.entityId,
          p_caller_platform: this.deviceSessionId,
        });
        if (error) throw new Error(error.message);
      }
      return;
    }

    switch (delta.entityType) {
      case 'note': {
        const note = await dbClient.queryFirst<DBNote>(`SELECT * FROM notes WHERE id = ?;`, [
          delta.entityId,
        ]);
        if (!note) return;

        const tagRows = await dbClient.query<{ name: string }>(
          `SELECT t.name FROM tags t INNER JOIN note_tags nt ON nt.tag_id = t.id WHERE nt.note_id = ?;`,
          [note.id]
        );
        const tags = tagRows.map((t) => t.name);
        const parsedBlocks = (() => {
          try {
            return JSON.parse(note.blocks_json || '[]');
          } catch {
            return [];
          }
        })();

        const payloadHasBlocks =
          delta.deltaPayload &&
          (typeof delta.deltaPayload.blocks !== 'undefined' ||
            typeof delta.deltaPayload.blocks_json !== 'undefined');

        const clearFolderId = Boolean(
          delta.deltaPayload?.clearFolderId ||
            (delta.deltaPayload &&
              Object.prototype.hasOwnProperty.call(delta.deltaPayload, 'folderId') &&
              delta.deltaPayload.folderId === null)
        );
        const clearReminderAt = Boolean(
          delta.deltaPayload?.clearReminderAt ||
            (delta.deltaPayload &&
              Object.prototype.hasOwnProperty.call(delta.deltaPayload, 'reminderAt') &&
              delta.deltaPayload.reminderAt === null)
        );

        if (delta.changeType === 'insert') {
          await this.pushCreateNote(note, parsedBlocks, tags);
        } else {
          // Update note: only send p_blocks_json if blocks were actually modified or hydrated
          const { data, error } = await supabase.rpc('rpc_update_note', {
            p_note_id: note.id,
            p_title: note.title,
            p_content_markdown: payloadHasBlocks ? note.content_markdown : null,
            p_blocks_json: payloadHasBlocks ? parsedBlocks : null,
            p_tags: Array.isArray(delta.deltaPayload?.tags) ? tags : null,
            p_folder_id: note.folder_id,
            p_folder_path: note.folder_path,
            p_color_token: note.color_token,
            p_is_favorite: Boolean(note.is_favorite),
            p_is_pinned: Boolean(note.is_pinned),
            p_status: note.status,
            p_reminder_at: note.reminder_at,
            p_is_locked: Boolean(note.is_locked),
            p_lock_type: note.lock_type || null,
            p_lock_credential_kind: note.lock_credential_kind || null,
            p_lock_hash: note.lock_hash || null,
            p_lock_salt: note.lock_salt || null,
            p_lock_hint: note.lock_hint || null,
            p_ai_context_excluded: Boolean(note.ai_context_excluded),
            p_clear_folder_id: clearFolderId,
            p_clear_reminder_at: clearReminderAt,
            p_caller_platform: this.deviceSessionId,
          });
          if (error) {
            const isNotFound =
              error.code === 'P0001' ||
              error.message?.toLowerCase().includes('note not found');
            const isFolderFk =
              error.code === '23503' || error.message?.includes('notes_folder_id_fkey');
            if (isFolderFk) {
              const folderSynced = note.folder_id
                ? await this.ensureFolderSyncedToSupabase(note.folder_id)
                : false;
              const retryRes = await supabase.rpc('rpc_update_note', {
                p_note_id: note.id,
                p_title: note.title,
                p_content_markdown: payloadHasBlocks ? note.content_markdown : null,
                p_blocks_json: payloadHasBlocks ? parsedBlocks : null,
                p_tags: Array.isArray(delta.deltaPayload?.tags) ? tags : null,
                p_folder_id: folderSynced ? note.folder_id : null,
                p_folder_path: note.folder_path,
                p_color_token: note.color_token,
                p_is_favorite: Boolean(note.is_favorite),
                p_is_pinned: Boolean(note.is_pinned),
                p_status: note.status,
                p_reminder_at: note.reminder_at,
                p_is_locked: Boolean(note.is_locked),
                p_lock_type: note.lock_type || null,
                p_lock_credential_kind: note.lock_credential_kind || null,
                p_lock_hash: note.lock_hash || null,
                p_lock_salt: note.lock_salt || null,
                p_lock_hint: note.lock_hint || null,
                p_ai_context_excluded: Boolean(note.ai_context_excluded),
                p_clear_folder_id: clearFolderId || !folderSynced,
                p_clear_reminder_at: clearReminderAt,
                p_caller_platform: this.deviceSessionId,
              });
              if (!retryRes.error) {
                if (retryRes.data?.sync_rev) {
                  await dbClient.run(`UPDATE notes SET sync_rev = ? WHERE id = ?;`, [
                    retryRes.data.sync_rev,
                    note.id,
                  ]);
                }
                return;
              }
              const retryNotFound =
                retryRes.error.code === 'P0001' ||
                retryRes.error.message?.toLowerCase().includes('note not found');
              if (retryNotFound) {
                await this.pushCreateNote(note, parsedBlocks, tags, folderSynced ? note.folder_id : null);
                return;
              }
              throw new Error(retryRes.error.message);
            }
            if (isNotFound) {
              await this.pushCreateNote(note, parsedBlocks, tags);
              return;
            }
            throw new Error(error.message);
          }
          if (data?.sync_rev) {
            await dbClient.run(`UPDATE notes SET sync_rev = ? WHERE id = ?;`, [
              data.sync_rev,
              note.id,
            ]);
          }
        }
        break;
      }

      case 'folder': {
        await this.ensureFolderSyncedToSupabase(delta.entityId);
        const payload = delta.deltaPayload || {};
        if (
          payload.action === 'cascade_path' &&
          payload.oldPath &&
          payload.newPath &&
          payload.oldPath !== payload.newPath
        ) {
          const { error } = await supabase.rpc('rpc_cascade_folder_path_change', {
            p_old_path: payload.oldPath,
            p_new_path: payload.newPath,
            p_caller_platform: this.deviceSessionId,
          });
          if (error) throw new Error(error.message);
        } else if (
          (payload.action === 'archive' || payload.action === 'unarchive') &&
          payload.isCascadeRoot &&
          payload.path
        ) {
          const { error } = await supabase.rpc('rpc_cascade_folder_archive_change', {
            p_folder_id: delta.entityId,
            p_folder_path: payload.path,
            p_is_archived: payload.action === 'archive',
            p_caller_platform: this.deviceSessionId,
          });
          if (error) throw new Error(error.message);
        }
        break;
      }

      case 'task': {
        const task = await dbClient.queryFirst<DBTask>(`SELECT * FROM tasks WHERE id = ?;`, [
          delta.entityId,
        ]);
        if (!task) return;

        if (
          delta.changeType === 'update' &&
          delta.deltaPayload &&
          typeof delta.deltaPayload.isCompleted !== 'undefined' &&
          Object.keys(delta.deltaPayload).length === 1
        ) {
          const { error } = await supabase.rpc('rpc_toggle_task', {
            p_task_id: task.id,
            p_is_completed: Boolean(task.is_completed),
            p_caller_platform: this.deviceSessionId,
          });
          if (error) throw new Error(error.message);
        } else {
          let activeTaskId = task.id;
          let { data: taskData, error } = await supabase.rpc('rpc_create_task', {
            p_id: activeTaskId,
            p_title: task.title,
            p_priority: task.priority,
            p_due_date: task.due_date,
            p_reminder_at: task.reminder_at,
            p_note_id: task.note_id,
            p_caller_platform: this.deviceSessionId,
          });

          const isTaskPkCollision =
            (!error && !taskData) ||
            (error && (error.code === '23505' || error.message?.includes('duplicate key')));

          if (isTaskPkCollision) {
            const remintedTaskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            await dbClient.withTransaction(async () => {
              await dbClient.run(`UPDATE tasks SET id = ? WHERE id = ?;`, [remintedTaskId, activeTaskId]);
              await dbClient.run(
                `UPDATE reminders SET target_id = ? WHERE target_type = 'task' AND target_id = ?;`,
                [remintedTaskId, activeTaskId]
              );
              await dbClient.run(
                `UPDATE sync_changelog SET entity_id = ? WHERE entity_type = 'task' AND entity_id = ?;`,
                [remintedTaskId, activeTaskId]
              );
            });
            activeTaskId = remintedTaskId;
            const retryPk = await supabase.rpc('rpc_create_task', {
              p_id: activeTaskId,
              p_title: task.title,
              p_priority: task.priority,
              p_due_date: task.due_date,
              p_reminder_at: task.reminder_at,
              p_note_id: task.note_id,
              p_caller_platform: this.deviceSessionId,
            });
            taskData = retryPk.data;
            error = retryPk.error;
          }

          if (error) {
            const isNoteFk =
              error.code === '23503' || error.message?.includes('tasks_note_id_fkey');
            if (isNoteFk) {
              let resolvedNoteId: string | null = null;
              if (task.note_id) {
                const parentNote = await dbClient.queryFirst<DBNote>(
                  `SELECT * FROM notes WHERE id = ?;`,
                  [task.note_id]
                );
                if (parentNote) {
                  let parentBlocks: any[] = [];
                  try {
                    parentBlocks = JSON.parse(parentNote.blocks_json || '[]');
                  } catch {
                    parentBlocks = [];
                  }
                  await this.pushCreateNote(parentNote, parentBlocks, []);
                  resolvedNoteId = parentNote.id;
                }
              }
              const retryRes = await supabase.rpc('rpc_create_task', {
                p_id: activeTaskId,
                p_title: task.title,
                p_priority: task.priority,
                p_due_date: task.due_date,
                p_reminder_at: task.reminder_at,
                p_note_id: resolvedNoteId,
                p_caller_platform: this.deviceSessionId,
              });
              if (retryRes.error) throw new Error(retryRes.error.message);
            } else {
              throw new Error(error.message);
            }
          }
          if (task.is_completed || typeof delta.deltaPayload?.isCompleted === 'boolean') {
            await supabase.rpc('rpc_toggle_task', {
              p_task_id: activeTaskId,
              p_is_completed: Boolean(task.is_completed),
              p_caller_platform: this.deviceSessionId,
            });
          }
        }
        break;
      }

      case 'reminder': {
        const reminder = await dbClient.queryFirst<DBReminder>(
          `SELECT * FROM reminders WHERE id = ?;`,
          [delta.entityId]
        );
        if (!reminder) return;

        if (reminder.is_dismissed || delta.deltaPayload?.isDismissed) {
          const { error } = await supabase.rpc('rpc_dismiss_reminder', {
            p_reminder_id: reminder.id,
            p_caller_platform: this.deviceSessionId,
          });
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.rpc('rpc_schedule_reminder', {
            p_id: reminder.id,
            p_target_type: reminder.target_type,
            p_target_id: reminder.target_id,
            p_trigger_at: reminder.trigger_at,
            p_title: delta.deltaPayload?.title || 'Reminder',
            p_body: delta.deltaPayload?.body || '',
            p_recurrence_rule: delta.deltaPayload?.recurrenceRule || null,
            p_caller_platform: this.deviceSessionId,
          });
          if (error) throw new Error(error.message);
        }
        break;
      }

      case 'workspace_security': {
        const ws = await dbClient.queryFirst<DBWorkspaceSecurity>(
          `SELECT * FROM workspace_security WHERE id = 'default' LIMIT 1;`
        );
        if (!ws) return;

        // Strictly syncs Master PIN/Password and auto-relock settings; NEVER syncs biometrics_enabled
        const { error } = await supabase.rpc('rpc_upsert_workspace_security', {
          p_app_lock_enabled: Boolean(ws.app_lock_enabled),
          p_master_credential_type: ws.master_credential_type,
          p_master_hash: ws.master_hash,
          p_master_salt: ws.master_salt,
          p_master_hint: ws.master_hint,
          p_auto_relock_seconds: ws.auto_relock_seconds,
          p_caller_platform: this.deviceSessionId,
        });
        if (error) throw new Error(error.message);
        break;
      }

      case 'in_app_notification': {
        const p = delta.deltaPayload || {};
        if (
          delta.changeType === 'update' &&
          (delta.entityId === 'all' || typeof p.isRead !== 'undefined' || typeof p.is_read !== 'undefined')
        ) {
          const isRead = typeof p.isRead !== 'undefined' ? Boolean(p.isRead) : Boolean(p.is_read ?? true);
          const { error } = await supabase.rpc('rpc_mark_notifications_read', {
            p_id: delta.entityId === 'all' ? null : delta.entityId,
            p_is_read: isRead,
            p_caller_platform: this.deviceSessionId,
          });
          if (error) throw new Error(error.message);
          break;
        }

        const notif = await dbClient.queryFirst<DBInAppNotification>(
          `SELECT * FROM in_app_notifications WHERE id = ?;`,
          [delta.entityId]
        );
        if (!notif) return;

        const { error } = await supabase.rpc('rpc_upsert_in_app_notification', {
          p_id: notif.id,
          p_target_type: notif.target_type,
          p_target_id: notif.target_id,
          p_title: notif.title,
          p_body: notif.body || '',
          p_trigger_at: notif.trigger_at,
          p_reminder_id: notif.reminder_id || null,
          p_note_id: notif.note_id || null,
          p_recurrence_rule: notif.recurrence_rule || null,
          p_is_read: Boolean(notif.is_read),
          p_read_at: notif.read_at || null,
          p_is_cleared: Boolean(notif.is_cleared),
          p_cleared_at: notif.cleared_at || null,
          p_caller_platform: this.deviceSessionId,
        });
        if (error) throw new Error(error.message);
        break;
      }

      case 'search_history': {
        const row = await dbClient.queryFirst<DBSearchHistory>(
          `SELECT * FROM search_history WHERE id = ?;`,
          [delta.entityId]
        );
        const p = delta.deltaPayload || {};
        const queryText = row?.query_text || p.queryText || p.query_text;
        if (!queryText) return;

        let filterSnapshot: Record<string, any> = {};
        if (row?.filter_snapshot_json) {
          try {
            filterSnapshot = JSON.parse(row.filter_snapshot_json);
          } catch {
            filterSnapshot = {};
          }
        } else if (p.filterSnapshot && typeof p.filterSnapshot === 'object') {
          filterSnapshot = p.filterSnapshot;
        }

        const { data, error } = await supabase.rpc('rpc_upsert_search_history', {
          p_id: row?.id || delta.entityId,
          p_query_text: queryText,
          p_source: row?.source || p.source || 'text',
          p_filter_snapshot: filterSnapshot,
          p_use_count: row?.use_count || p.useCount || 1,
          p_last_used_at: row?.last_used_at || p.lastUsedAt || new Date().toISOString(),
          p_caller_platform: this.deviceSessionId,
        });
        if (error) throw new Error(error.message);
        if (data?.id && row?.id && data.id !== row.id) {
          await dbClient.run(`DELETE FROM search_history WHERE id = ?;`, [data.id]).catch(() => {});
          await dbClient.run(`UPDATE search_history SET id = ? WHERE id = ?;`, [data.id, row.id]).catch(() => {});
        }
        break;
      }

      case 'relation': {
        const rel = await dbClient.queryFirst<DBEntityRelation>(
          `SELECT * FROM entity_relations WHERE id = ?;`,
          [delta.entityId]
        );
        if (!rel) return;

        const { error } = await supabase.rpc('rpc_upsert_entity_relation', {
          p_id: rel.id,
          p_source_id: rel.source_id,
          p_target_id: rel.target_id,
          p_relation_type: rel.relation_type,
          p_created_by: rel.created_by || 'user',
          p_confidence_score: typeof rel.confidence_score === 'number' ? rel.confidence_score : 1.0,
          p_metadata: delta.deltaPayload?.metadata || {},
          p_caller_platform: this.deviceSessionId,
        });
        if (error) throw new Error(error.message);
        break;
      }

      default:
        break;
    }
  }

  /**
   * Fetches a paginated page of lightweight note card previews from Supabase (`rpc_list_notes_paginated`)
   */
  public async fetchPaginatedNotesFromCloud(query: PaginatedNotesQuery = {}): Promise<any[]> {
    if (!isSupabaseConfigured() || this.isSyncGateBlocked()) return [];

    const { data, error } = await supabase.rpc('rpc_list_notes_paginated', {
      p_status: typeof query.status === 'undefined' ? 'active' : query.status,
      p_folder_id: query.folderId || null,
      p_folder_path: query.folderPath || null,
      p_is_favorite: typeof query.isFavorite === 'boolean' ? query.isFavorite : null,
      p_search_query: query.searchQuery || null,
      p_limit: query.limit || 20,
      p_offset: query.offset || 0,
    });

    if (error) {
      throw new Error(error.message);
    }
    return Array.isArray(data) ? data : [];
  }

  /**
   * Fetches a single full note with complete `blocks_json` from Supabase (`rpc_get_note_by_id`)
   * for on-demand hydration when opening the Note Editor.
   */
  public async fetchFullNoteFromCloud(noteId: string): Promise<any | null> {
    if (!isSupabaseConfigured() || this.isSyncGateBlocked() || !noteId) return null;

    const { data, error } = await supabase.rpc('rpc_get_note_by_id', {
      p_note_id: noteId,
    });

    if (error) {
      throw new Error(error.message);
    }
    return data || null;
  }

  public isAuthenticatedSession(): boolean {
    return !this.isSyncGateBlocked();
  }

  /**
   * Executes Lean-Cache-safe server-side folder duplication (`rpc_duplicate_folder_cascade`)
   * so clean dehydrated Page-1 notes and evicted Page-2+ notes clone with FULL `blocks_json`
   * and `note_tags` on Supabase and broadcast cleanly to Device B.
   */
  public async duplicateFolderCascadeInCloud(
    sourceFolderId: string,
    sourcePath: string,
    newName?: string
  ): Promise<{ newFolder: DBFolder; duplicatedNotesCount: number } | null> {
    if (!isSupabaseConfigured() || this.isSyncGateBlocked()) return null;

    // Flush any pending local edits (e.g. recently edited notes in the source folder) first
    await this.flushNow().catch(() => {});

    const clientFolderId = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase.rpc('rpc_duplicate_folder_cascade', {
      p_source_folder_id: sourceFolderId,
      p_source_path: sourcePath,
      p_new_folder_id: clientFolderId,
      p_new_name: newName || null,
      p_caller_platform: this.deviceSessionId,
    });

    if (error) {
      throw new Error(error.message);
    }
    if (!data?.folder?.id) return null;

    const uid = this.config.userId;
    const cf = data.folder;
    const clonedFolders: any[] = Array.isArray(data.folders) && data.folders.length > 0 ? data.folders : [cf];
    const clonedNotes: any[] = Array.isArray(data.notes) ? data.notes : [];

    await dbClient.withTransaction(async () => {
      for (const folderItem of clonedFolders) {
        if (!folderItem?.id) continue;
        await this.applyFolderDelta({
          id: `dup-folder-${folderItem.id}`,
          userId: uid,
          syncRev: folderItem.sync_rev || 1,
          entityType: 'folder',
          entityId: folderItem.id,
          changeType: 'insert',
          deltaPayload: folderItem,
          callerPlatform: 'cloud_dup',
          createdAt: folderItem.created_at || new Date().toISOString(),
        });
      }

      for (const cn of clonedNotes) {
        if (!cn?.id) continue;
        await this.applyNoteDelta({
          id: `dup-note-${cn.id}`,
          userId: uid,
          syncRev: cn.sync_rev || 1,
          entityType: 'note',
          entityId: cn.id,
          changeType: 'insert',
          deltaPayload: cn,
          callerPlatform: 'cloud_dup',
          createdAt: cn.created_at || new Date().toISOString(),
        });
      }
    });

    const localFolder = await dbClient.queryFirst<DBFolder>(
      `SELECT * FROM folders WHERE id = ?;`,
      [cf.id]
    );
    if (!localFolder) return null;

    return {
      newFolder: localFolder,
      duplicatedNotesCount: Number(data.duplicated_notes_count ?? clonedNotes.length) || 0,
    };
  }

  /**
   * Reconciles pending offline/guest notes against existing cloud notes BEFORE flushing:
   * - Matching note.id in cloud -> merges non-destructively (blocks by block.id + tag union)
   * - Unmatched note.id -> prepares clean brand-new note insert with folder path remapping
   */
  public async reconcileLocalVaultWithCloud(): Promise<CloudReconciliationSummary> {
    if (!isSupabaseConfigured() || this.isSyncGateBlocked()) {
      return { mergedCount: 0, newCount: 0, skippedNoOpCount: 0 };
    }
    return reconcileOfflineNotesWithCloud(this.config.userId);
  }

  /**
   * Pulls synced folders, tasks, active reminders, and workspace Master PIN metadata from Supabase
   * so secondary / fresh devices hydrate cleanly on sign-in without overwriting uncommitted Outbox items.
   */
  public async pullWorkspaceMetadataFromCloud(): Promise<void> {
    if (!isSupabaseConfigured() || !this.isAuthenticatedSession()) return;

    const uid = this.config.userId;
    const [
      foldersRes,
      tasksRes,
      remindersRes,
      securityRes,
      notificationsRes,
      searchHistoryRes,
      relationsRes,
      dirtyRows,
    ] = await Promise.all([
      supabase.from('folders').select('*').eq('user_id', uid),
      supabase.from('tasks').select('*').eq('user_id', uid),
      supabase.from('reminders').select('*').eq('user_id', uid).eq('is_dismissed', false),
      supabase.from('workspace_security').select('*').eq('user_id', uid).maybeSingle(),
      supabase
        .from('in_app_notifications')
        .select('*')
        .eq('user_id', uid)
        .eq('is_cleared', false)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('search_history')
        .select('*')
        .eq('user_id', uid)
        .order('last_used_at', { ascending: false })
        .limit(50),
      supabase.from('entity_relations').select('*').eq('user_id', uid),
      dbClient.query<{ entity_type: string; entity_id: string }>(
        `SELECT DISTINCT entity_type, entity_id FROM sync_changelog;`
      ),
    ]);

    const dirtyKeySet = new Set(dirtyRows.map((r) => `${r.entity_type}:${r.entity_id}`));
    const remindersToCancelAlarm: string[] = [];

    await dbClient.withTransaction(async () => {
      if (!foldersRes.error && Array.isArray(foldersRes.data)) {
        // Sort folders by path depth ascending so parents are ALWAYS inserted before children (PRAGMA foreign_keys = ON)
        const sortedFolders = [...foldersRes.data].sort((a, b) => {
          const depthA = String(a.path || a.name || '').split('/').filter(Boolean).length;
          const depthB = String(b.path || b.name || '').split('/').filter(Boolean).length;
          return depthA - depthB || String(a.path || '').localeCompare(String(b.path || ''));
        });
        const cloudFolderIds = new Set<string>();
        for (const f of sortedFolders) {
          if (f?.id) cloudFolderIds.add(f.id);
          if (dirtyKeySet.has(`folder:${f.id}`)) continue;
          await this.applyFolderDelta({
            id: `pull-folder-${f.id}`,
            userId: uid,
            syncRev: f.sync_rev || 1,
            entityType: 'folder',
            entityId: f.id,
            changeType: 'insert',
            deltaPayload: f,
            callerPlatform: 'cloud_pull',
            createdAt: f.created_at || new Date().toISOString(),
          });
        }
        // Reconcile remotely deleted folders (only clean local rows belonging to this user)
        const localFolders = await dbClient.query<{ id: string }>(
          `SELECT id FROM folders WHERE user_id = ?;`,
          [uid]
        );
        for (const lf of localFolders) {
          if (!cloudFolderIds.has(lf.id) && !dirtyKeySet.has(`folder:${lf.id}`)) {
            await dbClient.run(`DELETE FROM folders WHERE id = ?;`, [lf.id]);
          }
        }
      }

      if (!tasksRes.error && Array.isArray(tasksRes.data)) {
        const cloudTaskIds = new Set<string>();
        for (const t of tasksRes.data) {
          if (t?.id) cloudTaskIds.add(t.id);
          if (dirtyKeySet.has(`task:${t.id}`)) continue;
          await this.applyTaskDelta({
            id: `pull-task-${t.id}`,
            userId: uid,
            syncRev: t.sync_rev || 1,
            entityType: 'task',
            entityId: t.id,
            changeType: 'insert',
            deltaPayload: t,
            callerPlatform: 'cloud_pull',
            createdAt: t.created_at || new Date().toISOString(),
          });
        }
        // Reconcile remotely deleted tasks
        const localTasks = await dbClient.query<{ id: string }>(
          `SELECT id FROM tasks WHERE user_id = ?;`,
          [uid]
        );
        for (const lt of localTasks) {
          if (!cloudTaskIds.has(lt.id) && !dirtyKeySet.has(`task:${lt.id}`)) {
            await dbClient.run(`DELETE FROM tasks WHERE id = ?;`, [lt.id]);
          }
        }
      }

      if (!remindersRes.error && Array.isArray(remindersRes.data)) {
        const cloudActiveReminderIds = new Set<string>();
        for (const r of remindersRes.data) {
          if (r?.id) cloudActiveReminderIds.add(r.id);
          if (dirtyKeySet.has(`reminder:${r.id}`)) continue;
          await this.applyReminderDelta({
            id: `pull-rem-${r.id}`,
            userId: uid,
            syncRev: r.sync_rev || 1,
            entityType: 'reminder',
            entityId: r.id,
            changeType: 'insert',
            deltaPayload: r,
            callerPlatform: 'cloud_pull',
            createdAt: r.created_at || new Date().toISOString(),
          });
        }
        // Reconcile remotely dismissed/deleted reminders
        const localActiveReminders = await dbClient.query<{ id: string; notification_id: string | null }>(
          `SELECT id, notification_id FROM reminders WHERE user_id = ? AND is_dismissed = 0;`,
          [uid]
        );
        for (const lr of localActiveReminders) {
          if (!cloudActiveReminderIds.has(lr.id) && !dirtyKeySet.has(`reminder:${lr.id}`)) {
            await dbClient.run(
              `UPDATE reminders SET is_dismissed = 1, dismissed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
              [lr.id]
            );
            remindersToCancelAlarm.push(lr.notification_id || lr.id);
          }
        }
      }

      if (!securityRes.error && securityRes.data && !dirtyKeySet.has('workspace_security:default')) {
        await this.applyWorkspaceSecurityDelta({
          id: `pull-ws-${uid}`,
          userId: uid,
          syncRev: securityRes.data.sync_rev || 1,
          entityType: 'workspace_security',
          entityId: uid,
          changeType: 'update',
          deltaPayload: securityRes.data,
          callerPlatform: 'cloud_pull',
          createdAt: securityRes.data.updated_at || new Date().toISOString(),
        });
      }

      if (
        !notificationsRes.error &&
        Array.isArray(notificationsRes.data) &&
        !dirtyKeySet.has('in_app_notification:all')
      ) {
        const cloudNotifIds = new Set<string>();
        for (const n of notificationsRes.data) {
          if (n?.id) cloudNotifIds.add(n.id);
          if (dirtyKeySet.has(`in_app_notification:${n.id}`)) continue;
          await this.applyNotificationDelta({
            id: `pull-notif-${n.id}`,
            userId: uid,
            syncRev: n.sync_rev || 1,
            entityType: 'in_app_notification',
            entityId: n.id,
            changeType: 'insert',
            deltaPayload: n,
            callerPlatform: 'cloud_pull',
            createdAt: n.created_at || new Date().toISOString(),
          });
        }
        // Reconcile remotely cleared notifications
        const localUncleared = await dbClient.query<{ id: string }>(
          `SELECT id FROM in_app_notifications WHERE user_id = ? AND is_cleared = 0;`,
          [uid]
        );
        for (const ln of localUncleared) {
          if (!cloudNotifIds.has(ln.id) && !dirtyKeySet.has(`in_app_notification:${ln.id}`)) {
            await dbClient.run(
              `UPDATE in_app_notifications SET is_cleared = 1, cleared_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
              [ln.id]
            );
          }
        }
      }

      if (
        !searchHistoryRes.error &&
        Array.isArray(searchHistoryRes.data) &&
        !dirtyKeySet.has('search_history:all')
      ) {
        const cloudSearchIds = new Set<string>();
        for (const sh of searchHistoryRes.data) {
          if (sh?.id) cloudSearchIds.add(sh.id);
          if (dirtyKeySet.has(`search_history:${sh.id}`)) continue;
          await this.applySearchHistoryDelta({
            id: `pull-sh-${sh.id}`,
            userId: uid,
            syncRev: sh.sync_rev || 1,
            entityType: 'search_history',
            entityId: sh.id,
            changeType: 'insert',
            deltaPayload: sh,
            callerPlatform: 'cloud_pull',
            createdAt: sh.created_at || new Date().toISOString(),
          });
        }
        // Reconcile remotely deleted/cleared search history items
        const localSearchRows = await dbClient.query<{ id: string }>(
          `SELECT id FROM search_history WHERE user_id = ?;`,
          [uid]
        );
        for (const lsh of localSearchRows) {
          if (!cloudSearchIds.has(lsh.id) && !dirtyKeySet.has(`search_history:${lsh.id}`)) {
            await dbClient.run(`DELETE FROM search_history WHERE id = ?;`, [lsh.id]);
          }
        }
      }

      if (!relationsRes.error && Array.isArray(relationsRes.data)) {
        const cloudRelIds = new Set<string>();
        for (const rel of relationsRes.data) {
          if (rel?.id) cloudRelIds.add(rel.id);
          if (dirtyKeySet.has(`relation:${rel.id}`)) continue;
          await this.applyRelationDelta({
            id: `pull-rel-${rel.id}`,
            userId: uid,
            syncRev: 1,
            entityType: 'relation',
            entityId: rel.id,
            changeType: 'insert',
            deltaPayload: rel,
            callerPlatform: 'cloud_pull',
            createdAt: rel.created_at || new Date().toISOString(),
          });
        }
        // Reconcile remotely deleted entity relations
        const localRels = await dbClient.query<{ id: string }>(
          `SELECT id FROM entity_relations WHERE user_id = ?;`,
          [uid]
        );
        for (const lr of localRels) {
          if (!cloudRelIds.has(lr.id) && !dirtyKeySet.has(`relation:${lr.id}`)) {
            await dbClient.run(`DELETE FROM entity_relations WHERE id = ?;`, [lr.id]);
          }
        }
      }
    });

    for (const alarmKey of remindersToCancelAlarm) {
      await notificationService.cancelReminder(alarmKey).catch(() => {});
    }
  }

  /**
   * Ingests an incoming CDC delta from Supabase Realtime and applies it locally in <2ms
   */
  public async applyRemoteDelta(delta: SyncDelta): Promise<void> {
    // Skip self-echoes originating from this exact device session
    if (delta.callerPlatform && delta.callerPlatform === this.deviceSessionId) {
      return;
    }

    try {
      await dbClient.withTransaction(async () => {
        switch (delta.entityType) {
          case 'reminder': {
            await this.applyReminderDelta(delta);
            break;
          }
          case 'task': {
            await this.applyTaskDelta(delta);
            break;
          }
          case 'note': {
            await this.applyNoteDelta(delta);
            break;
          }
          case 'folder': {
            await this.applyFolderDelta(delta);
            break;
          }
          case 'workspace_security': {
            await this.applyWorkspaceSecurityDelta(delta);
            break;
          }
          case 'in_app_notification': {
            await this.applyNotificationDelta(delta);
            break;
          }
          case 'search_history': {
            await this.applySearchHistoryDelta(delta);
            break;
          }
          case 'relation': {
            await this.applyRelationDelta(delta);
            break;
          }
          default:
            break;
        }
      });

      if (delta.syncRev > this.lastSyncedRev) {
        this.lastSyncedRev = delta.syncRev;
        await AsyncStorage.setItem(STORAGE_LAST_SYNCED_REV, delta.syncRev.toString());
      }
      this.lastSyncedAt = new Date().toISOString();

      this.notifyListeners(delta);
    } catch (err: any) {
      console.error('[SyncEngine] Failed to apply remote delta:', err, delta);
      throw err;
    }
  }

  /**
   * Applies incoming remote reminder delta and coordinates native hardware alarms
   */
  private async applyReminderDelta(delta: SyncDelta): Promise<void> {
    const payload = delta.deltaPayload || {};

    if (delta.changeType === 'delete' || payload.is_dismissed) {
      await dbClient.run(
        `UPDATE reminders SET is_dismissed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
        [delta.entityId]
      );
      await notificationService.cancelReminder(delta.entityId);
    } else {
      await dbClient.run(
        `INSERT INTO reminders (
          id, user_id, target_type, target_id, note_id, trigger_at,
          notification_id, channel_id, is_dismissed, device_id, sync_rev, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          trigger_at = excluded.trigger_at,
          is_dismissed = excluded.is_dismissed,
          device_id = excluded.device_id,
          sync_rev = excluded.sync_rev,
          updated_at = CURRENT_TIMESTAMP;`,
        [
          delta.entityId,
          delta.userId || this.config.userId,
          payload.target_type || payload.targetType || 'task',
          payload.target_id || payload.targetId || delta.entityId,
          payload.note_id || payload.noteId || null,
          payload.trigger_at || payload.triggerAt,
          payload.notification_id || payload.notificationId || null,
          payload.channel_id || payload.channelId || 'scribex_reminders',
          payload.is_dismissed ? 1 : 0,
          delta.callerPlatform || 'cloud_sync',
          delta.syncRev,
        ]
      );

      if (payload.trigger_at || payload.triggerAt) {
        const triggerAt = payload.trigger_at || payload.triggerAt;
        const triggerDate = new Date(triggerAt);
        if (triggerDate.getTime() > Date.now()) {
          await notificationService.handleRemoteSyncDelta(
            'insert',
            {
              id: delta.entityId,
              userId: delta.userId || this.config.userId,
              targetType: payload.target_type || payload.targetType || 'task',
              targetId: payload.target_id || payload.targetId || delta.entityId,
              noteId: payload.note_id || payload.noteId,
              triggerAt,
              channelId: 'scribex_reminders',
              isDismissed: false,
              deviceId: 'remote_sync',
              syncRev: delta.syncRev,
              createdAt: delta.createdAt,
              updatedAt: delta.createdAt,
            },
            payload.title || 'Reminder',
            payload.body || ''
          );
        }
      }
    }
  }

  /**
   * Applies incoming remote task delta
   */
  private async applyTaskDelta(delta: SyncDelta): Promise<void> {
    const p = delta.deltaPayload || {};

    if (delta.changeType === 'delete') {
      await dbClient.run(`DELETE FROM tasks WHERE id = ?;`, [delta.entityId]);
      await notificationService.cancelReminder(delta.entityId);
    } else if (delta.changeType === 'update' && typeof p.is_completed !== 'undefined' && !p.title) {
      await dbClient.run(
        `UPDATE tasks SET is_completed = ?, sync_rev = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
        [p.is_completed ? 1 : 0, delta.syncRev, delta.entityId]
      );
      if (p.is_completed) {
        await dbClient.run(
          `UPDATE reminders SET is_dismissed = 1, updated_at = CURRENT_TIMESTAMP WHERE target_id = ?;`,
          [delta.entityId]
        );
        await notificationService.cancelReminder(delta.entityId);
      }
    } else {
      await dbClient.run(
        `INSERT INTO tasks (
          id, user_id, note_id, note_title, note_color_token, block_id,
          title, is_completed, priority, due_date, reminder_at, sync_rev, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          is_completed = excluded.is_completed,
          priority = excluded.priority,
          due_date = excluded.due_date,
          reminder_at = excluded.reminder_at,
          sync_rev = excluded.sync_rev,
          updated_at = CURRENT_TIMESTAMP;`,
        [
          delta.entityId,
          delta.userId || this.config.userId,
          p.note_id || null,
          p.note_title || null,
          p.note_color_token || null,
          p.block_id || null,
          p.title || 'Untitled Task',
          p.is_completed ? 1 : 0,
          p.priority || 'none',
          p.due_date || null,
          p.reminder_at || null,
          delta.syncRev,
        ]
      );
    }
  }

  /**
   * Applies incoming remote note delta (preserving lock, AI context & omitted partial fields cleanly)
   */
  private async applyNoteDelta(delta: SyncDelta): Promise<void> {
    const p = delta.deltaPayload || {};
    const effectiveUserId = delta.userId || this.config.userId;

    if (delta.changeType === 'delete') {
      await dbClient.run(`DELETE FROM note_tags WHERE note_id = ?;`, [delta.entityId]);
      await dbClient.run(`DELETE FROM entity_relations WHERE source_id = ? OR target_id = ?;`, [
        delta.entityId,
        delta.entityId,
      ]);
      await dbClient.run(`DELETE FROM notes WHERE id = ?;`, [delta.entityId]);
    } else {
      const blocksJsonStr =
        typeof p.blocks_json === 'string'
          ? p.blocks_json
          : JSON.stringify(p.blocks_json || []);

      const hasKey = (key: string) => Object.prototype.hasOwnProperty.call(p, key) ? 1 : 0;

      // Validate folder_id against local folders table so out-of-order CDC never crashes PRAGMA foreign_keys = ON
      let safeFolderId: string | null = p.folder_id || null;
      if (safeFolderId) {
        const folderExists = await dbClient.queryFirst<{ id: string }>(
          `SELECT id FROM folders WHERE id = ? LIMIT 1;`,
          [safeFolderId]
        );
        if (!folderExists) {
          safeFolderId = null;
        }
      }

      const hasTitle = hasKey('title');
      const hasFolderId = hasKey('folder_id');
      const hasFolderPath = hasKey('folder_path');
      const hasContentMarkdown = hasKey('content_markdown');
      const hasBlocksJson = hasKey('blocks_json');
      const hasColorToken = hasKey('color_token');
      const hasIsFavorite = hasKey('is_favorite');
      const hasIsPinned = hasKey('is_pinned');
      const hasStatus = hasKey('status');
      const hasReminderAt = hasKey('reminder_at');
      const hasIsLocked = hasKey('is_locked');
      const hasLockType = hasKey('lock_type');
      const hasLockCredKind = hasKey('lock_credential_kind');
      const hasLockHash = hasKey('lock_hash');
      const hasLockSalt = hasKey('lock_salt');
      const hasLockHint = hasKey('lock_hint');
      const hasAiContextExcluded = hasKey('ai_context_excluded');

      await dbClient.run(
        `INSERT INTO notes (
          id, user_id, folder_id, folder_path, group_name, title,
          content_markdown, blocks_json, color_token, is_favorite, is_pinned,
          status, priority_score, reminder_at,
          is_locked, lock_type, lock_credential_kind, lock_hash, lock_salt, lock_hint,
          ai_context_excluded, sync_rev, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          title = CASE WHEN ? = 1 THEN excluded.title ELSE notes.title END,
          folder_id = CASE WHEN ? = 1 THEN excluded.folder_id ELSE notes.folder_id END,
          folder_path = CASE WHEN ? = 1 THEN excluded.folder_path ELSE notes.folder_path END,
          content_markdown = CASE WHEN ? = 1 THEN excluded.content_markdown ELSE notes.content_markdown END,
          blocks_json = CASE WHEN ? = 1 THEN excluded.blocks_json ELSE notes.blocks_json END,
          color_token = CASE WHEN ? = 1 THEN excluded.color_token ELSE notes.color_token END,
          is_favorite = CASE WHEN ? = 1 THEN excluded.is_favorite ELSE notes.is_favorite END,
          is_pinned = CASE WHEN ? = 1 THEN excluded.is_pinned ELSE notes.is_pinned END,
          status = CASE WHEN ? = 1 THEN excluded.status ELSE notes.status END,
          reminder_at = CASE WHEN ? = 1 THEN excluded.reminder_at ELSE notes.reminder_at END,
          is_locked = CASE WHEN ? = 1 THEN excluded.is_locked ELSE notes.is_locked END,
          lock_type = CASE WHEN ? = 1 THEN excluded.lock_type ELSE notes.lock_type END,
          lock_credential_kind = CASE WHEN ? = 1 THEN excluded.lock_credential_kind ELSE notes.lock_credential_kind END,
          lock_hash = CASE WHEN ? = 1 THEN excluded.lock_hash ELSE notes.lock_hash END,
          lock_salt = CASE WHEN ? = 1 THEN excluded.lock_salt ELSE notes.lock_salt END,
          lock_hint = CASE WHEN ? = 1 THEN excluded.lock_hint ELSE notes.lock_hint END,
          ai_context_excluded = CASE WHEN ? = 1 THEN excluded.ai_context_excluded ELSE notes.ai_context_excluded END,
          sync_rev = excluded.sync_rev,
          updated_at = CURRENT_TIMESTAMP;`,
        [
          delta.entityId,
          effectiveUserId,
          safeFolderId,
          p.folder_path || 'General',
          p.group_name || null,
          p.title || 'Untitled Note',
          p.content_markdown || '',
          blocksJsonStr,
          p.color_token || 'apricot',
          p.is_favorite ? 1 : 0,
          p.is_pinned ? 1 : 0,
          p.status || 'active',
          p.priority_score || 0.0,
          p.reminder_at || null,
          p.is_locked ? 1 : 0,
          p.lock_type || null,
          p.lock_credential_kind || null,
          p.lock_hash || null,
          p.lock_salt || null,
          p.lock_hint || null,
          p.ai_context_excluded ? 1 : 0,
          delta.syncRev,
          hasTitle,
          hasFolderId,
          hasFolderPath,
          hasContentMarkdown,
          hasBlocksJson,
          hasColorToken,
          hasIsFavorite,
          hasIsPinned,
          hasStatus,
          hasReminderAt,
          hasIsLocked,
          hasLockType,
          hasLockCredKind,
          hasLockHash,
          hasLockSalt,
          hasLockHint,
          hasAiContextExcluded,
        ]
      );

      // Sync remote tags (including empty array [] clear) onto Device B immediately
      if (Array.isArray(p.tags)) {
        await tagsRepo.setNoteTags(delta.entityId, p.tags, effectiveUserId);
      }
    }
  }

  /**
   * Applies incoming remote folder delta (including server-side cascade_path, cascade_archive & cascade delete)
   */
  private async applyFolderDelta(delta: SyncDelta): Promise<void> {
    const p = delta.deltaPayload || {};

    if (delta.changeType === 'delete') {
      const deletedPath = String(p.deleted_path || p.deletedPath || '')
        .trim()
        .replace(/^\/+|\/+$/g, '');
      const noteAction = p.note_action || p.noteAction || 'moveToGeneral';

      if (deletedPath) {
        if (noteAction === 'trash' || noteAction === 'moveToTrash') {
          await dbClient.run(
            `UPDATE notes
             SET status = 'trashed', trashed_at = CURRENT_TIMESTAMP, folder_id = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE folder_id = ? OR folder_path = ? OR SUBSTR(COALESCE(folder_path, ''), 1, LENGTH(?) + 1) = ? || '/';`,
            [delta.entityId, deletedPath, deletedPath, deletedPath]
          );
        } else {
          await dbClient.run(
            `UPDATE notes
             SET folder_path = 'General', folder_id = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE folder_id = ? OR folder_path = ? OR SUBSTR(COALESCE(folder_path, ''), 1, LENGTH(?) + 1) = ? || '/';`,
            [delta.entityId, deletedPath, deletedPath, deletedPath]
          );
        }

        await dbClient.run(
          `DELETE FROM folders WHERE id = ? OR path = ? OR SUBSTR(path, 1, LENGTH(?) + 1) = ? || '/';`,
          [delta.entityId, deletedPath, deletedPath, deletedPath]
        );
      } else {
        await dbClient.run(`DELETE FROM folders WHERE id = ?;`, [delta.entityId]);
      }
      return;
    }

    // Handle server-broadcast folder path rename/move cascade (exact prefix match — wildcard safe)
    if (p.action === 'cascade_path') {
      const oldPath = String(p.old_path || p.oldPath || '')
        .trim()
        .replace(/^\/+|\/+$/g, '');
      const newPath = String(p.new_path || p.newPath || '')
        .trim()
        .replace(/^\/+|\/+$/g, '');
      const folderId = p.folder_id || p.folderId || null;

      if (oldPath && newPath && oldPath !== newPath) {
        const newBasename = newPath.split('/').pop() || newPath;
        await dbClient.run(
          `UPDATE folders SET name = ?, path = ?, updated_at = CURRENT_TIMESTAMP WHERE path = ?;`,
          [newBasename, newPath, oldPath]
        );
        const childFolders = await dbClient.query<{ id: string; path: string }>(
          `SELECT id, path FROM folders WHERE SUBSTR(path, 1, LENGTH(?) + 1) = ? || '/';`,
          [oldPath, oldPath]
        );
        for (const cf of childFolders) {
          const updatedChildPath = `${newPath}${cf.path.slice(oldPath.length)}`;
          await dbClient.run(
            `UPDATE folders SET path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
            [updatedChildPath, cf.id]
          );
        }

        if (folderId) {
          await dbClient.run(
            `UPDATE notes SET folder_path = ?, updated_at = CURRENT_TIMESTAMP WHERE folder_path = ? OR folder_id = ?;`,
            [newPath, oldPath, folderId]
          );
        } else {
          await dbClient.run(
            `UPDATE notes SET folder_path = ?, updated_at = CURRENT_TIMESTAMP WHERE folder_path = ?;`,
            [newPath, oldPath]
          );
        }

        const childNotes = await dbClient.query<{ id: string; folder_path: string }>(
          `SELECT id, folder_path FROM notes WHERE SUBSTR(COALESCE(folder_path, ''), 1, LENGTH(?) + 1) = ? || '/';`,
          [oldPath, oldPath]
        );
        for (const cn of childNotes) {
          if (cn.folder_path && cn.folder_path.startsWith(`${oldPath}/`)) {
            const updatedNotePath = `${newPath}${cn.folder_path.slice(oldPath.length)}`;
            await dbClient.run(
              `UPDATE notes SET folder_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
              [updatedNotePath, cn.id]
            );
          }
        }
      }
      return;
    }

    // Handle server-broadcast folder archive/unarchive cascade (exact prefix match — wildcard safe)
    if (p.action === 'cascade_archive') {
      const cleanPath = String(p.path || '')
        .trim()
        .replace(/^\/+|\/+$/g, '');
      const isArchived = Boolean(p.is_archived ?? p.isArchived);
      const folderId = p.folder_id || p.folderId || delta.entityId;

      if (cleanPath) {
        if (!isArchived) {
          const segments = cleanPath.split('/').filter(Boolean);
          for (let i = 1; i < segments.length; i++) {
            const ancestorPath = segments.slice(0, i).join('/');
            await dbClient.run(
              `UPDATE folders SET is_archived = 0, updated_at = CURRENT_TIMESTAMP WHERE path = ? AND is_archived = 1;`,
              [ancestorPath]
            );
          }
        }
        await dbClient.run(
          `UPDATE folders SET is_archived = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? OR path = ? OR SUBSTR(path, 1, LENGTH(?) + 1) = ? || '/';`,
          [isArchived ? 1 : 0, folderId, cleanPath, cleanPath, cleanPath]
        );
        if (isArchived) {
          await dbClient.run(
            `UPDATE notes SET status = 'archived', updated_at = CURRENT_TIMESTAMP
             WHERE status = 'active' AND (folder_id = ? OR folder_path = ? OR SUBSTR(COALESCE(folder_path, ''), 1, LENGTH(?) + 1) = ? || '/');`,
            [folderId, cleanPath, cleanPath, cleanPath]
          );
        } else {
          await dbClient.run(
            `UPDATE notes SET status = 'active', updated_at = CURRENT_TIMESTAMP
             WHERE status = 'archived' AND (folder_id = ? OR folder_path = ? OR SUBSTR(COALESCE(folder_path, ''), 1, LENGTH(?) + 1) = ? || '/');`,
            [folderId, cleanPath, cleanPath, cleanPath]
          );
        }
      }
      return;
    }

    // Validate parent_id against local folders table so out-of-order CDC never fails PRAGMA foreign_keys = ON
    let safeParentId: string | null = p.parent_id || null;
    if (safeParentId && safeParentId !== delta.entityId) {
      const parentExists = await dbClient.queryFirst<{ id: string }>(
        `SELECT id FROM folders WHERE id = ? LIMIT 1;`,
        [safeParentId]
      );
      if (!parentExists) {
        safeParentId = null;
      }
    } else if (safeParentId === delta.entityId) {
      safeParentId = null;
    }

    await dbClient.run(
      `INSERT INTO folders (
        id, user_id, name, parent_id, path, color_token, icon,
        is_favorite, is_pinned, is_archived,
        is_locked, lock_type, lock_credential_kind, lock_hash, lock_salt, lock_hint,
        ai_context_excluded, sync_rev, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        parent_id = excluded.parent_id,
        path = excluded.path,
        color_token = excluded.color_token,
        icon = excluded.icon,
        is_favorite = excluded.is_favorite,
        is_pinned = excluded.is_pinned,
        is_archived = excluded.is_archived,
        is_locked = excluded.is_locked,
        lock_type = excluded.lock_type,
        lock_credential_kind = excluded.lock_credential_kind,
        lock_hash = excluded.lock_hash,
        lock_salt = excluded.lock_salt,
        lock_hint = excluded.lock_hint,
        ai_context_excluded = excluded.ai_context_excluded,
        sync_rev = excluded.sync_rev,
        updated_at = CURRENT_TIMESTAMP;`,
      [
        delta.entityId,
        delta.userId || this.config.userId,
        p.name || 'Untitled Folder',
        safeParentId,
        p.path || p.name || 'General',
        p.color_token || 'cyan',
        p.icon || null,
        p.is_favorite ? 1 : 0,
        p.is_pinned ? 1 : 0,
        p.is_archived ? 1 : 0,
        p.is_locked ? 1 : 0,
        p.lock_type || null,
        p.lock_credential_kind || null,
        p.lock_hash || null,
        p.lock_salt || null,
        p.lock_hint || null,
        p.ai_context_excluded ? 1 : 0,
        delta.syncRev,
      ]
    );
  }

  /**
   * Applies incoming remote in_app_notification delta (Gap 5)
   */
  private async applyNotificationDelta(delta: SyncDelta): Promise<void> {
    const p = delta.deltaPayload || {};
    const uid = delta.userId || this.config.userId;

    if (delta.changeType === 'delete') {
      const clearedAt = p.cleared_at || p.clearedAt || new Date().toISOString();
      if (delta.entityId === 'all' || p.action === 'clear_all') {
        await dbClient.run(
          `UPDATE in_app_notifications SET is_cleared = 1, cleared_at = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_cleared = 0;`,
          [clearedAt, uid]
        );
      } else {
        await dbClient.run(
          `UPDATE in_app_notifications SET is_cleared = 1, cleared_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
          [clearedAt, delta.entityId]
        );
      }
      return;
    }

    if (
      delta.changeType === 'update' &&
      (delta.entityId === 'all' || p.action === 'mark_all_read' || (p.action === 'mark_read' && !p.title))
    ) {
      const isRead = Boolean(p.is_read ?? p.isRead ?? true);
      const readAt = isRead ? p.read_at || p.readAt || new Date().toISOString() : null;
      if (delta.entityId === 'all' || p.action === 'mark_all_read') {
        await dbClient.run(
          `UPDATE in_app_notifications SET is_read = ?, read_at = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_cleared = 0;`,
          [isRead ? 1 : 0, readAt, uid]
        );
      } else {
        await dbClient.run(
          `UPDATE in_app_notifications SET is_read = ?, read_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
          [isRead ? 1 : 0, readAt, delta.entityId]
        );
      }
      return;
    }

    const rawType = String(p.target_type || p.targetType || 'system');
    const expandedTargetType = ['task', 'note', 'event', 'checklist_point', 'system'].includes(rawType)
      ? rawType
      : 'system';
    const triggerAt = p.trigger_at || p.triggerAt || new Date().toISOString();

    const upsertSql = `INSERT INTO in_app_notifications (
        id, user_id, reminder_id, target_type, target_id, note_id,
        title, body, trigger_at, recurrence_rule,
        is_read, read_at, is_cleared, cleared_at,
        sync_rev, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        reminder_id = excluded.reminder_id,
        target_type = excluded.target_type,
        target_id = excluded.target_id,
        note_id = excluded.note_id,
        title = excluded.title,
        body = excluded.body,
        trigger_at = excluded.trigger_at,
        recurrence_rule = excluded.recurrence_rule,
        is_read = excluded.is_read,
        read_at = excluded.read_at,
        is_cleared = excluded.is_cleared,
        cleared_at = excluded.cleared_at,
        sync_rev = excluded.sync_rev,
        updated_at = CURRENT_TIMESTAMP;`;

    const buildParams = (targetType: string) => [
      delta.entityId,
      uid,
      p.reminder_id || p.reminderId || null,
      targetType,
      p.target_id || p.targetId || delta.entityId,
      p.note_id || p.noteId || null,
      p.title || 'Notification',
      p.body || '',
      triggerAt,
      p.recurrence_rule || p.recurrenceRule || null,
      p.is_read || p.isRead ? 1 : 0,
      p.read_at || p.readAt || null,
      p.is_cleared || p.isCleared ? 1 : 0,
      p.cleared_at || p.clearedAt || null,
      delta.syncRev || 1,
      p.created_at || delta.createdAt || new Date().toISOString(),
    ];

    try {
      await dbClient.run(upsertSql, buildParams(expandedTargetType));
    } catch (insertErr: any) {
      if (!['task', 'note', 'system'].includes(expandedTargetType)) {
        await dbClient.run(upsertSql, buildParams('system'));
      } else {
        throw insertErr;
      }
    }
  }

  /**
   * Applies incoming remote search_history delta (Gap 6)
   */
  private async applySearchHistoryDelta(delta: SyncDelta): Promise<void> {
    const p = delta.deltaPayload || {};
    const uid = delta.userId || this.config.userId;

    if (delta.changeType === 'delete') {
      if (delta.entityId === 'all' || p.action === 'clear_all') {
        await dbClient.run(`DELETE FROM search_history WHERE user_id = ?;`, [uid]);
      } else {
        const queryText = p.query_text || p.queryText;
        if (queryText) {
          await dbClient.run(
            `DELETE FROM search_history WHERE id = ? OR (user_id = ? AND LOWER(query_text) = LOWER(?));`,
            [delta.entityId, uid, queryText]
          );
        } else {
          await dbClient.run(`DELETE FROM search_history WHERE id = ?;`, [delta.entityId]);
        }
      }
      return;
    }

    const queryText = String(p.query_text || p.queryText || '').trim();
    if (!queryText) return;

    const rawSource = String(p.source || 'text');
    const safeSource = ['text', 'voice', 'ai'].includes(rawSource) ? rawSource : 'text';
    const snapshotRaw = p.filter_snapshot_json ?? p.filterSnapshot ?? {};
    const snapshotJson = typeof snapshotRaw === 'string' ? snapshotRaw : JSON.stringify(snapshotRaw);
    const lastUsedAt = p.last_used_at || p.lastUsedAt || new Date().toISOString();

    // Prevent UNIQUE(user_id, query_text) collisions if Device B already searched the same query under another local ID
    await dbClient.run(
      `DELETE FROM search_history WHERE user_id = ? AND LOWER(query_text) = LOWER(?) AND id != ?;`,
      [uid, queryText, delta.entityId]
    );

    await dbClient.run(
      `INSERT INTO search_history (
        id, user_id, query_text, source, filter_snapshot_json,
        use_count, sync_rev, created_at, last_used_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        query_text = excluded.query_text,
        source = excluded.source,
        filter_snapshot_json = excluded.filter_snapshot_json,
        use_count = excluded.use_count,
        sync_rev = excluded.sync_rev,
        last_used_at = excluded.last_used_at;`,
      [
        delta.entityId,
        uid,
        queryText,
        safeSource,
        snapshotJson,
        typeof p.use_count === 'number' ? p.use_count : typeof p.useCount === 'number' ? p.useCount : 1,
        delta.syncRev || 1,
        p.created_at || delta.createdAt || lastUsedAt,
        lastUsedAt,
      ]
    );
  }

  /**
   * Applies incoming remote entity_relations delta (Gap 7)
   */
  private async applyRelationDelta(delta: SyncDelta): Promise<void> {
    const p = delta.deltaPayload || {};
    const uid = delta.userId || this.config.userId;

    if (delta.changeType === 'delete') {
      await dbClient.run(`DELETE FROM entity_relations WHERE id = ?;`, [delta.entityId]);
      return;
    }

    const sourceId = p.source_id || p.sourceId;
    const targetId = p.target_id || p.targetId;
    const rawRelType = String(p.relation_type || p.relationType || 'relates_to');
    if (!sourceId || !targetId) return;

    const safeRelType = ['relates_to', 'supersedes', 'derived_from', 'part_of', 'contradicts'].includes(
      rawRelType
    )
      ? rawRelType
      : 'relates_to';
    const rawCreatedBy = String(p.created_by || p.createdBy || 'user');
    const safeCreatedBy = ['user', 'friday_ai'].includes(rawCreatedBy) ? rawCreatedBy : 'user';
    const confidence =
      typeof p.confidence_score === 'number'
        ? p.confidence_score
        : typeof p.confidenceScore === 'number'
          ? p.confidenceScore
          : 1.0;

    // Prevent UNIQUE(source_id, relation_type, target_id) collisions across devices
    await dbClient.run(
      `DELETE FROM entity_relations WHERE source_id = ? AND relation_type = ? AND target_id = ? AND id != ?;`,
      [sourceId, safeRelType, targetId, delta.entityId]
    );

    await dbClient.run(
      `INSERT INTO entity_relations (
        id, user_id, source_id, relation_type, target_id,
        created_by, confidence_score, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_id = excluded.source_id,
        relation_type = excluded.relation_type,
        target_id = excluded.target_id,
        created_by = excluded.created_by,
        confidence_score = excluded.confidence_score;`,
      [
        delta.entityId,
        uid,
        sourceId,
        safeRelType,
        targetId,
        safeCreatedBy,
        confidence,
        p.created_at || delta.createdAt || new Date().toISOString(),
      ]
    );
  }

  /**
   * Applies incoming remote workspace_security delta (Master PIN/Password & Relock),
   * while strictly preserving the device's local biometrics_enabled setting.
   */
  private async applyWorkspaceSecurityDelta(delta: SyncDelta): Promise<void> {
    const p = delta.deltaPayload || {};
    const nowIso = new Date().toISOString();

    await dbClient.run(
      `INSERT INTO workspace_security (
        id, app_lock_enabled, master_credential_type, master_hash, master_salt, master_hint,
        biometrics_enabled, auto_relock_seconds, updated_at
      ) VALUES ('default', ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        app_lock_enabled = excluded.app_lock_enabled,
        master_credential_type = excluded.master_credential_type,
        master_hash = excluded.master_hash,
        master_salt = excluded.master_salt,
        master_hint = excluded.master_hint,
        auto_relock_seconds = excluded.auto_relock_seconds,
        updated_at = excluded.updated_at;`,
      [
        p.app_lock_enabled ? 1 : 0,
        p.master_credential_type || null,
        p.master_hash || null,
        p.master_salt || null,
        p.master_hint || null,
        typeof p.auto_relock_seconds === 'number' ? p.auto_relock_seconds : 0,
        nowIso,
      ]
    );
  }

  /**
   * Connects to Supabase Realtime publication channel and begins streaming CDC deltas
   */
  public subscribeToRealtimeCDC(supabaseClient: any = supabase): () => void {
    if (!supabaseClient || this.isSyncGateBlocked()) {
      return () => {};
    }

    this.disconnectRealtimeCDC(supabaseClient);

    try {
      const channel = supabaseClient
        .channel(`sync_changelog:${this.config.userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'sync_changelog',
            filter: `user_id=eq.${this.config.userId}`,
          },
          (payload: any) => {
            const row = payload.new;
            if (!row) return;

            const delta: SyncDelta = {
              id: row.id,
              userId: row.user_id,
              syncRev: row.sync_rev,
              entityType: row.entity_type,
              entityId: row.entity_id,
              changeType: row.change_type,
              deltaPayload:
                typeof row.delta_payload === 'string'
                  ? JSON.parse(row.delta_payload)
                  : row.delta_payload,
              callerPlatform: row.caller_platform || 'supabase_cdc',
              createdAt: row.created_at,
            };

            this.applyRemoteDelta(delta).catch((err) => {
              console.error('[SyncEngine] Failed to process realtime CDC delta:', err);
            });
          }
        )
        .subscribe();

      this.realtimeChannel = channel;
      return () => {
        this.disconnectRealtimeCDC(supabaseClient);
      };
    } catch (err) {
      console.warn('[SyncEngine] Could not establish Supabase Realtime subscription:', err);
      return () => {};
    }
  }

  public disconnectRealtimeCDC(supabaseClient: any = supabase): void {
    if (this.realtimeChannel && supabaseClient?.removeChannel) {
      try {
        supabaseClient.removeChannel(this.realtimeChannel);
      } catch {
        // Ignore channel cleanup errors
      }
      this.realtimeChannel = null;
    }
  }

  /**
   * Subscribes to local delta application events (for UI reactive state updates)
   */
  public subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(delta: SyncDelta): void {
    for (const listener of this.listeners) {
      try {
        listener(delta);
      } catch (err) {
        console.error('[SyncEngine] Listener error:', err);
      }
    }
  }
}

export const syncEngine = new SyncEngine();
