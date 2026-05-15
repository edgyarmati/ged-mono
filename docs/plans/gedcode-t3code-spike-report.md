# GedCode t3code Adoption Spike Report

Status: initial spike evidence complete. Recommendation: continue investing in t3code adoption; do not import yet.

## Summary

`t3code` is a strong strategic candidate for GedCode's long-term GUI foundation. It is MIT licensed, builds locally, runs a server locally, and already has the hard architecture GedCode wants: provider drivers, typed contracts, event-sourced orchestration, desktop/web/server modes, and settings UI patterns.

The current clean-room `packages/gedcode` Electron app should remain as a fallback/prototype. The main next investment should be a focused `GedProviderDriver` design and protocol spike against t3code's provider system.

## Local build/run evidence

Scratch checkout:

- `/tmp/pi-github-repos/pingdotgg/t3code`

Commands run:

```bash
bun install
bun run build:contracts
bun run build:desktop
timeout 20s bun run start > /tmp/t3code-start.log 2>&1 || true
```

Results:

- `bun install` succeeded with Bun `1.3.11` and patched TypeScript through `effect-language-service patch`.
- `bun run build:desktop` succeeded. It built:
  - `@t3tools/desktop` via `tsdown`
  - `@t3tools/web` via Vite
  - `t3` CLI bundle via `scripts/cli.ts build`
- `bun run start` launched the server and ran migrations successfully.
- Server listened on `http://0.0.0.0:3773` and emitted a pairing URL:
  - `http://localhost:3773/pair#token=...`

Notable runtime logs:

- migrations ran successfully through migration `30_ProjectionThreadShellArchiveIndexes`
- provider status cache warnings were non-fatal
- authentication/pairing is required by default

## Architecture evidence

### Provider driver seam

Key file:

- `/tmp/pi-github-repos/pingdotgg/t3code/apps/server/src/provider/ProviderDriver.ts`

`t3code` defines `ProviderDriver<Config, R>` as a plain value with:

- `driverKind`
- `metadata`
- `configSchema`
- `defaultConfig()`
- `create(input)` returning a scoped `ProviderInstance`

A `ProviderInstance` bundles:

- `snapshot`
- `adapter`
- `textGeneration`
- identity/display fields

This is the right seam for Ged. A future `GedDriver` or `GedPiDriver` can wrap GedPi as a provider instance without making the UI know GedPi internals.

Existing examples:

- `/tmp/pi-github-repos/pingdotgg/t3code/apps/server/src/provider/Drivers/OpenCodeDriver.ts`
- `/tmp/pi-github-repos/pingdotgg/t3code/apps/server/src/provider/Drivers/ClaudeDriver.ts`

The OpenCode driver is particularly relevant because it already wraps a coding-agent runtime and handles process/server status, adapter, and text generation.

### Open provider kind model

Key file:

- `/tmp/pi-github-repos/pingdotgg/t3code/packages/contracts/src/providerInstance.ts`

Important design:

- `ProviderDriverKind` is an open branded slug, not a closed enum.
- Unknown providers are expected and should degrade to unavailable snapshots rather than crashing.
- `ProviderInstanceConfig` stores opaque driver-specific config.
- `ProviderInstanceConfigMap` supports multiple provider instances.

This is excellent for Ged because we can add `ged`, `gedpi`, or `gedoc` providers without fighting closed contract types.

### Orchestration model

Key file:

- `/tmp/pi-github-repos/pingdotgg/t3code/packages/contracts/src/orchestration.ts`

Relevant concepts:

- `ORCHESTRATION_WS_METHODS`
- `ModelSelection`
- `RuntimeMode`: `approval-required`, `auto-accept-edits`, `full-access`
- `ProviderApprovalPolicy`
- `ProviderSandboxMode`
- project/thread/session/message/turn schemas
- proposed plan schemas

Ged's workflow maps well:

- interview/clarification → thread/user questions + proposed plan
- planning → proposed plan / plan interaction mode
- implementation → provider turns with runtime mode and approval policy
- verification → event/projection/checkpoint-style state
- `.ged/work/<work-id>` → project/thread metadata or Ged-specific projection

### Settings UI seam

Key files:

- `/tmp/pi-github-repos/pingdotgg/t3code/apps/web/src/components/settings/ProviderSettingsForm.tsx`
- `/tmp/pi-github-repos/pingdotgg/t3code/apps/web/src/components/settings/SettingsPanels.tsx`
- `/tmp/pi-github-repos/pingdotgg/t3code/apps/web/src/hooks/useSettings.ts`

`ProviderSettingsForm` derives settings fields from provider config schemas and annotations. This is directly useful for Ged settings.

Ged settings UI should expose:

- provider instance for GedPi/GedOC
- subagent enabled flag
- default model
- `ged-explorer`, `ged-planner`, `ged-verifier` model configs
- plan review preference: off/chat/plannotator
- auto-commit preference: ask/always/never
- checkpoint bypass visibility, likely disabled by default

### Desktop IPC seam

Key file:

- `/tmp/pi-github-repos/pingdotgg/t3code/apps/desktop/src/ipc/DesktopIpc.ts`

`t3code` uses typed, schema-validated IPC helpers around Electron IPC. This is better than the ad-hoc preload IPC in the clean-room prototype and should be reused if we adopt t3code.

### Desktop/server/web shape

Important directories:

- `/tmp/pi-github-repos/pingdotgg/t3code/apps/desktop`
- `/tmp/pi-github-repos/pingdotgg/t3code/apps/server`
- `/tmp/pi-github-repos/pingdotgg/t3code/apps/web`
- `/tmp/pi-github-repos/pingdotgg/t3code/packages/contracts`
- `/tmp/pi-github-repos/pingdotgg/t3code/packages/shared`
- `/tmp/pi-github-repos/pingdotgg/t3code/packages/effect-acp`

