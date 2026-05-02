# Spec

## Problem

GedCode now enforces clarification, skill-fit, branch-scoped planning, verification, and commits, but it does not yet encode several engineering-practice workflows that improve implementation quality inside each slice. Matt Pocock's public skills highlight useful patterns for TDD, disciplined diagnosis, documentation-aware clarification, and architecture review. GedCode should adapt those concepts into versioned, tested, GedCode-native workflow resources.

## Requested Behavior

Implement bundled GedCode workflow support for:

1. **TDD implementation discipline**
   - Add a bundled `tdd` workflow skill.
   - Route feature work, bug fixes with clear seams, behavior changes, and behavior-preserving refactors toward TDD during skill suggestion/skill-fit.
   - Instruct agents to use TDD as a workflow requirement in planning and verification, not as a brittle tool-level source-edit guard.
   - Treat the active planning directory's `TESTS.md` as the place to record TDD applicability, behavior under test, public seam/interface, red/green/refactor evidence, and verification commands. Root `.ged/TESTS.md` remains a legacy fallback.

2. **Diagnose bug workflow**
   - Add a bundled `diagnose` workflow skill for bugs, failing behavior, and performance regressions.
   - Route unknown failures through diagnose first: build/reuse a feedback loop, reproduce, minimize, hypothesize, instrument, fix, and regression-test.
   - Use TDD inside diagnose only once a reproducible loop or valid regression seam exists.

3. **Documentation-aware grill variant**
   - Add a bundled `grill-with-docs` skill as an enhanced variant, not a replacement for `grill-me`.
   - Use it when clarification exposes domain language, durable decisions, ADR-worthy tradeoffs, or reusable project context.
   - Keep normal `grill-me` as the default lightweight clarification gate.

4. **Architecture review workflow command**
   - Add an `improve-codebase-architecture` workflow skill and a user-triggered command.
   - The command should inspect docs/code and produce numbered deepening opportunities; it must not refactor automatically.
   - If the user selects a candidate, refactoring becomes a normal Omni change request with spec/tasks/tests and verification.

## Constraints

- Adapt concepts into bundled GedCode resources; do not install or depend on external skills at runtime.
- Keep OpenCode as the host; no custom shell behavior.
- Preserve existing public tool names and existing workflow guard semantics.
- Keep TDD/diagnose enforcement instruction- and planning-based rather than trying to infer true red/green cycles at tool level.
- Update `CHANGELOG.md` with each committed slice.
- Verify each slice with `npm run check` and `npm test` before committing.

## Success Criteria

- Bundled/default skills include `tdd`, `diagnose`, `grill-with-docs`, and `improve-codebase-architecture` as they land.
- `gedcode_suggest_skills` suggests:
  - `tdd` for feature/behavior/refactor/test-first requests,
  - `diagnose` for bugs/failures/performance regressions,
  - `grill-with-docs` for ADR/domain/documentation-aware planning,
  - `improve-codebase-architecture` for architecture/deepening/refactor-opportunity requests.
- Agent instructions describe the new routing and planning expectations, including active-work `TESTS.md` terminology.
- `/improve-codebase-architecture` is available as a command and is review/planning-only by default.
- README/AGENTS/CHANGELOG document the new workflow behavior.
- Tests cover bundled skill listing/reading, default skill memory, suggestion heuristics, and command registration where applicable.
- `npm run check` and `npm test` pass after each slice.

---

## Current Implementation Task — OpenCode Target Version Update

### Problem

GedCode's launcher pins the managed upstream OpenCode runtime target at `1.14.25`, while npm reports the latest `opencode-ai` version as `1.14.30`. New GedCode-managed installs should use the latest tested OpenCode runtime without changing GedCode's own package version.

### Requested Behavior

- Update the launcher OpenCode target version from `1.14.25` to `1.14.30`.
- Keep GedCode package versions at `0.3.0`.
- Update tests, docs, and changelog only where they explicitly assert or describe the target version.

### Constraints

- This is a dependency/runtime target bump, not an GedCode release version bump.
- Keep the change to one bounded slice.
- Verify with `npm run check` and `npm test` before committing.

### Success Criteria

- `getRequiredOpenCodeVersion()` returns `1.14.30`.
- Tests that cover release/runtime metadata pass.
- `CHANGELOG.md` records the OpenCode target update.
- `npm run check` and `npm test` pass.

---

## Current Integration Task — Main Subagent Workflow Commits

### Problem

