# ScribeX Documentation Index & Navigation Map

> **Purpose:** Central catalog of all technical specifications, requirements, architecture blueprints, audit reports, and roadmap plans for the ScribeX project.  
> **Status:** 100% Harmonized & Aligned Single Source of Truth  
> **Last Updated:** November 9, 2026

---

## 1. Authoritative Core Specifications (Root `docs/`)

| Document | Description |
| :--- | :--- |
| **[Unified_Backend_and_AI_Master_Specification.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Unified_Backend_and_AI_Master_Specification.md)** | **Authoritative Single Source of Truth (SSOT)** for Backend & AI. Unifies Zero-Cost Cloud Sync (Supabase + Next.js Vercel + Google Drive), 4-Layer Memory, Dual-Surface AI (In-App Friday + Universal MCP Connector), and Remote PC Agent Execution. |
| **[Universal_Note_Input_Structure_and_Relations.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Universal_Note_Input_Structure_and_Relations.md)** | **Authoritative Single Source of Truth (SSOT)** for Frontend: All 42 input blocks, AST schema, bidirectional knowledge graph relations, and smart collections. |
| **[Product_Requirements.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Product_Requirements.md)** | Product vision, core user journey (Manual Notes First, Friday AI Second), functional requirements, and Dual-Surface AI workflows. |
| **[ScribeX-Pastel-Tile-UI-Design-System.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/ScribeX-Pastel-Tile-UI-Design-System.md)** | Design tokens, color palette, typography, spacing, and guidelines strictly enforcing non-generic canvas design. |

---

## 2. Active Phase Implementation Blueprints (Root `docs/`)

| Document | Phase | Status | Description |
| :--- | :---: | :---: | :--- |
| **[Master_Tasks_Tracker.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Master_Tasks_Tracker.md)** | Master | `ACTIVE` | Master multi-phase tracker detailing completed Phase 1 milestones and pending phases. |
| **[Phase_2_Implementation_Plan.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Phase_2_Implementation_Plan.md)** | Phase 2 | `NEXT IN QUEUE` | Step-by-step implementation blueprint for Supabase Realtime Sync, Next.js AI (Vercel), and Google Drive Media Vault. |
| **[Phase_3_Implementation_Plan.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Phase_3_Implementation_Plan.md)** | Phase 3 | `PENDING` | Cognitive Memory, Friday AI Assistant, and Universal MCP Connector integration. |
| **[future_ideas.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/future_ideas.md)** | Backlog | `ACTIVE` | Feature wishlist, bugfix backlog, and long-term architectural ideas. |

---

## 3. Technical Deep-Dive References (`docs/references/`)

Comprehensive technical deep-dives absorbed into the Master Specification, retained for detailed implementation guidance:

| Document | Description |
| :--- | :--- |
| **[Technical_System_Architecture.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/references/Technical_System_Architecture.md)** | The comprehensive 9-pillar technical architecture (Expo client, SQLite, Supabase Realtime, Next.js Serverless AI, PC Bridge). |
| **[Universal_AI_Connector_and_MCP_Architecture.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/references/Universal_AI_Connector_and_MCP_Architecture.md)** | Detailed specification of MCP resources, tool JSON schemas, stdio/SSE transports, and OpenAI REST bridge. |
| **[Local_Serverless_Reminder_Implementation_Plan.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/references/Local_Serverless_Reminder_Implementation_Plan.md)** | Implementation details for hardware OS push notifications (`AlarmManager` / iOS) and `sync_changelog` delta tracking. |
| **[Learning_Storing_Retrieval_Strategy.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/references/Learning_Storing_Retrieval_Strategy.md)** | In-depth exploration of the 4-layer cognitive memory and multi-step contextual retrieval pipeline. |
| **[SaaS_Architecture_and_Integration_Plan.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/references/SaaS_Architecture_and_Integration_Plan.md)** | Multi-tenancy isolation models, Supabase RLS, Stripe subscriptions, and LiteLLM token metering. |

---

## 4. Audits & Verification Reports (Root `docs/`)

| Document | Description |
| :--- | :--- |
| **[Cross_Platform_Input_Blocks_Audit_Report.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Cross_Platform_Input_Blocks_Audit_Report.md)** | Live automated ledger tracking TypeScript compilation, 36/36 block AST roundtrips, platform guards, and 30/30 headless interaction tests. |
| **[UI_UX_Cross_Platform_Inconsistencies_Report.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/UI_UX_Cross_Platform_Inconsistencies_Report.md)** | Static analysis report covering full-bleed layouts, touch targets, and React Native flex hazard protections (13/13 passing). |
| **[Block_Storage_and_Searchability_Audit.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Block_Storage_and_Searchability_Audit.md)** | Deep dive audit verifying dual-persistence (`blocks_json` + `content_markdown`) and SQLite FTS5 index coverage. |

---

## 5. Archived Blueprints (`docs/archive/`)

Historical implementation blueprints and superseded drafts are preserved in [`docs/archive/`](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/archive/):

* `legacy_python_vps/Phase_2_FastAPI_VPS_Implementation_Plan.md`: Superseded Python FastAPI VPS backend blueprint (replaced by zero-cost Supabase + Next.js Serverless architecture).
* `project-first-ai-orchestration-blueprint.md`: Generic orchestration framework blueprint (condensed into `AGENTS.md` and `.agents/skills/task-worker/SKILL.md`).
* `Folder_Actions_Feature_Plan.md`: Phase 1 folder rename, delete cascades, reparenting, and subfolder creation.
* `Manual_Notes_Final_Gaps_Implementation_Plan.md`: Phase 1 note sorting UI, workspace backup/restore, and storage purge modal.
* `Search_Implementation_Plan.md`: Phase 1 SQLite FTS5 search engine and search history repo.
