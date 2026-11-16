# ScribeX Cloud Backend: Supabase & Google OAuth Configuration Guide

> **Document Version:** 1.0  
> **Status:** Active Reference & Runbook  
> **Scope:** Setup, credentials, and end-to-end integration between Supabase, Google Cloud Console, and the ScribeX frontend.

---

## 1. Architectural Overview

ScribeX implements **Option A: Managed Multi-Tenant Cloud Architecture** with **Google OAuth as the sole authentication provider**:

```
+-----------------------------------------------------------------------------+
|                               ScribeX Client                                |
|  - Web: Browser OAuth redirect (window.location.origin)                     |
|  - iOS/Android: Deep Link redirect (scribex://auth/callback via WebBrowser)  |
+-----------------------------------------------------------------------------+
                                       |
                   [1] Initiates Google Sign-In
                                       v
+-----------------------------------------------------------------------------+
|                           Supabase Auth Service                             |
|  - Hosted OAuth Handler: https://<project-ref>.supabase.co/auth/v1/callback  |
|  - Manages PKCE flow, state tokens & session refresh                        |
+-----------------------------------------------------------------------------+
                                       |
                   [2] Exchanges Code with Google Cloud
                                       v
+-----------------------------------------------------------------------------+
|                            Google Cloud Console                             |
|  - OAuth 2.0 Client ID (Web Application)                                    |
|  - Dual Purpose:                                                            |
|    1. Verifies user identity -> issues Supabase auth.uid()                  |
|    2. Will provision Google Drive (drive.file) scope for zero-cost media   |
+-----------------------------------------------------------------------------+
                                       |
                   [3] Returns Session JWT & User UUID
                                       v
+-----------------------------------------------------------------------------+
|                      Supabase PostgreSQL Database Engine                    |
|  - Row-Level Security (RLS): auth.uid() = user_id                           |
|  - Client ID Preservation RPCs: rpc_create_note, rpc_update_note, etc.      |
|  - Realtime CDC Engine: Broadcasts mutations across signed-in devices       |
+-----------------------------------------------------------------------------+
```

---

## 2. Step-by-Step Configuration Performed

### Step 1: Supabase Project Setup & Database Schema Initialization

