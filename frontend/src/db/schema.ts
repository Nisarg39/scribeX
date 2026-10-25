/**
 * Client Offline-First Database Schema.
 * Aligned with Server Operational SQLite schema.
 */

export const CREATE_NOTES_TABLE = `
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  priority_score REAL DEFAULT 0.5,
  color_token TEXT DEFAULT 'apricot',
  is_favorite INTEGER DEFAULT 0,
  sync_rev INTEGER NOT NULL DEFAULT 0,
  pending_sync INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

export const CREATE_SYNC_META_TABLE = `
CREATE TABLE IF NOT EXISTS local_sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const CREATE_PENDING_MUTATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS pending_mutations (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  mutation_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

export const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_group ON notes(group_name);
CREATE INDEX IF NOT EXISTS idx_notes_pending ON notes(pending_sync);
CREATE INDEX IF NOT EXISTS idx_mutations_created ON pending_mutations(created_at ASC);
`;
