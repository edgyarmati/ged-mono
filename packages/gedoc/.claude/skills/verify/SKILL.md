---
name: verify
description: Run the canonical pre-commit verification for this repo (tsc + node --test across all workspaces). Invoke before every commit, or when the user asks to "verify", "check", or "make sure tests pass".
---

Run, in order, from the repo root:

```bash
npm run check
npm test
```

Both must pass. If either fails:

1. Report the first failing file/test with the exact error.
2. Do not attempt to "fix" by skipping/disabling the failing test or relaxing TypeScript strictness.
3. Fix the underlying issue, then re-run both commands. Loop until clean.

When clean, report a one-line summary: `verify: tsc clean, N tests passed`. Do not narrate intermediate steps unless something failed.
