# Project-First AI Orchestration System

## Product Requirements & Implementation Blueprint

**Document type:** Engineering implementation specification\
**Purpose:** Build a project-aware, plan-first, multi-model coding
orchestration system that maximizes execution speed while preserving the
architectural and code quality established by stronger reasoning models.

------------------------------------------------------------------------

# 1. Product Vision

Build an orchestration layer that separates **software engineering
intelligence** from **routine code production**.

A high-capability model should do the expensive thinking up front:
understand the project, make architectural decisions, identify risks,
design interfaces, decompose work, and create precise execution
contracts.

Faster and less expensive models should then implement those contracts.
They should not independently redesign the architecture or make
undocumented decisions. Automated checks and selective higher-capability
reviews should protect quality.

The system must optimize four objectives:

1.  **Quality:** Implementation should conform to the plan, existing
    architecture, project conventions, and acceptance criteria.
2.  **Speed:** Independent tasks should run concurrently where safe.
3.  **Quota and cost efficiency:** Use the least expensive suitable
    model for each task; reserve high-capability models for work that
    genuinely needs them.
4.  **Consistency:** Preserve project knowledge and decisions across
    features and sessions so the system does not repeatedly rediscover
    the same context.

## Core principle

> Plan with the strongest suitable model. Execute with the fastest
> suitable model. Validate continuously. Escalate only when evidence
> shows that escalation is necessary.

Do not optimize for minimum model usage at the expense of correctness.
Do not assume that a model labelled "Flash", "fast", or "small" is
always cheaper in every product or quota system. Measure actual usage
where the provider exposes it.

------------------------------------------------------------------------

# 2. Scope and Non-Goals

## In scope

-   Project onboarding and codebase analysis.
-   Persistent project intelligence.
-   High-quality feature planning.
-   Dependency-aware task decomposition.
-   Model capability registry and task-based routing.
-   Execution contracts for coding workers.
-   Sequential and safe parallel execution.
-   Automated validation and quality gates.
-   Escalation and recovery workflows.
-   Usage, quota, latency, and cost tracking.
-   Git-based isolation and reviewable changes.
-   Human approval at configurable risk boundaries.

## Not in scope for the first version

-   Training or fine-tuning models.
-   Replacing the user's IDE or Git workflow.
-   Unrestricted autonomous production deployment.
-   Automatically changing project architecture without approval.
-   Assuming all models available in an IDE are accessible through a
    public API.
-   Circumventing provider rate limits, quotas, or product restrictions.
-   Requiring a vector database before simpler retrieval methods prove
    insufficient.

------------------------------------------------------------------------

# 3. High-Level Architecture

Implement the system as a modular orchestrator.

``` text
                         USER
                          |
                          v
                 PROJECT WORKSPACE
                          |
                          v
                  ORCHESTRATOR API
                          |
             +------------+-------------+
             |                          |
             v                          v
       PROJECT REGISTRY           USAGE / POLICY
             |                    / QUOTA MANAGER
             v                          |
      PROJECT INTELLIGENCE              |
             |                          |
             +------------+-------------+
                          |
                          v
                  TASK CLASSIFIER
                          |
                          v
                 PLANNING ENGINE
              (strong model when needed)
                          |
                          v
                EXECUTION BLUEPRINT
                          |
                          v
                TASK DECOMPOSITION
                          |
                          v
               DEPENDENCY / DAG ENGINE
                          |
                          v
                  MODEL ROUTER
                          |
             +------------+-------------+
             |            |              |
             v            v              v
         Worker A      Worker B       Worker C
         Fast model    Fast model     Medium model
             |            |              |
             +------------+--------------+
                          |
                          v
                 INTEGRATION MANAGER
                          |
                          v
                  QUALITY GATES
                          |
               +----------+----------+
               |          |          |
               v          v          v
             Static     Tests     Contract checks
             checks               and review
               |          |          |
               +----------+----------+
                          |
                 PASS / FAIL / ESCALATE
                          |
               +----------+----------+
               |                     |
               v                     v
          Merge-ready          Repair / escalation
          changes                    |
               |                     |
               +----------+----------+
                          |
                          v
                 HUMAN REVIEW / GIT
```

Keep the modules independent so that model providers, queues, storage,
and validation tools can be changed without rewriting the orchestration
logic.

------------------------------------------------------------------------

# 4. Project Structure and Persistent Intelligence

Every managed repository should have an orchestration directory. Do not
scatter planning metadata throughout the application source.

Suggested structure:

``` text
repository/
├── .orchestrator/
│   ├── README.md
│   ├── project-profile.yaml
│   ├── project-context.md
│   ├── architecture.md
│   ├── module-map.md
│   ├── coding-standards.md
│   ├── design-system.md
│   ├── database-schema.md
│   ├── api-contracts.md
│   ├── security-requirements.md
│   ├── testing-strategy.md
│   ├── quality-policy.yaml
│   ├── model-policy.yaml
│   ├── decisions/
│   │   ├── ADR-0001-example.md
│   │   └── ...
│   ├── plans/
│   │   └── FEATURE-0001-example/
│   │       ├── plan.md
│   │       ├── task-graph.json
│   │       ├── contracts/
│   │       ├── risks.md
│   │       └── validation-plan.md
│   ├── runs/
│   │   └── RUN-0001/
│   │       ├── run.json
│   │       ├── task-status.json
│   │       ├── execution-log.md
│   │       └── validation-results/
│   └── reports/
│       ├── usage/
│       └── quality/
└── application source...
```

