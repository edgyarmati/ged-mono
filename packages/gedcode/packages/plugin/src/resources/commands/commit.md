---
description: Review local changes and create a descriptive conventional commit
agent: gedcode
---
Review the current repository changes and commit whatever is ready to be committed.

Requirements:
- Inspect the working tree first so you understand what changed.
- Stage the files that belong in this commit.
- Run relevant lightweight verification when needed before committing.
- For meaningful implementation changes, run `/clean-context-review` or explicitly confirm that a clean-context review has already been completed and adjudicated for this slice.
- Write a descriptive conventional commit message that explains the real user-facing or developer-facing change.
- Prefer a single well-scoped commit for the current work.
- Do not push.

Commit message rules:
- Always use conventional commit style: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `ci:`, `build:`, `perf:`.
- The summary line must be specific and useful — not generic.
- Add a body when it helps explain important details, grouped changes, or verification.

When done, report:
- the commit hash
- the commit message
- any checks you ran
