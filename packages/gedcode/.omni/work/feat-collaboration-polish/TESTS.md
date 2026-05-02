# Tests

## Slice 1 — TDD workflow

- [x] Add/update tests proving bundled/default skill memory includes `tdd`.
- [x] Add/update tests proving `gedcode_suggest_skills` suggests `tdd` for feature, behavior-change, refactor, and test-first/TDD wording.
- [x] Run `npm run check`.
- [x] Run `npm test`.

Expected outcome: type-check passes and the full test suite passes; TDD behavior is instruction/planning-based and documented around active-work `TESTS.md`. Observed: `npm run check` passed; `npm test` passed with launcher 10 tests and plugin 59 tests.

## Slice 2 — Diagnose workflow

- [x] Add/update tests proving bundled/default skill memory includes `diagnose`.
- [x] Add/update tests proving `gedcode_suggest_skills` suggests `diagnose` for bug, failure, debugging, and performance-regression wording.
- [x] Run `npm run check`.
- [x] Run `npm test`.

Expected outcome: bug/performance workflows route through diagnosis before TDD/regression-test work where applicable. Observed red first: tests failed before implementation because `diagnose` was missing from bundled skill memory and suggestions. After implementation, `npm run check` passed and `npm test` passed with launcher 10 tests and plugin 60 tests.

## Slice 3 — Grill with docs workflow

- [x] Add/update tests proving bundled/default skill memory includes `grill-with-docs`.
- [x] Add/update tests proving `gedcode_suggest_skills` suggests `grill-with-docs` for domain language, ADR, decision-record, and durable-doc planning wording.
- [x] Run `npm run check`.
- [x] Run `npm test`.

Expected outcome: `grill-me` remains default; `grill-with-docs` is available for documentation-aware clarification. Observed red first: tests failed before implementation because `grill-with-docs` was missing from bundled skill memory and suggestions. After implementation, `npm run check` passed and `npm test` passed with launcher 10 tests and plugin 61 tests.

## Slice 4 — Architecture improvement command

- [x] Add/update tests proving bundled/default skill memory includes `improve-codebase-architecture`.
- [x] Add/update tests proving command registration includes `improve-codebase-architecture`.
- [x] Add/update tests proving suggestions route architecture/deepening/refactor-opportunity wording to the architecture skill.
- [x] Run `npm run check`.
- [x] Run `npm test`.

Expected outcome: `/improve-codebase-architecture` is review/planning-only by default and produces candidates before any refactor change request begins. Observed red first: tests failed before implementation because architecture skill memory, suggestion routing, and command registration were missing. After implementation, `npm run check` passed and `npm test` passed with launcher 10 tests and plugin 63 tests.

## Slice 5 — OpenCode target version update

- [x] Confirm latest npm `opencode-ai` version is `1.14.30`.
- [x] Update launcher target version to `1.14.30`.
- [x] Update tests/docs/changelog that explicitly reference the target version.
- [x] Run `npm run check`.
- [x] Run `npm test`.

Expected outcome: managed OpenCode runtime target is `1.14.30`, GedCode package versions remain `0.3.0`, and verification passes. Observed red first: launcher test failed while target was `1.14.25`; after updating, `npm run check` passed and `npm test` passed with launcher 11 tests and plugin 63 tests.

## Slice 6 — Main subagent workflow integration

- [x] Merge `origin/main` into the current branch.
- [x] Confirm `git log HEAD..origin/main` is empty after merge commit.
- [x] Run `npm run check`.
- [x] Run `npm test`.

Expected outcome: current branch includes the subagent workflow commits from main and all checks pass. Observed: merge conflicts were resolved by combining workflow/collaboration features with subagent settings/tools. `npm run check` passed and `npm test` passed with launcher 11 tests and plugin 68 tests. After merge commit `49ddfa9`, `git log HEAD..origin/main` is empty.

## Slice 7 — Single-writer intelligence orchestration policy

- [x] Update tests proving generated Omni agent instructions/config include the single-writer invariant and do not encourage casual parallel implementation in the active worktree.
- [x] Update tests proving subagent prompts/descriptions keep explorer/planner/verifier advisory/read-only and make worker usage exceptional/single-slice by default.
- [x] Verify docs/resources mention clean-context review/adjudication before commit for implementation slices.
- [x] Run `npm run check`.
- [x] Run `npm test`.