Generated run logs and temporary data may be excluded from Git according
to project policy. Keep durable architecture decisions, approved plans,
and reusable project intelligence version-controlled.

## 4.1 Project profile

Maintain a machine-readable project profile containing:

-   Project name and description.
-   Languages, frameworks, package manager, and runtime versions.
-   Repository root and important directories.
-   Application entry points.
-   Build, lint, type-check, test, and development commands.
-   Database and infrastructure technologies.
-   Module boundaries.
-   Existing architectural patterns.
-   Relevant environment variable names (never secret values).
-   Design-system location.
-   Git branch and working-tree status.
-   Risk-sensitive areas.
-   Known constraints and non-negotiable conventions.

Do not invent missing information. Mark unknown values as unknown and
ask for clarification when they affect a consequential decision.

## 4.2 Project intelligence lifecycle

Project intelligence must be maintained, not treated as a one-time scan.

1.  Analyze the repository during onboarding.
2.  Generate an initial project profile and documentation.
3.  Mark each fact with its source or confidence where practical.
4.  Re-check relevant files before planning a feature.
5.  Detect changes to important architecture files.
6.  Update intelligence after approved architectural changes.
7.  Preserve decisions and rationale in Architecture Decision Records
    (ADRs).
8.  Avoid rewriting the entire project context after every small change.

The repository is the source of truth. Project intelligence is an index
and explanation of it, not a replacement for it.

------------------------------------------------------------------------

# 5. Project Onboarding / Analyzer

The Project Analyzer should inspect the repository before the first
feature plan.

## Responsibilities

-   Inspect directory structure and package manifests.
-   Identify frameworks, runtime versions, and major dependencies.
-   Read existing documentation and agent instruction files.
-   Identify application entry points and module boundaries.
-   Inspect database models, migrations, and API conventions.
-   Identify authentication, authorization, validation, and
    error-handling patterns.
-   Identify UI component conventions and design tokens.
-   Discover test frameworks and existing test coverage.
-   Discover build, lint, type-check, and test commands.
-   Identify risky or highly coupled modules.
-   Generate the persistent project intelligence files.

## Safety requirements

-   Never print, copy, or persist secret values from `.env` files.
-   It is acceptable to record environment variable *names* and their
    purpose.
-   Respect `.gitignore`, repository permissions, and user-selected
    workspace boundaries.
-   Do not execute arbitrary scripts during analysis without an explicit
    execution policy.
-   Do not modify application source during onboarding.
-   Show the user a summary of findings and unresolved questions.
-   Ask for approval before committing generated project intelligence.

## Output

Produce an onboarding report containing:

-   Detected stack.
-   Architecture summary.
-   Important modules and dependencies.
-   Existing conventions.
-   Available validation commands.
-   Risk areas.
-   Missing information.
-   Files created or updated.

------------------------------------------------------------------------

# 6. Planning Engine: High-Intelligence Phase

The Planning Engine converts a user request into a complete,
implementation-ready blueprint.

Use a high-capability model for work that requires architectural
reasoning. Do not automatically use the highest tier for every planning
request: first determine whether the request is routine, medium-risk, or
architecture-changing.

## 6.1 Planning workflow

For each feature request:

1.  Restate the requested outcome and define scope.
2.  Retrieve relevant project intelligence.
3.  Inspect the current source files that the feature will touch.
4.  Identify existing reusable services, components, hooks, utilities,
    and patterns.
5.  Trace relevant data flows and dependencies.
6.  Identify database, API, UI, infrastructure, and security
    implications.
7.  Identify backward-compatibility requirements.
8.  Define intended behavior and edge cases.
9.  Decide which architectural choices are necessary.
10. Record important decisions and rationale.
11. Decompose implementation into small, verifiable tasks.
12. Define dependencies and safe parallelization boundaries.
13. Define acceptance criteria for every task.
14. Define automated validation and manual review requirements.
15. Identify uncertainty and ask the user about consequential
    ambiguities.
16. Save the approved blueprint before execution begins.

## 6.2 Required planning output

Every feature plan must include:

### A. Feature summary

-   User goal.
-   Business or product outcome.
-   In-scope behavior.
-   Out-of-scope behavior.
-   Assumptions.

### B. Existing-system analysis

-   Relevant modules and files.
-   Existing patterns to reuse.
-   Dependencies and integration points.
-   Constraints and compatibility concerns.

### C. Architecture and design

-   Proposed flow.
-   Data model changes.
-   API or interface contracts.
-   UI/component changes.
-   Authorization and security requirements.
-   Error handling and observability.
-   Performance considerations.

### D. File-level change plan

