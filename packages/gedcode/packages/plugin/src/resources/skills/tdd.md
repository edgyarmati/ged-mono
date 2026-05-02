# tdd

Use for feature work, behavior changes, bug fixes with a clear seam, and behavior-preserving refactors where a test can describe the intended behavior.

## Core rule

Use a vertical red-green-refactor loop. One behavior at a time:

1. **Red** — write one test that describes observable behavior through a public interface or stable seam; run it and confirm it fails for the expected reason.
2. **Green** — write the smallest implementation that makes that test pass.
3. **Refactor** — only after green, clean up duplication or deepen modules while keeping tests green.

Do not write all tests first and then all implementation. Do not test private implementation details just to get coverage.

## Planning expectations

Record the TDD plan in the active planning directory's `TESTS.md` (`.ged/work/<branch-slug>/TESTS.md` for branch-backed work, with root `.ged/TESTS.md` only as legacy fallback):

- behavior under test;
- public interface or seam exercised by the test;
- expected red failure;
- command to run the focused test;
- broader verification command;
- explicit reason if TDD is not applicable for the slice.

## Per-cycle checklist

- [ ] The test names behavior, not implementation.
- [ ] The test uses a public interface or stable seam.
- [ ] The test would survive an internal refactor.
- [ ] The red failure was observed or a justified exception was recorded.
- [ ] The implementation is minimal for the current behavior.
- [ ] Refactoring only happened while tests were green.

## When not to force TDD

Do not invent brittle tests for docs-only changes, release/process changes, pure configuration edits, exploratory review, or changes where no meaningful executable seam exists yet. In those cases, document why TDD is not applicable and still run the planned verification.
