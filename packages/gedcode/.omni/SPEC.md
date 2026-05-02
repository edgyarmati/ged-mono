# Spec

## Problem

Recent GedPi release-readiness work fixed several workflow reliability and hardening issues that also apply to GedCode's OpenCode plugin + launcher: direct `.ged` writes can leave truncated files, user-controlled text can alter generated markdown structure, simple semver comparison mishandles prereleases, and repo-map generation can be made safer and more reliable.

## Requested Behavior

Backport the relevant GedPi hardening ideas into GedCode in bounded slices:

1. **Atomic `.ged` writes**: shared atomic write helper writes sibling temp files and renames into place, preserving existing file permissions when replacing files. Use it for plugin-generated `.ged` durable/runtime files and launcher metadata/config writes where practical.
2. **Safe generated markdown**: sanitize user/tool-provided state, session summary, skill, and repo/standards-derived markdown fragments before writing `.ged` files so newlines, headings, list markers, fences, and control characters cannot fabricate sibling sections or break code fences.
3. **Semver prerelease ordering**: launcher version comparison should treat a stable release as newer than its prerelease and compare prerelease identifiers according to semver precedence; build metadata must not affect precedence.
4. **Repo-map hardening**: keep repo-map generation narrow but improve direct-write reliability and avoid avoidable per-file sequential work where a small helper is sufficient.

## Constraints

- Keep GedCode as an OpenCode plugin + launcher; do not reintroduce GedPi shell/runtime concepts.
- Keep each slice small, testable, and committed before moving to the next slice.
- Maintain current public command/tool names and existing behavior unless hardening requires safe normalization.
- Use conventional commit messages for each slice.

## Success Criteria

- `.ged` plugin outputs are written through atomic rename helpers and preserve existing file permissions.
- Tests cover atomic write behavior and at least one representative plugin write path.
- State/session-summary/skills/standards/repo-map generated content cannot inject new top-level markdown structure through tool inputs or imported file contents.
- Launcher semver comparison passes prerelease precedence tests.
- Existing `npm run check` and `npm test` pass after each committed slice.

---

## Current Review Task — General Codebase Review

### Problem

The maintainer requested a broad repository review rather than a diff-only review: code quality, functionality, architecture, release readiness, tests, gaps, and actionable next work.

### Requested Behavior

Perform a review-only pass over the GedCode repository using project docs, standards, repo map, source files, tests, scripts, and release workflow assets. Do not implement source changes unless explicitly requested afterward.

### Success Criteria

- Identify concrete correctness, reliability, maintainability, security, release, and test-coverage concerns with file references where possible.
- Distinguish confirmed issues from speculative risks.
- Prioritize findings by severity and propose bounded follow-up slices.
- Record review progress in Omni state/session notes without committing unless explicitly requested.

---

## Current Implementation Task — Review Finding Fixes

### Problem

The general codebase review identified concrete reliability/release-readiness gaps: the planning guard can be bypassed through bash and weak `.ged` path checks, repo-map/skills helpers can damage performance or durable notes, installer verification can launch runtime setup, Windows plugin shims may emit invalid ESM imports, and release/docs/tests disagree about the artifact model.

### Requested Behavior

Implement the fixes in bounded, verified slices:

1. Harden plugin workflow behavior: detect common mutating bash commands before planning, resolve `.ged` containment instead of string-matching paths, cap repo-map file reads, and preserve user-managed `SKILLS.md` notes.
2. Harden launcher/install behavior: generate ESM-safe plugin shim imports on Windows/POSIX and add a non-launching `--check`/`--version` path for installers.
3. Align release/docs/tests: choose the current generic JS bundle model, remove misleading platform-specific artifact expectations, publish or document installers consistently, and clean stale docs.

### Constraints

- Keep GedCode as OpenCode plugin + launcher; do not add a custom shell.
- Preserve public tool/command names.
- Keep each slice independently verified and committed with a conventional commit.
- Do not weaken launcher isolation or planning-before-edit semantics.

