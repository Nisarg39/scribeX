# ScribeX Master Tasks Tracker

> **Purpose:** High-level task management checklist tracking what is completed and what remains. Detailed specifications are maintained in the referenced docs.  
> **Status:** Active Tracking Document  
> **Last Updated:** October 25, 2026  

---

## Progress Overview

| Phase | Description | Status | Reference Doc |
| :---: | :--- | :---: | :--- |
| **Phase 1** | VPS Core Backend, Operational Storage & 4-Layer Memory | `[x] COMPLETED` | [Phase_1_Implementation_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Phase_1_Implementation_Plan.md) |
| **Phase 2** | Universal Expo App + Resilient Delta Sync | `[ ] UPCOMING (NEXT)` | [Technical_System_Architecture.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md#4-bidirectional-synchronization-engine-delta-sync) |
| **Phase 3** | Manual Edit Diff Learner + Temporal "Versions of Me" | `[ ] PENDING` | [Technical_System_Architecture.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md#5-agent-architecture-the-three-autonomous-loops) |
| **Phase 4** | Remote PC Bridge Daemon + Pluggable CLI Verification Loop | `[ ] PENDING` | [Technical_System_Architecture.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md#6-remote-pc-agent-orchestration-daemon) |
| **Phase 5** | SaaS Multi-Tenancy, Auth & Device Pairing Protocol | `[ ] PENDING` | [SaaS_Architecture_and_Integration_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/SaaS_Architecture_and_Integration_Plan.md#2-day-1-saas-ready-foundations-phase-1-pre-requisites) |
| **Phase 6** | Commercial Launch, Billing, Token Quotas & Scaling | `[ ] PENDING` | [SaaS_Architecture_and_Integration_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/SaaS_Architecture_and_Integration_Plan.md#5-billing--tier-enforcement-stripe-integration) |

---

## Phase 1: VPS Core Backend, Operational Storage & 4-Layer Memory
*Details in [Phase_1_Implementation_Plan.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Phase_1_Implementation_Plan.md).*

- [x] **Step 1:** Set up FastAPI backend scaffolding, dependencies, and SaaS tenant path resolver.
- [x] **Step 2:** Implement SQLite operational database in WAL mode with core tables (`notes`, `sync_changelog`, `entity_edges`, `staging_intake`, FTS5).
- [x] **Step 3:** Build Git-backed Markdown vault projector (`GitPython`) with author tagging (`ScribeX-AI` vs. `User`).
- [x] **Step 4:** Integrate embedded LanceDB vector engine and multi-format document parser (PDF, MD, CSV, JSON, TXT).
- [x] **Step 5:** Build Cognitive Memory Layer 1 (RAM-cached identity prompt) and Layer 2 (triple hybrid context retriever: FTS5 + LanceDB + graph edges).
- [x] **Step 6:** Build Universal Intake endpoint (`POST /api/v1/intake`) with Ask-Before-Write ambiguity gate and clarification flow.
- [x] **Step 7:** Implement interactive 6-pillar conversational onboarding interview API and profile synthesis.
- [x] **Step 8:** Create master end-to-end integration test suite and verify 100% green status (33/33 tests passing).

---

## Phase 2: Universal Expo App + Resilient Delta Sync
*Details in [Technical_System_Architecture.md (Sections 3 & 4)](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md#4-bidirectional-synchronization-engine-delta-sync).*

- [ ] **Task 2.1:** Scaffold universal Expo project (iOS, Android, Web) with custom premium theme and typography.
- [ ] **Task 2.2:** Set up local offline-first SQLite cache on device using `expo-sqlite` for sub-5ms local reads.
- [ ] **Task 2.3:** Implement WebSocket doorbell push receiver (`SYNC_PING`) and delta catch-up handshake (`GET /api/v1/sync/deltas?since_rev=X`).
- [ ] **Task 2.4:** Build rich Markdown note editor with debounce auto-save and vault group folder navigator.
- [ ] **Task 2.5:** Create interactive Ambiguity Gate dialog for answering clarifying questions when intake needs clarification.
- [ ] **Task 2.6:** Build conversational onboarding interview screens and dynamic Layer 1 profile view.

---

## Phase 3: Manual Edit Diff Learner + Temporal "Versions of Me"
*Details in [Technical_System_Architecture.md (Section 5)](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md#5-agent-architecture-the-three-autonomous-loops) and [Learning_Storing_Retrieval_Strategy.md](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Learning_Storing_Retrieval_Strategy.md).*

- [ ] **Task 3.1:** Build background Git commit monitor comparing user manual edits against AI commits to extract unified diffs.
- [ ] **Task 3.2:** Implement Layer 4 Behavioral Ledger engine extracting formatting, tone, and filing rules into `learned_preferences`.
- [ ] **Task 3.3:** Implement Layer 3 Episodic Memory engine tracking changes to user goals and vision in `identity_timeline`.
- [ ] **Task 3.4:** Add automated reconciliation reconciling SQLite operational data and LanceDB vectors with raw Markdown files.

---

## Phase 4: Remote PC Bridge Daemon + Pluggable CLI Verification Loop
*Details in [Technical_System_Architecture.md (Sections 6 & 7)](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/Technical_System_Architecture.md#6-remote-pc-agent-orchestration-daemon).*

- [ ] **Task 4.1:** Create lightweight `pc-agent-bridge` daemon connecting outward to VPS via persistent WebSocket.
- [ ] **Task 4.2:** Implement pluggable CLI configuration (`cli_agents.yaml`) supporting tools like Claude Code and shell scripts.
- [ ] **Task 4.3:** Build 3-stage verification pipeline (pre-check safety blocklist, live stdout streaming, and post-check git diff verification).
- [ ] **Task 4.4:** Implement task dispatcher projecting execution summaries and test results back into structured notes.

---

## Phase 5: SaaS Multi-Tenancy, Auth & Device Pairing Protocol
*Details in [SaaS_Architecture_and_Integration_Plan.md (Sections 2, 3, 4)](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/SaaS_Architecture_and_Integration_Plan.md#2-day-1-saas-ready-foundations-phase-1-pre-requisites).*

- [ ] **Task 5.1:** Integrate authentication provider (Clerk / Supabase Auth) injecting authenticated `user_id` into all requests.
- [ ] **Task 5.2:** Build remote machine pairing protocol (`scribex pair` OTP challenge + Ed25519 token exchange).
- [ ] **Task 5.3:** Set up Cloudflare Ingress reverse proxy, SSL termination, and tenant rate limiting.
- [ ] **Task 5.4:** Create automated tenant boundary test suite verifying cross-tenant storage isolation.

---

## Phase 6: Commercial Launch, Billing, Token Quotas & Public Scaling
*Details in [SaaS_Architecture_and_Integration_Plan.md (Sections 5, 6, 7)](file:///Users/nash/Documents/FrontEnd%20Development/ai_projects/scribeX/docs/SaaS_Architecture_and_Integration_Plan.md#5-billing--tier-enforcement-stripe-integration).*

- [ ] **Task 6.1:** Integrate Stripe checkout and subscription webhooks for Free and Pro tiers.
- [ ] **Task 6.2:** Implement LiteLLM monthly token budget metering, usage quotas, and encrypted BYO-Key support.
- [ ] **Task 6.3:** Set up automated nightly encrypted backup snapshots to object storage (S3 / Cloudflare R2).
- [ ] **Task 6.4:** Implement structured telemetry, error monitoring (Sentry), and performance metrics.
