-- =============================================================================
-- ScribeX Core Supabase PostgreSQL Stored Procedures (RPCs)
-- Migration: 002_core_rpcs.sql
-- Source of Truth: docs/Unified_Backend_and_AI_Master_Specification.md (Section 3.2 & 5)
-- Purpose: Single Source of Action Pipeline Symmetry (Manual Client Sync + AI Tools)
-- =============================================================================

-- =============================================================================
-- 1. Helper Function: Get Next Monotonic Sync Revision for User
-- =============================================================================
CREATE OR REPLACE FUNCTION get_next_sync_rev(p_user_id TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_rev BIGINT;
BEGIN
  SELECT COALESCE(MAX(sync_rev), 0) + 1
  INTO v_next_rev
  FROM sync_changelog
  WHERE user_id = p_user_id;
  
  RETURN v_next_rev;
END;
$$;

-- =============================================================================
-- 2. RPC: Create / Upsert Note (Preserves Client ID, Lock State & AI Context Flag)
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

  -- Process Tags
  IF p_tags IS NOT NULL AND array_length(p_tags, 1) > 0 THEN
    DELETE FROM note_tags WHERE note_id = v_note_id;
    FOREACH v_tag_name IN ARRAY p_tags LOOP
      v_tag_name := lower(trim(v_tag_name));
      IF length(v_tag_name) > 0 THEN
        SELECT id INTO v_tag_id FROM tags WHERE user_id = v_user_id AND name = v_tag_name;
        IF v_tag_id IS NULL THEN
          v_tag_id := gen_random_uuid()::text;
          INSERT INTO tags (id, user_id, name, color_token) VALUES (v_tag_id, v_user_id, v_tag_name, 'cyan');
        END IF;
        INSERT INTO note_tags (note_id, tag_id) VALUES (v_note_id, v_tag_id) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Create Reminder if requested
  IF p_reminder_at IS NOT NULL THEN
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
      'ai_context_excluded', COALESCE(p_ai_context_excluded, FALSE)
    ),
    p_caller_platform, NOW()
  );

  SELECT row_to_json(n)::jsonb INTO v_result FROM notes n WHERE n.id = v_note_id AND n.user_id = v_user_id;
  RETURN v_result;
END;
$$;

-- =============================================================================
-- 3. RPC: Update Note (Full Update, Append Markdown, Lock & AI Privacy Toggle)
-- =============================================================================
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
  p_lock_hint TEXT DEFAULT NULL
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
      folder_id = COALESCE(p_folder_id, folder_id),
      folder_path = COALESCE(p_folder_path, folder_path),
      color_token = COALESCE(p_color_token, color_token),
      is_favorite = COALESCE(p_is_favorite, is_favorite),
      is_pinned = COALESCE(p_is_pinned, is_pinned),
      status = COALESCE(p_status, status),
      reminder_at = COALESCE(p_reminder_at, reminder_at),
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
    FOREACH v_tag_name IN ARRAY p_tags LOOP
      v_tag_name := lower(trim(v_tag_name));
      IF length(v_tag_name) > 0 THEN
        SELECT id INTO v_tag_id FROM tags WHERE user_id = v_user_id AND name = v_tag_name;
        IF v_tag_id IS NULL THEN
          v_tag_id := gen_random_uuid()::text;
          INSERT INTO tags (id, user_id, name, color_token) VALUES (v_tag_id, v_user_id, v_tag_name, 'cyan');
        END IF;
        INSERT INTO note_tags (note_id, tag_id) VALUES (p_note_id, v_tag_id) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

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
      'ai_context_excluded', v_note.ai_context_excluded
    ),
    p_caller_platform, NOW()
  );

  SELECT row_to_json(n)::jsonb INTO v_result FROM notes n WHERE n.id = p_note_id AND n.user_id = v_user_id;
  RETURN v_result;
END;
$$;

