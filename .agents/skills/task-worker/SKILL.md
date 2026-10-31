---
name: task-worker
description: >-
  Token-efficient task decomposition, model routing, and quality-gate execution
  contract for ScribeX. Activate when planning multi-file changes, delegating
  bounded implementation tasks to subagents, or running post-edit verification.
---

# ScribeX Task Worker & Orchestration Runbook (Layer 3)

## 1. Pre-Flight Context Assembly (Zero-Waste Retrieval)
1. Read [`.agents/project-map.json`](../../project-map.json) to resolve exact file paths.
2. Read **only** the specific line ranges (`StartLine` / `EndLine`) of the target files being modified.
3. Do **not** load full specification markdown files (`docs/*.md`) unless a section is explicitly required for the task.
4. Modify the `project-map.json` file to add the new file paths and line ranges whenever it seems necessary.

## 2. Subagent Execution Contract Template
When invoking `invoke_subagent` (`Model: "flash"` for single-component/UI fixes, `Model: "flash_lite"` for read-only lookups, `Model: "inherit"` for cross-module architecture), pass this compact prompt structure:

```markdown
### Task Contract
- **Objective:** <1-2 sentence goal>
- **Files in Scope (Read/Edit ONLY these):**
  - <exact/path/from/project-map.json>
- **Constraints:**
  - Do not use browser tools.
  - Preserve full-bleed layouts (no outer rounded-3xl card wrappers).
  - Horizontal ScrollViews must use `style={{ flexGrow: 0, flexShrink: 0 }}` + `contentContainerStyle`.
  - Auto-height cards must use `minHeight` and `flexShrink: 0` on text containers.
- **Verification Gate:** Run `<validationCommand>` and return a 5-line summary of changes + exit code.
```

## 3. Scoped Quality Gates & Deterministic Recovery
Select **only** the smallest verification command matching the modified scope (do not run every audit for minor edits):
- **Logic / Type / Hook edit:** `cd frontend && npx tsc --noEmit`
- **UI / Styling / Layout edit:** `cd frontend && npx tsc --noEmit && node ../scripts/test_cross_platform_ui_ux.mjs`
- **AST Serializer / Block Schema edit:** `cd frontend && npx tsc --noEmit && npm run audit:all`
- **Action History / Block Interaction edit:** `cd frontend && npx tsc --noEmit && npm run test:interactions`
- **Recovery vs. Escalation Rule:**
  1. **Deterministic Recovery (Same Tier):** If `tsc` or an audit reports a deterministic fixable error (missing import, prop type mismatch, missing `hitSlop`), apply 1 direct fix in the same tier.
  2. **Model Escalation (`inherit` / `pro`):** Escalate only if deterministic recovery fails or if the failure reveals a cross-module design conflict.

