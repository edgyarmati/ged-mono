# Release Checklist

Runbook for cutting a tagged GedOC release from the monorepo. Work top-to-bottom; each section is a gate for the next.

## Pre-release

- [ ] all tests pass: `npm -w packages/gedoc test`
- [ ] type check passes: `npm -w packages/gedoc run check`
- [ ] local bundle builds cleanly: `cd packages/gedoc && bash scripts/release/bundle.sh`

## Version bump

- [ ] run `npm -w packages/gedoc run sync-version` (or `node packages/gedoc/scripts/sync-version.mjs`)
- [ ] commit: `chore: bump gedoc version to X.Y.Z`

## Tag and push

- [ ] `git tag gedoc-vX.Y.Z`
- [ ] `git push origin main --tags`

## Verify CI

- [ ] release workflow completes (single job: build-and-release)
- [ ] release assets exist on the `gedoc-vX.Y.Z` release:
  - `gedoc-X.Y.Z.tar.gz`
  - `SHA256SUMS`
  - `install.sh`
  - `install.ps1`

## Post-release smoke test

- [ ] macOS / Linux:
  ```sh
  GEDOC_VERSION=X.Y.Z bash packages/gedoc/install.sh
  gedoc
  ```
- [ ] Windows (PowerShell):
  ```powershell
  $env:GEDOC_VERSION = 'X.Y.Z'; irm https://github.com/edgyarmati/ged-mono/releases/latest/download/install.ps1 | iex
  gedoc
  ```
- [ ] verify managed OpenCode runtime installs and launches on first run
- [ ] verify plugin loads (agent name is `gedoc`, commands and tools register)
- [ ] verify normal global `opencode` is unaffected
