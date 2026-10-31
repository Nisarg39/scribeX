/**
 * ScribeX Search & Workspace Filter History Repository
 * Phase 5 of docs/Search_Implementation_Plan.md
 *
 * Persists user search queries locally in SQLite (`expo-sqlite` on iOS/Android,
 * `sql.js` + IndexedDB on Web) and records delta entries in `sync_changelog`
 * (`entity_type = 'search_history'`) so search history can be replicated
 * across devices when the Cloud Sync backend is connected.
 */

import { dbClient } from './client';
import { DBSearchHistory, SearchHistoryItem, SearchHistorySource } from './types';

const createLogId = () => `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export class SearchHistoryRepository {
  private tableInitialized = false;

  private async ensureTable(): Promise<void> {
    if (this.tableInitialized) return;
    try {
      await dbClient.exec(`
        CREATE TABLE IF NOT EXISTS search_history (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          query_text TEXT NOT NULL,
          source TEXT CHECK(source IN ('text', 'voice', 'ai')) NOT NULL DEFAULT 'text',
          filter_snapshot_json TEXT DEFAULT '{}',
          use_count INTEGER NOT NULL DEFAULT 1,
          sync_rev INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (user_id, query_text)
        );
        CREATE INDEX IF NOT EXISTS idx_search_history_recent ON search_history(user_id, last_used_at DESC);
      `);
      this.tableInitialized = true;
    } catch (err) {
      console.warn('Failed to ensure search_history table:', err);
    }
  }

  private mapRowToItem(row: DBSearchHistory): SearchHistoryItem {
    let parsedSnapshot: Record<string, any> = {};
    try {
      parsedSnapshot = row.filter_snapshot_json ? JSON.parse(row.filter_snapshot_json) : {};
    } catch {
      parsedSnapshot = {};
    }
    return {
      id: row.id,
      userId: row.user_id,
      queryText: row.query_text,
      source: row.source || 'text',
      filterSnapshot: parsedSnapshot,
      useCount: row.use_count || 1,
      syncRev: row.sync_rev || 0,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    };
  }

  /**
   * Loads the most recent search history items ordered by `last_used_at DESC`.
   */
  public async loadRecentSearches(
    limit: number = 8,
    userId: string = 'user-default'
  ): Promise<SearchHistoryItem[]> {
    await this.ensureTable();
    const rows = await dbClient.query<DBSearchHistory>(
      `SELECT * FROM search_history
       WHERE user_id = ?
       ORDER BY last_used_at DESC
       LIMIT ?;`,
      [userId, limit]
    );
    return rows.map((r) => this.mapRowToItem(r));
  }

  /**
   * Deduplicates by case-insensitive `query_text`, increments `use_count`,
   * updates `last_used_at`, increments `sync_rev`, and appends a delta entry
   * to `sync_changelog` for future multi-device cloud sync.
   */
  public async upsertSearchQuery(
    rawQueryText: string,
    source: SearchHistorySource = 'text',
    filterSnapshot: Record<string, any> = {},
    userId: string = 'user-default'
  ): Promise<SearchHistoryItem | null> {
    const cleanQuery = rawQueryText.trim();
    if (cleanQuery.length < 2) return null;

    await this.ensureTable();

    const existing = await dbClient.queryFirst<DBSearchHistory>(
      `SELECT * FROM search_history
       WHERE user_id = ? AND LOWER(query_text) = LOWER(?);`,
      [userId, cleanQuery]
    );

    const snapshotJson = JSON.stringify(filterSnapshot || {});
    const nowIso = new Date().toISOString();

    if (existing) {
      const nextCount = (existing.use_count || 1) + 1;
      const nextRev = (existing.sync_rev || 0) + 1;

      await dbClient.run(
        `UPDATE search_history
         SET query_text = ?,
             source = ?,
             filter_snapshot_json = ?,
             use_count = ?,
             sync_rev = ?,
             last_used_at = ?
         WHERE id = ?;`,
        [cleanQuery, source, snapshotJson, nextCount, nextRev, nowIso, existing.id]
      );

      await dbClient.run(
        `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, 'search_history', ?, 'update', ?);`,
        [
          createLogId(),
          userId,
          nextRev,
          existing.id,
          JSON.stringify({
            id: existing.id,
            queryText: cleanQuery,
            source,
            filterSnapshot,
            useCount: nextCount,
            lastUsedAt: nowIso,
          }),
        ]
      );

      const updated = await dbClient.queryFirst<DBSearchHistory>(
        `SELECT * FROM search_history WHERE id = ?;`,
        [existing.id]
      );
      return updated ? this.mapRowToItem(updated) : null;
    }

    const id = `sh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const syncRev = 1;

    await dbClient.run(
      `INSERT INTO search_history (
         id, user_id, query_text, source, filter_snapshot_json, use_count, sync_rev, created_at, last_used_at
       ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?);`,
      [id, userId, cleanQuery, source, snapshotJson, syncRev, nowIso, nowIso]
    );

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, ?, 'search_history', ?, 'insert', ?);`,
      [
        createLogId(),
        userId,
        syncRev,
        id,
        JSON.stringify({
          id,
          queryText: cleanQuery,
          source,
          filterSnapshot,
          useCount: 1,
          lastUsedAt: nowIso,
        }),
      ]
    );

    const created = await dbClient.queryFirst<DBSearchHistory>(
      `SELECT * FROM search_history WHERE id = ?;`,
      [id]
    );
    return created ? this.mapRowToItem(created) : null;
  }

  /**
   * Deletes a single search history entry by query text or ID and logs a delete delta.
   */
  public async deleteSearchHistoryItem(
    idOrQuery: string,
    userId: string = 'user-default'
  ): Promise<void> {
    await this.ensureTable();

    const target = await dbClient.queryFirst<DBSearchHistory>(
      `SELECT * FROM search_history
       WHERE user_id = ? AND (id = ? OR LOWER(query_text) = LOWER(?));`,
      [userId, idOrQuery, idOrQuery]
    );

    if (!target) return;

    await dbClient.run(`DELETE FROM search_history WHERE id = ?;`, [target.id]);

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, ?, 'search_history', ?, 'delete', ?);`,
      [
        createLogId(),
        userId,
        (target.sync_rev || 0) + 1,
        target.id,
        JSON.stringify({ id: target.id, queryText: target.query_text }),
      ]
    );
  }

  /**
   * Clears all search history for the user and logs a batch delete delta in `sync_changelog`.
   */
  public async clearAllSearchHistory(userId: string = 'user-default'): Promise<void> {
    await this.ensureTable();

    await dbClient.run(`DELETE FROM search_history WHERE user_id = ?;`, [userId]);

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'search_history', 'all', 'delete', ?);`,
      [createLogId(), userId, JSON.stringify({ clearedAt: new Date().toISOString() })]
    );
  }
}

export const searchHistoryRepo = new SearchHistoryRepository();