For each file: - Existing file or new file. - Intended change. - Reason
for change. - Relevant interfaces. - Files that must not be changed
without approval.

File paths must be verified against the current repository. Treat paths
as guidance that must be revalidated at execution time, not as
permission to overwrite files blindly.

### E. Task graph

-   Unique task IDs.
-   Task objectives.
-   Dependencies.
-   Parallelization groups.
-   Required skills/capabilities.
-   Estimated risk and complexity.
-   Required model tier.
-   Acceptance criteria.

### F. Risks and edge cases

-   Failure modes.
-   Data integrity risks.
-   Security concerns.
-   Race conditions.
-   Migration and rollback considerations.
-   Integration risks.

### G. Validation plan

-   Static checks.
-   Unit tests.
-   Integration tests.
-   End-to-end tests.
-   Manual review items.
-   Definition of done.

## 6.3 Planning quality rules

-   Prefer the simplest design consistent with the existing
    architecture.
-   Do not introduce dependencies without a reason.
-   Do not create abstractions for hypothetical future requirements.
-   Avoid unnecessary rewrites and unrelated cleanup.
-   Preserve established project conventions unless the plan explicitly
    approves a change.
-   Identify conflicts between existing documentation and actual code.
-   Do not claim a file, API, or feature exists without inspecting it.
-   Mark uncertain decisions and distinguish facts from assumptions.
-   Plans must be actionable by a worker that has not participated in
    the planning conversation.

------------------------------------------------------------------------

# 7. Task Decomposition and Dependency Graph

Represent work as a Directed Acyclic Graph (DAG), not just a flat
checklist.

A task may start only when all required dependencies have passed their
completion criteria.

## Task sizing

A good task should:

-   Have one clear outcome.
-   Have a limited and explicit file scope.
-   Be small enough for a worker to understand without reconstructing
    the entire plan.
-   Have testable acceptance criteria.
-   Avoid overlapping edits with concurrently running tasks.
-   Produce a clear result and handoff summary.

Split tasks that combine unrelated modules or require many independent
architectural decisions.

## Parallel execution rules

Tasks may run concurrently only when:

-   Their dependencies are complete.
-   Their file scopes do not conflict, or isolation makes the conflict
    safe.
-   They do not depend on an unfinished interface decision.
-   Their outputs can be integrated deterministically.

Use sequential execution for shared schema changes, foundational
interfaces, migrations, and tightly coupled changes.

The orchestrator must detect overlapping file scopes before launching
parallel workers. If overlap is unavoidable, serialize the tasks or
create an explicit integration task.

## Example task graph

``` text
TASK-001: Define and implement data model
       |
       v
TASK-002: Implement domain/service layer
       |
       +----------------------+
       |                      |
       v                      v
TASK-003: API layer       TASK-004: UI layer
       |                      |
       +----------+-----------+
                  |
                  v
          TASK-005: Integration
                  |
                  v
          TASK-006: Automated tests
                  |
                  v
          TASK-007: Final review
```

The graph must be generated from actual dependencies, not copied
mechanically from this example.

------------------------------------------------------------------------

# 8. Execution Contracts

Every worker task must receive a self-contained execution contract. The
contract is the boundary between the planner's intent and the worker's
implementation.

Suggested JSON shape:

``` json
{
  "task_id": "TASK-003",
  "plan_id": "FEATURE-0001",
  "title": "Implement notification API",
  "objective": "Expose the approved notification operations",
  "context_refs": [
    ".orchestrator/architecture.md",
    ".orchestrator/api-contracts.md"
  ],
  "relevant_files": [
    "src/modules/notifications/notification.controller.ts",
    "src/modules/notifications/notification.service.ts"
  ],
  "allowed_file_scope": [
    "src/modules/notifications/**"
  ],
  "dependencies": [
    "TASK-001",
    "TASK-002"
  ],
  "preconditions": [
    "The notification data model has passed validation",
    "The service interface is available"
  ],
  "requirements": [
    "Follow existing API response conventions",
    "Use existing authentication and authorization middleware",
    "Validate request parameters",
    "Follow the approved pagination contract"
  ],
  "constraints": [
    "Do not modify authentication architecture",
    "Do not add dependencies without approval",
    "Do not duplicate business logic",
    "Do not modify files outside the allowed scope"
  ],
  "acceptance_criteria": [
    "Authorized users can retrieve their notifications",
    "Pagination behaves according to the API contract",
    "Unauthorized requests are rejected",
    "Existing API conventions are preserved"
  ],
  "tests_required": [
    "Authenticated request",
    "Unauthorized request",
    "Pagination boundaries",
    "Error response behavior"
  ],
  "escalation_conditions": [
    "The required service interface does not exist",
    "The contract conflicts with existing code",
    "A change outside the allowed scope is necessary",
    "The task requires an unapproved architecture decision"
  ],
  "expected_handoff": [
    "Files changed",
    "Implementation summary",
    "Tests added and run",
    "Validation results",
    "Known limitations"
  ]
}
```

The actual contract must be generated from the approved plan and current
repository state.

## Worker rules

Workers must:

