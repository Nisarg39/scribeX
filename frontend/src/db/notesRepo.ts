/**
 * Client Notes Repository.
 *
 * Implements optimistic offline-first local CRUD operations, pending mutation staging,
 * and atomic server delta application across iOS, Android, and Web.
 */

import { getDatabase } from './sqliteClient';
import { ClientNote, PendingMutation, SyncDelta } from './types';
import { PastelColorKey } from '../theme/tokens';

const PASTEL_COLORS: PastelColorKey[] = [
  'apricot',
  'coral',
  'lime',
  'lavender',
  'cyan',
  'pink',
];

export async function getLocalNotes(groupFilter?: string): Promise<ClientNote[]> {
  const db = await getDatabase();
  let sql = 'SELECT * FROM notes';
  const params: any[] = [];

  if (groupFilter) {
    sql += ' WHERE group_name = ?';
    params.push(groupFilter);
  }
  sql += ' ORDER BY updated_at DESC;';

  const rows = await db.getAllAsync<any>(sql, params);
  return rows.map((r) => ({
    id: r.id,
    group_name: r.group_name,
    title: r.title,
    content_markdown: r.content_markdown,
    priority_score: Number(r.priority_score ?? 0.5),
    color_token: (r.color_token as PastelColorKey) || 'apricot',
    is_favorite: Boolean(r.is_favorite === 1 || r.is_favorite === true),
    sync_rev: Number(r.sync_rev ?? 0),
    pending_sync: Boolean(r.pending_sync === 1 || r.pending_sync === true),
    created_at: r.created_at || new Date().toISOString(),
    updated_at: r.updated_at || new Date().toISOString(),
  }));
}

export async function getLocalNoteById(id: string): Promise<ClientNote | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM notes WHERE id = ?;', [id]);
  if (!row) return null;

  return {
    id: row.id,
    group_name: row.group_name,
    title: row.title,
    content_markdown: row.content_markdown,
    priority_score: Number(row.priority_score ?? 0.5),
    color_token: (row.color_token as PastelColorKey) || 'apricot',
    is_favorite: Boolean(row.is_favorite === 1 || row.is_favorite === true),
    sync_rev: Number(row.sync_rev ?? 0),
    pending_sync: Boolean(row.pending_sync === 1 || row.pending_sync === true),
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

export async function saveLocalNote(
  noteInput: Partial<ClientNote> & { title: string }
): Promise<ClientNote> {
  const db = await getDatabase();
  const existing = noteInput.id ? await getLocalNoteById(noteInput.id) : null;
  const isUpdate = Boolean(existing);

  const noteId =
    noteInput.id ||
    `note_cli_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const groupName = noteInput.group_name || existing?.group_name || 'General Reference';
  const title = noteInput.title.trim();
  const contentMarkdown =
    noteInput.content_markdown ?? existing?.content_markdown ?? '';
  const priorityScore =
    noteInput.priority_score ?? existing?.priority_score ?? 0.5;
  const colorToken =
    noteInput.color_token ||
    existing?.color_token ||
    PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
  const isFavorite =
    noteInput.is_favorite !== undefined
      ? noteInput.is_favorite
      : existing?.is_favorite ?? false;
  const syncRev = existing?.sync_rev ?? 0;
  const pendingSync = 1; // Mark as queued for server sync
  const now = new Date().toISOString();

  if (isUpdate) {
    await db.runAsync(
      `UPDATE notes
       SET group_name = ?, title = ?, content_markdown = ?, priority_score = ?,
           color_token = ?, is_favorite = ?, sync_rev = ?, pending_sync = ?, updated_at = ?
       WHERE id = ?;`,
      [
        groupName,
        title,
        contentMarkdown,
        priorityScore,
        colorToken,
        isFavorite ? 1 : 0,
        syncRev,
        pendingSync,
        now,
        noteId,
      ]
    );
  } else {
    await db.runAsync(
      `INSERT INTO notes (
         id, group_name, title, content_markdown, priority_score,
         color_token, is_favorite, sync_rev, pending_sync, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        noteId,
        groupName,
        title,
        contentMarkdown,
        priorityScore,
        colorToken,
        isFavorite ? 1 : 0,
        syncRev,
        pendingSync,
        now,
        now,
      ]
    );
  }

  // Queue pending mutation for background delta sync engine
  const mutationId = `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const mutationPayload = {
    id: noteId,
    title,
    content_markdown: contentMarkdown,
    group_name: groupName,
    priority_score: priorityScore,
    color_token: colorToken,
    is_favorite: isFavorite,
  };

  await db.runAsync(
    `INSERT INTO pending_mutations (id, entity_type, entity_id, mutation_type, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [
      mutationId,
      'note',
      noteId,
      isUpdate ? 'UPDATE' : 'INSERT',
      JSON.stringify(mutationPayload),
      now,
    ]
  );

  return {
    id: noteId,
    group_name: groupName,
    title,
    content_markdown: contentMarkdown,
    priority_score: priorityScore,
    color_token: colorToken,
    is_favorite: isFavorite,
    sync_rev: syncRev,
    pending_sync: true,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
}

