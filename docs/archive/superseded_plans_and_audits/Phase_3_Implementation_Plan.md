# ScribeX Phase 3: Cognitive Memory, Friday Client-Direct Assistant & Universal MCP Connector
## Step-by-Step Implementation Blueprint

> **Document Status:** Active Implementation Blueprint (Follows Phase 2)  
> **Authoritative Source of Truth:** [Unified_Backend_and_AI_Master_Specification.md](file:///c:/Users/Nash/Documents/codebase/scribeX/docs/Unified_Backend_and_AI_Master_Specification.md)  
> **Prerequisites:** Phase 2 (Supabase Realtime Sync, RPC Stored Procedures, Google Drive Media Vault) Certified.  
> **Target Directories:** `frontend/src/services/ai/`, `frontend/src/screens/`, `connector/`  

---

## 1. Master Progress Tracker

Every step must be implemented, tested, and verified before marking complete and advancing.

| Step | Milestone / Component | Primary Files | Status |
| :---: | :--- | :--- | :---: |
| **1** | [Client-Direct BYOK AI Runtime & Provider Adapter](#step-1-client-direct-byok-ai-runtime--provider-adapter) | `frontend/src/services/ai/providers/`, `frontend/src/services/ai/clientAiService.ts` | `[ ] PENDING` |
| **2** | [Universal Invocation Platform Context (`PlatformContext`)](#step-2-universal-invocation-platform-context-platformcontext) | `frontend/src/services/ai/platformContext.ts` | `[ ] PENDING` |
| **3** | [Layer 1 Memory: Core Identity & Active Priorities](#step-3-layer-1-memory-core-identity--active-priorities) | `frontend/src/services/ai/memory/layer1Identity.ts`, Supabase `user_profile` table | `[ ] PENDING` |
| **4** | [Layer 2 Memory: Living Notes & Knowledge Graph Projection](#step-4-layer-2-memory-living-notes--knowledge-graph-projection) | `frontend/src/services/ai/memory/layer2Vault.ts`, `astSerializer.ts` | `[ ] PENDING` |
| **5** | [Layer 3 Memory: Temporal Timeline ("Versions of Me") & Task History](#step-5-layer-3-memory-temporal-timeline-versions-of-me--task-history) | `frontend/src/services/ai/memory/layer3Temporal.ts`, Supabase `identity_timeline` table | `[ ] PENDING` |
| **6** | [Layer 4 Memory: Behavioral & Preference Ledger (Edit Learning)](#step-4-layer-4-memory-behavioral--preference-ledger-edit-learning) | `frontend/src/services/ai/memory/layer4Learner.ts`, Supabase `learned_preferences` table | `[ ] PENDING` |
| **7** | [Universal Intake Router & Ask-Before-Write Ambiguity Gate](#step-7-universal-intake-router--ask-before-write-ambiguity-gate) | `frontend/src/services/ai/ambiguityGate.ts`, `frontend/src/components/intake/ClarificationModal.tsx` | `[ ] PENDING` |
| **8** | [Friday Conversational UI Surface & Proactive Morning Briefings](#step-8-friday-conversational-ui-surface--proactive-morning-briefings) | `frontend/src/screens/AssistantScreen.tsx`, `frontend/src/components/assistant/FridayChatDrawer.tsx` | `[ ] PENDING` |
| **9** | [User-Initiated Discovery Interview (Onboarding Flow)](#step-9-user-initiated-discovery-interview-onboarding-flow) | `frontend/src/services/ai/onboardingService.ts`, `frontend/src/screens/OnboardingScreen.tsx` | `[ ] PENDING` |
| **10** | [Universal AI Connector & MCP Server (`connector/`)](#step-10-universal-ai-connector--mcp-server-connector) | `connector/src/server.ts`, `connector/src/tools/`, Supabase PostgREST OpenAPI | `[ ] PENDING` |
| **11** | [Phase 3 Headless Cognitive & MCP Verification Suite](#step-11-phase-3-headless-cognitive--mcp-verification-suite) | `scripts/test_phase3_cognitive_and_mcp.mjs` | `[ ] PENDING` |

---

## 2. Detailed Milestone Specifications

### Step 1: Client-Direct BYOK AI Runtime & Provider Adapter
* **Objective:** Allow the in-app assistant to call cloud AI providers directly from the device with zero intermediate server.
* **Mechanism:**
  * Provider adapters for Google Gemini (`@google/genai`), Anthropic Claude (`@anthropic-ai/sdk`), and OpenAI ChatGPT (`openai`).
  * User enters their own API key in Settings $\rightarrow$ stored securely in `expo-secure-store` on mobile, encrypted `localStorage` on web.
  * Device gathers 4-layer cognitive memory from local SQLite, packages prompt, and executes direct HTTPS completion.

---

### Step 2: Universal Invocation Platform Context (`PlatformContext`)
* **Objective:** Ensure every AI prompt and tool execution carries standardized execution metadata:
  ```typescript
  export interface PlatformContext {
    platform: 'mobile_native' | 'web_browser' | 'desktop_mcp' | 'cursor_antigravity' | 'chatgpt_custom_action';
    device_id: string;
    runtime_capabilities: {
      can_schedule_hardware_alarms: boolean;
      has_active_display: boolean;
      supports_local_file_system: boolean;
      supports_optimistic_ui: boolean;
    };
    client_timestamp: string;
    timezone: string;
  }
  ```
* **Application:** Injected into prompt Layer 1 for tone adaptation, and passed as `caller_platform` into every Supabase RPC.

---

### Step 3: Layer 1 Memory: Core Identity & Active Priorities
* **Objective:** Permanent core identity injected into every prompt (~1,500 tokens).
* **Contents:** User profile, career journey, core values, top short-term and long-term goals, active workspace index.
* **Storage:** Synced to Supabase `user_profile` table and cached in local SQLite for offline prompt assembly.

---

### Step 4: Layer 2 Memory: Living Notes & Knowledge Graph Projection
* **Objective:** Semantic retrieval across living notes and bidirectional relationships.
* **Implementation:**
  * Project 42 input blocks to clean Extended Markdown AST via `astSerializer.ts`.
  * Hybrid search: Combines local SQLite full-text search with Supabase `pgvector` dense vector embeddings.
  * Graph traversal: Traverses `entity_relations` (`related_to`, `part_of`, `supersedes`, `contradicts`).

---

### Step 5: Layer 3 Memory: Temporal Timeline ("Versions of Me") & Task History
* **Objective:** Chronological evolution tracking that prevents fact overwriting and maintains task history.
* **Storage:** Supabase `identity_timeline` table.
* **Query:** Bi-temporal queries (`valid_from`, `valid_to`, `recorded_at`) showing personal growth and historical task outcomes.

---

### Step 6: Layer 4 Memory: Behavioral & Preference Ledger (Edit Learning)
* **Objective:** Self-adapting AI companion that learns user preferences from manual edits.
* **Mechanism:**
  * Analyzes manual adjustments made by user to notes and checklists.
  * Dynamically refines guidelines on tone, detail level, and questioning thresholds in `learned_preferences`.

---

### Step 7: Universal Intake Router & Ask-Before-Write Ambiguity Gate
* **Objective:** Prevent silent hallucinations and unauthorized overwrites.
* **Gate Check:**
  * Ingested notes/links/tasks are scored for semantic clarity.
  * If `clarity_score < 0.85` or contradiction detected: Execution pauses, displaying `ClarificationModal.tsx`.
  * User answers $\rightarrow$ commit proceeds atomically via `rpc_create_note` or `rpc_update_note`.

---

### Step 8: Friday Conversational UI Surface & Proactive Morning Briefings
* **Objective:** Fluid conversational companion interface.
* **Features:**
  * Floating minimalist assistant launcher and slide-out chat drawer (`FridayChatDrawer.tsx`).
  * Proactive Morning Briefings: Synthesizes high-priority tasks, calendar events, and neglected goals into a daily action checklist.

---

### Step 9: User-Initiated Discovery Interview (Onboarding Flow)
* **Objective:** Non-blocking personal discovery interview.
* **Experience:**
  * User launches interview at their own convenience (`OnboardingScreen.tsx`).
  * Friday asks guided conversational questions to populate Layer 1 (Identity) and Layer 3 (Timeline).

---

### Step 10: Universal AI Connector & MCP Server (`connector/`)
* **Objective:** Standalone Node.js MCP server giving external AI chatbots (Claude Desktop, Cursor, ChatGPT) complete parity with Friday.
* **Architecture:**
  * Standalone package in `connector/` with `package.json` and TypeScript build.
  * Transports: Standard Input/Output (`stdio`) for desktop clients, Server-Sent Events (`sse`) for remote agents.
  * Execution: Translates MCP tool calls directly into `supabase.rpc()` calls using the user's JWT token.
  * OpenAPI Generator: Exports OpenAPI 3.1 specification for web ChatGPT Custom Actions.

---

### Step 11: Phase 3 Headless Cognitive & MCP Verification Suite
* **Script:** `scripts/test_phase3_cognitive_and_mcp.mjs`
* **Test Gates:**
  1. **BYOK Transport Gate:** Direct provider calling and token streaming simulation.
  2. **Ambiguity Gate Test:** Ambiguous prompts correctly trigger clarification events.
  3. **Cognitive Memory Stack Test:** Retrieval correctly merges Layer 1 through Layer 4.
  4. **MCP Tool Parity Gate:** Verifies MCP tool schemas match Supabase RPC signatures with `PlatformContext`.
