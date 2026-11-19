-- =============================================================================
-- ScribeX Migration 006: Deduplicate Active Reminders & In-App Notifications
-- Purpose:
--   1. Remove duplicate active reminders per (user_id, target_type, target_id)
--      that caused reconcileFiredReminders() to re-create unread notifications
--      every 10 seconds across devices.
--   2. Remove duplicate in_app_notifications per (user_id, target_type, target_id).
--   3. Harden rpc_schedule_reminder to update an existing active reminder for
--      (user_id, target_type, target_id) in-place instead of creating duplicates.
-- =============================================================================

-- 1. Clean up existing duplicate active reminders (retain newest per target)
WITH ranked_reminders AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, target_type, target_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.reminders
  WHERE is_dismissed = FALSE
)
DELETE FROM public.reminders r
USING ranked_reminders rr
WHERE r.id = rr.id AND rr.rn > 1;

-- 2. Clean up existing duplicate in_app_notifications (retain newest per target)
WITH ranked_notifs AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, target_type, target_id
      ORDER BY is_read DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.in_app_notifications
)
DELETE FROM public.in_app_notifications n
USING ranked_notifs rn
WHERE n.id = rn.id AND rn.rn > 1;

-- 3. Harden rpc_schedule_reminder to deduplicate active reminders by (user_id, target_type, target_id)
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
  v_reminder_id TEXT := COALESCE(NULLIF(trim(p_id), ''), gen_random_uuid()::text);
  v_existing_id TEXT := NULL;
  v_sync_rev BIGINT;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required';
  END IF;

  v_sync_rev := get_next_sync_rev(v_user_id);

  -- If caller did not pass a specific existing reminder ID (or a different active reminder
  -- already exists for this same target), update it in-place rather than creating duplicates.
  SELECT id INTO v_existing_id
  FROM reminders
  WHERE user_id = v_user_id
    AND target_type = p_target_type
    AND target_id = p_target_id
    AND is_dismissed = FALSE
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL AND v_existing_id <> v_reminder_id THEN
    v_reminder_id := v_existing_id;
  END IF;

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

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

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
