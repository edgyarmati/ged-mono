# Tasks

## Planned slices

- [x] Slice 1: add `tdd` bundled skill, active `TESTS.md` guidance, suggestion heuristics, docs, tests, verify, and commit.
- [x] Slice 2: add `diagnose` bundled skill, bug/performance routing, docs, tests, verify, and commit.
- [x] Slice 3: add `grill-with-docs` bundled skill as enhanced clarification variant, docs, tests, verify, and commit.
- [x] Slice 4: add `improve-codebase-architecture` bundled skill plus slash command, docs, tests, verify, and commit.

## Notes

- Keep each workflow resource concise and GedCode-native.
- Do not create hard tool-level TDD/diagnose guards in this pass.
- `TESTS.md` means the active planning directory's tests artifact, usually `.ged/work/<branch-slug>/TESTS.md`, with root `.ged/TESTS.md` only as migration fallback.

---

## OpenCode Target Version Update

- [x] Slice 5: update managed OpenCode target to `1.14.30`, adjust tests/docs/changelog if needed, verify, and commit.

---

## Main Subagent Workflow Integration

- [x] Slice 6: merge `origin/main` into `feat/collaboration-polish`, resolve conflicts, verify, and commit merge.

---

## Single-Writer Intelligence Orchestration

- [x] Slice 7: policy/docs/tests only — reframe native subagent orchestration around single-writer ownership, read-only discovery/planning/verification, smart-friend guidance, clean-context review before commit, and no writer-subagent path.
- [x] Slice 8: add `/clean-context-review` workflow command, update commit/docs/tests/changelog, verify, clean-review, and commit.
- [x] Slice 9: document the current orchestration model for maintainers and future users, verify, clean-review, and commit.
- [x] Slice 10: remove the legacy writer subagent and all writer-subagent roadmap references from code, docs, settings schema, tests, and skills.

---

## Per-Agent Passthrough Provider Options

- [x] Slice 11: extend settings types with per-agent `options`, update parse/normalize/buildSubagentConfig, update tool schemas and output, add tests, update CHANGELOG, verify, clean-review, and commit.
- [x] Slice 12: tighten enabled-subagent checkpoint guidance, make `/ged-agents` setup preserve exact model IDs/object configs, improve status output, add tests, verify, clean-review, and commit.
