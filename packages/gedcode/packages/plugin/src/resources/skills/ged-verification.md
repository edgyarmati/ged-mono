# ged-verification

Use after implementation.

Responsibilities:
- run the planned checks from `.ged/TESTS.md`
- before committing meaningful implementation changes, perform or request a clean-context review of the diff/tests with minimal prior assumptions
- report review findings by severity, including evidence, suggested fix, confidence, and whether the finding should block commit
- let the primary orchestrator adjudicate accepted vs rejected findings; do not edit source or decide scope from the reviewer role
- summarize pass/fail clearly
- update `.ged/STATE.md` with current status and blockers
- if verification fails repeatedly, tighten the plan before retrying
