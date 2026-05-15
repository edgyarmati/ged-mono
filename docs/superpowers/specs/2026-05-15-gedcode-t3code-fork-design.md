# GedCode: t3code Fork with Full Interactive GedPi

## Overview

GedCode is a GitHub fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code) that adds GedPi as a fully interactive provider alongside Claude, Codex, Cursor, and OpenCode. It replaces the custom Electron dashboard prototype in `packages/gedcode/` with t3code's production-grade multi-provider GUI.

## Decision Context

- The original plan was to build a desktop GUI from scratch (`packages/gedcode/`), but that drifted into a vanilla HTML/JS dashboard with no resemblance to t3code's architecture.
- A spike proved t3code can be forked, isolated (branding, paths, env vars), and extended with a GedPi snapshot driver. See `docs/plans/gedcode-t3code-spike-report.md` and related proof docs.
- This design codifies the course correction: fork t3code properly, make GedPi fully interactive, keep the t3code look and feel.

## Repository Setup

### Fork Strategy

GitHub fork of `pingdotgg/t3code` → `edgyarmati/gedcode` on GitHub.

**Branch strategy:**
- `main` — tracks upstream `pingdotgg/t3code:main`, synced periodically via merge
- `gedcode` — default/primary branch with all GedCode-specific changes
- Feature branches off `gedcode` for new work

**Initial setup sequence:**
1. Fork `pingdotgg/t3code` on GitHub
2. Clone locally
3. Set default branch to `gedcode`
4. Apply the two isolation patches from the scratch checkout (`/tmp/pi-github-repos/pingdotgg/t3code/`)
5. Apply the existing GedPi snapshot driver commit
6. Extend the driver to full interactivity

### Relationship to ged-mono

GedCode lives in its own repo. The bridge between the two repos is the headless-jsonl protocol:
- **ged-mono** owns GedPi and the headless-jsonl protocol implementation (`packages/gedpi/bin/headless-jsonl.js`)
- **gedcode** owns the GedPi driver that speaks that protocol (`apps/server/src/provider/Drivers/GedPiDriver.ts`)

During development, GedCode's `binaryPath` setting points at `../ged-mono/packages/gedpi/bin/gedpi.js`. For releases, GedPi is installed globally via npm (`gedpi`) and the default `binaryPath: "gedpi"` resolves from PATH.

## Headless JSONL Protocol Extensions

The protocol is the contract between GedCode and GedPi. Transport: stdin/stdout JSONL over a long-lived child process spawned as `gedpi --headless-jsonl --project <path>`.

### Existing (keep as-is)

| Direction | Type | Purpose |
|-----------|------|---------|
| GedCode → GedPi | `snapshot.read` | Read `.ged/` project state |
| GedPi → GedCode | `response.snapshot` | Snapshot payload |

### New Commands (GedCode → GedPi)

| Type | Payload | Purpose |
|------|---------|---------|
| `session.start` | `{ threadId, cwd?, modelSelection?, approvalPolicy?, runtimeMode }` | Start a new agent session |
| `turn.send` | `{ threadId, input?, attachments?, modelSelection?, interactionMode? }` | Send user input to active session |
| `turn.interrupt` | `{ threadId, turnId? }` | Cancel the active turn |
| `session.stop` | `{ threadId }` | End session gracefully |
| `request.respond` | `{ threadId, requestId, decision }` | Answer an approval/confirmation request |
| `user-input.respond` | `{ threadId, requestId, answers }` | Answer a user-input request |
| `thread.read` | `{ threadId }` | Get snapshot of current thread (turns, items) |

### New Events (GedPi → GedCode)

| Type | Payload | Purpose |
|------|---------|---------|
| `event.session.started` | `{ threadId, session }` | Session is ready |
| `event.session.state.changed` | `{ threadId, status, model?, error? }` | Session status update |
| `event.session.exited` | `{ threadId }` | Session ended |
| `event.turn.started` | `{ threadId, turnId }` | Turn processing began |
| `event.turn.completed` | `{ threadId, turnId, state, stopReason?, usage? }` | Turn finished |
| `event.content.delta` | `{ threadId, turnId, streamKind, delta }` | Streaming text chunk |
| `event.item.started` | `{ threadId, turnId, itemId, itemType, title? }` | Tool call / file edit started |
| `event.item.updated` | `{ threadId, turnId, itemId, status?, detail? }` | Item progress |
| `event.item.completed` | `{ threadId, turnId, itemId, status }` | Item finished |
| `event.request.opened` | `{ threadId, requestId, requestType, detail?, args? }` | Approval needed |
| `event.request.resolved` | `{ threadId, requestId }` | Approval resolved |

