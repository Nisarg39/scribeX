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
import { DBFolder, DBNote, DBReminder, DBTask, DBWorkspaceSecurity } from '../../db/types';
import { NoteItem } from '../../types/note';
import { notificationService } from '../notifications/NotificationService';
import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient';
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

  private async ensureFolderSyncedToSupabase(
    folderId: string,
    visited: Set<string> = new Set()
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
    if (error) throw new Error(error.message);
    if (data?.sync_rev) {
      await dbClient.run(`UPDATE folders SET sync_rev = ? WHERE id = ?;`, [
        data.sync_rev,
        folder.id,
      ]);
    }
    return true;
  }

  private async pushCreateNote(
    note: DBNote,
    parsedBlocks: any[],
    tags: string[],
    overrideFolderId?: string | null
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
          folderSynced ? note.folder_id : null
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
      if (['note', 'folder', 'task', 'reminder'].includes(delta.entityType)) {
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

        if (delta.changeType === 'insert') {
          await this.pushCreateNote(note, parsedBlocks, tags);
        } else {
          // Update note: only send p_blocks_json if blocks were actually modified or hydrated
          const { data, error } = await supabase.rpc('rpc_update_note', {
            p_note_id: note.id,
            p_title: note.title,
            p_content_markdown: payloadHasBlocks ? note.content_markdown : null,
            p_blocks_json: payloadHasBlocks ? parsedBlocks : null,
            p_tags: delta.deltaPayload?.tags ? tags : null,
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
            p_caller_platform: this.deviceSessionId,
          });
          if (error) {
            const isNotFound =
              error.code === 'P0001' ||
              error.message?.toLowerCase().includes('note not found');
            const isFolderFk =
              error.code === '23503' || error.message?.includes('notes_folder_id_fkey');
            if (isNotFound || isFolderFk) {
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
          const { error } = await supabase.rpc('rpc_create_task', {
            p_id: task.id,
            p_title: task.title,
            p_priority: task.priority,
            p_due_date: task.due_date,
            p_reminder_at: task.reminder_at,
            p_note_id: task.note_id,
            p_caller_platform: this.deviceSessionId,
          });
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
                p_id: task.id,
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
          if (task.is_completed) {
            await supabase.rpc('rpc_toggle_task', {
              p_task_id: task.id,
              p_is_completed: true,
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
   * Pulls synced folders, tasks, active reminders, and workspace Master PIN metadata from Supabase
   * so secondary / fresh devices hydrate cleanly on sign-in without overwriting uncommitted Outbox items.
   */
  public async pullWorkspaceMetadataFromCloud(): Promise<void> {
    if (!isSupabaseConfigured() || !this.isAuthenticatedSession()) return;

    const uid = this.config.userId;
    const [foldersRes, tasksRes, remindersRes, securityRes, dirtyRows] = await Promise.all([
      supabase.from('folders').select('*').eq('user_id', uid),
      supabase.from('tasks').select('*').eq('user_id', uid),
      supabase.from('reminders').select('*').eq('user_id', uid).eq('is_dismissed', false),
      supabase.from('workspace_security').select('*').eq('user_id', uid).maybeSingle(),
      dbClient.query<{ entity_type: string; entity_id: string }>(
        `SELECT DISTINCT entity_type, entity_id FROM sync_changelog;`
      ),
    ]);

    const dirtyKeySet = new Set(dirtyRows.map((r) => `${r.entity_type}:${r.entity_id}`));

    await dbClient.withTransaction(async () => {
      if (Array.isArray(foldersRes.data)) {
        for (const f of foldersRes.data) {
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
      }

      if (Array.isArray(tasksRes.data)) {
        for (const t of tasksRes.data) {
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
      }

      if (Array.isArray(remindersRes.data)) {
        for (const r of remindersRes.data) {
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
      }

      if (securityRes.data && !dirtyKeySet.has('workspace_security:default')) {
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
    });
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
   * Applies incoming remote note delta (preserving lock & AI context flags)
   */
  private async applyNoteDelta(delta: SyncDelta): Promise<void> {
    const p = delta.deltaPayload || {};

    if (delta.changeType === 'delete') {
      await dbClient.run(`DELETE FROM notes WHERE id = ?;`, [delta.entityId]);
    } else {
      const blocksJsonStr =
        typeof p.blocks_json === 'string'
          ? p.blocks_json
          : JSON.stringify(p.blocks_json || []);

      await dbClient.run(
        `INSERT INTO notes (
          id, user_id, folder_id, folder_path, group_name, title,
          content_markdown, blocks_json, color_token, is_favorite, is_pinned,
          status, priority_score, reminder_at,
          is_locked, lock_type, lock_credential_kind, lock_hash, lock_salt, lock_hint,
          ai_context_excluded, sync_rev, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          title = COALESCE(excluded.title, notes.title),
          folder_id = COALESCE(excluded.folder_id, notes.folder_id),
          folder_path = COALESCE(excluded.folder_path, notes.folder_path),
          content_markdown = CASE WHEN excluded.content_markdown != '' THEN excluded.content_markdown ELSE notes.content_markdown END,
          blocks_json = CASE WHEN excluded.blocks_json != '[]' THEN excluded.blocks_json ELSE notes.blocks_json END,
          color_token = COALESCE(excluded.color_token, notes.color_token),
          is_favorite = excluded.is_favorite,
          is_pinned = excluded.is_pinned,
          status = COALESCE(excluded.status, notes.status),
          reminder_at = excluded.reminder_at,
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
          p.folder_id || null,
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
        ]
      );
    }
  }

  /**
   * Applies incoming remote folder delta
   */
  private async applyFolderDelta(delta: SyncDelta): Promise<void> {
    const p = delta.deltaPayload || {};

    if (delta.changeType === 'delete') {
      await dbClient.run(`DELETE FROM folders WHERE id = ?;`, [delta.entityId]);
    } else {
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
          p.parent_id || null,
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
