-- ============================================================================
-- ScribeX Migration 003: Encrypted Google Drive Refresh Token Vault
-- Purpose: Store per-user Google OAuth refresh tokens (AES-256-GCM encrypted
--          by the `google-drive-token` Edge Function) so Google Drive stays
--          permanently connected without 1-hour manual re-authentication.
-- Security: RLS enabled + zero anon/authenticated grants; accessible ONLY by
--           the Supabase Edge Function running with service_role privileges.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.google_drive_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  drive_email TEXT NOT NULL,
  drive_display_name TEXT,
  encrypted_refresh_token TEXT NOT NULL,
  vault_folder_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.google_drive_connections ENABLE ROW LEVEL SECURITY;

-- Strictly block direct client access (anon & authenticated roles cannot read or write)
REVOKE ALL ON TABLE public.google_drive_connections FROM PUBLIC;
REVOKE ALL ON TABLE public.google_drive_connections FROM anon;
REVOKE ALL ON TABLE public.google_drive_connections FROM authenticated;
GRANT ALL ON TABLE public.google_drive_connections TO service_role;

CREATE OR REPLACE FUNCTION public.touch_google_drive_connections_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_google_drive_connections_updated_at ON public.google_drive_connections;
CREATE TRIGGER trg_google_drive_connections_updated_at
  BEFORE UPDATE ON public.google_drive_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_google_drive_connections_updated_at();
