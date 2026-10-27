# Product Requirements Document: ScribeX - Friday (Iron man style Personal Assistant) & Note-Taking Platform

## 1. Product Vision & Core Philosophy

The platform, **ScribeX**, is a modern, high-performance universal note-taking system and proactive personal assistant—inspired by Friday (Iron Man-style Personal Assistant). 

### Foundational User Journey Axiom: Manual Notes First, AI Assistant Second
The system is built from the **user's immediate journey first**:
1. **The Instant Manual Canvas:** When the user opens ScribeX, their initial experience is entering an uncluttered, fluid, non-generic personal knowledge canvas. They can immediately capture notes, format code, record audio, sketch ideas, embed documents, manage nested folders, tag items, and track tasks across all **42 planned input methods** (detailed in `Universal_Note_Input_Structure_and_Relations.md`) with sub-5ms local-first speed (`expo-sqlite`). There is zero forced onboarding friction or AI gating.
2. **The Intelligent Force Multiplier (Friday):** Once the user's manual note foundation is active, the AI assistant ("Friday") seamlessly connects to this living knowledge base. Friday acts as an autonomous force multiplier: handling proactive organization, cross-note connections, goal alignment, task tracking, daily briefings, and Remote PC CLI agent execution—all while strictly respecting the user's manual control and learning from every user edit.

---

## 2. Core Functional Requirements

### 2.1. Frictionless Universal Input & Manual Note Foundation
* **Frictionless Capture Canvas:** The user can instantly open a note canvas and write with zero delay. No network spinner, no mandatory categorization, and no AI interrogation before writing.
* **42 Comprehensive Manual Input Methods:** Full native support for rich text, markdown, collapsible outlines, interactive tables, syntax-highlighted code blocks with copy, KaTeX equations, callouts, vector sketch pads, audio voice recordings, document attachments (PDFs, spreadsheets), and web bookmarks.
* **Fluid Non-Generic UI Aesthetics:** The interface strictly avoids generic card grids, boxy SaaS widgets, or cookie-cutter dashboard templates. It delivers a serene, soft minimalist editorial canvas with vivid pastel note accents, compact circular controls, and generous breathing room.
* **Full User Sovereignty Over Context Files:** The user retains 100% manual authority to create, edit, rename, reorganize, move, or delete any note, folder, tag, or relation at any time.
* **Manual Change History Log for AI Learning:** Every manual edit the user makes is recorded as a versioned diff in the Git vault. The AI assistant analyzes these manual adjustments to learn the user's organizational preferences and filing habits without disturbing the user's manual workflow.

### 2.2. Autonomous Note Creation, Editing, and Merging
* **Intelligent Content Routing:** Whenever the user inputs new information, the assistant must analyze its meaning and context against all existing notes.
* **Smart Updating vs. New Creation:**
  * If the input relates to an existing topic, project, or note, the assistant must automatically locate that note and seamlessly append, update, or restructure the relevant section.
  * If the input introduces a brand-new topic or initiative, the assistant must automatically create a new note and place it in the appropriate group.
* **Dynamic Restructuring:** As notes grow over time, the assistant must automatically split overly large notes into logical sub-notes, merge redundant notes, and reorganize groups so the workspace remains clean and navigable.

### 2.3. Dynamic Grouping & Priority-Wise Mapping
* **Automatic Segregation:** Notes must be dynamically segregated into logical domains and groups (e.g., Career, Personal Growth, Daily Operations, Long-Term Vision, Projects, Reference Material) that evolve as the user's life changes.
* **Priority Mapping & Placement:** Every note, group, and action item must be dynamically ranked and positioned based on urgency, importance, and alignment with the user's current short-term and long-term goals. High-priority items must naturally surface to the top of the user's workspace.

### 2.4. Intelligent File & Asset Management
* **Automated File Filing:** When the user provides a file (documents, images, spreadsheets, etc.), the assistant must examine the file's contents and purpose, place it in the proper context within the notes ecosystem, and link it to any relevant existing notes, goals, or tasks.
* **Actionable File Intake:** Upon receiving a file, the assistant should summarize its relevance, connect it to existing context, and suggest what actions should be taken regarding that file.

### 2.5. Composable Block Architecture & Unified Task Engine
* **Universal Composable Blocks (42 Input Methods):** Rather than maintaining separate siloed apps for text, sketches, PDFs, audio recordings, or spreadsheets, all 42 input methods enter the system through a unified composable block model. A single note can seamlessly contain rich markdown, KaTeX equations, vector sketches, audio transcripts, and embedded files.
* **Core Two-Part Dual Engine (1 — Notes & 2 — Tasks):** The core application layout is divided into two distinct mental modes accessible via a floating minimalist bottom navigation dock:
  1. **Notes Workspace:** Pastel tile canvas for capturing, exploring, and organizing freeform thoughts, meeting logs, audio memos, and structured documents.
  2. **Tasks Workspace:** High-velocity checklist ledger for reviewing today's to-dos, upcoming priorities, and completing items.
