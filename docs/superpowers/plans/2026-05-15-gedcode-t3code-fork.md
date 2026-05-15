# GedCode t3code Fork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork t3code as `edgyarmati/gedcode` on GitHub, apply existing isolation + GedPi patches, extend GedPi from snapshot-only to fully interactive, and clean up the superseded `packages/gedcode/` from ged-mono.

**Architecture:** Two repos with a JSONL protocol bridge. The `gedcode` repo (t3code fork) owns the GUI, provider system, and GedPi driver. The `ged-mono` repo owns GedPi and the headless-jsonl protocol that the driver speaks. GedPi's brain is stateless prompt-building on top of the Pi runtime (`@earendil-works/pi-coding-agent`), so the headless bridge spawns Pi as a subprocess with structured I/O rather than reimplementing the turn loop.

**Tech Stack:** TypeScript, Effect (gedcode), Bun/Turbo (gedcode build), Vitest (both repos), Node.js 22+ (ged-mono), React 19 + Vite + Tailwind (gedcode web UI)

**Spec:** `docs/superpowers/specs/2026-05-15-gedcode-t3code-fork-design.md`

---

## File Structure

### gedcode repo (t3code fork) — modified files

| File | Responsibility |
|------|---------------|
| `apps/server/src/provider/Drivers/GedPiDriver.ts` | Full interactive driver replacing snapshot-only stubs |
| `apps/server/src/provider/Drivers/GedPiAdapter.ts` | New: ProviderAdapterShape implementation for GedPi |
| `apps/server/src/provider/Drivers/GedPiJsonlTransport.ts` | New: stdin/stdout JSONL message transport layer |
| `apps/server/src/provider/builtInDrivers.ts` | Already has GedPi registered (no change needed) |
| `packages/contracts/src/settings.ts` | Already has GedPiSettings (no change needed) |
| `apps/web/src/components/settings/providerDriverMeta.ts` | Update badge from "Snapshot" to remove it |

### ged-mono repo — modified files

| File | Responsibility |
|------|---------------|
| `packages/gedpi/bin/headless-jsonl.js` | Extend with session/turn/event commands |
| `packages/gedpi/bin/headless-jsonl.d.ts` | Update type declarations for new exports |
| `packages/gedpi/tests/headless-jsonl.test.ts` | Add tests for each new protocol command |
| `packages/gedpi/bin/gedpi.js` | Wire headless-jsonl interactive mode |

### ged-mono repo — removed files

| File | Reason |
|------|--------|
| `packages/gedcode/` (entire directory) | Superseded by t3code fork |

---

## Phase A: Fork & Branding (gedcode repo)

### Task 1: Fork t3code on GitHub

**Files:** None (GitHub web UI + git CLI)

- [ ] **Step 1: Fork the repo**

Go to `https://github.com/pingdotgg/t3code` and click "Fork". Set:
- Owner: `edgyarmati`
- Repository name: `gedcode`
- Copy the `main` branch only: **yes**

- [ ] **Step 2: Clone locally**

```bash
cd ~/personal
git clone git@github.com:edgyarmati/gedcode.git
cd gedcode
```

- [ ] **Step 3: Add upstream remote**

```bash
git remote add upstream https://github.com/pingdotgg/t3code.git
git fetch upstream
```

- [ ] **Step 4: Verify remotes**

Run: `git remote -v`
Expected:
```
origin    git@github.com:edgyarmati/gedcode.git (fetch)
origin    git@github.com:edgyarmati/gedcode.git (push)
upstream  https://github.com/pingdotgg/t3code.git (fetch)
upstream  https://github.com/pingdotgg/t3code.git (push)
```

- [ ] **Step 5: Commit**

No commit needed — this is fork setup.

---

### Task 2: Create gedcode branch and apply isolation patches

**Files:** ~80 files across the repo (already patched in scratch checkout)

The scratch checkout at `/tmp/pi-github-repos/pingdotgg/t3code/` has three commits on top of upstream. We need to cherry-pick them onto a `gedcode` branch.

- [ ] **Step 1: Identify the patch commits**

```bash
git -C /tmp/pi-github-repos/pingdotgg/t3code log --oneline -5
```

Expected output shows three GedCode-specific commits (isolation, driver, branding). Note their SHAs.

- [ ] **Step 2: Create gedcode branch**

```bash
cd ~/personal/gedcode
git checkout -b gedcode main
```

- [ ] **Step 3: Generate and apply patches**

```bash
git -C /tmp/pi-github-repos/pingdotgg/t3code format-patch -3 HEAD --stdout > /tmp/gedcode-patches.mbox
cd ~/personal/gedcode
git am /tmp/gedcode-patches.mbox
```

If the patches don't apply cleanly (upstream may have moved), use `git am --3way` and resolve conflicts.

- [ ] **Step 4: Verify the patches applied**

```bash
git log --oneline -5
```

Expected: three GedCode-specific commits on top of upstream's HEAD.

- [ ] **Step 5: Push gedcode branch**

```bash
git push -u origin gedcode
```

- [ ] **Step 6: Set gedcode as default branch**

On GitHub: Settings → Default branch → change to `gedcode`.

---

### Task 3: Verify fork builds and runs

**Files:** None (build verification only)

- [ ] **Step 1: Install dependencies**

```bash
cd ~/personal/gedcode
bun install
```

- [ ] **Step 2: Run type check**

```bash
bun typecheck
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
bun run test
```

Expected: all existing tests pass.

