# Product Requirements Document: ScribeX - Friday (Iron man style Personal Assistant) & Note-Taking Platform

## 1. Product Vision & Core Philosophy

The platform, ScribeX, is an intelligent, self-organizing universal note-taking system and proactive personal assistant - inspired by Friday (Iron man style Personal Assistant). The core objective is to drastically reduce manual organization while keeping the user in complete control. The user can simply provide raw inputs—thoughts, notes, tasks, updates, or files—and the AI assistant autonomously organizes, updates, links, prioritizes, and manages everything while maintaining a complete, evolving understanding of the user's life, past, present, and future goals. At the same time, the user retains full manual control over all context files and notes, with every manual edit logged in a history log so the AI can learn from the user's adjustments and continuously improve itself. Furthermore, the platform extends beyond passive note management into an active, agentic assistant capable of executing real-world tasks on the user's personal computer by orchestrating and verifying local CLI-based AI agents.

---

## 2. Core Functional Requirements

### 2.1. Frictionless Universal Input & User Control (Reduced Manual Organization)
* **Single Point of Entry:** The user must be able to input any type of information (quick thoughts, meeting notes, daily tasks, life updates, documents, or media files) into a single, unified input space without needing to manually choose a folder, category, tag, or destination note every time.
* **Reduced Manual Categorization:** The assistant should handle the heavy lifting of organizing, categorizing, and placing information automatically so the user's manual effort is minimized.
* **Full User Control Over Context Files:** The user must have complete access and authority to manually view, edit, reorganize, move, or delete any context file, note, group, or priority mapping at any time.
* **Manual Change History Log for AI Learning:** Whenever the user manually edits a note, reorganizes a group, or modifies a context file, the platform must record a detailed history log of those manual changes. The AI assistant must analyze these manual adjustments to understand the user's preferences, correct its own organizational habits, and improve future automated placements and updates.

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

---

## 3. Personal Knowledge Architecture ("Everything About Me")

### 3.1. Comprehensive Interactive Onboarding
* **Initial Discovery Interview:** When the platform is first used, the assistant must guide the user through a conversational onboarding process.
* **Foundational Profile Creation:** During onboarding, the assistant must proactively ask questions to capture all essential baseline information about the user, including:
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

* **Onboarding Flow:** The assistant interviews the user, builds the initial "Everything About Me" profile, sets up initial note groups, and establishes the first daily checklist and goal hierarchy.
* **Quick Capture Flow:** The user drops a raw thought, update, or file into the assistant. The assistant checks if clarification is needed; if clear, it updates/creates the right notes, adjusts priorities, logs any personal evolution, and suggests actionable next steps.
* **Daily Review & Update Flow:** The assistant presents the user with their prioritized daily checklist, highlights updates or neglected goals, and adjusts the day's plan based on the user's feedback.
* **Deep Retrieval & Reflection Flow:** The user asks about a topic, file, past task, or their own personal/career growth, and the assistant synthesizes a complete, accurate response drawing from the user's entire historical timeline and current notes.
* **Remote PC Agentic Execution Flow:** The user assigns a practical task from the web or mobile app to be executed on their personal PC. The Main AI Assistant pulls the full context from the user's notes, dispatches instructions to the user's configured CLI AI agent on the remote PC, monitors and independently verifies that the work was completed properly, triggers corrections if needed, and updates the user's notes and task history upon verified completion.