`streamKind` values: `"assistant_text"`, `"reasoning_text"`, `"command_output"`, `"file_change_output"`.

**Key principle:** GedPi translates its internal brain events to t3code's canonical `ProviderRuntimeEvent` shape. The driver passes them through with minimal transformation.

## GedPi Driver Implementation

### Process Lifecycle

- `create()` spawns `gedpi --headless-jsonl --project <projectRoot>` once per provider instance
- The child process stays alive for the instance lifetime (managed by Effect `Scope`)
- stdin writes commands, stdout streams events — same process, bidirectional

### Adapter (ProviderAdapterShape)

- Maintains `Map<ThreadId, GedPiSession>` for active sessions
- `startSession` → sends `session.start`, waits for `event.session.started`, returns `ProviderSession`
- `sendTurn` → sends `turn.send`, returns `ProviderTurnStartResult` from `event.turn.started`
- `interruptTurn` → sends `turn.interrupt`
- `stopSession` → sends `session.stop`, removes from session map
- `respondToRequest` → sends `request.respond` with the approval decision
- `respondToUserInput` → sends `user-input.respond` with answers
- `readThread` → sends `thread.read`, returns `ProviderThreadSnapshot`
- `listSessions` → returns entries from the in-memory session map
- `hasSession` → checks the session map
- `rollbackThread` → unsupported initially (return error)
- `stopAll` → sends `session.stop` for all active sessions
- `streamEvents` → parses stdout JSONL into `Stream<ProviderRuntimeEvent>`

### Snapshot (ServerProviderShape)

- Keeps existing `snapshot.read` probe
- Reports real model listing from GedPi's configured models
- Auth status reflects whether GedPi has valid API keys

### Capabilities

- `sessionModelSwitch: "unsupported"` — GedPi's brain picks the model
- `supportsMultipleInstances: false` — single instance per project

### Text Generation

- Returns `TextGenerationError` directing users to configure another provider (Claude, Codex) for commit messages, PR content, branch names, and thread titles
- t3code's settings UI already supports picking a different provider for text generation

### Config Schema (GedPiSettings)

```typescript
{
  binaryPath: string    // default: "gedpi"
  projectRoot: string   // default: "" (uses server's project)
  enabled: boolean      // default: true
}
```

## Branding & Isolation

### Changes from t3code

| Surface | t3code | GedCode |
|---------|--------|---------|
| Product name | t3 code | GedCode |
| Config directory | `~/.t3/` | `~/.gedcode/` |
| Environment prefix | `T3CODE_*` | `GEDCODE_*` |
| Window title | t3 code | GedCode |
| Auto-updater | pingdotgg releases | user's GitHub releases |
| Default provider order | Claude first | GedPi first |

### What stays t3code-flavored

- Entire UI look and feel — colors, layout, components, animations
- All existing providers work unchanged
- Build tooling (Bun, Turbo, Vite)
- Internal package names (not published to npm)

### Isolation guarantee

Running GedCode never reads or writes `~/.t3/`. Both apps can coexist on the same machine. Already proven by the two isolation patches in the scratch checkout.

## Cleanup in ged-mono

### Remove

- `packages/gedcode/` — entire custom Electron dashboard (superseded)

### Keep

- `packages/gedpi/bin/headless-jsonl.js` — GedPi's protocol implementation
- `packages/gedpi/bin/headless-jsonl.d.ts` — type declarations
- `packages/gedpi/tests/headless-jsonl.test.ts` — protocol tests
- `docs/plans/` — decision trail

### New work in ged-mono

- Extend `headless-jsonl.js` with the new message types
- Add tests for each protocol command
- Wire GedPi's brain events into the JSONL event stream

### New work in gedcode repo

- Extend `GedPiDriver.ts` to full interactivity
- Apply branding changes
- Set up CI/release pipeline for desktop builds

## Testing Strategy

### Protocol tests (ged-mono)

- Each new JSONL command gets a round-trip test
- Vitest, same as existing `headless-jsonl.test.ts`
- Mock GedPi brain internals, verify JSONL output shape matches t3code's canonical events

### Driver tests (gedcode repo)

- Vitest, same as t3code's existing test setup
- Mock the child process stdin/stdout
- Verify the driver correctly maps JSONL events to `ProviderRuntimeEvent`
- Verify session lifecycle (start → turn → interrupt → stop)

### Integration testing

- Manual: launch GedCode desktop, select GedPi provider, start a session, send a turn, verify streaming output
- Later: automated E2E with Playwright against the web app

## Out of Scope

- Custom GedCode app icon (use t3code's initially)
- GedPi-native text generation (delegate to other providers)
- `rollbackThread` support
- Multiple GedPi instances
- Contributing the GedPi driver upstream to pingdotgg/t3code
