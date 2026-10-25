-- ==============================================================================
-- ScribeX Operational SQLite Core Database Schemas
-- Mode: WAL (Write-Ahead Logging) + FTS5 Full-Text Search
-- Multi-Tenancy: Parameterized with user_id on all tables and indexes
-- ==============================================================================

-- 1. Notes Table (Living Structured Notes)
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
    title TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    priority_score REAL DEFAULT 0.5,
    sync_rev INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notes_user_group ON notes(user_id, group_name);
CREATE INDEX IF NOT EXISTS idx_notes_user_priority ON notes(user_id, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_rev ON notes(user_id, sync_rev);

-- 2. Sync Revision Counter & Metadata
CREATE TABLE IF NOT EXISTS user_sync_meta (
    user_id TEXT PRIMARY KEY,
    current_sync_rev INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Event-Sourced Delta Sync Changelog
CREATE TABLE IF NOT EXISTS sync_changelog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    sync_rev INTEGER NOT NULL,
    entity_type TEXT NOT NULL, -- 'note', 'task', 'edge', 'profile'
    entity_id TEXT NOT NULL,
    change_type TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    delta_payload TEXT NOT NULL, -- JSON serialized string
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_user_rev ON sync_changelog(user_id, sync_rev);

-- 4. Entity Relationship Graph Edges (Layer 2 Memory)
CREATE TABLE IF NOT EXISTS entity_edges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    relation_type TEXT NOT NULL, -- 'RELATES_TO', 'SERVES_GOAL', 'BLOCKED_BY', 'LINKED_FILE'
    target_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_edges_user_src ON entity_edges(user_id, source_id);
CREATE INDEX IF NOT EXISTS idx_edges_user_tgt ON entity_edges(user_id, target_id);

-- 5. Temporal Identity Evolution Timeline (Layer 3 "Versions of Me")
CREATE TABLE IF NOT EXISTS identity_timeline (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    attribute TEXT NOT NULL, -- 'career_role', 'long_term_goal', 'daily_routine', 'focus_area'
    old_value TEXT,
    new_value TEXT NOT NULL,
    change_reason TEXT,
    git_commit_sha TEXT,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_timeline_user_attr ON identity_timeline(user_id, attribute);

-- 6. Behavioral & Preference Ledger (Layer 4 Learned Rules)
CREATE TABLE IF NOT EXISTS learned_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL, -- 'filing', 'tone', 'priority', 'checklist'
    preference_rule TEXT NOT NULL,
    confidence_score REAL DEFAULT 0.5,
    source_diff_sha TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pref_user_cat ON learned_preferences(user_id, category);

-- 7. Staging Intake Table (Ask-Before-Write Ambiguity Gate)
CREATE TABLE IF NOT EXISTS staging_intake (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    raw_input TEXT NOT NULL,
    clarity_score REAL NOT NULL,
    clarifying_questions TEXT NOT NULL, -- JSON array of strings
    proposed_action TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING_CLARIFICATION', -- 'PENDING_CLARIFICATION', 'RESOLVED', 'DISCARDED'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staging_user_status ON staging_intake(user_id, status);

-- 8. Full-Text Search Virtual Table (FTS5 BM25 Keyword Search)
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    note_id UNINDEXED,
    user_id UNINDEXED,
    title,
    content_markdown,
    tokenize = 'porter unicode61'
);

-- Triggers to synchronize notes_fts with the main notes table automatically
CREATE TRIGGER IF NOT EXISTS trg_notes_after_insert AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(note_id, user_id, title, content_markdown)
    VALUES (new.id, new.user_id, new.title, new.content_markdown);
END;

CREATE TRIGGER IF NOT EXISTS trg_notes_after_delete AFTER DELETE ON notes BEGIN
    DELETE FROM notes_fts WHERE note_id = old.id AND user_id = old.user_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_notes_after_update AFTER UPDATE ON notes BEGIN
    DELETE FROM notes_fts WHERE note_id = old.id AND user_id = old.user_id;
    INSERT INTO notes_fts(note_id, user_id, title, content_markdown)
    VALUES (new.id, new.user_id, new.title, new.content_markdown);
END;
