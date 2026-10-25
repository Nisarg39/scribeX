# ScribeX — Universal Note Input & AI Integration Blueprint

> **Document Status:** Reference Architecture & Specification  
> **Source Origin:** ScribeX Universal Note Input & AI Integration Blueprint  
> **Related Specifications:**  
> - [ScribeX-Pastel-Tile-UI-Design-System.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/ScribeX-Pastel-Tile-UI-Design-System.md)  
> - [Technical_System_Architecture.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md)  
> - [Product_Requirements.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Product_Requirements.md)  
> - [Phase_2_Implementation_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Phase_2_Implementation_Plan.md)

---

## Executive Summary & Core Principle

The ScribeX note-taking and knowledge architecture is founded upon one foundational principle:

> **The user must be able to capture anything in the fastest possible friction-free way, while the AI assistant ("Friday") handles organization, synthesis, cross-note connections, and follow-up actions.**

ScribeX transcends traditional note apps: it unifies a focused block-based notes editor, a living personal knowledge base, a unified task engine, an asset file vault, continuous episodic memory, and an proactive AI assistant. 

### Fundamental Design Axiom: Notes vs. Content Blocks
**Not every input method requires a separate note type or isolated subsystem.**  
A single note can seamlessly contain a checklist, a voice recording, an uploaded PDF, and an interactive sketch canvas as composable **content blocks**. Meanwhile, **folders, tags, smart collections, and knowledge graph links** define the multi-dimensional relationships across notes without forcing arbitrary data duplication.

```mermaid
graph TD
    subgraph Capture [Universal Capture Layer]
        In1[Text & Markdown]
        In2[Voice & Audio]
        In3[Files, PDFs & Images]
        In4[Tasks & Checklists]
        In5[Web Clippings & Links]
    end

    subgraph Storage [Block-Based Note Model]
        N1[Note Container]
        B1[Block: Heading / Paragraph]
        B2[Block: Audio Player & Transcript]
        B3[Block: Task Checklist]
        B4[Block: Asset Attachment]
        N1 --> B1
        N1 --> B2
        N1 --> B3
        N1 --> B4
    end

    subgraph Relations [Relational & Knowledge Graph]
        F1[Folders / Hierarchy]
        T1[Multi-Tags]
        G1[Bidirectional Graph Links: relates_to, derives_from, supersedes]
        C1[Smart Collections / Dynamic Views]
    end

    Capture --> N1
    N1 -.-> F1
    N1 -.-> T1
    N1 -.-> G1
    N1 -.-> C1
```

---

## 1. Complete Catalog of Note Creation and Input Methods (42 Methods)

