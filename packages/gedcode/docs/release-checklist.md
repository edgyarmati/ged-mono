# Release Checklist

Runbook for cutting a tagged GedCode release. Work top-to-bottom; each section is a gate for the next.

## Pre-release

- [ ] all tests pass: `npm test`
- [ ] type check passes: `npm run check`
- [ ] local bundle builds cleanly: `bash scripts/release/bundle.sh`

## Version bump

- [ ] update `GEDCODE_BINARY_VERSION` in `packages/launcher/src/release.js`
- [ ] update `version` in `package.json`
- [ ] update `version` in `packages/launcher/package.json`
- [ ] update `version` in `packages/plugin/package.json`
- [ ] update `VERSION` default in `install.sh` and `install.ps1`
- [ ] commit: `chore: bump version to X.Y.Z`

## Tag and push

- [ ] `git tag vX.Y.Z`
- [ ] `git push origin main --tags`

## Verify CI

- [ ] release workflow completes (single job: build-and-release)
- [ ] release assets exist:
  - `gedcode-X.Y.Z.tar.gz`
  - `SHA256SUMS`
  - `install.sh`
  - `install.ps1`

## Post-release smoke test

- [ ] macOS / Linux:
  ```sh
  GEDCODE_VERSION=X.Y.Z bash install.sh
  gedcode
  ```
- [ ] Windows (PowerShell):
  ```powershell
  $env:GEDCODE_VERSION = 'X.Y.Z'; irm https://github.com/edgyarmati/gedcode/releases/latest/download/install.ps1 | iex
  gedcode
  ```
- [ ] verify managed OpenCode runtime installs and launches on first run
- [ ] verify plugin loads (agent name is `gedcode`, commands and tools register)
- [ ] verify normal global `opencode` is unaffected
