# AGENTS.md

This repository is **GedCode**.

## What GedCode is

GedCode is an **OpenCode plugin + launcher**.

It is **not**:
- a custom terminal UI
- a fork of OpenCode
- a continuation of the old GedPi standalone shell work

OpenCode owns the UX and runtime. GedCode owns the **workflow layer**.

## Product goal

Bring the Omni workflow into OpenCode with a thin wrapper.

Core idea:
- keep OpenCode as the mature host app
- load GedCode as a plugin
- preserve the Omni workflow:
  - `.ged/` durable memory
  - collaboration-safe per-work memory direction for parallel branches
  - automatic grill-me clarification before change requests
  - documentation-aware grilling for domain language and durable decisions
  - explicit skill-fit checkpoint before planning
  - planning before implementation
  - TDD/red-green-refactor guidance for behavior-changing implementation slices
  - diagnose workflow guidance for bugs and performance regressions
  - architecture deepening review available as an explicit user-triggered command
  - bounded task slices
  - verification after implementation
  - clean-context review before committing meaningful implementation slices
  - single-writer orchestration where subagents contribute intelligence while the primary agent owns active-worktree writes and decisions
  - repo map for codebase awareness
  - skill discovery / required-skill guidance
- launch OpenCode through an `gedcode` command that uses GedCode-specific config without mutating the user's normal OpenCode setup

## Current architecture

### Packages

- `packages/plugin` → `@gedcode/plugin`
  - OpenCode plugin
  - registers GedCode agent/config/commands/tools
  - bootstraps `.ged/`
  - adds workflow guardrails

- `packages/launcher` → `gedcode`
  - wrapper CLI
  - ensures OpenCode exists or attempts install
  - writes GedCode-specific OpenCode config under `~/.config/gedcode/opencode/`
  - writes a local plugin shim there
  - isolates GedCode from normal OpenCode config via `XDG_CONFIG_HOME=~/.config/gedcode`
  - launches OpenCode with `OPENCODE_CONFIG`, `OPENCODE_CONFIG_DIR`, and `OPENCODE_CLIENT=gedcode`

## Current implemented behavior

### Plugin

Implemented in `packages/plugin/src/index.ts`.

Current features:
- registers default `gedcode` agent
- loads GedCode command markdown files from `src/resources/commands/`
- exposes custom tools:
  - `gedcode_bootstrap`
  - `gedcode_set_mode`
  - `gedcode_state`
  - `gedcode_update_state`
  - `gedcode_append_session_summary`
  - `gedcode_repo_map`
  - `gedcode_discover_standards`
  - `gedcode_import_standards`
  - `gedcode_suggest_skills`
  - `gedcode_update_skills`
  - `gedcode_list_skills`
  - `gedcode_read_skill`
  - `gedcode_collaboration_status`
  - `gedcode_start_work`
  - `gedcode_create_pr`
  - `gedcode_migrate_root_plan`
- bootstraps `.ged/` on `session.created`
- adds active `.ged/runtime/<branch-slug-or-root>/STATE.md` into compaction context
- guards `write` / `edit` when Omni mode is on and planning artifacts are missing
- placeholder bootstrap planning files are not enough; source edits require real planning content
- optional native subagents follow a single-writer model: `ged-explorer`, `ged-planner`, and `ged-verifier` are read-only/advisory intelligence helpers; there is no writer subagent role

Planning artifacts currently required before source editing:
- `.ged/SPEC.md`
- `.ged/TASKS.md`
- `.ged/TESTS.md`

### Bundled resources

Under `packages/plugin/src/resources/`:
- `instructions/gedcode-agent.md`
- `commands/ged-init.md`
- `commands/ged-mode.md`
- `commands/ged-status.md`
- `commands/ged-import-standards.md`
- `commands/ged-skills.md`
- `commands/commit.md`
- `commands/push.md`
- `commands/improve-codebase-architecture.md`
- `commands/clean-context-review.md`
- workflow skills:
  - `grill-me.md`
  - `grill-with-docs.md`
  - `find-skills.md`
  - `skill-maker.md`
  - `tdd.md`
  - `diagnose.md`
  - `improve-codebase-architecture.md`
  - `brainstorming.md`
  - `ged-planning.md`
  - `ged-execution.md`
  - `ged-verification.md`

### Launcher

Implemented in `packages/launcher/bin/gedcode.js`.

Current behavior:
- resolves native-launcher release metadata for the desired OpenCode target version
- installs/uses an GedCode-managed per-user OpenCode runtime (`npm --prefix <managed-dir>`) when needed
- tracks managed runtime metadata under GedCode user data directories
- writes config to:
  - `~/.config/gedcode/opencode/opencode.json`
  - `~/.config/gedcode/opencode/plugins/gedcode-plugin.js`
- launches OpenCode with GedCode env overrides

