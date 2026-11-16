# Implementation Plan: Phase 2 Backend Integration (Managed Supabase Option A, Google OAuth Only, Auth-Gated Cloud Sync & Schema Parity)

## 1. Finalized Phase 2 Architecture & Rules

1. **Managed Multi-Tenant Cloud Architecture (Option A):**
   - Single managed Supabase project for instant zero-configuration Realtime CDC synchronization. Users never have to manually input Supabase URLs or API keys.
   - The cloud database stores user authentication identity (`auth.users`, `public.users`) to authenticate users and authorize backend/RPC actions, while strictly protecting user records through PostgreSQL Row-Level Security (`auth.uid() = user_id`).
2. **Google OAuth Only Sign-In (Dual Purpose: Auth + Google Drive Media Sync):**
   - ScribeX uses **Google OAuth exclusively** (via Supabase Auth Google provider) as its sole authentication method across Mobile and Web.
   - **Strategic Dual Role:**
     - Authenticates cloud identity (`auth.uid()`) for Supabase Realtime sync, cloud Master PIN/locks, and AI features.
     - Acquires Google OAuth scopes (`drive.file`) for personal Google Drive media synchronization (zero-cost media storage for user attachments, audio, and images).
3. **Strict Auth-Gated Cloud Sync & AI Features (Disabled in UI Until Logged In):**
   - If the user skips sign-in during onboarding (`isGuest === true` / `!isAuthenticated`), all notes, folders, tasks, reminders, and media remain **100% offline on-device** (`user_id = 'user-default'`).
   - **Both Cloud Sync and all AI features** (Friday Assistant, In-Editor AI Co-Pilot, Multi-Agents, BYOK AI settings, and Cloud Connectors) **must be disabled in the UI** until the user completes the Google OAuth sign-in flow (`/signin`).
   - Upon signing in with Google for the first time, all local `user-default` SQLite records are atomically migrated to the user's `auth.uid()`, unlocking Cloud Sync and AI features in the UI.
4. **Master PIN Cloud Sync vs. Device-Only Biometrics:**
   - `workspace_security` (Master PIN/Password hash, salt, hint, `app_lock_enabled`, `auto_relock_seconds`) and all note/folder lock fields (`is_locked`, `lock_type`, `lock_credential_kind`, `lock_hash`, `lock_salt`, `lock_hint`) sync to Supabase via `rpc_upsert_workspace_security`.
   - `biometrics_enabled` remains **strictly a device-only setting** in local storage and is never synced to the cloud database.
5. **Note & Folder AI Context Exclusion (`ai_context_excluded`):**
   - Persisted on `notes` and `folders` in both local SQLite and Supabase, and strictly filtered out in `rpc_search_vault` and AI context retrieval.

---

## 2. Implementation Steps

### Step 1: Local SQLite Schema & Types Update (`ai_context_excluded`) [COMPLETED]
- **Files Modified:**
  - [`frontend/src/db/schema.ts`](frontend/src/db/schema.ts)
  - [`frontend/src/db/client.native.ts`](frontend/src/db/client.native.ts)
  - [`frontend/src/db/client.web.ts`](frontend/src/db/client.web.ts)
  - [`frontend/src/db/types.ts`](frontend/src/db/types.ts)
  - [`frontend/src/types/note.ts`](frontend/src/types/note.ts)
  - [`frontend/src/db/notesRepo.ts`](frontend/src/db/notesRepo.ts)
  - [`frontend/src/db/foldersRepo.ts`](frontend/src/db/foldersRepo.ts)
  - [`frontend/src/services/workspaceBackupService.ts`](frontend/src/services/workspaceBackupService.ts)
  - [`.agents/project-map.json`](.agents/project-map.json)
- **Status:** Done. Added `ai_context_excluded` to SQLite tables with safe migrations, mapped in DTOs and repos, verified via `npx tsc --noEmit` and test suites.

### Step 2: Supabase Client, Google OAuth-Only Sign-In & Lossless Guest Vault Migration [COMPLETED]
- **Files Created / Modified:**
  - [`frontend/src/services/supabase/supabaseClient.ts`](frontend/src/services/supabase/supabaseClient.ts) *(New)*
  - [`frontend/src/db/vaultMigration.ts`](frontend/src/db/vaultMigration.ts) *(New)*
  - [`frontend/src/context/AuthContext.tsx`](frontend/src/context/AuthContext.tsx)
  - [`frontend/app/signin.tsx`](frontend/app/signin.tsx)
  - [`scripts/test_guest_vault_migration.mjs`](scripts/test_guest_vault_migration.mjs) *(New)*
  - [`.agents/project-map.json`](.agents/project-map.json)
  - [`docs/Master_Tasks_Tracker.md`](docs/Master_Tasks_Tracker.md)
- **Status:** Done. Initialized Supabase client with AsyncStorage persistence, implemented atomic lossless guest-to-account migration across all 10 user-scoped SQLite tables, wired Google OAuth-only sign-in across Web and Mobile (`scribex://auth/callback`), and verified with `npx tsc --noEmit` (0 errors) + 13/13 Guest Migration + 13/13 UI/UX + 39/39 Reminder/Notification checks.

---

### Step 3: Auth-Gated `SyncEngine` (Notes, Folders, Tasks, Reminders & Master PIN) [NEXT]
- **Files:**
  - [`frontend/src/services/sync/syncEngine.ts`](frontend/src/services/sync/syncEngine.ts)
  - [`frontend/src/state/useNotesStore.tsx`](frontend/src/state/useNotesStore.tsx)
  - [`frontend/src/context/SecurityContext.tsx`](frontend/src/context/SecurityContext.tsx)
  - [`frontend/src/components/navigation/SideNavbarModal.tsx`](frontend/src/components/navigation/SideNavbarModal.tsx)
- **Changes:**
  - Gate `syncEngine` in `useNotesStore.tsx` so it only runs when `isAuthenticated === true` with a valid `userId`. When `isGuest === true`, `syncEngine` stays strictly offline (`status: 'offline_guest'`).
  - Sync Master PIN changes in `SecurityContext.tsx` to Supabase (`rpc_upsert_workspace_security`) when authenticated, while keeping `biometrics_enabled` strictly local to the device.
  - Update `SideNavbarModal.tsx` and Workspace Settings so guest users see **"Offline Mode · Sign in with Google to Sync"** which navigates to `/signin`.

---

## Recommended Execution

| Command | Fit | Reasoning |
| :--- | :--- | :--- |
| `/plan` | **Best Fit** | Reviews and approves the 3-step Phase 2 implementation across SQLite schema, Google OAuth-only `AuthContext`, Guest-to-Account vault migration, and auth-gated `SyncEngine`. |
| `/boost` | High | Great fit for executing and stress-testing the multi-table guest-to-account migration and sync engine delta reconciliation. |
| `/teamwork` / `/swarm` | Low | Tightly coupled state between `AuthContext`, `SecurityContext`, `useNotesStore`, and `syncEngine`. |
| `/compact` | Medium | Recommended if you want to compact the conversation context before starting Phase 2 implementation. |
