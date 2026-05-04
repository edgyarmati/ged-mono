# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

Two packages, one mission — both bring the Omni workflow (interview → plan → implement → verify) to coding agents:

- **GedCode** (`packages/gedcode/`) — OpenCode plugin + launcher. Constrained by what OpenCode's plugin API offers. Uses npm workspaces with nested `packages/plugin/` and `packages/launcher/`.
- **GedPi** (`packages/gedpi/`) — Batteries-included Pi package. More customizable. **Not an npm workspace** — run with `npm --prefix packages/gedpi`.

## Feature Parity Principle

When a feature or design decision is made in one package, document it for the other. Both packages should converge on the same workflow concepts, even if implementations differ. The memory system (`.ged/` files) must work interchangeably — changes to memory format in one package must be reflected in the other.

## Commands

```bash
# Root — runs across both packages
npm run build          # Build all workspaces
npm run check          # TypeScript type-check both packages
npm test               # Run all tests
npm run verify         # Full quality gate (check + test)

# GedPi-specific (not a workspace, use --prefix)
npm --prefix packages/gedpi run lint      # Biome check
npm --prefix packages/gedpi run format    # Biome auto-fix
npm --prefix packages/gedpi run verify    # check + lint + test + pack:check
npm --prefix packages/gedpi run chat      # Launch locally

# GedCode-specific
npm -w packages/gedcode run build
npm -w packages/gedcode run check
npm -w packages/gedcode test
```

## Conventions

- **Node.js 22+** required (checked at runtime)
- **ESM only** — no CommonJS in `src/` or `bin/`
- **Conventional commits** — `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `ci:`, `build:`, `perf:`
- **TypeScript strict** in both packages
- **Biome** for GedPi formatting/linting (2-space indent, double quotes)
- **Launcher isolation** (GedCode) — launcher uses `XDG_CONFIG_HOME=~/.config/gedcode`, never mutates user's normal OpenCode config

## Testing

- GedCode: Node.js built-in test runner (`node --test`)
- GedPi: Vitest (`npm --prefix packages/gedpi test`)

## Package-Specific Guidance

Each package has its own detailed docs — read them when working in that package:
- @packages/gedcode/CLAUDE.md
- @packages/gedcode/AGENTS.md
- @packages/gedpi/AGENTS.md (canonical source of truth for GedPi)

## Releases

Packages release independently with separate tag prefixes:

- **GedPi**: `gedpi-v*` tags → npm publish (`gedpi`) + GitHub release
- **GedCode**: `gedcode-v*` tags → tarball + installers + GitHub release

Both packages use `CHANGELOG.md` with `## Unreleased` at the top. Every user-facing change must add an entry under `## Unreleased` before committing. On release, rename to `## X.Y.Z - YYYY-MM-DD` and add a fresh `## Unreleased`.

See each package's `AGENTS.md` for the full release runbook.
