/**
 * ScribeX Notes Repository
 * Source of Truth: docs/Universal_Note_Input_Structure_and_Relations.md
 */

import { dbClient } from './client';
import { DBNote, CreateNoteDTO, UpdateNoteDTO, NoteFilter } from './types';
import { NoteItem, ComposableBlock } from '../types/note';
import { NoteColorToken } from '../theme/tokens';
import { tagsRepo } from './tagsRepo';
import { syncEngine } from '../services/sync/syncEngine';
import { googleDriveVaultService } from '../services/drive/googleDriveVaultService';

const createLogId = () => `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export class NotesRepository {
  private async queueNoteSyncDelta(
    entityId: string,
    changeType: 'insert' | 'update' | 'delete',
    deltaPayload: Record<string, any>,
    userId: string = 'user-default'
  ): Promise<void> {
    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'note', ?, ?, ?);`,
      [createLogId(), userId, entityId, changeType, JSON.stringify(deltaPayload)]
    );
    syncEngine.schedulePush();
  }

  private mapToNoteItem(dbNote: DBNote, tags: string[] = []): NoteItem {
    let parsedBlocks: ComposableBlock[] = [];
    try {
      parsedBlocks = JSON.parse(dbNote.blocks_json);
    } catch {
      parsedBlocks = [{ id: `b-${dbNote.id}`, type: 'paragraph', content: dbNote.content_markdown }];
    }

    return {
      id: dbNote.id,
      userId: dbNote.user_id,
      folderId: dbNote.folder_id || undefined,
      folderPath: dbNote.folder_path || undefined,
      title: dbNote.title,
      contentMarkdown: dbNote.content_markdown,
      blocks: parsedBlocks,
      colorToken: dbNote.color_token as NoteColorToken,
      isFavorite: dbNote.is_favorite === 1,
      isPinned: dbNote.is_pinned === 1,
      status: dbNote.status,
      tags,
      reminderAt: dbNote.reminder_at || undefined,
      isLocked: dbNote.is_locked === 1,
      lockType: dbNote.lock_type || undefined,
      lockCredentialKind: dbNote.lock_credential_kind || undefined,
      lockHash: dbNote.lock_hash || undefined,
      lockSalt: dbNote.lock_salt || undefined,
      lockHint: dbNote.lock_hint || undefined,
      aiContextExcluded: dbNote.ai_context_excluded === 1,
      isDehydrated:
        parsedBlocks.length === 0 &&
        (dbNote.user_id !== 'user-default' || (dbNote.sync_rev || 0) > 0),
      syncRev: dbNote.sync_rev,
      createdAt: dbNote.created_at,
      updatedAt: dbNote.updated_at,
    };
  }

  public async createNote(dto: CreateNoteDTO): Promise<NoteItem> {
    const noteId = dto.id || `note-${Date.now()}`;
    const userId = dto.userId || 'user-default';
    const title = dto.title.trim() || 'Untitled Note';
    const content = dto.contentMarkdown || '';
    const blocks = dto.blocks || [
      { id: `b-${Date.now()}`, type: 'paragraph', content }
    ];
    const blocksJson = JSON.stringify(blocks);
    const colorToken = dto.colorToken || 'apricot';
    const folderPath = dto.folderPath || 'General';

    const insertSql = `
      INSERT INTO notes (
        id, user_id, folder_id, folder_path, group_name, title, content_markdown, blocks_json, color_token, is_favorite, is_pinned, reminder_at, ai_context_excluded, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active');
    `;

    await dbClient.run(insertSql, [
      noteId,
      userId,
      dto.folderId || null,
      folderPath,
      dto.groupName || null,
      title,
      content,
      blocksJson,
      colorToken,
      dto.isFavorite ? 1 : 0,
      dto.isPinned ? 1 : 0,
      dto.reminderAt || null,
      dto.aiContextExcluded ? 1 : 0,
    ]);

    // Handle tags if provided
    if (dto.tags && dto.tags.length > 0) {
      for (const tag of dto.tags) {
        const tagId = `tag-${tag.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        await dbClient.run(`INSERT OR IGNORE INTO tags (id, user_id, name) VALUES (?, ?, ?);`, [tagId, userId, tag]);
        await dbClient.run(`INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?);`, [noteId, tagId]);
      }
    }

    // Append to sync changelog and schedule debounced cloud push
    await this.queueNoteSyncDelta(noteId, 'insert', { id: noteId, title, content, colorToken }, userId);

    const created = await this.getNoteById(noteId);
    return created!;
  }

  public async getNoteById(id: string): Promise<NoteItem | null> {
    const row = await dbClient.queryFirst<DBNote>(
      `SELECT * FROM notes WHERE id = ?;`,
      [id]
    );

    if (!row) return null;

    // Fetch tags
    const tagRows = await dbClient.query<{ name: string }>(
      `SELECT t.name FROM tags t 
       INNER JOIN note_tags nt ON nt.tag_id = t.id 
       WHERE nt.note_id = ?;`,
      [id]
    );
    const tags = tagRows.map((t) => t.name);

    return this.mapToNoteItem(row, tags);
  }

  public async listNotes(filter?: NoteFilter): Promise<NoteItem[]> {
    let sql = `SELECT * FROM notes WHERE status != 'trashed'`;
    const params: any[] = [];

    if (filter) {
      if (filter.status) {
        sql = `SELECT * FROM notes WHERE status = ?`;
        params.push(filter.status);
      }
      if (filter.folderId) {
        sql += ` AND folder_id = ?`;
        params.push(filter.folderId);
      }
      if (filter.folderPath) {
        sql += ` AND folder_path = ?`;
        params.push(filter.folderPath);
      }
      if (filter.isFavorite !== undefined) {
        sql += ` AND is_favorite = ?`;
        params.push(filter.isFavorite ? 1 : 0);
      }
      if (filter.isPinned !== undefined) {
        sql += ` AND is_pinned = ?`;
        params.push(filter.isPinned ? 1 : 0);
      }
      if (filter.searchQuery) {
        sql += ` AND (title LIKE ? OR content_markdown LIKE ?)`;
        params.push(`%${filter.searchQuery}%`, `%${filter.searchQuery}%`);
      }
    }

    sql += ` ORDER BY is_pinned DESC, updated_at DESC;`;

    const rows = await dbClient.query<DBNote>(sql, params);

    // Batch query tags for all notes
    const tagMap = new Map<string, string[]>();
    try {
      const tagRows = await dbClient.query<{ note_id: string; name: string }>(
        `SELECT nt.note_id, t.name 
         FROM note_tags nt 
         INNER JOIN tags t ON t.id = nt.tag_id;`
      );
      for (const row of tagRows) {
        const list = tagMap.get(row.note_id) || [];
        list.push(row.name);
        tagMap.set(row.note_id, list);
      }
    } catch (_) {}

    return rows.map((r) => this.mapToNoteItem(r, tagMap.get(r.id) || []));
  }

  public async updateNote(id: string, dto: UpdateNoteDTO): Promise<NoteItem> {
    const existing = await this.getNoteById(id);
    if (!existing) throw new Error(`Note not found with id: ${id}`);

    const updates: string[] = [];
    const params: any[] = [];

    if (dto.title !== undefined) {
      updates.push('title = ?');
      params.push(dto.title);
    }
    if (dto.contentMarkdown !== undefined) {
      updates.push('content_markdown = ?');
      params.push(dto.contentMarkdown);
    }
    if (dto.blocks !== undefined) {
      updates.push('blocks_json = ?');
      params.push(JSON.stringify(dto.blocks));
    }
    if (dto.colorToken !== undefined) {
      updates.push('color_token = ?');
      params.push(dto.colorToken);
    }
    if (dto.folderId !== undefined) {
      updates.push('folder_id = ?');
      params.push(dto.folderId);
    }
    if (dto.folderPath !== undefined) {
      updates.push('folder_path = ?');
      params.push(dto.folderPath);
    }
    if (dto.isFavorite !== undefined) {
      updates.push('is_favorite = ?');
      params.push(dto.isFavorite ? 1 : 0);
    }
    if (dto.isPinned !== undefined) {
      updates.push('is_pinned = ?');
      params.push(dto.isPinned ? 1 : 0);
    }
    if (dto.status !== undefined) {
      updates.push('status = ?');
      params.push(dto.status);
    }
    if (dto.reminderAt !== undefined) {
      updates.push('reminder_at = ?');
      params.push(dto.reminderAt);
    }
    if (dto.aiContextExcluded !== undefined) {
      updates.push('ai_context_excluded = ?');
      params.push(dto.aiContextExcluded ? 1 : 0);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    const updateSql = `UPDATE notes SET ${updates.join(', ')} WHERE id = ?;`;
    await dbClient.run(updateSql, params);

    // Update tags if provided
    if (dto.tags !== undefined) {
      await tagsRepo.setNoteTags(id, dto.tags);
    }

    // Append changelog & trigger debounced sync
    await this.queueNoteSyncDelta(id, 'update', dto as Record<string, any>, existing.userId);

    const updated = await this.getNoteById(id);
    return updated!;
  }

  public async updateNoteBlocks(noteId: string, blocks: ComposableBlock[]): Promise<NoteItem> {
    const contentMarkdown = blocks.map((b) => b.content).join('\n\n');

    return this.updateNote(noteId, {
      blocks,
      contentMarkdown,
    });
  }

  public async toggleFavorite(id: string): Promise<boolean> {
    const note = await this.getNoteById(id);
    if (!note) return false;

    const nextVal = !note.isFavorite;
    await dbClient.run(
      `UPDATE notes SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [nextVal ? 1 : 0, id]
    );

    await this.queueNoteSyncDelta(id, 'update', { isFavorite: nextVal }, note.userId);

    return nextVal;
  }

  public async togglePin(id: string): Promise<boolean> {
    const note = await this.getNoteById(id);
    if (!note) return false;

    const nextVal = !note.isPinned;
    await dbClient.run(
      `UPDATE notes SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [nextVal ? 1 : 0, id]
    );

    await this.queueNoteSyncDelta(id, 'update', { isPinned: nextVal }, note.userId);

    return nextVal;
  }

  public async softDeleteNote(id: string): Promise<void> {
    const note = await this.getNoteById(id);
    if (!note) return;

    await dbClient.run(
      `UPDATE notes 
       SET status = 'trashed', trashed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?;`,
      [id]
    );

    // Trashing is a status update (not a permanent purge)
    await this.queueNoteSyncDelta(id, 'update', { status: 'trashed' }, note.userId);
  }

  public async archiveNote(id: string): Promise<void> {
    const note = await this.getNoteById(id);
    await dbClient.run(
      `UPDATE notes 
       SET status = 'archived', updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?;`,
      [id]
    );
    await this.queueNoteSyncDelta(id, 'update', { status: 'archived' }, note?.userId);
  }

  public async unarchiveNote(id: string): Promise<void> {
    const note = await this.getNoteById(id);
    await dbClient.run(
      `UPDATE notes 
       SET status = 'active', updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?;`,
      [id]
    );
    await this.queueNoteSyncDelta(id, 'update', { status: 'active' }, note?.userId);
  }

  public async restoreNote(id: string): Promise<void> {
    const note = await this.getNoteById(id);
    await dbClient.run(
      `UPDATE notes 
       SET status = 'active', trashed_at = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?;`,
      [id]
    );
    await this.queueNoteSyncDelta(id, 'update', { status: 'active' }, note?.userId);
  }

  public async permanentlyDeleteNote(id: string): Promise<void> {
    const rawNote = await dbClient.queryFirst<{
      id: string;
      user_id: string;
      blocks_json: string;
      content_markdown: string;
    }>(`SELECT id, user_id, blocks_json, content_markdown FROM notes WHERE id = ?;`, [id]);

    if (rawNote) {
      await googleDriveVaultService
        .cleanupMediaForDeletedNotes([
          {
            id: rawNote.id,
            userId: rawNote.user_id,
            blocksJson: rawNote.blocks_json,
            contentMarkdown: rawNote.content_markdown,
          },
        ])
        .catch(() => {});
    }

    await dbClient.run(`DELETE FROM tasks WHERE note_id = ?;`, [id]);
    await dbClient.run(`DELETE FROM note_tags WHERE note_id = ?;`, [id]);
    await dbClient.run(`DELETE FROM entity_relations WHERE source_id = ? OR target_id = ?;`, [id, id]);
    await this.queueNoteSyncDelta(
      id,
      'delete',
      { action: 'permanent_purge', timestamp: new Date().toISOString() },
      rawNote?.user_id
    );
    await dbClient.run(`DELETE FROM notes WHERE id = ?;`, [id]);
  }

  public async emptyTrashCascade(): Promise<number> {
    const trashedNotes = await dbClient.query<{
      id: string;
      user_id: string;
      blocks_json: string;
      content_markdown: string;
    }>(
      `SELECT id, user_id, blocks_json, content_markdown FROM notes WHERE status = 'trashed';`
    );
    if (trashedNotes.length === 0) return 0;

    await googleDriveVaultService
      .cleanupMediaForDeletedNotes(
        trashedNotes.map((r) => ({
          id: r.id,
          userId: r.user_id,
          blocksJson: r.blocks_json,
          contentMarkdown: r.content_markdown,
        }))
      )
      .catch(() => {});

    const ids = trashedNotes.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');

    await dbClient.run(`DELETE FROM tasks WHERE note_id IN (${placeholders});`, ids);
    await dbClient.run(`DELETE FROM note_tags WHERE note_id IN (${placeholders});`, ids);
    await dbClient.run(
      `DELETE FROM entity_relations WHERE source_id IN (${placeholders}) OR target_id IN (${placeholders});`,
      [...ids, ...ids]
    );

    for (const row of trashedNotes) {
      await this.queueNoteSyncDelta(
        row.id,
        'delete',
        { action: 'empty_trash_purge', timestamp: new Date().toISOString() },
        row.user_id
      );
    }

    await dbClient.run(`DELETE FROM notes WHERE id IN (${placeholders});`, ids);
    return ids.length;
  }

  public async batchSoftDeleteNotes(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await dbClient.run(
      `UPDATE notes 
       SET status = 'trashed', trashed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id IN (${placeholders});`,
      ids
    );
    for (const id of ids) {
      await this.queueNoteSyncDelta(id, 'update', { status: 'trashed' });
    }
  }

  public async batchPermanentlyDeleteNotes(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    const targetNotes = await dbClient.query<{
      id: string;
      user_id: string;
      blocks_json: string;
      content_markdown: string;
    }>(
      `SELECT id, user_id, blocks_json, content_markdown FROM notes WHERE id IN (${placeholders});`,
      ids
    );

    if (targetNotes.length > 0) {
      await googleDriveVaultService
        .cleanupMediaForDeletedNotes(
          targetNotes.map((r) => ({
            id: r.id,
            userId: r.user_id,
            blocksJson: r.blocks_json,
            contentMarkdown: r.content_markdown,
          }))
        )
        .catch(() => {});
    }

    const userById = new Map(targetNotes.map((r) => [r.id, r.user_id]));
    await dbClient.run(`DELETE FROM tasks WHERE note_id IN (${placeholders});`, ids);
    await dbClient.run(`DELETE FROM note_tags WHERE note_id IN (${placeholders});`, ids);
    for (const id of ids) {
      await this.queueNoteSyncDelta(
        id,
        'delete',
        { action: 'batch_permanent_purge' },
        userById.get(id)
      );
    }
    await dbClient.run(`DELETE FROM notes WHERE id IN (${placeholders});`, ids);
  }

  public async batchRestoreNotes(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await dbClient.run(
      `UPDATE notes 
       SET status = 'active', trashed_at = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE id IN (${placeholders});`,
      ids
    );
    for (const id of ids) {
      await this.queueNoteSyncDelta(id, 'update', { status: 'active' });
    }
  }

  public async batchArchiveNotes(ids: string[], archive: boolean): Promise<void> {
    if (ids.length === 0) return;
    const status = archive ? 'archived' : 'active';
    const placeholders = ids.map(() => '?').join(',');
    await dbClient.run(
      `UPDATE notes 
       SET status = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id IN (${placeholders});`,
      [status, ...ids]
    );
    for (const id of ids) {
      await this.queueNoteSyncDelta(id, 'update', { status });
    }
  }

  public async batchTogglePinNotes(ids: string[], pin: boolean): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await dbClient.run(
      `UPDATE notes 
       SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id IN (${placeholders});`,
      [pin ? 1 : 0, ...ids]
    );
    for (const id of ids) {
      await this.queueNoteSyncDelta(id, 'update', { isPinned: pin });
    }
  }

  public async batchMoveNotesToFolder(ids: string[], folderPath: string, folderId?: string): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await dbClient.run(
      `UPDATE notes 
       SET folder_path = ?, folder_id = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id IN (${placeholders});`,
      [folderPath, folderId || null, ...ids]
    );
    for (const id of ids) {
      await this.queueNoteSyncDelta(id, 'update', { folderPath, folderId: folderId || null });
    }
  }
}

export const notesRepo = new NotesRepository();