The 42 note creation and input methods synthesize industry patterns (Apple Notes, Google Keep, Notion, Obsidian, OneNote, Evernote) adapted to ScribeX’s AI-first cognitive vault.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        42 NOTE INPUT METHODS                           │
├────────────────────────┬───────────────────────┬───────────────────────┤
│ A. Text & Rich-Text    │ B. Lists & Tasks      │ C. Structured Data    │
│  1. Basic text note    │  6. Checklist         │ 11. Bullet/number list│
│  2. Rich-text document │  7. Nested checklist  │ 12. Tables/spreadsheet│
│  3. Long-form outline  │  8. Kanban board      │ 13. Code block        │
│  4. Markdown note      │  9. Advanced task     │ 14. Math & LaTeX      │
│  5. Template-based     │ 10. Habit tracker     │ 15. Quotes & callouts │
├────────────────────────┼───────────────────────┼───────────────────────┤
│ D. Visual & Drawings   │ E. Audio & Media      │ F. Files & Web        │
│ 16. Image attachment   │ 21. Voice recording   │ 26. Document (PDF/DOC)│
│ 17. Camera & scan OCR  │ 22. Voice dictation   │ 27. Spreadsheets/PPT  │
│ 18. Sketch canvas      │ 23. Meeting recorder  │ 28. Web bookmarks     │
│ 19. Handwritten notes  │ 24. Video attachment  │ 29. Web clipping      │
│ 20. Whiteboard/diagram │ 25. Video/lecture note│ 30. Email & messages  │
│                        │                       │ 31. Generic files     │
├────────────────────────┴───────────────────────┴───────────────────────┤
│ G. Contextual & Specialized Inputs                                     │
│ 32. Location note              38. Share-sheet capture                 │
│ 33. Date and event note        39. Drag-and-drop capture               │
│ 34. Contact or person note     40. Import and migration                │
│ 35. Expense or receipt note    41. Email-to-note capture               │
│ 36. Reading list bookmark      42. External integration capture        │
│ 37. Clipboard quick capture                                            │
└────────────────────────────────────────────────────────────────────────┘
```

### A. Text and Rich-Text Notes

| # | Input Method | Description | Implementation & AI Capability |
|---|---|---|---|
| **1** | **Basic Text Note** | Quick thoughts, spontaneous ideas, personal observations, and unstructured journal entries. | Autosaves on keystroke. AI analyzes raw text to infer cognitive intent, extract topics, and suggest an accurate title. |
| **2** | **Rich-Text Document** | Formatted text including headings (H1–H4), bold, italic, underline, strikethrough, highlights, text colors, and inline links. | WYSIWYG editing surface with clean typography. Inline formatting markers parsed into structured AST tokens. |
| **3** | **Structured Long-Form Note** | Document with nested headings, collapsible disclosure toggles, table of contents, and document outlines. | Collapsible sections preserve focus in deep documents. Outline generator builds navigable hierarchy tree. |
| **4** | **Markdown Note** | Full CommonMark and GitHub Flavored Markdown (GFM) syntax with live preview for technical documentation and developer notes. | Direct two-way sync with local Git projection vault. Preserves raw `.md` fidelity with YAML frontmatter. |
| **5** | **Template-Based Note** | Pre-structured layouts for 1:1 meetings, daily journals, retrospective analysis, project specs, and interviews. | Parameterized templates instantiate recurring scaffolding with pre-configured block structures and metadata tags. |

> **Implementation Rule:** Treat Category A inputs as different editor configurations and templates rather than distinct storage schemas.

---

### B. Lists, Tasks, and Actionable Notes

| # | Input Method | Description | Implementation & AI Capability |
|---|---|---|---|
| **6** | **Checklist / To-Do List** | Tappable checkboxes with checked/unchecked states, drag-and-drop reordering, and bulk-completion toggles. | Items maintain reactive completion states. Checked items sync completion timestamps into local SQLite. |
| **7** | **Nested Checklist** | Multi-level hierarchy with parent tasks, sub-tasks, and recursive task decomposition. | Parent checkbox reflects aggregated child completion percentage. Supports tab/shift-tab indentation. |
| **8** | **Kanban Board** | Task cards distributed across customizable workflow columns (`Inbox`, `To Do`, `In Progress`, `Blocked`, `Done`). | Drag-and-drop state transitions. Updates status metadata on underlying task entities in real-time. |
| **9** | **Advanced Task** | Rich task records with due dates, reminder alerts, priority weights (Low/Med/High/Urgent), recurrence rules, and dependency links. | Maps to unified task engine. Due dates feed notification triggers; dependencies block downstream tasks. |
| **10** | **Habit Tracker** | Daily or recurring check-ins with streak counters, completion history logs, and trend visualizations. | Recurring reset intervals. AI calculates completion consistency and detects habit decay over time. |

> **Critical Architectural Rule (Unified Task Model):** A checklist item embedded inside a note and an advanced task in the global task manager refer to the **same underlying task entity**. Completing a task inside a meeting note immediately updates the global task board, and vice versa.

---

### C. Structured Data and Visual Organization

| # | Input Method | Description | Implementation & AI Capability |
|---|---|---|---|
| **11** | **Bulleted & Numbered Lists** | Unordered bullet lists, ordered procedural steps, alphabetical lists, and multi-level outlines. | Keyboard shortcut support (`- `, `1. `). Preserves hierarchical indentation in local markdown projection. |
| **12** | **Tables and Spreadsheets** | Interactive grid with editable rows, columns, headers, formula evaluation, and sorting/filtering controls. | Supports CSV/TSV copy-paste and export. Structured tabular data stored as JSON blocks for relational querying. |
| **13** | **Code Block** | Monospace code container with syntax highlighting for 50+ languages, line numbering, and one-click clipboard copy. | Formatted using Prism/Highlight engines. Code language detected automatically by AI if unspecified. |
| **14** | **Math and Equations** | Inline and display LaTeX equations rendered via KaTeX with real-time formula previews. | Mathematical notation stored as raw LaTeX source strings; rendered client-side into accessible SVG/MathML. |
| **15** | **Quote, Callout & Divider Blocks** | Distinct colored callout boxes (Info, Warning, Success, Quote) and thin section dividers. | Visual emphasis for key insights, disclaimers, and section boundaries without polluting body text hierarchy. |

---

### D. Image, Drawing, and Handwriting Inputs

| # | Input Method | Description | Implementation & AI Capability |
|---|---|---|---|
| **16** | **Image Attachment** | Inline raster/vector images (PNG, JPEG, WebP, SVG) with captions, full-screen lightbox, and ordering controls. | Stored in asset storage; thumbnails cached locally. Visual recognition engine generates captions and topic tags. |
| **17** | **Camera & Document Scanning** | Native mobile camera capture with edge detection, perspective rectification, contrast optimization, and multipage batching. | Built-in OCR pipeline extracts text from paper documents, whiteboard photos, receipts, and business cards into searchable text. |
| **18** | **Drawing & Sketch Canvas** | Vector-based freehand sketch pad with pen, highlighter, shape snapping, eraser, color palette, and undo/redo stacks. | Canvas strokes stored as vector paths (JSON/SVG) enabling infinite scaling and non-destructive re-editing. |
| **19** | **Handwritten Notes** | Stylus/Apple Pencil input surface with pressure sensitivity and palm rejection. | On-device handwriting recognition converts handwriting strokes into editable, indexable plain text. |
| **20** | **Whiteboard & Diagram** | Infinite spatial canvas with sticky notes, connected flowcharts, mind maps, and entity relation diagrams. | Nodes and connector edges maintain spatial coordinates. Graph layout algorithm enables structural navigation. |

---

### E. Audio, Voice, and Video

| # | Input Method | Description | Implementation & AI Capability |
|---|---|---|---|
| **21** | **Voice Recording** | Embedded audio recorder with waveform visualizer, playback speed controls (1x/1.5x/2x), and scrub bar. | Audio preserved in original fidelity. Derives lightweight compressed audio for streaming across clients. |
| **22** | **Voice-to-Text Dictation** | Real-time speech recognition converting live speech directly into editable markdown text. | Sub-second streaming transcription. Distinguishes live dictation from persistent audio file retention. |
| **23** | **Meeting Recorder** | Extended multi-speaker audio capture with speaker diarization, synchronized timestamped transcripts, and key takeaway generation. | Generates structured meeting minutes: executive summary, decisions made, and explicit action items assigned to participants. |
| **24** | **Video Attachment** | Direct video uploads or streaming links (MP4, MOV, WebM) with inline player and frame thumbnail generator. | Video assets indexed with metadata; keyframe extraction generates visual checkpoints for scrubbing. |
| **25** | **Video / Lecture Notes** | Video player paired side-by-side with timestamped notes, allowing clicks on notes to jump directly to specific video moments. | Timestamps link directly to video timecodes (`mm:ss`). Transcripts parsed into searchable vector embeddings. |

---

### F. Documents, Links, and External Content

| # | Input Method | Description | Implementation & AI Capability |
|---|---|---|---|
| **26** | **Document Attachment** | Embedded PDF, DOCX, EPUB, and TXT files with document viewer and page thumbnail sidebar. | Original binary preserved in asset vault. Background worker extracts plain text, layout headings, and tables. |
| **27** | **Spreadsheet & Presentation Files** | Embedded XLSX, CSV, PPTX, and Keynote files with preview thumbnails and sheet selector tabs. | Tabular sheets converted into searchable datasets; presentation slides indexed with extracted slide text. |
| **28** | **Web Link & Bookmark** | Rich link preview cards displaying OpenGraph title, description, thumbnail image, favicon, and canonical domain. | Headless fetcher extracts OpenGraph metadata and caches clean reader-mode text snapshots. |
| **29** | **Web Clipping** | Browser extension capture saving entire web articles, selected text snippets, or screenshots directly into ScribeX. | HTML sanitized into clean Markdown. Strips ads, navigation bars, and tracking scripts while retaining source URL and timestamp. |
| **30** | **Email & Message Capture** | Forwarded emails or captured chat messages preserving sender, recipient list, date, subject line, and attachments. | Email headers normalized into note metadata; thread messages rendered in chronological conversational order. |
| **31** | **Generic File Attachment** | Universal container supporting archives (ZIP), code repositories, raw data files, and audio assets. | Binary files stored securely with MIME type detection, cryptographic SHA-256 hash validation, and virus checking. |

---

### G. Location, Time, and Specialized Inputs

| # | Input Method | Description | Implementation & AI Capability |
|---|---|---|---|
| **32** | **Location Note** | Geographic checkpoint with place name, street address, GPS coordinates (lat/lng), and map thumbnail. | Reverse geocoding resolves raw coordinates to human locations. Enables geo-fenced spatial search. |
| **33** | **Date & Event Note** | Calendar event link with scheduled start/end dates, all-day flags, location links, and reminder triggers. | Synchronizes with system calendar; links meeting participants to personal contact cards in the vault. |
| **34** | **Contact / Person Note** | Living cognitive profile for an individual (name, organization, role, interaction history, relationship notes). | Privacy-gated profile card. Links all meetings, notes, and tasks where this person is tagged or mentioned. |
| **35** | **Expense / Receipt Note** | Financial record capturing total amount, currency, merchant name, purchase date, category, and receipt image. | OCR pipeline extracts line items, taxes, and totals into structured JSON, linking to monthly budget buckets. |
| **36** | **Bookmark / Reading List Item** | Reading queue item with consumption status (`Unread`, `Reading`, `Finished`), rating, and reading notes. | Tracks reading progress. AI provides synthesized executive summaries of articles or book chapters. |
| **37** | **Clipboard Quick Capture** | Floating global shortcut or menu bar listener that captures clipboard text, screenshots, or URLs instantly. | Instant background write to Universal Inbox without interrupting the user's active desktop workflow. |
| **38** | **Share-Sheet Capture** | Mobile OS Share Extension receiver (iOS / Android) enabling 1-tap ingest from Safari, Twitter, YouTube, etc. | Normalizes incoming shared payloads (URLs, images, text, PDFs) into pending Inbox entities. |
| **39** | **Drag-and-Drop Capture** | Dragging files, images, browser URLs, or text selections directly onto the ScribeX desktop window or note editor. | Dynamic drop target indicates target insertion position; immediately begins non-blocking background upload. |
| **40** | **Import & Migration** | Batch importer supporting Evernote ENEX, Notion ZIP, Apple Notes, Obsidian vaults, and Markdown folders. | Parses legacy formats, normalizes attachment links, migrates tags, and recreates folder hierarchy in SQLite. |
| **41** | **Email-to-Note Ingest** | Dedicated inbound email address (`username@inbox.scribex.ai`) that parses inbound emails into Inbox notes. | Cryptographic DKIM/SPF verification; extracts email body and attachments into a structured note container. |
| **42** | **External Integration Ingest** | Webhook connectors syncing events from Google Calendar, GitHub PRs, Slack saved messages, and Readwise. | Event listener ingests external events and automatically links them to corresponding projects in the knowledge graph. |

---

## 2. Note Organization Methods, Hierarchy & Relational Model

Input methods govern **how content enters the system**; organization methods govern **where content lives and how knowledge connects**.

```mermaid
graph TD
    Root[ScribeX Workspace]
    Inbox[1. Universal Inbox]
    Folders[2. Folders & Subfolders]
    Tags[3. Multi-Dimensional Tags]
    Graph[4. Knowledge Graph Links]
    Views[5. Smart Collections & Views]
    Pins[6. Pinned & Favorites]
    Archive[7. Archive & Trash]

    Root --> Inbox
    Root --> Folders
    Root --> Tags
    Root --> Graph
    Root --> Views
    Root --> Pins
    Root --> Archive

    Folders --> F1[Personal]
    Folders --> F2[Work / Projects]
    F2 --> F21[ScribeX Core]
    F2 --> F22[Client Relations]

    NoteA[Note: Architecture Blueprint]
    F21 -. Primary Folder .-> NoteA
    Tags -. '#architecture' & '#v1' .-> NoteA
    Pins -. 'Starred Favorite' .-> NoteA
    NoteA -. 'relates_to' .-> NoteB[Note: SQLite Sync Engine]
    NoteA -. 'supersedes' .-> NoteC[Note: Legacy Sync Draft]
