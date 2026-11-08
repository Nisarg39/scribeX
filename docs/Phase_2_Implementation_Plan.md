# Phase 2: Step-by-Step Implementation Plan
## Resilient Client-Server Delta Sync & Multi-Device Vault Mirroring

> **Document Status:** Architectural Implementation Blueprint  
> **Target Directories:** `backend/` (FastAPI VPS Core) & `frontend/src/sync/` (Sync Engine Client)  
> **Source of Truth Specifications:**  
> - [Technical_System_Architecture.md (Sections 4 & 5)](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md)  
> - [Universal_Note_Input_Structure_and_Relations.md (Section 5)](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Universal_Note_Input_Structure_and_Relations.md)  
> - [Master_Tasks_Tracker.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Master_Tasks_Tracker.md)  

---

## 1. Master Progress Tracker

Use this checklist to track execution. Every step must be implemented, tested, and verified before marking as completed and moving to the next step.

| Step | Milestone / Component | Primary Files | Status |
| :---: | :--- | :--- | :---: |
| **1** | [FastAPI Core VPS Scaffolding, Config & SQLite WAL Schemas](#step-1-fastapi-core-vps-scaffolding-config--sqlite-wal-schemas) | `backend/pyproject.toml`, `backend/app/main.py`, `backend/app/db/schemas.sql`, `backend/app/db/sqlite_db.py` | `[ ] PENDING` |
| **2** | [Event-Sourced Delta Sync Ledger (`sync_changelog` & Monotonic `sync_rev`)](#step-2-event-sourced-delta-sync-ledger) | `backend/app/api/sync_ws.py`, `backend/app/db/sqlite_db.py` | `[ ] PENDING` |
| **3** | [Real-Time WebSocket Doorbell Hub (`/api/v1/ws/sync`)](#step-3-real-time-websocket-doorbell-hub) | `backend/app/api/sync_ws.py`, `frontend/src/sync/syncClient.ts` | `[ ] PENDING` |
| **4** | [Guaranteed Reconnection Catch-Up & Handshake State Reconciliation](#step-4-guaranteed-reconnection-catch-up--handshake-state-reconciliation) | `backend/app/api/sync_ws.py`, `frontend/src/sync/syncEngine.ts` | `[ ] PENDING` |
| **5** | [HTTP REST Sync Fallback Endpoints (`/push`, `/pull`)](#step-5-http-rest-sync-fallback-endpoints) | `backend/app/api/sync_http.py`, `frontend/src/sync/syncClient.ts` | `[ ] PENDING` |
| **6** | [Binary Asset Ingestion API & Storage (`/api/v1/assets/upload`)](#step-6-binary-asset-ingestion-api--storage) | `backend/app/api/assets.py`, `frontend/src/services/assetService.ts` | `[ ] PENDING` |
| **7** | [Asynchronous Git Markdown Vault Projector (`GitPython`)](#step-7-asynchronous-git-markdown-vault-projector) | `backend/app/storage/git_vault.py` | `[ ] PENDING` |
| **8** | [Multi-Device Concurrency & Conflict Resolution Strategy](#step-8-multi-device-concurrency--conflict-resolution-strategy) | `backend/app/db/sqlite_db.py`, `frontend/src/sync/syncEngine.ts` | `[ ] PENDING` |
| **9** | [Phase 2 Master Verification Suite & Multi-Device Sync Testing](#step-9-phase-2-master-verification-suite--multi-device-sync-testing) | `backend/tests/test_sync.py`, `frontend/src/sync/__tests__/sync.test.ts` | `[ ] PENDING` |

---

## 2. Detailed Step-by-Step Milestones

### Step 1: FastAPI Core VPS Scaffolding, Config & SQLite WAL Schemas
* **Objective:** Scaffold the 24/7 Cloud VPS backend using FastAPI, configured with multi-tenant parameterized `user_id` convention (defaulting to `'default_user'`) and embedded SQLite WAL operational storage.
* **Key Deliverables:**
  * `backend/pyproject.toml`: FastAPI, Uvicorn, `aiosqlite`, `pydantic`, `GitPython`, `python-multipart`.
  * `backend/app/db/schemas.sql`: Complete DDL for `folders`, `tags`, `notes`, `note_tags`, `tasks`, `assets`, `entity_relations`, `sync_changelog`.
  * `backend/app/db/sqlite_db.py`: Async SQLite connection manager with WAL mode and transaction rollback support.

---

### Step 2: Event-Sourced Delta Sync Ledger (`sync_changelog` & Monotonic `sync_rev`)
* **Objective:** Ensure every insert, update, or delete across all 6 operational entities produces an immutable changelog entry with an auto-incrementing integer revision counter (`sync_rev`).
* **Supported Entity Types:**
  * `note`: Markdown content and `blocks_json` AST.
  * `folder`: Hierarchical structure and physical mirror paths.
  * `tag`: Classification labels.
  * `task`: Unified task state and priority weights.
  * `relation`: Knowledge graph edges.
  * `asset`: Binary attachment metadata and processing state.

---

### Step 3: Real-Time WebSocket Doorbell Hub (`/api/v1/ws/sync`)
* **Objective:** Sub-50ms instant push notifications across all active client devices whenever an entity changes.
* **Architecture:**
  * The WebSocket acts as an instant "doorbell" push notification rather than a fragile stateful pipeline.
  * When Device A pushes a change, FastAPI commits the change, increments `sync_rev`, and immediately broadcasts `{ type: "SYNC_PING", latest_rev: 42 }` to all connected tenant devices.

---

### Step 4: Guaranteed Reconnection Catch-Up & Handshake State Reconciliation
* **Objective:** Ensure devices that were offline, asleep, or disconnected gracefully catch up on all missed revisions without data loss.
* **Handshake Protocol:**
  1. Client sends `{ type: "CLIENT_HANDSHAKE", local_sync_rev: 30 }`.
  2. Server queries `sync_changelog WHERE sync_rev > 30 ORDER BY sync_rev ASC`.
  3. Server streams the missing deltas to the client.
  4. Client applies deltas inside a single local SQLite transaction, then pushes any pending local changes.

---

### Step 5: HTTP REST Sync Fallback Endpoints (`/push`, `/pull`)
* **Objective:** Guarantee 100% sync reliability in restrictive network environments (corporate firewalls, public Wi-Fi) where WebSockets may be blocked.
* **Endpoints:**
  * `POST /api/v1/sync/push`: Accepts array of local mutation deltas.
  * `POST /api/v1/sync/pull`: Returns server deltas since `client_sync_rev`.

---

### Step 6: Binary Asset Ingestion API & Storage (`/api/v1/assets/upload`)
* **Objective:** Non-blocking multi-part media upload pipeline saving audio recordings, PDFs, spreadsheets, and images into the physical vault directory (`data/vault/{user_id}/_assets/`).
* **Endpoints:**
  * `POST /api/v1/assets/upload`: Multi-part form upload with SHA-256 hash validation.
  * `GET /api/v1/assets/{asset_id}/stream`: Range-request-enabled media streaming.

---

### Step 7: Asynchronous Git Markdown Vault Projector (`GitPython`)
* **Objective:** Asynchronously serialize SQLite note transactions into clean Extended Markdown AST `.md` files committed to a local Git repository on the VPS disk.
* **Key Guarantees:**
  * Live user typing is never blocked by disk-level Git commit operations.
  * Physical folder hierarchy is preserved (`data/vault/{user_id}/folders/...`).
  * Notes are 100% human-readable with zero proprietary locks.

---

### Step 8: Multi-Device Concurrency & Conflict Resolution Strategy
* **Objective:** Deterministic conflict resolution across concurrent offline edits.
* **Strategy:**
  * Metadata & Tasks: Field-level Last-Write-Wins (LWW) based on NTP UTC timestamps (`updated_at`).
  * Note Blocks: 3-way merge on the Extended Markdown AST. If non-conflicting blocks were edited, they merge cleanly; conflicting lines are preserved with conflict markers for easy resolution.

---

### Step 9: Phase 2 Master Verification Suite & Multi-Device Sync Testing
* **Objective:** Automated E2E verification simulating two offline clients making concurrent edits and reconciling cleanly upon reconnection.
* **Verification Command:**
  ```bash
  cd backend && pytest tests/test_sync.py -v
  ```
