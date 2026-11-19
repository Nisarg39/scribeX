/**
 * ScribeX Tags Repository
 * Source of Truth: docs/Universal_Note_Input_Structure_and_Relations.md
 */

import { dbClient } from './client';
import { DBTag } from './types';

function deterministicTagHash(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export class TagsRepository {
  public async createTag(
    name: string,
    colorToken: string = 'cyan',
    userId: string = 'user-default'
  ): Promise<DBTag> {
    const cleanName = name.trim().replace(/^#+/, '');
    const effectiveUserId = userId || 'user-default';

    // Always reuse existing tag case-insensitively first (prevents ID/name mismatches across devices)
    const existingByName = await dbClient.queryFirst<DBTag>(
      `SELECT * FROM tags WHERE LOWER(name) = LOWER(?) LIMIT 1;`,
      [cleanName]
    );
    if (existingByName) {
      return existingByName;
    }

    const lower = cleanName.toLowerCase();
    const asciiSlug = lower.replace(/[^a-z0-9]/g, '-');
    let id =
      asciiSlug && asciiSlug === lower
        ? `tag-${asciiSlug}`
        : `tag-${asciiSlug || 'u'}-${deterministicTagHash(lower)}`;

    // Ensure generated ID does not collide with an unrelated tag
    const existingById = await dbClient.queryFirst<DBTag>(
      `SELECT * FROM tags WHERE id = ? LIMIT 1;`,
      [id]
    );
    if (existingById && existingById.name.toLowerCase() !== lower) {
      id = `tag-${deterministicTagHash(lower)}-${Date.now().toString(36)}`;
    }

    await dbClient.run(
      `INSERT OR IGNORE INTO tags (id, user_id, name, color_token) VALUES (?, ?, ?, ?);`,
      [id, effectiveUserId, cleanName, colorToken]
    );

    const tag = await dbClient.queryFirst<DBTag>(
      `SELECT * FROM tags WHERE LOWER(name) = LOWER(?) OR id = ? LIMIT 1;`,
      [cleanName, id]
    );
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

  public async setNoteTags(
    noteId: string,
    tags: string[],
    userId: string = 'user-default'
  ): Promise<void> {
    // Remove existing note_tags links
    await dbClient.run(`DELETE FROM note_tags WHERE note_id = ?;`, [noteId]);

    // Insert new tags & junctions
    for (const tag of tags) {
      const clean = tag.trim().replace(/^#+/, '');
      if (!clean) continue;
      const created = await this.createTag(clean, 'cyan', userId);
      if (created?.id) {
        await dbClient.run(
          `INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?);`,
          [noteId, created.id]
        );
      }
    }

    // Prune orphaned tags no longer attached to any local note so cleared tag chips disappear cleanly
    await dbClient.run(
      `DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags);`
    );
  }
}

export const tagsRepo = new TagsRepository();
