# GedCode

A multi-provider coding agent GUI — fork of [t3code](https://github.com/pingdotgg/t3code) with [GedPi](packages/gedpi/) as a first-class provider alongside Claude, Codex, Cursor, and OpenCode.

## Architecture

Two repos work together:

| Repo | What it is |
|------|------------|
| [**edgyarmati/gedcode**](https://github.com/edgyarmati/gedcode) | The desktop app — Electron + React + Effect monorepo (Bun workspaces) |
| **ged-mono** (this repo) | GedPi runtime — the brain, workflow engine, and headless JSONL protocol (npm workspaces) |

GedCode spawns GedPi as a child process and communicates over stdin/stdout using line-delimited JSON. The protocol handles session lifecycle, streaming content, tool approvals, and conversation history.

## Quick Start

### 1. Install GedPi

```bash
git clone https://github.com/edgyarmati/ged-mono.git
cd ged-mono
npm install
npm --prefix packages/gedpi run build   # optional — bin/gedpi.js runs directly
```

Verify it works:

```bash
echo '{"type":"snapshot.read"}' | node packages/gedpi/bin/gedpi.js --headless-jsonl --project .
```

### 2. Run GedCode

```bash
git clone https://github.com/edgyarmati/gedcode.git
cd gedcode
bun install .

# Dev mode (web + server + hot reload)
bun run dev

# Desktop app (Electron)
bun run dev:desktop
```

| Component | Port | Env override |
|-----------|------|-------------|
| Web frontend | 5733 | `PORT` |
| Server | 13773 | `GEDCODE_PORT` |

### 3. Add GedPi as a Provider

In the GedCode settings UI, add a GedPi provider instance:

- **Binary path** — absolute path to `gedpi` (or `node /path/to/ged-mono/packages/gedpi/bin/gedpi.js`)
- **Project root** — leave blank to use the current GedCode project

GedCode will spawn the binary with `--headless-jsonl --project <root>` and probe it for a snapshot on startup.

## Headless JSONL Protocol

GedPi exposes a bidirectional JSONL protocol over stdin/stdout (`bin/headless-jsonl.js`). GedCode's server drives this through three layers:

```
GedPiDriver → GedPiAdapter → GedPiJsonlTransport → gedpi --headless-jsonl
```

### Commands (client → GedPi)

| Command | Purpose |
|---------|---------|
| `snapshot.read` | Read project state, `.ged/` memory, settings |
| `session.start` | Start a new agent session for a thread |
| `turn.send` | Send user input, streams back content deltas and tool calls |
| `turn.interrupt` | Abort the running turn |
| `request.respond` | Approve or deny a tool execution request |
| `user-input.respond` | Answer a user input prompt |
| `thread.read` | Retrieve conversation history |
| `session.stop` | Close the session and dispose resources |

### Events (GedPi → client)

| Event | Purpose |
|-------|---------|
| `event.session.started` | Session ready |
| `event.turn.started` | Turn began processing |
| `event.content.delta` | Streaming text (`assistant_text`) or reasoning (`thinking`) |
| `event.item.tool_call.start` | Tool invocation began |
| `event.item.tool_call.end` | Tool invocation finished |
| `event.turn.completed` | Turn done (`completed`, `interrupted`, or `failed`) |
| `event.request.resolved` | Approval request resolved |
| `event.session.exited` | Session closed |

Type definitions: [`packages/gedpi/bin/headless-jsonl.d.ts`](packages/gedpi/bin/headless-jsonl.d.ts)

## Packages in This Repo

| Package | Description |
|---------|-------------|
| [`packages/gedpi/`](packages/gedpi/) | GedPi runtime — brain, workflow, extensions, headless JSONL |
| [`packages/gedoc/`](packages/gedoc/) | GedOC — OpenCode plugin + launcher (separate integration) |

## Development

```bash
# Full quality gate
npm run verify

# GedPi only
npm --prefix packages/gedpi test
npm --prefix packages/gedpi run check
npm --prefix packages/gedpi run lint

# GedOC only
npm -w packages/gedoc test
npm -w packages/gedoc run check
```

## License

MIT — see [LICENSE](LICENSE).
