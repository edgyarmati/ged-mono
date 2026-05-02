# GedCode Release Setup Design

> Status: Historical design record (2026-04-24). This documents the original npx-bootstrap design; the release path has since moved to a single JS bundle + platform-agnostic installers (`install.sh` / `install.ps1` at the repo root). For the current install and release flow see [`README.md`](../README.md) and [`docs/release-checklist.md`](./release-checklist.md).

## Goal

Ship a release-ready install path so a new user can run one setup command, then run `gedcode` and reach a working GedCode/OpenCode session with minimal manual steps.

## Problem

GedCode already has a working launcher and plugin, but the current onboarding flow is still contributor-oriented:

- users need the repo or workspace context
- there is no clear release installer story
- there is no single documented setup path that ends with `gedcode` being available on `PATH`

For a real release, GedCode needs a simple installation experience that matches the product boundary:

- OpenCode remains the host runtime
- GedCode remains the workflow layer
- the launcher stays thin
- setup gets the user to a working `gedcode` command quickly

## Primary User Experience

### Recommended path

Users should be able to run:

```bash
curl -fsSL https://raw.githubusercontent.com/edgyarmati/gedcode/main/scripts/install.sh | bash
gedcode
```

The installer should delegate to:

```bash
npx gedcode@latest setup
```

### Fallback paths

Users should also be able to run:

```bash
npx gedcode@latest setup
gedcode
```

or:

```bash
npm install -g gedcode@latest
gedcode
```

### Contributor/dev path

Contributors and pre-release testers should be able to run:

```bash
git clone https://github.com/edgyarmati/gedcode
cd gedcode
./scripts/setup
gedcode
```

## Recommended Approach

Use a **thin remote installer + npx bootstrap + npm fallback**.

### Why this approach

- gives GedCode a polished one-command headline install
- uses `npx` for the one-time bootstrap step, which matches the setup mental model better than making global install the primary entrypoint
- keeps distribution concerns separate from runtime concerns
- preserves the current thin-launcher / thick-plugin architecture
- avoids turning GedCode into a full machine bootstrapper
- keeps OpenCode as the host product rather than something GedCode replaces

### Rejected alternatives

#### Fat installer that owns everything

Rejected for v1 because it would try to install and configure too much: Node, OpenCode, GedCode, provider auth, and system state. That is brittle and crosses the product boundary.

#### npm-only with no installer script

Viable as a fallback, but not the best release UX. It should exist, but not be the only documented path.

## System Design

### 1. Release package path

GedCode must be installable as a package that exposes an `gedcode` binary.

Requirements:

- package metadata must support global installation
- the launcher package must expose the `gedcode` bin cleanly
- the install path must not depend on the monorepo checkout after installation
- published artifacts must include the built launcher and plugin resources needed at runtime

### 2. Remote installer script

Add `scripts/install.sh` as the public one-command installer.

Responsibilities:

- verify `node` is available and meets the minimum supported version
- verify `npm` and `npx` are available
- delegate to `npx gedcode@latest setup`
- print clear next steps and actionable troubleshooting if verification fails

Non-responsibilities:

- do not install Node automatically in v1
- do not configure model/provider credentials
- do not mutate the user’s normal OpenCode config
- do not replace launcher-owned runtime setup behavior

### 3. CLI setup subcommand

Add a real `setup` subcommand to the published `gedcode` CLI.

Responsibilities:

- validate Node/npm prerequisites
- install `gedcode` globally so the steady-state `gedcode` command exists after bootstrap
- verify `gedcode` is available, or report the exact npm global bin path to add to `PATH`
- print the next step to start GedCode

This is the core one-time bootstrap path used by direct `npx` installs and by the curl installer.

### 4. Repo-local setup script

Add `scripts/setup` for contributors and local release testing.

Responsibilities:

- install workspace dependencies
- build the workspaces
- link the local launcher so `gedcode` is immediately runnable
- verify the launcher command is available
- print the next step to start GedCode

This script is for local setup and smoke-testing, not the public release UX.

### 5. Launcher runtime responsibility

The `gedcode` launcher should continue to own runtime setup on first launch.

It should keep doing the following:

- create isolated config under `~/.config/gedcode/opencode`
- write the plugin shim
- write `opencode.json`
- detect whether `opencode` is installed
- attempt best-effort OpenCode installation if missing
- launch OpenCode with GedCode-specific environment variables

This preserves a clean separation:

- installer = distribution/setup
- launcher = runtime bootstrap

## Component Changes

### `scripts/install.sh`

Expected flow:

1. detect platform assumptions for POSIX shell execution
2. check `node --version`
3. fail with a friendly message if Node is missing or too old
4. check `npm --version`
5. install GedCode globally from npm
6. verify `gedcode` is on `PATH`
7. print success message and tell the user to run `gedcode`

### `scripts/setup`

Expected flow:

1. run from repo root
2. install dependencies with npm
3. build all workspaces
4. optionally run lightweight verification such as `npm run check` or targeted launcher verification if fast enough
5. print next steps for local linking and usage

### package metadata

Expected changes:

- ensure the installable package name and `bin` mapping support the public install story
- ensure the package contents include built artifacts
- ensure local and published install paths resolve the plugin correctly

### README release section

Expected documentation:

- one-command install
- npm fallback install
- contributor setup
- troubleshooting for missing Node, missing `gedcode` on `PATH`, and first-run OpenCode install behavior

## Error Handling

### Installer failures

The installer should fail fast with clear messages for:

- missing `node`
- unsupported Node version
- missing `npm`
- npm global install failure
- `gedcode` not found after installation

Each message should include the next manual step.

### First-run launcher failures

The installer does not need to solve runtime launch failures directly, but docs should explain:

- GedCode may install OpenCode on first run if it is missing
- if that step fails, the launcher prints a manual OpenCode install command

## Testing Strategy

### Automated

Add coverage for:

- setup/install helper logic where practical
- version parsing or prerequisite validation helpers if factored into code
- package/bin assumptions that support the install flow
- existing launcher tests must remain green

### Manual smoke tests

Before release, verify:

1. repo-local setup works on a clean checkout
2. `./scripts/setup` leaves a runnable local `gedcode` command
3. installer script succeeds on a machine with Node/npm already present
4. first `gedcode` launch creates isolated config automatically
5. first `gedcode` launch handles missing OpenCode via best-effort install

## Non-goals

Not included in this slice:

- Homebrew, apt, scoop, or native package manager distribution
- automatic Node installation
- automatic provider auth/login
- GUI installer packaging
- broad cross-platform system bootstrap beyond shell + npm

## Success Criteria

A new user can:

1. run one install command
2. type `gedcode`
3. have GedCode set up its isolated OpenCode config automatically
4. have OpenCode installed automatically if missing, or receive a clear manual fallback
5. reach a working GedCode session without editing config files manually