### Success Criteria

- Tests cover bash/path guard hardening, SKILLS preservation, large repo-map file handling, Windows-safe plugin shim imports, and installer `--check` behavior.
- `npm run check` and `npm test` pass after each slice.
- Release metadata, workflow, installers, README/AGENTS/checklist describe the same current artifact model.

---

## Current Implementation Task — Automatic Grill-Me Clarification

### Problem

GedCode currently suggests brainstorming for creative work or behavior changes, but it does not explicitly force a rigorous shared-understanding checkpoint before planning and implementation. The maintainer wants the agent to automatically "grill" the user for requested changes, new features, fixes, refactors, or similar product/code modifications until the agent and user are fully aligned.

### Requested Behavior

Add a bundled `grill-me` workflow skill and route relevant change requests to it automatically through instructions and skill suggestion heuristics. The skill should interview the user one question at a time, provide a recommended answer for each question, use codebase exploration instead of asking when the answer is discoverable, and stop only when scope, constraints, behavior, edge cases, and success criteria are concrete enough to write/update `.ged/SPEC.md`, `.ged/TASKS.md`, and `.ged/TESTS.md`.

### Constraints

- Do not remove `brainstorming`; keep it for open-ended option generation.
- Preserve existing bundled skill names and public tool names.
- Keep the automatic trigger instruction practical: apply to change/feature/fix/refactor requests, not simple informational questions or explicit emergency one-liners.
- Commit after verification with a conventional commit.

### Success Criteria

- `grill-me` appears in bundled skills and default `.ged/SKILLS.md` content.
- `gedcode_suggest_skills` suggests `grill-me` for change/feature/fix/refactor requests.
- Agent instructions require a grill-me clarification checkpoint before planning/implementation for change requests.
- Tests cover skill listing/suggestion behavior.
- `npm run check` and `npm test` pass.

---

## Current Implementation Task — Enforced Skill-Fit Checkpoint

### Problem

GedCode can suggest and load skills, but the workflow does not yet enforce a deliberate skill-fit decision after clarification. The maintainer wants a dedicated checkpoint where the model judges whether available project/bundled skills cover the clarified task, uses `find-skills` when they do not, removes skills from project memory when instructed, and only loads task skills from that checkpoint onward.

### Requested Behavior

After `grill-me` and before writing final planning artifacts, GedCode must perform a skill-fit checkpoint:

1. Inventory currently available/bundled/project skills.
2. Judge whether they cover the clarified task's required domains.
3. If coverage is sufficient, load only the relevant skills and record them in `.ged/SKILLS.md`.
4. If coverage is insufficient, use `find-skills` to search for relevant external skills before planning.
5. If the user asks to delete/remove skills from the project, remove those skills from project memory instead of loading them.

### Constraints

- Keep `grill-me` as the clarification gate before this checkpoint.
- Do not load implementation/domain skills opportunistically before the checkpoint, except workflow skills needed to run the Omni process itself.
- Preserve public tool names.
- Keep `find-skills` as a bundled workflow skill/resource available to the agent.

### Success Criteria

- Agent instructions include an explicit post-grill skill-fit checkpoint.
- Bundled skills/default skill memory include `find-skills`.
- `gedcode_suggest_skills` suggests `find-skills` for skill discovery and insufficient-domain-coverage wording.
- Tests cover find-skills suggestion behavior and bundled skill updates.
- `npm run check` and `npm test` pass.

---

## Current Implementation Task — Project-Local Skill Maker

### Problem

The skill-fit checkpoint can discover missing skill coverage with `find-skills`, but it has no automatic fallback when no adequate skill exists or when an existing skill should not be installed globally. GedCode needs a workflow-native way to create narrow, reusable, project-local skills before planning and implementation.

### Requested Behavior

After `grill-me` clarification and during the skill-fit checkpoint:

1. Inventory bundled/project skills and judge coverage.
2. If coverage is insufficient, use `find-skills` to look for existing relevant skills first.
3. If no adequate existing skill is available, automatically use a new bundled `skill-maker` workflow skill.
4. `skill-maker` researches the missing expertise, preferably with a research/explore subagent when subagent-driven development is available, otherwise inline in the main agent.
5. `skill-maker` writes a narrow project-local skill under `.ged/skills/<skill-name>/SKILL.md` and records it in `.ged/SKILLS.md` so the main agent can load the needed context from the start.
6. Generated project-local skills must not be installed globally or mutate the user's global skill directories.

### Reference Model

Use Matt Pocock's `write-a-skill` skill as the primary style reference: concise SKILL.md, strong description triggers, progressive disclosure, optional scripts only for deterministic repeated work, and a lightweight review checklist. Borrow only lightweight research/testing ideas from Anthropic's `skill-creator`; do not require browser/eval-viewer loops for this automatic workflow.

### Constraints

- Keep the existing `find-skills` first; `skill-maker` is the fallback after discovery is inadequate.
- Do not ask for another approval before creating the local skill once the user has already approved automatic behavior.
- Keep generated skills project-local in `.ged/skills/`.
- Keep bundled workflow resources simple markdown files for now; no new public tool names are required for this slice.
- Preserve existing skill listing and suggestion tool compatibility.

### Success Criteria

- Bundled skills/default skill memory include `skill-maker`.
- Agent instructions document the post-find-skills automatic local-skill creation fallback.
- `find-skills` documents handing off to `skill-maker` when discovery is inadequate.
- `gedcode_suggest_skills` suggests `skill-maker` for missing/no relevant skill and skill-creation wording.
- README describes the local skill creation fallback.
- Tests cover bundled/default `skill-maker` inclusion and suggestion behavior.
- `npm run check` and `npm test` pass.

---

## Current Implementation Task — Changelog Update Discipline

### Problem

Committed changes can be easy to miss during release prep if the changelog is updated only at the end. GedCode needs a repository instruction that every committed change also updates `CHANGELOG.md` for the upcoming release.

### Requested Behavior

- Update `AGENTS.md` to state that every change intended to be committed must include an appropriate `CHANGELOG.md` entry for the next release.
- Apply the rule to this change by updating `CHANGELOG.md` in the same slice.

### Constraints

- Keep the instruction concise and located with repo hygiene / agent workflow guidance.
- Do not change release versioning in this slice.

### Success Criteria

- `AGENTS.md` clearly requires changelog updates for committed changes.
- `CHANGELOG.md` includes this documentation/process change for the next release.
- Verification passes before commit.

---

## Current Implementation Task — Collaborative Omni Memory Design

### Problem

The current root `.ged/SPEC.md`, `.ged/TASKS.md`, and `.ged/TESTS.md` model works well for solo sessions, but collaborative projects can have multiple contributors, branches, issues, and non-Omni workflows in flight at the same time. A single shared active plan can become stale or conflict-prone.

### Requested Behavior

- Produce a design document for collaboration-safe Omni memory before implementation.
- Split future memory responsibilities into stable shared project knowledge, per-work-item plans, and untracked runtime/session state.
- Default per-work-item IDs to the current git branch slug.
- Design protected-branch behavior: change requests should not implement directly on `main`/`master` by default.
- Store protected-branch behavior in effective GedCode settings JSON, with global defaults and optional project-local overrides; both scopes may explicitly allow protected-branch changes.
- Preserve backward compatibility with current root planning files for solo/existing projects until migration is implemented.

### Constraints

- This slice is design/docs only; do not implement branch detection or guard enforcement yet.
- Do not introduce committed repo policy JSON for branch overrides; settings belong to the GedCode settings JSON layer discussed for subagents/global/project overrides.
- Update `CHANGELOG.md` as part of the slice.