* **Unified Task Engine (Single Source of Truth):** Action items and checklist items embedded inside meeting notes share the exact same entity identity as items on the global task board. Checking off an item in either location synchronizes the state across both instantly. Standalone quick tasks can also be created without generating a whole note document.
* **Cross-Boundary Relational Graph:** Knowledge is not trapped in mutually exclusive folders. Notes connect across categories via bidirectional graph relationships (`related_to`, `part_of`, `derived_from`, `contradicts`, `supersedes`) and dynamic Smart Collections.

---

## 3. Personal Knowledge Architecture ("Everything About Me")

### 3.1. Interactive Personalization & Onboarding (User-Initiated)
* **User-Initiated Discovery Interview:** When the user is ready to introduce themselves to Friday and personalize their AI companion, they can trigger the conversational onboarding interview. It does NOT block or lock the user out of the manual note-taking canvas.
* **Foundational Profile Creation:** During onboarding, the assistant proactively asks thoughtful questions to capture baseline information about the user, including:
  * Full name and personal identity details.
  * Current daily responsibilities, routines, and activities.
  * Complete career journey (past roles, skills, milestones, and transitions).
  * Long-term life and career goals.
  * Short-term goals and current active projects.
  * Current daily checklists, habits, and priority preferences.

### 3.2. Holistic Living Profile & Goal Hierarchy
* **Structured Personal Core:** The assistant must maintain a permanent, continuously updated core profile of the user that connects:
  * Who the user is (Identity, values, background).
  * Career Journey (Past experiences, current work, future aspirations).
  * Long-Term Goals (Multi-year vision and major milestones).
  * Short-Term Goals (Quarterly/monthly targets that feed into long-term goals).
  * Daily Checklists & Priorities (Day-to-day actionable tasks mapped directly to short-term goals and immediate obligations).

### 3.3. Temporal Versioning & Life-Journey Logging ("Versions of Me")
* **Evolution Tracking, Not Just Overwriting:** When the user provides new information that changes a previous fact, goal, habit, or career status, the assistant must not simply overwrite and forget the old information.
* **Versioned Personal History:** The assistant must maintain a chronological log of each "version" of the user. It must understand:
  * Who the user was in the past.
  * What specific changes occurred and when.
  * How the user's mindset, career, priorities, and goals have evolved over time.
* **Past-to-Future Continuity:** The assistant must be able to reference past versions of the user to provide perspective on personal growth, recurring habits, and future trajectory.

### 3.4. Complete Task & Interaction History
* **Historical Task Log:** The assistant must remember every task the user has assigned to it or tracked through the platform in the past, including how those tasks were handled, completed, delayed, or modified.
* **Informed Task Assistance:** When new tasks arise, the assistant must use its memory of past tasks to offer smarter assistance, reuse successful approaches, and warn the user about potential bottlenecks based on historical patterns.

---

## 4. "Friday-Style" (Iron man style Personal Assistant) Behaviors & Intelligence

### 4.1. Clarification Over Assumption
* **Zero Blind Guessing:** If a new note, file, or instruction is ambiguous, incomplete, or contradicts existing notes, the assistant must never guess or assume.
* **Targeted Questioning:** The assistant must pause and ask concise, intelligent clarifying questions to confirm the user's exact intent before finalizing where to place the information or how to update existing notes.

### 4.2. Proactive Suggestions & Next-Step Recommendations
* **Immediate Intake Suggestions:** Every time the user inputs a note or uploads a file, the assistant should analyze how it impacts the user's goals and schedule, and immediately suggest logical next steps, follow-up tasks, or priority adjustments.
* **Proactive Daily Briefings & Updates:** The assistant must proactively provide status updates, reminders, and curated daily checklists based on pending priorities, upcoming deadlines, and long-term goal alignment.

### 4.3. Flawless Context Management & Complete Retrieval
* **Holistic Context Awareness:** When the user asks a question or requests information, the assistant must retrieve the complete picture across all relevant notes, files, past versions, and tasks—never returning fragmented or out-of-context answers.
* **Cross-Note Synthesis:** The assistant must connect dots across different areas of the user's life (for example, realizing how a casual note entered today impacts a short-term goal set three weeks ago).

