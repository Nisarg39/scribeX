-- =============================================================================
-- ScribeX Supabase PostgreSQL Schema Definition
-- Migration: 001_initial_schema.sql
-- Source of Truth: docs/Unified_Backend_and_AI_Master_Specification.md
-- Parity Reference: frontend/src/db/schema.ts
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. Folders Hierarchy Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  path TEXT NOT NULL,
  color_token TEXT NOT NULL DEFAULT 'apricot',
  icon TEXT,
  sync_rev BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. Tags Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color_token TEXT NOT NULL DEFAULT 'cyan',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tags_user_name UNIQUE (user_id, name)
);

-- =============================================================================
-- 3. Notes Table (Dual-Persistence: Markdown + Block AST + pgvector Embeddings)
-- =============================================================================
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  folder_path TEXT,
  group_name TEXT,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL DEFAULT '',
  blocks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  color_token TEXT NOT NULL DEFAULT 'apricot',
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'trashed')),
  priority_score REAL NOT NULL DEFAULT 0.0,
  reminder_at TIMESTAMPTZ,
  embedding vector(1536), -- Compatible with OpenAI text-embedding-3-small & Gemini Embeddings
  sync_rev BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trashed_at TIMESTAMPTZ
);

-- =============================================================================
-- 4. Note Tags Junction Table (Many-to-Many)
-- =============================================================================
CREATE TABLE IF NOT EXISTS note_tags (
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

-- =============================================================================
-- 5. Tasks Ledger Table (Single Source of Truth)
-- =============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
  note_title TEXT,
  note_color_token TEXT,
  block_id TEXT,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  priority TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')),
  due_date TEXT,
  reminder_at TIMESTAMPTZ,
  sync_rev BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 6. Binary Assets & Files Ledger (Google Drive Media Vault Metadata)
-- =============================================================================
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  drive_file_id TEXT,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256_hash TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  extracted_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 7. Knowledge Graph Entity Relations
-- =============================================================================
CREATE TABLE IF NOT EXISTS entity_relations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('relates_to', 'supersedes', 'derived_from', 'part_of', 'contradicts')),
  target_id TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'user' CHECK (created_by IN ('user', 'friday_ai')),
  confidence_score REAL NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_entity_relations UNIQUE (user_id, source_id, relation_type, target_id)
);

-- =============================================================================
-- 8. Event-Sourced Delta Sync Changelog (With Monotonic Revision & Caller Platform)
-- =============================================================================
CREATE TABLE IF NOT EXISTS sync_changelog (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  sync_rev BIGINT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('insert', 'update', 'delete')),
  delta_payload JSONB NOT NULL,
  caller_platform TEXT NOT NULL DEFAULT 'local_client',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 9. Search & Filter History Ledger
-- =============================================================================
CREATE TABLE IF NOT EXISTS search_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  query_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'text' CHECK (source IN ('text', 'voice', 'ai')),
  filter_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  use_count INTEGER NOT NULL DEFAULT 1,
  sync_rev BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_search_history_user_query UNIQUE (user_id, query_text)
);

-- =============================================================================
-- 10. Hardware & Cloud Reminders Ledger (Serverless Multi-Device Alarms)
-- =============================================================================
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('task', 'note', 'event', 'checklist_point')),
  target_id TEXT NOT NULL,
  note_id TEXT,
  trigger_at TIMESTAMPTZ NOT NULL,
  notification_id TEXT,
  channel_id TEXT NOT NULL DEFAULT 'scribex_reminders',
  is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,
  device_id TEXT NOT NULL DEFAULT 'local_client',
  caller_platform TEXT NOT NULL DEFAULT 'local_client',
  sync_rev BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 11. High-Performance Query & Search Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_notes_user_folder ON notes(user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_status ON notes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notes_user_favorite ON notes(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON notes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user_note ON tasks(user_id, note_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_completed ON tasks(user_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_relations_user_source ON entity_relations(user_id, source_id);
CREATE INDEX IF NOT EXISTS idx_relations_user_target ON entity_relations(user_id, target_id);
CREATE INDEX IF NOT EXISTS idx_changelog_user_rev ON sync_changelog(user_id, sync_rev);
CREATE INDEX IF NOT EXISTS idx_reminders_user_target ON reminders(user_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_trigger ON reminders(user_id, trigger_at, is_dismissed);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, last_used_at DESC);

-- GIN Index for fast Full-Text Search in PostgreSQL
CREATE INDEX IF NOT EXISTS idx_notes_fts ON notes USING GIN (to_tsvector('english', title || ' ' || content_markdown));

-- HNSW Vector Index for Semantic Vector Search via pgvector
CREATE INDEX IF NOT EXISTS idx_notes_embedding ON notes USING hnsw (embedding vector_cosine_ops);

-- =============================================================================
-- 12. Row-Level Security (RLS) Tenant Isolation
-- Enforces auth.uid() = user_id on all tables with zero data leakage
-- =============================================================================
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_changelog ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
CREATE POLICY "Folders tenant isolation" ON folders FOR ALL TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Tags tenant isolation" ON tags FOR ALL TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Notes tenant isolation" ON notes FOR ALL TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Tasks tenant isolation" ON tasks FOR ALL TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Assets tenant isolation" ON assets FOR ALL TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Relations tenant isolation" ON entity_relations FOR ALL TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Changelog tenant isolation" ON sync_changelog FOR ALL TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Search history tenant isolation" ON search_history FOR ALL TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Reminders tenant isolation" ON reminders FOR ALL TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Note tags tenant isolation" ON note_tags FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()::text));

-- =============================================================================
-- 13. Supabase Realtime CDC Publication
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE notes, folders, tasks, reminders, sync_changelog;

