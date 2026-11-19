/**
 * ScribeX Offline-to-Existing-Account Note Merge & Cloud Reconciliation
 *
 * Ensures that when a user creates or edits notes in offline/guest mode and later signs into
 * an existing Google account with cloud notes:
 * - Matching `note.id` in cloud -> deterministic, non-destructive block-level & tag merge (pushes `update` if changed, skips if no-op)
 * - Unmatched `note.id` -> added cleanly as a brand-new note (`insert`) with cloud folder path remapping
 * - Untouched default guest seed notes never overwrite customized cloud notes
 */

import { serializeBlocksToMarkdown } from '../../core/ast/serializeBlocks';
import { dbClient } from '../../db/client';
import { DBNote } from '../../db/types';
import { ComposableBlock } from '../../types/note';
import { isSupabaseConfigured, supabase } from '../supabase/supabaseClient';

export const DEFAULT_SEED_NOTE_IDS = new Set<string>([
  'note-welcome-starter',
  'note-1',
  'note-2',
  'note-3',
  'note-4',
]);

export interface MergeNoteInput {
  id: string;
  title: string;
  folder_id: string | null;
  folder_path: string;
  blocks: ComposableBlock[];
  content_markdown: string;
  color_token: string;
  is_favorite: boolean;
  is_pinned: boolean;
  status: string;
  reminder_at: string | null;
  is_locked: boolean;
  lock_type: string | null;
  lock_credential_kind: string | null;
  lock_hash: string | null;
  lock_salt: string | null;
  lock_hint: string | null;
  ai_context_excluded: boolean;
  tags: string[];
  updated_at: string | null;
  sync_rev?: number;
}

export interface MergeNoteOptions {
  isUntouchedLocalSeed?: boolean;
}

export interface MergeNoteResult {
  merged: MergeNoteInput;
  hasChangesVsCloud: boolean;
  appendedLocalBlockCount: number;
  updatedSharedBlockCount: number;
}

export interface CloudReconciliationSummary {
  mergedCount: number;
  newCount: number;
  skippedNoOpCount: number;
}

