# ScribeX — Universal Note Input & AI Integration Blueprint

Based on your ScribeX PRD, I would design the notes system around one core principle: the user should be able to capture anything in the fastest possible way, while the AI handles organization, connections, and follow-up actions.

Your app is more than a traditional notes app. It combines a notes editor, a personal knowledge base, task management, file management, historical memory, and a Friday-style AI assistant. That means you should support both familiar note-taking methods and richer input types that the AI can understand and act upon.&#x20;

The important distinction is that not every input needs to be a separate type of note. A checklist, voice recording, PDF, and handwritten sketch can all belong inside one note, while groups, folders, and links describe how notes relate to one another.

## 1. Complete catalog of note creation and input methods

I've combined the main input patterns found in popular apps with additional methods that make sense for ScribeX's AI-first architecture. Apple Notes and Google Keep cover fast capture, checklists, images, drawings, and audio; Notion adds flexible content blocks, databases, and embeds; OneNote emphasizes free-form pages and handwriting; Evernote combines notes, attachments, web clipping, and contextual tasks.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://apps.apple.com\&sz=32)

App Store

+4



### A. Text and rich-text notes

[Secure note-taking apps for journalists](https://images.openai.com/static-rsc-4/zuVjlZlxlQCpI0vbX_yDZuZ2JZOIsHu8Ji64RSnF-ZAcHJsDaD3PTwfDnRGVqC_zK6l_QpfgMPwmIp-3s3cQb-IUYsoYYYfF1h0jR5Q0EWjgsTyl9vzcTl0E-5fu_mef5syK_-zjSkvLt9QgxjWy1FChSdt3hT4qRwyQqQv6WbI?purpose=inline)

1\. Basic text note

Quick thoughts, ideas, observations, journal entries, and unstructured information. Automatically save while typing and let the AI suggest a title.

[New rich content formatting options | Userflow Blog](https://images.openai.com/static-rsc-4/CWZARf0BEuIuJzJIYVnG_H1Eeu8AUCEu33B6a7BQiDDYc7sQGbAs1PJ4T1hMts3EGU4XS45jyBpyklC-IeIetzuseLA1UBIxUUC6C1qtr5fUX6DrFcrjVlHJWUxmKq4D91eM_-soweoUsS8b8Z5debLaP-QFrAe-HJlUOXz6QNI?purpose=inline)

2\. Rich-text document

Headings, bold, italic, underline, strikethrough, highlights, text colors, font sizes, alignment, and links.

[Mdit - Markdown Notes](https://images.openai.com/static-rsc-4/u_BytZdAcev8Bl1NORgZ28rCuMF1Mo1lIkIkykP62i8tLwm1xoYy5qAIOKtqJyljlfVumjM9R7CXXxq2NIOgWmqGxGGI--yrsqGDtKp8ZgPnAhQQhEUKKmWJQ4IbjC0kypbXl6kkkD8QG6w1c3Z7WxjuDtJuX7USJa3_B0sHU-I?purpose=inline)

3\. Structured long-form note

Nested headings, collapsible sections, table of contents, page breaks, and document outlines.

[Fyne.io | Website for the Fyne app development framework.](https://images.openai.com/static-rsc-4/UiSRdFDr_soZIHPjjHeXIadD4zgtnJICEM-QLlgZQYF8b9MywDxeooKJNak3RtJuYHDQxlThRovkIFTcn-eekJ0YXJJztRrs5xtRf-slRfdzVfzYXQjoBTpPvozy7U676heJ3HWQWDcQKX4HrbDKEzBTb2yGs9YkE3lD-_HhUIE?purpose=inline)

4\. Markdown note

Markdown syntax and preview for developers, technical documentation, README files, and portable knowledge bases.

[Customizable Meeting Notes (Minutes) Templates](https://images.openai.com/static-rsc-4/-ZMAt5h913w7_islrffiPvobgYv7dai3mxkiPxeNxRaBJI-qY1ggBcZOBsx435M2ca6WqA2SiYpArEHsoLOBQe8ClQj0mifqf1k4RhI55LCAIiH0fkvxMFaZKR42BwRCEWWxYFX1aPn88EUyaW0CHyif6hmXM2g4hz8wFTFZW-s?purpose=inline)

5\. Template-based note

Reusable templates for meetings, daily journals, project plans, retrospectives, research, and one-on-one discussions.

Implementation detail: Treat these as different editor configurations or templates, not five unrelated storage systems.

### B. Lists, tasks, and actionable notes

[ToDo List by Sumit Singh on Dribbble](https://images.openai.com/static-rsc-4/9ngyM7GdxLcGRtAySyl7t-EhKBi9QIJl_83h1IIxfuFDycffEwVOMU8gujwODN0Q7TNXJVP7xAsrgY3o6cY1UfLTMrlmT7hRxTtU7xuJfaY0CUybjjvvtxeRJ-s4XdwDb_sZcZfo_0tsVDcplE8Xz0OqDOlr3JYZg8i9vzYW1hs?purpose=inline)

6\. Checklist / to-do list

Items with checked and unchecked states, reordering, bulk completion, and progress indicators. Useful for shopping, daily routines, and task breakdowns.

[Chores Life | Infinite Nesting & Task Mirroring Workspace](https://images.openai.com/static-rsc-4/l4GQMCTkry1zausS5LXQ_YQdLip4vjPXePrqKw5ytbDWmZRU4SVzDRA72Hg_TvMJd8S1oYw4WQzD0XdlscHRFnILXUL_9BZbR7brNAxbAfsTHoETLk3eLGaavmg2kLnWNzr7WD8s7qLSFSyUu2BW_4qYxJ4YdPV2UQPWIIy4e_M?purpose=inline)

7\. Nested checklist

Parent tasks with child tasks, subtasks, and multiple levels of decomposition.

[The Best To-Do List Apps to Trick Your Brain into Getting Stuff Done | MySimple.life](https://images.openai.com/static-rsc-4/smAnCsoZmKyQn4KT_Heel9HHBSXMJsOiDaHmBsJus2gzrXfRrsxYcxWo1ErqrvZl4HX3O7DQJTVr9IwBBfqeGW_5WWMnh_gv58oqEXiOkJCLSgloJ8yNfyNALWmieD_vc9z6wTvxnczscAMLAO3p67QgXHjiFiMwvpTvJtyVnlM?purpose=inline)

8\. Kanban board

Tasks represented as cards across statuses such as Inbox, To Do, In Progress, Blocked, and Done.

[Task Management - Capacities Documentation](https://images.openai.com/static-rsc-4/WQcCATc7rNkcxEojBHmjIvu-zRXnGGwyqnUI39x4v2zhlKOXQBeiWOlMOlpHJ18S8aOUJiTqdJekLj9ZwGDWQvKhyIPyewOwuo6g3wV6KbrSSPrcefkZ8IyJwbHnafKvL_J2tUeW5MpJx50lT0EKFj_nRYooJ0uGl621QnjbGvM?purpose=inline)

9\. Advanced task

A task with a due date, reminder, priority, status, recurrence, dependencies, and links to its parent project or source note.

[A6 Habit Tracker Notepad  – Oh Laura](https://images.openai.com/static-rsc-4/eDW6Vh20_Gjo1qGFidSCea3X2yOtLlqfOxcM8j6HDHr8MX0ORlS1eyP_N68dD2ZwWbdh165jodoCFpJHS-P0uK0wan0QWBPLPKomYhfz31vGwySB5ebeeN0qIcldOoUYTMilqHATTa7uiS6_Crsr-Fb-wvOsKiYzPk0kteGB9Ds?purpose=inline)

10\. Habit tracker

Daily or recurring check-ins, streaks, completion history, and progress over time.

One important design choice: a checked item inside a note and a task in the global task manager should be able to refer to the same underlying task. Evernote already demonstrates the value of synchronizing tasks between a central view and their original notes.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://help.evernote.com\&sz=32)

Evernote Help & Learning



### C. Structured data and visual organization

[Mobile App Design Guidelines: An Exploration](https://images.openai.com/static-rsc-4/smFircgP8Vr5NSVN5VyV2283Nl4xJSJb3tn1yv5UtiaqT2_eUQKjyG_oBrMNgKe5EPzwhcuk0QuelkAk60uegpclThBWmxYJzk8zyZFaO3CG09t9YsA1ul3snm4TihjyryRVy_CNOQJ-dSjs046qUCEqKkYWljM14wWkEqjSdyk?purpose=inline)

11\. Bulleted and numbered lists

Ordered instructions, unordered ideas, rankings, and step-by-step processes.

[How to create tables in Notes | The iPhone FAQ](https://images.openai.com/static-rsc-4/FKTRdnqmRcpRzptQSvgulg8L609uqWoQoqCbV7rWT-LQIoxkfkQjp9KpQ44Q-bYGBSSRQNQ264mJ3eOf04Xy-IMoZDuz_Mtpv-sDL_P_hcs7ECnMwlfWm_FHlNXEs90v-rzfIBAmglisOn-r_BUVMU-hNfkdtgHq6zkWnWbw7hs?purpose=inline)

12\. Tables and spreadsheets

Editable rows and columns for comparisons, plans, budgets, inventories, and small datasets. Consider CSV and spreadsheet imports too.

[Code blocks for code snippets - Help - Obsidian Forum](https://images.openai.com/static-rsc-4/_E9J-9NLqi6w-bwJsdkT610TrvLSbSU-yA6Ch8F-XDCt9LqyRxILp-UxkuL4q4PiXFYwbbCEEgSJ1YdsbLM61DJbQs1uYOtL-a9MV2K92A4yyCvbUaxBOrJqsU-MTRGTdEz-AgMDxdEt7JKMrn_OZ7zUqDUyvyZakSzzr__CvNM?purpose=inline)

13\. Code block

Syntax highlighting, language selection, copy buttons, and optional file attachments for code snippets and commands.

[Essayist](https://images.openai.com/static-rsc-4/YUCb5CUMNQ8zd3S1tc_wgfkN7zDug01Hz_fVdA9aY4qVslPTemkWkaknqcHvGc5AsYMchsJ7Y4b0s7NJnR1RyvJWH3PZET1-Br1n8z7aEB9F8CiNZGYQEPdEZwocU18_9QChY6e7uZBazdV6p0RNqfHpCiPl0XYW3O2LoggkaiY?purpose=inline)

14\. Math and equations

Inline and block LaTeX, rendered formulas, and mathematical notation.

[Sanctum Theme - Page 2 - Share & showcase - Obsidian Forum](https://images.openai.com/static-rsc-4/0iYEdL4hs2nuY5MdkxnOWwvYmbMFvqZM6PjAzmLneTCZZrkivOM4Fz9eTqLU6YJyNn2-e-s6f01GxEOIVv6GTc9hYsJlhxBErywucmUy52Ia1DlwJMnOVp5CY6VYXcamvpyB0TF9jR4WvBJaI3ZlN4XD9yfuOzoQM1jkXvPpo2g?purpose=inline)

15\. Quote, callout, and divider blocks

Highlight important insights, warnings, reminders, citations, and section boundaries.

### D. Image, drawing, and handwriting inputs

[在 iPad 上创建和格式化备忘录 - 官方 Apple 支持 (中国)](https://images.openai.com/static-rsc-4/WX5LT5G5JjubHitbP1EYi-xkndNeIuH2ish1B9VZ6CtDDTr530YLjnzSxfcrWNZepdFLc4_mss1gNmetGsnPoXYyIQ16iVmMpKvMgBALMOhhQsywd3TTs5lwWXHyceWV-JAw0BJ8Op1SNZf8S5GQCG6fBWOPHt1obPH2_nGi__M?purpose=inline)

16\. Image attachment

Upload one or more images or paste them from the clipboard. Support captions, previews, image ordering, and full-resolution viewing.

[How to use iPhone's built-in text scanner | TechRadar](https://images.openai.com/static-rsc-4/qElpKGqGhmFsUX2MndqvpuQUfKFUlHzxhjBNkifsC8pISOvCsd73SudcGqqIWaILDHnZW3JIjCgHhwFynfcEgYbezdcQQBiDv5S6vVMHvRxt2n2NKoKWDZw3nooBmpj_nwzjiF6aSTloUeZ1HxsKuUcljPUoizn5ZfSspF8Kt1k?purpose=inline)

17\. Camera capture and document scanning

Capture receipts, whiteboards, business cards, handwritten pages, and multipage documents, with cropping and OCR.

[The Ultimate Note-Taking App for College Students: CollaNote](https://images.openai.com/static-rsc-4/kMaGNOrhyHp6wTfymMb0k1l6ICSsBRbjKcTgzGKXlxqYAhe8as3b7aus_7MKoG6qe1-dypkFnhTIhl9zohuUPzpjYHS1ZLAIDc2uduhDo1QBIzOwmL7jGGtEtGzRww45ptpZ-fHEL45mmbvWonS4292aVlOyLpa4a6BS8TI2lf4?purpose=inline)

18\. Drawing and sketch canvas

Freehand pen, highlighter, eraser, shapes, arrows, colors, and export to an image.

[HUAWEI MatePad 11.5-inch PaperMatte Edition - HUAWEI UAE](https://images.openai.com/static-rsc-4/pnUVht5Rne4butjKkKpaUs_1-0Vm7TkPGwZzplcjBMqVqVqPIoc8lJWhTOkvR4_JZTsee1x7zf419Uak3AV9jfT8_FHtxtr_cUJJxMhrWBtCynM6if7qEWCn3fZWkBhjzqTLCMv4F8qh7-QwQzeYWUjcf5wlEeUN8uDzIvI1FX4?purpose=inline)

19\. Handwritten notes

Stylus input, handwriting recognition, and conversion into searchable text where supported.

[白板SDK深度测评：集成思维导图、流程图与私有化功能！](https://images.openai.com/static-rsc-4/_wv6VZGoLs4gFrY9-CITnISjz9aGkf79boglz10NKe0dnvMpMhKEg3ucb8AyRH-ll6vAfr8DqyHiCPJqoxU428Kq3IPMJTH5zJdx56q_2FlVOkQOVgp76eUspCnONUbfGUuDI2S5_Mxfi0xnNZS9fEt4141JayBUn_wug7hgcLg?purpose=inline)

20\. Whiteboard and diagram

Spatial canvas, sticky notes, connected shapes, flowcharts, mind maps, and freeform diagrams.

### E. Audio, voice, and video

[The Devil's Tale - Page 18 of 135 - Dispatches from the David M. Rubenstein Rare Book and Manuscript Library at Duke University](https://images.openai.com/static-rsc-4/8slfEeRAVUS7SE0xMiiT74U9aIg2ObYzDGaajkNXumAH3QrPmUKBtKbf9K7Rw7bX3W6d8w0lsL7Hmk7tjI1XcLVrGlA-4IlQrwgNAB-RUtPZFfrYZBrCwtQ9mjXh2cDLaI08rwu7VkF-SMnfBdBvMG9vLsuRj1X2tQc1ipABmLM?purpose=inline)

21\. Voice recording

Record a thought, meeting, lecture, or reminder directly into a note, with playback and waveform controls.

[How to Transcribe Audio to Text: Complete 2026 Guide | AudioScribe](https://images.openai.com/static-rsc-4/47Mp-vtNQc6cecmhr5MtIUKPnhAPXlgsxGgho1nke7O_YeROMl0XLx-GZ4owgno6Tcld-KUjQfpti30o9yB2NYYiy8rRD-DsKI8GiIxiv5q3hAbreX-FGNGkmf-BnTvxXA-FKM870d3HI5wNR1f7_ihUFQjjR4F7yg3ULs1-OnY?purpose=inline)

22\. Voice-to-text dictation

Speak and convert speech into editable text. Distinguish this from retaining the original audio recording.

[Auto Minutes – Instant Audio to Text & AI Note Taker](https://images.openai.com/static-rsc-4/ArMRXlrhjE0et5DJ9VOQbxJ6agqC5gwNv8JGQS_oZo879d4NZOS_GiB-qR4Xedy61z1BaGpdQjMW5b5vId2H2q-YxpW2RJojW3MzvBffdgGjzLv165nRuOhfGp744xk-SxBP_tPaur7H83yGHniPyOYTb5vGTXC5cgI3uEhba_A?purpose=inline)

23\. Meeting recorder

Longer recordings, timestamps, speaker labels, transcripts, summaries, decisions, and extracted action items.

[Wie kann ich Mediendateien aus Canvas in den Rich Content Editor einbetten? - Instructure Community](https://images.openai.com/static-rsc-4/FTQTDnQy3ZRhf5US2sjCyJ6h5llAYMlD3CWJtbbG0l-OYbCpchZWED4joE8RuXjmxgTLhEU_e40y775tmEPcNK9QAxBPdegBZpbFzVtSGX4qWRF7Vu-Fii4Dhx-ojrdYefRPNC5E9cCidraQnBqquspUplH8mu3eowAQpxMLao4?purpose=inline)

24\. Video attachment

Upload or link videos, show a preview, and optionally extract a transcript, chapters, and key moments.

[Can You Upload Videos to ChatGPT? Yes — Here's How (2026)](https://images.openai.com/static-rsc-4/pmD00FI1SzQqUmXVdqAUSLsnB6Bh_BsE_WvxNCQjbkoZ5ezvE5-wcW6CUi0BEfoCzllmJOdI1K0up7xi5vFwRjegoLgxVXmLfYj3eaDPFgJ7oKcJSsmni3omWuGgb14N_SfZn64oBLN6Nu5MrkyGqEX9w3g66oOmQD_Loqew_mA?purpose=inline)

25\. Video or lecture notes

Store a video URL or recording with timestamped observations, transcript excerpts, and related notes.

### F. Documents, links, and external content

[Apple Notes](https://images.openai.com/static-rsc-4/CXPCYE-h-gRUGCDx5JhZCRcEhguQJ7XdlO52Whex4ooBbay0Yu7Vq9JnvUiupvCmXZ4s0gVhVn9laij-kMFjbucSV2iuQzCEuUmWdHbWlai4yI4ClWmKHZmkzxBHLePdJ8FUH4uLdzUE2x33FW-jxiu9V2HSh6JYtYAP7YnKO5o?purpose=inline)

26\. Document attachment

PDF, DOCX, TXT, Markdown, and other supported documents. Preserve the original file and extract searchable text when possible.

[Spreadsheet Application Notes at George Hodge blog](https://images.openai.com/static-rsc-4/vc2QMwb_vw9rpShBNRNdkKNBalI531JzamJkujJPkqz7YlJS8Oq-a_93RcxOFvasI5cDqmPD_FcS95JknWJ7NWeF-KKyvRlzEi8QN7BOLvNdY8KIbnp-N3jGfb9_T97IoK13Vbs-eLG7SUHoySTcDEfAoWD87NuNmaKBw06i6TQ?purpose=inline)

27\. Spreadsheet and presentation attachments

XLSX, CSV, PPTX, and other supported formats, with file previews and content extraction where possible.

[Amplecap usage examples - Amplenote](https://images.openai.com/static-rsc-4/7mxg7XH2tlsUAghl7q1O1TLrVvdbu2hDo41QKZE3O_u_cDV2eTPw87zxWUjmnpIYKGRsHITHbmdAvzO60WvcM8STIm45NXUvhY04oJETujHAXr9VX-rStK7gsUe_jM7wylKcgB8kDTyRmT3zIzVEgXyskyEHaOKYXl7aZVeLSzU?purpose=inline)

28\. Web link and bookmark

Save a URL with its title, description, domain, preview image, and optional personal commentary.

[Notebook Web Clipper for Chrome, Firefox, Safari, and Edge](https://images.openai.com/static-rsc-4/qxjH1ysF7e_BbIczphA_DvUB3BvtVPHEkqpggDBkwN2QqymXL0-Dx-y7sRBPaSwujiSoNg7CFoMXWjFob7EI8CRCzBAMPaGSxsRv205TrQHBSTVNzGus_kGJsCbrK6d1Njjhjj7cV-ynppeaSfNkDO_sWKGiDYyl7XVYqbM0ppc?purpose=inline)

29\. Web clipping

Capture an entire article, selected text, a page excerpt, or a screenshot from a browser extension. Store the source URL and capture date.

[Contextual Integrations | Collaboration apps for your business - Zoho Mail](https://images.openai.com/static-rsc-4/sTtUOi8uAWwTK7kGsbzYn7fJS5U5BazS1eZ845JG_VH7X3mhLRjmCOxc00zCXxmnWHAjFN30xSDC1wCMD4reSeh3D6Ixo8c3MN37m_sAdbVNyEtcC0aPWklDtjfTKxgBdYrP9_h1jTT9DMBj0ccldljUoIamvOvFgMvp3_AWnT4?purpose=inline)

30\. Email and message capture

Save message content, sender, recipients, timestamps, links, and attachments from supported integrations.

[Anytype - NoteApps.info](https://images.openai.com/static-rsc-4/MtCQ6sETrxjfU_5Kr-flWUrDowYwa2dCtuv6gFNS0tv7vXSPF1RJqDjgXMi-LHmB2p8fFTLuhR3WbVlNJI5eo6gTjK1wqiEIdJmUr36TDcQlpmIP9O7D_0y_zhXwxymWLpa1DSz1sgDFTPWAiOCdfjN66BuwyPxz2EJHgliRS8g?purpose=inline)

31\. Generic file attachment

Support other file types such as audio, archives, design files, and source files, subject to upload limits and preview support.

### G. Location, time, and specialized inputs

- 32\. Location note: place name, address, coordinates, map link, and personal observations.
- 33\. Date and event note: event details, calendar links, dates, deadlines, and recurring schedules.
- 34\. Contact or person note: name, organization, contact details, and relationship context, with privacy controls.
- 35\. Expense or receipt note: amount, currency, merchant, date, category, and receipt image.
- 36\. Bookmark or reading-list item: article, book, video, or resource with reading status and personal annotations.
- 37\. Quick capture from clipboard: pasted text, screenshots, copied URLs, and supported files.
- 38\. Share-sheet capture: receive content from another app on mobile or desktop.
- 39\. Drag-and-drop capture: drop files, images, URLs, and text into the app.
- 40\. Import and migration: import existing notes from supported formats or other note-taking apps.
- 41\. Email-to-note capture: create notes by forwarding content to a dedicated address, if you choose to provide that service.
- 42\. External integration capture: ingest supported content from calendars, task managers, cloud storage, and other connected services.

These 42 methods form a practical feature inventory, not a claim that every popular notes app supports every method.

## 2. Note organization methods

Input methods describe what the user creates. Organization methods describe where that information lives and how it connects to other information.

For ScribeX, I recommend supporting all of the following.

1\. Universal Inbox

A single destination for every uncategorized thought, attachment, voice recording, and imported item. AI processes the Inbox and proposes where each item belongs.

2\. Folders and nested folders

User-created containers such as Personal → Health or Work → Projects → ScribeX.

3\. Groups and collections

Logical collections such as Career, Long-Term Goals, Reference Material, or Active Projects. Allow AI to suggest new groups and reorganizations.

4\. Multiple tags

Add several labels to the same note, such as `urgent`, `idea`, `finance`, or `research`. Support user-defined and AI-suggested tags.

5\. Linked notes and knowledge graph

Connect notes with explicit relationships such as “related to,” “part of,” “contradicts,” “derived from,” and “supersedes.”

6\. Databases and smart collections

Display the same underlying records as a list, grid, table, board, or calendar. Filter by tags, dates, status, type, or priority.

7\. Pinning, favorites, and shortcuts

Let users surface frequently accessed notes without moving them to a new location.

8\. Archive and trash

Separate inactive information from deleted information. Support recovery, retention rules, and permanent deletion.

### The hierarchy I would use

ScribeX Workspace

Inbox

Folders

Career

Career goals

Resume notes

Tasks

Daily notes

Knowledge graph

Tags, links, priorities, and AI-generated relationships can cross folder boundaries. A note does not have to be duplicated to appear in multiple views.

Important architectural decision: Don't force every note to belong to exactly one group. Give it an optional primary folder, multiple tags, and multiple relationships. Smart collections should be generated from filters rather than copying the underlying notes.

## 3. Every note should support multiple content blocks

This is probably the most important design decision for your editor.

Instead of implementing 42 completely separate note editors, build one block-based editor that can contain different content types in any combination. Notion uses this general approach, supporting text, lists, tables, media, embeds, and other block types within a page.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.notion.com\&sz=32)

Notion



For example, a single meeting note could contain:

## Product Planning Meeting

October 25 · Project ScribeX

### Discussion

We need to support universal capture, with AI handling organization rather than forcing users to select categories.

Action items

Design the universal input composer

Implement attachment extraction

Build note-to-task relationships

Meeting recording

Audio file · Transcript available after processing

12:40

Reference document

Product Requirements.pdf

PDF attachment · AI summary available

AI-generated insight

The discussion implies three implementation tasks. Link them to the active ScribeX project and retain this meeting as their source.

This composition is much more useful than treating the recording, PDF, checklist, and meeting summary as unrelated notes.

### Recommended content block registry

| Block type      | Core data to store           | AI processing                   |
| --------------- | ---------------------------- | ------------------------------- |
| `paragraph`     | Text, formatting             | Semantic extraction             |
| `heading`       | Text, level                  | Outline generation              |
| `bulleted_list` | Ordered item references      | Summarization                   |
| `numbered_list` | Ordered item references      | Step extraction                 |
| `checklist`     | Item IDs, checked states     | Task extraction                 |
| `task`          | Status, priority, due date   | Planning and reminders          |
| `table`         | Columns, rows, cell values   | Structured data extraction      |
| `image`         | Asset ID, caption            | Vision and OCR                  |
| `drawing`       | Asset ID, drawing metadata   | Diagram understanding           |
| `audio`         | Asset ID, duration           | Transcription                   |
| `transcript`    | Text, timestamps, speakers   | Summarization and decisions     |
| `video`         | Asset ID or URL              | Transcript and scene extraction |
| `file`          | Asset ID, file metadata      | Document extraction             |
| `bookmark`      | URL, title, metadata         | Web content analysis            |
| `code`          | Source text, language        | Code understanding              |
| `equation`      | LaTeX source                 | Mathematical interpretation     |
| `callout`       | Text, style                  | Insight classification          |
| `embed`         | Provider, URL, configuration | Metadata extraction             |
| `divider`       | Style                        | Usually none                    |
| `location`      | Coordinates, address         | Place-related context           |

Add specialized blocks later as needed. Every block should have a stable ID, position, creation/update timestamps, and optional metadata. Use structured schemas for interactive elements rather than storing everything as plain text.

## 4. How to integrate every input method with the ScribeX AI assistant

The AI should not just summarize notes. It should transform raw input into useful, connected, and actionable knowledge, as your PRD describes.

I recommend this processing pipeline.

1\. Capture

Text · Voice · Files · Images · Links · Tasks

2\. Normalize and extract

Parse content, extract text, run OCR, transcribe audio, preserve originals

3\. Understand context

Identify people, projects, goals, tasks, dates, decisions, and relevant existing notes

4\. Decide what to do

Update existing note · Create new note · Link · Create task · Ask a question

5\. Apply and verify

Respect permissions, preserve history, validate changes, and record provenance

### What the AI should do for each input

| User input                                | AI behavior                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Random thought                            | Find related notes, identify its meaning, suggest a destination                       |
| Meeting recording                         | Transcribe, summarize, extract decisions and tasks, link the project                  |
| PDF or document                           | Extract text, summarize, identify relevant topics, link to existing notes             |
| Screenshot or image                       | Describe visual content, extract text, identify dates or useful information           |
| Checklist                                 | Preserve completion states, optionally convert actionable items into tasks            |
| Web article                               | Capture source, summarize key points, connect relevant knowledge                      |
| Code snippet                              | Identify language, explain purpose, link to its project                               |
| Daily journal                             | Extract significant events, goals, progress, and changes over time                    |
| Receipt                                   | Extract merchant, amount, date, and currency                                          |
| New project idea                          | Create a candidate project note, identify next steps, and connect related ideas       |
| New information contradicting an old note | Flag the conflict and ask for clarification when necessary                            |
| Repeated information                      | Detect duplicates and propose merging or updating without silently discarding content |

For images, PDFs, and audio, preserve the original attachment even when extracting its content. The AI-generated transcript or summary should be a derived representation linked to the original, not a replacement.

### Four AI controls I would make mandatory

1. Preview changes: Let the assistant show what it plans to create, update, move, or merge.
2. Clarify uncertainty: Ask concise questions when conflicting or ambiguous information could materially affect the user's knowledge base.
3. Track provenance: Store which input, attachment, or previous note supports each AI-generated fact.
4. Maintain history: Record before-and-after versions of edits so the user can review or undo them.

These directly support your PRD's requirements for user control, clarification over assumption, and learning from manual corrections.

## 5. Recommended technical architecture

For your Next.js and MongoDB-based application, I would separate the system into four concepts.

Note

The container for a document, its metadata, ownership, folder, and lifecycle.

Block

The ordered content within a note: text, checklist, audio, image, table, and so on.

Asset

The stored original file, its metadata, processing status, and extracted representations.

Relationship

Connections between notes, tasks, projects, goals, people, and source material.

A practical starting schema might look like this:

```
type Note = {
  id: string;
  title: string;
  folderId?: string;
  tagIds: string[];
  blockIds: string[];
  status: "active" | "archived" | "trashed";
  createdAt: Date;
  updatedAt: Date;
};

type NoteBlock = {
  id: string;
  noteId: string;
  type: string;
  position: number;
  content: Record<string, unknown>;
  assetIds?: string[];
  createdAt: Date;
  updatedAt: Date;
};

type Asset = {
  id: string;
  storageKey: string;
  mimeType: string;
  fileName: string;
  size: number;
  processingStatus:
    | "pending"
    | "processing"
    | "completed"
    | "failed";
  extractedText?: string;
};

type NoteRelationship = {
  sourceId: string;
  targetId: string;
  type:
    | "related_to"
    | "part_of"
    | "derived_from"
    | "supersedes";
  createdBy: "user" | "ai";
};
```

This is a starting point rather than a complete production schema. You would still need workspace ownership, access control, validation, block-specific schemas, task records, version history, and appropriate indexes.

### Important implementation choices

- Editor: Use a block-oriented editor such as Tiptap, with custom nodes for audio, attachments, tasks, and other interactive blocks. Not every block needs to be editable as ordinary text.
- File storage: Store file binaries in object storage such as S3; keep references and metadata in MongoDB.
- AI processing: Use background jobs for expensive OCR, transcription, embeddings, and document extraction instead of blocking the editor.
- Retrieval: Combine keyword search, metadata filters, and semantic search to find related notes. Add relationship traversal when answering questions across the knowledge base.
- History: Version note content and record structured change events for user and AI edits.
- Reliability: Make processing jobs retryable and idempotent so the same upload or event does not accidentally create duplicate notes or tasks.

## 6. What I would implement first

You don't need to build every input method before integrating the assistant. Start with the inputs that provide the greatest coverage, then expand the editor and processing pipeline.

## Implementation checklist

0 / 20

### Phase 1 — Core notes

Plain text and rich text

Headings, lists, quotes, and dividers

Checklists and actionable tasks

Folders, tags, pinning, and search

Autosave and version history

### Phase 2 — Universal capture

Image and generic file attachments

PDF and document text extraction

Clipboard paste and drag-and-drop

URL bookmarks and web capture

Universal Inbox and AI-assisted organization

### Phase 3 — Voice and intelligence

Voice recording and dictation

Transcription and meeting summaries

AI task extraction and note linking

Semantic search and cross-note retrieval

Preview, clarification, and change verification

### Phase 4 — Advanced content

Tables, code, and equations

Drawing and handwriting

Video transcription and analysis

Smart collections and knowledge graph

External integrations and import tools

&#x20; Copy implementation checklist&#x20;

## My final recommendation

Build ScribeX around universal capture + a block-based note editor + a shared task model + an AI organization pipeline.

That combination gives you a foundation for nearly every input type above without creating a separate subsystem for every kind of note. It also aligns with your core vision: users provide information naturally, and Friday turns it into organized, connected, actionable knowledge while keeping the user in control.

The feature list is the starting point; the block model and AI processing pipeline are what will make the entire system work together.