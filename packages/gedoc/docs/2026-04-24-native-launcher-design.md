# GedOC Native Launcher Design

> Status: Historical design record (2026-04-24). Foundation implemented; native binary distribution is the active direction (see [`docs/release-checklist.md`](./release-checklist.md)). For current launcher behavior see [`README.md`](../README.md) and [`AGENTS.md`](../AGENTS.md).

## Goal

Ship GedOC as a standalone cross-platform launcher binary with polished installers, while keeping OpenCode as the upstream host runtime that GedOC acquires and orchestrates rather than owns.

## Problem

The npm/npx-based setup flow is too fragile and too dependent on Node package execution semantics:

- `curl | bash` is only a thin wrapper around `npx`
- Windows is not a first-class install target in that model
- setup failures are tied to npm package publishing and executable resolution details
- end users still effectively need a Node-centric environment just to get started

GedOC needs a more product-like installation story for macOS, Linux, and Windows.

## Product Boundary

GedOC should **not** become a fork or bundled distribution of OpenCode.

Instead:

- GedOC owns the installer, launcher, workflow layer, `.ged/` memory, and runtime orchestration
- OpenCode remains the upstream host app/runtime
- GedOC acquires a compatible upstream OpenCode release when needed
- GedOC does not mutate or depend on the user’s normal global `opencode` installation by default

This preserves the boundary:

- **GedOC** = productized workflow launcher
- **OpenCode** = upstream conversational host runtime

## Version Policy

### OpenCode compatibility model

GedOC uses a **pinned default, optional upgrade** policy.

That means:

- each GedOC release declares a tested default OpenCode version or version range
- GedOC installs that compatible version into an GedOC-managed user-level location
- if the managed OpenCode runtime is missing or older than required, GedOC upgrades it
- advanced/manual upgrades can happen later, but the default path is the tested version

### Runtime ownership

GedOC should manage **one per-user OpenCode runtime**, not one per project.

Reasons:

- simpler mental model
- easier support and debugging
- less duplication on disk
- fewer downloads
- more consistent behavior across projects

### Relationship to user-installed OpenCode

By default:

- GedOC should **not** overwrite the user’s normal/global `opencode`
- GedOC should **not** automatically prefer a newer system `opencode`
- GedOC should use its own managed OpenCode runtime

This avoids ambiguity and protects the user’s normal OpenCode usage from GedOC-specific compatibility decisions.

## Primary User Experience

### macOS/Linux

Users should be able to run:

```bash
curl -fsSL https://raw.githubusercontent.com/edgyarmati/gedoc/main/install.sh | bash
gedoc
```

### Windows

Users should be able to run a PowerShell installer such as:

```powershell
irm https://raw.githubusercontent.com/edgyarmati/gedoc/main/install.ps1 | iex
gedoc
```

### First run

On first launch, `gedoc` should:

1. check for an GedOC-managed OpenCode runtime
2. install or upgrade that runtime if needed
3. write GedOC-specific isolated OpenCode config/plugin wiring
4. launch the managed OpenCode runtime

## Recommended Approach

Use a **native/self-contained GedOC launcher binary** plus **platform-specific installers**.

### Why this approach

- removes end-user dependency on Node/npm/npx for installation
- gives Windows a first-class install path
- keeps GedOC responsible for setup/orchestration, not OpenCode internals
- produces a more stable, supportable release channel
- avoids the fragility of npm executable resolution during bootstrap

### Rejected alternatives

#### Keep npm/npx as the primary install path

Rejected because it is too fragile, too Node-centric, and not a clean cross-platform product install story.

#### Bundle OpenCode inside GedOC releases

Rejected because it would make GedOC responsible for distributing and effectively maintaining an OpenCode payload rather than orchestrating upstream releases.

#### Fork OpenCode

Explicitly rejected. It breaks the product boundary and creates long-term maintenance burden.

## System Design

### 1. GedOC launcher binary

Ship `gedoc` as a standalone binary for supported platforms.

Responsibilities:

- implement the GedOC launcher behavior without requiring a user-managed Node install
- know the current compatible OpenCode version target
- acquire/install/update the managed OpenCode runtime when needed
- prepare isolated GedOC config/plugin state
- launch the managed OpenCode process with the right environment

### 2. Managed OpenCode runtime