- [ ] **Step 4: Run dev server**

```bash
npm run dev:server
```

Expected: server starts on `http://0.0.0.0:3773`. Open in browser. Verify:
- UI loads with "GedCode" title (not "t3 code")
- Provider settings page shows GedPi with "Snapshot" badge
- Claude/Codex/Cursor/OpenCode providers still appear

- [ ] **Step 5: Stop dev server and commit**

No commit needed — this is verification only.

---

## Phase B: ged-mono Cleanup

### Task 4: Remove superseded packages/gedcode/

**Files:**
- Remove: `packages/gedcode/` (entire directory)
- Modify: `package.json` (root, if it references gedcode workspace)
- Modify: `.github/workflows/ci.yml` (remove verify-gedcode job)

- [ ] **Step 1: Check if root package.json references gedcode**

```bash
grep -n "gedcode" package.json
```

- [ ] **Step 2: Remove the package directory**

```bash
rm -rf packages/gedcode
```

- [ ] **Step 3: Remove gedcode from root package.json workspaces (if present)**

Check the `workspaces` array in `/Users/edgy/personal/ged-mono/package.json` and remove any `packages/gedcode` entry.

- [ ] **Step 4: Remove verify-gedcode CI job**

In `.github/workflows/ci.yml`, remove the `verify-gedcode` job and any references to it.

- [ ] **Step 5: Verify remaining packages still build**

```bash
npm run check
npm test
```

Expected: both pass (gedoc + gedpi unaffected).

- [ ] **Step 6: Commit**

```bash
git add -A packages/gedcode package.json .github/workflows/ci.yml package-lock.json
git commit -m "chore: remove packages/gedcode (superseded by t3code fork edgyarmati/gedcode)"
```

---

## Phase C: Headless JSONL Protocol Extension (ged-mono)

### Task 5: Spike — Pi programmatic/headless session API

**Files:** None (exploration only)

Before implementing the interactive protocol, we need to determine how to spawn Pi programmatically with structured I/O. GedPi's brain (`src/brain.ts`) is stateless prompt-building; the Pi runtime (`@earendil-works/pi-coding-agent`) owns session and turn management.

- [ ] **Step 1: Check if Pi supports non-TTY mode**

```bash
cd /Users/edgy/personal/ged-mono/packages/gedpi
node -e "const p = require.resolve('@earendil-works/pi-coding-agent/dist/cli.js'); console.log(p)"
```

Read the Pi CLI entry point to see if it detects `process.stdout.isTTY` and supports a non-interactive/structured output mode.

- [ ] **Step 2: Check Pi for programmatic API exports**

```bash
grep -r "export.*createSession\|export.*startSession\|export.*Agent\|module.exports" node_modules/@earendil-works/pi-coding-agent/dist/ --include="*.js" -l | head -10
```

Look for any exported functions that allow creating sessions programmatically (not just CLI).

- [ ] **Step 3: Check Pi for JSON/structured output flags**

```bash
node node_modules/@earendil-works/pi-coding-agent/dist/cli.js --help 2>&1 | head -30
```

Look for flags like `--json`, `--headless`, `--output-format`, `--no-tui`, or similar.

- [ ] **Step 4: Document findings**

Record what Pi exposes in a short note. The outcome determines the implementation approach for Tasks 6-10:

- **If Pi has a programmatic API:** Import it directly in headless-jsonl.js
- **If Pi has a headless/JSON CLI flag:** Spawn Pi subprocess with that flag, parse structured output
- **If Pi only supports TUI:** Spawn Pi subprocess with piped stdio, use ANSI stripping + heuristic parsing (last resort)
- **If none of the above work:** Build a minimal turn loop in headless-jsonl.js using the model API directly + GedPi's brain for system prompts

- [ ] **Step 5: No commit — spike output informs remaining tasks**

---

### Task 6: Add session.start and session.stop protocol handlers

**Files:**
- Modify: `packages/gedpi/bin/headless-jsonl.js`
- Test: `packages/gedpi/tests/headless-jsonl.test.ts`

This task depends on Task 5's findings. The code below assumes Pi exposes a programmatic session API (Approach A). Adapt if the spike reveals a different approach.

- [ ] **Step 1: Write the failing test for session.start**

Add to `packages/gedpi/tests/headless-jsonl.test.ts`:

```typescript
describe("session lifecycle", () => {
  it("starts a session and returns session.started event", async () => {
    const root = await fixtureProject();
    const { messages, sendCommand, close } = createJsonlSession(root);

    sendCommand({
      id: "start-1",
      type: "session.start",
      threadId: "thread-abc",
      runtimeMode: "agent",
    });

    await waitForMessage(messages, (m) => m.type === "event.session.started");
    const started = messages.find((m) => m.type === "event.session.started");
    expect(started).toMatchObject({
      type: "event.session.started",
      threadId: "thread-abc",
    });
    expect(started.session).toBeDefined();
    expect(started.session.status).toBe("ready");

    close();
  });

  it("stops a session and returns session.exited event", async () => {
    const root = await fixtureProject();
    const { messages, sendCommand, close } = createJsonlSession(root);

    sendCommand({
      id: "start-1",
      type: "session.start",
      threadId: "thread-abc",
      runtimeMode: "agent",
    });
    await waitForMessage(messages, (m) => m.type === "event.session.started");

    sendCommand({
      id: "stop-1",
      type: "session.stop",
      threadId: "thread-abc",
    });
    await waitForMessage(messages, (m) => m.type === "event.session.exited");
    const exited = messages.find((m) => m.type === "event.session.exited");
    expect(exited).toMatchObject({
      type: "event.session.exited",
      threadId: "thread-abc",
    });

    close();
  });

  it("returns error for session.stop on unknown threadId", async () => {
    const root = await fixtureProject();
    const { messages, sendCommand, close } = createJsonlSession(root);

    sendCommand({
      id: "stop-bad",
      type: "session.stop",
      threadId: "nonexistent",
    });
    await waitForMessage(messages, (m) => m.type === "response.error");
    expect(messages.find((m) => m.id === "stop-bad")).toMatchObject({
      type: "response.error",
      code: "GEDPI_HEADLESS_SESSION_NOT_FOUND",
    });

    close();
  });
});
```

