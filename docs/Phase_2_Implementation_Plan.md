# Phase 2: Step-by-Step Implementation Plan
## Universal Expo App, Pastel Tile UI & Resilient Delta Sync

> **Document Status:** Active Tracking Document  
> **Target Directories:** `frontend/` (Expo App) & `backend/app/api/` (Sync Endpoints)  
> **UI Design System Source of Truth:** [ScribeX-Pastel-Tile-UI-Design-System.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/ScribeX-Pastel-Tile-UI-Design-System.md)  
> **Architecture Alignment:** [Technical_System_Architecture.md (Sections 3 & 4)](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md#4-bidirectional-synchronization-engine-delta-sync) and [Master_Tasks_Tracker.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Master_Tasks_Tracker.md).

---

## 1. Master Progress Tracker

Use this checklist to track execution. Every step must be implemented, tested, and verified before marking as completed and moving to the next step.

| Step | Milestone / Component | Primary Files | Status |
| :---: | :--- | :--- | :---: |
| **1** | [Expo Scaffolding & Pastel Tile Design System Tokens](#step-1-expo-universal-scaffolding--pastel-tile-design-system-tokens) | `frontend/package.json`, `frontend/src/theme/tokens.ts`, `frontend/src/theme/ThemeProvider.tsx` | `[x] COMPLETED` |
| **2** | [Backend Delta Sync Endpoints (WebSocket Doorbell + REST Catch-up)](#step-2-backend-delta-sync-endpoints-websocket-doorbell--rest-catch-up) | `backend/app/api/sync_ws.py`, `backend/app/api/sync_http.py`, `backend/tests/test_sync.py` | `[x] COMPLETED` |
| **3** | [Client Offline-First SQLite Engine (`expo-sqlite`)](#step-3-client-offline-first-sqlite-engine-expo-sqlite) | `frontend/src/db/sqliteClient.ts`, `frontend/src/db/schema.ts`, `frontend/src/db/notesRepo.ts` | `[x] COMPLETED` |
| **4** | [Real-Time Delta Sync Engine & Client State Machine](#step-4-real-time-delta-sync-engine--client-state-machine) | `frontend/src/sync/syncEngine.ts`, `frontend/src/sync/useSync.ts` | `[x] COMPLETED` |
| **5** | [Scalable Architecture & Folder Structure + Central User & Auth State Management](#step-5-scalable-architecture--folder-structure--central-user--auth-state-management) | `frontend/src/auth/`, `frontend/src/navigation/`, `frontend/src/core/`, `frontend/src/services/` | `[x] COMPLETED` |
| **6** | [Universal Intake Bar & Minimalist Workspace Canvas](#step-6-universal-intake-bar--minimalist-workspace-canvas) | `frontend/src/screens/notes/NotesHomeScreen.tsx`, `frontend/src/components/intake/` | `[ ] PENDING` |
| **7** | [Composable Block-Based Note Surface & AST Engine](#step-7-composable-block-based-note-surface--ast-engine) | `frontend/src/components/editor/BlockEditor.tsx`, `frontend/src/core/astSerializer.ts` | `[ ] PENDING` |
| **8** | [Ask-Before-Write Ambiguity Gate & Multi-Modal Asset Pipeline](#step-8-ask-before-write-ambiguity-gate--multi-modal-asset-pipeline) | `frontend/src/components/intake/ClarificationModal.tsx`, `frontend/src/services/assetService.ts` | `[ ] PENDING` |
| **9** | [Conversational Onboarding Flow & Layer 1 Profile Screen](#step-9-conversational-onboarding-flow--layer-1-profile-screen) | `frontend/src/screens/OnboardingScreen.tsx`, `ProfileScreen.tsx` | `[ ] PENDING` |
| **10** | [Phase 2 Cross-Platform Verification & E2E Sync Testing](#step-10-phase-2-cross-platform-verification--e2e-sync-testing) | `frontend/__tests__/`, `backend/tests/test_sync.py` | `[ ] PENDING` |

---

## 2. Detailed Step-by-Step Milestones

---

### Step 1: Expo Universal Scaffolding & Pastel Tile Design System Tokens
* **Objective:** Scaffold the cross-platform Expo application targeting iOS, Android, and Web from a single codebase, establishing the complete semantic token hierarchy defined in [ScribeX-Pastel-Tile-UI-Design-System.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/ScribeX-Pastel-Tile-UI-Design-System.md).
* **Deliverables:**
  * `frontend/`:
    * Initialized Expo project (`expo`, `expo-router`, `react-native`, `react-native-web`, `lucide-react-native`).
    * Configured TypeScript (`tsconfig.json`) and path aliases (`@/*`).
  * `frontend/src/theme/tokens.ts`:
    * **Light Theme Tokens:**
      * Outer canvas: `--color-app-bg: #E8ECF5`
      * Main workspace: `--color-surface: #FFFFFF`
      * Primary text: `--color-text-primary: #171717`
      * Secondary text: `--color-text-secondary: #626262`
      * Muted text: `--color-text-muted: #929292`
      * Subtle divider: `--color-border-subtle: #E8E8E8`
      * Circular actions: `--color-icon-bg: #111111`, icon: `--color-icon-fg: #FFFFFF`
    * **Dark Theme Tokens (Charcoal Canvas):**
      * Outer & main workspace: `--color-app-bg: #242424`, `--color-surface: #242424`
      * Raised action surfaces: `--color-surface-raised: #303030`
      * Primary text: `--color-text-primary: #F7F7F7`
      * Secondary text: `--color-text-secondary: #B5B5B5`
      * Muted text: `--color-text-muted: #858585`
      * Subtle divider: `--color-border-subtle: #3A3A3A`
      * Raised icon controls: `--color-icon-bg: #383838`, icon: `--color-icon-fg: #FFFFFF`
    * **Shared Pastel Palette Tokens:**
      * Apricot: `--note-apricot: #FFC96F`, Coral: `--note-coral: #FF9277`, Lime: `--note-lime: #E5F28B`
      * Lavender: `--note-lavender: #B18AF3`, Cyan: `--note-cyan: #08C4E5`, Pink: `--note-pink: #F5A4C6`, Sky: `--note-sky: #8EDCEB`
      * **CRITICAL RULE:** Avoid creating generic UI layouts like cards and standard box components. Use clean typography, open space, and bespoke layout rhythms.
  * `frontend/src/theme/ThemeProvider.tsx`:
    * Theme context supporting light, dark, and system preference with persistent local storage.
* **Verification Criteria:**
  * `npx expo start` boots cleanly for Web, iOS, and Android.
  * Switching between light and dark themes transitions smoothly without page reloads.

---

### Step 2: Backend Delta Sync Endpoints (WebSocket Doorbell + REST Catch-up)
* **Objective:** Implement the real-time server-side synchronization layer in FastAPI to support multi-device instant catch-up and push notifications.
* **Deliverables:**
  * `backend/app/api/sync_ws.py`:
    * Persistent WebSocket endpoint (`/ws/sync`).
    * In-memory connection manager tracking active client connections per `user_id`.
    * Doorbell broadcast trigger: whenever a note or entity is inserted/updated/deleted, broadcasts lightweight `{"type": "SYNC_PING", "latest_sync_rev": N}` to all active devices of that tenant.
  * `backend/app/api/sync_http.py`:
    * `GET /api/v1/sync/deltas?since_rev=X`: Returns ordered array of changelog deltas from `sync_changelog` where `sync_rev > X`.
    * `POST /api/v1/sync/push`: Accepts client-originated offline mutations, executes atomic SQLite commit $\rightarrow$ Git Vault projection $\rightarrow$ LanceDB indexing, and broadcasts `SYNC_PING`.
  * `backend/tests/test_sync.py`:
    * Automated test verifying WebSocket doorbell ping dispatch upon note save.
    * Automated test verifying delta retrieval catch-up handshake (`since_rev=0` vs `since_rev=N`).
* **Verification Criteria:**
  * Calling `/api/v1/sync/deltas?since_rev=0` returns valid serialized changelog entries.
  * Saving a note fires a WebSocket message to connected test clients in $< 20\text{ ms}$.

---

### Step 3: Client Offline-First SQLite Engine (`expo-sqlite`)
* **Objective:** Establish the local on-device SQLite database replica so that all reads occur instantly with sub-5ms latency and zero network spinners.
* **Deliverables:**
  * `frontend/src/db/sqliteClient.ts`:
    * Embedded SQLite connection manager using `expo-sqlite`.
    * Local schema initialization matching server core (`notes`, `local_sync_meta`, `pending_mutations`).
  * `frontend/src/db/notesRepo.ts`:
    * Local CRUD queries: `getLocalNotes()`, `getLocalNoteById()`, `saveLocalNote()`, `deleteLocalNote()`, and `applyServerDeltas()`.
* **Verification Criteria:**
  * Local database boots and inserts 100 sample notes with query latency $< 5\text{ ms}$.
  * App operates with complete read/write capability while offline (airplane mode).

---

### Step 4: Real-Time Delta Sync Engine & Client State Machine
* **Objective:** Build the bidirectional synchronization engine on the client that combines WebSocket doorbell push, HTTP catch-up handshake, and offline mutation drain.
* **Deliverables:**
  * `frontend/src/sync/syncEngine.ts`: Doorbell listener, catch-up handshake, and mutation queue drain.
  * `frontend/src/sync/useSync.ts`: React hook exposing sync status (`synced`, `syncing`, `offline`, `error`).
* **Verification Criteria:**
  * Editing a note on Device A triggers WebSocket doorbell ping $\rightarrow$ Device B applies delta and updates UI in $< 100\text{ ms}$.
  * Reconnecting cleanly flushes offline mutations without conflict.

---

### Step 5: Scalable Architecture & Folder Structure + Central User & Auth State Management
* **Objective:** Establish modular directory architecture, implement central authentication (`AuthContext`), and integrate dynamic multi-tenant session binding for the sync engine and local database.
* **Deliverables:**
  * Scalable directory architecture (`frontend/src/core/`, `theme/`, `db/`, `sync/`, `auth/`, `navigation/`, `screens/`, `services/`).
  * Central auth state management (`AuthContext.tsx`, `useAuth.ts`, `sessionStorage.ts`).
  * Dynamic multi-tenant sync & database binding with token handling.
* **Verification Criteria:**
  * Clean build with 0 TypeScript errors.
  * Sign-In / Sign-Out transitions immediately switch between the Auth Screen and the main Notes workspace.

---

### Step 6: Universal Intake Bar & Minimalist Workspace Canvas
* **Objective:** Build the unified input bar and the minimalist post-login workspace canvas adhering to non-generic UI principles (clean typography, generous whitespace, bespoke non-card layout rhythms, and top-right mode/logout controls).
* **Deliverables:**
  * `frontend/src/screens/notes/NotesHomeScreen.tsx`:
    * Clean, distraction-free workspace canvas with top-right theme toggle and logout actions.
    * Prominent workspace heading with dynamic greeting and active status indicators.
    * Dynamic non-card note rendering with high-contrast text and pastel accent tokens.
  * `frontend/src/components/intake/IntakeBar.tsx`:
    * Universal Intake Bar for friction-free text capture, voice audio recording, and file drops.
    * Connects directly to `POST /api/v1/intake` on the VPS backend.
* **Verification Criteria:**
  * Friction-free text capture writes optimistically to local SQLite and syncs in $< 50\text{ ms}$.
  * Avoids generic card patterns; provides bespoke, fluid responsive workspace layout.

---

### Step 7: Composable Block-Based Note Surface & AST Engine
* **Objective:** Implement the universal block-based note editor supporting the 20-block registry (paragraphs, headings, checklists, code, KaTeX, audio transcripts, callouts) and the bidirectional Extended Markdown AST serializer.
* **Deliverables:**
  * `frontend/src/core/astSerializer.ts`:
    * Bidirectional converter: parses Markdown with inline block metadata $\longleftrightarrow$ reactive `NoteBlock[]`.
    * Injects deterministic task IDs (`<!-- scribex:task id=... -->`) into Markdown task items for single-source-of-truth syncing.
  * `frontend/src/components/editor/BlockEditor.tsx`:
    * Composable, fluid block surface supporting inline editing, reordering, and type conversion.
    * Unified task interaction: checking off an inline task updates the unified `tasks` table and emits a task delta.
    * Auto-save debounce (300ms) triggering optimistic local SQLite save and sync queue.
* **Verification Criteria:**
  * Markdown AST serialization and deserialization round-trips with 100% data fidelity.
  * Editing an inline task inside a note immediately syncs to the global task state.

---

### Step 8: Ask-Before-Write Ambiguity Gate & Multi-Modal Asset Pipeline
* **Objective:** Build the interactive Clarification Modal for the Ask-Before-Write Ambiguity Gate and integrate the binary asset upload pipeline.
* **Deliverables:**
  * `frontend/src/components/intake/ClarificationModal.tsx`:
    * Intercepts `status: "NEEDS_CLARIFICATION"` from `POST /api/v1/intake`.
    * Presents Friday's clarifying questions with actionable choice pills and text input.
    * Dispatches user resolution to `POST /api/v1/intake/{staging_id}/clarify`.
  * `frontend/src/services/assetService.ts`:
    * Handles multipart uploads to `POST /api/v1/assets/upload`.
    * Listens for WebSocket `ASSET_PROCESSED` events to hydrate OCR and Whisper transcripts.
* **Verification Criteria:**
  * Ambiguous intake inputs pause and display the Clarification Modal.
  * Submitting an answer resolves the staging item and updates the note canvas with zero layout shift.

---

### Step 9: Conversational Onboarding Flow & Layer 1 Profile Screen
* **Objective:** Build the interactive onboarding interview interface that guides new users through the 6 profile pillars on first launch and exposes the living cognitive profile viewer.
* **Deliverables:**
  * `frontend/src/screens/OnboardingScreen.tsx`:
    * Multi-turn conversational interface connecting to `POST /api/v1/onboarding/start`, `/message`, `/finalize`.
    * Guided questions and user responses across the 6 pillars.
  * `frontend/src/screens/ProfileScreen.tsx`:
    * Dynamic viewer for Layer 1 Core Identity (`_core/identity.md`).
    * Displays User Mindset, Active Goals, Current Top Priorities, and Note Groups.
* **Verification Criteria:**
  * Completing the onboarding interview transitions the app into the main Notes workspace with initial seed context.

---

### Step 10: Phase 2 Cross-Platform Verification & E2E Sync Testing
* **Objective:** Execute automated and manual end-to-end verification across Web, iOS, and Android to guarantee performance, design system fidelity, and sync resilience.
* **Deliverables:**
  * Component and integration tests for AST serializer, block editor, and ClarificationModal.
  * Theme switching test verifying high-contrast dark text on pastel accents in both themes.
  * Offline sync engine unit tests simulating network loss and recovery.
  * Cross-platform build checks (`npx expo export --platform web`, iOS, Android).
* **Verification Criteria:**
  * 100% test pass rate across frontend and backend sync test suites.
  * Two active browser/device clients sync note edits bidirectionally in $< 100\text{ ms}$.

---

## 3. How We Track and Execute

1. We work on **one step at a time**.
2. Before starting a step, we mark its status as `[ ] IN_PROGRESS` in this document and in [Master_Tasks_Tracker.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Master_Tasks_Tracker.md).
3. Once the step's code is written and verified against its test criteria, we mark it as `[x] COMPLETED` and move to the next step.
4. Git commits will reference the specific step (e.g., `feat(phase2): step 5 - scalable architecture and central auth state management`).
5. **No code will be pushed to GitHub until the user explicitly says so.**
