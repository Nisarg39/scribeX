/**
 * ScribeX Lean SQLite Cache & Eviction Manager (Logged-In Mode)
 * Source of Truth: docs/Unified_Backend_and_AI_Master_Specification.md (Section 3.2.1)
 *
 * Guarantees minimal device storage when authenticated:
 * - Retains ONLY Page 1 (20 notes) lightweight card previews (`blocks_json = '[]'`) locally
 * - Hydrates full `blocks_json` on demand while the Note Editor is open
 * - Evicts `blocks_json` and non-Page-1 note rows after Cloud ACK & Editor exit
 * - Strictly protects any note with uncommitted local edits in `sync_changelog`
 */

import { dbClient } from './client';
import { DBNote } from './types';
import { tagsRepo } from './tagsRepo';
import { formatCleanNotePreview } from '../core/searchIndexer';
import { ComposableBlock, NoteColorToken, NoteItem } from '../types/note';

export const CLOUD_PAGE_SIZE = 20;

export function parseCloudBlocks(rawBlocks: any, fallbackContent: string = ''): ComposableBlock[] {
  if (Array.isArray(rawBlocks)) {
    return rawBlocks as ComposableBlock[];
  }
  if (typeof rawBlocks === 'string') {
    try {
      const parsed = JSON.parse(rawBlocks);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fallback below
    }
  }
  if (fallbackContent) {
    return [{ id: `b-fallback-${Date.now()}`, type: 'paragraph', content: fallbackContent }];
  }
  return [];
}

/**
 * Shared mapper converting a Supabase RPC note row (`rpc_list_notes_paginated` / `rpc_get_note_by_id`)
 * into a UI-ready `NoteItem`.
 */
export function mapCloudNoteToNoteItem(cloudNote: any): NoteItem {
  const blocks = parseCloudBlocks(cloudNote.blocks_json);
  const rawTags = Array.isArray(cloudNote.tags) ? cloudNote.tags.filter(Boolean) : [];
  const isDehydrated = blocks.length === 0;

  return {
    id: cloudNote.id,
    userId: cloudNote.user_id,
    folderId: cloudNote.folder_id || undefined,
    folderPath: cloudNote.folder_path || 'General',
    title: cloudNote.title || 'Untitled Note',
    contentMarkdown: cloudNote.content_markdown || '',
    blocks,
    colorToken: (cloudNote.color_token || 'apricot') as NoteColorToken,
    isFavorite: Boolean(cloudNote.is_favorite),
    isPinned: Boolean(cloudNote.is_pinned),
    status: cloudNote.status || 'active',
    tags: rawTags,
    reminderAt: cloudNote.reminder_at || undefined,
    isLocked: Boolean(cloudNote.is_locked),
    lockType: cloudNote.lock_type || undefined,
    lockCredentialKind: cloudNote.lock_credential_kind || undefined,
    lockHash: cloudNote.lock_hash || undefined,
    lockSalt: cloudNote.lock_salt || undefined,
    lockHint: cloudNote.lock_hint || undefined,
    aiContextExcluded: Boolean(cloudNote.ai_context_excluded),
    isDehydrated,
    syncRev: typeof cloudNote.sync_rev === 'number' ? cloudNote.sync_rev : 0,
    createdAt: cloudNote.created_at || new Date().toISOString(),
    updatedAt: cloudNote.updated_at || new Date().toISOString(),
  };
}

/**
 * Checks whether a note has uncommitted local edits in the sync_changelog Outbox.
 */
async function getDirtyNoteIdsSet(): Promise<Set<string>> {
  const rows = await dbClient.query<{ entity_id: string }>(
    `SELECT DISTINCT entity_id FROM sync_changelog WHERE entity_type = 'note';`
  );
  return new Set(rows.map((r) => r.entity_id));
}