1.  Read the contract and referenced context.
2.  Inspect the relevant source before editing.
3.  Follow existing conventions and approved decisions.
4.  Implement only the assigned task.
5.  Avoid unrelated refactoring.
6.  Avoid changing public interfaces unless explicitly authorized.
7.  Run the required checks that are available.
8.  Report any missing information or contradiction.
9.  Return a structured handoff.
10. Never claim tests passed unless they were actually run.

If a worker discovers a necessary change outside its scope, it must stop
and request a plan update or escalation. It must not silently expand its
authority.

------------------------------------------------------------------------

# 9. Model Registry and Intelligent Routing

Do not hard-code model names throughout the application. Build a
provider-independent model registry.

Each model entry should record:

-   Provider.
-   Exact model identifier.
-   Availability and access method.
-   Supported capabilities.
-   Context window, if known.
-   Tool/function-calling support.
-   Structured-output support.
-   Relative quality for relevant task categories.
-   Observed latency.
-   Observed usage/cost where available.
-   Rate limits and quota behavior, if documented.
-   Whether it is accessible through the user's current Antigravity
    setup or requires a separate API.

Model availability changes. Verify the exact model IDs and access method
against current provider documentation or the configured environment.
Never invent model IDs.

## 9.1 Capability-based routing

Route by task requirements, not model brand alone.

  -----------------------------------------------------------------------
  Work category           Default tier            Escalate when
  ----------------------- ----------------------- -----------------------
  Repository              Fast                    Architecture is unclear
  summarization                                   or contradictory

  Routine implementation  Fast                    Contract cannot be
                                                  followed safely

  Documentation updates   Fast                    Requires major
                                                  technical reasoning

  Simple UI               Fast/Medium             Complex interaction or
  implementation                                  design-system conflict

  Database schema design  High                    Foundational or
                                                  high-risk data
                                                  decisions

  Architecture design     High                    Significant
                                                  cross-system impact

  Complex debugging       Medium/High             Root cause is unclear
                                                  after initial diagnosis

  Security-sensitive      High + validation       Always require
  changes                                         appropriate review

  Code review             Fast first pass; High   Critical, ambiguous, or
                          selectively             high-risk findings

  Test generation         Fast/Medium             Complex state,
                                                  concurrency, or
                                                  integration behavior

  Refactoring             Medium                  Broad architectural
                                                  restructuring
  -----------------------------------------------------------------------

The router should consider:

-   Task category.
-   Complexity.
-   Risk and impact.
-   Required context length.
-   Tool requirements.
-   Model capability scores.
-   Current availability.
-   Estimated quota/cost.
-   Latency.
-   User's configured model preferences.

## 9.2 Routing policy

Use a configurable policy, for example:

``` yaml
routing:
  default_tier: fast

  tiers:
    fast:
      purpose: "Well-specified, bounded implementation tasks"
    medium:
      purpose: "Integration, non-trivial debugging, and moderate reasoning"
    high:
      purpose: "Architecture, complex planning, critical review, and high-risk decisions"

  escalation:
    allow_worker_to_request_escalation: true
    require_reason: true
    max_escalations_per_task: 2
    preserve_original_contract: true

  constraints:
    do_not_use_unavailable_models: true
    do_not_guess_model_identifiers: true
    respect_provider_rate_limits: true
    track_usage_when_available: true
```

This is an example policy. The implementation must support
project-specific overrides and user configuration.

## 9.3 Model selection must be measurable

Record task outcomes by model and task category:

-   First-pass acceptance rate.
-   Number of retries.
-   Validation failure rate.
-   Escalation rate.
-   Average completion time.
-   Usage/cost when available.
-   Human correction rate.

Use these measurements to improve routing over time. Do not
automatically promote a model based on one successful task or demote it
based on one failure.

------------------------------------------------------------------------

# 10. Provider and Antigravity Integration

Build a provider adapter interface so the orchestrator is not tightly
coupled to one product.

Example conceptual interface:

``` typescript
interface ModelProvider {
  listModels(): Promise<ModelDescriptor[]>;
  execute(request: ModelExecutionRequest): Promise<ModelExecutionResult>;
  getUsage?(): Promise<ProviderUsage | null>;
  healthCheck(): Promise<ProviderHealth>;
}
```

The implementation should distinguish between:

1.  Models selectable inside the Antigravity IDE.
2.  Models accessible through a documented Antigravity agent/API
    interface.
3.  Models accessible through separate provider APIs.
4.  Local models, if configured.

Do not assume these access paths share authentication, billing, quotas,
or model availability.

## Antigravity integration requirements

-   First inspect the currently installed Antigravity capabilities,
    supported CLI/API integrations, MCP support, and available models.
-   Use only documented and permitted interfaces.
-   Do not automate private or undocumented endpoints.
-   Do not assume the user's Antigravity subscription quota can be
    consumed programmatically through a separate API.
-   Do not assume models available in the IDE are all available through
    an API.
-   Show the user which models are actually connected and usable.
-   Provide a mock provider for local development and tests.
-   If direct model access is unavailable, support a clearly documented
    manual handoff workflow rather than pretending the integration
    exists.

