/**
 * ScribeX Lossless Guest-to-Account Vault Migration
 * Atomically transfers local guest data ('user-default') to an authenticated Google user's auth.uid().
 */

import { dbClient } from './client';
import { DBFolder, DBNote } from './types';

export interface VaultMigrationResult {
  migratedNotes: number;
  migratedFolders: number;
  migratedTasks: number;
  migratedReminders: number;
  queuedSyncEntries: number;
}

const createMigrationLogId = (entityType: string, entityId: string) =>
  `log-mig-${entityType}-${entityId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Reassigns all local 'user-default' SQLite records to authenticatedUserId inside a single transaction
 * and queues missing 'insert' deltas in sync_changelog for cloud push.
 */
export async function migrateGuestVaultToUser(
  authenticatedUserId: string
): Promise<VaultMigrationResult> {
  if (!authenticatedUserId || authenticatedUserId === 'user-default') {
    return {
      migratedNotes: 0,
      migratedFolders: 0,
      migratedTasks: 0,
      migratedReminders: 0,
      queuedSyncEntries: 0,
    };
  }

  return dbClient.withTransaction(async () => {
    const foldersRes = await dbClient.run(
      `UPDATE folders SET user_id = ? WHERE user_id = 'user-default';`,
      [authenticatedUserId]
    );
    const notesRes = await dbClient.run(
      `UPDATE notes SET user_id = ? WHERE user_id = 'user-default';`,
      [authenticatedUserId]
    );
    const tasksRes = await dbClient.run(
      `UPDATE tasks SET user_id = ? WHERE user_id = 'user-default';`,
      [authenticatedUserId]
    );
    const remindersRes = await dbClient.run(
      `UPDATE reminders SET user_id = ? WHERE user_id = 'user-default';`,
      [authenticatedUserId]
    );

    await dbClient.run(
      `UPDATE tags SET user_id = ? WHERE user_id = 'user-default';`,
      [authenticatedUserId]
    );
    await dbClient.run(
      `UPDATE assets SET user_id = ? WHERE user_id = 'user-default';`,
      [authenticatedUserId]
    );
    await dbClient.run(
      `UPDATE entity_relations SET user_id = ? WHERE user_id = 'user-default';`,
      [authenticatedUserId]
    );
    await dbClient.run(
      `UPDATE in_app_notifications SET user_id = ? WHERE user_id = 'user-default';`,
      [authenticatedUserId]
    );
    await dbClient.run(
      `UPDATE OR IGNORE search_history SET user_id = ? WHERE user_id = 'user-default';`,
      [authenticatedUserId]
    );
    await dbClient.run(`DELETE FROM search_history WHERE user_id = 'user-default';`);
    await dbClient.run(
      `UPDATE sync_changelog SET user_id = ? WHERE user_id = 'user-default';`,
      [authenticatedUserId]
    );

    let queuedSyncEntries = 0;

    // Queue insert deltas for any folders lacking an entry in sync_changelog
    const foldersToQueue = await dbClient.query<DBFolder>(
      `SELECT * FROM folders
       WHERE user_id = ?
         AND id NOT IN (
           SELECT entity_id FROM sync_changelog WHERE entity_type = 'folder' AND user_id = ?
         );`,
      [authenticatedUserId, authenticatedUserId]
    );

    for (const folder of foldersToQueue) {
      const nextRev = Math.max(folder.sync_rev || 0, 1);
      await dbClient.run(
        `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, 'folder', ?, 'insert', ?);`,
        [
          createMigrationLogId('folder', folder.id),
          authenticatedUserId,
          nextRev,
          folder.id,
          JSON.stringify({
            id: folder.id,
            name: folder.name,
            parent_id: folder.parent_id,
            path: folder.path,
            color_token: folder.color_token,
            icon: folder.icon,
            is_favorite: Boolean(folder.is_favorite),
            is_pinned: Boolean(folder.is_pinned),
            is_archived: Boolean(folder.is_archived),
            ai_context_excluded: Boolean(folder.ai_context_excluded),
          }),
        ]
      );
      queuedSyncEntries++;
    }

    // Queue insert deltas for any notes lacking an entry in sync_changelog
    const notesToQueue = await dbClient.query<DBNote>(
      `SELECT * FROM notes
       WHERE user_id = ?
         AND id NOT IN (
           SELECT entity_id FROM sync_changelog WHERE entity_type = 'note' AND user_id = ?
         );`,
      [authenticatedUserId, authenticatedUserId]
    );

    for (const note of notesToQueue) {
      const nextRev = Math.max(note.sync_rev || 0, 1);
      await dbClient.run(
        `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, 'note', ?, 'insert', ?);`,
        [
          createMigrationLogId('note', note.id),
          authenticatedUserId,
          nextRev,
          note.id,
          JSON.stringify({
            id: note.id,
            folder_id: note.folder_id,
            folder_path: note.folder_path,
            title: note.title,
            content_markdown: note.content_markdown,
            blocks_json: note.blocks_json,
            color_token: note.color_token,
            is_favorite: Boolean(note.is_favorite),
            is_pinned: Boolean(note.is_pinned),
            status: note.status,
            reminder_at: note.reminder_at,
            ai_context_excluded: Boolean(note.ai_context_excluded),
          }),
        ]
      );
      queuedSyncEntries++;
    }

    return {
      migratedNotes: notesRes.changes,
      migratedFolders: foldersRes.changes,
      migratedTasks: tasksRes.changes,
      migratedReminders: remindersRes.changes,
      queuedSyncEntries,
    };
  });
}