```

### The 8 Structural Organization Mechanisms

1. **Universal Inbox:**  
   The zero-friction landing zone for every uncategorized capture, voice note, web clipping, or imported document. The user never needs to select a category before writing. The AI processes the Inbox in the background and proposes clean destinations.
2. **Folders & Nested Folders:**  
   Hierarchical containers for explicit project nesting (e.g. `Work → Projects → ScribeX → Architecture`). Kept quiet and thin.
3. **Groups & Functional Collections:**  
   High-level functional domains (e.g. `Cognitive Identity`, `Long-Term Goals`, `Reference Vault`, `Active Operations`).
4. **Multiple Tags:**  
   Orthogonal classification labels (e.g. `#urgent`, `#idea`, `#finance`, `#draft`, `#meeting`). A note can have any number of user-defined or AI-suggested tags.
5. **Linked Notes & Knowledge Graph:**  
   Explicit bidirectional links connecting notes across categories. Relationship taxonomy includes:
   - `related_to`: General contextual connection.
   - `part_of`: Sub-component of a larger project or document.
   - `derived_from`: Generated from a meeting transcript, PDF, or interview.
   - `contradicts`: Conflicting facts between an old note and a new note.
   - `supersedes`: Replaces an older version or deprecated plan.
6. **Smart Collections (Dynamic Filtered Databases):**  
   Virtual views computed on the fly by querying attributes (e.g. `Show all notes tagged #meeting from the last 14 days with uncompleted tasks`). Can be rendered as a **Grid, List, Table, Board, or Timeline**.