Expected outcome: policy and workflow resources steer GedCode toward intelligence subagents plus single-writer execution, with no new runtime enforcement/tools in this slice. Observed: `npm run check` passed, `npm test` passed with launcher 11 tests and plugin 69 tests, `git diff --check` passed, and clean-context review found no blocking issues.

## Slice 8 — Clean-context review command

- [x] Add tests proving `GedCodePlugin` registers `/clean-context-review` for the `gedcode` agent.
- [x] Add tests proving the command template includes blind diff review, optional contract review, severity/evidence/confidence/blocking status, and orchestrator adjudication.
- [x] Add tests proving `/commit` guidance requires running or explicitly accounting for clean-context review before commit.
- [x] Run `npm run check`.
- [x] Run `npm test`.
- [x] Run `git diff --check`.

Expected outcome: clean-context review has an explicit workflow command, while writer-subagent mode remains out of scope. Observed: `npm run check` passed, `npm test` passed with launcher 11 tests and plugin 70 tests, `git diff --check` passed, and clean-context review found only low-severity documentation/test-hardening items that were addressed.

## Slice 9 — Current orchestration documentation

- [x] Add or update docs explaining the current single-writer orchestration model.
- [x] Verify README, AGENTS, and CHANGELOG reference the docs.
- [x] Run `npm run check`.
- [x] Run `npm test`.
- [x] Run `git diff --check`.

Expected outcome: future users understand that the primary `gedcode` agent owns active-worktree writes and decisions, subagents provide intelligence only, `/clean-context-review` supports review/adjudication, and writer subagent mode is intentionally not implemented. Observed: docs were added and linked; clean-context review found wording that implied future writer mode was usable, which was fixed; `npm run check`, `npm test`, and `git diff --check` passed.

## Slice 10 — Remove writer subagent scope

- [x] Remove the legacy writer subagent from source, settings schemas, docs, skills, and tests.
- [x] Add/update tests proving optional subagents register only explorer/planner/verifier and task permissions exclude worker.
- [x] Add/update tests proving stale writer-subagent model settings are ignored/cleaned.
- [x] Run `npm run check`.
- [x] Run `npm test`.
- [x] Run `git diff --check`.
- [x] Search for active references to the removed writer-subagent name.

Expected outcome: GedCode has no writer-subagent surface; optional native subagents are intelligence-only. Observed: source/settings/docs/tests were cleaned, stale model keys are filtered on read/write, `npm run check` passed, `npm test` passed with launcher 11 tests and plugin 70 tests, `git diff --check` passed, and search for the removed writer-subagent name returned no matches.

## Slice 11 — Per-agent passthrough provider options

- [ ] Add tests proving `readGedCodeSettings` parses and merges per-agent `options` from global and project settings.
- [ ] Add tests proving `updateGedCodeAgentsSettings` persists and cleans per-agent options.
- [ ] Add tests proving `buildSubagentConfig` merges per-agent options into the returned agent config (e.g. `reasoningEffort`).
- [ ] Add tests proving plugin config passes per-agent options through to OpenCode agent config.
- [ ] Add tests proving `gedcode_agents_status` reports effective per-agent options.
- [ ] Run `npm run check`.
- [ ] Run `npm test`.

Expected outcome: users can set per-agent provider options like `reasoningEffort` and they get merged into the OpenCode agent config as passthrough keys. Settings without options continue to work as before. Observed: `npm run check` passed, `npm test` passed with launcher 11 tests and plugin 74 tests.

## Slice 12 — Mandatory enabled-subagent checkpoints and setup/status polish

- [x] Add tests proving agent status displays object model configs and resolved per-agent options.
- [x] Add tests proving tool status/update paths use the injected settings home and preserve object configs.
- [x] Add tests proving primary instructions and `/ged-agents` guidance mention mandatory checkpoints, skip reasons, exact model IDs, and object configs.
- [x] Update docs and prompts so enabled explorer/planner/verifier are mandatory checkpoints for non-trivial changes unless a skip reason is recorded.
- [x] Run `npm run check`.
- [x] Run `npm test`.

Expected outcome: enabled subagents are no longer merely “preferred”; non-trivial changes require explorer/planner/verifier checkpoints or a recorded skip reason, and `/ged-agents` does not lose provider options or hide which config path/model is effective. Observed: `npm run check` passed, `npm test` passed with launcher 11 tests and plugin 76 tests.
