# Collaborative Omni Memory Design

Date: 2026-04-30
Status: Core implementation in progress; workflow settings, protected-branch guard, active work planning, collaboration status, start-work, PR tooling, root-plan migration, and branch-scoped runtime state are implemented.

## Problem

The first GedCode memory model assumes one active task per checkout:

```text
.ged/SPEC.md
.ged/TASKS.md
.ged/TESTS.md
.ged/STATE.md
```

That works for solo work, but collaboration changes the constraints:

- multiple contributors may work on different branches at once;
- some contributors may not use GedCode or GedPi;
- a shared singleton plan can become stale, overwritten, or unrelated to the current branch;
- runtime state should not be treated as team truth;
- change requests should normally happen on feature branches and flow through PRs.

GedCode needs to keep its useful durable-memory workflow without turning `.ged/` into a shared mutable bottleneck.

## Design principles

1. **Separate stable knowledge from active work.** Team-level facts, standards, skills, and decisions can be shared. Current task state should be scoped to the work item.
2. **Use Git as the collaboration boundary.** Branches and PRs are the natural unit of parallel work, review, and merge conflict resolution.
3. **Do not assume every contributor uses Omni.** Rehydrate from git history, diffs, issues, PRs, docs, and changelog entries before trusting stale Omni state.
4. **Prefer explicit settings over hidden behavior.** Guardrail policy belongs in GedCode settings JSON, with global defaults and optional project-local overrides.
5. **Preserve solo/backward compatibility.** Existing root planning files continue to work until projects opt into or are migrated to per-work planning.

## Memory tiers

### Shared project memory

Committed when it reflects real project intent:

```text
.ged/PROJECT.md
.ged/DECISIONS.md
.ged/STANDARDS.md
.ged/SKILLS.md
.ged/CONFIG.md        # legacy/current human-readable Omni config
.ged/VERSION
.ged/.gitignore
```

These files should behave like project documentation: reviewed, durable, and stable enough for multiple contributors.

### Per-work-item planning memory

New collaboration-safe planning root:

```text
.ged/work/<work-id>/
  SPEC.md
  TASKS.md
  TESTS.md
  NOTES.md          # optional work-specific context and handoff notes
  META.json         # optional machine-readable metadata later
```

Default `<work-id>`: the current git branch slug.

Examples:

```text
.ged/work/feat-configurable-subagents/SPEC.md
.ged/work/fix-launcher-check/TASKS.md
```

Branch slug rules should be deterministic and filesystem-safe:

- lowercase where appropriate;
- replace slashes and unsafe characters with `-`;
- trim repeated separators;
- reject empty slugs.

Issue IDs, PR IDs, or external tracker references can be stored in `META.json` later, but they should not be required to choose the directory. Branch works for Omni and non-Omni contributors.

### Runtime/session state

Generated and untracked:

```text
.ged/STATE.md
.ged/SESSION-SUMMARY.md
.ged/REPO-MAP.md
.ged/REPO-MAP.json
```

Runtime state now lives under branch/root scoped paths:

```text
.ged/runtime/<branch-slug-or-root>/STATE.md
.ged/runtime/<branch-slug-or-root>/SESSION-SUMMARY.md
```

This avoids root singleton runtime conflicts while keeping runtime files untracked.

## Active work selection

At the start of a change request, GedCode should eventually run a collaboration checkpoint:

1. Detect current git branch.
2. Detect whether the branch is protected (`main`, `master`, or configured protected branch names).
3. If protected-branch changes are blocked, stop before planning or source edits and tell the user to create/switch to a feature branch or explicitly override the setting.
4. Compute the branch slug and select `.ged/work/<branch-slug>/` as the active planning directory.
5. If a work directory already exists, read it and reconcile with current git diff/log/issue/PR context.
6. If no work directory exists, create it from the standard planning templates.
7. Treat legacy root `SPEC.md`, `TASKS.md`, and `TESTS.md` as solo/backward-compatible fallback until the project has an active work directory.

## Protected branch policy

Change requests should not implement directly on protected branches by default.

Default protected branches:

```json
["main", "master"]
```

Policy belongs in the effective GedCode settings JSON layer, not in committed `.ged/CONFIG.md`:

```json
{
  "workflow": {
    "protectedBranches": ["main", "master"],
    "requireFeatureBranchForChanges": true,
    "allowProtectedBranchChanges": false
  }
}
```

Settings resolution should follow the already-planned GedCode settings model:

1. global user settings provide defaults;
2. project-local settings override when present;
3. either scope may explicitly set `workflow.allowProtectedBranchChanges=true`.

Project-local settings are still settings, not durable Omni memory. They should be treated like the subagent/model settings layer: usually untracked unless the user/team intentionally versions them outside GedCode's defaults.

When blocked, the guard message should be explicit:

```text
GedCode guard: change requests should run on a feature branch, not main.
Create or switch to a branch, or set workflow.allowProtectedBranchChanges=true
in GedCode settings if this project intentionally allows direct protected-branch work.
```

## Non-Omni contributors

GedCode must assume `.ged/work/<id>/` can be missing or stale. Before planning or resuming work, it should inspect normal collaboration sources:

- `git status`, diff, and recent commits;
- current branch name;
- linked issue or PR, when discoverable;
- `CHANGELOG.md`;
- docs and ADRs;
- code changes since the work item was last touched.

If code and Omni memory disagree, code/git/issue tracker evidence wins until the user resolves the mismatch.

## Migration and compatibility

Phase 1 implementation should preserve current behavior:

- existing root planning files still satisfy the plan-before-edit guard;
- new collaborative planning can be introduced behind active-work selection;
- projects can migrate gradually by creating `.ged/work/<branch-slug>/` directories;
- root planning files can become a legacy solo-mode fallback or high-level current-task scratchpad later.

## Suggested implementation slices

1. **Settings primitives for workflow policy**
   - Add workflow settings fields to the effective settings schema/merge.
   - Surface effective values in status output.
   - Do not enforce yet.

2. **Branch detection and protected-branch guard**
   - Detect current branch.
   - Block mutating tools on protected branches when required and not overridden.
   - Add tests for default block, global override, and project override.

3. **Active work directory selection**
   - Compute branch slug.
   - Add helpers for `.ged/work/<slug>/` planning paths.
   - Preserve root fallback.

4. **Planning-artifact guard update**
   - Allow source edits when either active work planning artifacts or legacy root artifacts are ready.
   - Update guard messages to name the selected planning directory.

5. **Collaboration checkpoint UX** ✅
   - Document/start using a session checkpoint that reports branch, active work path, protected-branch policy, stale/missing work memory, and recommended next action.

## Open questions

- Should `.ged/work/<branch-slug>/` be committed by default for every feature branch, or only when the plan captures reusable team intent?
- Should `META.json` be introduced immediately or deferred until issue/PR integration exists?
- Should runtime files move to `.ged/runtime/<branch-or-session>/` in the same phase as work directories or later?