7. **Pinning, Favorites & Quick Access:**  
   Surfaces critical active notes to the top of the interface without moving them out of their logical folders.
8. **Archive and Trash:**  
   - **Archive:** Inactive knowledge preserved for search and AI retrieval, but hidden from the primary workspace.
   - **Trash:** Soft-deleted items retained for a 30-day recovery window before permanent purge.

### Cardinal Architectural Rule: Cross-Boundary Relational Traversal
> **Do NOT force every note into a single mutually exclusive folder.**  
> A note has an optional primary folder, but tags, priorities, task links, and knowledge graph relationships cross folder boundaries freely. Smart collections query dynamic filters over underlying records; notes are **never duplicated** across views.

---

## 3. Universal Content Block Architecture

Rather than maintaining 42 isolated editor engines, ScribeX implements **one unified block-based editor** where every document is composed of ordered content blocks.

```mermaid
classDiagram
    class Note {
        +string id
        +string title
        +string folder_id
        +string[] tag_ids
        +string[] block_ids
        +string color_token
        +boolean is_favorite
        +string status
        +datetime created_at
        +datetime updated_at
    }

    class NoteBlock {
        +string id
        +string note_id
        +string block_type
        +int position
        +json content
        +string[] asset_ids
        +datetime updated_at
    }

    class Asset {
        +string id
        +string storage_key
        +string mime_type
        +int size_bytes
        +string processing_status
        +string extracted_text
    }

    class EntityRelation {
        +string id
        +string source_id
        +string target_id
        +string relation_type
        +string created_by
        +float confidence
    }

    Note "1" o-- "*" NoteBlock : contains ordered
    NoteBlock "1" o-- "*" Asset : references
    Note "1" ..> "*" EntityRelation : connects
```

