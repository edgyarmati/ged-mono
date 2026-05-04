# Release Checklist

Runbook for cutting a tagged GedCode release from the monorepo. Work top-to-bottom; each section is a gate for the next.

## Pre-release

- [ ] all tests pass: `npm -w packages/gedcode test`
- [ ] type check passes: `npm -w packages/gedcode run check`
- [ ] local bundle builds cleanly: `cd packages/gedcode && bash scripts/release/bundle.sh`

## Version bump

- [ ] run `npm -w packages/gedcode run sync-version` (or `node packages/gedcode/scripts/sync-version.mjs`)
- [ ] commit: `chore: bump gedcode version to X.Y.Z`

## Tag and push

- [ ] `git tag gedcode-vX.Y.Z`
- [ ] `git push origin main --tags`

## Verify CI

- [ ] release workflow completes (single job: build-and-release)
- [ ] release assets exist on the `gedcode-vX.Y.Z` release:
  - `gedcode-X.Y.Z.tar.gz`
  - `SHA256SUMS`
  - `install.sh`
  - `install.ps1`

## Post-release smoke test

- [ ] macOS / Linux:
  ```sh
  GEDCODE_VERSION=X.Y.Z bash packages/gedcode/install.sh
  gedcode
  ```
- [ ] Windows (PowerShell):
  ```powershell
  $env:GEDCODE_VERSION = 'X.Y.Z'; irm https://github.com/edgyarmati/ged-mono/releases/latest/download/install.ps1 | iex
  gedcode
  ```
- [ ] verify managed OpenCode runtime installs and launches on first run
- [ ] verify plugin loads (agent name is `gedcode`, commands and tools register)
- [ ] verify normal global `opencode` is unaffected