The current `feat/collaboration-polish` branch diverged before main merged the subagent workflow PR. The branch lacks the main commits for GedCode settings primitives, optional omni subagents, and the `/ged-agents` setup command.

### Requested Behavior

- Integrate `origin/main` into `feat/collaboration-polish`.
- Preserve the collaboration-polish workflow changes and the subagent workflow changes from main.
- Resolve any conflicts narrowly.

### Constraints

- Do not rewrite history or force-push.
- Keep the integration as a normal merge commit if needed.
- Verify with `npm run check` and `npm test` after integration.

### Success Criteria

- The branch contains main commits `d0c2a63`, `18b5e26`, `ff88213`, and merge `7fef2e1` or their merged content.
- `git log HEAD..origin/main` is empty after integration.
- Verification passes.

---

## Current Design Task — Single-Writer Intelligence Orchestration

### Problem

GedCode now has optional native subagents (`ged-explorer`, `ged-planner`, `ged-verifier`), and the orchestration guidance must stay aligned with a no-writer-subagent model. Recent practical multi-agent guidance and Repo Prompt's context-engineering workflows point toward a safer model: context gathering and critique can be parallelized, but writes and final decisions should stay single-threaded with the primary `gedcode` agent.

### Requested Behavior

Reframe GedCode orchestration around **single-writer intelligence injection**:

1. **Orchestrator owns writes and decisions by default**
   - The primary `gedcode` agent remains responsible for clarification, planning, source edits, verification decisions, state/session notes, commits, and PR decisions.
   - Native subagents are context lenses by default, not co-authors.

2. **Read-only scouts produce discovery packets**
   - `ged-explorer` and `ged-planner` gather files, evidence, patterns, risks, open questions, and candidate plan/test updates.
   - They should return structured findings with file references and uncertainty, not implementation patches.

3. **Smart-friend consultation is advisory**
   - Add guidance for consulting a stronger/fresh/specialized subagent or model when the plan is risky, ambiguous, cross-cutting, or stuck.
   - Smart friend should identify missing context, recommend files/facts to inspect, critique plans, and explicitly say when more investigation is needed rather than guessing.

4. **Clean-context review before commit**
   - After implementing and running planned checks, invoke a clean-context review pass before committing meaningful implementation slices.
   - Reviewer should inspect the diff/tests with minimal prior context, report bugs/edge cases/security/test gaps, and let the orchestrator adjudicate accepted vs rejected findings.

5. **No writer subagent role**
   - Optional subagents are intelligence helpers only.
   - Do not add worker swarms, implementation subagents, or alternate writer modes.

### First Implementation Scope

Start with **policy + workflow enforcement surfaces** only:

- Update bundled agent instructions and relevant workflow skills/commands.
- Update README/AGENTS/CHANGELOG to describe the new single-writer orchestration model.
- Update subagent descriptions/prompts/permissions so only intelligence-helper subagents are exposed.
- Add tests around generated agent config/instructions and bundled resources where practical.
- Do not add new runtime tools, worktree management, or hard plugin enforcement in the first slice.

### Constraints

- Keep OpenCode as the host and GedCode as the workflow layer.
- Preserve public tool and command names.
- Keep existing optional subagent settings compatibility.
- Remove legacy writer-subagent concepts instead of keeping compatibility placeholders.
- Keep changes narrow enough to verify with `npm run check` and `npm test`.
- Update `CHANGELOG.md` for the committed slice.

### Success Criteria

- Agent instructions state the single-writer invariant and distinguish read-only intelligence subagents from writer subagents.
- Subagent prompts/descriptions make `ged-explorer`, `ged-planner`, and `ged-verifier` advisory/read-only, with no writer subagent role.
- Verification workflow guidance includes clean-context review/adjudication before commit for implementation slices.
- Docs explain how Repo Prompt-style discovery/curation/handoff and Cognition-style single-writer review loops map to GedCode.
- Tests cover the updated orchestration prompt or generated config strings enough to prevent regression to writer subagents.
- `npm run check` and `npm test` pass before commit.

---

## Current Implementation Task — Clean-Context Review Tooling

### Problem

The single-writer orchestration policy now requires clean-context review before committing meaningful implementation slices, but GedCode only documents the expectation in general workflow guidance. Agents need an explicit command/workflow surface that standardizes how to review a diff with fresh context, adjudicate findings, rerun verification, and decide whether a commit is ready.

### Requested Behavior

