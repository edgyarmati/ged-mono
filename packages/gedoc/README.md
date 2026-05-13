# GedOC

Give your coding agent a memory and a process. GedOC layers a plan-before-you-edit workflow and durable project memory on top of [OpenCode](https://opencode.ai) — so sessions stop forgetting, and the agent stops charging ahead without a plan.

## Install

GedOC currently ships as a JavaScript bundle and requires Node.js 22 or newer.

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/edgyarmati/ged-mono/main/install.sh | bash
gedoc
```

### Windows

```powershell
irm https://raw.githubusercontent.com/edgyarmati/ged-mono/main/install.ps1 | iex
gedoc
```

Your existing `opencode` install is left alone — GedOC runs in its own sandbox.

### From a local checkout

```bash
git clone https://github.com/edgyarmati/ged-mono
cd gedoc
./scripts/setup
gedoc
```

## What you get

- **Durable project memory** in `.ged/` — spec, tasks, tests, decisions, standards, and session summaries stay on disk between runs.
- **Automatic grilling before changes** — for new features, fixes, refactors, and behavior changes, GedOC asks one focused question at a time until the request is unambiguous.
- **Documentation-aware grilling when needed** — when a change exposes domain language or durable decisions, GedOC can use an enhanced grill workflow that updates project context or ADRs instead of losing that reasoning in chat.
- **Skill-fit checkpoint** — after clarification, GedOC checks whether available skills cover the task, uses `find-skills` when relevant skills are missing, and can create a project-local skill when none exists.
- **TDD implementation discipline** — behavior-changing slices can be guided by a bundled red-green-refactor workflow, recorded in the active work `TESTS.md` before implementation.
- **Disciplined diagnosis** — bug and performance-regression work can route through a reproduce → minimize → hypothesize → instrument → fix → regression-test loop before patching.
- **Architecture review command** — `/improve-codebase-architecture` finds deepening opportunities and asks what to explore before any refactor starts.
- **Clean-context review command** — `/clean-context-review` reviews the current diff/tests with fresh eyes and requires finding adjudication before commit.
- **Optional native subagents** — `/ged-agents` can opt into read-only intelligence helpers (`ged-explorer`, `ged-planner`, `ged-verifier`) while preserving GedOC's single-writer default. There is no writer subagent role.
- **Plan before edit** — the agent can't touch your files until `SPEC.md`, `TASKS.md`, and `TESTS.md` have real content.
- **Repo awareness** — a ranked repo map keeps the agent oriented in large codebases.
- **Skill discovery and local creation** — relevant skills are surfaced and loaded automatically; if discovery cannot find a fit, GedOC can write a narrow local skill under `.ged/skills/` without touching global user skills.
- **Collaboration-safe memory direction** — shared project knowledge stays durable, while active work is moving toward per-branch `.ged/work/<branch>/` plans and protected-branch guardrails.
- **Token savings** — RTK is installed and wired up automatically, compressing bash command output by 60-90% so the agent uses fewer tokens on git, ls, test runs, and more.
- **Zero impact on your normal setup** — the `gedoc` launcher uses its own isolated config, so regular `opencode` keeps working exactly as before.

OpenCode still owns the terminal UI, models, providers, auth, sessions, tools, and runtime. GedOC only adds the workflow layer.

## The Ged workflow

1. **Bootstrap** — `.ged/` is seeded in your project the first time you run GedOC there.
2. **Grill** — for change requests, clarify one question at a time until behavior, constraints, non-goals, tests, and success criteria are concrete. Use the docs-aware variant when domain terms or durable decisions should be recorded.
3. **Check skills** — judge whether bundled/project skills cover the clarified task; if not, use `find-skills`, then create a project-local `.ged/skills/` skill with `skill-maker` when no adequate skill exists.
4. **Plan** — write real `SPEC.md`, `TASKS.md`, and `TESTS.md` in the active planning directory. Until you do, the edit/write guard is active.
5. **Test-drive when applicable** — for behavior-changing slices, record the behavior, public seam, expected red failure, focused test command, and verification command in `TESTS.md`.
6. **Diagnose before patching** — for unknown bugs and regressions, establish a feedback loop and cause before writing the fix.
7. **Execute** — work bounded task slices guided by the plan, with the primary `gedoc` agent as the active-worktree writer and decision owner by default.
8. **Review and verify** — run planned checks, use clean-context review for meaningful implementation diffs, adjudicate findings, then update state/session summaries so the next run picks up where you left off.

For the current subagent/orchestration model, see [`docs/current-orchestration-model.md`](docs/current-orchestration-model.md). For collaborative repositories, see the planned per-branch work-memory model in [`docs/2026-04-30-collaborative-memory-design.md`](docs/2026-04-30-collaborative-memory-design.md).
GedOC's collaboration checkpoint reports the current branch, protected-branch policy, active `.ged/work/<branch-slug>/` planning directory, planning readiness, and next recommended action when starting or resuming change work.
Use `gedoc_start_work` to deliberately create or switch to a feature branch and initialize that branch's work-memory directory; it refuses dirty checkouts by default and suggests committing, stashing, or explicitly allowing dirty work.
PR behavior is controlled by `workflow.offerPrOnCompletion` and `workflow.autoCreatePrOnCompletion`; by default GedOC offers to open a PR when work is complete but does not create one unless asked.
Branch-scoped runtime state under `.ged/runtime/<branch-slug-or-root>/STATE.md` is injected into OpenCode's compaction context, so active state survives long sessions without creating a shared root-state bottleneck.

Run `/improve-codebase-architecture` when you want a review-only architecture pass. GedOC will inspect docs/code and return numbered deepening opportunities, then wait for you to choose a candidate before treating any refactor as an implementation change.

Run `/clean-context-review` before committing meaningful implementation changes when you want the review loop explicit. It inspects the current diff/tests in blind or contract mode, reports findings by severity with evidence and confidence, and requires the primary orchestrator to accept, reject, or escalate each finding before commit.

Run `/ged-agents` to review or update optional native subagent settings. Settings are read from `~/.gedoc/settings.json` plus a gitignored project override at `.gedoc/settings.json`; optional model guidance can live in `model-recommendations.md` in either settings directory. GedOC treats subagents as intelligence contributors by default: `ged-explorer` returns discovery packets, `ged-planner` critiques plans as a smart friend, and `ged-verifier` runs checks or clean-context review. Writes, commits, PR decisions, and final verification judgments stay with the primary orchestrator. Writer subagents are not implemented.

## Quick usage

```bash
gedoc
```

Then just talk to it. For example:

> "Bootstrap this project and tell me what we're working with."

> "Add a dark mode toggle to the settings page."

> "Review the auth flow for security issues."

GedOC will bootstrap `.ged/` automatically on first use in a new project, then follow a plan → implement → verify workflow for every task. You don't need to pass inline prompts or CLI flags — just open it and have a conversation.

Replace `<provider>/<model>` with any model identifier OpenCode supports (for example, `opencode/hy3-preview-free`).

---

## Contents

- [How isolation works](#how-isolation-works)
- [Use GedOC as a permanent OpenCode plugin](#use-gedoc-as-a-permanent-opencode-plugin)
- [Repo hygiene](#repo-hygiene)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Packages and layout](#packages-and-layout)
- [See also](#see-also)

## How isolation works

The `gedoc` launcher starts OpenCode with an GedOC-specific config home so it does not inherit your normal OpenCode plugins or config:

- `XDG_CONFIG_HOME=~/.config/gedoc`
- `OPENCODE_CONFIG=~/.config/gedoc/opencode/opencode.json`
- `OPENCODE_CONFIG_DIR=~/.config/gedoc/opencode`
- `OPENCODE_CLIENT=gedoc`

Both `gedoc` and your regular `opencode` use the same underlying OpenCode binary — they just point at different config roots.

GedOC behavior settings are resolved from:

- global user settings: `~/.gedoc/settings.json`
- optional project-local override: `.gedoc/settings.json`

The current workflow policy supports protected-branch settings such as `workflow.protectedBranches`, `workflow.requireFeatureBranchForChanges`, and `workflow.allowProtectedBranchChanges`. When feature branches are required, GedOC blocks source edits and mutating shell commands on protected branches such as `main`/`master` unless an explicit settings override allows them.

## Use GedOC as a permanent OpenCode plugin

If you'd rather have GedOC available in every `opencode` session, you can load it as a regular plugin instead of going through the `gedoc` launcher. This trades isolation for always-on availability.

| Mode | Isolation | When to use |
| --- | --- | --- |
| `gedoc` launcher (recommended) | Fully isolated config and plugin loading. | The default for almost everyone. |
| Permanent plugin | None — GedOC becomes part of your normal OpenCode setup. | You want the Ged workflow in every `opencode` session. |

### From an GedOC install

After installing GedOC, point your normal OpenCode config at the bundled plugin file.

Typical plugin paths:

- macOS / Linux: `~/.local/share/gedoc/lib/plugin/index.js`
- Windows: `%LOCALAPPDATA%\GedOC\lib\plugin\index.js`

Edit `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "file:///Users/you/.local/share/gedoc/lib/plugin/index.js"
  ]
}
```

To make GedOC the default agent there as well:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "gedoc",
  "plugin": [
    "file:///Users/you/.local/share/gedoc/lib/plugin/index.js"
  ]
}
```

