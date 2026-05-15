# GedCode t3code Adoption Plan

Status: approved strategic direction for the next GedCode GUI investment.

## Decision

Pivot GedCode's long-term GUI foundation toward a **t3code adoption/fork spike** instead of continuing to grow the clean-room Electron shell first.

The current `packages/gedcode` scaffold remains useful as a small read-only proof and fallback, but the next meaningful work should validate whether t3code can become the foundation for GedCode.

## Why t3code

`t3code` is MIT licensed and already solves many hard problems GedCode would otherwise need to build:

- desktop + web + server architecture
- Electron desktop wrapper
- fast React UI
- typed IPC and WebSocket RPC
- provider/driver architecture for multiple harnesses
- event-sourced orchestration model
- SQLite persistence
- settings surfaces
- remote/SSH/Tailscale environment concepts
- release and auto-update infrastructure
- existing providers for Codex, Claude, Cursor, and OpenCode

Most importantly, t3code's model makes the UI/server own workflow orchestration while agent harnesses become providers/adapters. That aligns with the long-term goal of GedCode becoming harness-agnostic rather than only a GedPi terminal replacement.

## Product direction

GedCode should become a workflow UI that can eventually drive multiple Ged-compatible runtimes:

- GedPi provider
- GedOC/OpenCode provider
- possibly Claude/Codex providers through t3code's existing architecture

The UI should expose difficult Ged settings and workflow controls directly:

- subagent enablement
- per-role model settings for `ged-explorer`, `ged-planner`, `ged-verifier`
- plan-review preference
- auto-commit preference
- checkpoint bypass visibility
- `.ged` work state and blockers
- verification/commit readiness

## Adoption spike goals

The spike should answer whether we can responsibly base GedCode on t3code.

### Must prove

1. **Build/run**
   - t3code builds locally in our environment.
   - desktop app or server+web mode runs enough to inspect behavior.

2. **Architecture fit**
   - Identify where a `GedProviderDriver` would live.
   - Identify where Ged workflow commands/events would map into t3code orchestration.
   - Identify where settings UI/state should incorporate `.gedoc/settings.json`.

3. **Ged integration seam**
   - Prove a minimal Ged project can appear as a project/session/environment.
   - Decide whether GedPi should be wrapped through:
     - headless JSONL/IPC mode,
     - PTY/terminal adapter,
     - ACP provider,
     - or a new Ged-specific provider protocol.

4. **Rebrand/ownership cost**
   - Estimate effort to rebrand t3code to GedCode.
   - Identify package/env/config paths that must change.
   - Decide whether to preserve upstream package boundaries or collapse into this monorepo.

5. **Settings UI opportunity**
   - Locate t3code settings surfaces.
   - Sketch UI additions for Ged subagent model settings and preferences.

## Non-goals for the spike

- Do not fully import t3code into this repo yet.
- Do not replace the current `packages/gedcode` scaffold until the spike decision is made.
- Do not implement full Ged workflow orchestration.
- Do not ship a release.

## Possible outcomes

### Outcome A: Full fork/adopt

Bring t3code into GedCode as the primary app foundation, then add Ged providers and rebrand.

Use this if:
- build/run is healthy,
- provider architecture accepts Ged cleanly,
- rebrand cost is manageable,
- UI settings/orchestration are reusable.

### Outcome B: Selective extraction

Copy/adapt only architecture patterns or packages, such as provider drivers, typed contracts, desktop IPC, or settings UI.

Use this if:
- full repo is too heavy,
- Effect/Bun/Turborepo cost is too high,
- but specific pieces are clearly valuable.

### Outcome C: Continue clean-room GedCode

Keep the current Electron scaffold and use t3code only as reference.

Use this if:
- adaptation complexity outweighs reuse,
- runtime assumptions clash with Ged,
- or upstream architecture is too expensive to own.

## Recommended spike tasks

1. Clone or add t3code as an external scratch checkout; keep it out of committed source initially.
2. Run its documented setup/build/test path.
3. Write an architecture map:
   - provider driver files
   - orchestration command/event files
   - settings UI/state files
   - desktop IPC files
   - release config files
4. Draft a `GedProviderDriver` design.
5. Draft a Ged settings UI design.
6. Produce a go/no-go recommendation with estimated migration phases.

## Acceptance criteria

- A written spike report exists under `docs/plans/`.
- It includes evidence from actual t3code files and commands.
- It recommends full fork, selective extraction, or clean-room continuation.
- It identifies concrete first implementation tasks for the chosen path.