1. Created a dedicated cloud project at [supabase.com](https://supabase.com) named **`ScribeX`**.
2. Selected a deployment region close to active clients and configured a strong database password.
3. Executed SQL migration scripts inside the Supabase **SQL Editor** (`>_`):
   - **`supabase/migrations/001_initial_schema.sql`**: Created core tables (`notes`, `folders`, `tags`, `note_tags`, `tasks`, `assets`, `entity_relations`, `sync_changelog`, `search_history`, `reminders`, `in_app_notifications`, `workspace_security`), enabled Row-Level Security (RLS) on all tables, and added them to the `supabase_realtime` publication channel.
   - **`supabase/migrations/002_core_rpcs.sql`**: Deployed strongly-typed PL/pgSQL Stored Procedures (`rpc_create_note`, `rpc_update_note`, `rpc_create_task`, `rpc_toggle_task`, `rpc_schedule_reminder`, `rpc_search_vault`, `rpc_upsert_folder`, `rpc_upsert_workspace_security`) with `ON CONFLICT (id) DO UPDATE` to preserve client-generated UUIDs/IDs.

---

### Step 2: Supabase API Key Retrieval & Frontend Environment Setup

1. In Supabase Dashboard, navigated to **Project Settings (⚙️) -> API**.
2. Extracted the following values:
   - **Project URL:** `https://<your-project-ref>.supabase.co`
   - **Project API Keys -> Publishable / `anon` Key:** (Starts with `eyJhbGciOi...` or `sb_pub_...`).
3. Stored these values in `frontend/.env` (and root `.env`):
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
4. **Security Notice:** The `service_role` (secret) key is **never** placed into frontend `.env` files or committed to Git. The frontend strictly uses the publishable/anon key, with database security fully enforced by PostgreSQL RLS.

---

### Step 3: Google Cloud Console OAuth 2.0 Credentials Setup

1. Copied the Supabase OAuth Callback URL from **Supabase Dashboard -> Authentication -> Providers -> Google**:
   ```text
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
2. Logged into [Google Cloud Console](https://console.cloud.google.com/) and created/selected the **`ScribeX`** project.
3. Configured the **OAuth Consent Screen**:
   - User Type: **External**
   - App Name: `ScribeX`
   - User support email & Developer contact email: Configured
   - Scopes: Configured default `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid` (with `drive.file` reserved for the future media sync phase).
4. Created OAuth Credentials:
   - Navigated to **APIs & Services -> Credentials -> + CREATE CREDENTIALS -> OAuth client ID**.
   - Application Type: **Web application** (standard for Supabase redirect-based authentication).
   - Name: `ScribeX Auth`
   - **Authorized redirect URIs:** Added the Supabase Callback URL:
     ```text
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```
   - Clicked **Create** and received the **Client ID** and **Client Secret**.

---

### Step 4: Connecting Google OAuth in Supabase

1. Returned to **Supabase Dashboard -> Authentication -> Providers -> Google**.
2. Toggled **Enable Google provider** to **ON**.
3. Pasted the **Client ID** obtained from Google Cloud Console.
4. Pasted the **Client Secret** obtained from Google Cloud Console.
5. Clicked **Save**.

---

## 3. How the Pieces Connect at Runtime

| Component | Responsibility | Source of Truth |
| :--- | :--- | :--- |
| **`frontend/.env`** | Provides client-side Supabase URL and Publishable Anon Key to the React Native / Expo app. | Local filesystem (gitignored) |
| **Google Cloud Console** | Authenticates user identity and enforces authorized redirect URIs. | Google Identity Platform |
| **Supabase Auth** | Intermediates the OAuth 2.0 PKCE handshake, creates rows in `auth.users`, and issues signed JWTs. | Supabase Auth Server |
| **Supabase PostgreSQL** | Enforces Row-Level Security (`auth.uid() = user_id`) and executes atomic RPC mutations. | `supabase/migrations/` |
| **Frontend Auth Context** | Tracks `isAuthenticated`, `isGuest`, handles lossless offline vault migration, and gates Cloud Sync & AI features. | `frontend/src/context/AuthContext.tsx` |

---

## 4. Key Architectural Invariants

1. **Google OAuth Exclusivity:**
   ScribeX exclusively uses Google OAuth for authentication across all platforms (Mobile and Web). This guarantees a single identity pipeline and eliminates the overhead of managing email/password verification, credential resets, or multi-provider identity linking.
2. **Dual-Purpose Sign-In:**
   Google OAuth provides both:
   - User identity (`auth.uid()`) for Supabase cloud sync, Master PIN cloud backup, and AI features.
   - Pre-authorization for personal Google Drive media synchronization (`drive.file`), enabling users to store high-resolution images, audio recordings, and videos at zero server infrastructure cost.
3. **Strict Auth Gate:**
   Users who choose "Skip for now" operate 100% offline in local SQLite (`user_id = 'user-default'`). Cloud Sync and AI features remain locked in the UI until they complete Google sign-in.
4. **Lossless Vault Migration:**
   When a guest signs in with Google for the first time, all local notes, folders, tasks, and reminders are atomically migrated to their new Google `auth.uid()`.

---

## 5. Verification Checklist

- [x] Supabase project created and active.
- [x] Initial schema (`001_initial_schema.sql`) executed in SQL Editor.
- [x] Core RPCs (`002_core_rpcs.sql`) executed in SQL Editor.
- [x] `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` configured in `frontend/.env`.
- [x] Google OAuth consent screen configured in Google Cloud Console.
- [x] Web OAuth 2.0 Client ID created with Supabase Callback URI.
- [x] Google provider enabled in Supabase Authentication settings with Client ID & Secret.
- [x] `.env` files verified in `.gitignore` to prevent credential exposure.
