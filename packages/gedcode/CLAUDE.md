# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

GedCode is an **OpenCode plugin + launcher**. OpenCode owns the UX and runtime; GedCode owns the **workflow layer** (`.ged/` durable memory, plan-before-edit, bounded slices, post-implementation verification).

It is **not** a custom terminal UI, a fork of OpenCode, or a continuation of the old GedPi standalone shell. Do not drift back into building a custom shell. Keep the launcher thin and the plugin thick.

## Packages (npm workspaces, Node 22+, ESM, TS strict)

- `packages/plugin` → `@gedcode/plugin` — registers the GedCode agent, commands, and tools; bootstraps `.ged/`; guards `write`/`edit`.
- `packages/launcher` → `gedcode` — wrapper CLI that installs/manages an isolated OpenCode runtime under `~/.config/gedcode/` and launches it with GedCode env overrides. Must not mutate the user's normal OpenCode setup.

## Build / verify

From repo root, before any commit:

```bash
npm run check   # tsc --noEmit across all workspaces
npm test        # node --test across all workspaces
```

Contributor bootstrap (one-time): `./scripts/setup`. Release artifacts: `bash ./scripts/release/bundle.sh` (driven by `.github/workflows/release.yml` on `v*` tags).

## Workflow rules (these mirror `packages/plugin/src/resources/instructions/gedcode-agent.md` — follow them when working on this repo)

- **Plan before editing source.** Before editing any source file, `.ged/SPEC.md`, `.ged/TASKS.md`, and `.ged/TESTS.md` must contain real planning content (the plugin's write/edit guard enforces this at runtime; placeholder bootstrap content is rejected).
- **Update `.ged/` first**, not transient chat context. Reflect the current understanding in `.ged/` before implementing.
- **Bounded slices.** Implement one slice from `.ged/TASKS.md` at a time; verify; record progress in `.ged/STATE.md` and `.ged/SESSION-SUMMARY.md`; commit; then move on.
- **Conventional commits — always.** Every commit message must start with one of: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `ci:`, `build:`, `perf:`. The summary must be specific, not generic. A PreToolUse hook in `.claude/settings.json` rejects non-conforming `git commit -m` calls.
- **Verify before committing.** Run `npm run check && npm test` (or invoke the `/verify` skill) and ensure both pass before any `git commit`.
- **Use the existing commands** rather than improvising:
  - `/commit` — commit the current slice
  - `/push` — push with non-destructive recovery (see `packages/plugin/src/resources/commands/push.md`)
- **Keep changes narrow and verifiable.** No drive-by refactors.

## `.ged/` memory model (repo hygiene)

Durable (committed) — reflect real project intent:
`PROJECT.md`, `SPEC.md`, `TASKS.md`, `TESTS.md`, `DECISIONS.md`, `STANDARDS.md`, `SKILLS.md`, `CONFIG.md`, `VERSION`, `.gitignore`.

Runtime/generated (gitignored, do not commit):
`STATE.md`, `SESSION-SUMMARY.md`, `REPO-MAP.md`, `REPO-MAP.json`. The `.pi/` directory is also runtime-only.

## Gotchas

- **Launcher isolation must be preserved.** The launcher sets `XDG_CONFIG_HOME=~/.config/gedcode` and writes config under `~/.config/gedcode/opencode/`. Do not write to the user's regular OpenCode config dir.
- **No formatter / linter is configured.** `tsc` strict mode + `node --test` are the quality gates. Do not introduce prettier/eslint/biome without discussion.
- **RTK** transparently rewrites bash command output for token savings when installed; nothing to do — it works automatically.

## Read first when in doubt

- `AGENTS.md` (canonical agent brief; `.ged/STANDARDS.md` mirrors it)
- `packages/plugin/src/resources/instructions/gedcode-agent.md` (full workflow rules)
- `README.md`, `docs/2026-04-24-gedcode-design.md`, `docs/implementation-plan.md`, `docs/release-checklist.md`