## Important design decisions

- **filesystem/repo name**: `gedcode/`
- **product branding**: `GedCode`
- v1 intentionally ignores:
  - provider management from GedPi
  - custom UI/theming/status work
  - standalone OpenTUI shell work
- focus only on the real differentiator: **the Omni workflow layer**

## Documents to read first

- `README.md`
- `docs/current-orchestration-model.md`
- `docs/2026-04-24-gedcode-design.md`
- `docs/2026-04-30-collaborative-memory-design.md`
- `docs/implementation-plan.md`

## Smoke-tested behavior

Verified in a real OpenCode runtime:
- the `gedcode` launcher loads the GedCode plugin cleanly
- `gedcode` is available as an OpenCode agent
- GedCode commands and tools register successfully
- `gedcode_bootstrap` works in a live run
- standards discovery/import works and writes `.ged/STANDARDS.md`
- ranked repo map output works and writes `.ged/REPO-MAP.md` plus `.ged/REPO-MAP.json`
- skill suggestion/sync works and writes `.ged/SKILLS.md`
- the write/edit guard blocks early writes until real planning content exists in `SPEC.md`, `TASKS.md`, and `TESTS.md`
- bundled `grill-with-docs` guidance is available for domain-language and ADR-aware clarification
- bundled `tdd` guidance is available for behavior-changing slices and records expectations in the active work `TESTS.md`
- bundled `diagnose` guidance is available for bugs/performance regressions before patching
- `/improve-codebase-architecture` is available as a review-only workflow command for architecture deepening opportunities
- `/clean-context-review` is available as a review/adjudication-only workflow command for pre-commit diff review
- optional native subagent guidance preserves a single active writer and adds clean-context review before commits
- state/session-summary lifecycle tools work in tests and runtime
- automated tests cover launcher config isolation, standards discovery/import, repo map generation, skill suggestion, lifecycle updates, and planning-artifact readiness
- collaboration status reports the current branch, protected-branch policy, active `.ged/work/<branch-slug>/` planning path, and planning readiness

## Known gaps / next work

These are the next most valuable slices:

1. **Workflow enforcement hardening**
   - current enforcement blocks `write`/`edit` until `.ged/SPEC.md`, `.ged/TASKS.md`, and `.ged/TESTS.md` contain non-placeholder planning content
   - may need stronger or more precise guarding once more real OpenCode sessions are observed

2. **Collaborative memory / branch workflow**
   - implement the design in `docs/2026-04-30-collaborative-memory-design.md`
   - select `.ged/work/<branch-slug>/` as active planning memory for collaborative work
   - block protected-branch implementation by default unless GedCode settings explicitly allow it

3. **Standards UX improvement**
   - support friendlier selection/review flows beyond import-all or explicit relative paths

4. **Repo map + skill routing refinement**
   - improve incrementality/ranking further and move beyond heuristic skill suggestion if needed

## Build / check

From repo root:

```bash
./scripts/setup
npm run check
npm test
```

## Release setup assets

- `scripts/setup` bootstraps a fresh checkout for contributors and pre-release testing.
- root `install.sh` and `install.ps1` are the target public installers for native launcher releases.
- `scripts/install.sh` is now a compatibility wrapper to the root POSIX installer.
- `.github/workflows/release.yml` builds and publishes the tagged generic JS bundle plus installer scripts.
- `scripts/release/bundle.sh` defines the current release artifact layout/naming.
- `docs/release-checklist.md` is the required release runbook.
- the `gedcode` launcher package in `packages/launcher/` is still the current dev/runtime entrypoint, with release direction toward standalone GedCode binaries plus a managed per-user OpenCode runtime.

## Repo hygiene

For GedCode, `.ged/` is intentionally split.

Every committed change must also update `CHANGELOG.md` with the user-facing change, fix, test, documentation, or process note that should appear in the next release. Keep the changelog current during each slice so release prep is a cleanup pass, not archaeology.

Durable `.ged` files may be committed when they reflect real project intent:
- `PROJECT.md`
- `SPEC.md`
- `TASKS.md`
- `TESTS.md`
- `DECISIONS.md`
- `STANDARDS.md`
- `SKILLS.md`
- `CONFIG.md`
- `VERSION`
- `.gitignore`

Runtime/generated `.ged` files stay out of git by default:
- `runtime/`
- `STATE.md`
- `SESSION-SUMMARY.md`
- `REPO-MAP.md`
- `REPO-MAP.json`

`.pi/` stays out of git as runtime state too.

## Notes for the next agent

- Do **not** drift back into building a custom shell.
- Treat OpenCode as the host product.
- Keep the launcher thin and the plugin thick.
- Preserve the user's normal OpenCode setup; GedCode should only affect launches through `gedcode`.
- Favor workflow reliability over fancy UX.
