# ScribeX Project-Scoped AI Orchestration Rules (Layer 1: Core Memory)

> **Scope:** Strictly local to the `scribeX` repository. Does not affect other workspaces.

## 1. Progressive 3-Layer Context Protocol (Token Protection)
1. **Layer 1 (Core Memory - Always Loaded):** This file (`AGENTS.md`). Keep responses concise.
2. **Layer 2 (Project Intelligence - On Demand):** Read `.agents/project-map.json` to locate files immediately. **Never** run broad directory scans (`grep`/`find` across the whole repo) when the path is already indexed in `.agents/project-map.json`.
3. **Layer 3 (Task Execution Contract - On Demand):** Activate `.agents/skills/task-worker/SKILL.md` when delegating or executing multi-file implementation and validation tasks.

## 2. Dynamic Subagent Model Routing (`invoke_subagent`)
To preserve user model quotas and avoid re-sending long conversation histories, delegate bounded work to subagents (`invoke_subagent`), which run in a **fresh, zero-history context**:

| Task Category | Target `Model` Arg | Subagent `TypeName` | Context Passed in `Prompt` |
| :--- | :--- | :--- | :--- |
| **Trivial single-line / <20-line known-file edit** | Handle inline (No subagent) | — | Direct `read_file` (line range) + `edit_file` (avoids subagent spawn overhead) |
| **Multi-file lookup / broad read / status check** | `flash_lite` | `research` | Exact question + paths from `.agents/project-map.json` |
| **Bounded UI fix / single-block edit / test run** | `flash` (fallback: `flash_lite` if `flash` is unavailable) | `self` | Exact target file path(s), acceptance criteria, and scoped test command |
| **Multi-file feature / complex state or DB change** | `inherit` or `pro` | `self` | Structured execution contract (files in scope, invariants, validation command) |
| **Architecture / ambiguity resolution** | Handle in main agent | — | Ask clarifying question in plain text before coding |

### Routing Guardrails
- **Do Not Over-Delegate:** If a lookup or edit touches 1 known file (<20 lines) and the main context is already compact, execute inline rather than paying subagent orchestration overhead.
- **Never** pass the entire conversation history or full `docs/` files into a subagent prompt. Pass only: *(Goal, Allowed Files, Constraints, Scoped Verification Command)*.
- **Deterministic Recovery Before Escalation:** If a `flash_lite` or `flash` subagent fails validation due to a deterministic error (e.g., missing import or syntax typo), allow 1 targeted fix pass with the exact compiler output. Escalate to `inherit` or `pro` only when deterministic recovery fails or the root cause is architectural. Never silently downgrade quality-critical tasks.
- **Scoped Quality Gates:** Run only the check matching the change scope (`npx tsc --noEmit` for types/logic; add `node scripts/test_cross_platform_ui_ux.mjs` for UI/layout; add `audit:all` / `test:interactions` for editor blocks/AST). Never run all 4 suites for a minor tweak.
- **Context Compaction:** When the main conversation exceeds ~30 turns, remind the user they can run `/compact` to free up context tokens.

## 3. Non-Negotiable Project Invariants (ScribeX)
- **No Browser Tool for Verification:** Verify strictly via TypeScript (`cd frontend && npx tsc --noEmit`) and project scripts (`npm --prefix frontend run test:uiux`, `audit:all`, `test:interactions`).
- **Full-Bleed Native Canvas:** Do **not** wrap screens (`home.tsx`, `note/[id].tsx`) in artificial outer card containers (`rounded-3xl` with outer borders). Avoid generic boxed card layouts.
- **React Native Flex Safety:**
  - Horizontal `<ScrollView horizontal>` must use `style={{ flexGrow: 0, flexShrink: 0 }}` and put `flexDirection: 'row'` / `gap` in `contentContainerStyle` (prevents tall oval stretching on iOS/Android).
  - Auto-height cards must use explicit `minHeight` and `flexShrink: 0` on text wrappers (prevents title clipping on native).
- **Git Safety:** Do **not** commit or push to GitHub unless explicitly instructed by the user.