The orchestration engine must remain useful even if Antigravity
integration changes.

------------------------------------------------------------------------

# 11. Context Management

The system should give each worker the smallest sufficient context, not
the entire repository.

## Context assembly order

For each task, assemble:

1.  Execution contract.
2.  Relevant project-wide rules.
3.  Relevant architecture decisions.
4.  Relevant module documentation.
5.  Directly related source files.
6.  Related types, interfaces, and tests.
7.  Dependency task handoff summaries.
8.  Relevant recent changes.

## Context rules

-   Prefer current source code over stale summaries.
-   Retrieve only files relevant to the assigned task.
-   Include exact file paths and important symbols.
-   Avoid sending unrelated project history.
-   Track which context documents and source versions were used.
-   Re-check source files immediately before execution if the plan is
    old.
-   If context is too large, summarize in stages without dropping
    constraints or contracts.
-   Never let a summary replace the exact API/schema contract needed by
    a task.

Use repository search, language-server information, AST parsing, and
targeted file retrieval before introducing embeddings. Add
semantic/vector retrieval only if measured retrieval quality justifies
it.

------------------------------------------------------------------------

# 12. Quality Gates and Validation

Quality must be enforced through evidence, not confidence in the model.

Each task and the overall feature must pass configurable quality gates.

## Gate 1: Scope and change validation

-   Changed files are within the task's allowed scope.
-   No unexpected generated or secret files are included.
-   No unrelated refactoring.
-   No unapproved dependency changes.
-   No accidental changes to lockfiles or configuration.

## Gate 2: Static validation

Run the project's actual commands where available:

-   Formatting.
-   Linting.
-   Type checking.
-   Build.
-   Static analysis.
-   Dependency/security checks according to project policy.

Do not assume every project uses the same commands. Discover them during
onboarding.

## Gate 3: Functional validation

-   Unit tests.
-   Integration tests.
-   End-to-end tests where appropriate.
-   Regression tests for affected behavior.
-   Migration checks where applicable.

## Gate 4: Contract validation

Check the implementation against:

-   Execution contract.
-   API contracts.
-   Data model expectations.
-   Existing conventions.
-   Acceptance criteria.
-   Error and edge-case requirements.

Use deterministic checks wherever possible. A lightweight model may
assist with semantic comparison, but should not replace executable
tests.

## Gate 5: Architectural review

Use a stronger model selectively for: - Foundational architectural
changes. - Security-sensitive changes. - Database migrations with
significant impact. - Cross-module interface changes. - Repeated
failures. - Unexplained deviations from the plan. - High-risk code.

The reviewer must inspect the actual diff and relevant source, not just
the worker's summary.

## Gate outcomes

-   **PASS:** All required checks pass.
-   **PASS WITH WARNINGS:** No blocking issue; warnings are documented
    and accepted according to policy.
-   **FAIL:** A required check failed.
-   **NEEDS HUMAN REVIEW:** A consequential decision or ambiguity
    requires user approval.
-   **BLOCKED:** A dependency, provider, or environment is unavailable.

Never silently convert a failed check into a pass.

------------------------------------------------------------------------

# 13. Failure Recovery and Escalation

Build bounded recovery loops. Do not allow agents to retry indefinitely.

## Example recovery flow

``` text
Worker executes task
       |
       v
Automated validation
       |
       +---- PASS ------> Mark task complete
       |
       +---- FAIL ------> Classify failure
                              |
                    +---------+----------+
                    |                    |
                Simple issue         Complex issue
                    |                    |
                    v                    v
              Fast worker fix      Medium/High model
                    |                    |
                    +---------+----------+
                              |
                              v
                       Re-run validation
                              |
                    +---------+----------+
                    |                    |
                   PASS                 FAIL
                    |                    |
                    v                    v
               Complete task       Stop and report
```

## Failure categories

-   Syntax/type/lint failure.
-   Test failure.
-   Contract violation.
-   Scope violation.
-   Missing dependency.
-   Stale plan.
-   Conflicting project convention.
-   Unclear requirement.
-   Provider or quota failure.
-   Environment/tool failure.
-   Potential security issue.

Escalate based on the failure category. A simple formatting failure
should not trigger a high-capability model. A fundamental schema
conflict should not be repeatedly sent to a fast worker.

## Retry policy

-   Configure a small retry limit per task.
-   Preserve logs and diffs from every attempt.
-   Avoid repeating the same prompt without new evidence.
-   Escalate only with a concise failure report, relevant logs, and the
    original contract.
-   Stop and ask the user when a product or architecture decision is
    required.

------------------------------------------------------------------------

# 14. Usage, Quota, Cost, and Speed Management

This is a core feature, not an afterthought.

The system should reduce unnecessary high-tier model calls while making
actual usage visible.

## 14.1 Usage tracking

For each model call, record where available:

-   Provider and model ID.
-   Project, plan, run, and task IDs.
-   Input/output tokens.
-   Cached tokens.
-   Tool calls.
-   Estimated or reported cost.
-   Latency.
-   Success/failure.
-   Retry count.
-   Escalation reason.
-   Provider quota or rate-limit response.