- Add a bundled `/clean-context-review` command for the `gedcode` agent.
- The command must be review/adjudication-only by default: inspect git status/diff and planned tests, review the diff with minimal prior assumptions, report findings by severity, and require the primary orchestrator to accept/reject findings before commit.
- Update `/commit` guidance so commits run or explicitly account for clean-context review before creating a commit.
- Update instructions/docs/changelog to surface the command.

### Constraints

- Keep this as workflow tooling/prompt guidance; do not add new runtime enforcement or writer-subagent support.
- Do not let the review command edit files or commit directly.
- Preserve existing command and tool names.

### Success Criteria

- `/clean-context-review` is registered as a command.
- Command text includes blind diff review, optional contract review, finding severity/evidence/confidence/blocking status, and orchestrator adjudication.
- `/commit` reminds agents to run or explicitly account for clean-context review before commit.
- README/AGENTS/CHANGELOG mention the command.
- Tests cover command registration and command/commit guidance.
- `npm run check`, `npm test`, and whitespace checks pass.

---

## Current Documentation Task — Current Orchestration Model

### Problem

The implementation now encodes single-writer orchestration and clean-context review, but the current user-facing explanation is spread across README bullets, command text, and agent instructions. Maintainers and future users need one clear document explaining how the system actually works today, including what subagents can and cannot do.

### Requested Behavior

- Add a user-facing docs page that explains the current orchestration model.
- Cover the primary `gedcode` agent, optional intelligence subagents, `/clean-context-review`, `/ged-agents`, and the reason writer subagents are not implemented.
- Link the page from README and AGENTS.
- Record the documentation update in CHANGELOG.

### Constraints

- Documentation-only change; do not change runtime behavior.
- Be explicit that no subagent writer mode should be implemented as part of the current design.

### Success Criteria

- Docs explain current behavior and user commands clearly.
- Docs state that writer subagents are intentionally not implemented.
- README/AGENTS/CHANGELOG reference the documentation.

---

## Current Implementation Task — Remove Legacy Writer Subagent Scope

### Problem

The current code still exposes a legacy writer subagent even though GedCode's intended model is single-writer orchestration with intelligence-only subagents. Keeping that compatibility placeholder creates confusion and implies writer subagents remain in scope.

### Requested Behavior

- Remove the legacy writer subagent from subagent types, defaults, task permissions, settings schemas, `/ged-agents` guidance, tests, and docs.
- Remove writer-worker roadmap references from active docs and planning notes.
- Keep only `ged-explorer`, `ged-planner`, and `ged-verifier` as optional native subagents.
- Update `skill-maker` and any durable notes that mention the legacy writer subagent.

### Constraints

- No legacy compatibility required.
- Do not add a replacement writer-subagent path.
- Keep the primary `gedcode` agent as the only active-worktree writer.

### Success Criteria

- Searching source/docs for the removed writer-subagent name returns no active references.
- Optional subagent config registers only explorer, planner, and verifier.
- Tests cover settings cleanup and task permission removal.
- README/AGENTS/current orchestration docs clearly describe intelligence-only subagents.
- `npm run check`, `npm test`, and whitespace checks pass.

---

## Current Implementation Task — Per-Agent Passthrough Provider Options

### Problem

GedCode's agent settings only support per-agent model IDs. OpenCode supports passthrough provider options like `reasoningEffort` and `textVerbosity` on agent config — any extra keys on the agent config get forwarded to the provider. Users want to configure per-agent reasoning levels (e.g. high thinking for planner, low thinking for verifier) but the current plugin has no surface for this.

### Requested Behavior

- Extend GedCode's agent settings schema with a per-agent `options` field that accepts arbitrary key-value pairs.
- Merge per-agent options into the OpenCode agent config during `buildSubagentConfig`.
- Update `gedcode_update_agents_settings` tool to accept and persist options.
- Update `gedcode_agents_status` tool to report per-agent options.
- Preserve existing behavior when no options are set.

### Constraints

- Do not validate provider-specific options — just pass through.
- Keep the change narrow: settings types, parse/normalize, buildSubagentConfig, and tool schema.
- Do not change existing public tool names or behavior when options are absent.
- Update `CHANGELOG.md`.
- Verify each slice with `npm run check` and `npm test` before committing.

### Success Criteria

- `GedCodeSettings.agents` includes an `options` field.
- `buildSubagentConfig` merges per-agent options into the returned agent config.
- `gedcode_update_agents_settings` accepts an `options` parameter and persists it to settings.
- `gedcode_agents_status` reports effective per-agent options.
- Settings merge global and project options with project override precedence.
- Tests cover option parsing, persistence, merging, and passthrough into agent config.
- `npm run check` and `npm test` pass.
