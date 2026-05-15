# GedPi Headless JSONL Protocol Sketch

Status: draft protocol for the next t3code/GedCode adoption spike.

## Goal

Expose just enough structured GedPi runtime behavior for a future t3code-based `GedPiDriver` to own UI workflow without scraping the terminal UI.

This protocol is intentionally small. It should prove the integration seam before we commit to a full t3code fork/import.

## Constraints

- Must preserve GedPi's single-writer model and checkpoint guards.
- Must not require GedCode/t3code to edit source files, `.ged/work/*`, or `.ged/runtime/*/checkpoints.json` directly.
- Must emit machine-readable lifecycle, message, tool, workflow, and checkpoint events.
- Must work over stdio initially: one JSON object per line.
- Must not touch t3code paths/settings; any GedCode fork uses GedCode-owned paths.

## Process shape

Add a GedPi headless mode, likely one of:

```bash
gedpi --headless-jsonl --project /path/to/project
```

or an internal script:

```bash
node packages/gedpi/bin/gedpi.js --headless-jsonl --project /path/to/project
```

Transport:

- stdin: client commands as JSONL
- stdout: server events/responses as JSONL
- stderr: human diagnostics only, not protocol

Every message has:

```ts
interface Envelope {
  id?: string;          // required for command requests, echoed in responses
  type: string;         // command/event/response discriminator
  ts?: string;          // ISO timestamp for emitted events
  sessionId?: string;
}
```

## Commands

### `session.start`

Start a GedPi session for a project.

```json
{"id":"1","type":"session.start","projectRoot":"/repo","workId":"plan-gedcode-desktop-gui"}
```

Response/events:

```json
{"id":"1","type":"response.ok","sessionId":"..."}
{"type":"session.started","sessionId":"...","projectRoot":"/repo","workId":"..."}
{"type":"workflow.state.changed","sessionId":"...","state":{...}}
```

### `prompt.submit`

Submit a user prompt into the GedPi brain.

```json
{"id":"2","type":"prompt.submit","sessionId":"...","text":"do the next task"}
```

Events:

- `message.delta`
- `message.completed`
- `tool.started`
- `tool.completed`
- `workflow.state.changed`
- `checkpoint.changed`
- `response.ok` when accepted, not necessarily when turn completes

### `prompt.cancel`

```json
{"id":"3","type":"prompt.cancel","sessionId":"..."}
```

### `workflow.plan`

Convenience command equivalent to a prompt/template for planning.

```json
{"id":"4","type":"workflow.plan","sessionId":"...","goal":"..."}
```

### `workflow.executeNextTask`

```json
{"id":"5","type":"workflow.executeNextTask","sessionId":"..."}
```

### `workflow.verify`

```json
{"id":"6","type":"workflow.verify","sessionId":"..."}
```

### `workflow.commitWhenReady`

Must go through normal guarded commit path. GedCode/t3code should never shell out directly to bypass guards.

```json
{"id":"7","type":"workflow.commitWhenReady","sessionId":"..."}
```

### `snapshot.read`

Read current project/workflow snapshot without starting an agent turn.

```json
{"id":"8","type":"snapshot.read","projectRoot":"/repo"}
```

Response:

```json
{"id":"8","type":"response.snapshot","snapshot":{...}}
```

## Events

### `session.started`

```json
{"type":"session.started","sessionId":"...","projectRoot":"/repo","workId":"..."}
```

### `session.ready`

```json
{"type":"session.ready","sessionId":"..."}
```

### `message.delta`

```json
{"type":"message.delta","sessionId":"...","role":"assistant","text":"partial text"}
```

### `message.completed`

```json
{"type":"message.completed","sessionId":"...","role":"assistant","text":"full text"}
```

### `tool.started` / `tool.completed`

```json
{"type":"tool.started","sessionId":"...","toolName":"read","summary":"Reading SPEC.md"}
{"type":"tool.completed","sessionId":"...","toolName":"read","status":"ok"}
```

### `workflow.state.changed`

Payload should be derived from `.ged/runtime/<work-id>/STATE.md`, `SESSION-SUMMARY.md`, and any in-memory phase state.

