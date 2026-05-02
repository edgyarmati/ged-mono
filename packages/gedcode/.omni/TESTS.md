# Tests

## Checks

- [x] `npm run check` after each implementation slice
- [x] `npm test` after each implementation slice
- [x] Atomic helper preserves permissions on replacement
- [x] Representative plugin `.ged` write uses atomic helper successfully
- [x] Sanitizers collapse unsafe multi-line markdown/tool text into safe generated output
- [x] Standards import handles embedded code fences/headings without breaking output structure
- [x] Launcher semver comparison handles stable vs prerelease and prerelease identifier ordering

## Expected outcomes

- Existing behavior remains compatible for normal inputs.
- Hardening tests fail on the old direct/unsafe behavior and pass after the backport.
- No source slice is committed until check and test pass.

---

## Current Review Task Verification

- [x] `npm run check` result observed: passed.
- [x] `npm test` result observed: passed, 29 tests.
- [x] Review covers the plugin, launcher, tests, scripts/installers, release workflow, and docs at a high level.
- [x] Findings are prioritized and include actionable next steps.

---

## Review Finding Fixes Verification

- [x] Slice 1: plugin tests cover bash mutation rejection before planning and resolved `.ged` containment.
- [x] Slice 1: plugin tests cover SKILLS user notes preservation and large repo-map file truncation/skipping.
- [x] Slice 2: launcher tests cover `--check`/`--version` non-launching behavior and Windows-safe shim imports.
- [x] Slice 3: launcher/docs tests cover generic release artifact naming and installer publication/documentation consistency.
- [x] Run `npm run check` and `npm test` after each slice before committing.

---

## Automatic Grill-Me Clarification Verification

- [x] `gedcode_list_skills`/skill listing includes `grill-me`.
- [x] `suggestSkills` returns `grill-me` for a representative feature/change/fix request.
- [x] Agent instruction resource documents the automatic grill-me checkpoint and one-question-at-a-time behavior.
- [x] `npm run check` passes.
- [x] `npm test` passes.

---

## Enforced Skill-Fit Checkpoint Verification

- [x] `find-skills` appears in bundled skill resources and generated SKILLS content.
- [x] `suggestSkills` returns `find-skills` for skill discovery / missing-skill requests.
- [x] Agent instructions document the post-grill coverage judgment and skill-loading boundary.
- [x] `npm run check` passes.
- [x] `npm test` passes.

---

## Project-Local Skill Maker Verification

- [x] `gedcode_list_skills`/skill listing includes `skill-maker`.
- [x] Generated/default `.ged/SKILLS.md` bundled list includes `skill-maker`.
- [x] `suggestSkills` returns `skill-maker` for missing/no-relevant-skill and create/write-skill requests.
- [x] Agent instructions document `find-skills` before automatic project-local `skill-maker` fallback.
- [x] README documents that generated missing skills are project-local under `.ged/skills/` and not global.
- [x] `npm run check` passes.
- [x] `npm test` passes.

---

## Changelog Update Discipline Verification

- [x] `AGENTS.md` requires updating `CHANGELOG.md` for every committed change.
- [x] `CHANGELOG.md` records this process/documentation update for the next release.
- [x] `npm run check` passes.
- [x] `npm test` passes.

---

## Collaborative Omni Memory Design Verification

- [x] Design doc covers shared memory, per-work-item plans, runtime state, branch slug defaults, protected-branch settings, and non-Omni contributors.
- [x] README/AGENTS reference or summarize the collaborative memory direction.
- [x] CHANGELOG records the collaboration design update.
- [x] `npm run check` passes.
- [x] `npm test` passes.

---

## Collaborative Workflow Implementation Verification

- [x] Slice 1: tests cover workflow settings defaults, global/project merge, invalid fallback, and status visibility.
- [x] Slice 2: tests cover protected branch blocking for mutating tools and global/project override behavior.
- [x] Slice 3: tests cover branch slug generation and active work planning path selection.
- [x] Slice 4: tests cover active work planning readiness, root fallback, and guard messaging.
- [x] Slice 5: tests/docs cover collaboration checkpoint output.
- [x] Run `npm run check` and `npm test` after each slice.

---

## Collaboration Polish Follow-Ups Verification

- [x] Slice 1: tests cover branch name validation, dirty status refusal/proposed solutions, existing branch switch, and new branch creation helper behavior.
- [x] Slice 2: tests cover PR settings defaults/overrides, PR prerequisite summaries, and PR body generation without requiring GitHub network access.
- [x] Slice 3: tests cover root plan copy, placeholder refusal, overwrite refusal, overwrite success, and migration notes.
- [x] Slice 4: tests cover branch-scoped state/session paths, no-branch root runtime fallback, gitignore update, and compaction/read behavior.
- [x] Run `npm run check` and `npm test` after each slice.