export async function deleteLocalNote(id: string): Promise<boolean> {
  const db = await getDatabase();
  const existing = await getLocalNoteById(id);
  if (!existing) return false;

  await db.runAsync('DELETE FROM notes WHERE id = ?;', [id]);

  // Queue DELETE mutation
  const mutationId = `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await db.runAsync(
    `INSERT INTO pending_mutations (id, entity_type, entity_id, mutation_type, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [
      mutationId,
      'note',
      id,
      'DELETE',
      JSON.stringify({ id, title: existing.title, group_name: existing.group_name }),
      new Date().toISOString(),
    ]
  );

  return true;
}

export async function toggleLocalFavorite(id: string): Promise<boolean> {
  const note = await getLocalNoteById(id);
  if (!note) return false;

  const nextFav = !note.is_favorite;
  await saveLocalNote({
    ...note,
    is_favorite: nextFav,
  });
  return nextFav;
}

export async function applyServerDeltas(
  deltas: SyncDelta[],
  latestSyncRev: number
): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    for (const delta of deltas) {
      if (delta.entity_type !== 'note') continue;
      const entityId = delta.entity_id;
      const changeType = delta.change_type;
      const payload = delta.delta_payload || {};

      if (changeType === 'DELETE') {
        await db.runAsync('DELETE FROM notes WHERE id = ?;', [entityId]);
      } else if (changeType === 'INSERT' || changeType === 'UPDATE') {
        const title = payload.title || 'Untitled Note';
        const contentMarkdown = payload.content_markdown || '';
        const groupName = payload.group_name || 'General Reference';
        const priorityScore = Number(payload.priority_score ?? 0.5);
        const syncRev = Number(payload.sync_rev ?? delta.sync_rev);
        const colorToken =
          payload.color_token ||
          PASTEL_COLORS[Math.abs(entityId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % PASTEL_COLORS.length];
        const isFavorite = payload.is_favorite ? 1 : 0;
        const now = new Date().toISOString();

        await db.runAsync(
          `INSERT OR REPLACE INTO notes (
             id, group_name, title, content_markdown, priority_score,
             color_token, is_favorite, sync_rev, pending_sync, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?);`,
          [
            entityId,
            groupName,
            title,
            contentMarkdown,
            priorityScore,
            colorToken,
            isFavorite,
            syncRev,
            now,
            now,
          ]
        );
      }
    }

    // Advance local revision
    await setSyncRev(latestSyncRev);
  });
}

export async function getPendingMutations(): Promise<PendingMutation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM pending_mutations ORDER BY created_at ASC;'
  );

  return rows.map((r) => ({
    id: r.id,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    mutation_type: r.mutation_type,
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
    created_at: r.created_at,
  }));
}

export async function clearPendingMutations(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `DELETE FROM pending_mutations WHERE id IN (${placeholders});`,
    ids
  );
}

export async function getCurrentSyncRev(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT value FROM local_sync_meta WHERE key = ?;',
    ['current_sync_rev']
  );
  return row ? Number(row.value) : 0;
}

export async function setSyncRev(rev: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO local_sync_meta (key, value) VALUES (?, ?);',
    ['current_sync_rev', String(rev)]
  );
}

export async function seedInitialNotesIfEmpty(
  initialSamples: Array<{
    title: string;
    content: string;
    group: string;
    color: PastelColorKey;
    isFavorite?: boolean;
  }>
): Promise<void> {
  const existingNotes = await getLocalNotes();
  if (existingNotes.length > 0) {
    return;
  }

  for (const sample of initialSamples) {
    await saveLocalNote({
      title: sample.title,
      content_markdown: sample.content,
      group_name: sample.group,
      color_token: sample.color,
      is_favorite: sample.isFavorite ?? false,
    });
  }
}
