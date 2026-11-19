-- =============================================================================
-- ScribeX Multi-Device Sync Edge-Case Hardening Migration
-- Migration: 005_sync_edge_case_hardening.sql
-- Resolves 3 remaining sync edge cases:
--   1. Recursive subfolder tree cloning in rpc_duplicate_folder_cascade
--   2. Active task reminder deduplication + cross-tenant PK guard in rpc_create_task
--   3. Cross-tenant PK collision IF NOT FOUND guard in rpc_upsert_folder
-- =============================================================================

-- =============================================================================
-- 1. RPC: Upsert Folder (Cross-Tenant PK Collision Safe)
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

  -- Guard against cross-tenant PK collisions (e.g. deterministic seed folder IDs):
  -- Return NULL without emitting a phantom sync_changelog row so the client re-mints a unique ID.
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

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
-- 2. RPC: Create / Upsert Task (Deduplicates Active Reminders & Cross-Tenant PK Guard)
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
  v_existing_rem_id TEXT := NULL;
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

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Deduplicate active task reminders: update existing active reminder in-place instead of inserting duplicates
  IF p_reminder_at IS NOT NULL THEN
    SELECT id INTO v_existing_rem_id
    FROM reminders
    WHERE user_id = v_user_id
      AND target_type = 'task'
      AND target_id = v_task_id
      AND is_dismissed = FALSE
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_existing_rem_id IS NOT NULL THEN
      UPDATE reminders
      SET note_id = COALESCE(p_note_id, note_id),
          trigger_at = p_reminder_at,
          title = p_title,
          body = 'Task Due: ' || p_title,
          recurrence_rule = p_recurrence_rule,
          caller_platform = p_caller_platform,
          sync_rev = v_sync_rev,
          updated_at = NOW()
      WHERE id = v_existing_rem_id AND user_id = v_user_id;
    ELSE
      INSERT INTO reminders (
        id, user_id, target_type, target_id, note_id, trigger_at,
        title, body, recurrence_rule, caller_platform, sync_rev, created_at, updated_at
      ) VALUES (
        gen_random_uuid()::text, v_user_id, 'task', v_task_id, p_note_id,
        p_reminder_at, p_title, 'Task Due: ' || p_title, p_recurrence_rule, p_caller_platform, v_sync_rev, NOW(), NOW()
      );
    END IF;
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
-- 3. RPC: Recursive Server-Side Folder Duplicate Cascade
-- Clones root folder, entire descendant subfolder tree, and ALL non-trashed
-- notes across every folder in the tree with full blocks_json & note_tags.
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
  v_sub RECORD;
  v_sub_new_id TEXT;
  v_sub_new_path TEXT;
  v_sub_parent_id TEXT;
  v_sub_rev BIGINT;
  v_sub_json JSONB;
  v_folder_id_map JSONB := '{}'::jsonb;
  v_folder_path_to_id JSONB := '{}'::jsonb;
  v_cloned_folders JSONB := '[]'::jsonb;
  v_note RECORD;
  v_note_target_folder_id TEXT;
  v_note_target_path TEXT;
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

  -- Prevent cross-tenant PK collision on new root folder ID
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

  v_cloned_folders := v_cloned_folders || COALESCE(v_folder_json, '{}'::jsonb);
  IF v_has_src_folder THEN
    v_folder_id_map := jsonb_set(v_folder_id_map, ARRAY[v_src_folder.id], to_jsonb(v_new_folder_id));
  END IF;
  IF p_source_folder_id IS NOT NULL THEN
    v_folder_id_map := jsonb_set(v_folder_id_map, ARRAY[p_source_folder_id], to_jsonb(v_new_folder_id));
  END IF;
  IF v_clean_source <> '' THEN
    v_folder_path_to_id := jsonb_set(v_folder_path_to_id, ARRAY[v_clean_source], to_jsonb(v_new_folder_id));
  END IF;

  INSERT INTO sync_changelog (
    id, user_id, sync_rev, entity_type, entity_id, change_type,
    delta_payload, caller_platform, created_at
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_folder_rev, 'folder', v_new_folder_id, 'insert',
    COALESCE(v_folder_json, jsonb_build_object('id', v_new_folder_id, 'name', v_final_name, 'path', v_target_path)),
    p_caller_platform, NOW()
  );

  -- Recursively clone descendant subfolders shallow-to-deep (exact prefix match, wildcard-safe)
  IF v_clean_source <> '' THEN
    FOR v_sub IN
      SELECT *
      FROM folders
      WHERE user_id = v_user_id
        AND left(path, length(v_clean_source) + 1) = v_clean_source || '/'
      ORDER BY length(path) ASC, path ASC
    LOOP
      v_sub_new_id := 'folder-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
      v_sub_new_path := v_target_path || substr(v_sub.path, length(v_clean_source) + 1);
      v_sub_parent_id := COALESCE(
        v_folder_id_map ->> COALESCE(v_sub.parent_id, ''),
        v_new_folder_id
      );
      v_sub_rev := get_next_sync_rev(v_user_id);

      INSERT INTO folders (
        id, user_id, name, parent_id, path, color_token, icon, cover_image,
        is_favorite, is_pinned, is_archived,
        is_locked, lock_type, lock_credential_kind, lock_hash, lock_salt, lock_hint,
        ai_context_excluded, sync_rev, created_at, updated_at
      ) VALUES (
        v_sub_new_id, v_user_id, v_sub.name, v_sub_parent_id, v_sub_new_path,
        COALESCE(v_sub.color_token, 'cyan'), v_sub.icon, v_sub.cover_image,
        FALSE, FALSE, FALSE,
        COALESCE(v_sub.is_locked, FALSE), v_sub.lock_type, v_sub.lock_credential_kind,
        v_sub.lock_hash, v_sub.lock_salt, v_sub.lock_hint,
        COALESCE(v_sub.ai_context_excluded, FALSE), v_sub_rev, NOW(), NOW()
      );

      SELECT row_to_json(f)::jsonb INTO v_sub_json
      FROM folders f
      WHERE f.id = v_sub_new_id AND f.user_id = v_user_id;

      v_cloned_folders := v_cloned_folders || COALESCE(v_sub_json, '{}'::jsonb);
      v_folder_id_map := jsonb_set(v_folder_id_map, ARRAY[v_sub.id], to_jsonb(v_sub_new_id));
      v_folder_path_to_id := jsonb_set(v_folder_path_to_id, ARRAY[v_sub.path], to_jsonb(v_sub_new_id));

      INSERT INTO sync_changelog (
        id, user_id, sync_rev, entity_type, entity_id, change_type,
        delta_payload, caller_platform, created_at
      ) VALUES (
        gen_random_uuid()::text, v_user_id, v_sub_rev, 'folder', v_sub_new_id, 'insert',
        COALESCE(v_sub_json, jsonb_build_object('id', v_sub_new_id, 'name', v_sub.name, 'path', v_sub_new_path, 'parent_id', v_sub_parent_id)),
        p_caller_platform, NOW()
      );
    END LOOP;
  END IF;

  -- Clone all non-trashed notes in the root folder AND every descendant subfolder
  FOR v_note IN
    SELECT *
    FROM notes
    WHERE user_id = v_user_id
      AND status <> 'trashed'
      AND (
        (v_clean_source <> '' AND (folder_path = v_clean_source OR left(folder_path, length(v_clean_source) + 1) = v_clean_source || '/'))
        OR (p_source_folder_id IS NOT NULL AND folder_id = p_source_folder_id)
      )
    ORDER BY created_at ASC
  LOOP
    v_note_target_folder_id := COALESCE(
      v_folder_id_map ->> COALESCE(v_note.folder_id, ''),
      v_folder_path_to_id ->> COALESCE(v_note.folder_path, ''),
      v_new_folder_id
    );
    IF v_clean_source <> '' AND v_note.folder_path IS NOT NULL AND left(v_note.folder_path, length(v_clean_source) + 1) = v_clean_source || '/' THEN
      v_note_target_path := v_target_path || substr(v_note.folder_path, length(v_clean_source) + 1);
    ELSE
      v_note_target_path := v_target_path;
    END IF;

    v_cloned_note_id := 'note-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    v_cloned_title := CASE WHEN COALESCE(trim(v_note.title), '') <> '' THEN v_note.title || ' (Copy)' ELSE 'Untitled Note (Copy)' END;
    v_note_rev := get_next_sync_rev(v_user_id);

    INSERT INTO notes (
      id, user_id, folder_id, folder_path, group_name, title, content_markdown,
      blocks_json, color_token, is_favorite, is_pinned, status, priority_score,
      is_locked, lock_type, lock_credential_kind, lock_hash, lock_salt, lock_hint,
      ai_context_excluded, sync_rev, created_at, updated_at
    ) VALUES (
      v_cloned_note_id, v_user_id, v_note_target_folder_id, v_note_target_path, v_note.group_name,
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
        'folder_id', v_note_target_folder_id,
        'folder_path', v_note_target_path,
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

    v_cloned_notes := v_cloned_notes || jsonb_build_object(
      'id', v_cloned_note_id,
      'folder_id', v_note_target_folder_id,
      'folder_path', v_note_target_path,
      'title', v_cloned_title,
      'content_markdown', COALESCE(v_note.content_markdown, ''),
      'blocks_json', COALESCE(v_note.blocks_json, '[]'::jsonb),
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
      'tags', COALESCE(v_tags_json, '[]'::jsonb),
      'sync_rev', v_note_rev
    );
    v_duplicated_count := v_duplicated_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'folder', v_folder_json,
    'folders', v_cloned_folders,
    'notes', v_cloned_notes,
    'duplicated_notes_count', v_duplicated_count
  );
END;
$$;
