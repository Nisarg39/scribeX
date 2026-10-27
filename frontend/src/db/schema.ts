/**
 * ScribeX SQLite Schema Definitions
 * Source of Truth: docs/Universal_Note_Input_Structure_and_Relations.md
 */

export const SCHEMA_SQL = `
-- 1. Folders Hierarchy Table
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  path TEXT NOT NULL,
  color_token TEXT DEFAULT 'apricot',
  icon TEXT,
  sync_rev INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
);

-- 2. Tags Table
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL UNIQUE,
  color_token TEXT DEFAULT 'cyan',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Notes Table
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  folder_id TEXT,
  folder_path TEXT,
  group_name TEXT,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL DEFAULT '',
  blocks_json TEXT NOT NULL DEFAULT '[]',
  color_token TEXT NOT NULL DEFAULT 'apricot',
  is_favorite BOOLEAN NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT 0,
  status TEXT CHECK(status IN ('active', 'archived', 'trashed')) NOT NULL DEFAULT 'active',
  priority_score REAL DEFAULT 0.0,
  sync_rev INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  trashed_at DATETIME,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
);

-- 4. Note Tags Many-to-Many Junction Table
CREATE TABLE IF NOT EXISTS note_tags (
  note_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- 5. Tasks Ledger Table (Single Source of Truth)
CREATE TABLE IF NOT EXISTS tasks (
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
  sync_rev INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

-- 6. Binary Assets & Files Ledger
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256_hash TEXT NOT NULL,
  processing_status TEXT CHECK(processing_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  extracted_text TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Knowledge Graph Entity Relations
CREATE TABLE IF NOT EXISTS entity_relations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  relation_type TEXT CHECK(relation_type IN ('relates_to', 'supersedes', 'derived_from', 'part_of', 'contradicts')) NOT NULL,
  target_id TEXT NOT NULL,
  created_by TEXT CHECK(created_by IN ('user', 'friday_ai')) NOT NULL DEFAULT 'user',
  confidence_score REAL DEFAULT 1.0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_id, relation_type, target_id)
);

-- 8. Event-Sourced Delta Sync Changelog
CREATE TABLE IF NOT EXISTS sync_changelog (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  sync_rev INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  change_type TEXT CHECK(change_type IN ('insert', 'update', 'delete')) NOT NULL,
  delta_payload TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sub-5ms Performance Query Indexes
CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);
CREATE INDEX IF NOT EXISTS idx_notes_favorite ON notes(is_favorite);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_note ON tasks(note_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(is_completed);
CREATE INDEX IF NOT EXISTS idx_relations_source ON entity_relations(source_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON entity_relations(target_id);
CREATE INDEX IF NOT EXISTS idx_changelog_rev ON sync_changelog(sync_rev);
`;