```json
{
  "type":"workflow.state.changed",
  "sessionId":"...",
  "workId":"...",
  "phase":"planning",
  "activeTask":"T3: t3code adoption spike",
  "statusSummary":"...",
  "blockers":["..."]
}
```

### `checkpoint.changed`

Payload should be the parsed shared checkpoint state or a concise projection.

```json
{
  "type":"checkpoint.changed",
  "sessionId":"...",
  "workId":"...",
  "checkpointState": {
    "schemaVersion": 3,
    "lifecycleStatus": "active",
    "classification": "non-trivial",
    "classificationReason": "...",
    "planCheckpoints": {},
    "taskCheckpoints": {}
  }
}
```

### `plan.review.requested`

```json
{"type":"plan.review.requested","sessionId":"...","workId":"...","reviewMode":"chat"}
```

### `verification.finding`

```json
{"type":"verification.finding","sessionId":"...","severity":"high","blocksCommit":true,"summary":"..."}
```

### `git.commit.ready`

```json
{"type":"git.commit.ready","sessionId":"...","workId":"...","subject":"..."}
```

### `session.error`

```json
{"type":"session.error","sessionId":"...","code":"GEDPI_RUNTIME_ERROR","message":"...","recoverable":true}
```

## Snapshot shape

A minimal snapshot should include:

```ts
interface GedHeadlessSnapshot {
  projectRoot: string;
  workId: string;
  gedInitialized: boolean;
  branch: string | null;
  durable: {
    project?: string;
    architecture?: string;
    patterns?: string;
  };
  activeWork: {
    spec?: string;
    tasks?: string;
    tests?: string;
    notes?: string;
  };
  runtime: {
    state?: string;
    sessionSummary?: string;
    checkpoints?: unknown;
    checkpointError?: string;
  };
  settings: {
    globalPath: string;
    projectPath: string;
    agentsEnabled: boolean;
    planReview: string;
    autoCommit: string;
  };
}
```

## t3code `GedPiDriver` mapping

### `startSession`

- spawn `gedpi --headless-jsonl --project <cwd>`
- send `session.start`
- map response to `ProviderSession`
- keep process handle per thread/session

### `sendTurn`

- send `prompt.submit`
- return `ProviderTurnStartResult` after command is accepted
- stream GedPi events to t3code `ProviderRuntimeEvent` stream

### `streamEvents`

- parse stdout JSONL
- map Ged events into canonical provider runtime events
- preserve Ged-specific details as provider item metadata where possible

### `snapshot`

- run a lightweight `gedpi --headless-jsonl --snapshot --project <cwd>` or spawn and send `snapshot.read`
- report unavailable if binary missing, protocol unsupported, or project inaccessible

### `textGeneration`

Initial implementation can be limited:

- branch/thread title generation can delegate to a provider configured inside the isolated GedCode fork, or return unavailable
- commit/PR generation should eventually call GedPi workflow-aware commit helpers, but not required for first snapshot spike

## First proof implementation

Smallest useful proof in this repo:

1. Add a GedPi headless module that supports `snapshot.read` only.
2. Add CLI flag `--headless-jsonl --project <path>`.
3. Reuse existing pure readers where possible:
   - work-id/paths
   - `.ged` state files
   - shared checkpoint parser
   - `.gedoc` settings readers
4. Add tests for JSONL command parsing and snapshot response.

Smallest useful proof in t3code fork:

1. Add `GedPiSettings` schema.
2. Add `GedPiDriver` to `BUILT_IN_DRIVERS`.
3. Add provider client definition using existing Pi Agent icon.
4. Implement snapshot probe only.
5. Show a GedPi provider instance as available/unavailable in settings UI.

## Open questions

- Should the protocol be GedPi-specific first, or a generic Ged protocol shared by GedPi and GedOC?
- Should GedPi headless mode be packaged in `gedpi` or a separate `@ged/headless` helper?
- How should t3code's runtime modes map to Ged's checkpoint guard policy?
- Should `.gedoc/settings.json` remain the source of Ged subagent settings, or should t3code/GedCode store provider config separately and sync into `.gedoc` on demand?

## Recommendation

Build the snapshot-only headless proof first. Do not attempt prompt submission until the provider can reliably show Ged project/workflow/settings state inside t3code without touching the user's existing t3code data.