GedOC keeps a per-user managed OpenCode runtime in an GedOC-owned location.

Suggested shape:

- user-scoped data/cache directory
- versioned OpenCode runtime subdirectories
- current-version marker or metadata file

Responsibilities:

- store the tested OpenCode version GedOC wants to use
- support install, upgrade, and integrity checks
- stay separate from the user’s normal global `opencode`

### 3. Installers

Provide platform-native installers:

- `install.sh` for macOS/Linux
- `install.ps1` for Windows

Installer responsibilities:

- detect platform/architecture
- download the appropriate GedOC launcher binary from release artifacts
- place it in a user-appropriate install location
- ensure it is invokable as `gedoc`
- print clear next steps and PATH guidance if needed

Installer non-responsibilities:

- do not install provider credentials
- do not rewrite the user’s global OpenCode config
- do not bundle or patch OpenCode source

### 4. OpenCode acquisition

The launcher must acquire official upstream OpenCode releases, not a fork.

Responsibilities:

- know where to fetch official compatible OpenCode artifacts
- install the tested default version when missing
- upgrade the managed runtime when it is older than the required version
- optionally allow future manual upgrades without changing the default compatibility model

### 5. Isolated configuration

The launcher should continue using isolated GedOC config state, conceptually similar to the current config model:

- GedOC-owned config root
- GedOC-owned plugin/config wiring
- environment overrides only inside `gedoc` launches

This ensures normal `opencode` remains untouched.

## Components

### Release artifacts

Expected artifacts per release:

- macOS arm64 GedOC binary
- macOS x64 GedOC binary
- Linux x64 GedOC binary
- Linux arm64 GedOC binary
- Windows x64 GedOC binary
- install scripts (`install.sh`, `install.ps1`)
- release metadata describing the compatible OpenCode version target

### Installer scripts

#### `install.sh`

Expected flow:

1. detect OS and architecture
2. download the matching GedOC binary
3. install it into a user-level bin location
4. print PATH instructions if needed
5. verify `gedoc --help`

#### `install.ps1`

Expected flow:

1. detect OS and architecture
2. download the matching GedOC binary
3. install it into a user-level location on Windows
4. ensure the launcher location is on PATH or print instructions
5. verify `gedoc --help`

### Launcher runtime flow

Expected flow inside `gedoc`:

1. resolve the user-scoped GedOC home/config/runtime directories
2. read GedOC release metadata for the compatible OpenCode version target
3. inspect the currently managed OpenCode runtime
4. install or upgrade OpenCode if missing or too old
5. write GedOC-specific config/plugin shim files
6. launch the managed OpenCode runtime with GedOC environment overrides

## Error Handling

### Installer failures

Installer errors should be explicit and actionable:

- unsupported platform/architecture
- failed download
- checksum/integrity failure if implemented
- no writable install location
- PATH not updated or binary not discoverable

### Launcher failures

Launcher errors should cover:

- failed OpenCode download/acquisition
- incompatible or corrupted managed runtime
- config/bootstrap write failures
- managed OpenCode launch failure

Each should include the exact file path or artifact involved when possible.

## Testing Strategy

### Automated

Add coverage for:

- platform/architecture detection logic
- install-path selection logic
- version comparison logic for managed OpenCode runtime
- release metadata parsing
- managed runtime path resolution
- existing launcher/config tests adapted to the native launcher architecture

### Manual smoke tests

Before release, verify:

1. macOS install via `install.sh`
2. Linux install via `install.sh`
3. Windows install via `install.ps1`
4. first-run OpenCode acquisition works on a clean machine
5. repeat runs reuse the managed runtime when already compatible
6. managed runtime upgrades when the required version target increases
7. normal user-installed `opencode` remains untouched

## Non-goals

Not included in the first native-launcher slice:

- bundling OpenCode into GedOC release artifacts
- forking OpenCode
- per-project OpenCode runtime overrides
- provider credential automation
- system package manager support like Homebrew/apt/scoop in the first slice

## Success Criteria

A new user can:

1. install GedOC on macOS, Linux, or Windows with a platform-native installer
2. run `gedoc` without needing Node/npm/npx installed first
3. have GedOC acquire and manage one compatible OpenCode runtime per user
4. have normal `opencode` remain untouched
5. reach a working GedOC session through the managed OpenCode runtime
