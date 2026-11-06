import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { dbClient } from '../db/client';

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
    const [folders, tags, notes, noteTags, tasks, entityRelations, assets] = await Promise.all([
      dbClient.query<any>('SELECT * FROM folders ORDER BY path ASC;').catch(() => []),
      dbClient.query<any>('SELECT * FROM tags ORDER BY name ASC;').catch(() => []),
      dbClient.query<any>('SELECT * FROM notes ORDER BY updated_at DESC;').catch(() => []),
      dbClient.query<any>('SELECT * FROM note_tags;').catch(() => []),
      dbClient.query<any>('SELECT * FROM tasks ORDER BY created_at DESC;').catch(() => []),
      dbClient.query<any>('SELECT * FROM entity_relations;').catch(() => []),
      dbClient.query<any>('SELECT * FROM assets;').catch(() => []),
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
    strategy: 'merge' | 'replace' = 'merge'
  ): Promise<RestoreSummary> {
    const { workspace } = backup;

    if (strategy === 'replace') {
      // Clear dependent child tables first
      await dbClient.run('DELETE FROM note_tags;');
      await dbClient.run('DELETE FROM tasks;');
      await dbClient.run('DELETE FROM entity_relations;');
      await dbClient.run('DELETE FROM notes;');
      await dbClient.run('DELETE FROM folders;');
      await dbClient.run('DELETE FROM tags;');
    }

    let foldersRestored = 0;
    let tagsRestored = 0;
    let notesRestored = 0;
    let tasksRestored = 0;

    // 1. Folders
    if (Array.isArray(workspace.folders)) {
      for (const f of workspace.folders) {
        if (!f.id || !f.name || !f.path) continue;
        await dbClient.run(
          `INSERT OR REPLACE INTO folders (id, user_id, name, parent_id, path, color_token, icon, sync_rev, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            f.id,
            f.user_id || 'user-default',
            f.name,
            f.parent_id || null,
            f.path,
            f.color_token || 'cyan',
            f.icon || null,
            f.sync_rev || 0,
            f.created_at || new Date().toISOString(),
            f.updated_at || new Date().toISOString(),
          ]
        );
        foldersRestored++;
      }
    }

    // 2. Tags
    if (Array.isArray(workspace.tags)) {
      for (const t of workspace.tags) {
        if (!t.id || !t.name) continue;
        await dbClient.run(
          `INSERT OR REPLACE INTO tags (id, user_id, name, color_token, created_at)
           VALUES (?, ?, ?, ?, ?);`,
          [
            t.id,
            t.user_id || 'user-default',
            t.name,
            t.color_token || 'cyan',
            t.created_at || new Date().toISOString(),
          ]
        );
        tagsRestored++;
      }
    }

    // 3. Notes
    if (Array.isArray(workspace.notes)) {
      for (const n of workspace.notes) {
        if (!n.id || !n.title) continue;
        await dbClient.run(
          `INSERT OR REPLACE INTO notes (
             id, user_id, folder_id, folder_path, group_name, title, content_markdown,
             blocks_json, color_token, is_favorite, is_pinned, status, priority_score,
             sync_rev, created_at, updated_at, trashed_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            n.id,
            n.user_id || 'user-default',
            n.folder_id || null,
            n.folder_path || 'General',
            n.group_name || null,
            n.title,
            n.content_markdown || '',
            n.blocks_json || '[]',
            n.color_token || 'apricot',
            n.is_favorite ? 1 : 0,
            n.is_pinned ? 1 : 0,
            n.status || 'active',
            n.priority_score || 0.0,
            n.sync_rev || 0,
            n.created_at || new Date().toISOString(),
            n.updated_at || new Date().toISOString(),
            n.trashed_at || null,
          ]
        );
        notesRestored++;
      }
    }

    // 4. Note Tags
    if (Array.isArray(workspace.noteTags)) {
      for (const nt of workspace.noteTags) {
        if (!nt.note_id || !nt.tag_id) continue;
        await dbClient.run(
          `INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?);`,
          [nt.note_id, nt.tag_id]
        );
      }
    }

    // 5. Tasks
    if (Array.isArray(workspace.tasks)) {
      for (const tk of workspace.tasks) {
        if (!tk.id || !tk.title) continue;
        await dbClient.run(
          `INSERT OR REPLACE INTO tasks (
             id, user_id, note_id, note_title, note_color_token, block_id, title,
             is_completed, priority, due_date, sync_rev, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            tk.id,
            tk.user_id || 'user-default',
            tk.note_id || null,
            tk.note_title || null,
            tk.note_color_token || null,
            tk.block_id || null,
            tk.title,
            tk.is_completed ? 1 : 0,
            tk.priority || 'none',
            tk.due_date || null,
            tk.sync_rev || 0,
            tk.created_at || new Date().toISOString(),
            tk.updated_at || new Date().toISOString(),
          ]
        );
        tasksRestored++;
      }
    }

    // 6. Entity Relations
    if (Array.isArray(workspace.entityRelations)) {
      for (const rel of workspace.entityRelations) {
        if (!rel.id || !rel.source_id || !rel.target_id) continue;
        await dbClient.run(
          `INSERT OR REPLACE INTO entity_relations (
             id, user_id, source_id, relation_type, target_id, created_by, confidence_score, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            rel.id,
            rel.user_id || 'user-default',
            rel.source_id,
            rel.relation_type,
            rel.target_id,
            rel.created_by || 'user',
            rel.confidence_score || 1.0,
            rel.created_at || new Date().toISOString(),
          ]
        );
      }
    }

    return {
      notesRestored,
      foldersRestored,
      tasksRestored,
      tagsRestored,
    };
  }
}

export const workspaceBackupService = new WorkspaceBackupService();

