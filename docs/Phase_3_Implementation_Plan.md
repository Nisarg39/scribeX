# Phase 3: Step-by-Step Implementation Plan
## Comprehensive Manual Note Input, Block Manipulation & Relations Engine

> **Document Status:** Active Implementation Plan  
> **Source Origin & Specifications:**  
> - [Universal_Note_Input_Structure_and_Relations.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Universal_Note_Input_Structure_and_Relations.md)  
> - [ScribeX-Pastel-Tile-UI-Design-System.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/ScribeX-Pastel-Tile-UI-Design-System.md)  
> - [Technical_System_Architecture.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md)  
> - [Master_Tasks_Tracker.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Master_Tasks_Tracker.md)  
> **Execution Strategy:** Perfect all manual note entry, block manipulation, rich inputs, folder structures, tags, and cross-note relational links **prior** to activating autonomous AI learning loops.

---

## 1. Master Progress Tracker

Use this checklist to track execution. Each step is modular, fully specified, and accompanied by automated verification commands.

| Step | Milestone / Component | Primary Files | Status |
| :---: | :--- | :--- | :---: |
| **1** | [Universal Block Manipulation & Reordering Engine](#step-1-universal-block-manipulation--reordering-engine) | `frontend/src/components/editor/BlockEditor.tsx`, `frontend/src/core/astSerializer.ts` | `[ ] PENDING` |
| **2** | [Rich Manual Content Blocks: Tables, Code, LaTeX & Callouts](#step-2-rich-manual-content-blocks-tables-code-latex--callouts) | `frontend/src/components/editor/blocks/`, `frontend/src/core/astSerializer.ts` | `[ ] PENDING` |
| **3** | [Multi-Modal Media Ingestion & Viewers (Audio, Docs, Web Links)](#step-3-multi-modal-media-ingestion--viewers) | `frontend/src/components/intake/`, `backend/app/api/assets.py` | `[ ] PENDING` |
| **4** | [Folder Hierarchy & Physical Vault Directory Mirroring](#step-4-folder-hierarchy--physical-vault-directory-mirroring) | `frontend/src/db/notesRepo.ts`, `backend/app/storage/git_vault.py`, `frontend/src/screens/notes/` | `[ ] PENDING` |
| **5** | [Multi-Tags, Starred Favorites, Archive & Recoverable Trash](#step-5-multi-tags-starred-favorites-archive--recoverable-trash) | `frontend/src/db/schema.ts`, `frontend/src/screens/notes/NotesHomeScreen.tsx` | `[ ] PENDING` |
| **6** | [Bidirectional Cross-Note Links (`[[Note]]`) & Relational Knowledge Graph](#step-6-bidirectional-cross-note-links--relational-knowledge-graph) | `frontend/src/components/editor/LinkAutocomplete.tsx`, `backend/app/storage/sqlite_db.py` | `[ ] PENDING` |
| **7** | [Fast Local Full-Text Search & Dynamic Smart Collections](#step-7-fast-local-full-text-search--dynamic-smart-collections) | `frontend/src/screens/notes/SearchFilterBar.tsx`, `frontend/src/db/searchRepo.ts` | `[ ] PENDING` |
| **8** | [Phase 3 Master Cross-Platform Verification Suite](#step-8-phase-3-master-cross-platform-verification-suite) | `frontend/src/core/verify_phase3_suite.ts`, `backend/tests/test_phase3_manual.py` | `[ ] PENDING` |

---

## 2. Detailed Step-by-Step Milestones

---

### Step 1: Universal Block Manipulation & Reordering Engine
* **Objective:** Enable users to seamlessly manipulate blocks within any note: inserting new blocks at arbitrary positions, reordering existing blocks (up/down/drag), deleting blocks, splitting/merging blocks on Enter/Backspace, and transforming block types.
* **Deliverables:**
  * `frontend/src/components/editor/BlockEditor.tsx`:
    * Inline block inserter (+ button between blocks and at document bottom).
    * Block reordering controls (Move Up, Move Down, Drag Handle).
    * Block deletion with confirmation prevention for non-empty content.
    * Block type switcher supporting all registered block types.
    * Smooth keyboard navigation (Enter creates a new block below; Backspace on empty block removes it and focuses previous block).
  * `frontend/src/core/astSerializer.ts`:
    * Robust serialization preserving exact block order and positions (`position: number`).
* **Verification:** Run `npx tsx src/core/verify_block_manipulation.ts` to verify block insertion, reordering, and AST round-trip fidelity.

---

### Step 2: Rich Manual Content Blocks (Tables, Code, LaTeX & Callouts)
* **Objective:** Implement interactive and functional renderers for the core structured data blocks defined in Section 1 of [Universal_Note_Input_Structure_and_Relations.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Universal_Note_Input_Structure_and_Relations.md).
* **Deliverables:**
  * **Table Block (`table`):**
    * Interactive grid editor supporting custom columns and rows.
    * Add/remove column and row controls.
    * CSV/TSV copy-paste import and export.
    * Serializes cleanly to Markdown table syntax.
  * **Code Block (`code`):**
    * Monospace editor with language badge (JavaScript, Python, TypeScript, SQL, JSON, HTML, Bash, etc.).
    * One-tap copy code to clipboard.
  * **Math & LaTeX Block (`equation`):**
    * LaTeX source input paired with live mathematical formula preview.
  * **Callout Block (`callout`):**
    * Selection among `info`, `warning`, `success`, and `quote` variants with pastel border highlights.
* **Verification:** Automated round-trip test verifying table parsing, code language retention, and KaTeX equation formatting.

---

### Step 3: Multi-Modal Media Ingestion & Viewers
* **Objective:** Enhance media handling so that audio recordings, documents (PDF/DOC), images, and web links function seamlessly inside notes and on home screen tiles.
* **Deliverables:**
  * **Audio Recording & Playback Block (`audio`):**
    * Audio recording controller in `IntakeBar` and `BlockEditor`.
    * Native/Web playback scrub bar with duration display and play/pause toggle.
  * **Document & Attachment Block (`file`):**
    * File attachment card displaying file name, extension pill, file size, and download/open action.
  * **Web Bookmark Preview (`bookmark`):**
    * OpenGraph metadata extractor parsing title, description, favicon, and thumbnail from pasted URLs.
  * **Image Lightbox:**
    * Full-screen preview modal on image tap with zoom and caption editing.
* **Verification:** Unit test uploading an audio file and PDF, verifying metadata extraction, asset endpoint streaming, and block rendering.

---

### Step 4: Folder Hierarchy & Physical Vault Directory Mirroring
* **Objective:** Provide a clean, intuitive folder structure that organizes notes while keeping the Universal Inbox as the default landing pad.
* **Deliverables:**
  * `frontend/src/screens/notes/FolderSidebar.tsx` / `FolderDrawer`:
    * Nested folder tree navigation (`Work/Projects/ScribeX`, `Personal/Journal`).
    * Create folder, rename folder, and delete folder actions.
    * Drag/select note relocation to move notes into folders or back to `_inbox/`.
  * `backend/app/storage/git_vault.py`:
    * Physical vault mirroring: when a note has `folder: "Work/Projects"`, the Markdown file is committed at `data/vault/{user_id}/folders/Work/Projects/{note_id}.md`.
    * Moving a note automatically executes a `git mv` commit preserving Git history.
* **Verification:** Test creating a folder, moving a note, and verifying that both SQLite `notes.folder_path` and the Git Vault file path update cleanly.

---

### Step 5: Multi-Tags, Starred Favorites, Archive & Recoverable Trash
* **Objective:** Implement orthogonal multi-tagging, priority pinning, non-destructive archiving, and a 30-day recoverable trash bin.
* **Deliverables:**
  * **Multi-Tags (`#tag`):**
    * Inline tag input and chip rendering (`#urgent`, `#idea`, `#meeting`).
    * Horizontal tag filter strip on `NotesHomeScreen.tsx` allowing multi-tag combination filtering.
  * **Favorites & Pinning:**
    * Pinned notes surface at the top of the masonry layout with subtle pastel badge indicators.
  * **Archive System:**
    * Archive action that hides inactive notes from the primary stream while keeping them fully searchable and linkable.
  * **Recoverable Trash:**
    * Soft-delete (`status = 'trash'`) retaining notes for 30 days.
    * Trash view with "Restore" and "Permanently Delete" options.
* **Verification:** Test tag filtering queries, pinning reorder logic, and soft-delete/restore cycle in `sqliteClient`.

---

### Step 6: Bidirectional Cross-Note Links (`[[Note]]`) & Relational Knowledge Graph
* **Objective:** Enable users to connect notes using `[[Note Title]]` wiki-links, establishing bidirectional relationships stored in the SQLite knowledge graph.
* **Deliverables:**
  * `frontend/src/components/editor/LinkAutocomplete.tsx`:
    * Triggered by typing `[[` in any text block.
    * Live search popover suggesting existing notes.
    * Inserts `[[note_id|Note Title]]` into the AST.
  * `backend/app/storage/sqlite_db.py` & `frontend/src/db/`:
    * Automatic extraction of links on note save, recording edges in `entity_relations` (`relates_to`, `part_of`, `supersedes`).
  * **Backlinks Drawer:**
    * Note editor sidebar displaying all other notes referencing the active note.
* **Verification:** Test creating a bidirectional link between Note A and Note B, verifying edge creation in `entity_relations` and backlink query resolution.

---

### Step 7: Fast Local Full-Text Search & Dynamic Smart Collections
* **Objective:** Deliver instant (< 5ms) local search across note titles, block text, tags, and folders, with pre-configured smart collections.
* **Deliverables:**
  * `frontend/src/screens/notes/SearchFilterBar.tsx`:
    * Instant search bar with clear button and real-time highlighted match snippets.
  * `frontend/src/db/searchRepo.ts`:
    * SQLite FTS / parameterized query searching across `title`, `content_markdown`, `group_name`, `folder_path`, and `tags`.
  * **Smart Collections:**
    * Quick filter presets: "Tasks & Checklists", "Media & Attachments", "Archived", "Recent Thoughts".
* **Verification:** Benchmark search query latency with 500 mock notes ensuring < 5ms response time.

---

### Step 8: Phase 3 Master Cross-Platform Verification Suite
* **Objective:** Execute an end-to-end verification suite testing all manual note manipulation, block operations, media attachments, folders, tags, and relational graph links.
* **Deliverables:**
  * `frontend/src/core/verify_phase3_suite.ts`:
    * Sequential runner executing all Phase 3 automated integration tests.
  * `backend/tests/test_phase3_manual.py`:
    * Full suite testing folder moves in Git Vault, multi-tag sync deltas, and relational edge persistence.
* **Verification:** 100% green exit code on both `npm run test:phase3` and `.venv/bin/pytest tests/test_phase3_manual.py`.
