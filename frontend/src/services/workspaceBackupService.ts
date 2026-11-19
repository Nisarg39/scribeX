import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { dbClient } from '../db/client';
import { syncEngine } from './sync/syncEngine';
import { googleDriveVaultService } from './drive/googleDriveVaultService';
import { isSupabaseConfigured, supabase } from './supabase/supabaseClient';

const createBackupSyncLogId = () => `log-bkp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export interface ScribeXWorkspaceBackup {
  app: 'ScribeX';
  version: string;
  schemaVersion: number;
  exportedAt: string;
  summary: {
    notesCount: number;
    foldersCount: number;
    tasksCount: number;
    tagsCount: number;
    relationsCount: number;
    assetsCount: number;
  };
  workspace: {
    folders: any[];
    tags: any[];
    notes: any[];
    noteTags: any[];
    tasks: any[];
    entityRelations: any[];
    assets: any[];
    workspaceSecurity?: any[];
  };
}

export interface RestoreSummary {
  notesRestored: number;
  foldersRestored: number;
  tasksRestored: number;
  tagsRestored: number;
}

class WorkspaceBackupService {
  /**
   * Generates a complete JSON backup object of all local SQLite tables.
   */
  public async generateFullBackup(): Promise<ScribeXWorkspaceBackup> {
    const [folders, tags, notes, noteTags, tasks, entityRelations, assets, workspaceSecurity] = await Promise.all([
      dbClient.query<any>('SELECT * FROM folders ORDER BY path ASC;').catch(() => []),
      dbClient.query<any>('SELECT * FROM tags ORDER BY name ASC;').catch(() => []),
      dbClient.query<any>('SELECT * FROM notes ORDER BY updated_at DESC;').catch(() => []),
      dbClient.query<any>('SELECT * FROM note_tags;').catch(() => []),
      dbClient.query<any>('SELECT * FROM tasks ORDER BY created_at DESC;').catch(() => []),
      dbClient.query<any>('SELECT * FROM entity_relations;').catch(() => []),
      dbClient.query<any>('SELECT * FROM assets;').catch(() => []),
      dbClient.query<any>('SELECT * FROM workspace_security;').catch(() => []),
    ]);

    return {
      app: 'ScribeX',
      version: '1.0.0',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      summary: {
        notesCount: notes.length,
        foldersCount: folders.length,
        tasksCount: tasks.length,
        tagsCount: tags.length,
        relationsCount: entityRelations.length,
        assetsCount: assets.length,
      },
      workspace: {
        folders,
        tags,
        notes,
        noteTags,
        tasks,
        entityRelations,
        assets,
        workspaceSecurity,
      },
    };
  }

  /**
   * Exports and triggers native file download on Web or system share sheet on Mobile.
   */
  public async exportAndSaveBackup(): Promise<{ success: boolean; filename: string }> {
    const backup = await this.generateFullBackup();
    const jsonStr = JSON.stringify(backup, null, 2);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `ScribeX-Backup-${dateStamp}.json`;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return { success: true, filename };
      }
      return { success: false, filename };
    }

    // Native: Android & iOS
    const targetUri = `${FileSystem.cacheDirectory || ''}${filename}`;
    await FileSystem.writeAsStringAsync(targetUri, jsonStr);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(targetUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export ScribeX Full Notebook Backup',
        UTI: 'public.json',
      });
      return { success: true, filename };
    }

    return { success: true, filename };
  }

  /**
   * Validates and previews a parsed backup object.
   */
  public validateBackup(data: any): { valid: boolean; error?: string; backup?: ScribeXWorkspaceBackup } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid backup file: not a JSON object' };
    }
    if (data.app !== 'ScribeX') {
      return { valid: false, error: 'Invalid backup: missing ScribeX signature' };
    }
    if (!data.workspace || typeof data.workspace !== 'object') {
      return { valid: false, error: 'Invalid backup: missing workspace data tables' };
    }
    if (!Array.isArray(data.workspace.notes) || !Array.isArray(data.workspace.folders)) {
      return { valid: false, error: 'Invalid backup: notes or folders list is corrupt' };
    }

    return { valid: true, backup: data as ScribeXWorkspaceBackup };
  }

  /**
   * Restores a verified backup into SQLite using either Merge or Clean Replace.
   */
  public async restoreBackup(
    backup: ScribeXWorkspaceBackup,
    strategy: 'merge' | 'replace' = 'merge',
    activeUserId?: string
  ): Promise<RestoreSummary> {
    const { workspace } = backup;
    const resolvedActiveUid = activeUserId || syncEngine.getActiveUserId();
    const resolveUserId = (rowUserId?: string) =>
      resolvedActiveUid !== 'user-default' ? resolvedActiveUid : rowUserId || 'user-default';

    // Track pre-existing IDs to tombstone during 'replace' so replaced cloud data does not return on next pull
    const preExistingFolderIds = new Set<string>();
    const preExistingNoteIds = new Set<string>();
    const preExistingTaskIds = new Set<string>();
    const preExistingRelationIds = new Set<string>();

    if (strategy === 'replace') {
      const [localFolders, localNotes, localTasks, localRels] = await Promise.all([
        dbClient.query<{ id: string }>(`SELECT id FROM folders;`).catch(() => []),
        dbClient.query<{ id: string }>(`SELECT id FROM notes;`).catch(() => []),
        dbClient.query<{ id: string }>(`SELECT id FROM tasks;`).catch(() => []),
        dbClient.query<{ id: string }>(`SELECT id FROM entity_relations;`).catch(() => []),
      ]);
      for (const r of localFolders) preExistingFolderIds.add(r.id);
      for (const r of localNotes) preExistingNoteIds.add(r.id);
      for (const r of localTasks) preExistingTaskIds.add(r.id);
      for (const r of localRels) preExistingRelationIds.add(r.id);

      // In Lean-Cache cloud mode, also gather evicted cloud IDs so Clean Replace wipes them from Supabase & Device B
      if (resolvedActiveUid !== 'user-default' && syncEngine.isCloudSyncEnabled() && isSupabaseConfigured()) {
        try {
          const [cf, cn, ct, cr] = await Promise.all([
            supabase.from('folders').select('id').eq('user_id', resolvedActiveUid),
            supabase.from('notes').select('id').eq('user_id', resolvedActiveUid),
            supabase.from('tasks').select('id').eq('user_id', resolvedActiveUid),
            supabase.from('entity_relations').select('id').eq('user_id', resolvedActiveUid),
          ]);
          for (const r of cf.data || []) if (r?.id) preExistingFolderIds.add(r.id);
          for (const r of cn.data || []) if (r?.id) preExistingNoteIds.add(r.id);
          for (const r of ct.data || []) if (r?.id) preExistingTaskIds.add(r.id);
          for (const r of cr.data || []) if (r?.id) preExistingRelationIds.add(r.id);
        } catch {
          // Offline fallback: local IDs still tombstoned cleanly
        }
      }

      // Clear stale pending sync_changelog rows for replaced tables before wiping
      await dbClient.run(
        `DELETE FROM sync_changelog WHERE entity_type IN ('folder', 'note', 'task', 'relation');`
      );
      // Clear dependent child tables first
      await dbClient.run('DELETE FROM note_tags;');
      await dbClient.run('DELETE FROM tasks;');
      await dbClient.run('DELETE FROM entity_relations;');
      await dbClient.run('DELETE FROM notes;');
      await dbClient.run('DELETE FROM folders;');
      await dbClient.run('DELETE FROM tags;');
      if (Array.isArray(workspace.workspaceSecurity) && workspace.workspaceSecurity.length > 0) {
        await dbClient.run('DELETE FROM workspace_security;');
      }
    }

    let foldersRestored = 0;
    let tagsRestored = 0;
    let notesRestored = 0;
    let tasksRestored = 0;

    const restoredFolders: { id: string; userId: string; name: string; path: string; parentId: string | null; syncRev: number }[] = [];
    const restoredNotes: { id: string; userId: string; title: string; folderId: string | null; folderPath: string; syncRev: number; blocksJson: string }[] = [];
    const restoredTasks: { id: string; userId: string; title: string; noteId: string | null; syncRev: number }[] = [];
    const restoredRelations: { id: string; userId: string; sourceId: string; targetId: string; relationType: string }[] = [];
    let importedSecurity = false;

    const existingFolderRows = await dbClient.query<{ id: string }>(`SELECT id FROM folders;`).catch(() => []);
    const validFolderIds = new Set<string>(existingFolderRows.map((r) => r.id));

    // 1. Folders (sorted by path depth ascending so parents are ALWAYS inserted before children under PRAGMA foreign_keys = ON)
    if (Array.isArray(workspace.folders)) {
      const sortedFolders = [...workspace.folders].sort((a, b) => {
        const depthA = String(a?.path || a?.name || '').split('/').filter(Boolean).length;
        const depthB = String(b?.path || b?.name || '').split('/').filter(Boolean).length;
        return depthA - depthB || String(a?.path || '').localeCompare(String(b?.path || ''));
      });
      for (const f of sortedFolders) {
        if (!f.id || !f.name || !f.path) continue;
        const rowUid = resolveUserId(f.user_id);
        const safeParentId =
          f.parent_id && f.parent_id !== f.id && validFolderIds.has(f.parent_id) ? f.parent_id : null;
        await dbClient.run(
          `INSERT INTO folders (
             id, user_id, name, parent_id, path, color_token, icon,
             is_favorite, is_pinned, is_archived,
             is_locked, lock_type, lock_credential_kind, lock_hash, lock_salt, lock_hint,
             ai_context_excluded, sync_rev, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             user_id = excluded.user_id,
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
             updated_at = excluded.updated_at;`,
          [
            f.id,
            rowUid,
            f.name,
            safeParentId,
            f.path,
            f.color_token || 'cyan',
            f.icon || null,
            f.is_favorite ? 1 : 0,
            f.is_pinned ? 1 : 0,
            f.is_archived ? 1 : 0,
            f.is_locked ? 1 : 0,
            f.lock_type || null,
            f.lock_credential_kind || null,
            f.lock_hash || null,
            f.lock_salt || null,
            f.lock_hint || null,
            f.ai_context_excluded ? 1 : 0,
            f.sync_rev || 0,
            f.created_at || new Date().toISOString(),
            f.updated_at || new Date().toISOString(),
          ]
        );
        validFolderIds.add(f.id);
        restoredFolders.push({
          id: f.id,
          userId: rowUid,
          name: f.name,
          path: f.path,
          parentId: safeParentId,
          syncRev: Math.max(f.sync_rev || 0, 1),
        });
        foldersRestored++;
      }
    }

    // 2. Tags (reuse existing tag IDs on case-insensitive name match so merge mode NEVER cascade-deletes existing note_tags!)
    const tagIdRemap = new Map<string, string>();
    if (Array.isArray(workspace.tags)) {
      for (const t of workspace.tags) {
        if (!t.id || !t.name) continue;
        const rowUid = resolveUserId(t.user_id);
        const existingTag = await dbClient.queryFirst<{ id: string }>(
          `SELECT id FROM tags WHERE LOWER(name) = LOWER(?) LIMIT 1;`,
          [t.name]
        );
        if (existingTag?.id) {
          tagIdRemap.set(t.id, existingTag.id);
          tagsRestored++;
          continue;
        }
        await dbClient.run(
          `INSERT OR IGNORE INTO tags (id, user_id, name, color_token, created_at)
           VALUES (?, ?, ?, ?, ?);`,
          [
            t.id,
            rowUid,
            t.name,
            t.color_token || 'cyan',
            t.created_at || new Date().toISOString(),
          ]
        );
        tagIdRemap.set(t.id, t.id);
        tagsRestored++;
      }
    }

    // 3. Notes (ON CONFLICT DO UPDATE prevents cascade-deleting existing note_tags in merge mode; validates folder_id FK)
    if (Array.isArray(workspace.notes)) {
      for (const n of workspace.notes) {
        if (!n.id) continue;
        const rowUid = resolveUserId(n.user_id);
        const noteTitle = (typeof n.title === 'string' && n.title.trim()) ? n.title : 'Untitled Note';
        const safeFolderId = n.folder_id && validFolderIds.has(n.folder_id) ? n.folder_id : null;
        const blocksJsonStr =
          typeof n.blocks_json === 'string'
            ? n.blocks_json
            : JSON.stringify(n.blocks_json || []);
        await dbClient.run(
          `INSERT INTO notes (
             id, user_id, folder_id, folder_path, group_name, title, content_markdown,
             blocks_json, color_token, is_favorite, is_pinned, status, priority_score,
             reminder_at, is_locked, lock_type, lock_credential_kind, lock_hash, lock_salt, lock_hint,
             ai_context_excluded, sync_rev, created_at, updated_at, trashed_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             user_id = excluded.user_id,
             folder_id = excluded.folder_id,
             folder_path = excluded.folder_path,
             group_name = excluded.group_name,
             title = excluded.title,
             content_markdown = excluded.content_markdown,
             blocks_json = excluded.blocks_json,
             color_token = excluded.color_token,
             is_favorite = excluded.is_favorite,
             is_pinned = excluded.is_pinned,
             status = excluded.status,
             priority_score = excluded.priority_score,
             reminder_at = excluded.reminder_at,
             is_locked = excluded.is_locked,
             lock_type = excluded.lock_type,
             lock_credential_kind = excluded.lock_credential_kind,
             lock_hash = excluded.lock_hash,
             lock_salt = excluded.lock_salt,
             lock_hint = excluded.lock_hint,
             ai_context_excluded = excluded.ai_context_excluded,
             sync_rev = excluded.sync_rev,
             updated_at = excluded.updated_at,
             trashed_at = excluded.trashed_at;`,
          [
            n.id,
            rowUid,
            safeFolderId,
            n.folder_path || 'General',
            n.group_name || null,
            noteTitle,
            n.content_markdown || '',
            blocksJsonStr,
            n.color_token || 'apricot',
            n.is_favorite ? 1 : 0,
            n.is_pinned ? 1 : 0,
            n.status || 'active',
            n.priority_score || 0.0,
            n.reminder_at || null,
            n.is_locked ? 1 : 0,
            n.lock_type || null,
            n.lock_credential_kind || null,
            n.lock_hash || null,
            n.lock_salt || null,
            n.lock_hint || null,
            n.ai_context_excluded ? 1 : 0,
            n.sync_rev || 0,
            n.created_at || new Date().toISOString(),
            n.updated_at || new Date().toISOString(),
            n.trashed_at || null,
          ]
        );
        restoredNotes.push({
          id: n.id,
          userId: rowUid,
          title: noteTitle,
          folderId: safeFolderId,
          folderPath: n.folder_path || 'General',
          syncRev: Math.max(n.sync_rev || 0, 1),
          blocksJson: blocksJsonStr,
        });
        notesRestored++;
      }
    }

    // 4. Note Tags (apply remapped tag IDs so restored notes link cleanly without FK errors)
    if (Array.isArray(workspace.noteTags)) {
      for (const nt of workspace.noteTags) {
        if (!nt.note_id || !nt.tag_id) continue;
        const resolvedTagId = tagIdRemap.get(nt.tag_id) || nt.tag_id;
        await dbClient.run(
          `INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?);`,
          [nt.note_id, resolvedTagId]
        );
      }
    }

    // 5. Tasks
    if (Array.isArray(workspace.tasks)) {
      for (const tk of workspace.tasks) {
        if (!tk.id || !tk.title) continue;
        const rowUid = resolveUserId(tk.user_id);
        await dbClient.run(
          `INSERT OR REPLACE INTO tasks (
             id, user_id, note_id, note_title, note_color_token, block_id, title,
             is_completed, priority, due_date, reminder_at, sync_rev, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            tk.id,
            rowUid,
            tk.note_id || null,
            tk.note_title || null,
            tk.note_color_token || null,
            tk.block_id || null,
            tk.title,
            tk.is_completed ? 1 : 0,
            tk.priority || 'none',
            tk.due_date || null,
            tk.reminder_at || null,
            tk.sync_rev || 0,
            tk.created_at || new Date().toISOString(),
            tk.updated_at || new Date().toISOString(),
          ]
        );
        restoredTasks.push({
          id: tk.id,
          userId: rowUid,
          title: tk.title,
          noteId: tk.note_id || null,
          syncRev: Math.max(tk.sync_rev || 0, 1),
        });
        tasksRestored++;
      }
    }

    // 6. Entity Relations
    if (Array.isArray(workspace.entityRelations)) {
      for (const rel of workspace.entityRelations) {
        if (!rel.id || !rel.source_id || !rel.target_id) continue;
        const rowUid = resolveUserId(rel.user_id);
        await dbClient.run(
          `INSERT OR REPLACE INTO entity_relations (
             id, user_id, source_id, relation_type, target_id, created_by, confidence_score, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            rel.id,
            rowUid,
            rel.source_id,
            rel.relation_type,
            rel.target_id,
            rel.created_by || 'user',
            rel.confidence_score || 1.0,
            rel.created_at || new Date().toISOString(),
          ]
        );
        restoredRelations.push({
          id: rel.id,
          userId: rowUid,
          sourceId: rel.source_id,
          targetId: rel.target_id,
          relationType: rel.relation_type,
        });
      }
    }

    // 7. Workspace Security Config
    if (Array.isArray(workspace.workspaceSecurity) && workspace.workspaceSecurity.length > 0) {
      let shouldImportSecurity = strategy === 'replace';
      if (!shouldImportSecurity) {
        const existingMaster = await dbClient.queryFirst<{ master_hash: string | null }>(
          `SELECT master_hash FROM workspace_security
           WHERE master_hash IS NOT NULL AND TRIM(master_hash) != ''
           LIMIT 1;`
        );
        shouldImportSecurity = !existingMaster?.master_hash;
      }

      if (shouldImportSecurity) {
        for (const sec of workspace.workspaceSecurity) {
          if (!sec.id) continue;
          await dbClient.run(
            `INSERT OR REPLACE INTO workspace_security (
               id, app_lock_enabled, master_credential_type, master_hash, master_salt,
               master_hint, biometrics_enabled, auto_relock_seconds, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              sec.id,
              sec.app_lock_enabled ? 1 : 0,
              sec.master_credential_type || null,
              sec.master_hash || null,
              sec.master_salt || null,
              sec.master_hint || null,
              sec.biometrics_enabled ? 1 : 0,
              typeof sec.auto_relock_seconds === 'number' ? sec.auto_relock_seconds : 0,
              sec.updated_at || new Date().toISOString(),
            ]
          );
          importedSecurity = true;
        }
      }
    }

    // 8. Enqueue sync_changelog deltas for all restored entities so Cloud Sync propagates across devices (Gap 4)
    const nowIso = new Date().toISOString();
    let hasLocalUploadableMedia = false;

    await dbClient.withTransaction(async () => {
      for (const f of restoredFolders) {
        await dbClient.run(
          `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
           VALUES (?, ?, ?, 'folder', ?, 'insert', ?);`,
          [
            createBackupSyncLogId(),
            f.userId,
            f.syncRev,
            f.id,
            JSON.stringify({
              id: f.id,
              name: f.name,
              path: f.path,
              parentId: f.parentId,
              restoredFromBackup: true,
              timestamp: nowIso,
            }),
          ]
        );
      }

      for (const n of restoredNotes) {
        if (
          !hasLocalUploadableMedia &&
          (n.blocksJson.includes('file://') ||
            n.blocksJson.includes('blob:') ||
            n.blocksJson.includes('data:image/') ||
            n.blocksJson.includes('data:audio/') ||
            n.blocksJson.includes('data:video/') ||
            n.blocksJson.includes('data:application/'))
        ) {
          hasLocalUploadableMedia = true;
        }

        const tagRows = await dbClient.query<{ name: string }>(
          `SELECT t.name FROM tags t INNER JOIN note_tags nt ON nt.tag_id = t.id WHERE nt.note_id = ?;`,
          [n.id]
        );
        const noteTagNames = tagRows.map((t) => t.name);

        await dbClient.run(
          `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
           VALUES (?, ?, ?, 'note', ?, 'insert', ?);`,
          [
            createBackupSyncLogId(),
            n.userId,
            n.syncRev,
            n.id,
            JSON.stringify({
              id: n.id,
              title: n.title,
              folderId: n.folderId,
              folderPath: n.folderPath,
              blocks: true,
              tags: noteTagNames,
              restoredFromBackup: true,
              timestamp: nowIso,
            }),
          ]
        );
      }

      for (const tk of restoredTasks) {
        await dbClient.run(
          `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
           VALUES (?, ?, ?, 'task', ?, 'insert', ?);`,
          [
            createBackupSyncLogId(),
            tk.userId,
            tk.syncRev,
            tk.id,
            JSON.stringify({
              id: tk.id,
              title: tk.title,
              noteId: tk.noteId,
              restoredFromBackup: true,
              timestamp: nowIso,
            }),
          ]
        );
      }

      for (const rel of restoredRelations) {
        await dbClient.run(
          `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
           VALUES (?, ?, 1, 'relation', ?, 'insert', ?);`,
          [
            createBackupSyncLogId(),
            rel.userId,
            rel.id,
            JSON.stringify({
              id: rel.id,
              sourceId: rel.sourceId,
              targetId: rel.targetId,
              relationType: rel.relationType,
              restoredFromBackup: true,
              timestamp: nowIso,
            }),
          ]
        );
      }

      if (importedSecurity) {
        await dbClient.run(
          `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
           VALUES (?, ?, 1, 'workspace_security', 'default', 'update', ?);`,
          [
            createBackupSyncLogId(),
            resolvedActiveUid,
            JSON.stringify({ restoredFromBackup: true, timestamp: nowIso }),
          ]
        );
      }

      // On Clean Replace, emit delete tombstones for pre-existing entities absent from the restored backup
      if (strategy === 'replace') {
        const restoredFolderIdSet = new Set(restoredFolders.map((f) => f.id));
        const restoredNoteIdSet = new Set(restoredNotes.map((n) => n.id));
        const restoredTaskIdSet = new Set(restoredTasks.map((tk) => tk.id));
        const restoredRelIdSet = new Set(restoredRelations.map((rel) => rel.id));

        for (const oldRelId of preExistingRelationIds) {
          if (restoredRelIdSet.has(oldRelId)) continue;
          await dbClient.run(
            `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
             VALUES (?, ?, 1, 'relation', ?, 'delete', ?);`,
            [createBackupSyncLogId(), resolvedActiveUid, oldRelId, JSON.stringify({ id: oldRelId, replacedByBackup: true })]
          );
        }

        for (const oldTaskId of preExistingTaskIds) {
          if (restoredTaskIdSet.has(oldTaskId)) continue;
          await dbClient.run(
            `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
             VALUES (?, ?, 1, 'task', ?, 'delete', ?);`,
            [createBackupSyncLogId(), resolvedActiveUid, oldTaskId, JSON.stringify({ id: oldTaskId, replacedByBackup: true })]
          );
        }

        for (const oldNoteId of preExistingNoteIds) {
          if (restoredNoteIdSet.has(oldNoteId)) continue;
          await dbClient.run(
            `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
             VALUES (?, ?, 1, 'note', ?, 'delete', ?);`,
            [createBackupSyncLogId(), resolvedActiveUid, oldNoteId, JSON.stringify({ id: oldNoteId, replacedByBackup: true })]
          );
        }

        for (const oldFolderId of preExistingFolderIds) {
          if (restoredFolderIdSet.has(oldFolderId)) continue;
          // Intentionally omit deletedPath so SyncEngine uses rpc_delete_entity('folder', id) without cascading over restored notes
          await dbClient.run(
            `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
             VALUES (?, ?, 1, 'folder', ?, 'delete', ?);`,
            [createBackupSyncLogId(), resolvedActiveUid, oldFolderId, JSON.stringify({ id: oldFolderId, replacedByBackup: true })]
          );
        }
      }
    });

    // If authenticated & Drive connected, backfill any restored local/data media URIs before cloud push
    if (
      hasLocalUploadableMedia &&
      resolvedActiveUid !== 'user-default' &&
      syncEngine.isCloudSyncEnabled()
    ) {
      await googleDriveVaultService.backfillOfflineMediaToDrive(resolvedActiveUid).catch((err) => {
        console.warn('[WorkspaceBackupService] Deferred media backfill after restore:', err);
      });
    }

    // Trigger debounced Cloud Sync push (strictly auth-gated inside SyncEngine)
    syncEngine.schedulePush();

    return {
      notesRestored,
      foldersRestored,
      tasksRestored,
      tagsRestored,
    };
  }
}

export const workspaceBackupService = new WorkspaceBackupService();

