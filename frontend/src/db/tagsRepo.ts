/**
 * ScribeX Tags Repository
 * Source of Truth: docs/Universal_Note_Input_Structure_and_Relations.md
 */

import { dbClient } from './client';
import { DBTag } from './types';

export class TagsRepository {
  public async createTag(name: string, colorToken: string = 'cyan'): Promise<DBTag> {
    const cleanName = name.trim().replace(/^#/, '');
    const id = `tag-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    await dbClient.run(
      `INSERT OR IGNORE INTO tags (id, user_id, name, color_token) VALUES (?, 'user-default', ?, ?);`,
      [id, cleanName, colorToken]
    );

    const tag = await dbClient.queryFirst<DBTag>(`SELECT * FROM tags WHERE id = ?;`, [id]);
    return tag!;
  }

  public async listTags(): Promise<DBTag[]> {
    return dbClient.query<DBTag>(`SELECT * FROM tags ORDER BY name ASC;`);
  }

  public async getTagsForNote(noteId: string): Promise<string[]> {
    const rows = await dbClient.query<{ name: string }>(
      `SELECT t.name FROM tags t
       INNER JOIN note_tags nt ON nt.tag_id = t.id
       WHERE nt.note_id = ?
       ORDER BY t.name ASC;`,
      [noteId]
    );
    return rows.map((r) => r.name);
  }

  public async setNoteTags(noteId: string, tags: string[]): Promise<void> {
    // Remove existing
    await dbClient.run(`DELETE FROM note_tags WHERE note_id = ?;`, [noteId]);

    // Insert new tags & junctions
    for (const tag of tags) {
      const clean = tag.trim().replace(/^#/, '');
      if (!clean) continue;
      const created = await this.createTag(clean);
      await dbClient.run(
        `INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?);`,
        [noteId, created.id]
      );
    }
  }
}

export const tagsRepo = new TagsRepository();
