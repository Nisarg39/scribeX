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
| **2** | [Backend Delta Sync Endpoints (WebSocket Doorbell + REST Catch-up)](#step-2-backend-delta-sync-endpoints-websocket-doorbell--rest-catch-up) | `backend/app/api/sync_ws.py`, `backend/app/api/sync_http.py`, `backend/tests/test_sync.py` | `[ ] PENDING` |
| **3** | [Client Offline-First SQLite Engine (`expo-sqlite`)](#step-3-client-offline-first-sqlite-engine-expo-sqlite) | `frontend/src/db/sqliteClient.ts`, `frontend/src/db/schema.ts`, `frontend/src/db/notesRepo.ts` | `[ ] PENDING` |
| **4** | [Real-Time Delta Sync Engine & Client State Machine](#step-4-real-time-delta-sync-engine--client-state-machine) | `frontend/src/sync/syncEngine.ts`, `frontend/src/sync/useSync.ts` | `[ ] PENDING` |
| **5** | [Pastel Tile Notes Grid & Shell Architecture](#step-5-pastel-tile-notes-grid--shell-architecture) | `frontend/src/components/shell/AppShell.tsx`, `Sidebar.tsx`, `NoteTile.tsx`, `NoteGrid.tsx` | `[ ] PENDING` |
| **6** | [Focused Note Editor & Reading Surface](#step-6-focused-note-editor--reading-surface) | `frontend/src/components/editor/NoteEditor.tsx`, `ColorPicker.tsx` | `[ ] PENDING` |
| **7** | [Universal Intake Bar & Ask-Before-Write Ambiguity Gate Modal](#step-7-universal-intake-bar--ask-before-write-ambiguity-gate-modal) | `frontend/src/components/intake/IntakeBar.tsx`, `ClarificationModal.tsx` | `[ ] PENDING` |
| **8** | [Conversational Onboarding Flow & Layer 1 Profile Screen](#step-8-conversational-onboarding-flow--layer-1-profile-screen) | `frontend/src/screens/OnboardingScreen.tsx`, `ProfileScreen.tsx` | `[ ] PENDING` |
| **9** | [Phase 2 Cross-Platform Verification & E2E Sync Testing](#step-9-phase-2-cross-platform-verification--e2e-sync-testing) | `frontend/__tests__/`, `backend/tests/test_sync.py` | `[ ] PENDING` |

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
    * **Shared Pastel Tile Palette (Preserved in Both Light & Dark Modes):**
      * Apricot: `--note-apricot: #FFC96F`
      * Coral: `--note-coral: #FF9277`
      * Lime: `--note-lime: #E5F28B`
      * Lavender: `--note-lavender: #B18AF3`
      * Cyan: `--note-cyan: #08C4E5`
      * Pink: `--note-pink: #F5A4C6`
      * Sky: `--note-sky: #8EDCEB`
      * Star Favorite: `--color-favorite: #FFD43B`
      * **CRITICAL RULE:** Dark text (`#191919`) on all pastel note tiles in both light and dark modes for high contrast readability.
    * **Spacing & Typography:**
      * 4px base rhythm (`space-1` = 4px to `space-16` = 64px).
      * Clean modern sans-serif stack (`Inter`, system fallback).
      * Shape radii: `16-20px` for note tiles, `40-44px` circular action buttons.
  * `frontend/src/theme/ThemeProvider.tsx`:
    * Theme context supporting light, dark, and system preference with persistent local storage.
* **Verification Criteria:**
  * `npx expo start` boots cleanly for Web, iOS, and Android.
  * Switching between light and dark themes transitions smoothly without inverting or darkening pastel note tile colors.

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
    * Local schema initialization matching server core:
      * `notes`: `id`, `group_name`, `title`, `content_markdown`, `priority_score`, `color_token`, `is_favorite`, `sync_rev`, `updated_at`.
      * `local_sync_meta`: `current_sync_rev`, `last_synced_at`.
      * `pending_mutations`: `id`, `entity_id`, `mutation_type`, `payload`, `created_at`.
  * `frontend/src/db/notesRepo.ts`:
    * Local CRUD queries:
      * `getLocalNotes(groupFilter?: string)`: Fast indexed read sorted by `updated_at DESC`.
      * `getLocalNoteById(id: string)`.
      * `saveLocalNote(note: Partial<Note>)`: Optimistic local write + stages pending mutation.
      * `deleteLocalNote(id: string)`: Optimistic local delete.
      * `applyServerDeltas(deltas: SyncDelta[])`: Atomic transaction applying server updates and updating `current_sync_rev`.
* **Verification Criteria:**
  * Local database boots and inserts 100 sample notes with query latency $< 5\text{ ms}$.
  * App operates with complete read/write capability while offline (airplane mode).

---

### Step 4: Real-Time Delta Sync Engine & Client State Machine
* **Objective:** Build the bidirectional synchronization engine on the client that combines WebSocket doorbell push, HTTP catch-up handshake, and offline mutation drain.
* **Deliverables:**
  * `frontend/src/sync/syncEngine.ts`:
    * **Doorbell Listener:** Connects to `ws://.../ws/sync`; on receiving `SYNC_PING`, immediately requests delta catch-up if `latest_sync_rev > current_sync_rev`.
    * **Catch-Up Handshake:** Queries `GET /api/v1/sync/deltas?since_rev=current_sync_rev`, writes changes to local SQLite, and advances `current_sync_rev`.
    * **Offline Mutation Queue:** Drains `pending_mutations` to `POST /api/v1/sync/push` upon network reconnection.
    * **Lifecycle Reconnect:** Uses React Native `AppState` to trigger catch-up handshake when app returns from background or device unlocks.
  * `frontend/src/sync/useSync.ts`:
    * React hook exposing sync status (`synced`, `syncing`, `offline`, `error`) and manual pull-to-refresh trigger.
* **Verification Criteria:**
  * Editing a note on Device A triggers WebSocket doorbell ping $\rightarrow$ Device B applies delta and updates UI in $< 100\text{ ms}$.
  * Performing 3 edits offline and reconnecting cleanly flushes mutations to the server without conflict.

---

### Step 5: Pastel Tile Notes Grid & Shell Architecture
* **Objective:** Implement the signature visual experience defined in the Pastel Tile UI Design System: clean navigation rail, large bold "Notes" heading, minimal top search row, and high-contrast pastel note tiles.
* **Deliverables:**
  * `frontend/src/components/shell/AppShell.tsx`:
    * Desktop shell: Fixed-width quiet sidebar/rail (**96–112 px**), 1px subtle divider (`#E8E8E8` / `#3A3A3A`), large main workspace with generous padding (**56–72 px** desktop, **24–32 px** tablet).
    * Mobile shell: Responsive top bar with collapsible drawer.
  * `frontend/src/components/shell/Sidebar.tsx`:
    * Brand header at top-left.
    * Signature **Add-note button**: Circular dark button (**42–48 px** diameter, `#111111` in light mode, `#383838` in dark mode) with centered white plus icon.
    * Theme toggle button (sun/moon icon).
  * `frontend/src/components/notes/SearchField.tsx`:
    * Minimal top search input with small search icon and muted placeholder (`#929292` / `#858585`).
  * `frontend/src/components/notes/PageHeading.tsx`:
    * Prominent, bold "Notes" heading (**44–52 px** desktop, **34–40 px** mobile, weight 700).
  * `frontend/src/components/notes/NoteTile.tsx`:
    * **Signature Component:**
      * Pastel background selected from token palette (`#FFC96F`, `#FF9277`, `#E5F28B`, `#B18AF3`, `#08C4E5`, `#F5A4C6`, `#8EDCEB`).
      * High-contrast dark text (`#191919`) for title and preview.
      * Left-aligned title/preview at top; secondary muted date label at bottom-left.
      * Circular star favorite button (**32 px**) at top-right with `#FFD43B` yellow star.
      * Circular dark edit action button (**40–44 px**) at bottom-right.
      * Corner radius: **16–20 px**, padding: **22–26 px** (desktop) / **14–18 px** (mobile), minimum height: **220–245 px**.
      * Subtle hover surface lift; zero dramatic zoom or heavy drop shadow.
  * `frontend/src/components/notes/NoteGrid.tsx`:
    * Responsive CSS Grid (3–4 columns desktop, 2 columns tablet, 1–2 columns mobile, **24–32 px** gap desktop, **12–16 px** gap mobile).
* **Verification Criteria:**
  * Pixel-accurate visual alignment with `docs/ScribeX-Pastel-Tile-UI-Design-System.md`.
  * Grid renders 50 notes smoothly with 60 FPS scrolling and zero layout shift.

---

### Step 6: Focused Note Editor & Reading Surface
* **Objective:** Implement the distraction-free reading surface and Markdown note editor that preserves the note's pastel color identity while providing maximum reading comfort.
* **Deliverables:**
  * `frontend/src/components/editor/NoteEditor.tsx`:
    * Focused reading surface: Charcoal canvas (`#242424`) in dark mode, clean white (`#FFFFFF`) in light mode.
    * Prominent left-aligned title (**28–36 px** desktop) with date subtitle below.
    * Body typography with generous line height (**1.55–1.75**) and comfortable max line length.
    * Compact rounded top navigation controls (back, favorite, color picker, delete).
    * Auto-save debounce (300ms) triggering optimistic local SQLite save and sync queue.
  * `frontend/src/components/editor/ColorPicker.tsx`:
    * Compact circular pastel swatches allowing instant reassignment of the note's pastel palette token.
* **Verification Criteria:**
  * Opening a note opens the editor with instant transition.
  * Typing notes auto-saves locally and updates tile preview in real time without lag.

---

### Step 7: Universal Intake Bar & Ask-Before-Write Ambiguity Gate Modal
* **Objective:** Build the universal entry point widget for quick thoughts, voice memos, and document uploads, equipped with an interactive modal that presents Friday's clarifying questions when ambiguity is detected.
* **Deliverables:**
  * `frontend/src/components/intake/IntakeBar.tsx`:
    * Compact floating or header intake field with text input, voice record button, and file upload trigger.
    * Dispatches to `POST /api/v1/intake` on the VPS backend.
  * `frontend/src/components/intake/ClarificationModal.tsx`:
    * **Ambiguity Gate UI:**
      * Triggers when backend returns `status: "NEEDS_CLARIFICATION"`.
      * Displays Friday's friendly clarification banner: *"I noticed some ambiguity before writing to your vault."*
      * Lists specific clarifying questions (e.g. *"Which project specs should I update?"*).
      * Input field for user clarification response.
      * Submits to `POST /api/v1/intake/{staging_id}/clarify`.
      * On `status: "PROCESSED"`, modal closes with a subtle success toast and the new note tile slides into the grid.
* **Verification Criteria:**
  * Entering *"Update the specs"* pops up the clarification dialog with questions.
  * Typing answers resolves the clarification, creates the note, and displays the new pastel tile in the grid.

---

### Step 8: Conversational Onboarding Flow & Layer 1 Profile Screen
* **Objective:** Build the interactive onboarding interview interface that guides new users through the 6 profile pillars on first launch and exposes the living cognitive profile viewer.
* **Deliverables:**
  * `frontend/src/screens/OnboardingScreen.tsx`:
    * Multi-turn conversational interface connecting to `POST /api/v1/onboarding/start`, `/message`, `/finalize`.
    * Elegant chat presentation showing Friday's guided questions and user responses across the 6 pillars.
    * Progress indicator showing completed pillars (1 through 6).
    * Finalization screen celebrating profile creation and loading seeded notes.
  * `frontend/src/screens/ProfileScreen.tsx`:
    * Dynamic viewer for Layer 1 Core Identity (`_core/identity.md`).
    * Displays User Mindset, Active Goals, Current Top Priorities, and Note Groups.
* **Verification Criteria:**
  * Completing the onboarding interview transitions the app into the main Notes grid populated with initial seed notes.
  * Profile screen displays living identity details synced from the backend.

---

### Step 9: Phase 2 Cross-Platform Verification & E2E Sync Testing
* **Objective:** Execute automated and manual end-to-end verification across Web, iOS, and Android to guarantee performance, design system fidelity, and sync resilience.
* **Deliverables:**
  * `frontend/__tests__/`:
    * Component tests for `NoteTile`, `NoteGrid`, `NoteEditor`, `ClarificationModal`.
    * Theme switching test verifying high-contrast dark text on pastel tiles in both themes.
    * Offline sync engine unit tests simulating network loss and recovery.
  * `backend/tests/test_sync.py`:
    * Backend integration tests verifying multi-device delta sync transactions and WebSocket push.
  * Cross-platform build checks:
    * `npx expo export --platform web` builds cleanly for production.
    * `npx expo run:ios` and `npx expo run:android` pass compilation.
* **Verification Criteria:**
  * 100% test pass rate across frontend and backend sync test suites.
  * Two active browser/device clients sync note edits bidirectionally in $< 100\text{ ms}$.

---

## 3. How We Track and Execute

1. We work on **one step at a time**.
2. Before starting a step, we mark its status as `[ ] IN_PROGRESS` in this document and in [Master_Tasks_Tracker.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Master_Tasks_Tracker.md).
3. Once the step's code is written and verified against its test criteria, we mark it as `[x] COMPLETED` and move to the next step.
4. Git commits will reference the specific step (e.g., `feat(phase2): step 1 - expo scaffolding and pastel tile design system tokens`).
5. **No code will be pushed to GitHub until the user explicitly says so.**