### Complete Content Block Registry

| Block Type (`block_type`) | Core Payload Schema (`content`) | Background AI Worker Action |
|---|---|---|
| `paragraph` | `{ text: string, marks?: Mark[] }` | Semantic vector embedding & entity extraction |
| `heading` | `{ text: string, level: 1\|2\|3\|4 }` | Document outline & table of contents indexing |
| `bulleted_list` | `{ items: string[] }` | Summary generation & key point extraction |
| `numbered_list` | `{ items: string[] }` | Sequential procedure & workflow extraction |
| `checklist` | `{ items: { id: string, text: string, checked: boolean }[] }` | Task state synchronization & progress tracking |
| `task` | `{ taskId: string, priority: string, dueDate?: string }` | Global task engine sync, reminders & planning |
| `table` | `{ columns: string[], rows: Cell[][] }` | Tabular data extraction & structured SQL querying |
| `image` | `{ assetId: string, caption?: string, width?: number }` | Vision analysis, object detection & OCR text indexing |
| `drawing` | `{ assetId: string, pathsJson: string, previewUrl: string }` | Shape & visual diagram understanding |
| `audio` | `{ assetId: string, durationSec: number }` | Whisper audio transcription & speech-to-text |
| `transcript` | `{ segments: { speaker: string, start: number, text: string }[] }` | Speaker diarization, decision mining & executive summary |
| `video` | `{ assetId?: string, url?: string, chapters?: Chapter[] }` | Scene indexing, visual OCR & timecode alignment |
| `file` | `{ assetId: string, fileName: string, size: number }` | Deep document parsing (PDF, DOCX, CSV) |
| `bookmark` | `{ url: string, title: string, description: string, previewUrl: string }` | Web page reader-mode scraping & topic indexing |
| `code` | `{ code: string, language: string, fileName?: string }` | Syntax highlighting & programming language analysis |
| `equation` | `{ latex: string, displayMode: boolean }` | LaTeX formula verification & mathematical parsing |
| `callout` | `{ text: string, variant: 'info'\|'warning'\|'success'\|'quote' }` | Key takeaway & insight classification |
| `embed` | `{ provider: string, url: string, config: json }` | Third-party metadata extraction (Figma, GitHub, Loom) |
| `divider` | `{ style: 'subtle'\|'dashed' }` | Visual separator (no AI action required) |
| `location` | `{ lat: number, lng: number, placeName: string, address: string }` | Spatial geocoding & location-based memory linking |

