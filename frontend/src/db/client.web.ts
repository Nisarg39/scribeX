/**
 * ScribeX Web Database Client (Browser / PWA)
 * Backed by persistent AsyncStorage with zero native module dependencies.
 * Provides identical query API to native SQLite client.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DBNote, DBTask, DBFolder, DBSyncChangelog } from './types';

const STORAGE_PREFIX = '@scribex_web_db_';

export class WebDatabaseClient {
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  private tables = {
    folders: [] as DBFolder[],
    notes: [] as DBNote[],
    tasks: [] as DBTask[],
    sync_changelog: [] as DBSyncChangelog[],
  };

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    if (!this.loadPromise) {
      this.loadPromise = this.initTables();
    }
    return this.loadPromise;
  }

  private async initTables(): Promise<void> {
    try {
      const [foldersRaw, notesRaw, tasksRaw, changelogRaw] = await Promise.all([
        AsyncStorage.getItem(`${STORAGE_PREFIX}folders`),
        AsyncStorage.getItem(`${STORAGE_PREFIX}notes`),
        AsyncStorage.getItem(`${STORAGE_PREFIX}tasks`),
        AsyncStorage.getItem(`${STORAGE_PREFIX}changelog`),
      ]);

      if (foldersRaw) this.tables.folders = JSON.parse(foldersRaw);
      if (notesRaw) this.tables.notes = JSON.parse(notesRaw);
      if (tasksRaw) this.tables.tasks = JSON.parse(tasksRaw);
      if (changelogRaw) this.tables.sync_changelog = JSON.parse(changelogRaw);

      // Seed if empty
      if (this.tables.notes.length === 0) {
        this.seedInitialData();
        await this.persistAll();
      }
    } catch (err) {
      console.warn('Failed to load web database storage, using in-memory state:', err);
      if (this.tables.notes.length === 0) {
        this.seedInitialData();
      }
    } finally {
      this.isLoaded = true;
    }
  }

  private seedInitialData() {
    this.tables.folders = [
      {
        id: 'folder-work',
        user_id: 'user-default',
        name: 'ScribeX',
        parent_id: null,
        path: 'Work/Projects/ScribeX',
        color_token: 'lime',
        icon: null,
        sync_rev: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'folder-general',
        user_id: 'user-default',
        name: 'General',
        parent_id: null,
        path: 'General',
        color_token: 'cyan',
        icon: null,
        sync_rev: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'folder-research',
        user_id: 'user-default',
        name: 'Research',
        parent_id: null,
        path: 'Research',
        color_token: 'lavender',
        icon: null,
        sync_rev: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    this.tables.notes = [
      {
        id: 'note-1',
        user_id: 'user-default',
        folder_id: 'folder-work',
        folder_path: 'Work/Projects/ScribeX',
        group_name: null,
        title: 'Sprint Checklist & Action Items',
        content_markdown: 'Task engine single source of truth: checklist blocks inside notes reflect instantly on the global task board without data duplication.',
        blocks_json: '[{"id":"b1-1","type":"paragraph","content":"Single source of truth between note checklists and tasks ledger."},{"id":"b1-2","type":"checklist","content":"Configure SQLite WAL mode for sub-5ms latency"},{"id":"b1-3","type":"checklist","content":"Implement two-part Notes & Tasks floating dock"}]',
        color_token: 'lime',
        is_favorite: 1,
        is_pinned: 1,
        status: 'active',
        priority_score: 1.0,
        sync_rev: 0,
        created_at: 'Today',
        updated_at: 'Just now',
        trashed_at: null,
      },
      {
        id: 'note-2',
        user_id: 'user-default',
        folder_id: 'folder-work',
        folder_path: 'Work/Projects/ScribeX',
        group_name: null,
        title: 'Universal Engine Architecture',
        content_markdown: 'Unifying 42 input methods into composable content blocks. Local-first SQLite WAL ensures sub-5ms latency across all platforms.',
        blocks_json: '[{"id":"b2-1","type":"paragraph","content":"Unifying 42 input methods into composable content blocks."}]',
        color_token: 'apricot',
        is_favorite: 0,
        is_pinned: 0,
        status: 'active',
        priority_score: 0.8,
        sync_rev: 0,
        created_at: 'Today',
        updated_at: '1h ago',
        trashed_at: null,
      },
      {
        id: 'note-3',
        user_id: 'user-default',
        folder_id: 'folder-general',
        folder_path: 'General',
        group_name: null,
        title: 'Offline Delta Sync & Git Vault',
        content_markdown: 'Bidirectional sync: local SQLite commits append to sync_changelog. Server pushes Git commits to markdown vault.',
        blocks_json: '[{"id":"b3-1","type":"paragraph","content":"Bidirectional sync engine."}]',
        color_token: 'cyan',
        is_favorite: 1,
        is_pinned: 0,
        status: 'active',
        priority_score: 0.7,
        sync_rev: 0,
        created_at: 'Yesterday',
        updated_at: 'Yesterday',
        trashed_at: null,
      },
      {
        id: 'note-4',
        user_id: 'user-default',
        folder_id: 'folder-research',
        folder_path: 'Research',
        group_name: null,
        title: 'Bidirectional Relations & Backlinks',
        content_markdown: 'Knowledge graph links (relates_to, supersedes, derived_from) allow traversal across folder boundaries freely.',
        blocks_json: '[{"id":"b4-1","type":"paragraph","content":"Knowledge graph lateral connections."}]',
        color_token: 'lavender',
        is_favorite: 0,
        is_pinned: 0,
        status: 'active',
        priority_score: 0.6,
        sync_rev: 0,
        created_at: 'Oct 25',
        updated_at: 'Oct 25',
        trashed_at: null,
      },
    ];

    this.tables.tasks = [
      {
        id: 'task-1',
        user_id: 'user-default',
        note_id: 'note-1',
        note_title: 'Sprint Checklist',
        note_color_token: 'lime',
        block_id: 'b1-2',
        title: 'Configure SQLite WAL mode for sub-5ms latency',
        is_completed: 1,
        priority: 'high',
        due_date: 'Today',
        sync_rev: 0,
        created_at: 'Today',
        updated_at: 'Just now',
      },
      {
        id: 'task-2',
        user_id: 'user-default',
        note_id: 'note-1',
        note_title: 'Sprint Checklist',
        note_color_token: 'lime',
        block_id: 'b1-3',
        title: 'Implement two-part Notes & Tasks floating dock',
        is_completed: 0,
        priority: 'urgent',
        due_date: 'Today',
        sync_rev: 0,
        created_at: 'Today',
        updated_at: 'Just now',
      },
      {
        id: 'task-3',
        user_id: 'user-default',
        note_id: 'note-2',
        note_title: 'Universal Engine',
        note_color_token: 'apricot',
        block_id: null,
        title: 'Review 42 composable input block AST definitions',
        is_completed: 0,
        priority: 'medium',
        due_date: 'Tomorrow',
        sync_rev: 0,
        created_at: 'Today',
        updated_at: 'Today',
      },
      {
        id: 'task-4',
        user_id: 'user-default',
        note_id: null,
        note_title: null,
        note_color_token: null,
        block_id: null,
        title: 'Test local offline storage across desktop and mobile browsers',
        is_completed: 0,
        priority: 'low',
        due_date: 'Oct 30',
        sync_rev: 0,
        created_at: 'Yesterday',
        updated_at: 'Yesterday',
      },
    ];
  }

  private async persistAll(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(`${STORAGE_PREFIX}folders`, JSON.stringify(this.tables.folders)),
        AsyncStorage.setItem(`${STORAGE_PREFIX}notes`, JSON.stringify(this.tables.notes)),
        AsyncStorage.setItem(`${STORAGE_PREFIX}tasks`, JSON.stringify(this.tables.tasks)),
        AsyncStorage.setItem(`${STORAGE_PREFIX}changelog`, JSON.stringify(this.tables.sync_changelog)),
      ]);
    } catch (err) {
      console.warn('Failed to persist web database:', err);
    }
  }

  public async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    await this.ensureLoaded();
    const cleanSql = sql.trim();

    // 1. SELECT * FROM notes
    if (cleanSql.includes('FROM notes')) {
      let result = [...this.tables.notes].filter((n) => n.status !== 'trashed');
      return result as unknown as T[];
    }

    // 2. SELECT * FROM tasks
    if (cleanSql.includes('FROM tasks')) {
      let result = [...this.tables.tasks];
      return result as unknown as T[];
    }

    // 3. SELECT * FROM folders
    if (cleanSql.includes('FROM folders')) {
      return [...this.tables.folders] as unknown as T[];
    }

    // 4. SELECT * FROM sync_changelog
    if (cleanSql.includes('FROM sync_changelog')) {
      return [...this.tables.sync_changelog] as unknown as T[];
    }

    return [] as T[];
  }

  public async queryFirst<T>(sql: string, params: any[] = []): Promise<T | null> {
    const list = await this.query<T>(sql, params);
    return list.length > 0 ? list[0] : null;
  }

  public async run(sql: string, params: any[] = []): Promise<{ lastInsertRowId: number; changes: number }> {
    await this.ensureLoaded();
    const cleanSql = sql.trim();

    // 1. INSERT INTO notes
    if (cleanSql.startsWith('INSERT INTO notes')) {
      const [id, user_id, folder_path, title, content_markdown, blocks_json, color_token] = params;
      const newNote: DBNote = {
        id,
        user_id,
        folder_id: null,
        folder_path: folder_path || 'General',
        group_name: null,
        title,
        content_markdown: content_markdown || '',
        blocks_json: blocks_json || '[]',
        color_token: color_token || 'apricot',
        is_favorite: 0,
        is_pinned: 0,
        status: 'active',
        priority_score: 0.5,
        sync_rev: 0,
        created_at: 'Just now',
        updated_at: 'Just now',
        trashed_at: null,
      };

      this.tables.notes.unshift(newNote);
      await this.persistAll();
      return { lastInsertRowId: 1, changes: 1 };
    }

    // 2. UPDATE notes (toggle favorite or content)
    if (cleanSql.startsWith('UPDATE notes')) {
      const id = params[params.length - 1];
      const note = this.tables.notes.find((n) => n.id === id);
      if (note) {
        if (cleanSql.includes('is_favorite')) {
          note.is_favorite = note.is_favorite === 1 ? 0 : 1;
        }
        note.updated_at = 'Just now';
        await this.persistAll();
        return { lastInsertRowId: 1, changes: 1 };
      }
    }

    // 3. DELETE FROM notes
    if (cleanSql.startsWith('DELETE FROM notes')) {
      const id = params[0];
      const initial = this.tables.notes.length;
      this.tables.notes = this.tables.notes.filter((n) => n.id !== id);
      await this.persistAll();
      return { lastInsertRowId: 0, changes: initial - this.tables.notes.length };
    }

    // 4. INSERT INTO tasks
    if (cleanSql.startsWith('INSERT INTO tasks')) {
      const [id, user_id, note_id, note_title, note_color_token, title] = params;
      const newTask: DBTask = {
        id,
        user_id,
        note_id: note_id || null,
        note_title: note_title || null,
        note_color_token: note_color_token || null,
        block_id: null,
        title,
        is_completed: 0,
        priority: 'none',
        due_date: 'Today',
        sync_rev: 0,
        created_at: 'Just now',
        updated_at: 'Just now',
      };

      this.tables.tasks.unshift(newTask);
      await this.persistAll();
      return { lastInsertRowId: 1, changes: 1 };
    }

    // 5. UPDATE tasks (toggle completion)
    if (cleanSql.startsWith('UPDATE tasks')) {
      const id = params[0];
      const task = this.tables.tasks.find((t) => t.id === id);
      if (task) {
        task.is_completed = task.is_completed === 1 ? 0 : 1;
        task.updated_at = 'Just now';
        await this.persistAll();
        return { lastInsertRowId: 1, changes: 1 };
      }
    }

    // 6. DELETE FROM tasks
    if (cleanSql.startsWith('DELETE FROM tasks')) {
      const id = params[0];
      const initial = this.tables.tasks.length;
      this.tables.tasks = this.tables.tasks.filter((t) => t.id !== id);
      await this.persistAll();
      return { lastInsertRowId: 0, changes: initial - this.tables.tasks.length };
    }

    // 7. INSERT INTO sync_changelog
    if (cleanSql.startsWith('INSERT INTO sync_changelog')) {
      const [id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload] = params;
      this.tables.sync_changelog.push({
        id,
        user_id,
        sync_rev,
        entity_type,
        entity_id,
        change_type,
        delta_payload,
        created_at: new Date().toISOString(),
      });
      await this.persistAll();
      return { lastInsertRowId: 1, changes: 1 };
    }

    return { lastInsertRowId: 0, changes: 0 };
  }

  public async exec(sql: string): Promise<void> {
    await this.ensureLoaded();
  }

  public async withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    await this.ensureLoaded();
    const result = await callback();
    await this.persistAll();
    return result;
  }
}

export const dbClient = new WebDatabaseClient();
