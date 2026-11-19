-- =============================================================================
-- ScribeX Multi-Device Cloud Sync Parity Migration
-- Migration: 004_multi_device_sync_parity.sql
-- Source of Truth: docs/Multi_Device_Cloud_Sync_Audit_and_Gap_Fix_Plan.md
-- Closes:
--   - Gap 1: Server-side Lean-Cache-safe folder cascades (path rename/move, delete, archive)
--   - Gap 2: Bidirectional note tags emitted in sync_changelog.delta_payload
--   - Gap 3: Explicit nullable clear flags (p_clear_folder_id, p_clear_reminder_at) in rpc_update_note
--   - Gap 5: In-App Notifications RPCs (upsert, mark read / mark all read, clear / clear all)
--   - Gap 6: Search History RPCs (upsert with case-insensitive dedup, delete / clear all)
--   - Gap 7: Entity Relations (Knowledge Graph) RPCs (upsert, delete)
--   - Reminder Dismiss RPC (prevents re-activating dismissed reminders via rpc_schedule_reminder)
-- =============================================================================

-- =============================================================================
-- 0. Expand in_app_notifications target_type check to match client NotificationTargetType
-- =============================================================================
ALTER TABLE public.in_app_notifications
  DROP CONSTRAINT IF EXISTS in_app_notifications_target_type_check;

ALTER TABLE public.in_app_notifications
  ADD CONSTRAINT in_app_notifications_target_type_check
  CHECK (target_type IN ('task', 'note', 'event', 'checklist_point', 'system'));

-- =============================================================================
-- 1. RPC: Create / Upsert Note (Gap 2 — emits resolved tags array in sync_changelog)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_create_note(
  p_title TEXT,
  p_content_markdown TEXT DEFAULT '',
  p_blocks_json JSONB DEFAULT '[]'::jsonb,
  p_folder_id TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_color_token TEXT DEFAULT 'apricot',
  p_reminder_at TIMESTAMPTZ DEFAULT NULL,
  p_caller_platform TEXT DEFAULT 'local_client',
  p_id TEXT DEFAULT NULL,
  p_ai_context_excluded BOOLEAN DEFAULT FALSE,
  p_folder_path TEXT DEFAULT NULL,
  p_is_favorite BOOLEAN DEFAULT FALSE,
  p_is_pinned BOOLEAN DEFAULT FALSE,
  p_status TEXT DEFAULT 'active',
  p_is_locked BOOLEAN DEFAULT FALSE,
  p_lock_type TEXT DEFAULT NULL,
  p_lock_credential_kind TEXT DEFAULT NULL,
  p_lock_hash TEXT DEFAULT NULL,
  p_lock_salt TEXT DEFAULT NULL,
  p_lock_hint TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_note_id TEXT := COALESCE(p_id, gen_random_uuid()::text);
  v_sync_rev BIGINT;
  v_tag_name TEXT;
  v_tag_id TEXT;
  v_folder_path TEXT := p_folder_path;
  v_tags_json JSONB := '[]'::jsonb;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  IF v_folder_path IS NULL AND p_folder_id IS NOT NULL THEN
    SELECT path INTO v_folder_path FROM folders WHERE id = p_folder_id AND user_id = v_user_id;
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  INSERT INTO notes (
    id, user_id, folder_id, folder_path, title, content_markdown,
    blocks_json, color_token, is_favorite, is_pinned, status, reminder_at,
    is_locked, lock_type, lock_credential_kind, lock_hash, lock_salt, lock_hint,
    ai_context_excluded, sync_rev, created_at, updated_at
  ) VALUES (
    v_note_id, v_user_id, p_folder_id, COALESCE(v_folder_path, 'General'), p_title, COALESCE(p_content_markdown, ''),
    COALESCE(p_blocks_json, '[]'::jsonb), COALESCE(p_color_token, 'apricot'),
    COALESCE(p_is_favorite, FALSE), COALESCE(p_is_pinned, FALSE), COALESCE(p_status, 'active'), p_reminder_at,
    COALESCE(p_is_locked, FALSE), p_lock_type, p_lock_credential_kind, p_lock_hash, p_lock_salt, p_lock_hint,
    COALESCE(p_ai_context_excluded, FALSE), v_sync_rev, NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    folder_id = EXCLUDED.folder_id,
    folder_path = COALESCE(EXCLUDED.folder_path, notes.folder_path),
    content_markdown = EXCLUDED.content_markdown,
    blocks_json = EXCLUDED.blocks_json,
    color_token = EXCLUDED.color_token,
    is_favorite = EXCLUDED.is_favorite,
    is_pinned = EXCLUDED.is_pinned,
    status = EXCLUDED.status,
    reminder_at = EXCLUDED.reminder_at,
    is_locked = EXCLUDED.is_locked,
    lock_type = EXCLUDED.lock_type,
    lock_credential_kind = EXCLUDED.lock_credential_kind,
    lock_hash = EXCLUDED.lock_hash,
    lock_salt = EXCLUDED.lock_salt,
    lock_hint = EXCLUDED.lock_hint,
    ai_context_excluded = EXCLUDED.ai_context_excluded,
    sync_rev = EXCLUDED.sync_rev,
    updated_at = NOW()
  WHERE notes.user_id = v_user_id;

  -- Guard against cross-tenant PK collisions (SECURITY DEFINER bypasses RLS):
  -- If the PK belongs to another tenant, do NOT touch note_tags, reminders, or sync_changelog.
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Process Tags (handles both populated arrays and explicit empty-array clear on upsert)
  IF p_tags IS NOT NULL THEN
    DELETE FROM note_tags WHERE note_id = v_note_id;
    IF array_length(p_tags, 1) IS NOT NULL THEN
      FOREACH v_tag_name IN ARRAY p_tags LOOP
        v_tag_name := lower(trim(regexp_replace(COALESCE(v_tag_name, ''), '^#+', '')));
        IF length(v_tag_name) > 0 THEN
          SELECT id INTO v_tag_id FROM tags WHERE user_id = v_user_id AND name = v_tag_name;
          IF v_tag_id IS NULL THEN
            v_tag_id := gen_random_uuid()::text;
            INSERT INTO tags (id, user_id, name, color_token) VALUES (v_tag_id, v_user_id, v_tag_name, 'cyan')
            ON CONFLICT (user_id, name) DO NOTHING;
            SELECT id INTO v_tag_id FROM tags WHERE user_id = v_user_id AND name = v_tag_name;
          END IF;
          IF v_tag_id IS NOT NULL THEN
            INSERT INTO note_tags (note_id, tag_id) VALUES (v_note_id, v_tag_id) ON CONFLICT DO NOTHING;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Resolve authoritative tag array for CDC broadcast
  SELECT COALESCE(jsonb_agg(t.name ORDER BY t.name), '[]'::jsonb)
  INTO v_tags_json
  FROM note_tags nt
  INNER JOIN tags t ON t.id = nt.tag_id
  WHERE nt.note_id = v_note_id;

  -- Create Reminder if requested (deduplicated to avoid phantom reminders on note upsert)
  IF p_reminder_at IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM reminders
    WHERE user_id = v_user_id
      AND target_type = 'note'
      AND target_id = v_note_id
      AND is_dismissed = FALSE
  ) THEN
    INSERT INTO reminders (
      id, user_id, target_type, target_id, note_id, title, body, trigger_at,
      caller_platform, sync_rev, created_at, updated_at
    ) VALUES (
      gen_random_uuid()::text, v_user_id, 'note', v_note_id, v_note_id, p_title, 'Note Reminder: ' || p_title,
      p_reminder_at, p_caller_platform, v_sync_rev, NOW(), NOW()
    );
  END IF;

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_sync_rev, 'note', v_note_id, 'insert',
    jsonb_build_object(
      'id', v_note_id,
      'title', p_title,
      'content_markdown', LEFT(COALESCE(p_content_markdown, ''), 240),
      'blocks_json', COALESCE(p_blocks_json, '[]'::jsonb),
      'folder_id', p_folder_id,
      'folder_path', COALESCE(v_folder_path, 'General'),
      'color_token', COALESCE(p_color_token, 'apricot'),
      'is_favorite', COALESCE(p_is_favorite, FALSE),
      'is_pinned', COALESCE(p_is_pinned, FALSE),
      'status', COALESCE(p_status, 'active'),
      'reminder_at', p_reminder_at,
      'is_locked', COALESCE(p_is_locked, FALSE),
      'lock_type', p_lock_type,
      'lock_credential_kind', p_lock_credential_kind,
      'lock_hash', p_lock_hash,
      'lock_salt', p_lock_salt,
      'lock_hint', p_lock_hint,
      'ai_context_excluded', COALESCE(p_ai_context_excluded, FALSE),
      'tags', COALESCE(v_tags_json, '[]'::jsonb)
    ),
    p_caller_platform, NOW()
  );

  SELECT row_to_json(n)::jsonb || jsonb_build_object('tags', COALESCE(v_tags_json, '[]'::jsonb))
  INTO v_result
  FROM notes n
  WHERE n.id = v_note_id AND n.user_id = v_user_id;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- 2. RPC: Update Note (Gaps 2 & 3 — explicit p_clear_folder_id / p_clear_reminder_at + tags CDC)
