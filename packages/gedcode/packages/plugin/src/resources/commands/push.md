---
description: Push the current branch with automatic recovery if needed
agent: gedcode
---
Push the current branch. Handle any issues gracefully and non-destructively.

Steps:
1. Try `git push`.
2. If it succeeds, report success and stop.
3. If it fails, diagnose the problem, make the minimum safe fix, and retry.
4. Continue until the push succeeds or you determine the issue cannot be resolved safely.

Rules:
- Prefer fixing local repository issues first.
- Do not rewrite history unless it is clearly necessary and safe.
- Do not force-push unless there is a strong explicit reason from the repo state.
- If the fix requires commits, use conventional commit style.
- Explain the root cause and what you changed before the final push result.

When done, report:
- whether push succeeded
- the root cause if there was a failure
- any commits or fixes you made
