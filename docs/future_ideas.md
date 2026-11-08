This file contains future ideas and features for ScribeX.

Remaining Tasks to fix

0 - [x] Update to expo sdk 57 (COMPLETED)
1 - [x] autoscroll the notes when the user is dragging an element and goes out of visible screen bounds or reaches near the boundry (COMPLETED)
2 - [x] clear the element selection when the user clicks anywhere else in the screen (COMPLETED)
3 - [x] make the paragraph element the checkpoint inside the checklist group with H1, H2, Quote, and Text options (COMPLETED)
3.1 - [x] the colors are not visible in the color picker (COMPLETED)
4 - [x] make the note editor appear in different screen rather then home screen (COMPLETED)
5 - [x] the changes in notes editor are being saved in mobile platforms but not working in web platform(COMPLETED)
6 - [x] Unify the sql lite database storage system for mobile and web platforms using SQLite WebAssembly (sql.js / Wasm + IndexedDB) (COMPLETED) 
7 - [x] Element drag and drop on mobile platforms (iOS and Android) using PanResponder & locked ScrollView (COMPLETED)
8 - [x] adding a rearrangement snapping effect where if the user is dragging an element and it overlaps other element it should snap to that position and the other element should move to the position of the dragged element in a smooth animation(COMPLETED)
8.1 - [x]the autoscroll dragging down of an element starts really early when the user is not even close enough to the bottom boundary of note editor and also if a certain element is near the bottom of the note editor boundary and i long press it then it automatically starts rushing towards bottom even tough i havnt even touched the bottom boundry(COMPLETED)
8.2 - [x] header input is not able to edit on web platform only and is working perfectly on mobile platforms (COMPLETED) 
8.3 - [x]the toolbar's badges Text, H1, H2, Quote i.e the badges related to text are messing up with other non related elements example when i select some element like audio or image , etc and then i click on these badges are replacing the selected element which shouldnt he happening only the related text elements elements like checklist has text elements should be affected (COMPLETED)
9 - [x] Adding an action tracking system and then Add undo and redo functionality to the editor for all the blocks . use 3 level metadata system for tracking actions - Tier 1: Note-Level Metadata (The Container) , 2 - Tier 2: Block-Level Metadata (The Elements), Tier 3: Asset Metadata (The Files) (COMPLETED)
10 - [x] Implement manual editor input blocks: Bulleted List, Numbered List, and Collapsible Toggle sections with bidirectional Markdown AST serialization and canvas-native styling (COMPLETED)
11 - [x] Implement manual editor input blocks: Video Embed, Bidirectional Note Link, and Location Checkpoint blocks with AST serialization and canvas-native styling (COMPLETED)
12 - [x] Inline Slash Command (/) Menu & Fast Markdown Typing Shortcuts (#, ##, ###, >, -, 1., [], ---, ```, $$, >>) with keyboard navigation and non-generic canvas dock (COMPLETED)
13 - [x] Note Templates & Scaffolding: Meeting Notes, Daily Standup, Project Spec, Weekly Review, Research Note with 1-tap empty note starter pills and full Tier-1 Undo/Redo tracking (COMPLETED)
14 - [x] Backlinks & Lateral Knowledge Graph Relations: Automatic bottom-of-note linked references strip tracking bidirectional note_links with one-tap deep navigation (COMPLETED)
15 - [x] Phase 1 Manual Input Methods: Nested Checklists (Tab/Shift+Tab, multi-level hierarchy, tree guide lines), Habit Tracker (7-day matrix, dynamic streak calculations, frequency cycles), and In-Note Kanban Board (To Do, In Progress, Done lanes with directional advance controls) with 100% round-trip Markdown AST serialization (COMPLETED)
16 - [x] Phase 2 Manual Input Methods: Date & Calendar Event (#33), Contact / Person Profile (#34), Expense / Financial Record (#35), and Reading Queue / Book Item (#36) with 100% round-trip Markdown AST serialization and canvas-native styling (COMPLETED)
17 - [x] In-Note Media Enhancements: Video / Lecture Notes (#25 with timestamped checkpoint scrubbing & playback synchronization) and Email & Message Thread Container (#30 with channel switcher, participant pills, chronological stream, and reply composer) with 100% round-trip Markdown AST serialization and canvas-native styling (COMPLETED)
18 - [x] Meeting Minutes & Multi-Sheet Data Matrix: Meeting Recorder & Diarized Minutes (#23 with audio visualizer, attendee tags, decisions agreed, assigned action tasks, and speaker transcript segments) and Multi-Sheet Spreadsheet Grid (#27 with multi-tab workbook, typed columns, auto-calculations SUM/AVG/COUNT, and CSV import/export) with 100% round-trip Markdown AST serialization and canvas-native styling (COMPLETED)
19 - [x] Visual Diagramming, Web Article Clipping & Voice Dictation: Whiteboard & Diagram (#20 with interactive SVG rendering, directional flowcharts, topology models, and Mermaid syntax editor), Web Article Clipper (#29 with reader-mode drawer, domain pills, reading time, and highlighted quotations), and Voice-to-Text Dictation (#22 with Web Speech API integration in EditorCommandBar) with 100% round-trip Markdown AST serialization and canvas-native styling (COMPLETED)
20 - [x] Ingestion & Smart Capture Pipeline: Desktop Drag-and-Drop Ingestion (#39 with dashed cyan canvas overlay for images, audio, video, PDFs, CSV, and markdown), Smart Clipboard & Paste Handler (#37 with screenshot image pasting, video URL detection, and tabular CSV parsing), and File Import & Export Engine (#40 with YAML frontmatter .md download, structured JSON export, and universal file import) (COMPLETED)
21 - [x]Check whether nested folder creation option is there when adding a new folder (COMPLETED)
22 - [x]check why is youtube video not showing for preview or playback in mobile platforms only when using video embedded block and also verify if this happens for other options as well (COMPLETED)
23 - [x]impliment on device search functionality using database (COMPLETED)
23.1 - [x] impliment filter option for notes list in home (COMPLETED)
23.2 - [x] fix the document ocr block issue which is giving error and also check all the fucntionalities that it is working or not (COMPLETED)
26 - [x] long press gesture to select multiple notes and then perform actions like delete, move to folder, share, etc in the home screen and make sure it works perfectly for all the platforms and when the multiple selection is active there should be a top action bar that should display the number of selected notes and the actions that can be performed on them and also there should be a back button to deselect all the notes and go back to the normal mode (COMPLETED)
27 - [x] memory management for web platform currently i just saw 6.5 gb tab resource so we need to make this optimised (COMPLETED)
28 - [x] Folder management feature where we can create folders and move notes to folders and also when creating a folder user can add cover image for the folder and the folder should be displayed with the cover image in the home screen(COMPLETED)
29 - [x] Note Sorting & Ordering UI: Implement sort action button / menu in NotesView allowing users to sort notes by Recently Updated (Newest/Oldest), Date Created (Newest/Oldest), and Title (A-Z / Z-A) with visual active sort indicator and persistent preference (COMPLETED)
30 - [x] Full Workspace Backup & Restore (JSON / SQLite Dump): Implement complete notebook snapshot export (all tables: notes, folders, tasks, tags, entity_relations) into a timestamped JSON backup file, and full workspace restore / import mechanism with schema validation ensuring zero data loss before cloud sync (COMPLETED)
31 - [x] Workspace Storage & Settings Modal + "Empty Trash" Purge: Implement accessible settings modal in home screen top bar (triggerable via "Local SQLite Active" badge or settings action) displaying database health, storage stats, 1-tap backup/restore triggers, and a one-click "Empty Trash" action with cascade orphan media cleanup (COMPLETED)

Long term Ideas

1 - [x] Use Supabase SDK for realtime database update and backup / cloud sync for the user data, use Next.js for AI API calls hosted on Vercel for maintaining free hosting, and use Google Drive API for zero-cost media storage on Google Drive (Supabase/SQLite stores metadata & links). (ADOPTED AS OFFICIAL BACKEND SPECIFICATION & ALIGNED ACROSS ALL ARCHITECTURE DOCS FOR PHASE 2)

2 - [ ] AI assistant inside the note editor where we can give prompt and it starts editing the existing note (Phase 3 AI Assistant)

3 - [ ] Adding multi agent support if the user wants a specific agent to perform any task from a particular note or group notes. These multi agents will be added using the help of the main agent (Friday) that has all the context of the user and the system, with scoped access to context. (Phase 4 Multi-Agent)

4 - [x] ScribeX Universal AI Connector & MCP Server: Dual-surface unified cognitive engine providing identical 4-layer context, agentic tools (search, create/update note, task toggle, reminder alarm scheduling), and Ask-Before-Write safety gates to both the In-App Friday assistant and external AI apps (Claude Desktop, Gemini CLI, ChatGPT, Cursor, local Ollama) via MCP and OpenAI/Anthropic REST proxy. (ADOPTED & SPECIFIED IN docs/Universal_AI_Connector_and_MCP_Architecture.md) 