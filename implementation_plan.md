# ScribeX Implementation Plan — Permanent Google Drive Connection (Silent Refresh Token Architecture)

> **Status:** Awaiting User Approval
> **Branch:** `feat/backend-integration`
> **Supabase Project Ref:** `gbpyfhrcofwsfklzweqo`

## Architecture & Goal

Eliminate 1-hour Google Drive access-token expiry disconnects by persisting each user's Google OAuth `refresh_token` encrypted server-side in Supabase and silently minting fresh 1-hour Drive access tokens via a Supabase Edge Function whenever the cached token nears expiry or returns `401`.

### End-to-End Flow
1. **Capture & Store Once (`action: 'store'`):** On Google Sign-In (`access_type: 'offline'`, `prompt: 'consent'`, `scopes: 'https://www.googleapis.com/auth/drive.file'`), after `verifyDriveAccess()` confirms `drive.file` scope, `googleDriveVaultService` sends `session.provider_refresh_token` to the `google-drive-token` Supabase Edge Function, which encrypts it with AES-256-GCM (`DRIVE_TOKEN_ENCRYPTION_KEY`) and stores it in `public.google_drive_connections` (locked down with RLS + zero client table grants).
2. **Silent Auto-Refresh (`action: 'refresh'`):** Whenever `getDriveAccountState(userId)` sees no cached token, an expired token, or a token within 3 minutes of expiry (or any Drive API call hits `401`), it deduplicates and silently calls `google-drive-token` (`action: 'refresh'`). The Edge Function decrypts the user's `refresh_token`, exchanges it at `https://oauth2.googleapis.com/token` using `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (from Supabase Secrets), and returns a fresh 1-hour access token.
3. **Explicit Disconnect / Google Revocation (`action: 'revoke'`):** Clicking **Disconnect** in Settings calls `action: 'revoke'` to delete the stored refresh token so Drive stays intentionally disconnected. If Google returns `invalid_grant` (user revoked ScribeX in Google Account settings), the Edge Function deletes the dead row and returns `{ revoked: true }`, cleanly pausing Cloud Sync and prompting the user to reconnect.

## Implementation Steps & Files

1. **Postgres Migration (Encrypted Refresh Token Vault)**
   - **[NEW]** `supabase/migrations/003_google_drive_refresh_tokens.sql`:
     - Creates `public.google_drive_connections (user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, drive_email TEXT NOT NULL, drive_display_name TEXT, encrypted_refresh_token TEXT NOT NULL, vault_folder_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`.
     - Enables RLS and runs `REVOKE ALL ON public.google_drive_connections FROM anon, authenticated;` so only the Edge Function (`service_role`) can read/write refresh tokens.
2. **Supabase Edge Function (`google-drive-token`)**
   - **[NEW]** `supabase/functions/google-drive-token/index.ts`:
     - Authenticates every request via the caller's Supabase JWT (`supabase.auth.getUser()`).
     - Implements AES-256-GCM encrypt/decrypt using Web Crypto API + `DRIVE_TOKEN_ENCRYPTION_KEY`.
     - Handles `store`, `refresh` (calling `https://oauth2.googleapis.com/token` with `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`, handling `invalid_grant`), and `revoke` with full CORS headers.
3. **Client Silent Refresh Integration**
   - **[MODIFY]** `frontend/src/services/drive/googleDriveVaultService.ts`:
     - Capture `session.provider_refresh_token` in `syncDriveTokenFromSupabaseSession(session)` and call `storeRefreshTokenInBackend(...)`.
     - Add deduplicated `refreshAccessTokenFromBackend(userId)` calling `supabase.functions.invoke('google-drive-token', { body: { action: 'refresh' } })`.
     - Update `getDriveAccountState(userId)` to silently refresh when missing, expired, or within 3 minutes of expiry instead of immediately clearing state.
     - Add automatic 1-time silent refresh + retry on `401` across Drive API operations (`uploadNoteMediaAttachments`, `hydrateNoteMediaToTempCache`, `deleteDriveAssetById`) before disconnecting.
     - Update `disconnectDriveAccount(userId)` to also revoke the server-stored refresh token (`action: 'revoke'`).
   - **[MODIFY]** `frontend/src/context/AuthContext.tsx`:
     - Pass `session.provider_refresh_token` cleanly through `handleAuthenticatedSession` and add a lightweight proactive foreground refresh check (e.g., on `AppState` `'active'` / web `visibilitychange`) so Drive stays seamlessly connected across long idle sessions.
4. **Live Supabase Deployment & Secrets**
   - Apply `003_google_drive_refresh_tokens.sql` to live Supabase (`gbpyfhrcofwsfklzweqo`).
   - Deploy `supabase/functions/google-drive-token` via `supabase functions deploy google-drive-token --project-ref gbpyfhrcofwsfklzweqo`.
   - Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `DRIVE_TOKEN_ENCRYPTION_KEY` via `supabase secrets set` (user runs 1 command locally or supplies secrets securely).
5. **Tests & Project Map**
   - **[MODIFY]** `scripts/test_google_drive_vault.mjs`: Add static contracts and silent-refresh / `invalid_grant` simulation tests.
   - **[MODIFY]** `.agents/project-map.json`: Index `003_google_drive_refresh_tokens.sql` and `supabase/functions/google-drive-token/index.ts`.

## Verification Gates
- `cd frontend && npx tsc --noEmit`
- `node scripts/test_google_drive_vault.mjs`
- `node scripts/test_guest_vault_migration.mjs`
- `node scripts/test_phase2_sync_and_rpc.mjs`
- Live Supabase schema & Edge Function deployment check (`supabase db query` + `supabase functions list`).

## Recommended Execution

| Command | Fit Assessment |
| :--- | :--- |
| **`/plan`** (or **`approve`**) | **Best fit.** Adds a new Postgres migration, a new Deno Edge Function with AES-256-GCM token encryption, and live Supabase secret/deployment steps — using `/plan` gives you a reviewable security & code-diff artifact before touching live Supabase, or reply **`approve`** to build and deploy directly. |
| `/boost` | Optional if you want deeper threat-model review on token encryption/CORS, though the Edge Function surface is small (~160 lines). |
| `/swarm` / `/teamwork` | Overkill — only 4–5 tightly coupled files (SQL migration -> Edge Function -> Drive service -> AuthContext -> tests). |
| `/grill-me` | Unnecessary — architecture is already standard and agreed upon. |
| `/goal` | Unnecessary — bounded single-session implementation. |
| `/run-workflow` | Not needed — sequential dependency chain, not a multi-file fan-out. |
| `/compact` | Not needed right now. |

**Recommendation:** Type **`/plan`** to review the detailed code & security diff artifact first (recommended since this touches a new Supabase migration + Edge Function + secrets), or reply **`approve`** to proceed directly with implementation.
