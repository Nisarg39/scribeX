# SaaS Architecture & Integration Plan: ScribeX Commercial Platform

## 1. Executive Summary & Architectural Vision

This document outlines the transition roadmap and commercial multi-tenancy architecture for transforming **ScribeX - Friday & Universal Note-Taking Platform** into a commercial **Software-as-a-Service (SaaS)** and **Platform-as-a-Service (PaaS)**.

The design philosophy is **Privacy-First Isolated Multi-Tenancy**. Because ScribeX captures deeply personal reflections, confidential career goals, and connects to user PCs for CLI code execution, customer data must never be commingled in un-sandboxed shared tables. By adhering to the **Day-1 SaaS-Ready Conventions** defined below, ScribeX can be implemented initially for a single user (Phase 1–4) and seamlessly upgraded to multi-tenant commercial operations later with zero core rewrites.

---

## 2. Day-1 SaaS-Ready Foundations (Phase 1 Pre-Requisites)

To ensure zero code is discarded when commercial multi-tenancy is activated, the core backend implemented in Phase 1 must strictly follow three structural rules:

### 2.1. Rule 1: Parameterized `user_id` Across All Relational Tables
Every table created in SQLite must include a `user_id` column indexed for fast lookups. In Phase 1, all operations default to `"default_user"`.

```sql
-- Example: Core schema with user_id ready for multi-tenancy
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    group_name TEXT NOT NULL,
    title TEXT NOT NULL,
    priority_score REAL DEFAULT 0.5,
    sync_rev INTEGER NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notes_user_rev ON notes(user_id, sync_rev);

CREATE TABLE IF NOT EXISTS sync_changelog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    sync_rev INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    change_type TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    delta_payload JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sync_user_rev ON sync_changelog(user_id, sync_rev);
```

### 2.2. Rule 2: Tenant-Partitioned Filesystem Paths
The Git-backed Markdown Vault and LanceDB vector tables must never hardcode a single root folder. They must always resolve paths dynamically through a tenant path resolver:

```python
# backend/app/storage/paths.py
from pathlib import Path

DATA_ROOT = Path("/data")

def get_user_vault_path(user_id: str = "default_user") -> Path:
    vault_dir = DATA_ROOT / "tenants" / user_id / "vault"
    vault_dir.mkdir(parents=True, exist_ok=True)
    return vault_dir

def get_user_lancedb_path(user_id: str = "default_user") -> Path:
    lancedb_dir = DATA_ROOT / "tenants" / user_id / "lancedb"
    lancedb_dir.mkdir(parents=True, exist_ok=True)
    return lancedb_dir
```

### 2.3. Rule 3: Injected Request Context (`get_current_user_id`)
All Next.js API endpoints and Supabase RLS policies resolve the active user through Supabase Auth:

```typescript
// backend/lib/auth.ts (Next.js App Router)
import { createServerClient } from '@supabase/ssr';
import { headers, cookies } from 'next/headers';

export async function getCurrentUserId(): Promise<string> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name) { return cookieStore.get(name)?.value; } } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || 'default_user';
}
```

---

## 3. Commercial Multi-Tenancy Architecture

```
                                  PUBLIC INTERNET
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │     Cloudflare Edge & Vercel CDN      │
                     │  - Global Edge Caching & DDoS Defense │
                     │  - Zero-Cold-Start Serverless Routing │
                     └───────────────────┬───────────────────┘
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │    Next.js Serverless AI & Gateway    │
                     │  - Supabase Auth JWT Verification     │
                     │  - LiteLLM Multi-User Token Metering  │
                     │  - Stripe Subscription Webhook Hub    │
                     │  - Friday AI Tool-Calling Endpoints   │
                     └───────┬───────────────────────┬───────┘
                             │                       │
         ┌───────────────────┴──┐                 ┌──┴───────────────────┐
         ▼                      ▼                 ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Tenant: User 1   │  │ Tenant: User 2   │  │ Tenant: User 3   │  │ Tenant: User N   │
│ - Supabase RLS   │  │ - Supabase RLS   │  │ - Supabase RLS   │  │ - Supabase RLS   │
│ - pgvector RLS   │  │ - pgvector RLS   │  │ - pgvector RLS   │  │ - pgvector RLS   │
│ - GDrive Assets  │  │ - GDrive Assets  │  │ - GDrive Assets  │  │ - GDrive Assets  │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

### 3.1. Tenant Isolation Models
ScribeX enforces multi-tenancy at the database and storage level:

1. **Native PostgreSQL Row-Level Security (RLS) via Supabase:**
   * Every operational table (`notes`, `folders`, `tags`, `tasks`, `assets`, `entity_relations`, `sync_changelog`) enforces `auth.uid() = user_id`.
   * Realtime subscriptions are filtered per-user at the PostgreSQL publication level, preventing any cross-tenant data leakage.
   * Built-in `pgvector` queries filter automatically by `user_id`.
2. **Zero-Cost Asset Isolation via User's Personal Google Drive:**
   * Each tenant connects their own Google Drive account via OAuth 2.0.
   * User assets (images, scans, recordings, PDFs) live directly in the tenant's personal Google Drive folder (`ScribeX_Vault/assets/`), eliminating cloud storage liability and hosting costs for the platform.

---

## 4. User Authentication & Commercial Account Lifecycle

### 4.1. Supported Auth Providers
* **Primary SaaS Auth:** **Clerk** or **Supabase Auth** (supporting Social Logins: Google, Apple, GitHub, and Magic Links).
* **Self-Hosted Enterprise:** Standard OAuth2 / OpenID Connect (OIDC) with Ed25519 JWT verification.

### 4.2. Onboarding & Tenant Provisioning Lifecycle
When a new user signs up:
1. `POST /api/v1/auth/provision`:
   * Creates the tenant record in the billing ledger.
   * Initializes `/data/tenants/{user_id}/vault` as a clean Git repository (`git init`).
   * Writes the baseline `_core/identity.md` template.
   * Generates the user's encrypted Ed25519 machine pairing key for their PC agent bridge.
2. The user is guided through the conversational **Interactive Onboarding Interview** to establish Layer 1 (Identity) and Layer 2 (Initial Goals).

### 4.3. Data Ownership & 1-Click GDPR Export
Because every tenant's notes are stored as physical Markdown files with Git history:
* **Instant Export:** User clicks *"Export My Vault"*; the backend creates a `.zip` archive of `/data/tenants/{user_id}/vault` and delivers it immediately.
* **Instant Deletion:** If a user cancels, deleting `/data/tenants/{user_id}/` wipes all notes, vector embeddings, and history cleanly.

---

## 5. Multi-Tenant Remote PC Daemon Pairing Protocol

In a commercial SaaS, users run the `pc-agent-bridge` daemon on their home or work computers. The SaaS backend securely routes commands only to that user's specific PC.

```
[User's Mobile Phone] ──> Next.js API / Supabase ──> Outbound Tunnel ──> [User's Personal PC Daemon]
 (Auth: Supabase JWT)    (Routes by user_id)        (Outbound WSS / SSE:         (Executes CLI tools in
                                                    Auth: Machine Token)          allowed_workspaces)
