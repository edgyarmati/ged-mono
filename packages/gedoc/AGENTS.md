# AGENTS.md

This repository is **GedOC**.

## What GedOC is

GedOC is an **OpenCode plugin + launcher**.

It is **not**:
- a custom terminal UI
- a fork of OpenCode
- a continuation of the old GedPi standalone shell work

OpenCode owns the UX and runtime. GedOC owns the **workflow layer**.

## Product goal

Bring the Ged workflow into OpenCode with a thin wrapper.

Core idea:
- keep OpenCode as the mature host app
- load GedOC as a plugin
- preserve the Ged workflow:
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
- launch OpenCode through an `gedoc` command that uses GedOC-specific config without mutating the user's normal OpenCode setup

## Current architecture

### Packages

- `packages/plugin` → `@gedoc/plugin`
  - OpenCode plugin
  - registers GedOC agent/config/commands/tools
  - bootstraps `.ged/`
  - adds workflow guardrails

- `packages/launcher` → `gedoc`
  - wrapper CLI
  - ensures OpenCode exists or attempts install
  - writes GedOC-specific OpenCode config under `~/.config/gedoc/opencode/`
  - writes a local plugin shim there
  - isolates GedOC from normal OpenCode config via `XDG_CONFIG_HOME=~/.config/gedoc`
  - launches OpenCode with `OPENCODE_CONFIG`, `OPENCODE_CONFIG_DIR`, and `OPENCODE_CLIENT=gedoc`

## Current implemented behavior

### Plugin

Implemented in `packages/plugin/src/index.ts`.

Current features:
- registers default `gedoc` agent
- loads GedOC command markdown files from `src/resources/commands/`
- exposes custom tools:
  - `gedoc_bootstrap`
  - `gedoc_state`
  - `gedoc_update_state`
  - `gedoc_append_session_summary`
  - `gedoc_repo_map`
  - `gedoc_discover_standards`
  - `gedoc_import_standards`
  - `gedoc_suggest_skills`
  - `gedoc_update_skills`
  - `gedoc_list_skills`
  - `gedoc_read_skill`
  - `gedoc_collaboration_status`
  - `gedoc_start_work`
  - `gedoc_create_pr`
- bootstraps `.ged/` on `session.created`
- adds active `.ged/runtime/<branch-slug-or-root>/STATE.md` into compaction context
- guards `write` / `edit` until real planning content exists in `SPEC.md`, `TASKS.md`, and `TESTS.md`
- placeholder bootstrap planning files are not enough; source edits require real planning content
- auto-escalates trivial→non-trivial when >1 source file is touched
- invalidates verifier checkpoints on source edits to force re-verification before commit
- optional native subagents follow a single-writer model: `ged-explorer`, `ged-planner`, and `ged-verifier` are read-only/advisory intelligence helpers; there is no writer subagent role

Planning artifacts currently required before source editing:
- `.ged/work/<work-id>/SPEC.md`
- `.ged/work/<work-id>/TASKS.md`
- `.ged/work/<work-id>/TESTS.md`

### Bundled resources

Under `packages/plugin/src/resources/`:
- `instructions/gedoc-agent.md`
- `commands/ged-init.md`
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

Implemented in `packages/launcher/bin/gedoc.js`.

Current behavior:
- resolves native-launcher release metadata for the desired OpenCode target version
- installs/uses an GedOC-managed per-user OpenCode runtime (`npm --prefix <managed-dir>`) when needed
- tracks managed runtime metadata under GedOC user data directories
- writes config to:
  - `~/.config/gedoc/opencode/opencode.json`
  - `~/.config/gedoc/opencode/plugins/gedoc-plugin.js`
- launches OpenCode with GedOC env overrides

## Important design decisions

- **filesystem/repo name**: `gedoc/`
- **product branding**: `GedOC`
- v1 intentionally ignores:
  - provider management from GedPi
  - custom UI/theming/status work
  - standalone OpenTUI shell work
- focus only on the real differentiator: **the Ged workflow layer**

## Documents to read first

- `README.md`
- `docs/current-orchestration-model.md`
- `docs/2026-04-24-gedoc-design.md`
- `docs/2026-04-30-collaborative-memory-design.md`
- `docs/implementation-plan.md`

## Smoke-tested behavior

Verified in a real OpenCode runtime:
- the `gedoc` launcher loads the GedOC plugin cleanly
- `gedoc` is available as an OpenCode agent
- GedOC commands and tools register successfully
- `gedoc_bootstrap` works in a live run
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
   - current enforcement blocks `write`/`edit` until `.ged/work/<work-id>/SPEC.md`, `.ged/work/<work-id>/TASKS.md`, and `.ged/work/<work-id>/TESTS.md` contain non-placeholder planning content
   - may need stronger or more precise guarding once more real OpenCode sessions are observed

2. **Collaborative memory / branch workflow**
   - implement the design in `docs/2026-04-30-collaborative-memory-design.md`
   - select `.ged/work/<branch-slug>/` as active planning memory for collaborative work
   - block protected-branch implementation by default unless GedOC settings explicitly allow it

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
- `install.sh` and `install.ps1` are the target public installers.
- `.github/workflows/release-gedoc.yml` builds and publishes the tagged JS bundle plus installer scripts on `gedoc-v*` tags.
- `scripts/release/bundle.sh` defines the current release artifact layout/naming.
- `docs/release-checklist.md` is the required release runbook.
- the `gedoc` launcher package in `packages/launcher/` is still the current dev/runtime entrypoint, with release direction toward standalone GedOC binaries plus a managed per-user OpenCode runtime.

## Releases

GedOC ships as a tarball + installer scripts. It is NOT published to npm.

### How to release

1. Ensure `CHANGELOG.md` has all changes under `## Unreleased`.
2. Bump version: `node scripts/sync-version.mjs` (updates all version references).
3. Rename `## Unreleased` to `## X.Y.Z - YYYY-MM-DD` and add a new `## Unreleased` section at the top.
4. Commit: `chore: release gedoc X.Y.Z`.
5. Tag: `git tag gedoc-vX.Y.Z`.
6. Push: `git push origin main --tags`.
7. The `release-gedoc.yml` workflow will: check → test → bundle → compute SHA256 → create GitHub release with tarball, checksums, and installers.

### Tag format

- GedOC releases use `gedoc-v*` tags (e.g., `gedoc-v0.4.0`).
- GedPi releases use `gedpi-v*` tags — they are independent.

## Repo hygiene

For GedOC, `.ged/` is intentionally split.

Every committed change that is user-facing (features, fixes, behavior changes, dependency bumps, deprecations) must add an entry under `## Unreleased` in `CHANGELOG.md`. Group entries by category (`### Features`, `### Fixes`, `### Documentation`, etc.). Keep the changelog current during each slice — don't batch it at release time. On release, `## Unreleased` is renamed to `## X.Y.Z - YYYY-MM-DD` and a fresh `## Unreleased` header is added.

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
- Preserve the user's normal OpenCode setup; GedOC should only affect launches through `gedoc`.
- Favor workflow reliability over fancy UX.