---

## 4. ScribeX AI Assistant ("Friday") Integration Pipeline

The AI assistant transforms raw incoming media into actionable, interconnected knowledge.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as ScribeX Client (Expo)
    participant Bus as Intake Worker Queue
    participant AI as Friday AI Engine
    participant Gate as Ask-Before-Write Gate
    participant Vault as SQLite + LanceDB + Git Vault

    User->>App: Submits raw capture (Audio, PDF, Text, Image)
    App->>Vault: Saves instant local SQLite replica (sub-5ms)
    App->>Bus: Enqueues background intake job
    Bus->>AI: 1. Normalize & Extract (OCR, Whisper, Text AST)
    Bus->>AI: 2. Understand Context (Cross-reference living memory)
    Bus->>AI: 3. Formulate Action Plan (Create tasks, link notes, update graph)
    
    alt If Plan Has High Ambiguity or Direct Contradiction
        AI->>Gate: Trigger Clarification Modal (Ask user)
        Gate->>User: "Did you mean to update Project X or create Project Y?"
        User->>Gate: Selects correct resolution
        Gate->>AI: Resolution confirmed
    else Clean Plan Without Conflict
        AI->>Vault: Executes atomic graph projection
    end

    AI->>Vault: Commits derived entities, updates embeddings & Git markdown
    Vault->>App: WebSocket doorbell broadcasts change delta
    App->>User: UI updates in real-time with zero layout shift