-- =============================================================================
-- 4. RPC: Upsert Folder (Preserves Client ID, Flags, Lock State & AI Context Flag)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_upsert_folder(
  p_id TEXT,
  p_name TEXT,
  p_path TEXT,
  p_parent_id TEXT DEFAULT NULL,
  p_color_token TEXT DEFAULT 'apricot',
  p_icon TEXT DEFAULT NULL,
  p_cover_image TEXT DEFAULT NULL,
  p_is_favorite BOOLEAN DEFAULT FALSE,
  p_is_pinned BOOLEAN DEFAULT FALSE,
  p_is_archived BOOLEAN DEFAULT FALSE,
  p_ai_context_excluded BOOLEAN DEFAULT FALSE,
  p_caller_platform TEXT DEFAULT 'local_client',
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
  v_folder_id TEXT := COALESCE(p_id, gen_random_uuid()::text);
  v_sync_rev BIGINT;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  INSERT INTO folders (
    id, user_id, name, parent_id, path, color_token, icon, cover_image,
    is_favorite, is_pinned, is_archived,
    is_locked, lock_type, lock_credential_kind, lock_hash, lock_salt, lock_hint,
    ai_context_excluded, sync_rev, created_at, updated_at
  ) VALUES (
    v_folder_id, v_user_id, p_name, p_parent_id, p_path, COALESCE(p_color_token, 'apricot'), p_icon, p_cover_image,
    COALESCE(p_is_favorite, FALSE), COALESCE(p_is_pinned, FALSE), COALESCE(p_is_archived, FALSE),
    COALESCE(p_is_locked, FALSE), p_lock_type, p_lock_credential_kind, p_lock_hash, p_lock_salt, p_lock_hint,
    COALESCE(p_ai_context_excluded, FALSE), v_sync_rev, NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    path = EXCLUDED.path,
    color_token = EXCLUDED.color_token,
    icon = EXCLUDED.icon,
    cover_image = EXCLUDED.cover_image,
    is_favorite = EXCLUDED.is_favorite,
    is_pinned = EXCLUDED.is_pinned,
    is_archived = EXCLUDED.is_archived,
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

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_sync_rev, 'folder', v_folder_id, 'update',
    jsonb_build_object(
      'id', v_folder_id,
      'name', p_name,
      'parent_id', p_parent_id,
      'path', p_path,
      'color_token', COALESCE(p_color_token, 'apricot'),
      'icon', p_icon,
      'is_favorite', COALESCE(p_is_favorite, FALSE),
      'is_pinned', COALESCE(p_is_pinned, FALSE),
      'is_archived', COALESCE(p_is_archived, FALSE),
      'is_locked', COALESCE(p_is_locked, FALSE),
      'lock_type', p_lock_type,
      'lock_credential_kind', p_lock_credential_kind,
      'lock_hash', p_lock_hash,
      'lock_salt', p_lock_salt,
      'lock_hint', p_lock_hint,
      'ai_context_excluded', COALESCE(p_ai_context_excluded, FALSE)
    ),
    p_caller_platform, NOW()
  );

  SELECT row_to_json(f)::jsonb INTO v_result FROM folders f WHERE f.id = v_folder_id AND f.user_id = v_user_id;
  RETURN v_result;
END;
$$;

-- =============================================================================
-- 5. RPC: Create / Upsert Task (Preserves Client ID & Recurrence)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_create_task(
  p_title TEXT,
  p_priority TEXT DEFAULT 'none',
  p_due_date TEXT DEFAULT NULL,
  p_reminder_at TIMESTAMPTZ DEFAULT NULL,
  p_note_id TEXT DEFAULT NULL,
  p_caller_platform TEXT DEFAULT 'local_client',
  p_id TEXT DEFAULT NULL,
  p_recurrence_rule TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_task_id TEXT := COALESCE(p_id, gen_random_uuid()::text);
  v_sync_rev BIGINT;
  v_note_title TEXT := NULL;
  v_note_color TEXT := NULL;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  IF p_note_id IS NOT NULL THEN
    SELECT title, color_token INTO v_note_title, v_note_color FROM notes WHERE id = p_note_id AND user_id = v_user_id;
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  INSERT INTO tasks (
    id, user_id, note_id, note_title, note_color_token,
    title, is_completed, priority, due_date, reminder_at, recurrence_rule, sync_rev, created_at, updated_at
  ) VALUES (
    v_task_id, v_user_id, p_note_id, v_note_title, v_note_color,
    p_title, FALSE, p_priority, p_due_date, p_reminder_at, p_recurrence_rule, v_sync_rev, NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    priority = EXCLUDED.priority,
    due_date = EXCLUDED.due_date,
    reminder_at = EXCLUDED.reminder_at,
    recurrence_rule = EXCLUDED.recurrence_rule,
    sync_rev = EXCLUDED.sync_rev,
    updated_at = NOW()
  WHERE tasks.user_id = v_user_id;

  IF p_reminder_at IS NOT NULL THEN
    INSERT INTO reminders (
      id, user_id, target_type, target_id, note_id, trigger_at,
      title, body, recurrence_rule, caller_platform, sync_rev, created_at, updated_at
    ) VALUES (
      gen_random_uuid()::text, v_user_id, 'task', v_task_id, p_note_id,
      p_reminder_at, p_title, 'Task Due: ' || p_title, p_recurrence_rule, p_caller_platform, v_sync_rev, NOW(), NOW()
    );
  END IF;

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_sync_rev, 'task', v_task_id, 'insert',
    jsonb_build_object(
      'id', v_task_id,
      'title', p_title,
      'priority', p_priority,
      'due_date', p_due_date,
      'reminder_at', p_reminder_at,
      'recurrence_rule', p_recurrence_rule,
      'note_id', p_note_id
    ),
    p_caller_platform, NOW()
  );

  SELECT row_to_json(t)::jsonb INTO v_result FROM tasks t WHERE t.id = v_task_id AND t.user_id = v_user_id;
  RETURN v_result;
END;
$$;

-- =============================================================================
-- 6. RPC: Toggle Task Completion (With Automatic Hardware Alarm Dismissal)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_toggle_task(
  p_task_id TEXT,
  p_is_completed BOOLEAN,
  p_caller_platform TEXT DEFAULT 'local_client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_sync_rev BIGINT;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  UPDATE tasks
  SET is_completed = p_is_completed,
      sync_rev = v_sync_rev,
      updated_at = NOW()
  WHERE id = p_task_id AND user_id = v_user_id;

  IF p_is_completed = TRUE THEN
    UPDATE reminders
    SET is_dismissed = TRUE,
        dismissed_at = NOW(),
        sync_rev = v_sync_rev,
        updated_at = NOW()
    WHERE target_id = p_task_id AND user_id = v_user_id AND is_dismissed = FALSE;
  END IF;

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_sync_rev, 'task', p_task_id, 'update',
    jsonb_build_object('id', p_task_id, 'is_completed', p_is_completed),
    p_caller_platform, NOW()
  );

  SELECT row_to_json(t)::jsonb INTO v_result FROM tasks t WHERE t.id = p_task_id AND t.user_id = v_user_id;
  RETURN v_result;
END;
$$;

-- =============================================================================
-- 7. RPC: Schedule Hardware Reminder (Preserves Client ID & Recurrence)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_schedule_reminder(
  p_target_type TEXT,
  p_target_id TEXT,
  p_trigger_at TIMESTAMPTZ,
  p_title TEXT DEFAULT 'Reminder',
  p_body TEXT DEFAULT '',
  p_caller_platform TEXT DEFAULT 'local_client',
  p_id TEXT DEFAULT NULL,
  p_recurrence_rule TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_reminder_id TEXT := COALESCE(p_id, gen_random_uuid()::text);
  v_sync_rev BIGINT;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  INSERT INTO reminders (
    id, user_id, target_type, target_id, trigger_at,
    title, body, recurrence_rule, caller_platform, sync_rev, created_at, updated_at
  ) VALUES (
    v_reminder_id, v_user_id, p_target_type, p_target_id, p_trigger_at,
    p_title, p_body, p_recurrence_rule, p_caller_platform, v_sync_rev, NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    trigger_at = EXCLUDED.trigger_at,
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    recurrence_rule = EXCLUDED.recurrence_rule,
    is_dismissed = FALSE,
    sync_rev = EXCLUDED.sync_rev,
    updated_at = NOW()
  WHERE reminders.user_id = v_user_id;

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_sync_rev, 'reminder', v_reminder_id, 'insert',
    jsonb_build_object(
      'id', v_reminder_id,
      'target_type', p_target_type,
      'target_id', p_target_id,
      'trigger_at', p_trigger_at,
      'title', p_title,
      'recurrence_rule', p_recurrence_rule
    ),
    p_caller_platform, NOW()
  );

  SELECT row_to_json(r)::jsonb INTO v_result FROM reminders r WHERE r.id = v_reminder_id AND r.user_id = v_user_id;
  RETURN v_result;
END;
$$;

-- =============================================================================
-- 8. RPC: Upsert Workspace Security (Syncs Master PIN/Password; Excludes Biometrics)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_upsert_workspace_security(
  p_app_lock_enabled BOOLEAN,
  p_master_credential_type TEXT DEFAULT NULL,
  p_master_hash TEXT DEFAULT NULL,
  p_master_salt TEXT DEFAULT NULL,
  p_master_hint TEXT DEFAULT NULL,
  p_auto_relock_seconds INTEGER DEFAULT 0,
  p_caller_platform TEXT DEFAULT 'local_client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_sync_rev BIGINT;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  INSERT INTO workspace_security (
    user_id, app_lock_enabled, master_credential_type, master_hash,
    master_salt, master_hint, auto_relock_seconds, sync_rev, updated_at
  ) VALUES (
    v_user_id, COALESCE(p_app_lock_enabled, FALSE), p_master_credential_type,
    p_master_hash, p_master_salt, p_master_hint, COALESCE(p_auto_relock_seconds, 0), v_sync_rev, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    app_lock_enabled = EXCLUDED.app_lock_enabled,
    master_credential_type = EXCLUDED.master_credential_type,
    master_hash = EXCLUDED.master_hash,
    master_salt = EXCLUDED.master_salt,
    master_hint = EXCLUDED.master_hint,
    auto_relock_seconds = EXCLUDED.auto_relock_seconds,
    sync_rev = EXCLUDED.sync_rev,
    updated_at = NOW();

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_sync_rev, 'workspace_security', v_user_id, 'update',
    jsonb_build_object(
      'app_lock_enabled', p_app_lock_enabled,
      'master_credential_type', p_master_credential_type,
      'master_hash', p_master_hash,
      'master_salt', p_master_salt,
      'master_hint', p_master_hint,
      'auto_relock_seconds', p_auto_relock_seconds
    ),
    p_caller_platform, NOW()
  );

  SELECT row_to_json(ws)::jsonb INTO v_result FROM workspace_security ws WHERE ws.user_id = v_user_id;
  RETURN v_result;
END;
$$;

-- =============================================================================
-- 9. RPC: Search Vault (Enforces AI Context Exclusion & Locked Note/Folder Privacy)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_search_vault(
  p_query TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  SELECT json_agg(row_to_json(matches))::jsonb INTO v_result
  FROM (
    SELECT 
      n.id,
      n.title,
      n.folder_path,
      n.color_token,
      n.updated_at,
      ts_rank(to_tsvector('english', n.title || ' ' || n.content_markdown), websearch_to_tsquery('english', p_query)) AS rank
    FROM notes n
    LEFT JOIN folders f ON f.id = n.folder_id AND f.user_id = v_user_id
    WHERE n.user_id = v_user_id
      AND n.status = 'active'
      AND n.is_locked = FALSE
      AND n.ai_context_excluded = FALSE
      AND COALESCE(f.is_locked, FALSE) = FALSE
      AND COALESCE(f.ai_context_excluded, FALSE) = FALSE
      AND to_tsvector('english', n.title || ' ' || n.content_markdown) @@ websearch_to_tsquery('english', p_query)
    ORDER BY rank DESC, n.updated_at DESC
    LIMIT p_limit
  ) matches;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- =============================================================================
-- 10. RPC: List Notes Paginated (Lightweight Card Previews — Omits Heavy blocks_json)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_list_notes_paginated(
  p_status TEXT DEFAULT 'active',
  p_folder_id TEXT DEFAULT NULL,
  p_folder_path TEXT DEFAULT NULL,
  p_is_favorite BOOLEAN DEFAULT NULL,
  p_search_query TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  SELECT json_agg(row_to_json(cards))::jsonb INTO v_result
  FROM (
    SELECT
      n.id,
      n.user_id,
      n.folder_id,
      n.folder_path,
      n.group_name,
      n.title,
      LEFT(COALESCE(n.content_markdown, ''), 240) AS content_markdown,
      '[]'::jsonb AS blocks_json,
      n.color_token,
      n.is_favorite,
      n.is_pinned,
      n.status,
      n.priority_score,
      n.reminder_at,
      n.is_locked,
      n.lock_type,
      n.lock_credential_kind,
      n.lock_hash,
      n.lock_salt,
      n.lock_hint,
      n.ai_context_excluded,
      n.sync_rev,
      n.created_at,
      n.updated_at,
      n.trashed_at,
      COALESCE(
        (
          SELECT json_agg(t.name)
          FROM note_tags nt
          INNER JOIN tags t ON t.id = nt.tag_id
          WHERE nt.note_id = n.id
        ),
        '[]'::json
      ) AS tags
    FROM notes n
    WHERE n.user_id = v_user_id
      AND (p_status IS NULL OR n.status = p_status)
      AND (p_folder_id IS NULL OR n.folder_id = p_folder_id)
      AND (p_folder_path IS NULL OR n.folder_path = p_folder_path OR n.folder_path LIKE p_folder_path || '/%')
      AND (p_is_favorite IS NULL OR n.is_favorite = p_is_favorite)
      AND (
        p_search_query IS NULL
        OR trim(p_search_query) = ''
        OR n.title ILIKE '%' || trim(p_search_query) || '%'
        OR n.content_markdown ILIKE '%' || trim(p_search_query) || '%'
      )
    ORDER BY n.is_pinned DESC, n.updated_at DESC
    LIMIT GREATEST(COALESCE(p_limit, 20), 1)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ) cards;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- =============================================================================
-- 11. RPC: Get Full Note By ID (On-Demand Editor Hydration with Full blocks_json)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_get_note_by_id(
  p_note_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  SELECT row_to_json(full_note)::jsonb INTO v_result
  FROM (
    SELECT
      n.*,
      COALESCE(
        (
          SELECT json_agg(t.name)
          FROM note_tags nt
          INNER JOIN tags t ON t.id = nt.tag_id
          WHERE nt.note_id = n.id
        ),
        '[]'::json
      ) AS tags
    FROM notes n
    WHERE n.id = p_note_id AND n.user_id = v_user_id
    LIMIT 1
  ) full_note;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- 12. RPC: Delete Entity Permanently (Notes, Folders, Tasks, Reminders)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpc_delete_entity(
  p_entity_type TEXT,
  p_entity_id TEXT,
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

  IF p_entity_type = 'note' THEN
    DELETE FROM notes WHERE id = p_entity_id AND user_id = v_user_id;
  ELSIF p_entity_type = 'folder' THEN
    DELETE FROM folders WHERE id = p_entity_id AND user_id = v_user_id;
  ELSIF p_entity_type = 'task' THEN
    DELETE FROM tasks WHERE id = p_entity_id AND user_id = v_user_id;
  ELSIF p_entity_type = 'reminder' THEN
    DELETE FROM reminders WHERE id = p_entity_id AND user_id = v_user_id;
  ELSE
    RAISE EXCEPTION 'Unsupported entity_type for deletion: %', p_entity_type;
  END IF;

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_sync_rev, p_entity_type, p_entity_id, 'delete',
    jsonb_build_object('id', p_entity_id),
    p_caller_platform, NOW()
  );

  RETURN jsonb_build_object('deleted', TRUE, 'id', p_entity_id, 'entity_type', p_entity_type, 'sync_rev', v_sync_rev);
END;
$$;
