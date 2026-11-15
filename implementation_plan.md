# Implementation Plan: Pre-Seeded Interactive 'Welcome to ScribeX' Starter Note (Point 37)

> **Target:** Implement Point 37 from [`docs/future_ideas.md`](docs/future_ideas.md): Pre-seed an interactive, beautifully formatted 'Welcome to ScribeX' starter note that a new user sees immediately upon navigating to the Home screen on first launch or when the database is empty.  
> **Status:** Completed & Verified (`tsc --noEmit`, `test_starter_note_seeding.mjs`, `test_pin_password_security.mjs`, and `test:uiux` all 100% passing)

## 1. Requirement & Architecture Overview
- **Goal:** Never leave first-time users or users with an empty notebook staring at an empty, blank canvas. Provide an interactive showcase note demonstrating:
  1. The 42 composable input blocks and the slash command system (`/`).
  2. ScribeX pastel design system tokens (`lime`, `apricot`, `cyan`, `coral`, `lavender`, `pink`, `sky`).
  3. Interactive, multi-priority checklists that project directly into the global task board.
  4. Formatted KaTeX mathematical formulas (`equation` block).
  5. Multi-variant callouts (`info`, `warning`, `success`, `quote`).
  6. Offline reminder, recurrence, and in-app notification center tips.
  7. Zero-knowledge PIN/password security vault controls.
- **Entry Experience:**
  - Pinned (`isPinned: true`) and Favorited (`isFavorite: true`) with pastel `lavender` token.
  - Placed in `General` folder with tags: `['getting-started', 'guide', 'scribex', 'blocks']`.
  - Appears immediately in the top Pinned grid on the Home screen (`/home`).
  - Tapping opens the full-bleed editor with working interactive blocks.

## 2. Technical Strategy & Data Flow

### A. Dedicated Starter Note Definition (`frontend/src/state/starterNote.ts`)
Create a single source of truth containing:
- `WELCOME_STARTER_NOTE`:
  - `id: 'note-welcome-starter'`
  - `title: 'Welcome to ScribeX 👋'`
  - `blocks`: Curated, interactive AST block structures:
    - **Header 1:** Welcome title & subtext.
    - **Callout Block (`info`):** Local-first offline architecture summary (sub-5ms SQLite WAL).
    - **Heading 2 + Paragraph:** The Slash Command System (`/text`, `/checklist`, `/equation`, `/callout`, etc.).
    - **Checklist Block:** Interactive tasks with priorities (`urgent`, `high`, `medium`), due dates, and checkboxes linked to the task board.
    - **Heading 2 + Equation Block:** KaTeX rendering (e.g., Euler's identity \(e^{i\pi} + 1 = 0\) and Gaussian integral \(\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}\)).
    - **Heading 2 + Callout Block (`quote`):** Design tokens & pastel palette philosophy.
    - **Heading 2 + Callout Block (`warning`):** Offline alarms, scheduled reminders, and repeat rules.
    - **Heading 2 + Code Block:** SQLite and keyboard quick references.
    - **Heading 2 + Bulleted List / Table:** Reference map of all 42 input blocks.
  - `WELCOME_STARTER_TASKS`: Initial task projections matching the checklist items.

### B. Auto-Seed Gate on Empty Database (`frontend/src/state/useNotesStore.tsx`)
In `refreshFromDB()`:
- If `allNotes.length === 0` (first launch, guest session, or empty database), automatically invoke `seedWelcomeStarterNote()` via `notesRepo.createNote` and `tasksRepo.createTask`.
- Reload state so the user lands on `/home` with the interactive starter note seamlessly rendered without a loading delay or blank state.

### C. SQLite Wasm & Native Default Seeds Sync
- Update `client.web.ts` and `client.native.ts` `seedInitialDefaults` to include `note-welcome-starter` and its initial tasks so that fresh SQLite initializations instantly contain the note in the raw DB.

### D. Documentation Update
- Mark Point 37 in [`docs/future_ideas.md`](docs/future_ideas.md) as `[x] ... (COMPLETED)`.

## 3. Files in Scope
- `frontend/src/state/starterNote.ts` *(new)*
- `frontend/src/state/seedData.ts` *(update)*
- `frontend/src/state/useNotesStore.tsx` *(empty-database auto-seed hook)*
- `frontend/src/db/client.web.ts` *(SQL seed sync)*
- `frontend/src/db/client.native.ts` *(SQL seed sync)*
- `docs/future_ideas.md` *(status update)*

## 4. Verification Plan
1. **Type Safety:** `cd frontend && npx tsc --noEmit` (0 errors).
2. **Interactive Render & DB Test:** Automated verification script testing starter note insertion, AST block serialization, checklist task sync, and query retrieval on empty DB.
3. **UI/UX Cross-Platform Check:** `npm --prefix frontend run test:uiux`.

## Recommended Execution

| Slash Command | Fit Evaluation |
| :--- | :--- |
| **`/plan`** | **Best Fit (Recommended).** Well-defined modular content and data seed integration with clear acceptance criteria across 4 files. |
| `/boost` | Heavyweight for a starter note seeding task, though applicable if multi-angle review is desired. |
| `/teamwork` | Unnecessary given the cohesive scope. |

**Recommendation:** Type **`/plan`** or reply with **"Proceed"** to apply this plan.