```

### 5.1. Pairing Flow
1. User logs into the Web or Mobile app and navigates to **Settings $\rightarrow$ Connect PC**.
2. ScribeX displays a **One-Time Pairing Token** (or QR code) valid for 10 minutes:
   ```bash
   scribex-bridge connect --server https://api.scribex.com --token scx_pair_984f29a0c1
   ```
3. The local bridge sends the token to `POST /api/pc/pair` on Next.js. Next.js verifies the token with Supabase, creates a permanent machine credentials file (`~/.scribex/machine_token.json`) on the PC, and registers the PC under that `user_id`.
4. The PC daemon opens a persistent outbound WebSocket / SSE connection with header `X-Machine-Token`.

### 5.2. Multi-Tenant Connection Registry
Next.js and Supabase channels manage live connections partitioned by user:
```typescript
// Active user task queues in Supabase Realtime channels
const userChannel = supabase.channel(`pc-bridge:${userId}`);
```
When User A dispatches a task from their iPhone, the router looks up `active_pc_tunnels[user_id]` and pushes the execution spec directly to User A's PC daemon.

---

## 6. Commercial Subscription, Billing & LLM Token Quotas

### 6.1. Plan Tiers & Features

| Feature | Starter ($9/mo) | Pro / "Friday" ($24/mo) | Power / Team ($49/mo) |
| :--- | :--- | :--- | :--- |
| **Multi-Device Real-Time Sync** | Up to 2 devices | Unlimited devices | Unlimited devices |
| **Living Notes & File Storage** | 2 GB storage | 20 GB storage | 100 GB storage |
| **Cognitive Memory Layers** | Layer 1 & 2 | Layers 1, 2, 3 & 4 | Full 4-Layer + Team Graph |
| **Diff Learning Engine** | Standard rules | Advanced auto-adapting | Custom persona tuning |
| **Remote PC Task Execution** | 10 tasks / month | Unlimited verified tasks | Multi-PC orchestration |
| **AI LLM Models** | Gemini 1.5 Flash / GPT-4o-mini | Claude 3.5 Sonnet / GPT-4o | Claude 3.5 Sonnet + Custom BYO-Key |

### 6.2. LLM Cost Control & Proxy Routing
To prevent runaway LLM costs from power users:
* **LiteLLM Multi-Tenant Proxy:** All LLM calls pass through LiteLLM configured with per-user spend budgets (`max_budget_per_user = $15.00/mo`).
* **Bring-Your-Own-Key (BYOK) Option:** Users can supply their own OpenRouter, Anthropic, or OpenAI API keys in the app settings. When BYOK is enabled, platform subscription costs can be discounted and LLM usage caps are removed.
* **Stripe Webhook Integration:** 
  * `customer.subscription.created` $\rightarrow$ Unlocks Pro features.
  * `customer.subscription.deleted` $\rightarrow$ Downgrades tenant to free tier and restricts background jobs.

---

## 7. Phased SaaS Transition Roadmap

```
PHASE 1 (Completed) & 2–4        PHASE 5: SaaS Foundation        PHASE 6: Commercial Launch
┌───────────────────────────┐    ┌───────────────────────────┐   ┌───────────────────────────┐
│ Core Engine (Single-User) │    │ Multi-Tenancy & Auth      │   │ Billing & Public Scaling  │
│ - Operational SQLite [x]  │───>│ - Injected user_id Auth   │──>│ - Stripe Subscriptions    │
│ - Git Vault Projection[x] │    │ - Tenant-isolated paths   │   │ - LiteLLM Token Quotas    │
│ - 4-Layer Memory + Sync   │    │ - Clerk / Supabase Auth   │   │ - Cloudflare Ingress/DDoS │
│ - Remote PC Daemon        │    │ - Machine Pairing Tokens  │   │ - BYO-Key Support         │
└───────────────────────────┘    └───────────────────────────┘   └───────────────────────────┘
```

Phase 1 (Universal Manual Note Engine, Local SQLite Core, 36 Composable Blocks, Folders, Tags, and Relations) is **100% completed and verified** with full user parameterization. Transitioning to Phase 5 and 6 will simply be a matter of plugging in authentication and billing layers without touching the note-taking, cognitive memory, or agent verification logic.
