# GedCode Implementation Plan

> Status: Phases 1–3 complete. This file is the historical phase log; active follow-up work lives in [AGENTS.md](../AGENTS.md#known-gaps--next-work) and the [release checklist](./release-checklist.md).

## Phase 1 — Core baseline

- [x] create nested standalone repo
- [x] write design doc
- [x] scaffold plugin package
- [x] scaffold launcher package
- [x] install dependencies and type-check
- [x] verify launcher-generated config flow
- [x] smoke-test plugin loading in OpenCode
- [x] harden `.ged` lifecycle, mode state, and durable/runtime policy

## Phase 2 — Release setup

- [x] add a repo-local `scripts/setup` bootstrap for contributors and pre-release testing
- [x] add a public `scripts/install.sh` installer for one-command release onboarding
- [x] adjust package metadata and packaging files for public installability
- [x] document release install, fallback install, and troubleshooting in `README.md`
- [x] add tests for setup/install support logic and package assumptions
- [x] verify `./scripts/setup`, `npm run check`, `npm run build`, and `npm test`

## Phase 3 — Native launcher foundation

- [x] define release metadata for GedCode binaries and compatible OpenCode runtime targets
- [x] add per-user managed-runtime path resolution and OpenCode version metadata helpers
- [x] add macOS/Linux `install.sh` and Windows `install.ps1` installer scaffolding around release artifacts
- [x] refactor launcher runtime logic so it can target a managed OpenCode binary path instead of only PATH lookup
- [x] add tests for platform detection, install-target resolution, and managed runtime reuse/upgrade checks
- [x] document the native-launcher architecture and release flow in `README.md`
- [x] verify `npm run check`, `npm run build`, and `npm test`

## Verified

- launcher-generated config loads only the GedCode plugin when started through `gedcode`
- OpenCode resolves `default_agent: gedcode`
- GedCode commands and tools are registered in a real OpenCode runtime
- end-to-end run succeeded: bootstrap → guard blocks early write → planning files updated → write succeeds
- standards import works in a live run and writes `.ged/STANDARDS.md`
- ranked repo map output works in a live run and writes `.ged/REPO-MAP.md` plus `.ged/REPO-MAP.json`
- skill suggestion/sync works in a live run and writes `.ged/SKILLS.md`
- automated tests cover launcher config isolation, release setup assets/package assumptions, Node-version prerequisite helpers, standards discovery/import, repo map generation, skill suggestion, lifecycle updates, and planning-artifact guard readiness

## Next slices after native-launcher foundation

1. Run the first tagged release through `.github/workflows/release.yml` and validate all published artifacts/installers end-to-end.
2. Implement upstream OpenCode download/integrity verification against live release artifacts (current runtime acquisition uses managed npm-prefix install).
3. Add end-to-end installer smoke tests across macOS/Linux/Windows runners.
4. Improve standards-import selection UX beyond import-all or explicit paths.