### Success Criteria

- A design doc describes `.ged/work/<branch-slug>/` planning, branch protection defaults, settings overrides, non-Omni contributor rehydration, and staged implementation slices.
- README/AGENTS point to the collaboration design or summarize the direction.
- CHANGELOG records the design/process update for the next release.
- Verification passes before commit.

---

## Current Implementation Task — Collaborative Workflow Implementation

### Problem

The collaboration design is documented, but GedCode still uses root planning artifacts only and does not expose or enforce feature-branch workflow policy. Implement the design in bounded slices so collaboration-safe memory works incrementally without regressing solo projects.

### Requested Behavior

Implement these slices independently, verifying and committing each one:

1. Add workflow settings primitives for protected branches, feature-branch requirement, and override visibility.
2. Add branch detection and protected-branch guard enforcement for mutating tools.
3. Add active `.ged/work/<branch-slug>/` planning directory selection helpers.
4. Update planning-artifact readiness/guard behavior to use the active work directory with root fallback.
5. Add collaboration checkpoint UX/docs so users can see branch, policy, and active work-memory status.

### Constraints

- Preserve existing root `SPEC.md`, `TASKS.md`, and `TESTS.md` compatibility until work-specific planning is ready.
- Keep settings in the GedCode settings JSON layer: global settings plus project-local override, not committed `.ged/CONFIG.md` policy.
- Allow both global and project-local settings to explicitly permit protected-branch changes.
- Keep each slice narrow and commit after verification.
- Update `CHANGELOG.md` for each committed slice.

### Success Criteria

- Tests cover settings merge/defaults/status, branch guard blocking and overrides, branch slug/work-directory selection, planning readiness with active work and root fallback, and collaboration checkpoint output.
- README/AGENTS/docs describe the implemented behavior as it lands.
- `npm run check` and `npm test` pass for each slice before commit.

---

## Current Implementation Task — Collaboration Polish Follow-Ups

### Problem

Core collaboration support is implemented, but the workflow still lacks the polish needed to make branch-based collaboration smooth end-to-end: starting work from protected branches, offering/creating PRs, migrating legacy root plans, and isolating runtime state by branch.

### Requested Behavior

Implement these follow-up slices independently, verifying and committing each one:

1. Add an explicit `gedcode_start_work` tool that creates or switches to a feature branch and initializes the active `.ged/work/<branch-slug>/` planning directory. It must refuse dirty working trees by default, show the dirty status, and propose solutions; `allowDirty` is an explicit advanced override.
2. Add workflow PR settings: `offerPrOnCompletion` default `true` and `autoCreatePrOnCompletion` default `false`. Add explicit PR creation support that can push the branch when needed and create a PR only when requested or when the auto setting is enabled by user/project settings.
3. Add a root-plan migration tool that copies non-placeholder root `.ged/SPEC.md`, `TASKS.md`, and `TESTS.md` into the active work directory, refuses overwrites unless requested, and writes migration notes.
4. Move runtime state/session summaries to branch-scoped `.ged/runtime/<branch-slug-or-root>/` paths instead of root singleton runtime files.

### Constraints

- Do not silently branch from a guard hook; branch changes happen only through explicit workflow/tooling.
- Do not auto-create PRs by default; offer PRs unless disabled by settings.
- Auto-create PR implies auto-push only when `autoCreatePrOnCompletion` is explicitly enabled.
- Do not treat `CHANGELOG.md` as an GedCode-wide rule; it remains this repository's release-note requirement.
- Keep each slice narrow and commit after verification.

### Success Criteria

- Tests cover start-work branch behavior, dirty checkout refusal/proposed fixes, PR settings and PR prerequisite helpers, root plan migration copy/overwrite behavior, and branch-scoped runtime state paths.
- README/AGENTS/design docs/CHANGELOG describe the implemented behavior as it lands.
- `npm run check` and `npm test` pass for each slice before commit.