- [ ] **Step 2: Add test helpers**

Add `createJsonlSession` and `waitForMessage` helpers at the top of the test file:

```typescript
function createJsonlSession(projectRoot: string) {
  const input = new PassThrough();
  const output = new PassThrough();
  const messages: Array<Record<string, unknown>> = [];
  const chunks: Buffer[] = [];
  let buffer = "";

  output.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) {
        messages.push(JSON.parse(line) as Record<string, unknown>);
      }
    }
  });

  const run = runHeadlessJsonl({ projectRoot, input, output });

  return {
    messages,
    sendCommand(cmd: unknown) {
      input.write(`${JSON.stringify(cmd)}\n`);
    },
    close() {
      input.end();
      return run;
    },
  };
}

function waitForMessage(
  messages: Array<Record<string, unknown>>,
  predicate: (m: Record<string, unknown>) => boolean,
  timeoutMs = 5000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = () => {
      if (messages.some(predicate)) return resolve();
      if (timeoutMs <= 0) return reject(new Error("waitForMessage timed out"));
      timeoutMs -= 50;
      setTimeout(check, 50);
    };
    check();
  });
}
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm --prefix packages/gedpi test
```

Expected: new tests fail (session.start handler doesn't exist yet).

- [ ] **Step 4: Implement session.start and session.stop in headless-jsonl.js**

Add session management to `packages/gedpi/bin/headless-jsonl.js`. Replace the command dispatch block:

```javascript
const activeSessions = new Map();

// Inside the for-await loop, replace the single if/else with a switch:
switch (command.type) {
  case "snapshot.read": {
    const commandProjectRoot =
      typeof command.projectRoot === "string" && command.projectRoot
        ? command.projectRoot
        : projectRoot;
    writeJsonLine(output, {
      ...(typeof command.id === "string" ? { id: command.id } : {}),
      type: "response.snapshot",
      snapshot: await readHeadlessSnapshot(commandProjectRoot),
    });
    break;
  }

  case "session.start": {
    const threadId = command.threadId;
    if (typeof threadId !== "string" || !threadId) {
      writeJsonLine(output, {
        ...(typeof command.id === "string" ? { id: command.id } : {}),
        type: "response.error",
        code: "GEDPI_HEADLESS_INVALID_PARAMS",
        message: "session.start requires a threadId string",
      });
      break;
    }
    if (activeSessions.has(threadId)) {
      writeJsonLine(output, {
        ...(typeof command.id === "string" ? { id: command.id } : {}),
        type: "response.error",
        code: "GEDPI_HEADLESS_SESSION_EXISTS",
        message: `Session '${threadId}' already exists`,
      });
      break;
    }
    const session = {
      threadId,
      status: "ready",
      runtimeMode: command.runtimeMode ?? "agent",
      cwd: command.cwd ?? projectRoot,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    activeSessions.set(threadId, session);
    writeJsonLine(output, {
      type: "event.session.started",
      threadId,
      session,
    });
    break;
  }

  case "session.stop": {
    const threadId = command.threadId;
    if (typeof threadId !== "string" || !threadId) {
      writeJsonLine(output, {
        ...(typeof command.id === "string" ? { id: command.id } : {}),
        type: "response.error",
        code: "GEDPI_HEADLESS_INVALID_PARAMS",
        message: "session.stop requires a threadId string",
      });
      break;
    }
    if (!activeSessions.has(threadId)) {
      writeJsonLine(output, {
        ...(typeof command.id === "string" ? { id: command.id } : {}),
        type: "response.error",
        code: "GEDPI_HEADLESS_SESSION_NOT_FOUND",
        message: `No active session with threadId '${threadId}'`,
      });
      break;
    }
    activeSessions.delete(threadId);
    writeJsonLine(output, {
      type: "event.session.exited",
      threadId,
    });
    break;
  }

  default: {
    writeJsonLine(output, {
      ...(typeof command.id === "string" ? { id: command.id } : {}),
      type: "response.error",
      code: "GEDPI_HEADLESS_UNSUPPORTED_COMMAND",
      message: `Unsupported command: ${String(command.type)}`,
    });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm --prefix packages/gedpi test
```

Expected: all tests pass including the new session lifecycle tests.

- [ ] **Step 6: Commit**

```bash
git add packages/gedpi/bin/headless-jsonl.js packages/gedpi/tests/headless-jsonl.test.ts
git commit -m "feat(gedpi): add session.start and session.stop to headless-jsonl protocol"
```

---

### Task 7: Add turn.send handler with content streaming

**Files:**
- Modify: `packages/gedpi/bin/headless-jsonl.js`
- Test: `packages/gedpi/tests/headless-jsonl.test.ts`

This is the core interactive command. The handler accepts user input, routes it through GedPi's brain (system prompt) + the model API, and streams back `event.content.delta` and `event.turn.*` events.

**Implementation depends on Task 5 spike findings.** The code below shows the protocol contract and test expectations. The internal implementation (Pi subprocess vs. direct model API) will be determined by the spike.

- [ ] **Step 1: Write the failing test for turn.send**

```typescript
describe("turn lifecycle", () => {
  it("sends a turn and receives content deltas + turn.completed", async () => {
    const root = await fixtureProject();
    const { messages, sendCommand, close } = createJsonlSession(root);

    sendCommand({
      id: "start-1",
      type: "session.start",
      threadId: "thread-turn",
      runtimeMode: "agent",
    });
    await waitForMessage(messages, (m) => m.type === "event.session.started");

    sendCommand({
      id: "turn-1",
      type: "turn.send",
      threadId: "thread-turn",
      input: "What files are in this project?",
    });

    await waitForMessage(
      messages,
      (m) => m.type === "event.turn.completed",
      30_000,
    );

    const turnStarted = messages.find((m) => m.type === "event.turn.started");
    expect(turnStarted).toMatchObject({
      type: "event.turn.started",
      threadId: "thread-turn",
    });
    expect(typeof turnStarted?.turnId).toBe("string");

    const deltas = messages.filter((m) => m.type === "event.content.delta");
    expect(deltas.length).toBeGreaterThan(0);
    expect(deltas[0]).toMatchObject({
      threadId: "thread-turn",
      streamKind: "assistant_text",
    });
    expect(typeof deltas[0]?.delta).toBe("string");

    const turnCompleted = messages.find(
      (m) => m.type === "event.turn.completed",
    );
    expect(turnCompleted).toMatchObject({
      type: "event.turn.completed",
      threadId: "thread-turn",
      state: "completed",
    });

    close();
  });

  it("returns error for turn.send on non-existent session", async () => {
    const root = await fixtureProject();
    const { messages, sendCommand, close } = createJsonlSession(root);

    sendCommand({
      id: "turn-bad",
      type: "turn.send",
      threadId: "nonexistent",
      input: "hello",
    });
    await waitForMessage(messages, (m) => m.type === "response.error");
    expect(messages.find((m) => m.id === "turn-bad")).toMatchObject({
      type: "response.error",
      code: "GEDPI_HEADLESS_SESSION_NOT_FOUND",
    });

    close();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm --prefix packages/gedpi test
```

Expected: new turn tests fail.

- [ ] **Step 3: Implement turn.send handler**

Add to the switch block in `headless-jsonl.js`:

```javascript
case "turn.send": {
  const threadId = command.threadId;
  if (!activeSessions.has(threadId)) {
    writeJsonLine(output, {
      ...(typeof command.id === "string" ? { id: command.id } : {}),
      type: "response.error",
      code: "GEDPI_HEADLESS_SESSION_NOT_FOUND",
      message: `No active session with threadId '${threadId}'`,
    });
    break;
  }
  const session = activeSessions.get(threadId);
  const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  session.activeTurnId = turnId;
  session.updatedAt = new Date().toISOString();

  writeJsonLine(output, {
    type: "event.turn.started",
    threadId,
    turnId,
  });

  // Route to Pi session — implementation depends on Task 5 spike
  try {
    await handleTurn({
      threadId,
      turnId,
      input: command.input ?? "",
      attachments: command.attachments,
      projectRoot: session.cwd,
      output,
      session,
    });
  } catch (error) {
    writeJsonLine(output, {
      type: "event.turn.completed",
      threadId,
      turnId,
      state: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  session.activeTurnId = undefined;
  break;
}
```

The `handleTurn` function is the integration point — its implementation depends on Task 5's findings. Stub it initially:

```javascript
async function handleTurn({ threadId, turnId, input, projectRoot, output }) {
  // TODO: Replace with Pi session integration (Task 5 determines approach)
  // For now, echo back a placeholder to satisfy the protocol contract
  writeJsonLine(output, {
    type: "event.content.delta",
    threadId,
    turnId,
    streamKind: "assistant_text",
    delta: `[GedPi] Received: ${input}`,
  });
  writeJsonLine(output, {
    type: "event.turn.completed",
    threadId,
    turnId,
    state: "completed",
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm --prefix packages/gedpi test
```

Expected: all tests pass. The placeholder `handleTurn` satisfies the protocol contract tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gedpi/bin/headless-jsonl.js packages/gedpi/tests/headless-jsonl.test.ts
git commit -m "feat(gedpi): add turn.send with content streaming to headless-jsonl protocol"
```

---

### Task 8: Add turn.interrupt handler

**Files:**
- Modify: `packages/gedpi/bin/headless-jsonl.js`
- Test: `packages/gedpi/tests/headless-jsonl.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
describe("turn.interrupt", () => {
  it("interrupts an active turn", async () => {
    const root = await fixtureProject();
    const { messages, sendCommand, close } = createJsonlSession(root);

    sendCommand({ type: "session.start", threadId: "t1", runtimeMode: "agent" });
    await waitForMessage(messages, (m) => m.type === "event.session.started");

    // Send a turn (will complete quickly with stub, but test the protocol)
    sendCommand({ type: "turn.send", threadId: "t1", input: "hello" });
    await waitForMessage(messages, (m) => m.type === "event.turn.started");

    sendCommand({ id: "int-1", type: "turn.interrupt", threadId: "t1" });

    // Should eventually get turn.completed with interrupted or completed state
    await waitForMessage(messages, (m) => m.type === "event.turn.completed");

    close();
  });

  it("returns error for interrupt on non-existent session", async () => {
    const root = await fixtureProject();
    const { messages, sendCommand, close } = createJsonlSession(root);

    sendCommand({ id: "int-bad", type: "turn.interrupt", threadId: "nope" });
    await waitForMessage(messages, (m) => m.type === "response.error");
    expect(messages.find((m) => m.id === "int-bad")).toMatchObject({
      type: "response.error",
      code: "GEDPI_HEADLESS_SESSION_NOT_FOUND",
    });

    close();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm --prefix packages/gedpi test
```

- [ ] **Step 3: Implement turn.interrupt handler**

Add to the switch block in `headless-jsonl.js`:

```javascript
case "turn.interrupt": {
  const threadId = command.threadId;
  if (!activeSessions.has(threadId)) {
    writeJsonLine(output, {
      ...(typeof command.id === "string" ? { id: command.id } : {}),
      type: "response.error",
      code: "GEDPI_HEADLESS_SESSION_NOT_FOUND",
      message: `No active session with threadId '${threadId}'`,
    });
    break;
  }
  const session = activeSessions.get(threadId);
  if (session.abortController) {
    session.abortController.abort();
  }
  break;
}
```

Update `session.start` to create an AbortController, and `handleTurn` to check it:

```javascript
// In session.start:
const session = {
  // ...existing fields...
  abortController: new AbortController(),
};

// In handleTurn, pass session.abortController.signal and check it during streaming
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm --prefix packages/gedpi test
```

- [ ] **Step 5: Commit**

```bash
git add packages/gedpi/bin/headless-jsonl.js packages/gedpi/tests/headless-jsonl.test.ts
git commit -m "feat(gedpi): add turn.interrupt to headless-jsonl protocol"
```

---

### Task 9: Add request.respond and user-input.respond handlers

**Files:**
- Modify: `packages/gedpi/bin/headless-jsonl.js`
- Test: `packages/gedpi/tests/headless-jsonl.test.ts`

These handle approval requests and user-input requests from the agent. The headless bridge queues pending requests; the driver resolves them via these commands.

- [ ] **Step 1: Write the failing test**

```typescript
describe("request.respond", () => {
  it("returns error when no pending request matches", async () => {
    const root = await fixtureProject();
    const { messages, sendCommand, close } = createJsonlSession(root);

    sendCommand({ type: "session.start", threadId: "t1", runtimeMode: "agent" });
    await waitForMessage(messages, (m) => m.type === "event.session.started");

    sendCommand({
      id: "resp-1",
      type: "request.respond",
      threadId: "t1",
      requestId: "nonexistent",
      decision: "approve",
    });
    await waitForMessage(messages, (m) => m.type === "response.error");
    expect(messages.find((m) => m.id === "resp-1")).toMatchObject({
      type: "response.error",
      code: "GEDPI_HEADLESS_REQUEST_NOT_FOUND",
    });

    close();
  });
});

describe("user-input.respond", () => {
  it("returns error when no pending request matches", async () => {
    const root = await fixtureProject();
    const { messages, sendCommand, close } = createJsonlSession(root);

    sendCommand({ type: "session.start", threadId: "t1", runtimeMode: "agent" });
    await waitForMessage(messages, (m) => m.type === "event.session.started");

    sendCommand({
      id: "uir-1",
      type: "user-input.respond",
      threadId: "t1",
      requestId: "nonexistent",
      answers: {},
    });
    await waitForMessage(messages, (m) => m.type === "response.error");
    expect(messages.find((m) => m.id === "uir-1")).toMatchObject({
      type: "response.error",
      code: "GEDPI_HEADLESS_REQUEST_NOT_FOUND",
    });

    close();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm --prefix packages/gedpi test
```

- [ ] **Step 3: Implement request handlers**

Add to the switch block in `headless-jsonl.js`:

```javascript
case "request.respond": {
  const threadId = command.threadId;
  const session = activeSessions.get(threadId);
  if (!session) {
    writeJsonLine(output, {
      ...(typeof command.id === "string" ? { id: command.id } : {}),
      type: "response.error",
      code: "GEDPI_HEADLESS_SESSION_NOT_FOUND",
      message: `No active session with threadId '${threadId}'`,
    });
    break;
  }
  const pending = session.pendingRequests?.get(command.requestId);
  if (!pending) {
    writeJsonLine(output, {
      ...(typeof command.id === "string" ? { id: command.id } : {}),
      type: "response.error",
      code: "GEDPI_HEADLESS_REQUEST_NOT_FOUND",
      message: `No pending request '${command.requestId}' in session '${threadId}'`,
    });
    break;
  }
  pending.resolve(command.decision);
  session.pendingRequests.delete(command.requestId);
  writeJsonLine(output, {
    type: "event.request.resolved",
    threadId,
    requestId: command.requestId,
  });
  break;
}

case "user-input.respond": {
  const threadId = command.threadId;
  const session = activeSessions.get(threadId);
  if (!session) {
    writeJsonLine(output, {
      ...(typeof command.id === "string" ? { id: command.id } : {}),
      type: "response.error",
      code: "GEDPI_HEADLESS_SESSION_NOT_FOUND",
      message: `No active session with threadId '${threadId}'`,
    });
    break;
  }
  const pending = session.pendingRequests?.get(command.requestId);
  if (!pending) {
    writeJsonLine(output, {
      ...(typeof command.id === "string" ? { id: command.id } : {}),
      type: "response.error",
      code: "GEDPI_HEADLESS_REQUEST_NOT_FOUND",
      message: `No pending request '${command.requestId}' in session '${threadId}'`,
    });
    break;
  }
  pending.resolve(command.answers);
  session.pendingRequests.delete(command.requestId);
  writeJsonLine(output, {
    type: "event.request.resolved",
    threadId,
    requestId: command.requestId,
  });
  break;
}
```

Update session creation to include a pending requests map:

```javascript
const session = {
  // ...existing fields...
  pendingRequests: new Map(),
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm --prefix packages/gedpi test
```

- [ ] **Step 5: Commit**

```bash
git add packages/gedpi/bin/headless-jsonl.js packages/gedpi/tests/headless-jsonl.test.ts
git commit -m "feat(gedpi): add request.respond and user-input.respond to headless-jsonl protocol"
```

---

### Task 10: Add thread.read handler

**Files:**
- Modify: `packages/gedpi/bin/headless-jsonl.js`
- Test: `packages/gedpi/tests/headless-jsonl.test.ts`

Returns a snapshot of the thread's accumulated turns and items.

- [ ] **Step 1: Write the failing test**

```typescript
describe("thread.read", () => {
  it("returns thread snapshot for active session", async () => {
    const root = await fixtureProject();
    const { messages, sendCommand, close } = createJsonlSession(root);

    sendCommand({ type: "session.start", threadId: "t1", runtimeMode: "agent" });
    await waitForMessage(messages, (m) => m.type === "event.session.started");

    sendCommand({ type: "turn.send", threadId: "t1", input: "hello" });
    await waitForMessage(messages, (m) => m.type === "event.turn.completed");

    sendCommand({ id: "read-1", type: "thread.read", threadId: "t1" });
    await waitForMessage(messages, (m) => m.type === "response.thread");

    const threadSnapshot = messages.find((m) => m.type === "response.thread");
    expect(threadSnapshot).toMatchObject({
      id: "read-1",
      type: "response.thread",
      threadId: "t1",
    });
    expect(Array.isArray(threadSnapshot?.turns)).toBe(true);
    expect(threadSnapshot?.turns.length).toBeGreaterThan(0);

    close();
  });

  it("returns error for unknown threadId", async () => {
    const root = await fixtureProject();
    const { messages, sendCommand, close } = createJsonlSession(root);

    sendCommand({ id: "read-bad", type: "thread.read", threadId: "nope" });
    await waitForMessage(messages, (m) => m.type === "response.error");
    expect(messages.find((m) => m.id === "read-bad")).toMatchObject({
      type: "response.error",
      code: "GEDPI_HEADLESS_SESSION_NOT_FOUND",
    });

    close();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm --prefix packages/gedpi test
```

- [ ] **Step 3: Implement thread.read handler**

Add a turn history array to sessions and the handler:

```javascript
// In session.start, add:
const session = {
  // ...existing fields...
  turns: [],
};

// In turn.send, after turn completes, push to history:
session.turns.push({
  turnId,
  input: command.input ?? "",
  state: "completed", // or from handleTurn result
  createdAt: new Date().toISOString(),
});

// New switch case:
case "thread.read": {
  const threadId = command.threadId;
  const session = activeSessions.get(threadId);
  if (!session) {
    writeJsonLine(output, {
      ...(typeof command.id === "string" ? { id: command.id } : {}),
      type: "response.error",
      code: "GEDPI_HEADLESS_SESSION_NOT_FOUND",
      message: `No active session with threadId '${threadId}'`,
    });
    break;
  }
  writeJsonLine(output, {
    ...(typeof command.id === "string" ? { id: command.id } : {}),
    type: "response.thread",
    threadId,
    turns: session.turns,
  });
  break;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm --prefix packages/gedpi test
```

- [ ] **Step 5: Commit**

```bash
git add packages/gedpi/bin/headless-jsonl.js packages/gedpi/tests/headless-jsonl.test.ts
git commit -m "feat(gedpi): add thread.read to headless-jsonl protocol"
```

---

### Task 11: Update type declarations

**Files:**
- Modify: `packages/gedpi/bin/headless-jsonl.d.ts`

- [ ] **Step 1: Update the type declarations**

Replace the contents of `packages/gedpi/bin/headless-jsonl.d.ts`:

```typescript
export interface HeadlessJsonlOptions {
  projectRoot: string;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

export interface HeadlessSnapshot {
  projectRoot: string;
  workId: string;
  gedInitialized: boolean;
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
    checkpoints?: Record<string, unknown>;
    checkpointError?: string;
  };
  settings: Record<string, unknown>;
}

export interface HeadlessSession {
  threadId: string;
  status: "ready" | "running" | "error" | "closed";
  runtimeMode: string;
  cwd: string;
  activeTurnId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HeadlessTurn {
  turnId: string;
  input: string;
  state: "completed" | "failed" | "interrupted";
  createdAt: string;
}

export function readHeadlessSnapshot(
  projectRoot: string,
): Promise<HeadlessSnapshot>;

export function runHeadlessJsonl(options: HeadlessJsonlOptions): Promise<void>;
```

- [ ] **Step 2: Run type check**

```bash
npm --prefix packages/gedpi run check
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add packages/gedpi/bin/headless-jsonl.d.ts
git commit -m "docs(gedpi): update headless-jsonl type declarations for interactive protocol"
```

---

## Phase D: GedPi Driver Extension (gedcode repo)

### Task 12: Create JSONL transport layer

**Files:**
- Create: `apps/server/src/provider/Drivers/GedPiJsonlTransport.ts`

This module manages the stdin/stdout JSONL communication with the GedPi child process.

- [ ] **Step 1: Write the transport module**

Create `apps/server/src/provider/Drivers/GedPiJsonlTransport.ts`:

```typescript
import { Effect, Stream, Queue, Scope, Ref } from "effect";
import type { ChildProcessSpawner } from "../../services/ChildProcessSpawner.js";

export interface JsonlMessage {
  readonly type: string;
  readonly id?: string;
  readonly threadId?: string;
  readonly [key: string]: unknown;
}

export interface GedPiJsonlTransport {
  readonly send: (message: JsonlMessage) => Effect.Effect<void>;
  readonly events: Stream.Stream<JsonlMessage>;
  readonly waitForResponse: (
    predicate: (msg: JsonlMessage) => boolean,
    timeoutMs?: number,
  ) => Effect.Effect<JsonlMessage, Error>;
}

export const makeGedPiJsonlTransport = (
  spawner: ChildProcessSpawner,
  command: string,
  args: ReadonlyArray<string>,
  env: Record<string, string>,
): Effect.Effect<GedPiJsonlTransport, Error, Scope.Scope> =>
  Effect.gen(function* () {
    const child = yield* spawner.spawn({ command, args, env });
    const eventQueue = yield* Queue.unbounded<JsonlMessage>();
    let lineBuffer = "";

    child.stdout.on("data", (chunk: Buffer) => {
      lineBuffer += chunk.toString("utf8");
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as JsonlMessage;
          Effect.runSync(Queue.offer(eventQueue, msg));
        } catch {
          // skip malformed lines
        }
      }
    });

    yield* Scope.addFinalizer(
      Effect.sync(() => {
        child.kill();
      }),
    );

    const send = (message: JsonlMessage): Effect.Effect<void> =>
      Effect.sync(() => {
        child.stdin.write(`${JSON.stringify(message)}\n`);
      });

    const events = Stream.fromQueue(eventQueue);

    const waitForResponse = (
      predicate: (msg: JsonlMessage) => boolean,
      timeoutMs = 10_000,
    ): Effect.Effect<JsonlMessage, Error> =>
      Effect.gen(function* () {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          const msg = yield* Queue.poll(eventQueue);
          if (msg._tag === "Some" && predicate(msg.value)) {
            return msg.value;
          }
          yield* Effect.sleep("50 millis");
        }
        return yield* Effect.fail(new Error("waitForResponse timed out"));
      });

    return { send, events, waitForResponse };
  });
```

- [ ] **Step 2: Verify it compiles**

```bash
cd ~/personal/gedcode
bun typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/provider/Drivers/GedPiJsonlTransport.ts
git commit -m "feat: add GedPi JSONL transport layer"
```

---

### Task 13: Implement GedPiAdapter

**Files:**
- Create: `apps/server/src/provider/Drivers/GedPiAdapter.ts`

This implements `ProviderAdapterShape` by routing all operations through the JSONL transport.

- [ ] **Step 1: Write the adapter module**

Create `apps/server/src/provider/Drivers/GedPiAdapter.ts`:

```typescript
import { Effect, Stream, Ref } from "effect";
import type {
  ProviderAdapterShape,
  ProviderAdapterError,
} from "../Services/ProviderAdapter.js";
import { ProviderAdapterRequestError } from "../Services/ProviderAdapter.js";
import type { ProviderDriverKind } from "@t3tools/contracts/providerInstance";
import type { GedPiJsonlTransport, JsonlMessage } from "./GedPiJsonlTransport.js";

export const makeGedPiAdapter = (
  transport: GedPiJsonlTransport,
  driverKind: ProviderDriverKind,
  instanceId: string,
): ProviderAdapterShape<ProviderAdapterError> => {
  const sessions = new Map<string, { status: string }>();

  const unsupported = (method: string) =>
    Effect.fail(
      new ProviderAdapterRequestError({
        message: `GedPi '${instanceId}': ${method} is not yet supported`,
      }),
    );

  return {
    provider: driverKind,
    capabilities: { sessionModelSwitch: "unsupported" as const },

    startSession: (input) =>
      Effect.gen(function* () {
        yield* transport.send({
          type: "session.start",
          threadId: input.threadId,
          cwd: input.cwd,
          runtimeMode: input.runtimeMode,
        });
        const response = yield* transport.waitForResponse(
          (m) =>
            m.type === "event.session.started" &&
            m.threadId === input.threadId,
        );
        sessions.set(input.threadId, { status: "ready" });
        return response.session as any;
      }),

    sendTurn: (input) =>
      Effect.gen(function* () {
        yield* transport.send({
          type: "turn.send",
          threadId: input.threadId,
          input: input.input,
        });
        const response = yield* transport.waitForResponse(
          (m) =>
            m.type === "event.turn.started" &&
            m.threadId === input.threadId,
        );
        return { turnId: response.turnId } as any;
      }),

    interruptTurn: (threadId, turnId) =>
      transport.send({
        type: "turn.interrupt",
        threadId,
        turnId,
      }),

    respondToRequest: (threadId, requestId, decision) =>
      transport.send({
        type: "request.respond",
        threadId,
        requestId,
        decision,
      }),

    respondToUserInput: (threadId, requestId, answers) =>
      transport.send({
        type: "user-input.respond",
        threadId,
        requestId,
        answers,
      }),

    stopSession: (threadId) =>
      Effect.gen(function* () {
        yield* transport.send({ type: "session.stop", threadId });
        sessions.delete(threadId);
      }),

    listSessions: () =>
      Effect.succeed(
        Array.from(sessions.entries()).map(([threadId, s]) => ({
          threadId,
          provider: driverKind,
          status: s.status,
        })) as any,
      ),

    hasSession: (threadId) => Effect.succeed(sessions.has(threadId)),

    readThread: (threadId) =>
      Effect.gen(function* () {
        yield* transport.send({
          id: `read-${threadId}`,
          type: "thread.read",
          threadId,
        });
        return yield* transport.waitForResponse(
          (m) => m.type === "response.thread" && m.threadId === threadId,
        );
      }) as any,

    rollbackThread: () => unsupported("rollbackThread"),

    stopAll: () =>
      Effect.gen(function* () {
        for (const threadId of sessions.keys()) {
          yield* transport.send({ type: "session.stop", threadId });
        }
        sessions.clear();
      }),

    streamEvents: Stream.map(transport.events, (msg) => ({
      ...msg,
      provider: driverKind,
    })) as any,
  };
};
```

- [ ] **Step 2: Verify it compiles**

```bash
cd ~/personal/gedcode
bun typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/provider/Drivers/GedPiAdapter.ts
git commit -m "feat: add GedPiAdapter implementing ProviderAdapterShape"
```

---

### Task 14: Replace snapshot-only stubs in GedPiDriver

**Files:**
- Modify: `apps/server/src/provider/Drivers/GedPiDriver.ts`
- Modify: `apps/web/src/components/settings/providerDriverMeta.ts`

Replace the `makeUnsupportedAdapter()` call with the real adapter, and remove the "Snapshot" badge.

- [ ] **Step 1: Update GedPiDriver.ts to use real adapter and transport**

Replace the `makeUnsupportedAdapter()` and `unsupportedTextGeneration` blocks in `GedPiDriver.ts` with imports of the new modules:

```typescript
import { makeGedPiJsonlTransport } from "./GedPiJsonlTransport.js";
import { makeGedPiAdapter } from "./GedPiAdapter.js";
```

In the `create` function, after spawning the child process for the snapshot probe, create a persistent transport and adapter:

```typescript
const transport = yield* makeGedPiJsonlTransport(
  spawner,
  effectiveConfig.binaryPath,
  ["--headless-jsonl", "--project", projectRoot],
  processEnv,
);

const adapter = makeGedPiAdapter(transport, driverKind, input.instanceId);
```

Replace the `adapter: makeUnsupportedAdapter(...)` line with `adapter,`.

Keep `textGeneration: unsupportedTextGeneration` as-is (spec says delegate to other providers).

- [ ] **Step 2: Remove "Snapshot" badge from web UI**

In `apps/web/src/components/settings/providerDriverMeta.ts`, remove the `badgeLabel: "Snapshot"` line from the GedPi entry.

- [ ] **Step 3: Verify it compiles**

```bash
cd ~/personal/gedcode
bun typecheck
```

- [ ] **Step 4: Run tests**

```bash
cd ~/personal/gedcode
bun run test
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/provider/Drivers/GedPiDriver.ts apps/web/src/components/settings/providerDriverMeta.ts
git commit -m "feat: upgrade GedPi driver from snapshot-only to full interactive adapter"
```

---

## Phase E: Integration Smoke Test

### Task 15: End-to-end manual verification

**Files:** None (manual testing only)

- [ ] **Step 1: Build GedPi protocol in ged-mono**

```bash
cd ~/personal/ged-mono
npm --prefix packages/gedpi test
npm --prefix packages/gedpi run check
```

Both must pass.

- [ ] **Step 2: Start GedCode dev server pointing at local GedPi**

In the gedcode repo, configure GedPi settings to use local binary:
```bash
cd ~/personal/gedcode
npm run dev:server
```

Open the web UI. Go to Settings → Providers → GedPi. Set:
- Binary path: `node /Users/edgy/personal/ged-mono/packages/gedpi/bin/gedpi.js`
- Project root: (leave blank to use current project)

- [ ] **Step 3: Verify snapshot works**

The GedPi provider card should show status "ready" (not "error"). The badge should no longer say "Snapshot".

- [ ] **Step 4: Verify session lifecycle**

Select GedPi as the provider. Start a new conversation. Type a message and send. Verify:
- Session starts (no error toast)
- Content streams back in the chat UI
- The turn completes (spinner stops)

- [ ] **Step 5: Document any issues**

If anything fails, note the specific error and which component (protocol vs. driver vs. UI) needs fixing.

- [ ] **Step 6: No commit — this is verification only**

---

## Appendix: Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Pi has no programmatic/headless API | Medium | High | Task 5 spike determines approach before committing to implementation. Fallback: build minimal turn loop in headless-jsonl using model API + brain.ts |
| Upstream t3code patches break on cherry-pick | Low | Medium | Use `git am --3way` for conflict resolution; patches are well-isolated |
| Effect type signatures don't match between transport and adapter | Medium | Low | `bun typecheck` catches this immediately; `as any` casts in adapter provide escape hatch during iteration |
| GedPi brain system prompts don't inject in headless mode | Medium | Medium | Brain.ts is stateless and callable directly; headless bridge can call `buildBrainSystemPromptSuffix()` without Pi |
