# Tasks

## Planned slices

- [x] Slice 1: add shared atomic write helper and route generated `.ged` / launcher metadata writes through it
- [x] Slice 2: sanitize generated markdown/state/session-summary/skills/standards/repo-map fragments and add regression tests
- [x] Slice 3: harden launcher semver comparison for prerelease/build metadata and add tests
- [x] Slice 4: evaluate and apply a bounded repo-map hardening/performance improvement if still separate from Slice 1

## Notes

- Commit each verified slice before starting the next one.
- Prefer narrow backports that match GedCode's simpler architecture rather than copying GedPi internals wholesale.

---

## Current Review Task

- [x] Define review scope and success criteria.
- [x] Inspect repository structure, standards, and project docs.
- [x] Review plugin workflow implementation and tests.
- [x] Review launcher/runtime/install/release implementation and tests.
- [x] Assess cross-cutting quality, functionality gaps, risks, and missing tests.
- [x] Summarize prioritized findings and recommended next slices.

---

## Review Finding Fixes

- [x] Slice 1: harden plugin guard/path containment, preserve skills notes, and cap repo-map reads.
- [x] Slice 2: add safe launcher check/version behavior and Windows-safe plugin shim imports.
- [x] Slice 3: align release artifact model, docs, workflow assets, and tests.

---

## Automatic Grill-Me Clarification

- [x] Add bundled `grill-me` skill resource and default skills listing.
- [x] Update agent instructions so change requests automatically run grill-me clarification before planning/implementation.
- [x] Update skill suggestion heuristics and tests so `grill-me` triggers on feature/change/fix/refactor wording.
- [x] Update README/AGENTS docs for the new clarification checkpoint.
- [x] Verify with `npm run check` and `npm test`, then commit.

---

## Enforced Skill-Fit Checkpoint

- [x] Add bundled `find-skills` skill resource and default skills listing.
- [x] Update agent instructions so the post-grill step judges skill coverage before planning.
- [x] Document that task/domain skills are only loaded during the checkpoint, not opportunistically earlier.
- [x] Support remove/delete-skill instructions by documenting project memory cleanup in `.ged/SKILLS.md`.
- [x] Update suggestion heuristics/tests/docs for `find-skills`.
- [x] Verify with `npm run check` and `npm test`, then commit.

---

## Project-Local Skill Maker

- [x] Slice 1: add bundled `skill-maker`, update skill-fit instructions/docs/default skill memory/suggestion heuristics, add tests, verify, and commit.

---

## Changelog Update Discipline

- [x] Slice 1: document the changelog-update requirement in `AGENTS.md`, update `CHANGELOG.md`, verify, and commit.

---

## Collaborative Omni Memory Design

- [x] Slice 1: document collaboration-safe memory design, update README/AGENTS/CHANGELOG, verify, and commit.

---

## Collaborative Workflow Implementation

- [x] Slice 1: add workflow settings primitives and status visibility, verify, and commit.
- [x] Slice 2: add branch detection plus protected-branch mutating-tool guard, verify, and commit.
- [x] Slice 3: add active `.ged/work/<branch-slug>/` planning directory selection helpers, verify, and commit.
- [x] Slice 4: update planning-artifact guard to accept active work planning with root fallback, verify, and commit.
- [x] Slice 5: add collaboration checkpoint UX/docs, verify, and commit.

---

## Collaboration Polish Follow-Ups

- [x] Slice 1: add explicit `gedcode_start_work` branch workflow tool, dirty checkout guidance, tests, docs, verify, and commit.
- [x] Slice 2: add PR offer/auto settings and explicit PR creation support, tests, docs, verify, and commit.
- [x] Slice 3: add root planning migration tool, tests, docs, verify, and commit.
- [x] Slice 4: move runtime state/session summaries to branch-scoped `.ged/runtime/<id>/`, tests, docs, verify, and commit.