-- Drop previous 21-param overload cleanly to prevent PostgREST PGRST203 ambiguity
-- =============================================================================
DROP FUNCTION IF EXISTS public.rpc_update_note(
  TEXT, TEXT, TEXT, JSONB, TEXT[], TIMESTAMPTZ, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT,
  BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION rpc_update_note(
  p_note_id TEXT,
  p_title TEXT DEFAULT NULL,
  p_append_markdown TEXT DEFAULT NULL,
  p_blocks_json JSONB DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_reminder_at TIMESTAMPTZ DEFAULT NULL,
  p_caller_platform TEXT DEFAULT 'local_client',
  p_ai_context_excluded BOOLEAN DEFAULT NULL,
  p_content_markdown TEXT DEFAULT NULL,
  p_folder_id TEXT DEFAULT NULL,
  p_folder_path TEXT DEFAULT NULL,
  p_color_token TEXT DEFAULT NULL,
  p_is_favorite BOOLEAN DEFAULT NULL,
  p_is_pinned BOOLEAN DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_is_locked BOOLEAN DEFAULT NULL,
  p_lock_type TEXT DEFAULT NULL,
  p_lock_credential_kind TEXT DEFAULT NULL,
  p_lock_hash TEXT DEFAULT NULL,
  p_lock_salt TEXT DEFAULT NULL,
  p_lock_hint TEXT DEFAULT NULL,
  p_clear_folder_id BOOLEAN DEFAULT FALSE,
  p_clear_reminder_at BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_sync_rev BIGINT;
  v_tag_name TEXT;
  v_tag_id TEXT;
  v_tags_json JSONB := '[]'::jsonb;
  v_note RECORD;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  UPDATE notes
  SET title = COALESCE(p_title, title),
      content_markdown = CASE
        WHEN p_content_markdown IS NOT NULL THEN p_content_markdown
        WHEN p_append_markdown IS NOT NULL THEN content_markdown || E'\n\n' || p_append_markdown
        ELSE content_markdown
      END,
      blocks_json = COALESCE(p_blocks_json, blocks_json),
      folder_id = CASE
        WHEN p_clear_folder_id THEN NULL
        ELSE COALESCE(p_folder_id, folder_id)
      END,
      folder_path = CASE
        WHEN p_clear_folder_id THEN COALESCE(p_folder_path, 'General')
        ELSE COALESCE(p_folder_path, folder_path)
      END,
      color_token = COALESCE(p_color_token, color_token),
      is_favorite = COALESCE(p_is_favorite, is_favorite),
      is_pinned = COALESCE(p_is_pinned, is_pinned),
      status = COALESCE(p_status, status),
      reminder_at = CASE
        WHEN p_clear_reminder_at THEN NULL
        ELSE COALESCE(p_reminder_at, reminder_at)
      END,
      is_locked = COALESCE(p_is_locked, is_locked),
      lock_type = CASE WHEN p_is_locked = FALSE THEN NULL ELSE COALESCE(p_lock_type, lock_type) END,
      lock_credential_kind = CASE WHEN p_is_locked = FALSE THEN NULL ELSE COALESCE(p_lock_credential_kind, lock_credential_kind) END,
      lock_hash = CASE WHEN p_is_locked = FALSE THEN NULL ELSE COALESCE(p_lock_hash, lock_hash) END,
      lock_salt = CASE WHEN p_is_locked = FALSE THEN NULL ELSE COALESCE(p_lock_salt, lock_salt) END,
      lock_hint = CASE WHEN p_is_locked = FALSE THEN NULL ELSE COALESCE(p_lock_hint, lock_hint) END,
      ai_context_excluded = COALESCE(p_ai_context_excluded, ai_context_excluded),
      trashed_at = CASE WHEN p_status = 'trashed' THEN NOW() WHEN p_status IS NOT NULL THEN NULL ELSE trashed_at END,
      sync_rev = v_sync_rev,
      updated_at = NOW()
  WHERE id = p_note_id AND user_id = v_user_id
  RETURNING * INTO v_note;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Note not found or permission denied';
  END IF;

  IF p_tags IS NOT NULL THEN
    DELETE FROM note_tags WHERE note_id = p_note_id;
    IF array_length(p_tags, 1) IS NOT NULL THEN
      FOREACH v_tag_name IN ARRAY p_tags LOOP
        v_tag_name := lower(trim(regexp_replace(COALESCE(v_tag_name, ''), '^#+', '')));
        IF length(v_tag_name) > 0 THEN
          SELECT id INTO v_tag_id FROM tags WHERE user_id = v_user_id AND name = v_tag_name;
          IF v_tag_id IS NULL THEN
            v_tag_id := gen_random_uuid()::text;
            INSERT INTO tags (id, user_id, name, color_token) VALUES (v_tag_id, v_user_id, v_tag_name, 'cyan')
            ON CONFLICT (user_id, name) DO NOTHING;
            SELECT id INTO v_tag_id FROM tags WHERE user_id = v_user_id AND name = v_tag_name;
          END IF;
          IF v_tag_id IS NOT NULL THEN
            INSERT INTO note_tags (note_id, tag_id) VALUES (p_note_id, v_tag_id) ON CONFLICT DO NOTHING;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Resolve authoritative tag array for CDC broadcast
  SELECT COALESCE(jsonb_agg(t.name ORDER BY t.name), '[]'::jsonb)
  INTO v_tags_json
  FROM note_tags nt
  INNER JOIN tags t ON t.id = nt.tag_id
  WHERE nt.note_id = p_note_id;

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_sync_rev, 'note', p_note_id, 'update',
    jsonb_build_object(
      'id', p_note_id,
      'title', v_note.title,
      'content_markdown', LEFT(COALESCE(v_note.content_markdown, ''), 240),
      'blocks_json', v_note.blocks_json,
      'folder_id', v_note.folder_id,
      'folder_path', v_note.folder_path,
      'color_token', v_note.color_token,
      'is_favorite', v_note.is_favorite,
      'is_pinned', v_note.is_pinned,
      'status', v_note.status,
      'reminder_at', v_note.reminder_at,
      'is_locked', v_note.is_locked,
      'lock_type', v_note.lock_type,
      'lock_credential_kind', v_note.lock_credential_kind,
      'lock_hash', v_note.lock_hash,
      'lock_salt', v_note.lock_salt,
      'lock_hint', v_note.lock_hint,
      'ai_context_excluded', v_note.ai_context_excluded,
      'tags', COALESCE(v_tags_json, '[]'::jsonb)
    ),
    p_caller_platform, NOW()
  );

  SELECT row_to_json(n)::jsonb || jsonb_build_object('tags', COALESCE(v_tags_json, '[]'::jsonb))
  INTO v_result
  FROM notes n
  WHERE n.id = p_note_id AND n.user_id = v_user_id;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- 3. RPC: Server-Side Folder Path Cascade (Gap 1 — Lean-Cache-Safe Rename & Move)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_cascade_folder_path_change(
  p_old_path TEXT,
  p_new_path TEXT,
  p_caller_platform TEXT DEFAULT 'local_client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_clean_old TEXT := trim(both '/' from trim(COALESCE(p_old_path, '')));
  v_clean_new TEXT := trim(both '/' from trim(COALESCE(p_new_path, '')));
  v_sync_rev BIGINT;
  v_root_folder_id TEXT;
  v_updated_folders INTEGER := 0;
  v_direct_notes INTEGER := 0;
  v_desc_notes INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  IF v_clean_old = '' OR v_clean_new = '' OR v_clean_old = v_clean_new THEN
    RETURN jsonb_build_object('updated_folders', 0, 'updated_notes', 0);
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  -- Update descendant folder paths (exact prefix match — immune to LIKE wildcards)
  UPDATE folders
  SET path = v_clean_new || substring(path from length(v_clean_old) + 1),
      sync_rev = v_sync_rev,
      updated_at = NOW()
  WHERE user_id = v_user_id
    AND left(path, length(v_clean_old) + 1) = v_clean_old || '/';
  GET DIAGNOSTICS v_updated_folders = ROW_COUNT;

  -- Update exact-match folder if still on old_path (also sync basename)
  UPDATE folders
  SET name = regexp_replace(v_clean_new, '^.*/', ''),
      path = v_clean_new,
      sync_rev = v_sync_rev,
      updated_at = NOW()
  WHERE user_id = v_user_id
    AND path = v_clean_old;

  SELECT id INTO v_root_folder_id
  FROM folders
  WHERE user_id = v_user_id AND path = v_clean_new
  LIMIT 1;

  -- Update ALL cloud notes directly inside old_path (including lean-cache-evicted notes)
  UPDATE notes
  SET folder_path = v_clean_new,
      sync_rev = v_sync_rev,
      updated_at = NOW()
  WHERE user_id = v_user_id
    AND (
      folder_path = v_clean_old
      OR (v_root_folder_id IS NOT NULL AND folder_id = v_root_folder_id)
    );
  GET DIAGNOSTICS v_direct_notes = ROW_COUNT;

  -- Update ALL cloud notes in descendant subfolders
  UPDATE notes
  SET folder_path = v_clean_new || substring(folder_path from length(v_clean_old) + 1),
      sync_rev = v_sync_rev,
      updated_at = NOW()
  WHERE user_id = v_user_id
    AND left(COALESCE(folder_path, ''), length(v_clean_old) + 1) = v_clean_old || '/';
  GET DIAGNOSTICS v_desc_notes = ROW_COUNT;

  -- Broadcast lightweight cascade event to Device B
  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_sync_rev, 'folder', COALESCE(v_root_folder_id, v_clean_new), 'update',
    jsonb_build_object(
      'action', 'cascade_path',
      'old_path', v_clean_old,
      'new_path', v_clean_new,
      'folder_id', v_root_folder_id
    ),
    p_caller_platform, NOW()
  );

  RETURN jsonb_build_object(
    'old_path', v_clean_old,
    'new_path', v_clean_new,
    'updated_folders', v_updated_folders,
    'updated_notes', v_direct_notes + v_desc_notes,
    'sync_rev', v_sync_rev
  );
END;
$$;

-- =============================================================================
-- 4. RPC: Server-Side Folder Delete Cascade (Gap 1 — Lean-Cache-Safe Delete)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_delete_folder_cascade(
  p_folder_id TEXT,
  p_folder_path TEXT,
  p_note_action TEXT DEFAULT 'moveToGeneral',
  p_caller_platform TEXT DEFAULT 'local_client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_clean_path TEXT := trim(both '/' from trim(COALESCE(p_folder_path, '')));
  v_effective_action TEXT := CASE WHEN p_note_action IN ('trash', 'moveToTrash') THEN 'trash' ELSE 'moveToGeneral' END;
  v_sync_rev BIGINT;
  v_folder_ids TEXT[];
  v_affected_notes INTEGER := 0;
  v_deleted_folders INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  IF lower(v_clean_path) = 'general' THEN
    RAISE EXCEPTION 'The default "General" folder cannot be deleted.';
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  SELECT COALESCE(array_agg(id), ARRAY[]::TEXT[])
  INTO v_folder_ids
  FROM folders
  WHERE user_id = v_user_id
    AND (
      id = p_folder_id
      OR (v_clean_path <> '' AND (path = v_clean_path OR left(path, length(v_clean_path) + 1) = v_clean_path || '/'))
    );

  IF v_effective_action = 'trash' THEN
    UPDATE notes
    SET status = 'trashed',
        trashed_at = NOW(),
        folder_id = NULL,
        sync_rev = v_sync_rev,
        updated_at = NOW()
    WHERE user_id = v_user_id
      AND (
        folder_id = p_folder_id
        OR folder_id = ANY(v_folder_ids)
        OR (v_clean_path <> '' AND (folder_path = v_clean_path OR left(COALESCE(folder_path, ''), length(v_clean_path) + 1) = v_clean_path || '/'))
      );
  ELSE
    UPDATE notes
    SET folder_path = 'General',
        folder_id = NULL,
        sync_rev = v_sync_rev,
        updated_at = NOW()
    WHERE user_id = v_user_id
      AND (
        folder_id = p_folder_id
        OR folder_id = ANY(v_folder_ids)
        OR (v_clean_path <> '' AND (folder_path = v_clean_path OR left(COALESCE(folder_path, ''), length(v_clean_path) + 1) = v_clean_path || '/'))
      );
  END IF;
  GET DIAGNOSTICS v_affected_notes = ROW_COUNT;

  DELETE FROM folders
  WHERE user_id = v_user_id
    AND (
      id = p_folder_id
      OR (v_clean_path <> '' AND (path = v_clean_path OR left(path, length(v_clean_path) + 1) = v_clean_path || '/'))
    );
  GET DIAGNOSTICS v_deleted_folders = ROW_COUNT;

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_sync_rev, 'folder', p_folder_id, 'delete',
    jsonb_build_object(
      'id', p_folder_id,
      'deleted_path', v_clean_path,
      'note_action', v_effective_action
    ),
    p_caller_platform, NOW()
  );

  RETURN jsonb_build_object(
    'deleted', TRUE,
    'id', p_folder_id,
    'deleted_path', v_clean_path,
    'note_action', v_effective_action,
    'affected_notes', v_affected_notes,
    'deleted_folders', v_deleted_folders,
    'sync_rev', v_sync_rev
  );
END;
$$;

-- =============================================================================
-- 5. RPC: Server-Side Folder Archive/Unarchive Cascade (Gap 1 — Lean-Cache-Safe Archive)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_cascade_folder_archive_change(
  p_folder_id TEXT,
  p_folder_path TEXT,
  p_is_archived BOOLEAN,
  p_caller_platform TEXT DEFAULT 'local_client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_clean_path TEXT := trim(both '/' from trim(COALESCE(p_folder_path, '')));
  v_sync_rev BIGINT;
  v_folder_ids TEXT[];
  v_affected_notes INTEGER := 0;
  v_segments TEXT[];
  v_ancestor_path TEXT := '';
  v_i INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  -- When unarchiving, also unarchive ancestor folders so path isn't orphaned
  IF NOT COALESCE(p_is_archived, FALSE) AND v_clean_path <> '' THEN
    v_segments := string_to_array(v_clean_path, '/');
    IF array_length(v_segments, 1) > 1 THEN
      FOR v_i IN 1..(array_length(v_segments, 1) - 1) LOOP
        v_ancestor_path := CASE WHEN v_i = 1 THEN v_segments[v_i] ELSE v_ancestor_path || '/' || v_segments[v_i] END;
        UPDATE folders
        SET is_archived = FALSE,
            sync_rev = v_sync_rev,
            updated_at = NOW()
        WHERE user_id = v_user_id AND path = v_ancestor_path AND is_archived = TRUE;
      END LOOP;
    END IF;
  END IF;

  UPDATE folders
  SET is_archived = COALESCE(p_is_archived, FALSE),
      sync_rev = v_sync_rev,
      updated_at = NOW()
  WHERE user_id = v_user_id
    AND (
      id = p_folder_id
      OR (v_clean_path <> '' AND (path = v_clean_path OR left(path, length(v_clean_path) + 1) = v_clean_path || '/'))
    );

  SELECT COALESCE(array_agg(id), ARRAY[]::TEXT[])
  INTO v_folder_ids
  FROM folders
  WHERE user_id = v_user_id
    AND (
      id = p_folder_id
      OR (v_clean_path <> '' AND (path = v_clean_path OR left(path, length(v_clean_path) + 1) = v_clean_path || '/'))
    );

  IF COALESCE(p_is_archived, FALSE) THEN
    UPDATE notes
    SET status = 'archived',
        sync_rev = v_sync_rev,
        updated_at = NOW()
    WHERE user_id = v_user_id
      AND status = 'active'
      AND (
        folder_id = p_folder_id
        OR folder_id = ANY(v_folder_ids)
        OR (v_clean_path <> '' AND (folder_path = v_clean_path OR left(COALESCE(folder_path, ''), length(v_clean_path) + 1) = v_clean_path || '/'))
      );
  ELSE
    UPDATE notes
    SET status = 'active',
        sync_rev = v_sync_rev,
        updated_at = NOW()
    WHERE user_id = v_user_id
      AND status = 'archived'
      AND (
        folder_id = p_folder_id
        OR folder_id = ANY(v_folder_ids)
        OR (v_clean_path <> '' AND (folder_path = v_clean_path OR left(COALESCE(folder_path, ''), length(v_clean_path) + 1) = v_clean_path || '/'))
      );
  END IF;
  GET DIAGNOSTICS v_affected_notes = ROW_COUNT;

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_sync_rev, 'folder', p_folder_id, 'update',
    jsonb_build_object(
      'action', 'cascade_archive',
      'folder_id', p_folder_id,
      'path', v_clean_path,
      'is_archived', COALESCE(p_is_archived, FALSE)
    ),
    p_caller_platform, NOW()
  );

  RETURN jsonb_build_object(
    'folder_id', p_folder_id,
    'path', v_clean_path,
    'is_archived', COALESCE(p_is_archived, FALSE),
    'affected_notes', v_affected_notes,
    'sync_rev', v_sync_rev
  );
END;
$$;

-- =============================================================================
-- 5b. RPC: Server-Side Folder Duplicate Cascade (Gap 1 — Lean-Cache-Safe Duplicate)
-- Clones folder (including lock metadata) and ALL non-trashed cloud notes with full
-- blocks_json and note_tags so Lean-Cache dehydrated/evicted notes are never lost.
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_duplicate_folder_cascade(
  p_source_folder_id TEXT,
  p_source_path TEXT,
  p_new_folder_id TEXT DEFAULT NULL,
  p_new_name TEXT DEFAULT NULL,
  p_caller_platform TEXT DEFAULT 'local_client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_clean_source TEXT := trim(both '/' from trim(COALESCE(p_source_path, '')));
  v_src_folder RECORD;
  v_has_src_folder BOOLEAN := FALSE;
  v_original_name TEXT;
  v_final_name TEXT;
  v_parent_path TEXT := '';
  v_target_path TEXT;
  v_new_folder_id TEXT := COALESCE(NULLIF(trim(p_new_folder_id), ''), gen_random_uuid()::text);
  v_folder_rev BIGINT;
  v_note RECORD;
  v_cloned_note_id TEXT;
  v_cloned_title TEXT;
  v_note_rev BIGINT;
  v_tags_json JSONB;
  v_folder_json JSONB;
  v_cloned_notes JSONB := '[]'::jsonb;
  v_duplicated_count INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  SELECT * INTO v_src_folder
  FROM folders
  WHERE user_id = v_user_id
    AND (
      (p_source_folder_id IS NOT NULL AND id = p_source_folder_id)
      OR (v_clean_source <> '' AND path = v_clean_source)
    )
  LIMIT 1;
  v_has_src_folder := FOUND;

  IF v_clean_source = '' AND v_has_src_folder THEN
    v_clean_source := trim(both '/' from trim(COALESCE(v_src_folder.path, '')));
  END IF;

  v_original_name := CASE
    WHEN v_has_src_folder AND COALESCE(trim(v_src_folder.name), '') <> '' THEN v_src_folder.name
    WHEN v_clean_source <> '' THEN regexp_replace(v_clean_source, '^.*/', '')
    ELSE 'Folder'
  END;
  v_final_name := trim(COALESCE(NULLIF(trim(p_new_name), ''), v_original_name || ' (Copy)'));

  IF position('/' in v_clean_source) > 0 THEN
    v_parent_path := regexp_replace(v_clean_source, '/[^/]+$', '');
  END IF;
  v_target_path := CASE WHEN v_parent_path <> '' THEN v_parent_path || '/' || v_final_name ELSE v_final_name END;

  -- Prevent cross-tenant PK collision on new folder ID
  IF EXISTS (SELECT 1 FROM folders WHERE id = v_new_folder_id AND user_id <> v_user_id) THEN
    v_new_folder_id := gen_random_uuid()::text;
  END IF;

  v_folder_rev := get_next_sync_rev(v_user_id);

  INSERT INTO folders (
    id, user_id, name, parent_id, path, color_token, icon, cover_image,
    is_favorite, is_pinned, is_archived,
    is_locked, lock_type, lock_credential_kind, lock_hash, lock_salt, lock_hint,
    ai_context_excluded, sync_rev, created_at, updated_at
  ) VALUES (
    v_new_folder_id,
    v_user_id,
    v_final_name,
    CASE WHEN v_has_src_folder THEN v_src_folder.parent_id ELSE NULL END,
    v_target_path,
    CASE WHEN v_has_src_folder THEN COALESCE(v_src_folder.color_token, 'cyan') ELSE 'cyan' END,
    CASE WHEN v_has_src_folder THEN v_src_folder.icon ELSE NULL END,
    CASE WHEN v_has_src_folder THEN v_src_folder.cover_image ELSE NULL END,
    FALSE,
    FALSE,
    FALSE,
    CASE WHEN v_has_src_folder THEN COALESCE(v_src_folder.is_locked, FALSE) ELSE FALSE END,
    CASE WHEN v_has_src_folder THEN v_src_folder.lock_type ELSE NULL END,
    CASE WHEN v_has_src_folder THEN v_src_folder.lock_credential_kind ELSE NULL END,
    CASE WHEN v_has_src_folder THEN v_src_folder.lock_hash ELSE NULL END,
    CASE WHEN v_has_src_folder THEN v_src_folder.lock_salt ELSE NULL END,
    CASE WHEN v_has_src_folder THEN v_src_folder.lock_hint ELSE NULL END,
    CASE WHEN v_has_src_folder THEN COALESCE(v_src_folder.ai_context_excluded, FALSE) ELSE FALSE END,
    v_folder_rev,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    path = EXCLUDED.path,
    color_token = EXCLUDED.color_token,
    icon = EXCLUDED.icon,
    is_locked = EXCLUDED.is_locked,
    lock_type = EXCLUDED.lock_type,
    lock_credential_kind = EXCLUDED.lock_credential_kind,
    lock_hash = EXCLUDED.lock_hash,
    lock_salt = EXCLUDED.lock_salt,
    lock_hint = EXCLUDED.lock_hint,
    ai_context_excluded = EXCLUDED.ai_context_excluded,
    sync_rev = EXCLUDED.sync_rev,
    updated_at = NOW()
  WHERE folders.user_id = v_user_id;

  SELECT row_to_json(f)::jsonb INTO v_folder_json
  FROM folders f
  WHERE f.id = v_new_folder_id AND f.user_id = v_user_id;

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_folder_rev, 'folder', v_new_folder_id, 'insert',
    COALESCE(v_folder_json, jsonb_build_object('id', v_new_folder_id, 'name', v_final_name, 'path', v_target_path)),
    p_caller_platform, NOW()
  );

  -- Clone all non-trashed notes in source folder with full blocks_json & note_tags
  FOR v_note IN
    SELECT *
    FROM notes
    WHERE user_id = v_user_id
      AND status <> 'trashed'
      AND (
        (v_clean_source <> '' AND folder_path = v_clean_source)
        OR (p_source_folder_id IS NOT NULL AND folder_id = p_source_folder_id)
      )
    ORDER BY created_at ASC
  LOOP
    v_cloned_note_id := 'note-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    v_cloned_title := CASE WHEN COALESCE(trim(v_note.title), '') <> '' THEN v_note.title || ' (Copy)' ELSE 'Untitled Note (Copy)' END;
    v_note_rev := get_next_sync_rev(v_user_id);

    INSERT INTO notes (
      id, user_id, folder_id, folder_path, group_name, title, content_markdown,
      blocks_json, color_token, is_favorite, is_pinned, status, priority_score,
      is_locked, lock_type, lock_credential_kind, lock_hash, lock_salt, lock_hint,
      ai_context_excluded, sync_rev, created_at, updated_at
    ) VALUES (
      v_cloned_note_id, v_user_id, v_new_folder_id, v_target_path, v_note.group_name,
      v_cloned_title, COALESCE(v_note.content_markdown, ''), COALESCE(v_note.blocks_json, '[]'::jsonb),
      COALESCE(v_note.color_token, 'apricot'), FALSE, FALSE, 'active', COALESCE(v_note.priority_score, 0.0),
      COALESCE(v_note.is_locked, FALSE), v_note.lock_type, v_note.lock_credential_kind,
      v_note.lock_hash, v_note.lock_salt, v_note.lock_hint,
      COALESCE(v_note.ai_context_excluded, FALSE), v_note_rev, NOW(), NOW()
    );

    INSERT INTO note_tags (note_id, tag_id)
    SELECT v_cloned_note_id, nt.tag_id
    FROM note_tags nt
    WHERE nt.note_id = v_note.id
    ON CONFLICT DO NOTHING;

    SELECT COALESCE(jsonb_agg(t.name ORDER BY t.name), '[]'::jsonb)
    INTO v_tags_json
    FROM note_tags nt
    INNER JOIN tags t ON t.id = nt.tag_id
    WHERE nt.note_id = v_cloned_note_id;

    INSERT INTO sync_changelog (
      id, user_id, sync_rev, entity_type, entity_id, change_type,
      delta_payload, caller_platform, created_at
    ) VALUES (
      gen_random_uuid()::text, v_user_id, v_note_rev, 'note', v_cloned_note_id, 'insert',
      jsonb_build_object(
        'id', v_cloned_note_id,
        'title', v_cloned_title,
        'content_markdown', LEFT(COALESCE(v_note.content_markdown, ''), 240),
        'blocks_json', COALESCE(v_note.blocks_json, '[]'::jsonb),
        'folder_id', v_new_folder_id,
        'folder_path', v_target_path,
        'color_token', COALESCE(v_note.color_token, 'apricot'),
        'is_favorite', FALSE,
        'is_pinned', FALSE,
        'status', 'active',
        'reminder_at', NULL,
        'is_locked', COALESCE(v_note.is_locked, FALSE),
        'lock_type', v_note.lock_type,
        'lock_credential_kind', v_note.lock_credential_kind,
        'lock_hash', v_note.lock_hash,
        'lock_salt', v_note.lock_salt,
        'lock_hint', v_note.lock_hint,
        'ai_context_excluded', COALESCE(v_note.ai_context_excluded, FALSE),
        'tags', COALESCE(v_tags_json, '[]'::jsonb)
      ),
      p_caller_platform, NOW()
    );

    v_cloned_notes := v_cloned_notes || jsonb_build_array(
      jsonb_build_object(
        'id', v_cloned_note_id,
        'user_id', v_user_id,
        'folder_id', v_new_folder_id,
        'folder_path', v_target_path,
        'group_name', v_note.group_name,
        'title', v_cloned_title,
        'content_markdown', LEFT(COALESCE(v_note.content_markdown, ''), 240),
        'blocks_json', '[]'::jsonb,
        'color_token', COALESCE(v_note.color_token, 'apricot'),
        'is_favorite', FALSE,
        'is_pinned', FALSE,
        'status', 'active',
        'is_locked', COALESCE(v_note.is_locked, FALSE),
        'lock_type', v_note.lock_type,
        'lock_credential_kind', v_note.lock_credential_kind,
        'lock_hash', v_note.lock_hash,
        'lock_salt', v_note.lock_salt,
        'lock_hint', v_note.lock_hint,
        'ai_context_excluded', COALESCE(v_note.ai_context_excluded, FALSE),
        'sync_rev', v_note_rev,
        'tags', COALESCE(v_tags_json, '[]'::jsonb)
      )
    );
    v_duplicated_count := v_duplicated_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'folder', v_folder_json,
    'notes', v_cloned_notes,
    'duplicated_notes_count', v_duplicated_count
  );
END;
$$;

-- =============================================================================
-- 6. RPC: Dismiss Reminder (Prevents un-dismissal on Device A dismiss push)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_dismiss_reminder(
  p_reminder_id TEXT,
  p_caller_platform TEXT DEFAULT 'local_client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_sync_rev BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  UPDATE reminders
  SET is_dismissed = TRUE,
      dismissed_at = NOW(),
      sync_rev = v_sync_rev,
      updated_at = NOW()
  WHERE id = p_reminder_id AND user_id = v_user_id;

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_sync_rev, 'reminder', p_reminder_id, 'update',
    jsonb_build_object('id', p_reminder_id, 'is_dismissed', TRUE),
    p_caller_platform, NOW()
  );

  RETURN jsonb_build_object('dismissed', TRUE, 'id', p_reminder_id, 'sync_rev', v_sync_rev);
END;
$$;

-- =============================================================================
-- 7. RPCs: In-App Notifications Sync (Gap 5)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_upsert_in_app_notification(
  p_id TEXT,
  p_target_type TEXT,
  p_target_id TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT '',
  p_trigger_at TIMESTAMPTZ DEFAULT NOW(),
  p_reminder_id TEXT DEFAULT NULL,
  p_note_id TEXT DEFAULT NULL,
  p_recurrence_rule TEXT DEFAULT NULL,
  p_is_read BOOLEAN DEFAULT FALSE,
  p_read_at TIMESTAMPTZ DEFAULT NULL,
  p_is_cleared BOOLEAN DEFAULT FALSE,
  p_cleared_at TIMESTAMPTZ DEFAULT NULL,
  p_caller_platform TEXT DEFAULT 'local_client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_notif_id TEXT := COALESCE(p_id, gen_random_uuid()::text);
  v_target_type TEXT := CASE
    WHEN p_target_type IN ('task', 'note', 'event', 'checklist_point', 'system') THEN p_target_type
    ELSE 'system'
  END;
  v_sync_rev BIGINT;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  INSERT INTO in_app_notifications (
    id, user_id, reminder_id, target_type, target_id, note_id,
    title, body, trigger_at, recurrence_rule,
    is_read, read_at, is_cleared, cleared_at,
    sync_rev, created_at, updated_at
  ) VALUES (
    v_notif_id, v_user_id, p_reminder_id, v_target_type, p_target_id, p_note_id,
    COALESCE(p_title, 'Notification'), COALESCE(p_body, ''), COALESCE(p_trigger_at, NOW()), p_recurrence_rule,
    COALESCE(p_is_read, FALSE), p_read_at, COALESCE(p_is_cleared, FALSE), p_cleared_at,
    v_sync_rev, NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    reminder_id = EXCLUDED.reminder_id,
    target_type = EXCLUDED.target_type,
    target_id = EXCLUDED.target_id,
    note_id = EXCLUDED.note_id,
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    trigger_at = EXCLUDED.trigger_at,
    recurrence_rule = EXCLUDED.recurrence_rule,
    is_read = EXCLUDED.is_read,
    read_at = EXCLUDED.read_at,
    is_cleared = EXCLUDED.is_cleared,
    cleared_at = EXCLUDED.cleared_at,
    sync_rev = EXCLUDED.sync_rev,
    updated_at = NOW()
  WHERE in_app_notifications.user_id = v_user_id;

  -- Guard against cross-tenant PK collision: re-mint ID for current tenant
  IF NOT FOUND THEN
    v_notif_id := gen_random_uuid()::text;
    INSERT INTO in_app_notifications (
      id, user_id, reminder_id, target_type, target_id, note_id,
      title, body, trigger_at, recurrence_rule,
      is_read, read_at, is_cleared, cleared_at,
      sync_rev, created_at, updated_at
    ) VALUES (
      v_notif_id, v_user_id, p_reminder_id, v_target_type, p_target_id, p_note_id,
      COALESCE(p_title, 'Notification'), COALESCE(p_body, ''), COALESCE(p_trigger_at, NOW()), p_recurrence_rule,
      COALESCE(p_is_read, FALSE), p_read_at, COALESCE(p_is_cleared, FALSE), p_cleared_at,
      v_sync_rev, NOW(), NOW()
    );
  END IF;

  SELECT row_to_json(n)::jsonb INTO v_result
  FROM in_app_notifications n
  WHERE n.id = v_notif_id AND n.user_id = v_user_id;

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_sync_rev, 'in_app_notification', v_notif_id, 'insert',
    COALESCE(v_result, jsonb_build_object(
      'id', v_notif_id,
      'target_type', v_target_type,
      'target_id', p_target_id,
      'title', COALESCE(p_title, 'Notification'),
      'body', COALESCE(p_body, ''),
      'trigger_at', COALESCE(p_trigger_at, NOW()),
      'is_read', COALESCE(p_is_read, FALSE),
      'is_cleared', COALESCE(p_is_cleared, FALSE)
    )),
    p_caller_platform, NOW()
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_mark_notifications_read(
  p_id TEXT DEFAULT NULL,
  p_is_read BOOLEAN DEFAULT TRUE,
  p_caller_platform TEXT DEFAULT 'local_client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_sync_rev BIGINT;
  v_is_read BOOLEAN := COALESCE(p_is_read, TRUE);
  v_read_at TIMESTAMPTZ := CASE WHEN COALESCE(p_is_read, TRUE) THEN NOW() ELSE NULL END;
  v_updated INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  IF p_id IS NULL OR p_id = 'all' THEN
    UPDATE in_app_notifications
    SET is_read = v_is_read,
        read_at = v_read_at,
        sync_rev = v_sync_rev,
        updated_at = NOW()
    WHERE user_id = v_user_id AND is_cleared = FALSE;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    INSERT INTO sync_changelog (
      id, user_id, sync_rev, entity_type, entity_id, change_type,
      delta_payload, caller_platform, created_at
    ) VALUES (
      gen_random_uuid()::text, v_user_id, v_sync_rev, 'in_app_notification', 'all', 'update',
      jsonb_build_object('action', 'mark_all_read', 'is_read', v_is_read, 'read_at', v_read_at),
      p_caller_platform, NOW()
    );
  ELSE
    UPDATE in_app_notifications
    SET is_read = v_is_read,
        read_at = v_read_at,
        sync_rev = v_sync_rev,
        updated_at = NOW()
    WHERE id = p_id AND user_id = v_user_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    INSERT INTO sync_changelog (
      id, user_id, sync_rev, entity_type, entity_id, change_type,
      delta_payload, caller_platform, created_at
    ) VALUES (
      gen_random_uuid()::text, v_user_id, v_sync_rev, 'in_app_notification', p_id, 'update',
      jsonb_build_object('id', p_id, 'action', 'mark_read', 'is_read', v_is_read, 'read_at', v_read_at),
      p_caller_platform, NOW()
    );
  END IF;

  RETURN jsonb_build_object('updated', v_updated, 'is_read', v_is_read, 'sync_rev', v_sync_rev);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_delete_in_app_notification(
  p_id TEXT DEFAULT NULL,
  p_caller_platform TEXT DEFAULT 'local_client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_sync_rev BIGINT;
  v_cleared_at TIMESTAMPTZ := NOW();
  v_updated INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  IF p_id IS NULL OR p_id = 'all' THEN
    UPDATE in_app_notifications
    SET is_cleared = TRUE,
        cleared_at = v_cleared_at,
        sync_rev = v_sync_rev,
        updated_at = NOW()
    WHERE user_id = v_user_id AND is_cleared = FALSE;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    INSERT INTO sync_changelog (
      id, user_id, sync_rev, entity_type, entity_id, change_type,
      delta_payload, caller_platform, created_at
    ) VALUES (
      gen_random_uuid()::text, v_user_id, v_sync_rev, 'in_app_notification', 'all', 'delete',
      jsonb_build_object('action', 'clear_all', 'is_cleared', TRUE, 'cleared_at', v_cleared_at),
      p_caller_platform, NOW()
    );
  ELSE
    UPDATE in_app_notifications
    SET is_cleared = TRUE,
        cleared_at = v_cleared_at,
        sync_rev = v_sync_rev,
        updated_at = NOW()
    WHERE id = p_id AND user_id = v_user_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    INSERT INTO sync_changelog (
      id, user_id, sync_rev, entity_type, entity_id, change_type,
      delta_payload, caller_platform, created_at
    ) VALUES (
      gen_random_uuid()::text, v_user_id, v_sync_rev, 'in_app_notification', p_id, 'delete',
      jsonb_build_object('id', p_id, 'action', 'clear', 'is_cleared', TRUE, 'cleared_at', v_cleared_at),
      p_caller_platform, NOW()
    );
  END IF;

  RETURN jsonb_build_object('cleared', v_updated, 'sync_rev', v_sync_rev);
END;
$$;

-- =============================================================================
-- 8. RPCs: Search History Sync (Gap 6)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_upsert_search_history(
  p_query_text TEXT,
  p_source TEXT DEFAULT 'text',
  p_filter_snapshot JSONB DEFAULT '{}'::jsonb,
  p_id TEXT DEFAULT NULL,
  p_use_count INTEGER DEFAULT NULL,
  p_last_used_at TIMESTAMPTZ DEFAULT NULL,
  p_caller_platform TEXT DEFAULT 'local_client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_clean_query TEXT := trim(COALESCE(p_query_text, ''));
  v_source TEXT := CASE WHEN p_source IN ('text', 'voice', 'ai') THEN p_source ELSE 'text' END;
  v_sync_rev BIGINT;
  v_existing_id TEXT;
  v_existing_count INTEGER;
  v_row_id TEXT;
  v_change_type TEXT := 'insert';
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  IF length(v_clean_query) < 2 THEN
    RETURN NULL;
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  SELECT id, use_count INTO v_existing_id, v_existing_count
  FROM search_history
  WHERE user_id = v_user_id AND lower(query_text) = lower(v_clean_query)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    v_row_id := v_existing_id;
    v_change_type := 'update';
    UPDATE search_history
    SET query_text = v_clean_query,
        source = v_source,
        filter_snapshot_json = COALESCE(p_filter_snapshot, '{}'::jsonb),
        use_count = GREATEST(COALESCE(v_existing_count, 1) + 1, COALESCE(p_use_count, 1)),
        sync_rev = v_sync_rev,
        last_used_at = COALESCE(p_last_used_at, NOW())
    WHERE id = v_existing_id AND user_id = v_user_id;
  ELSE
    v_row_id := COALESCE(p_id, gen_random_uuid()::text);
    INSERT INTO search_history (
      id, user_id, query_text, source, filter_snapshot_json,
      use_count, sync_rev, created_at, last_used_at
    ) VALUES (
      v_row_id, v_user_id, v_clean_query, v_source, COALESCE(p_filter_snapshot, '{}'::jsonb),
      GREATEST(COALESCE(p_use_count, 1), 1), v_sync_rev, NOW(), COALESCE(p_last_used_at, NOW())
    )
    ON CONFLICT (id) DO UPDATE SET
      query_text = EXCLUDED.query_text,
      source = EXCLUDED.source,
      filter_snapshot_json = EXCLUDED.filter_snapshot_json,
      use_count = GREATEST(search_history.use_count + 1, EXCLUDED.use_count),
      sync_rev = EXCLUDED.sync_rev,
      last_used_at = EXCLUDED.last_used_at
    WHERE search_history.user_id = v_user_id;

    -- Guard against cross-tenant PK collision: re-mint ID for current tenant
    IF NOT FOUND THEN
      v_row_id := gen_random_uuid()::text;
      INSERT INTO search_history (
        id, user_id, query_text, source, filter_snapshot_json,
        use_count, sync_rev, created_at, last_used_at
      ) VALUES (
        v_row_id, v_user_id, v_clean_query, v_source, COALESCE(p_filter_snapshot, '{}'::jsonb),
        GREATEST(COALESCE(p_use_count, 1), 1), v_sync_rev, NOW(), COALESCE(p_last_used_at, NOW())
      );
    END IF;
  END IF;

  SELECT row_to_json(sh)::jsonb INTO v_result
  FROM search_history sh
  WHERE sh.id = v_row_id AND sh.user_id = v_user_id;

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_sync_rev, 'search_history', v_row_id, v_change_type,
    COALESCE(v_result, jsonb_build_object(
      'id', v_row_id,
      'query_text', v_clean_query,
      'source', v_source,
      'filter_snapshot_json', COALESCE(p_filter_snapshot, '{}'::jsonb),
      'use_count', GREATEST(COALESCE(p_use_count, 1), 1),
      'last_used_at', COALESCE(p_last_used_at, NOW())
    )),
    p_caller_platform, NOW()
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_delete_search_history(
  p_query_text TEXT DEFAULT NULL,
  p_id TEXT DEFAULT NULL,
  p_caller_platform TEXT DEFAULT 'local_client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_sync_rev BIGINT;
  v_deleted INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  IF (p_query_text IS NULL OR trim(p_query_text) = '') AND (p_id IS NULL OR p_id = 'all') THEN
    DELETE FROM search_history WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    INSERT INTO sync_changelog (
      id, user_id, sync_rev, entity_type, entity_id, change_type,
      delta_payload, caller_platform, created_at
    ) VALUES (
      gen_random_uuid()::text, v_user_id, v_sync_rev, 'search_history', 'all', 'delete',
      jsonb_build_object('action', 'clear_all', 'cleared_at', NOW()),
      p_caller_platform, NOW()
    );
  ELSE
    DELETE FROM search_history
    WHERE user_id = v_user_id
      AND (
        (p_id IS NOT NULL AND id = p_id)
        OR (p_query_text IS NOT NULL AND lower(query_text) = lower(trim(p_query_text)))
      );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    INSERT INTO sync_changelog (
      id, user_id, sync_rev, entity_type, entity_id, change_type,
      delta_payload, caller_platform, created_at
    ) VALUES (
      gen_random_uuid()::text, v_user_id, v_sync_rev, 'search_history', COALESCE(p_id, trim(p_query_text)), 'delete',
      jsonb_build_object('id', p_id, 'query_text', p_query_text),
      p_caller_platform, NOW()
    );
  END IF;

  RETURN jsonb_build_object('deleted', v_deleted, 'sync_rev', v_sync_rev);
END;
$$;

-- =============================================================================
-- 9. RPCs: Knowledge Graph Entity Relations Sync (Gap 7)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_upsert_entity_relation(
  p_id TEXT,
  p_source_id TEXT,
  p_target_id TEXT,
  p_relation_type TEXT,
  p_created_by TEXT DEFAULT 'user',
  p_confidence_score REAL DEFAULT 1.0,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_caller_platform TEXT DEFAULT 'local_client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_rel_type TEXT := CASE
    WHEN p_relation_type IN ('relates_to', 'supersedes', 'derived_from', 'part_of', 'contradicts') THEN p_relation_type
    ELSE 'relates_to'
  END;
  v_created_by TEXT := CASE WHEN p_created_by IN ('user', 'friday_ai') THEN p_created_by ELSE 'user' END;
  v_sync_rev BIGINT;
  v_existing_id TEXT;
  v_row_id TEXT;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  SELECT id INTO v_existing_id
  FROM entity_relations
  WHERE user_id = v_user_id
    AND source_id = p_source_id
    AND relation_type = v_rel_type
    AND target_id = p_target_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    v_row_id := v_existing_id;
    UPDATE entity_relations
    SET created_by = v_created_by,
        confidence_score = COALESCE(p_confidence_score, 1.0)
    WHERE id = v_existing_id AND user_id = v_user_id;
  ELSE
    v_row_id := COALESCE(p_id, gen_random_uuid()::text);
    INSERT INTO entity_relations (
      id, user_id, source_id, relation_type, target_id,
      created_by, confidence_score, created_at
    ) VALUES (
      v_row_id, v_user_id, p_source_id, v_rel_type, p_target_id,
      v_created_by, COALESCE(p_confidence_score, 1.0), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      source_id = EXCLUDED.source_id,
      relation_type = EXCLUDED.relation_type,
      target_id = EXCLUDED.target_id,
      created_by = EXCLUDED.created_by,
      confidence_score = EXCLUDED.confidence_score
    WHERE entity_relations.user_id = v_user_id;

    -- Guard against cross-tenant PK collision: re-mint ID for current tenant
    IF NOT FOUND THEN
      v_row_id := gen_random_uuid()::text;
      INSERT INTO entity_relations (
        id, user_id, source_id, relation_type, target_id,
        created_by, confidence_score, created_at
      ) VALUES (
        v_row_id, v_user_id, p_source_id, v_rel_type, p_target_id,
        v_created_by, COALESCE(p_confidence_score, 1.0), NOW()
      );
    END IF;
  END IF;

  SELECT row_to_json(er)::jsonb INTO v_result
  FROM entity_relations er
  WHERE er.id = v_row_id AND er.user_id = v_user_id;

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_sync_rev, 'relation', v_row_id, 'insert',
    COALESCE(v_result, jsonb_build_object(
      'id', v_row_id,
      'source_id', p_source_id,
      'target_id', p_target_id,
      'relation_type', v_rel_type,
      'created_by', v_created_by,
      'confidence_score', COALESCE(p_confidence_score, 1.0)
    )) || jsonb_build_object('metadata', COALESCE(p_metadata, '{}'::jsonb)),
    p_caller_platform, NOW()
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_delete_entity_relation(
  p_id TEXT,
  p_caller_platform TEXT DEFAULT 'local_client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_sync_rev BIGINT;
  v_deleted INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  DELETE FROM entity_relations WHERE id = p_id AND user_id = v_user_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_sync_rev, 'relation', p_id, 'delete',
    jsonb_build_object('id', p_id),
    p_caller_platform, NOW()
  );

  RETURN jsonb_build_object('deleted', v_deleted > 0, 'id', p_id, 'sync_rev', v_sync_rev);
END;
$$;

-- Notify PostgREST to reload the schema cache so updated RPC signatures take effect immediately
NOTIFY pgrst, 'reload schema';