function parseTimestampMs(ts?: string | null): number {
  if (!ts) return 0;
  const parsed = Date.parse(ts);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTagList(tags: string[] | null | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const clean = String(raw || '').trim().toLowerCase();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

function isBlankPlaceholderParagraph(block: ComposableBlock): boolean {
  if (!block || block.type !== 'paragraph') return false;
  const contentEmpty = !String(block.content || '').trim();
  const hasMetadataKeys = Boolean(block.metadata && Object.keys(block.metadata).length > 0);
  return contentEmpty && !hasMetadataKeys;
}

function stableBlockSignature(block: ComposableBlock): string {
  return JSON.stringify({
    id: block.id,
    type: block.type,
    content: block.content ?? '',
    metadata: block.metadata ?? null,
  });
}

function parseBlocksSafe(raw: unknown): ComposableBlock[] {
  if (Array.isArray(raw)) return raw as ComposableBlock[];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ComposableBlock[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Pure deterministic merger for a local offline note and an existing cloud note with the same `note.id`.
 */
export function mergeLocalAndCloudNote(
  local: MergeNoteInput,
  cloud: MergeNoteInput,
  options: MergeNoteOptions = {}
): MergeNoteResult {
  const cloudTags = normalizeTagList(cloud.tags);
  const localTags = normalizeTagList(local.tags);

  // Untouched default guest seed notes automatically yield to the existing cloud account's copy
  if (options.isUntouchedLocalSeed) {
    return {
      merged: {
        ...cloud,
        tags: cloudTags,
      },
      hasChangesVsCloud: false,
      appendedLocalBlockCount: 0,
      updatedSharedBlockCount: 0,
    };
  }

  const localMs = parseTimestampMs(local.updated_at);
  const cloudMs = parseTimestampMs(cloud.updated_at);
  const localIsNewer = localMs >= cloudMs;

  const cloudBlocks = Array.isArray(cloud.blocks) ? cloud.blocks : [];
  const localBlocks = Array.isArray(local.blocks) ? local.blocks : [];

  const localById = new Map<string, ComposableBlock>();
  for (const lb of localBlocks) {
    if (lb?.id) localById.set(lb.id, lb);
  }

  const seenBlockIds = new Set<string>();
  const mergedBlocks: ComposableBlock[] = [];
  let updatedSharedBlockCount = 0;
  let appendedLocalBlockCount = 0;

  // 1. Preserve all existing cloud blocks in order, resolving shared block IDs by newer timestamp
  for (const cb of cloudBlocks) {
    if (!cb?.id) {
      mergedBlocks.push(cb);
      continue;
    }
    seenBlockIds.add(cb.id);
    const matchingLocal = localById.get(cb.id);
    if (matchingLocal && stableBlockSignature(matchingLocal) !== stableBlockSignature(cb)) {
      if (localIsNewer) {
        mergedBlocks.push(matchingLocal);
        updatedSharedBlockCount++;
      } else {
        mergedBlocks.push(cb);
      }
    } else {
      mergedBlocks.push(cb);
    }
  }

  // 2. Append any offline-only blocks (new text, checklists, gdrive:// images, etc.)
  for (const lb of localBlocks) {
    if (lb?.id && seenBlockIds.has(lb.id)) continue;
    if (mergedBlocks.length > 0 && isBlankPlaceholderParagraph(lb)) continue;
    if (lb?.id) seenBlockIds.add(lb.id);
    mergedBlocks.push(lb);
    appendedLocalBlockCount++;
  }

  const mergedMarkdown =
    mergedBlocks.length > 0
      ? serializeBlocksToMarkdown(mergedBlocks)
      : localIsNewer
      ? local.content_markdown || cloud.content_markdown
      : cloud.content_markdown || local.content_markdown;

  const mergedTags = normalizeTagList([...cloudTags, ...localTags]);

  const pickScalar = <T>(localVal: T, cloudVal: T, isNonEmpty?: (v: T) => boolean): T => {
    const preferred = localIsNewer ? localVal : cloudVal;
    const fallback = localIsNewer ? cloudVal : localVal;
    if (isNonEmpty) {
      return isNonEmpty(preferred) ? preferred : fallback;
    }
    return preferred !== undefined && preferred !== null ? preferred : fallback;
  };

  const mergedTitle = pickScalar(
    local.title,
    cloud.title,
    (v) => typeof v === 'string' && v.trim().length > 0
  );
  const mergedFolderId = pickScalar(local.folder_id, cloud.folder_id);
  const mergedFolderPath = pickScalar(
    local.folder_path,
    cloud.folder_path,
    (v) => typeof v === 'string' && v.trim().length > 0
  );
  const mergedColor = pickScalar(
    local.color_token,
    cloud.color_token,
    (v) => typeof v === 'string' && v.trim().length > 0
  );
  const mergedStatus = pickScalar(
    local.status,
    cloud.status,
    (v) => typeof v === 'string' && v.trim().length > 0
  );
  const mergedReminder = pickScalar(local.reminder_at, cloud.reminder_at);
  const mergedLocked = localIsNewer ? local.is_locked : cloud.is_locked;
  const mergedLockType = mergedLocked
    ? pickScalar(local.lock_type, cloud.lock_type)
    : null;
  const mergedLockKind = mergedLocked
    ? pickScalar(local.lock_credential_kind, cloud.lock_credential_kind)
    : null;
  const mergedLockHash = mergedLocked
    ? pickScalar(local.lock_hash, cloud.lock_hash)
    : null;
  const mergedLockSalt = mergedLocked
    ? pickScalar(local.lock_salt, cloud.lock_salt)
    : null;
  const mergedLockHint = mergedLocked
    ? pickScalar(local.lock_hint, cloud.lock_hint)
    : null;

  const merged: MergeNoteInput = {
    id: cloud.id,
    title: mergedTitle || cloud.title || local.title || 'Untitled Note',
    folder_id: mergedFolderId,
    folder_path: mergedFolderPath || 'General',
    blocks: mergedBlocks,
    content_markdown: mergedMarkdown,
    color_token: mergedColor || 'apricot',
    is_favorite: Boolean(local.is_favorite || cloud.is_favorite),
    is_pinned: Boolean(local.is_pinned || cloud.is_pinned),
    status: mergedStatus || 'active',
    reminder_at: mergedReminder,
    is_locked: Boolean(mergedLocked),
    lock_type: mergedLockType,
    lock_credential_kind: mergedLockKind,
    lock_hash: mergedLockHash,
    lock_salt: mergedLockSalt,
    lock_hint: mergedLockHint,
    ai_context_excluded: Boolean(local.ai_context_excluded || cloud.ai_context_excluded),
    tags: mergedTags,
    updated_at:
      localMs >= cloudMs
        ? local.updated_at || new Date().toISOString()
        : cloud.updated_at || new Date().toISOString(),
    sync_rev: Math.max(local.sync_rev || 0, cloud.sync_rev || 0),
  };

  const blocksChanged =
    mergedBlocks.length !== cloudBlocks.length ||
    mergedBlocks.some(
      (b, idx) => stableBlockSignature(b) !== stableBlockSignature(cloudBlocks[idx])
    );

  const tagsChanged =
    mergedTags.length !== cloudTags.length ||
    mergedTags.some((t) => !cloudTags.includes(t));

  const scalarsChanged =
    merged.title !== cloud.title ||
    merged.folder_id !== cloud.folder_id ||
    merged.folder_path !== cloud.folder_path ||
    merged.color_token !== cloud.color_token ||
    merged.is_favorite !== Boolean(cloud.is_favorite) ||
    merged.is_pinned !== Boolean(cloud.is_pinned) ||
    merged.status !== cloud.status ||
    (merged.reminder_at || null) !== (cloud.reminder_at || null) ||
    merged.is_locked !== Boolean(cloud.is_locked) ||
    merged.ai_context_excluded !== Boolean(cloud.ai_context_excluded);

  return {
    merged,
    hasChangesVsCloud: blocksChanged || tagsChanged || scalarsChanged,
    appendedLocalBlockCount,
    updatedSharedBlockCount,
  };
}

/**
 * Reconciles all pending/local non-dehydrated offline notes against the authenticated user's
 * existing Supabase cloud vault BEFORE `syncEngine.flushNow()` runs.
 * - Existing cloud `note.id`: merges non-destructively and converts outbox delta to `update` (or removes no-op delta).
 * - Non-existent `note.id`: remaps folder_id by path if an existing cloud folder matches and keeps `insert` delta.
 */
export async function reconcileOfflineNotesWithCloud(
  userId: string
): Promise<CloudReconciliationSummary> {
  if (!userId || userId === 'user-default' || !isSupabaseConfigured()) {
    return { mergedCount: 0, newCount: 0, skippedNoOpCount: 0 };
  }

  const pendingNoteLogs = await dbClient.query<{
    id: string;
    entity_id: string;
    change_type: string;
    delta_payload: string;
  }>(
    `SELECT id, entity_id, change_type, delta_payload
     FROM sync_changelog
     WHERE entity_type = 'note' AND change_type IN ('insert', 'update');`
  );

  if (!pendingNoteLogs || pendingNoteLogs.length === 0) {
    return { mergedCount: 0, newCount: 0, skippedNoOpCount: 0 };
  }

  const candidateIdsSet = new Set<string>();
  const hasExplicitUpdateByNoteId = new Set<string>();
  for (const log of pendingNoteLogs) {
    if (!log.entity_id) continue;
    candidateIdsSet.add(log.entity_id);
    if (log.change_type === 'update') {
      hasExplicitUpdateByNoteId.add(log.entity_id);
    }
  }

  const candidateIds = Array.from(candidateIdsSet);
  if (candidateIds.length === 0) {
    return { mergedCount: 0, newCount: 0, skippedNoOpCount: 0 };
  }

  // Batch-fetch matching cloud notes, cloud note tags, and existing cloud folders in parallel
  const [cloudNotesRes, cloudTagsRes, cloudFoldersRes] = await Promise.all([
    supabase.from('notes').select('*').eq('user_id', userId).in('id', candidateIds),
    supabase.from('note_tags').select('note_id, tags(name)').in('note_id', candidateIds),
    supabase.from('folders').select('id, path').eq('user_id', userId),
  ]);

  if (cloudNotesRes.error) {
    throw new Error(cloudNotesRes.error.message);
  }

  const cloudNotesById = new Map<string, any>();
  for (const row of cloudNotesRes.data || []) {
    if (row?.id) cloudNotesById.set(row.id, row);
  }

  const cloudTagsByNoteId = new Map<string, string[]>();
  for (const row of (cloudTagsRes.data as any[]) || []) {
    const nid = row?.note_id;
    const tagName = Array.isArray(row?.tags) ? row.tags[0]?.name : row?.tags?.name;
    if (nid && tagName) {
      const list = cloudTagsByNoteId.get(nid) || [];
      list.push(String(tagName));
      cloudTagsByNoteId.set(nid, list);
    }
  }

  const cloudFolderIdByPath = new Map<string, string>();
  for (const f of cloudFoldersRes.data || []) {
    if (f?.id && f?.path) {
      cloudFolderIdByPath.set(String(f.path).trim().toLowerCase(), String(f.id));
    }
  }

  let mergedCount = 0;
  let newCount = 0;
  let skippedNoOpCount = 0;

  await dbClient.withTransaction(async () => {
    for (const noteId of candidateIds) {
      const localNote = await dbClient.queryFirst<DBNote>(`SELECT * FROM notes WHERE id = ?;`, [
        noteId,
      ]);
      if (!localNote) continue;

      const localTagRows = await dbClient.query<{ name: string }>(
        `SELECT t.name FROM tags t INNER JOIN note_tags nt ON nt.tag_id = t.id WHERE nt.note_id = ?;`,
        [noteId]
      );
      const localTags = localTagRows.map((r) => r.name);

      const cloudRow = cloudNotesById.get(noteId);

      // ---------------------------------------------------------------------
      // CASE 1: Note ID already exists in user's cloud account -> MERGE
      // ---------------------------------------------------------------------
      if (cloudRow) {
        const localInput: MergeNoteInput = {
          id: localNote.id,
          title: localNote.title,
          folder_id: localNote.folder_id || null,
          folder_path: localNote.folder_path || 'General',
          blocks: parseBlocksSafe(localNote.blocks_json),
          content_markdown: localNote.content_markdown || '',
          color_token: localNote.color_token || 'apricot',
          is_favorite: Boolean(localNote.is_favorite),
          is_pinned: Boolean(localNote.is_pinned),
          status: localNote.status || 'active',
          reminder_at: localNote.reminder_at || null,
          is_locked: Boolean(localNote.is_locked),
          lock_type: localNote.lock_type || null,
          lock_credential_kind: localNote.lock_credential_kind || null,
          lock_hash: localNote.lock_hash || null,
          lock_salt: localNote.lock_salt || null,
          lock_hint: localNote.lock_hint || null,
          ai_context_excluded: Boolean(localNote.ai_context_excluded),
          tags: localTags,
          updated_at: localNote.updated_at || null,
          sync_rev: localNote.sync_rev || 0,
        };

        const cloudInput: MergeNoteInput = {
          id: cloudRow.id,
          title: cloudRow.title || 'Untitled Note',
          folder_id: cloudRow.folder_id || null,
          folder_path: cloudRow.folder_path || 'General',
          blocks: parseBlocksSafe(cloudRow.blocks_json),
          content_markdown: cloudRow.content_markdown || '',
          color_token: cloudRow.color_token || 'apricot',
          is_favorite: Boolean(cloudRow.is_favorite),
          is_pinned: Boolean(cloudRow.is_pinned),
          status: cloudRow.status || 'active',
          reminder_at: cloudRow.reminder_at || null,
          is_locked: Boolean(cloudRow.is_locked),
          lock_type: cloudRow.lock_type || null,
          lock_credential_kind: cloudRow.lock_credential_kind || null,
          lock_hash: cloudRow.lock_hash || null,
          lock_salt: cloudRow.lock_salt || null,
          lock_hint: cloudRow.lock_hint || null,
          ai_context_excluded: Boolean(cloudRow.ai_context_excluded),
          tags: cloudTagsByNoteId.get(noteId) || [],
          updated_at: cloudRow.updated_at || null,
          sync_rev: Number(cloudRow.sync_rev) || 1,
        };

        const isUntouchedLocalSeed =
          DEFAULT_SEED_NOTE_IDS.has(noteId) &&
          !hasExplicitUpdateByNoteId.has(noteId) &&
          (localNote.sync_rev || 0) <= 0;

        const { merged, hasChangesVsCloud } = mergeLocalAndCloudNote(localInput, cloudInput, {
          isUntouchedLocalSeed,
        });

        const resolvedFolderId =
          merged.folder_id ||
          cloudFolderIdByPath.get(String(merged.folder_path || 'General').trim().toLowerCase()) ||
          null;
        const mergedBlocksJson = JSON.stringify(merged.blocks);
        const nextRev = Math.max(merged.sync_rev || 1, (cloudInput.sync_rev || 1) + (hasChangesVsCloud ? 1 : 0));

        await dbClient.run(
          `UPDATE notes
           SET folder_id = ?, folder_path = ?, title = ?, content_markdown = ?, blocks_json = ?,
               color_token = ?, is_favorite = ?, is_pinned = ?, status = ?, reminder_at = ?,
               is_locked = ?, lock_type = ?, lock_credential_kind = ?, lock_hash = ?, lock_salt = ?, lock_hint = ?,
               ai_context_excluded = ?, sync_rev = ?, updated_at = ?
           WHERE id = ?;`,
          [
            resolvedFolderId,
            merged.folder_path,
            merged.title,
            merged.content_markdown,
            mergedBlocksJson,
            merged.color_token,
            merged.is_favorite ? 1 : 0,
            merged.is_pinned ? 1 : 0,
            merged.status,
            merged.reminder_at,
            merged.is_locked ? 1 : 0,
            merged.lock_type,
            merged.lock_credential_kind,
            merged.lock_hash,
            merged.lock_salt,
            merged.lock_hint,
            merged.ai_context_excluded ? 1 : 0,
            nextRev,
            merged.updated_at || new Date().toISOString(),
            noteId,
          ]
        );

        // Sync merged tags locally
        await dbClient.run(`DELETE FROM note_tags WHERE note_id = ?;`, [noteId]);
        for (const tagName of merged.tags) {
          const existingTag = await dbClient.queryFirst<{ id: string }>(
            `SELECT id FROM tags WHERE name = ? LIMIT 1;`,
            [tagName]
          );
          const tagId =
            existingTag?.id || `tag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          if (!existingTag) {
            await dbClient.run(
              `INSERT OR IGNORE INTO tags (id, user_id, name, color_token) VALUES (?, ?, ?, 'cyan');`,
              [tagId, userId, tagName]
            );
          }
          await dbClient.run(
            `INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?);`,
            [noteId, tagId]
          );
        }

        // Replace stale insert/update deltas for this note
        await dbClient.run(
          `DELETE FROM sync_changelog WHERE entity_type = 'note' AND entity_id = ? AND change_type IN ('insert', 'update');`,
          [noteId]
        );

        if (hasChangesVsCloud) {
          const logId = `log-merge-${noteId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          await dbClient.run(
            `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
             VALUES (?, ?, ?, 'note', ?, 'update', ?);`,
            [
              logId,
              userId,
              nextRev,
              noteId,
              JSON.stringify({
                id: noteId,
                folder_id: resolvedFolderId,
                folder_path: merged.folder_path,
                title: merged.title,
                content_markdown: merged.content_markdown,
                blocks_json: mergedBlocksJson,
                color_token: merged.color_token,
                is_favorite: merged.is_favorite,
                is_pinned: merged.is_pinned,
                status: merged.status,
                reminder_at: merged.reminder_at,
                ai_context_excluded: merged.ai_context_excluded,
                tags: merged.tags,
                ...(resolvedFolderId === null ? { clearFolderId: true } : {}),
                ...(!merged.reminder_at ? { clearReminderAt: true } : {}),
              }),
            ]
          );
          mergedCount++;
        } else {
          skippedNoOpCount++;
        }
        continue;
      }

      // ---------------------------------------------------------------------
      // CASE 2: Note ID does NOT exist in cloud -> Add as Brand-New Note
      // ---------------------------------------------------------------------
      const normalizedPath = String(localNote.folder_path || 'General').trim().toLowerCase();
      const matchingCloudFolderId = cloudFolderIdByPath.get(normalizedPath) || null;
      if (matchingCloudFolderId && localNote.folder_id !== matchingCloudFolderId) {
        await dbClient.run(`UPDATE notes SET folder_id = ? WHERE id = ?;`, [
          matchingCloudFolderId,
          noteId,
        ]);
        const noteLogs = await dbClient.query<{ id: string; delta_payload: string }>(
          `SELECT id, delta_payload FROM sync_changelog WHERE entity_type = 'note' AND entity_id = ?;`,
          [noteId]
        );
        for (const nl of noteLogs) {
          try {
            const p =
              typeof nl.delta_payload === 'string'
                ? JSON.parse(nl.delta_payload)
                : nl.delta_payload || {};
            p.folder_id = matchingCloudFolderId;
            await dbClient.run(`UPDATE sync_changelog SET delta_payload = ? WHERE id = ?;`, [
              JSON.stringify(p),
              nl.id,
            ]);
          } catch {
            // Non-fatal
          }
        }
      }
      newCount++;
    }
  });

  return { mergedCount, newCount, skippedNoOpCount };
}