### From a source checkout

Build the plugin first:

```bash
git clone https://github.com/edgyarmati/ged-mono
cd gedoc
npm install
npm run build
```

Then point OpenCode at the built plugin:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/gedoc/packages/plugin/dist/index.js"
  ]
}
```

The `gedoc` launcher is still the recommended path — permanent-plugin mode is supported but skips the isolation you get for free otherwise.

## Repo hygiene

`.ged/` is intentionally split into **durable** and **runtime** state.

Commit these when they reflect real project intent:

- `PROJECT.md`, `SPEC.md`, `TASKS.md`, `TESTS.md`, `DECISIONS.md`, `STANDARDS.md`, `SKILLS.md`, `CONFIG.md`, `VERSION`, `.gitignore`

These stay out of git — they're regenerated each run:

- `runtime/`, `STATE.md`, `SESSION-SUMMARY.md`, `REPO-MAP.md`, `REPO-MAP.json`

`.pi/` also stays out of git.

## Troubleshooting

- **Testing from a checkout** — use `./scripts/setup` rather than the release installer.
- **Managed OpenCode install fails** — rerun `gedoc` and follow the printed fallback command using the same `--prefix` path.
- **Launcher verification fails during install** — rerun the installer with the same `GEDOC_VERSION`; it verifies the extracted launcher with `gedoc --check` before creating the final wrapper.
- **Installer download fails** — confirm the tagged release contains the expected assets listed in [`docs/release-checklist.md`](docs/release-checklist.md).

## Development

```bash
./scripts/setup   # installs deps, builds, links launcher, installs RTK
npm run check
npm test
```

RTK is optional — GedOC works without it. When present, bash tool calls to git, test runners, ls, grep, and other supported commands are automatically compressed for token savings.

Release artifacts are produced by `.github/workflows/release-gedoc.yml` from tagged versions. See [`docs/release-checklist.md`](docs/release-checklist.md) for the release runbook.

## Packages and layout

- [`packages/plugin`](packages/plugin) — `@gedoc/plugin`, the OpenCode plugin.
- [`packages/launcher`](packages/launcher) — `gedoc`, the launcher CLI.

```
.
├── packages/
│   ├── plugin/       # @gedoc/plugin (OpenCode plugin)
│   └── launcher/     # gedoc launcher CLI
├── scripts/
│   ├── setup         # contributor bootstrap
│   └── release/      # release bundle helpers
├── install.sh        # public macOS/Linux installer
├── install.ps1       # public Windows installer
├── docs/             # design docs and release runbook
└── AGENTS.md         # guidance for agents working in this repo
```

## See also

- [`AGENTS.md`](AGENTS.md) — architecture, implemented behavior, and guidance for agents working on this repo.
- [`docs/2026-04-24-gedoc-design.md`](docs/2026-04-24-gedoc-design.md) — original GedOC design record.
- [`docs/2026-04-24-native-launcher-design.md`](docs/2026-04-24-native-launcher-design.md) — native launcher design record.
- [`docs/2026-04-24-release-setup-design.md`](docs/2026-04-24-release-setup-design.md) — release setup design record.
- [`docs/2026-04-30-collaborative-memory-design.md`](docs/2026-04-30-collaborative-memory-design.md) — collaboration-safe memory and protected-branch design.
- [`docs/implementation-plan.md`](docs/implementation-plan.md) — phased implementation plan.
- [`docs/release-checklist.md`](docs/release-checklist.md) — release runbook.
