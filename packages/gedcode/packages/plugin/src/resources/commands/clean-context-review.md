---
description: Run a clean-context review of current changes before commit
agent: gedcode
---
Run a clean-context review for the current repository changes. This command is review/adjudication-only by default; do not edit files or commit from inside the review pass unless the user separately asks for fixes after findings are adjudicated.

Purpose:
- catch issues the implementation context may have missed
- keep the primary `gedcode` agent as the single writer and decision owner
- make commit readiness explicit

Review flow:

1. Inspect repository state:
   - run `git status`
   - inspect the relevant diff (`git diff` and staged diff when applicable)
   - read active planning artifacts (`SPEC.md`, `TASKS.md`, `TESTS.md`) only if doing contract review
2. Choose review mode:
   - **Blind diff review** by default: review the diff and test output with minimal prior assumptions.
   - **Contract review** when requested or when acceptance criteria are subtle: also compare against the active spec, tasks, tests, non-goals, and user constraints.
3. Check for:
   - logic bugs
   - missing edge cases
   - security, data-loss, or compatibility risks
   - test gaps
   - inconsistency with nearby code patterns
   - accidental scope creep
4. Report findings without editing files.
5. The primary orchestrator must adjudicate each finding before commit:
   - accepted: fix before commit, then rerun verification
   - rejected: record why it is out of scope, false positive, or intentionally deferred
   - needs-user: ask the user before changing behavior

Output format:

```md
## Clean-context review

Mode: Blind diff review | Contract review
Scope: <unstaged/staged/branch comparison summary>
Checks observed: <commands and pass/fail if available>

### Findings

#### P0/P1/P2/P3 — <title>
- Evidence: <file:line or diff hunk>
- Risk: <why it matters>
- Suggested fix: <bounded fix or test>
- Confidence: High | Medium | Low
- Blocks commit: yes | no | needs-user

### Adjudication required
- [ ] <finding title>: accept | reject | needs-user — <reason>
```

If there are no findings, say so explicitly and state whether the change is ready to commit after planned verification.