If the provider does not expose token usage or cost, record it as
**unknown**. Do not fabricate estimates or present estimates as actual
provider usage.

## 14.2 Quota-aware scheduling

The scheduler should:

-   Check documented provider availability and quota information where
    supported.
-   Respect rate limits and retry-after responses.
-   Avoid launching unnecessary parallel calls to a constrained
    provider.
-   Prefer another configured provider when permitted and suitable.
-   Queue non-urgent work when a provider is temporarily unavailable.
-   Warn the user before a high-usage operation when usage information
    supports that warning.
-   Provide per-project and per-run usage summaries.
-   Allow configurable daily, weekly, and per-run budgets where the
    provider exposes sufficient usage data.

Do not promise that routing to a lightweight model will preserve or
extend a particular Antigravity quota unless the product's quota
behavior has been verified.

## 14.3 Speed optimization

-   Run independent tasks in parallel.
-   Use a concurrency limit per provider and project.
-   Reuse validated project intelligence.
-   Reuse completed task outputs rather than repeating work.
-   Cache safe, stable analysis results with invalidation rules.
-   Avoid repeated full-repository scans.
-   Keep worker context focused.
-   Run cheap deterministic checks before expensive model reviews.

Parallelism should be bounded by dependency correctness, provider
limits, machine resources, and file conflicts.

## 14.4 Usage dashboard

Show:

-   Calls by provider/model.
-   Usage by project and feature.
-   Usage by planning, execution, review, and repair.
-   Average latency.
-   Task success rate.
-   Retry and escalation rates.
-   Quota status where actually available.
-   Estimated versus provider-reported cost, clearly distinguished.
-   Recent provider failures.

------------------------------------------------------------------------

# 15. Git, Isolation, and Change Management

Use Git as the safety boundary.

Preferred approach:

-   Start from a clean or explicitly acknowledged working tree.
-   Create a feature branch or isolated Git worktree for a run.
-   Give parallel workers separate worktrees or otherwise isolated
    workspaces.
-   Keep task changes scoped and traceable.
-   Integrate completed tasks in dependency order.
-   Resolve conflicts through an explicit integration step.
-   Run final validation on the integrated result.
-   Present the final diff and summary to the user.
-   Require approval before merging or committing when configured.

Never discard user changes. If the working tree is dirty, identify the
changes and ask how to proceed unless a safe, explicitly configured
isolation workflow is available.

The first release should not automatically push or deploy changes.

------------------------------------------------------------------------

# 16. User Experience

The user should be able to work at the project level.

Example interaction:

``` text
User:
Add a notification system to this project.

Orchestrator:
1. Analyzing project context...
2. Inspecting relevant modules...
3. Creating implementation blueprint...
4. Identifying 7 tasks and 3 safe parallel groups...
5. Estimating model requirements and available capacity...

Plan ready:
- 7 tasks
- 2 high-reasoning decisions
- 4 fast implementation tasks
- 1 integration/review task

[Review plan] [Edit plan] [Approve and execute]
```

During execution, show:

-   Current phase.
-   Task status.
-   Assigned provider/model.
-   Dependencies.
-   Worker progress.
-   Validation status.
-   Usage when available.
-   Blockers and approval requests.

At completion, show:

-   What changed.
-   Files changed.
-   Tests/checks run and their actual results.
-   Deviations from the plan.
-   Remaining warnings.
-   Model usage and latency where available.
-   Git branch/worktree and review instructions.

The user must be able to pause, cancel, retry, approve, or reject a run.

------------------------------------------------------------------------

# 17. Suggested Technology Choices

Choose technologies that fit the existing environment. Do not add every
item below automatically.

  -----------------------------------------------------------------------
  Component               Suggested option        Notes
  ----------------------- ----------------------- -----------------------
  Orchestrator            TypeScript + Node.js    Shared language with
                                                  many web projects

  API                     NestJS or Express       Choose one based on
                                                  project complexity

  Queue                   BullMQ + Redis          Add when
                                                  background/concurrent
                                                  jobs are needed

  Metadata                PostgreSQL              Projects, plans, tasks,
                                                  runs, metrics

  Durable artifacts       Markdown + JSON         Human-readable plans
                                                  and contracts

  Repository access       Git CLI / libraries     Safe diffs and
                                                  worktrees

  Code understanding      AST/parser + language   Start with targeted
                          tools                   retrieval

  Agent tools             MCP where useful        Use explicit,
                                                  permissioned tools

  Validation              Existing project        Discover rather than
                          tooling                 assume

  UI                      Optional web dashboard  Not required for first
                                                  working MVP
  -----------------------------------------------------------------------

Do not add Redis, PostgreSQL, a vector database, or a dashboard solely
because they appear in this document. Prefer the simplest architecture
that meets the first-release requirements.

------------------------------------------------------------------------

# 18. Data Model (Conceptual)

At minimum, represent:

## Project

-   id
-   name
-   repository location
-   profile
-   created/updated timestamps

## ModelProvider

