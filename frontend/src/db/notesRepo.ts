/**
 * ScribeX Notes Repository
 * Source of Truth: docs/Universal_Note_Input_Structure_and_Relations.md
 */

import { dbClient } from './client';
import { DBNote, CreateNoteDTO, UpdateNoteDTO, NoteFilter } from './types';
import { NoteItem, ComposableBlock } from '../types/note';
import { NoteColorToken } from '../theme/tokens';

const createLogId = () => `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export class NotesRepository {
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
        id, user_id, folder_id, folder_path, group_name, title, content_markdown, blocks_json, color_token, is_favorite, is_pinned, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active');
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
    ]);

    // Handle tags if provided
    if (dto.tags && dto.tags.length > 0) {
      for (const tag of dto.tags) {
        const tagId = `tag-${tag.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        await dbClient.run(`INSERT OR IGNORE INTO tags (id, user_id, name) VALUES (?, ?, ?);`, [tagId, userId, tag]);
        await dbClient.run(`INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?);`, [noteId, tagId]);
      }
    }

    // Append to sync changelog
    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'note', ?, 'insert', ?);`,
      [createLogId(), userId, noteId, JSON.stringify({ id: noteId, title, content, colorToken })]
    );

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
    return rows.map((r) => this.mapToNoteItem(r));
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

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    const updateSql = `UPDATE notes SET ${updates.join(', ')} WHERE id = ?;`;
    await dbClient.run(updateSql, params);

    // Append changelog
    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'note', ?, 'update', ?);`,
      [createLogId(), existing.userId, id, JSON.stringify(dto)]
    );

    const updated = await this.getNoteById(id);
    return updated!;
  }

  public async updateNoteBlocks(noteId: string, blocks: ComposableBlock[]): Promise<NoteItem> {
    const blocksJson = JSON.stringify(blocks);
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

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'note', ?, 'update', ?);`,
      [createLogId(), note.userId, id, JSON.stringify({ isFavorite: nextVal })]
    );

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

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'note', ?, 'delete', ?);`,
      [createLogId(), note.userId, id, JSON.stringify({ status: 'trashed' })]
    );
  }

  public async restoreNote(id: string): Promise<void> {
    await dbClient.run(
      `UPDATE notes 
       SET status = 'active', trashed_at = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?;`,
      [id]
    );
  }

  public async permanentlyDeleteNote(id: string): Promise<void> {
    await dbClient.run(`DELETE FROM notes WHERE id = ?;`, [id]);
  }
}

export const notesRepo = new NotesRepository();