This shape supports desktop, local server, hosted/remote web, and typed shared contracts from one codebase.

## GedProviderDriver design sketch

### Driver kind

Start with one driver kind:

- `gedpi`

Potential later drivers:

- `gedoc` for OpenCode-hosted Ged workflow
- `ged` for a harness-neutral headless protocol

### Config schema fields

Initial config should include:

- `binaryPath?: string` — path to `gedpi` binary/entrypoint
- `projectRoot?: string` or environment-bound cwd
- `settingsScope?: "global" | "project"`
- `enableSubagents?: boolean`
- `defaultModel?: string`
- role model fields:
  - `explorerModel?: string`
  - `plannerModel?: string`
  - `verifierModel?: string`
- `planReview?: "off" | "chat" | "plannotator"`
- `autoCommit?: "ask" | "always" | "never"`
- `protocol?: "headless-jsonl" | "pty" | "terminal"`

### Snapshot

Provider snapshot should report:

- GedPi installed / missing
- version if available via `gedpi --version`
- project `.ged` present/missing
- settings path(s)
- whether subagents are enabled
- whether current work has valid checkpoints

### Adapter

Best long-term adapter: **headless JSONL/IPC** from GedPi.

Fallbacks:

1. PTY bridge into current GedPi TUI
2. terminal-only embedded runtime while t3code UI shows state
3. Ged-specific provider protocol if ACP does not fit

### Text generation

Ged's provider may not need generic text generation at first. If the interface requires it, implement a constrained text-generation shape that routes through GedPi only for workflow-aware prompts or returns unavailable until a headless protocol exists.

## Protocol choice

Recommendation: invest in a **Ged headless JSONL protocol** rather than trying to make PTY the primary strategy.

Reasons:

- t3code's server/provider architecture is already typed/event-driven.
- Ged workflows need structured events: classification, explorer/planner/verifier checkpoints, blockers, verification findings.
- PTY can work as fallback but will be brittle and hard to test.
- ACP is attractive, but Ged-specific workflow state is richer than generic agent chat. ACP may still be useful as an interoperability layer later.

Minimum headless events:

- `session.started`
- `session.ready`
- `message.delta`
- `tool.started`
- `tool.completed`
- `workflow.state.changed`
- `checkpoint.changed`
- `plan.review.requested`
- `verification.finding`
- `git.commit.ready`
- `session.error`

Minimum commands:

- `session.start`
- `prompt.submit`
- `prompt.cancel`
- `workflow.plan`
- `workflow.executeNextTask`
- `workflow.verify`
- `workflow.commitWhenReady`
- `settings.update`

## Adoption options

### Option A — Full fork/adopt

Pros:

- fastest path to professional harness-agnostic app
- keeps desktop/web/server architecture intact
- reuses settings, provider, orchestration, remote, release infrastructure

Cons:

- imports a large Bun/Turborepo/Effect codebase
- significant rebrand/package ownership work
- Ged needs a real provider protocol to feel native

### Option B — Strategic fork branch outside this monorepo first

Pros:

- lets us experiment with adding `GedPiDriver` without destabilizing `ged-mono`
- preserves upstream history
- easier to assess rebrand and dependency cost

Cons:

- two repos temporarily
- integration with existing packages delayed

### Option C — Selective extraction

Pros:

- less code to own
- can keep current npm monorepo simpler

Cons:

- loses much of what makes t3code valuable
- likely reimplements server/orchestration/web pieces anyway

## Hard isolation requirement

If we build from or fork t3code, GedCode must use **GedCode-owned settings, cache, database, runtime, and config paths from the first commit**. It must not read from, write to, migrate, or mutate the user's existing t3code setup unless the user explicitly opts into an import later.

Required path/identity changes before any real local use:

- app name and identity: GedCode, not T3 Code
- home/config/data root: `~/.gedcode` or platform equivalent GedCode app data, not `~/.t3`
- env vars: `GEDCODE_*`, not `T3CODE_*`
- desktop app userData/appId/protocol names: GedCode-owned values
- SQLite database/cache/provider-status paths: GedCode-owned paths
- settings files: GedCode-owned settings, with `.gedoc/settings.json` used only for Ged/GedPi workflow settings where intentionally integrated
- release/update channels and artifact names: GedCode-owned values

This is a safety requirement because the user actively uses t3code. The adoption spike may inspect t3code, but a runnable GedCode fork must be isolated before it is launched against real projects.

## Recommendation

Choose **Option B now**, with intent to move to **Option A** if the provider spike succeeds.

Do not import t3code into `ged-mono` yet. Instead:

1. Keep a clean scratch/fork checkout of t3code.
2. Prototype a `GedPiDriver` in that architecture.
3. In parallel, design a small GedPi headless JSONL mode.
4. Once a GedPi provider can show project/workflow state and accept a prompt, decide whether to bring the fork into `packages/gedcode` or make GedCode its own repository/package lineage.

## Concrete next tasks

1. Create a t3code fork branch or worktree for `GedPiDriver` experimentation.
2. Map exact adapter interfaces in `apps/server/src/provider/Services/ProviderAdapter.ts` and the OpenCode adapter implementation.
3. Draft GedPi headless JSONL protocol in this repo.
4. Add a tiny GedPi headless proof command that can emit version/project/checkpoint state as JSONL.
5. Implement a minimal t3code `gedpi` provider snapshot against that proof command.
6. Reassess full fork after snapshot + one prompt round-trip.

## Go/no-go

Current status: **Go for deeper adoption spike.**

Do not fully fork into GedCode yet. The build/run and architecture fit are strong enough to justify the next spike: `GedPiDriver` + GedPi headless protocol proof.