-   id
-   provider name
-   connection status
-   supported access methods
-   configuration reference (no secrets in plain text)

## Model

-   id
-   provider id
-   exact model identifier
-   capability metadata
-   availability
-   observed performance metrics

## Plan

-   id
-   project id
-   feature description
-   plan version
-   status
-   approved by / approval time
-   created by model
-   source context revision

## Task

-   id
-   plan id
-   title and objective
-   dependencies
-   execution contract
-   assigned model/provider
-   status
-   allowed file scope
-   acceptance criteria

## Run

-   id
-   project id
-   plan id
-   branch/worktree
-   status
-   start/end timestamps
-   final report

## ModelCall

-   id
-   run/task id
-   provider/model
-   usage metrics where available
-   latency
-   outcome
-   escalation/retry metadata

## ValidationResult

-   id
-   task/run id
-   check name
-   status
-   command or method
-   output/log reference
-   timestamp

Persist enough information to reproduce why a task was routed, what
context it received, and why it was accepted or rejected.

------------------------------------------------------------------------

# 19. Security and Permissions

-   Treat repository content, issue text, and external documents as
    untrusted input.
-   Protect against prompt injection in files and tool outputs.
-   Keep secrets out of model context unless strictly necessary and
    explicitly authorized.
-   Use least-privilege filesystem and shell permissions.
-   Restrict workers to the selected repository/worktree.
-   Require approval for destructive operations, dependency
    installation, migrations, external network access, commits, pushes,
    and deployments according to policy.
-   Log tool actions and file changes.
-   Never expose API keys in logs or generated project intelligence.
-   Validate paths to prevent directory traversal.
-   Make cancellation stop pending tasks and terminate workers safely.
-   Do not run untrusted project scripts without an explicit execution
    policy.

------------------------------------------------------------------------

# 20. Implementation Roadmap

Build in stages. Do not attempt a fully autonomous multi-agent platform
in the first iteration.

## Stage 1 --- Project Analyzer and Persistent Context

Deliver: - Repository selection. - Safe repository inspection. - Stack
and convention detection. - Project intelligence generation. -
Onboarding report. - User approval of generated context.

**Exit criteria:** The system can explain the existing project
accurately and point to the source files supporting its understanding.

## Stage 2 --- Planning Engine

Deliver: - Feature request intake. - Context retrieval. -
High-capability planning provider integration. - Detailed feature
plan. - Risk and ambiguity detection. - User review and approval. -
Versioned plan storage.

**Exit criteria:** A plan can be handed to a separate developer or
coding agent and understood without the original planning conversation.

## Stage 3 --- Task Contracts and Model Router

Deliver: - DAG generation. - Task contracts. - Model registry. -
Capability-based routing. - Provider adapters. - Manual execution mode
if direct model access is unavailable.

**Exit criteria:** Every task has a bounded scope, explicit
dependencies, acceptance criteria, and a valid execution route.

## Stage 4 --- Worker Execution

Deliver: - Worker invocation. - Context assembly. - Git branch/worktree
isolation. - Sequential execution. - Bounded parallel execution. -
Structured worker handoffs. - Pause/cancel support.

**Exit criteria:** A multi-task feature can be implemented without
workers silently changing unrelated architecture or files.

## Stage 5 --- Quality and Recovery

Deliver: - Static checks. - Test execution. - Contract validation. -
Diff inspection. - Failure classification. - Bounded retries. -
Selective model escalation. - Human review workflow.

**Exit criteria:** Failed checks block completion, and escalations
include actionable evidence.

## Stage 6 --- Usage and Performance Optimization

Deliver: - Usage instrumentation. - Quota/rate-limit handling where
supported. - Concurrency controls. - Routing metrics. - Usage
dashboard/report. - Context and analysis caching with invalidation.

**Exit criteria:** The system can demonstrate whether its routing
strategy reduces measured usage and completion time without lowering
acceptance quality.

## Stage 7 --- Advanced Features

Only after the earlier stages are reliable: - Specialized
frontend/backend/testing/review agents. - More advanced parallel
scheduling. - Historical model-performance-based routing. - Semantic
retrieval if justified by evaluation. - Automated ADR suggestions. -
Cross-feature dependency awareness.

------------------------------------------------------------------------

# 21. Acceptance Criteria for the Overall System

The project is considered ready for regular use when:

1.  A repository can be onboarded without modifying application source.
2.  Project intelligence is persistent and can be refreshed.
3.  A feature request produces a detailed, versioned plan.
4.  The user can inspect and approve the plan before execution.
5.  Tasks are represented as a dependency graph.
6.  Each task has a self-contained execution contract.
7.  Model selection is capability-based and configurable.
8.  Provider/model access is verified rather than assumed.
9.  Workers are restricted to their task scope.
10. Independent tasks can run concurrently without unsafe file
    conflicts.
11. Every task produces a structured handoff.
12. Automated checks run against the actual project tooling.
13. A failed required check prevents task completion.
14. Escalation is bounded and evidence-based.
15. Usage is tracked accurately where provider data is available.
16. Provider limits and failures are handled gracefully.
17. The user can pause, cancel, review, and approve work.
18. Final changes are reviewable through Git diffs.
19. No automatic production deployment occurs in the initial release.
20. The system can show measurable speed, quality, and usage outcomes.