```

### 5-Stage Processing Engine
1. **Capture:** Instant optimistic local SQLite write; user is never blocked by a network spinner.
2. **Normalize & Extract:** Background workers perform Whisper transcription, document text extraction, vision OCR, or link scraping.
3. **Understand Context:** Maps entities against Layer 1 (Personal Identity & Mental Models) and Layer 2 (Episodic Timeline Graph).
4. **Decide Action:** Formulates specific propositions: create new note, update existing note, link notes, create global tasks, or flag contradictions.
5. **Apply & Verify:** Verifies provenance, records before-and-after audit logs, and commits changes.

### Content-to-AI Behavior Matrix

| Incoming Input Type | Friday AI Behavior |
|---|---|
| **Random Thought** | Parses meaning, identifies related ongoing projects, suggests ideal folder and tag destination. |
| **Meeting Audio** | Transcribes recording, diarizes speakers, generates executive summary, extracts explicit action items with assignees, and links to the parent project note. |
| **PDF Document** | Extracts raw text and tables, generates a 3-sentence executive summary, tags relevant topics, and connects to existing domain notes. |
| **Screenshot / Photo** | Runs OCR to extract phone numbers, dates, receipts, or error logs; suggests contextual actions based on detected text. |
| **Checklist** | Analyzes checklist items; suggests converting complex items into formal tasks with due dates. |
| **Web Article** | Scrapes core article body into clean reader Markdown, extracts key takeaways, and indexes into semantic vector search. |
| **Code Snippet** | Identifies language, analyzes purpose, links snippet to corresponding tech stack notes, and formats clean code block. |
| **Receipt / Expense** | Extracts merchant, total amount, currency, and date; logs expense item into financial tracking database. |
| **Contradicting Info** | Detects contradiction against an older stored note; pauses automatic overwrite and prompts user via Ask-Before-Write gate. |
| **Duplicate Info** | Detects redundant content; proposes merging notes or attaching as a revision without silently dropping data. |

### 4 Mandatory AI Governance Controls
1. **Preview Before Commit:** The user can inspect proposed AI updates, merges, or moves before they become permanent.
2. **Clarification Over Assumption (Ask-Before-Write Gate):** When input contains ambiguity or conflicts with established facts, Friday pauses and asks concise clarifying questions instead of hallucinating.
3. **Full Provenance & Citations:** Every AI-generated summary, fact, or task retains a clickable link back to its exact source block or file timestamp.
4. **Reversible History & Non-Destructive Edits:** All changes maintain complete revision diffs; original attachments are never modified or deleted by background processes.

---

## 5. Technical Data Architecture & Schemas

### Core Data Models (TypeScript / JSON Schemas)

```ts
/** Core Note Container */
export interface Note {
  id: string;
  title: string;
  folder_id?: string;
  group_name: string;
  tag_ids: string[];
  block_ids: string[];
  color_token: 'apricot' | 'coral' | 'lime' | 'lavender' | 'cyan' | 'pink' | 'sky';
  is_favorite: boolean;
  status: 'inbox' | 'active' | 'archived' | 'trashed';
  sync_rev: number;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

/** Composable Content Block */
export interface NoteBlock {
  id: string;
  note_id: string;
  block_type: 
    | 'paragraph'
    | 'heading'
    | 'bulleted_list'
    | 'numbered_list'
    | 'checklist'
    | 'task'
    | 'table'
    | 'image'
    | 'drawing'
    | 'audio'
    | 'transcript'
    | 'video'
    | 'file'
    | 'bookmark'
    | 'code'
    | 'equation'
    | 'callout'
    | 'embed'
    | 'divider'
    | 'location';
  position: number;
  content: Record<string, unknown>;
  asset_ids?: string[];
  created_at: string;
  updated_at: string;
}

/** Binary Asset Storage */
export interface Asset {
  id: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256_hash: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  extracted_text?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

/** Explicit Knowledge Graph Relationship */
export interface EntityRelation {
  id: string;
  source_id: string; // Note ID or Entity ID
  target_id: string; // Note ID or Entity ID
  relation_type: 
    | 'related_to'
    | 'part_of'
    | 'derived_from'
    | 'contradicts'
    | 'supersedes';
  created_by: 'user' | 'ai';
  confidence_score: number; // 0.0 to 1.0
  created_at: string;
}
```

### Storage, Sync & Retrieval Stack
- **Local Client Replica:** Embedded SQLite (`expo-sqlite`) holding instant local copy of notes, blocks, and relations for sub-5ms latency across iOS, Android, and Web.
- **Git Vault Projection:** Every note projection written to local Markdown with YAML frontmatter, committed atomically to tenant Git repositories.
- **Semantic Vector Storage:** LanceDB embedding space indexing block content, transcripts, and OCR text for sub-20ms semantic search.
- **Relational Graph Traversal:** SQLite indexed foreign keys joining `EntityRelation` records for instant graph traversal.

---

## 6. Phased Implementation Roadmap

```
Phase 1: Core Notes Foundation
├── [x] Plain text & rich-text notes
├── [x] Markdown notes & Git projection
├── [x] Checklists & actionable tasks
├── [x] Pastel tile design system tokens
├── [x] Universal inbox & basic tags
└── [x] Offline-first SQLite local replica

Phase 2: Universal Capture & Media (Active)
├── [x] Desktop navigation rail & shell architecture
├── [x] Focused note reading & editing surface
├── [ ] Universal Intake Bar with multi-modal attachment picker
├── [ ] PDF, DOCX, TXT document parser & text extractor
├── [ ] Image capture & OCR text pipeline
├── [ ] Web bookmarks & OpenGraph metadata scraping
├── [ ] Bidirectional note linking & relationship models
└── [ ] Ask-Before-Write Ambiguity Gate modal

Phase 3: Voice, Audio & Proactive Intelligence
├── [ ] Real-time audio waveform recorder
├── [ ] Whisper speech-to-text transcription engine
├── [ ] Meeting minutes synthesis & action item extraction
├── [ ] LanceDB semantic hybrid search across notes & blocks
└── [ ] Contradiction detection & duplicate note merge assistant

Phase 4: Advanced Canvases, Tables & Integrations
├── [ ] Interactive spreadsheet tables with CSV import/export
├── [ ] Freehand vector drawing & sketch canvas
├── [ ] Kanban board & dynamic smart collection views
├── [ ] Mobile OS Share-Sheet & clipboard listeners
└── [ ] External calendar & webhook connectors
```

---

## Final Recommendation

> **Architect ScribeX around the synergy of:**  
> **Universal Fast Capture + Unified Block-Based Editor + Shared Task Model + AI Organization Pipeline.**

This architectural foundation accommodates all 42 input methods without building fragmented subsystems. Users capture thoughts naturally and instantly in their chosen format, while Friday transforms raw inputs into an organized, connected, and actionable knowledge graph.
