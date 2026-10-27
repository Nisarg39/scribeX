/**
 * ScribeX Local-First SQLite Client Singleton
 * Source of Truth: docs/Technical_System_Architecture.md & docs/Universal_Note_Input_Structure_and_Relations.md
 */

import { openDatabaseAsync, SQLiteDatabase, SQLiteRunResult } from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';

const DB_NAME = 'scribex_vault.db';

class DatabaseClient {
  private dbPromise: Promise<SQLiteDatabase> | null = null;
  private isInitialized = false;

  public async getDatabase(): Promise<SQLiteDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = this.initDatabase();
    }
    return this.dbPromise;
  }

  private async initDatabase(): Promise<SQLiteDatabase> {
    try {
      const db = await openDatabaseAsync(DB_NAME);

      // Enable foreign key constraints
      await db.execAsync('PRAGMA foreign_keys = ON;');

      // Enable WAL mode on supported platforms
      try {
        await db.execAsync('PRAGMA journal_mode = WAL;');
      } catch (err) {
        console.warn('SQLite WAL mode not supported in this runtime environment:', err);
      }

      // Execute DDL Schema
      await db.execAsync(SCHEMA_SQL);

      // Seed initial folders & notes if empty
      await this.seedInitialDataIfEmpty(db);

      this.isInitialized = true;
      return db;
    } catch (err) {
      console.error('Failed to initialize local SQLite database:', err);
      throw err;
    }
  }

  private async seedInitialDataIfEmpty(db: SQLiteDatabase): Promise<void> {
    const existing = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM notes;'
    );

    if (existing && existing.count > 0) {
      return; // Already initialized with data
    }

    // Insert Default Folders
    await db.runAsync(`
      INSERT OR IGNORE INTO folders (id, user_id, name, path, color_token) 
      VALUES 
        ('folder-work', 'user-default', 'ScribeX', 'Work/Projects/ScribeX', 'lime'),
        ('folder-general', 'user-default', 'General', 'General', 'cyan'),
        ('folder-research', 'user-default', 'Research', 'Research', 'lavender');
    `);

    // Insert Initial Notes (conforming to Universal Note Input spec)
    await db.runAsync(`
      INSERT INTO notes (
        id, user_id, folder_path, title, content_markdown, blocks_json, color_token, is_favorite, is_pinned
      ) VALUES 
      (
        'note-1', 
        'user-default', 
        'Work/Projects/ScribeX', 
        'Sprint Checklist & Action Items', 
        'Task engine single source of truth: checklist blocks inside notes reflect instantly on the global task board without data duplication.',
        '[{"id":"b1-1","type":"paragraph","content":"Single source of truth between note checklists and tasks ledger."},{"id":"b1-2","type":"checklist","content":"Configure SQLite WAL mode for sub-5ms latency"},{"id":"b1-3","type":"checklist","content":"Implement two-part Notes & Tasks floating dock"}]',
        'lime',
        1,
        1
      ),
      (
        'note-2', 
        'user-default', 
        'Work/Projects/ScribeX', 
        'Universal Engine Architecture', 
        'Unifying 42 input methods into composable content blocks. Local-first SQLite WAL ensures sub-5ms latency across all platforms.',
        '[{"id":"b2-1","type":"paragraph","content":"Unifying 42 input methods into composable content blocks."}]',
        'apricot',
        0,
        0
      ),
      (
        'note-3', 
        'user-default', 
        'General', 
        'Offline Delta Sync & Git Vault', 
        'Bidirectional sync: local SQLite commits append to sync_changelog. Server pushes Git commits to markdown vault.',
        '[{"id":"b3-1","type":"paragraph","content":"Bidirectional sync engine."}]',
        'cyan',
        1,
        0
      ),
      (
        'note-4', 
        'user-default', 
        'Research', 
        'Bidirectional Relations & Backlinks', 
        'Knowledge graph links (relates_to, supersedes, derived_from) allow traversal across folder boundaries freely.',
        '[{"id":"b4-1","type":"paragraph","content":"Knowledge graph lateral connections."}]',
        'lavender',
        0,
        0
      );
    `);

    // Insert Initial Tasks (linked to note-1)
    await db.runAsync(`
      INSERT INTO tasks (
        id, user_id, note_id, note_title, note_color_token, title, is_completed, priority, due_date
      ) VALUES 
      (
        'task-1', 'user-default', 'note-1', 'Sprint Checklist', 'lime', 
        'Configure SQLite WAL mode for sub-5ms latency', 1, 'high', 'Today'
      ),
      (
        'task-2', 'user-default', 'note-1', 'Sprint Checklist', 'lime', 
        'Implement two-part Notes & Tasks floating dock', 0, 'urgent', 'Today'
      ),
      (
        'task-3', 'user-default', 'note-2', 'Universal Engine', 'apricot', 
        'Review 42 composable input block AST definitions', 0, 'medium', 'Tomorrow'
      ),
      (
        'task-4', 'user-default', NULL, NULL, NULL, 
        'Test local offline storage across desktop and mobile browsers', 0, 'low', 'Oct 30'
      );
    `);
  }

  // Safe Query Helpers
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

export const dbClient = new DatabaseClient();