------------------------------------------------------------------------

# 22. Evaluation and Success Metrics

Run representative tasks through both a baseline workflow and the
orchestrated workflow.

Measure:

  -----------------------------------------------------------------------
  Metric                              What it tells us
  ----------------------------------- -----------------------------------
  Time to accepted implementation     Actual speed

  First-pass acceptance rate          Worker reliability

  Test pass rate                      Functional quality

  Contract compliance                 Fidelity to the plan

  Unplanned file changes              Scope discipline

  Human correction effort             Practical quality

  Escalation rate                     Routing effectiveness

  Retry rate                          Execution efficiency

  High-tier usage share               Whether expensive reasoning is
                                      being reserved

  Total reported usage/cost           Actual resource efficiency
  -----------------------------------------------------------------------

Do not judge success by token reduction alone. A system that uses fewer
tokens but creates more bugs or requires more human repair is not an
improvement.

Use a representative evaluation set containing: - Simple bounded
feature. - Multi-module feature. - UI feature with an existing design
system. - Database/API change. - Bug investigation. - Refactor with
compatibility constraints. - Security-sensitive change.

Compare outcomes over multiple runs where practical.

------------------------------------------------------------------------

# 23. Instructions to the Coding Agent Building This System

Implement this specification as a real, maintainable software project.

Before coding:

1.  Inspect the available development environment and existing
    repository.
2.  Identify the actual Antigravity integration capabilities available
    in this environment.
3.  Verify current provider documentation and exact model identifiers.
4.  Identify which requirements can be implemented directly and which
    require credentials, user setup, or external APIs.
5.  Produce a concise technical design and phased implementation plan.
6.  Identify assumptions and ask only for decisions that block safe
    implementation.

During implementation:

-   Build in the roadmap order.
-   Keep provider adapters separate from routing policy.
-   Use typed schemas and validate all persisted contracts.
-   Include unit and integration tests.
-   Include a mock provider so the system can be developed without
    consuming real model quota.
-   Use configuration rather than hard-coded model names.
-   Add observability from the beginning.
-   Implement safe filesystem and Git boundaries.
-   Keep the first release small enough to finish and verify.
-   Update documentation when behavior changes.
-   Do not create placeholder features and describe them as working.

Before declaring completion:

-   Run the project's build, lint, type-check, and test commands.
-   Report exactly which checks ran and their results.
-   Demonstrate one end-to-end workflow using a mock provider.
-   Demonstrate plan approval, task execution, validation failure, and
    escalation.
-   Document the steps needed to connect real providers.
-   Clearly list limitations, missing integrations, and configuration
    requirements.

## Final product philosophy

This is not merely a multi-agent code generator. It is a persistent,
project-aware software engineering orchestration system.

Its job is to preserve the quality of strong architectural reasoning
while delegating bounded implementation work to faster models,
validating the result with objective checks, and using expensive model
capacity only when it adds meaningful value.

One additional critical requirement:

I want the orchestration system to dynamically discover and manage the AI models available in my Google Antigravity environment.

The system must not rely on hardcoded model assignments.

It should maintain a dynamic model registry containing available models, capabilities, performance, and usage limits wherever accessible.

It should intelligently select models based on task complexity, required reasoning capabilities, execution speed, and remaining quota.

Prioritize high-capability models for planning, architectural decisions, and complex problem-solving. Use faster models for bounded implementation tasks.

If a model becomes unavailable or reaches its quota, automatically select the next suitable available model.

Do not assume that IDE subscription models can be accessed through an API. First investigate the officially supported Antigravity integration mechanisms and implement the most reliable supported approach.

The system must never silently downgrade quality-critical tasks to an unsuitable model.

### Critical Requirement: Token-Efficient Context Management

The orchestration system must be designed around minimum necessary context consumption.

Do not load the entire project documentation, architecture, execution blueprint, or orchestration instructions into every model interaction.

Implement a progressive context-loading architecture with three layers:

1. Core Memory: Small, always-loaded project instructions and non-negotiable constraints.
2. Project Intelligence: Persistent architectural documentation, retrieved selectively based on task requirements.
3. Task Memory: Execution contracts, relevant source files, dependencies, and acceptance criteria.

Additional requirements:

- Use targeted repository retrieval rather than repeatedly scanning the entire codebase.
- Cache reusable project analysis and invalidate it when relevant source files change.
- Avoid repeating architectural analysis when validated information already exists.
- Give execution models only the context necessary for their assigned task.
- Summarize completed task handoffs instead of passing entire conversation histories.
- Track context size and token usage per model interaction wherever supported.
- Establish configurable context budgets for different task categories.
- Preserve critical constraints when compressing context. Never remove important requirements simply to meet a token budget.
- Retrieve additional context dynamically when an agent discovers missing information.

The goal is to minimize redundant token consumption without sacrificing implementation accuracy, architectural consistency, or code quality.

Measure context efficiency alongside implementation quality.