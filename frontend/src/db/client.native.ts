/**
 * ScribeX Native SQLite Client (iOS & Android)
 * Uses native expo-sqlite with C++ JSI direct SQLite performance and WAL mode
 */

import { openDatabaseAsync, SQLiteDatabase, SQLiteRunResult } from 'expo-sqlite';
import { SCHEMA_TABLES_SQL, SCHEMA_INDEXES_SQL } from './schema';
import { WELCOME_STARTER_BLOCKS } from '../state/starterNote';

const DB_NAME = 'scribex_vault.db';

export class NativeDatabaseClient {
  private dbPromise: Promise<SQLiteDatabase> | null = null;

  public async getDatabase(): Promise<SQLiteDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = this.initDatabase();
    }
    return this.dbPromise;
  }

  private async initDatabase(): Promise<SQLiteDatabase> {
    try {
      const db = await openDatabaseAsync(DB_NAME);

      await db.execAsync('PRAGMA foreign_keys = ON;');
      try {
        await db.execAsync('PRAGMA journal_mode = WAL;');
      } catch (err) {
        console.warn('SQLite WAL mode not supported:', err);
      }

      // Phase 1: Initialize all base tables
      await db.execAsync(SCHEMA_TABLES_SQL);

      // Phase 2: Run all column migrations before creating any indexes on migrated columns
      const columnMigrations = [
        'ALTER TABLE tasks ADD COLUMN reminder_at TEXT;',
        'ALTER TABLE notes ADD COLUMN reminder_at TEXT;',
        'ALTER TABLE notes ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT 0;',
        'ALTER TABLE notes ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT 0;',
        'ALTER TABLE notes ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0;',
        "ALTER TABLE notes ADD COLUMN lock_type TEXT CHECK(lock_type IN ('master', 'custom')) DEFAULT NULL;",
        "ALTER TABLE notes ADD COLUMN lock_credential_kind TEXT CHECK(lock_credential_kind IN ('pin', 'password')) DEFAULT NULL;",
        'ALTER TABLE notes ADD COLUMN lock_hash TEXT DEFAULT NULL;',
        'ALTER TABLE notes ADD COLUMN lock_salt TEXT DEFAULT NULL;',
        'ALTER TABLE notes ADD COLUMN lock_hint TEXT DEFAULT NULL;',
        'ALTER TABLE notes ADD COLUMN ai_context_excluded INTEGER NOT NULL DEFAULT 0;',
        'ALTER TABLE folders ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT 0;',
        'ALTER TABLE folders ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT 0;',
        'ALTER TABLE folders ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT 0;',
        'ALTER TABLE folders ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0;',
        "ALTER TABLE folders ADD COLUMN lock_type TEXT CHECK(lock_type IN ('master', 'custom')) DEFAULT NULL;",
        "ALTER TABLE folders ADD COLUMN lock_credential_kind TEXT CHECK(lock_credential_kind IN ('pin', 'password')) DEFAULT NULL;",
        'ALTER TABLE folders ADD COLUMN lock_hash TEXT DEFAULT NULL;',
        'ALTER TABLE folders ADD COLUMN lock_salt TEXT DEFAULT NULL;',
        'ALTER TABLE folders ADD COLUMN lock_hint TEXT DEFAULT NULL;',
        'ALTER TABLE folders ADD COLUMN ai_context_excluded INTEGER NOT NULL DEFAULT 0;',
      ];

      for (const stmt of columnMigrations) {
        try {
          await db.execAsync(stmt);
        } catch {
          // Column already exists in table
        }
      }

      // Phase 3: Create all performance and security query indexes safely
      const indexStatements = SCHEMA_INDEXES_SQL.split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      for (const idxStmt of indexStatements) {
        try {
          await db.execAsync(`${idxStmt};`);
        } catch {
          // Index already exists or skipped
        }
      }

      // Phase 4: Safely detach tasks ON DELETE CASCADE FK if created by older schema so lean note eviction preserves Tasks tab rows
      try {
        const fkRows = await db.getAllAsync<{ table: string }>('PRAGMA foreign_key_list(tasks);');
        if (Array.isArray(fkRows) && fkRows.length > 0) {
          await db.execAsync('PRAGMA foreign_keys = OFF;');
          await db.execAsync(`
            CREATE TABLE IF NOT EXISTS tasks_mig_tmp (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              note_id TEXT,
              note_title TEXT,
              note_color_token TEXT,
              block_id TEXT,
              title TEXT NOT NULL,
              is_completed BOOLEAN NOT NULL DEFAULT 0,
              priority TEXT CHECK(priority IN ('none', 'low', 'medium', 'high', 'urgent')) NOT NULL DEFAULT 'none',
              due_date TEXT,
              reminder_at TEXT,
              sync_rev INTEGER NOT NULL DEFAULT 0,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO tasks_mig_tmp (id, user_id, note_id, note_title, note_color_token, block_id, title, is_completed, priority, due_date, reminder_at, sync_rev, created_at, updated_at)
              SELECT id, user_id, note_id, note_title, note_color_token, block_id, title, is_completed, priority, due_date, reminder_at, sync_rev, created_at, updated_at FROM tasks;
            DROP TABLE tasks;
            ALTER TABLE tasks_mig_tmp RENAME TO tasks;
            CREATE INDEX IF NOT EXISTS idx_tasks_note ON tasks(note_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(is_completed);
          `);
          await db.execAsync('PRAGMA foreign_keys = ON;');
        }
      } catch (fkErr) {
        console.warn('Tasks FK migration check skipped:', fkErr);
      }

      await this.ensureWebDataSync(db);

      return db;
    } catch (err) {
      console.error('Failed to initialize native SQLite database:', err);
      throw err;
    }
  }

  private async ensureWebDataSync(db: SQLiteDatabase): Promise<void> {
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    const currentVersion = v ? v.user_version : 0;

    // Version 2 wipes out old mobile testing notes and matches the web platform data exactly
    if (currentVersion < 2) {
      await this.resetToWebDefaults(db);
      await db.execAsync('PRAGMA user_version = 2;');
    }
  }

  public async resetToWebDefaults(db?: SQLiteDatabase): Promise<void> {
    const targetDb = db || (await this.getDatabase());

    const tablesToClear = [
      'sync_changelog',
      'note_tags',
      'entity_relations',
      'tasks',
      'notes',
      'folders',
    ];

    for (const table of tablesToClear) {
      try {
        await targetDb.execAsync(`DELETE FROM ${table};`);
      } catch {
        // Safe fallback if table doesn't exist yet
      }
    }

    await targetDb.runAsync(`
      INSERT OR IGNORE INTO folders (id, user_id, name, path, color_token) 
      VALUES 
        ('folder-work', 'user-default', 'ScribeX', 'Work/Projects/ScribeX', 'lime'),
        ('folder-general', 'user-default', 'General', 'General', 'cyan'),
        ('folder-research', 'user-default', 'Research', 'Research', 'lavender');
    `);

    const starterBlocksJson = JSON.stringify(WELCOME_STARTER_BLOCKS).replace(/'/g, "''");

    await targetDb.runAsync(`
      INSERT OR IGNORE INTO notes (
        id, user_id, folder_path, title, content_markdown, blocks_json, color_token, is_favorite, is_pinned, created_at, updated_at
      ) VALUES 
      (
        'note-welcome-starter', 'user-default', 'General',
        'Welcome to ScribeX 👋',
        'Welcome to ScribeX: The Local-First Spatial Notebook.\n\nScribeX unites 42 composable input blocks, local SQLite WAL storage, interactive checklists, KaTeX mathematics, and zero-knowledge security vaults.',
        '${starterBlocksJson}',
        'lavender', 1, 1, 'Today', 'Just now'
      ),
      (
        'note-1', 'user-default', 'Work/Projects/ScribeX', 
        'Sprint Checklist & Action Items', 
        'Task engine single source of truth: checklist blocks inside notes reflect instantly on the global task board without data duplication.',
        '[{"id":"b1-1","type":"paragraph","content":"Single source of truth between note checklists and tasks ledger."},{"id":"b1-2","type":"checklist","content":"Configure SQLite WAL mode for sub-5ms latency"},{"id":"b1-3","type":"checklist","content":"Implement two-part Notes & Tasks floating dock"}]',
        'lime', 1, 1, 'Today', 'Just now'
      ),
      (
        'note-2', 'user-default', 'Work/Projects/ScribeX', 
        'Universal Engine Architecture', 
        'Unifying 42 input methods into composable content blocks. Local-first SQLite WAL ensures sub-5ms latency across all platforms.',
        '[{"id":"b2-1","type":"paragraph","content":"Unifying 42 input methods into composable content blocks."}]',
        'apricot', 0, 0, 'Today', '1h ago'
      ),
      (
        'note-3', 'user-default', 'General', 
        'Offline Delta Sync & Git Vault', 
        'Bidirectional sync: local SQLite commits append to sync_changelog. Server pushes Git commits to markdown vault.',
        '[{"id":"b3-1","type":"paragraph","content":"Bidirectional sync engine."}]',
        'cyan', 1, 0, 'Yesterday', 'Yesterday'
      ),
      (
        'note-4', 'user-default', 'Research', 
        'Bidirectional Relations & Backlinks', 
        'Knowledge graph links (relates_to, supersedes, derived_from) allow traversal across folder boundaries freely.',
        '[{"id":"b4-1","type":"paragraph","content":"Knowledge graph lateral connections."}]',
        'lavender', 0, 0, 'Oct 25', 'Oct 25'
      );
    `);

    await targetDb.runAsync(`
      INSERT OR IGNORE INTO tasks (
        id, user_id, note_id, note_title, note_color_token, block_id, title, is_completed, priority, due_date
      ) VALUES 
      (
        'starter-task-1', 'user-default', 'note-welcome-starter', 'Welcome to ScribeX 👋', 'lavender', 'wb-checklist-1',
        'Tap any checkbox to test instant task state updates', 1, 'high', 'Today'
      ),
      (
        'starter-task-2', 'user-default', 'note-welcome-starter', 'Welcome to ScribeX 👋', 'lavender', 'wb-checklist-1',
        'Priority tasks synchronize automatically to your global Tasks dock', 0, 'urgent', 'Today'
      ),
      (
        'starter-task-3', 'user-default', 'note-welcome-starter', 'Welcome to ScribeX 👋', 'lavender', 'wb-checklist-1',
        'Set due dates and offline alarms directly on checklist items', 0, 'medium', 'Tomorrow'
      ),
      (
        'task-1', 'user-default', 'note-1', 'Sprint Checklist', 'lime', 'b1-2',
        'Configure SQLite WAL mode for sub-5ms latency', 1, 'high', 'Today'
      ),
      (
        'task-2', 'user-default', 'note-1', 'Sprint Checklist', 'lime', 'b1-3',
        'Implement two-part Notes & Tasks floating dock', 0, 'urgent', 'Today'
      ),
      (
        'task-3', 'user-default', 'note-2', 'Universal Engine', 'apricot', NULL,
        'Review 42 composable input block AST definitions', 0, 'medium', 'Tomorrow'
      ),
      (
        'task-4', 'user-default', NULL, NULL, NULL, NULL,
        'Test local offline storage across desktop and mobile browsers', 0, 'low', 'Oct 30'
      );
    `);
  }

  public async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    const db = await this.getDatabase();
    return db.getAllAsync<T>(sql, ...params);
  }

  public async queryFirst<T>(sql: string, params: any[] = []): Promise<T | null> {
    const db = await this.getDatabase();
    return db.getFirstAsync<T>(sql, ...params);
  }

  public async run(sql: string, params: any[] = []): Promise<SQLiteRunResult> {
    const db = await this.getDatabase();
    return db.runAsync(sql, ...params);
  }

  public async exec(sql: string): Promise<void> {
    const db = await this.getDatabase();
    return db.execAsync(sql);
  }

  public async withTransaction<T>(
    callback: (db: SQLiteDatabase) => Promise<T>
  ): Promise<T> {
    const db = await this.getDatabase();
    let result: T;
    await db.withTransactionAsync(async () => {
      result = await callback(db);
    });
    return result!;
  }
}

export const dbClient = new NativeDatabaseClient();
