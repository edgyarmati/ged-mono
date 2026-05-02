# Current GedCode Orchestration Model

GedCode uses **single-writer orchestration**.

The short version:

> The primary `gedcode` agent owns active-worktree writes and decisions. Optional subagents contribute intelligence only. They do not become parallel developers.

This document explains how the current system works for users and future maintainers.

## Why this model exists

Parallel writer agents are tempting, but they fragment implicit decisions: style, edge cases, tests, architecture, and product interpretation. GedCode instead keeps one coherent writer and injects extra intelligence around that writer.

The current model is designed to get the practical benefits of multi-agent work without reintroducing unstructured swarms:

- more codebase discovery without bloating the primary context
- stronger plan critique before implementation
- clean-context review before commit
- one owner for scope, edits, verification, commits, and PR decisions

## The primary `gedcode` agent

The primary agent is the orchestrator and the active-worktree writer.

It owns:

- user clarification
- collaboration/branch checkpoint decisions
- skill-fit decisions
- `.ged/` planning artifacts
- implementation slices
- source edits in the active worktree
- verification decisions
- clean-context review adjudication
- commits and PR decisions

When in doubt, the primary agent decides what becomes an action.

## Optional native subagents

Native subagents are optional and configured through `/ged-agents`. This is a configuration surface for intelligence helpers; it does not enable any writer role.

When native subagents are enabled, they are mandatory checkpoints for non-trivial change requests unless the primary agent records a skip reason. Non-trivial means behavior-changing, cross-file, architecture-affecting, migration/release/process-changing, security-sensitive, bug-fix, or any change where tests, edge cases, or scope can reasonably be wrong.

Checkpoint policy:

- use `ged-explorer` for evidence-backed discovery when relevant code context is not already known;
- use `ged-planner` before finalizing or materially changing `SPEC.md`, `TASKS.md`, or `TESTS.md`;
- use `ged-verifier` for checks or clean-context review before committing meaningful implementation changes.

Allowed skip reasons are: the task is trivial/mechanical, native subagents are disabled, the runtime does not make a subagent available, the subagent call fails, or the user explicitly asks not to delegate. The primary agent should record the skip reason in the response and active planning or verification notes for meaningful work.

Settings live outside durable project memory:

- global: `~/.gedcode/settings.json`
- project override: `.gedcode/settings.json` — gitignored by default

Optional model guidance can live in `model-recommendations.md` next to either settings file.

Subagents report back to the primary agent. They do not commit, make final decisions, or own scope.

### `ged-explorer`

Purpose: read-only discovery.

Use it for:

- finding relevant files
- inspecting code paths
- summarizing existing patterns
- identifying risks and open questions

Expected output is a discovery packet:

```md
## Findings
- ...

## Evidence
- `path/to/file.ts:42` — relevant behavior

## Risks / edge cases
- ...

## Open questions
- ...

## Suggested next inspection
- ...
```

It must not edit files, run mutating commands, or continue into implementation.

### `ged-planner`

Purpose: read-only planning and smart-friend critique.

Use it for:

- critiquing a plan
- spotting missing context
- identifying edge cases and non-goals
- suggesting test strategy
- advising whether the task needs more user clarification

It should say what the primary agent needs to inspect next instead of guessing when context is missing.

It must not edit files or write planning artifacts directly. The primary agent writes final planning updates.

### `ged-verifier`

Purpose: verification and clean-context review.

Use it for:

- running planned checks when requested
- inspecting failures
- reviewing the current diff/tests with fresh context
- reporting blockers before commit

It must not edit source, relax tests, commit, or decide scope. It reports findings so the primary agent can adjudicate them.

## Clean-context review

Use `/clean-context-review` before committing meaningful implementation changes when an explicit review loop is useful.

The command is review/adjudication-only by default. It should not edit files or commit.

It supports two modes:

- **Blind diff review** — default. Review the diff and test output with minimal prior assumptions.
- **Contract review** — compare the diff against the active spec, tasks, tests, non-goals, and user constraints.

The review reports findings by severity, evidence, suggested fix, confidence, and whether each finding blocks commit.

Then the primary agent adjudicates each finding:

- **accepted** — fix before commit, then rerun verification
- **rejected** — record why it is a false positive, out of scope, or intentionally deferred
- **needs-user** — ask before changing behavior

## Commit flow

The intended implementation loop is:

```text
clarify
check skills
plan
implement one bounded slice
run planned checks
run or account for clean-context review
adjudicate findings
fix accepted findings
rerun verification
commit
```

The `/commit` command reminds agents to run `/clean-context-review` or explicitly confirm that clean-context review was already completed and adjudicated for meaningful implementation changes.

## What is intentionally not implemented

GedCode does **not** implement writer subagents.

Any agent that writes code independently is a writer-subagent model, so it is out of scope for the current system.

Current guidance is to avoid implementing it. The practical system is:

- one active writer
- optional read-only scouts
- optional smart-friend planning critique
- optional clean-context verifier/reviewer
- primary-agent adjudication and commits

Do not add writer-subagent orchestration unless the product direction is explicitly reopened.

## User commands

- `/ged-agents` — inspect or configure optional native subagents.
- `/clean-context-review` — run a review/adjudication pass over current changes before commit.
- `/commit` — verify, account for clean-context review, stage, and commit ready changes.

## Maintainer checklist

When changing orchestration behavior, preserve these invariants:

- The primary `gedcode` agent is the active-worktree writer by default.
- Subagents contribute intelligence and report back.
- Reviewers do not edit or commit.
- No writer subagent role exists.
- No unstructured multi-agent writer swarms.
- No writer-subagent mode.
