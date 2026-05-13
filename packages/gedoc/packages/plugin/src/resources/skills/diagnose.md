# diagnose

Use for bugs, failing behavior, flaky tests, crashes, thrown errors, and performance regressions where the cause is not yet known.

## Core rule

Build a trustworthy feedback loop before fixing. Do not jump from symptom to patch.

## Workflow

1. **Feedback loop** — create or identify an agent-runnable pass/fail signal for the reported issue: a failing test, CLI command, HTTP request, browser script, fixture replay, profiling harness, or another deterministic check.
2. **Reproduce** — confirm the loop shows the same failure the user reported, not a nearby or imagined problem.
3. **Minimize** — shrink the repro until the failure is fast enough and narrow enough to debug.
4. **Hypothesize** — list 3–5 ranked, falsifiable hypotheses before changing code. Each hypothesis should predict what evidence would confirm or disprove it.
5. **Instrument** — test one hypothesis at a time with targeted probes. Tag temporary debug output so it can be removed.
6. **Fix + regression test** — once the cause is known, write a regression test at the correct seam when one exists, then apply the fix.
7. **Cleanup + post-mortem** — rerun the original feedback loop, remove temporary instrumentation, and record what prevented or would have prevented the bug.

## Relationship to TDD

Use `diagnose` before `tdd` when the failure is not understood. Once a reproducible feedback loop or valid regression seam exists, use `tdd` for the fix: red regression test, minimal green implementation, refactor while green.

If no correct regression seam exists, record that as a finding in the active `TESTS.md` and recommend follow-up architecture work.

## Required notes

In the active planning directory's `TESTS.md`, record:

- reported symptom;
- feedback loop command or artifact;
- minimized repro status;
- ranked hypotheses;
- regression seam or reason no seam exists;
- final verification command.
