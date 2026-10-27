# Phase 1: Step-by-Step Implementation Plan
## Universal Manual Note Engine & Local-First Canvas (Core User Journey)

> **Document Status:** Active Implementation Blueprint  
> **Target Directory:** `frontend/`  
> **Source of Truth Specifications:**  
> - [Universal_Note_Input_Structure_and_Relations.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Universal_Note_Input_Structure_and_Relations.md)  
> - [Technical_System_Architecture.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md)  
> - [ScribeX-Pastel-Tile-UI-Design-System.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/ScribeX-Pastel-Tile-UI-Design-System.md)  
> - [Master_Tasks_Tracker.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Master_Tasks_Tracker.md)  
> **Critical Design Constraint:** Strictly avoid generic card grids, boxy SaaS widgets, and cookie-cutter dashboards. Adhere to `<RULE[user_global]>`: Deliver a serene, soft minimalist editorial canvas with vivid pastel note accents, generous whitespace, and restrained circular controls.

---

## 1. Master Progress Tracker

Use this checklist to track execution. Every step must be implemented, tested, and verified before marking as completed and advancing to the next step.

| Step | Milestone / Component | Primary Files | Status |
| :---: | :--- | :--- | :---: |
| **1** | [Universal Expo Scaffolding, NativeWind v4 & Design Tokens](#step-1-universal-expo-scaffolding-nativewind-v4--design-tokens) | `frontend/package.json`, `frontend/tailwind.config.js`, `frontend/src/theme/tokens.ts`, `frontend/app/_layout.tsx` | `[x] COMPLETED` |
| **2** | [Local-First Client SQLite Engine (`expo-sqlite` / OPFS)](#step-2-local-first-client-sqlite-engine-expo-sqlite--opfs) | `frontend/src/db/schema.ts`, `frontend/src/db/client.ts`, `frontend/src/db/types.ts` | `[ ] PENDING` |
| **3** | [Core Data Repositories (Notes, Blocks, Folders, Tags)](#step-3-core-data-repositories-notes-blocks-folders-tags) | `frontend/src/db/notesRepo.ts`, `frontend/src/db/foldersRepo.ts`, `frontend/src/db/tagsRepo.ts` | `[ ] PENDING` |
| **4** | [Composable Block Editor Engine & Standard AST Renderers](#step-4-composable-block-editor-engine--standard-ast-renderers) | `frontend/src/components/editor/BlockEditor.tsx`, `frontend/src/components/editor/BlockRenderer.tsx`, `frontend/src/core/astSerializer.ts` | `[ ] PENDING` |
| **5** | [Structured Data Blocks: Tables, Code Blocks, LaTeX & Callouts](#step-5-structured-data-blocks-tables-code-blocks-latex--callouts) | `frontend/src/components/editor/blocks/TableBlock.tsx`, `CodeBlock.tsx`, `EquationBlock.tsx`, `CalloutBlock.tsx` | `[ ] PENDING` |
| **6** | [Multi-Modal Media & File Capture (Drawing, Audio, Attachments, Links)](#step-6-multi-modal-media--file-capture) | `frontend/src/components/editor/blocks/DrawingBlock.tsx`, `AudioBlock.tsx`, `FileBlock.tsx`, `BookmarkBlock.tsx` | `[ ] PENDING` |
| **7** | [Unified Task Engine (Embedded Checklists $\leftrightarrow$ Global Task View)](#step-7-unified-task-engine-embedded-checklists--global-task-view) | `frontend/src/db/tasksRepo.ts`, `frontend/src/components/editor/blocks/ChecklistBlock.tsx`, `frontend/src/screens/TasksScreen.tsx` | `[ ] PENDING` |
| **8** | [Folder Hierarchy & Physical Vault Directory Mirroring](#step-8-folder-hierarchy--physical-vault-directory-mirroring) | `frontend/src/components/navigation/FolderTree.tsx`, `frontend/src/screens/FoldersScreen.tsx` | `[ ] PENDING` |
| **9** | [Multi-Tags, Starred Favorites, Pinning, Archive & 30-Day Trash](#step-9-multi-tags-starred-favorites-pinning-archive--30-day-trash) | `frontend/src/components/ui/TagChips.tsx`, `frontend/src/screens/ArchiveTrashScreen.tsx` | `[ ] PENDING` |
| **10** | [Bidirectional Cross-Note Links (`[[Note Title]]`) & Relational Graph](#step-10-bidirectional-cross-note-links--relational-graph) | `frontend/src/components/editor/LinkAutocomplete.tsx`, `frontend/src/components/relations/BacklinksDrawer.tsx`, `frontend/src/db/relationsRepo.ts` | `[ ] PENDING` |
| **11** | [Fast Local Search (< 5ms via FTS5) & Dynamic Smart Collections](#step-11-fast-local-search--dynamic-smart-collections) | `frontend/src/db/searchRepo.ts`, `frontend/src/screens/SearchScreen.tsx` | `[ ] PENDING` |
| **12** | [Phase 1 Master Verification Suite & E2E Canvas Testing](#step-12-phase-1-master-verification-suite--e2e-canvas-testing) | `frontend/src/core/__tests__/manual_notes_suite.test.ts` | `[ ] PENDING` |

---

## 2. Detailed Step-by-Step Milestones

### Step 1: Universal Expo Scaffolding, NativeWind v4 & Design Tokens
* **Objective:** Initialize a clean, robust Expo SDK 52 universal app at `frontend/` supporting iOS, Android, and Desktop Web, configured with NativeWind v4 and design tokens.
* **Design Philosophy:**
  * **Strict Non-Generic UI:** Absolutely avoid cookie-cutter card grids, boxy outlines, and generic dashboard widgets.
  * **Soft Minimalism:** Editorial canvas with generous whitespace, high-contrast typography, vivid pastel accents (`apricot`, `coral`, `lime`, `lavender`, `cyan`, `pink`, `sky`), and restrained circular action controls.
* **Key Deliverables:**
  * `frontend/package.json`: Expo SDK 52+, React 18, React Native 0.76+, `expo-router`, `nativewind@^4.0.1`, `tailwindcss@^3.4.0`, `react-native-reanimated@~3.16.1`, `react-native-worklets`, `expo-sqlite@~15.0.0`.
  * `frontend/tailwind.config.js`: Preset with `nativewind/preset`, custom theme colors matching ScribeX tokens.
  * `frontend/global.css`: CSS root variables for light/dark pastel themes and reset styles.
  * `frontend/babel.config.js`: Configured with `nativewind/babel` and `react-native-worklets/plugin`.
  * `frontend/src/theme/tokens.ts`: Semantic color tokens, pastel note palettes, spacing scales, and typography hierarchies.
  * `frontend/src/theme/ThemeProvider.tsx`: Theme context provider supporting light/dark mode transitions without layout shift.
* **Verification Command:**
  ```bash
  cd frontend && npx expo start -c
  ```

---

### Step 2: Local-First Client SQLite Engine (`expo-sqlite` / OPFS)
* **Objective:** Establish the high-throughput local SQLite database running in WAL mode on native devices and OPFS (Origin Private File System) on Web, guaranteeing sub-5ms local reads and writes.
* **Core Schemas (`frontend/src/db/schema.ts`):**
  1. `folders`: Hierarchical project containers (`id`, `user_id`, `name`, `parent_id`, `path`, `color_token`, `icon`, `sync_rev`, `created_at`, `updated_at`).
  2. `tags`: Classification tags (`id`, `user_id`, `name`, `color_token`, `created_at`).
  3. `notes`: Core note documents (`id`, `user_id`, `folder_id`, `group_name`, `title`, `content_markdown`, `blocks_json`, `color_token`, `is_favorite`, `is_pinned`, `status`, `priority_score`, `sync_rev`, `created_at`, `updated_at`, `trashed_at`).
  4. `note_tags`: Many-to-many note-tag mapping (`note_id`, `tag_id`).
  5. `tasks`: Single-source-of-truth task entities (`id`, `user_id`, `note_id`, `block_id`, `title`, `is_completed`, `priority`, `due_date`, `sync_rev`, `created_at`, `updated_at`).
  6. `assets`: Binary attachments ledger (`id`, `user_id`, `storage_key`, `file_name`, `mime_type`, `size_bytes`, `sha256_hash`, `processing_status`, `extracted_text`, `created_at`).
  7. `entity_relations`: Knowledge graph edges (`id`, `user_id`, `source_id`, `relation_type`, `target_id`, `created_by`, `confidence_score`, `created_at`).
  8. `sync_changelog`: Event-sourced change tracking (`id`, `user_id`, `sync_rev`, `entity_type`, `entity_id`, `change_type`, `delta_payload`, `created_at`).
* **Key Deliverables:**
  * `frontend/src/db/client.ts`: Connection singleton managing database migration, WAL mode activation (`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`), and transaction helpers.
  * `frontend/src/db/types.ts`: TypeScript interfaces matching database schemas.

---

### Step 3: Core Data Repositories (Notes, Blocks, Folders, Tags)
* **Objective:** Provide clean, strongly typed repository classes for local CRUD operations and atomic multi-entity transactions.
* **Key Deliverables:**
  * `frontend/src/db/notesRepo.ts`:
    * `createNote(note: Partial<Note>): Promise<Note>`
    * `getNoteById(id: string): Promise<Note | null>`
    * `listNotes(filter?: NoteFilter): Promise<Note[]>`
    * `updateNoteBlocks(noteId: string, blocks: NoteBlock[]): Promise<Note>`
    * `softDeleteNote(id: string): Promise<void>` (sets `status = 'trashed'`, `trashed_at = now`)
    * `restoreNote(id: string): Promise<void>`
    * `permanentlyDeleteNote(id: string): Promise<void>`
  * `frontend/src/db/foldersRepo.ts`:
    * `createFolder(name: string, parentId?: string): Promise<Folder>`
    * `listFolders(): Promise<Folder[]>`
    * `getFolderHierarchy(): Promise<FolderTreeNode[]>`
    * `renameFolder(id: string, newName: string): Promise<void>`
  * `frontend/src/db/tagsRepo.ts`:
    * `createTag(name: string, color?: string): Promise<Tag>`
    * `listTags(): Promise<Tag[]>`
    * `setNoteTags(noteId: string, tagNames: string[]): Promise<void>`

---

### Step 4: Composable Block Editor Engine & Standard AST Renderers
* **Objective:** Implement the polymorphic, block-based editor canvas allowing frictionless typing, block reordering, inserting, deleting, and AST serialization.
* **Core Block Types Handled in Step 4:**
  * `paragraph`: Rich text paragraph with inline bold, italic, strikethrough, inline code, and links.
  * `heading`: Levels H1, H2, H3, H4 with collapsible section disclosure toggles.
  * `bulleted_list`: Unordered bulleted lists with tab/shift-tab nesting.
  * `numbered_list`: Ordered procedural lists with automatic incrementing.
  * `divider`: Subtle horizontal section separators.
* **Key Deliverables:**
  * `frontend/src/components/editor/BlockEditor.tsx`: Main canvas manager handling keyboard shortcuts (Enter to split block, Backspace on empty block to merge with previous, `/` command palette to insert block).
  * `frontend/src/components/editor/BlockRenderer.tsx`: Polymorphic dispatcher rendering each block according to `block_type`.
  * `frontend/src/components/editor/BlockGutter.tsx`: Subtle hover/touch controls (drag handle, add block, block type selector).
  * `frontend/src/core/astSerializer.ts`: Bidirectional converter between `NoteBlock[]` AST and Extended Markdown (`.md`) format.

---

### Step 5: Structured Data Blocks: Tables, Code Blocks, LaTeX & Callouts
* **Objective:** Support developer, scientific, and structured data input methods inside notes.
* **Content Blocks:**
  * `table`: Interactive tabular data grid with column/row add/delete, CSV paste parsing, and cell editing.
  * `code`: Monospace syntax-highlighted code editor supporting 50+ languages, line numbers, and one-click copy.
  * `equation`: KaTeX-powered LaTeX mathematical equation rendering (inline and block display).
  * `callout`: Visual alert blocks (`info`, `warning`, `success`, `quote`) with pastel background tints and accent icons.
* **Key Deliverables:**
  * `frontend/src/components/editor/blocks/TableBlock.tsx`
  * `frontend/src/components/editor/blocks/CodeBlock.tsx`
  * `frontend/src/components/editor/blocks/EquationBlock.tsx`
  * `frontend/src/components/editor/blocks/CalloutBlock.tsx`

---

### Step 6: Multi-Modal Media & File Capture (Drawing, Audio, Attachments, Links)
* **Objective:** Support multimedia and external asset capture directly into composable content blocks.
* **Content Blocks:**
  * `drawing`: Vector sketch canvas supporting freehand pen, highlighter, eraser, color palette, undo/redo, and SVG path persistence.
  * `audio`: Audio voice recorder and playback player with waveform visualizer, playback speed controls, and scrub bar.
  * `file`: Binary document attachment cards (PDF, DOCX, CSV) with file size, icon, and embedded viewer.
  * `image`: High-resolution image block with caption, lightbox zoom, and aspect ratio controls.
  * `bookmark`: Rich web bookmark preview cards with OpenGraph title, description, thumbnail, and favicon.
* **Key Deliverables:**
  * `frontend/src/components/editor/blocks/DrawingBlock.tsx`
  * `frontend/src/components/editor/blocks/AudioBlock.tsx`
  * `frontend/src/components/editor/blocks/FileBlock.tsx`
  * `frontend/src/components/editor/blocks/ImageBlock.tsx`
  * `frontend/src/components/editor/blocks/BookmarkBlock.tsx`

---

### Step 7: Unified Task Engine (Embedded Checklists $\leftrightarrow$ Global Task View)
* **Objective:** Unify note checklist blocks with the global task engine so completing a task in either place updates both instantly.
* **Key Architectural Rules:**
  * Every checklist item embedded in a note receives a unique `taskId`.
  * The task record is synchronized in the `tasks` SQLite table with `is_completed`, `priority`, and `due_date`.
  * Toggling a checkbox inside a note immediately updates the `tasks` table and emits a task change event.
  * Toggling a task in the Global Task View immediately reflects in the note's AST blocks and rendered markdown.
* **Key Deliverables:**
  * `frontend/src/db/tasksRepo.ts`: Task CRUD and sync methods.
  * `frontend/src/components/editor/blocks/ChecklistBlock.tsx`: Interactive checklist block with drag-to-reorder.
  * `frontend/src/screens/TasksScreen.tsx`: Unified global task manager with priority filtering (`urgent`, `high`, `medium`, `low`) and due date grouping.

---

### Step 8: Folder Hierarchy & Physical Vault Directory Mirroring
* **Objective:** Allow users to organize notes into nested folders that directly mirror the physical directory layout of the Git vault (`folders/Work/ScribeX/architecture.md`).
* **Key Deliverables:**
  * `frontend/src/components/navigation/FolderTree.tsx`: Recursive folder tree navigator with expand/collapse states and note counts.
  * `frontend/src/screens/FoldersScreen.tsx`: Dedicated folder browser with folder creation, nested subfolders, note drag-and-drop moving, and breadcrumb navigation.

---

### Step 9: Multi-Tags, Starred Favorites, Pinning, Archive & 30-Day Trash
* **Objective:** Deliver multi-dimensional, non-exclusive organization that crosses folder boundaries freely.
* **Key Deliverables:**
  * `frontend/src/components/ui/TagChips.tsx`: Visual tag pills with one-click filtering.
  * Note pinning (`is_pinned = 1`) that anchors critical notes to the top of the canvas.
  * Starred favorites (`is_favorite = 1`) for quick access.
  * Archive view (`status = 'archived'`) preserving historical context outside the main view.
  * 30-day recoverable trash (`status = 'trashed'`) with auto-purge calculation.

---

### Step 10: Bidirectional Cross-Note Links (`[[Note Title]]`) & Relational Graph
* **Objective:** Enable seamless knowledge interconnectivity without forcing arbitrary folder duplication.
* **Key Deliverables:**
  * `frontend/src/components/editor/LinkAutocomplete.tsx`: Typing `[[` triggers an instant fuzzy-search modal over all existing note titles. Selecting a title inserts `[[Note Title]]`.
  * `frontend/src/components/relations/BacklinksDrawer.tsx`: Expandable drawer showing all notes that link to the currently active note.
  * `frontend/src/db/relationsRepo.ts`: SQLite queries tracking `entity_relations` (`related_to`, `part_of`, `derived_from`, `contradicts`, `supersedes`).

---

### Step 11: Fast Local Search (< 5ms via FTS5) & Dynamic Smart Collections
* **Objective:** Sub-5ms instant local search across all notes, blocks, tags, and tasks using SQLite FTS5 (Full-Text Search).
* **Key Deliverables:**
  * `frontend/src/db/searchRepo.ts`: FTS5 virtual table queries with snippet highlights and rank scoring.
  * Dynamic Smart Collections: Virtual saved queries (e.g., `Show all notes tagged #urgent updated in the last 7 days`).
  * `frontend/src/screens/SearchScreen.tsx`: Instant search modal with instant keystroke results.

---

### Step 12: Phase 1 Master Verification Suite & E2E Canvas Testing
* **Objective:** Comprehensive automated test suite validating local database integrity, block manipulation, task synchronization, markdown AST round-tripping, and UI performance.
* **Key Deliverables:**
  * `frontend/src/core/__tests__/astSerializer.test.ts`: 100% round-trip fidelity between `NoteBlock[]` and Extended Markdown AST.
  * `frontend/src/core/__tests__/sqlite_integrity.test.ts`: Validates WAL mode, foreign key cascades, task sync, and FTS5 search speed (< 5ms).
  * `frontend/src/core/__tests__/manual_notes_suite.test.ts`: Master automated test runner covering all Phase 1 capabilities.
