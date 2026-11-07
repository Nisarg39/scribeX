# ScribeX Documentation Index & Navigation Map

> **Purpose:** Central catalog of all technical specifications, requirements, architecture blueprints, audit reports, and roadmap plans for the ScribeX project.  
> **Last Updated:** November 8, 2026

---

## 1. System Vision & Architecture (Source of Truth)

| Document | Description |
| :--- | :--- |
| **[Product_Requirements.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Product_Requirements.md)** | Product vision, core user journey (Manual Notes First, Friday AI Second), and functional requirements. |
| **[Technical_System_Architecture.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md)** | Comprehensive 9-pillar technical architecture (Expo client, SQLite, Supabase Realtime, Next.js Serverless AI on Vercel, Google Drive Vault, Friday Memory, PC Bridge). |
| **[Universal_Note_Input_Structure_and_Relations.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Universal_Note_Input_Structure_and_Relations.md)** | Definitive specification for all 42 input blocks, AST schema, bidirectional knowledge graph relations, and smart collections. |
| **[ScribeX-Pastel-Tile-UI-Design-System.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/ScribeX-Pastel-Tile-UI-Design-System.md)** | Design tokens, color palette, typography, spacing, and guidelines strictly enforcing non-generic canvas design. |
| **[Learning_Storing_Retrieval_Strategy.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Learning_Storing_Retrieval_Strategy.md)** | 4-layer cognitive memory model and adaptive learning strategy for Friday AI. |
| **[SaaS_Architecture_and_Integration_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/SaaS_Architecture_and_Integration_Plan.md)** | Multi-tenancy, commercial billing, token quotas, and cloud infrastructure scaling. |

---

## 2. Roadmaps & Phase Trackers

| Document | Status | Description |
| :--- | :---: | :--- |
| **[Master_Tasks_Tracker.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Master_Tasks_Tracker.md)** | `ACTIVE` | Master multi-phase tracker detailing completed Phase 1 milestones and pending phases. |
| **[Phase_2_Cloud_Sync_and_Backend_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Phase_2_Cloud_Sync_and_Backend_Plan.md)** | `NEXT IN QUEUE` | Implementation plan for Supabase Realtime Sync, Next.js AI (Vercel), and Google Drive Vault. |
| **[future_ideas.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/future_ideas.md)** | `ACTIVE` | Feature wishlist, bugfix backlog, and long-term architectural ideas. |

---

## 3. Audits & Verification Reports

| Document | Description |
| :--- | :--- |
| **[Cross_Platform_Input_Blocks_Audit_Report.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Cross_Platform_Input_Blocks_Audit_Report.md)** | Live automated ledger tracking TypeScript compilation, 36/36 block AST roundtrips, platform guards, and 30/30 headless interaction tests. |
| **[UI_UX_Cross_Platform_Inconsistencies_Report.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/UI_UX_Cross_Platform_Inconsistencies_Report.md)** | Static analysis report covering full-bleed layouts, touch targets, and React Native flex hazard protections (13/13 passing). |
| **[Block_Storage_and_Searchability_Audit.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Block_Storage_and_Searchability_Audit.md)** | Deep dive audit verifying dual-persistence (`blocks_json` + `content_markdown`) and SQLite FTS5 index coverage. |

---

## 4. Completed Feature Plans (Archived)

Historical implementation blueprints for features that have been 100% completed and merged into the main codebase are stored in [`docs/archive/`](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/archive/):

- `Folder_Actions_Feature_Plan.md`: Folder rename, delete cascades, reparenting, and subfolder creation.
- `Manual_Notes_Final_Gaps_Implementation_Plan.md`: Note sorting UI, workspace backup/restore, and storage purge modal.
- `Search_Implementation_Plan.md`: SQLite FTS5 search engine and search history repo.