async function isNoteDirty(noteId: string): Promise<boolean> {
  const row = await dbClient.queryFirst<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM sync_changelog WHERE entity_type = 'note' AND entity_id = ?;`,
    [noteId]
  );
  return (row?.cnt || 0) > 0;
}

/**
 * Hydrates a full cloud note (including complete `blocks_json` and tags) into a local
 * working SQLite row for fast editing inside `/note/[id]`, without creating a sync_changelog entry.
 */
export async function hydrateNoteForEditing(cloudNote: any): Promise<NoteItem> {
  const mapped = mapCloudNoteToNoteItem(cloudNote);
  const blocksJsonStr =
    typeof cloudNote.blocks_json === 'string'
      ? cloudNote.blocks_json
      : JSON.stringify(mapped.blocks);

  await dbClient.run(
    `INSERT INTO notes (
      id, user_id, folder_id, folder_path, group_name, title,
      content_markdown, blocks_json, color_token, is_favorite, is_pinned,
      status, priority_score, reminder_at,
      is_locked, lock_type, lock_credential_kind, lock_hash, lock_salt, lock_hint,
      ai_context_excluded, sync_rev, created_at, updated_at, trashed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      folder_id = excluded.folder_id,
      folder_path = excluded.folder_path,
      title = excluded.title,
      content_markdown = excluded.content_markdown,
      blocks_json = excluded.blocks_json,
      color_token = excluded.color_token,
      is_favorite = excluded.is_favorite,
      is_pinned = excluded.is_pinned,
      status = excluded.status,
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
      mapped.id,
      mapped.userId,
      mapped.folderId || null,
      mapped.folderPath || 'General',
      cloudNote.group_name || null,
      mapped.title,
      mapped.contentMarkdown,
      blocksJsonStr,
      mapped.colorToken,
      mapped.isFavorite ? 1 : 0,
      mapped.isPinned ? 1 : 0,
      mapped.status,
      cloudNote.priority_score || 0.0,
      mapped.reminderAt || null,
      mapped.isLocked ? 1 : 0,
      mapped.lockType || null,
      mapped.lockCredentialKind || null,
      mapped.lockHash || null,
      mapped.lockSalt || null,
      mapped.lockHint || null,
      mapped.aiContextExcluded ? 1 : 0,
      mapped.syncRev || 0,
      mapped.createdAt,
      mapped.updatedAt,
      cloudNote.trashed_at || null,
    ]
  );

  if (mapped.tags && mapped.tags.length > 0) {
    await tagsRepo.setNoteTags(mapped.id, mapped.tags).catch(() => {});
  }

  return { ...mapped, isDehydrated: false };
}

/**
 * Caches ONLY Page 1 (top 20 notes) lightweight card previews (`blocks_json = '[]'`)
 * in local SQLite for sub-2ms cold app startup. Never overwrites dirty local notes.
 */