### 4.4. Adaptive Persona & Behavioral Self-Improvement
* **Learning from User Patterns:** The assistant must not remain a static, rigid persona following a fixed script. It must continuously observe the user's communication style, response patterns, working hours, decision-making habits, and preferences.
* **Self-Refining Interaction:** Over time, the assistant must adapt its tone, level of detail, questioning frequency, and task-suggestion style to match what works best for the user—becoming more intuitive and tailored with every interaction.

---

## 5. Remote Agentic PC Execution & Multi-Agent Orchestration

### 5.1. Actionable Remote PC Task Execution
* **Beyond Passive Storage & Retrieval:** The platform must not be limited to a web or mobile interface that only stores and retrieves notes. It must function as an active, hands-on agent capable of performing real work on the user's personal computer through authorized remote access.
* **Anywhere-to-PC Command Execution:** The user must be able to instruct the Main AI Assistant from anywhere (web or mobile app) to carry out tasks directly on their personal PC—such as coding, organizing local project files, generating reports, running scripts, or updating local repositories.

### 5.2. Commander-to-Worker Agent Delegation
* **Context-Enriched Instruction Generation:** When the user requests a task to be executed on their PC, the Main AI Assistant must gather all relevant context from the user's notes, projects, past tasks, and preferences, and translate that into clear, step-by-step instructions for a local worker AI agent on the remote PC.
* **Interactive Multi-Agent Coordination:** The Main AI Assistant must actively communicate with the CLI-based AI agent running on the user's PC, answering the local agent's questions using the user's personal knowledge base and guiding it until the task is finished.

### 5.3. Universal & Easily Configurable CLI Agent Provider Support
* **Provider-Agnostic Configuration:** The user must be able to easily configure, plug in, or switch between any CLI-based AI agent provider on their PC (such as Claude Code, Gemini CLI, Codex CLI, Aider, OpenCode, Goose, or any future/custom CLI agent) without changing how they interact with the Main AI Assistant.
* **Task-Specific Agent Routing:** The user should have the flexibility to set a single default CLI agent or allow the Main AI Assistant to choose different configured CLI agents depending on the nature of the task.

### 5.4. Independent Work Verification & Self-Correction Loop
* **Zero Blind Trust in Worker Agents:** The Main AI Assistant must never simply take the remote PC AI agent's word that a task is finished. It must independently verify that the work was actually completed accurately and meets all of the user's requirements.
* **Automated Review & Retry:** If the Main AI Assistant detects that the remote CLI agent made a mistake, left work incomplete, or failed a check, it must automatically instruct the remote CLI agent to fix the issue and re-verify the output before reporting back to the user.
* **Post-Task Context & Checklist Sync:** Once the Main AI Assistant confirms the work is properly done, it must automatically update the relevant notes, mark corresponding checklist items as complete, record the execution details in the task history log, and notify the user.

### 5.5. User Control & Safety Boundaries for Remote Execution
* **Defined Workspace Boundaries:** The user must be able to control which directories, projects, or areas of their personal PC the remote agent is allowed to access.
* **Approval Gates for Sensitive Actions:** If a remote task involves high-impact or irreversible changes, the Main AI Assistant must ask the user for confirmation before allowing the remote CLI agent to proceed.

---

## 6. Core User Workflows to Support

* **Instant Note-Taking & Organization Flow (Foundation):** The user opens the app to an immediate, fluid notes canvas. They create, format, and structure notes using 20 composable block types (text, checklists, code, KaTeX, tables, drawings, audio, PDFs, bookmarks), organize via nested folders and multi-tags, connect notes with bidirectional `[[Note Title]]` links, and track unified tasks with instant sub-5ms local SQLite persistence.
* **User-Initiated Onboarding Flow:** When ready, the user initiates a conversation with Friday. Friday interviews the user, builds the foundational Layer 1 profile ("Everything About Me"), and aligns active short- and long-term goals with their existing notes.
* **Quick Capture & Intake Flow:** The user drops a thought, link, or media file into the universal intake. Friday analyzes the context, prompts for clarification if ambiguous, updates/creates relevant notes, logs any personal evolution, and suggests actionable next steps.
* **Daily Review & Proactive Update Flow:** Friday presents the user with their prioritized daily checklist, highlights neglected goals or upcoming deadlines, and dynamically recalibrates based on feedback.
* **Deep Retrieval & Life Reflection Flow:** The user asks about a past project, document, task, or personal evolution, and Friday synthesizes a rich answer spanning the historical timeline ("Versions of Me") and current living notes.
* **Remote PC Agentic Execution Flow:** The user assigns a technical or operational task from mobile or web. Friday enriches the task with context from the user's notes, dispatches it to the user's configured CLI agent (Claude Code, Gemini CLI, etc.) on their PC, monitors progress, independently verifies the output with tests/git diffs, and updates notes upon verified completion.
