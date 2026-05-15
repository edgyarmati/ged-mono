# GedCode Desktop GUI Plan

Status: superseded as primary direction by the t3code adoption spike in `docs/plans/gedcode-t3code-adoption.md`. The clean-room Electron scaffold remains a useful fallback/prototype, but new strategic investment should validate t3code as GedCode's foundation first.

## Product goal

`gedcode` will be a desktop GUI tailored for GedPi. It is a visual cockpit for the Ged workflow, not a replacement editor and not another agent brain.

The existing OpenCode integration is now `gedoc`; this new package may use the freed `gedcode` name.

## Core principles

- GedPi remains the workflow/runtime brain.
- `.ged/` remains the durable and runtime workflow source of truth.
- `.gedoc/` remains the settings location.
- GedCode must not directly write source files, checkpoint files, planning files, or commits in early milestones.
- The GUI may write app-local state and `.gedoc` settings, preserving unknown settings keys.
- All source mutations, verifier adjudication, and commits must go through GedPi-safe paths.

## Architecture decision

### Desktop stack

Use **Electron first** for the initial GedCode desktop app.

Why:

- The first hard problem is runtime/process integration, not native binary size.
- Electron's Node-capable main process gives the simplest path for spawning GedPi, managing PTY/child processes, watching files, reading git state, and packaging an agent-native developer tool.
- The renderer can use a mature web UI stack for markdown, task cards, diffs, and workflow dashboards.
- Security risks are manageable with a strict main/renderer boundary.

Tauri remains a possible later optimization if the bridge protocol becomes clean and the app no longer needs a Node-heavy main process.

### Security model

- Renderer has no direct Node integration.
- Use context isolation and a typed preload/API boundary.
- Main process owns filesystem access, child-process control, git reads, and settings writes.
- Renderer receives sanitized markdown/diff data and typed state snapshots.
- Restrict reads/writes to explicit user-selected project roots and app-local state.
- Redact secrets from logs and renderer-visible process output where practical.

### Runtime bridge

Start with **read-only dashboard mode** in M1. Do not block M1 on chat/process control.

For M2, prefer a formal **headless IPC/JSONL bridge** in GedPi. Current `packages/gedpi/bin/gedpi.js` launches Pi with `stdio: "inherit"`, which is TUI-oriented and not a stable machine-readable protocol. Therefore the bridge path is:

1. M1: read `.ged/`, `.gedoc/`, and git state directly; no prompt injection.
2. M2 spike: add or expose a GedPi headless/event mode if feasible.
3. If headless mode is not feasible quickly, use a PTY or embedded terminal fallback as an escape hatch while keeping GUI panels read-only.

Minimum bridge message types for M2:

- `session.start { projectRoot, workId? }`
- `session.stop { sessionId }`
- `prompt.submit { sessionId, text, attachments? }`
- `prompt.cancel { sessionId }`
- `event.output { sessionId, stream, text }`
- `event.status { sessionId, phase, activeTask?, blockers? }`
- `event.tool { sessionId, toolName, status, summary? }`
- `event.error { sessionId, code, message, recoverable }`
- `project.switch { projectRoot }`

## Shared code strategy

M1 should not import GedPi brain/orchestration internals for workflow decisions.

Use or extract shared pure readers for:

- work-id/branch discovery
- `.ged` path construction
- checkpoint parsing/validation via `@ged/shared-checkpoints`
- settings read/merge/write helpers for `.gedoc`

Preferred implementation path:

1. Reuse `@ged/shared-checkpoints` immediately.
2. For path/settings readers, either move pure helpers into `packages/shared` or duplicate with contract tests if extraction would slow M1.
3. Do not import GedPi extension hooks or brain runtime directly into the GUI.

## Milestones

### M0: Architecture spike — complete

Decisions:

- Stack: Electron first.
- Runtime strategy: read-only M1, headless IPC/JSONL preferred for M2, PTY/terminal fallback if needed.
- Mutation boundary: GUI cockpit only; no independent source writer or checkpoint writer.
- Shared code: use shared checkpoint package, extract/contract-test pure path/settings readers.

### M1: Skeleton read-only dashboard

Deliverables:

- Create `packages/gedcode` as an Electron + TypeScript package.
- Add root workspace and CI integration without making `packages/gedpi` a workspace.
- App opens/selects a project directory.
- Compute active branch/work-id.
- Read and render:
  - `.ged/PROJECT.md`, `.ged/ARCHITECTURE.md`, `.ged/PATTERNS.md` summaries when present
  - `.ged/work/<work-id>/SPEC.md`, `TASKS.md`, `TESTS.md`, `NOTES.md`
  - `.ged/runtime/<work-id>/STATE.md`, `SESSION-SUMMARY.md`, `checkpoints.json`
- Show checkpoint status and current blockers.
- Keep workflow/source files read-only.

### M2: Runtime bridge/chat MVP

Deliverables:

- Prove GedPi headless/JSONL event mode or PTY fallback.
- Launch/stop GedPi session for the active project.
- Submit prompts and display output/status events.
- Handle cancellation, process crash, restart, and project switching.

### M3: Workflow cockpit

Deliverables:

- First-class SPEC/TASKS/TESTS cards.
- Guided prompt buttons for planning, executing next task, verifying, and committing.
- If no action bridge exists yet, buttons copy/send prompt text to the active runtime fallback.

### M4: Git/diff/review cockpit

Deliverables:

- Changed-file list and diff viewer.
- Verifier findings display.
- Commit readiness calculated from checkpoint state.
- Commit action only through a GedPi-safe bridge/API.

### M5: Settings and packaging

Deliverables:

- Global/project `.gedoc/settings.json` UI.
- Model settings for `ged-explorer`, `ged-planner`, `ged-verifier`.
- Plan-review and auto-commit preferences.
- Initial `gedcode-v*` release workflow and packaging smoke tests.

## Testing plan

M1:

- Work-id fixture tests: normal branch, slash branch, detached HEAD/root fallback.
- Checkpoint fixture tests: schema v2/v3, unknown schema, corrupt JSON, closed lifecycle.
- File reader tests for missing/deleted/atomically rewritten `.ged` files.
- Renderer/component tests for dashboard cards.
- App smoke test opens a fixture project and renders status without mutation.

M2:

- Fake GedPi process tests for JSONL or PTY transcript behavior.
- Process crash/restart/cancel/project-switch tests.
- Prompt submission and output streaming tests.

Release:

- Root `npm run verify` includes GedCode checks.
- Packaging smoke once Electron packaging is configured.

## Immediate next task

Pause further clean-room GUI expansion and run the t3code adoption spike described in `docs/plans/gedcode-t3code-adoption.md`.