export async function cachePageOnePreviews(
  cloudNotes: any[],
  authenticatedUserId: string
): Promise<string[]> {
  if (!authenticatedUserId || authenticatedUserId === 'user-default') return [];

  const dirtyIds = await getDirtyNoteIdsSet();
  const pageOneSlice = cloudNotes.slice(0, CLOUD_PAGE_SIZE);
  const pageOneIds: string[] = [];

  await dbClient.withTransaction(async () => {
    for (const c of pageOneSlice) {
      if (!c?.id) continue;
      pageOneIds.push(c.id);
      if (dirtyIds.has(c.id)) {
        // Protect uncommitted local changes from being overwritten by dehydrated preview stub
        continue;
      }

      const snippet = String(c.content_markdown || '').slice(0, 240);
      await dbClient.run(
        `INSERT INTO notes (
          id, user_id, folder_id, folder_path, group_name, title,
          content_markdown, blocks_json, color_token, is_favorite, is_pinned,
          status, priority_score, reminder_at,
          is_locked, lock_type, lock_credential_kind, lock_hash, lock_salt, lock_hint,
          ai_context_excluded, sync_rev, created_at, updated_at, trashed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          folder_id = excluded.folder_id,
          folder_path = excluded.folder_path,
          title = excluded.title,
          content_markdown = excluded.content_markdown,
          blocks_json = '[]',
          color_token = excluded.color_token,
          is_favorite = excluded.is_favorite,
          is_pinned = excluded.is_pinned,
          status = excluded.status,
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
          c.id,
          c.user_id || authenticatedUserId,
          c.folder_id || null,
          c.folder_path || 'General',
          c.group_name || null,
          c.title || 'Untitled Note',
          snippet,
          c.color_token || 'apricot',
          c.is_favorite ? 1 : 0,
          c.is_pinned ? 1 : 0,
          c.status || 'active',
          c.priority_score || 0.0,
          c.reminder_at || null,
          c.is_locked ? 1 : 0,
          c.lock_type || null,
          c.lock_credential_kind || null,
          c.lock_hash || null,
          c.lock_salt || null,
          c.lock_hint || null,
          c.ai_context_excluded ? 1 : 0,
          typeof c.sync_rev === 'number' ? c.sync_rev : 1,
          c.created_at || new Date().toISOString(),
          c.updated_at || new Date().toISOString(),
          c.trashed_at || null,
        ]
      );
    }
  });

  return pageOneIds;
}

/**
 * After a note is synced to Supabase and the Editor closes:
 * - If dirty (pending in sync_changelog): keeps local note 100% intact.
 * - If clean & inside Page 1: dehydrates `blocks_json = '[]'` and stores clean 240-char snippet.
 * - If clean & outside Page 1: removes local SQLite row completely to keep device lean.
 */
export async function dehydrateNoteAfterSync(
  noteId: string,
  pageOneIds: ReadonlySet<string>
): Promise<'dehydrated' | 'evicted' | 'protected_dirty'> {
  if (!noteId || noteId.startsWith('draft-')) return 'evicted';

  if (await isNoteDirty(noteId)) {
    return 'protected_dirty';
  }

  if (pageOneIds.has(noteId)) {
    const existing = await dbClient.queryFirst<DBNote>(`SELECT * FROM notes WHERE id = ?;`, [
      noteId,
    ]);
    if (!existing) return 'evicted';

    let cleanSnippet = (existing.content_markdown || '').slice(0, 240);
    try {
      const blocks = JSON.parse(existing.blocks_json || '[]');
      if (Array.isArray(blocks) && blocks.length > 0) {
        cleanSnippet = formatCleanNotePreview({
          blocks,
          contentMarkdown: existing.content_markdown || '',
        }).slice(0, 240);
      }
    } catch {
      // Keep sliced markdown fallback
    }

    await dbClient.run(
      `UPDATE notes SET blocks_json = '[]', content_markdown = ? WHERE id = ?;`,
      [cleanSnippet, noteId]
    );
    return 'dehydrated';
  }

  await dbClient.run(`DELETE FROM notes WHERE id = ?;`, [noteId]);
  return 'evicted';
}

/**
 * Prunes any clean synced local notes that fall outside the Page 1 cache window
 * (and is not the currently open Editor note), while preserving all dirty local notes.
 */
export async function enforcePageOneFootprint(
  pageOneIds: ReadonlySet<string>,
  activeOpenNoteId?: string | null
): Promise<number> {
  const dirtyIds = await getDirtyNoteIdsSet();
  const localNotes = await dbClient.query<Pick<DBNote, 'id' | 'blocks_json'>>(
    `SELECT id, blocks_json FROM notes;`
  );

  let evictedCount = 0;

  for (const row of localNotes) {
    if (dirtyIds.has(row.id) || row.id === activeOpenNoteId) {
      continue;
    }

    if (pageOneIds.has(row.id)) {
      if (row.blocks_json && row.blocks_json !== '[]') {
        await dehydrateNoteAfterSync(row.id, pageOneIds);
      }
    } else {
      await dbClient.run(`DELETE FROM notes WHERE id = ?;`, [row.id]);
      evictedCount++;
    }
  }

  return evictedCount;
}

export const leanCacheManager = {
  CLOUD_PAGE_SIZE,
  mapCloudNoteToNoteItem,
  hydrateNoteForEditing,
  cachePageOnePreviews,
  dehydrateNoteAfterSync,
  enforcePageOneFootprint,
};
