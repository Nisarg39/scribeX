/**
 * ScribeX Web Database Client (Browser / PWA)
 * Backed by genuine SQLite compiled to WebAssembly (sql.js / Wasm).
 * Persists SQLite binary directly to browser IndexedDB (with LocalStorage fallback).
 * 100% unified SQL behavior with native mobile expo-sqlite.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore
import initSqlJs from 'sql.js/dist/sql-wasm-inline.js';
import type { Database, SqlJsStatic } from 'sql.js';
import { SCHEMA_SQL } from './schema';

const IDB_NAME = 'scribex_web_vault';
const IDB_VERSION = 1;
const IDB_STORE = 'sqlite_databases';
const DB_KEY = 'scribex_vault.db';
const ASYNC_STORAGE_KEY = '@scribex_vault_sqlite_binary';
const LEGACY_STORAGE_PREFIX = '@scribex_web_db_';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof btoa !== 'undefined') {
    const CHUNK_SIZE = 0x8000; // 32KB chunks
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(i, i + CHUNK_SIZE) as unknown as number[]
      );
    }
    return btoa(binary);
  }
  const buf = (globalThis as any).Buffer;
  return buf ? buf.from(bytes).toString('base64') : '';
}

function base64ToUint8Array(base64: string): Uint8Array {
  let binaryString = '';
  if (typeof atob !== 'undefined') {
    binaryString = atob(base64);
  } else {
    const buf = (globalThis as any).Buffer;
    binaryString = buf ? buf.from(base64, 'base64').toString('binary') : '';
  }
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

let cachedIdb: IDBDatabase | null = null;

function openIndexedDB(): Promise<IDBDatabase | null> {
  if (cachedIdb) return Promise.resolve(cachedIdb);
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return resolve(null);
    }
    const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => {
      cachedIdb = req.result;
      cachedIdb.onclose = () => { cachedIdb = null; };
      resolve(cachedIdb);
    };
    req.onerror = () => resolve(null);
  });
}

async function loadFromStorage(): Promise<Uint8Array | null> {
  try {
    const db = await openIndexedDB();
    if (db) {
      const fromIdb = await new Promise<Uint8Array | null>((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(DB_KEY);
        req.onsuccess = () => {
          if (req.result instanceof Uint8Array) {
            resolve(req.result);
          } else if (req.result instanceof ArrayBuffer) {
            resolve(new Uint8Array(req.result));
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
      if (fromIdb && fromIdb.length > 0) return fromIdb;
    }

    // Secondary fallback: AsyncStorage
    const base64 = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
    if (base64) {
      return base64ToUint8Array(base64);
    }
    return null;
  } catch {
    return null;
  }
}

async function saveToStorage(binary: Uint8Array): Promise<void> {
  try {
    const db = await openIndexedDB();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const req = store.put(binary, DB_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }

    // Dual-write to AsyncStorage fallback
    const base64 = uint8ArrayToBase64(binary);
    await AsyncStorage.setItem(ASYNC_STORAGE_KEY, base64);
  } catch (err) {
    // Non-fatal fallback
    try {
      const base64 = uint8ArrayToBase64(binary);
      await AsyncStorage.setItem(ASYNC_STORAGE_KEY, base64);
    } catch {
      // Storage quota or headless environment
    }
  }
}

export class WebDatabaseClient {
  private dbInstance: Database | null = null;
  private initPromise: Promise<Database> | null = null;
  private persistTimeout: any = null;

  public async getDatabase(): Promise<Database> {
    if (this.dbInstance) return this.dbInstance;
    if (!this.initPromise) {
      this.initPromise = this.initDatabase();
    }
    return this.initPromise;
  }

  private async initDatabase(): Promise<Database> {
    try {
      const SQL: SqlJsStatic = await initSqlJs();
      const existingBinary = await loadFromStorage();

      let db: Database;
      if (existingBinary && existingBinary.length > 0) {
        db = new SQL.Database(existingBinary);
      } else {
        db = new SQL.Database();
        // Initialize standard schema
        db.exec(SCHEMA_SQL);
        // Check for legacy localStorage data to migrate
        await this.migrateLegacyDataOrSeed(db);
        const initialBinary = db.export();
        await saveToStorage(initialBinary);
      }

      this.dbInstance = db;
      return db;
    } catch (err) {
      console.error('Failed to initialize Web SQLite Wasm database:', err);
      // Fallback in-memory instance
      const SQL: SqlJsStatic = await initSqlJs();
      const db = new SQL.Database();
      db.exec(SCHEMA_SQL);
      this.seedInitialDefaults(db);
      this.dbInstance = db;
      return db;
    }
  }

  private async migrateLegacyDataOrSeed(db: Database): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const rawNotes = window.localStorage.getItem(`${LEGACY_STORAGE_PREFIX}notes`);
        const rawTasks = window.localStorage.getItem(`${LEGACY_STORAGE_PREFIX}tasks`);
        const rawFolders = window.localStorage.getItem(`${LEGACY_STORAGE_PREFIX}folders`);

        if (rawNotes) {
          const notes = JSON.parse(rawNotes);
          if (Array.isArray(notes) && notes.length > 0) {
            // Migrate folders
            if (rawFolders) {
              const folders = JSON.parse(rawFolders);
              for (const f of folders) {
                db.run(
                  `INSERT OR IGNORE INTO folders (id, user_id, name, path, color_token, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?);`,
                  [f.id, f.user_id || 'user-default', f.name, f.path, f.color_token || 'cyan', f.created_at || 'Just now', f.updated_at || 'Just now']
                );
              }
            }

            // Migrate notes
            for (const n of notes) {
              db.run(
                `INSERT OR REPLACE INTO notes (
                  id, user_id, folder_id, folder_path, group_name, title, content_markdown, blocks_json, color_token, is_favorite, is_pinned, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                [
                  n.id,
                  n.user_id || 'user-default',
                  n.folder_id || null,
                  n.folder_path || 'General',
                  n.group_name || null,
                  n.title || 'Untitled Note',
                  n.content_markdown || '',
                  typeof n.blocks_json === 'string' ? n.blocks_json : JSON.stringify(n.blocks_json || []),
                  n.color_token || 'apricot',
                  n.is_favorite ? 1 : 0,
                  n.is_pinned ? 1 : 0,
                  n.status || 'active',
                  n.created_at || 'Just now',
                  n.updated_at || 'Just now',
                ]
              );
            }

            // Migrate tasks
            if (rawTasks) {
              const tasks = JSON.parse(rawTasks);
              for (const t of tasks) {
                db.run(
                  `INSERT OR REPLACE INTO tasks (
                    id, user_id, note_id, note_title, note_color_token, block_id, title, is_completed, priority, due_date, created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                  [
                    t.id,
                    t.user_id || 'user-default',
                    t.note_id || null,
                    t.note_title || null,
                    t.note_color_token || null,
                    t.block_id || null,
                    t.title || '',
                    t.is_completed ? 1 : 0,
                    t.priority || 'none',
                    t.due_date || 'Today',
                    t.created_at || 'Just now',
                    t.updated_at || 'Just now',
                  ]
                );
              }
            }

            return;
          }
        }
      }
    } catch (e) {
      console.warn('Could not migrate legacy storage data:', e);
    }

    // Default seeds if no legacy data exists
    this.seedInitialDefaults(db);
  }

  private seedInitialDefaults(db: Database): void {
    db.run(`
      INSERT OR IGNORE INTO folders (id, user_id, name, path, color_token) 
      VALUES 
        ('folder-work', 'user-default', 'ScribeX', 'Work/Projects/ScribeX', 'lime'),
        ('folder-general', 'user-default', 'General', 'General', 'cyan'),
        ('folder-research', 'user-default', 'Research', 'Research', 'lavender');
    `);

    db.run(`
      INSERT INTO notes (
        id, user_id, folder_path, title, content_markdown, blocks_json, color_token, is_favorite, is_pinned, created_at, updated_at
      ) VALUES 
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

    db.run(`
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

  private async persist(): Promise<void> {
    if (!this.dbInstance) return;
    try {
      const binary = this.dbInstance.export();
      await saveToStorage(binary);
    } catch (err) {
      console.warn('Failed to persist Web SQLite Wasm database:', err);
    }
  }

  public schedulePersist(): void {
    if (this.persistTimeout) return;
    this.persistTimeout = setTimeout(async () => {
      this.persistTimeout = null;
      await this.persist();
    }, 120);
  }

  public async flushPersist(): Promise<void> {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
      this.persistTimeout = null;
    }
    await this.persist();
  }

  public async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    const db = await this.getDatabase();
    const cleanSql = sql.trim();
    const stmt = db.prepare(cleanSql);

    if (params && params.length > 0) {
      const normalized = params.map((p) =>
        typeof p === 'boolean' ? (p ? 1 : 0) : p === undefined ? null : p
      );
      stmt.bind(normalized);
    }

    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
  }

  public async queryFirst<T>(sql: string, params: any[] = []): Promise<T | null> {
    const list = await this.query<T>(sql, params);
    return list.length > 0 ? list[0] : null;
  }

  public async run(
    sql: string,
    params: any[] = []
  ): Promise<{ lastInsertRowId: number; changes: number }> {
    const db = await this.getDatabase();
    const normalized = params.map((p) =>
      typeof p === 'boolean' ? (p ? 1 : 0) : p === undefined ? null : p
    );

    db.run(sql, normalized);

    const meta = db.exec('SELECT last_insert_rowid() AS lastInsertRowId, changes() AS changes;');
    let lastInsertRowId = 0;
    let changes = 0;

    if (meta.length > 0 && meta[0].values.length > 0) {
      lastInsertRowId = Number(meta[0].values[0][0]) || 0;
      changes = Number(meta[0].values[0][1]) || 0;
    }

    this.schedulePersist();
    return { lastInsertRowId, changes };
  }

  public async exec(sql: string): Promise<void> {
    const db = await this.getDatabase();
    db.exec(sql);
    this.schedulePersist();
  }

  public async withTransaction<T>(
    callback: (db: Database) => Promise<T>
  ): Promise<T> {
    const db = await this.getDatabase();
    db.exec('BEGIN TRANSACTION;');
    try {
      const result = await callback(db);
      db.exec('COMMIT;');
      this.schedulePersist();
      return result;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }
}

export const dbClient = new WebDatabaseClient();
