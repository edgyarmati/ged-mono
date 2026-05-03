---
name: verify
description: Run the full quality gate across both packages — type-check, lint, and test. Use before committing or after significant changes.
---

Run the monorepo verification gate from the repository root:

```bash
npm run verify
```

This runs `npm run check` (TypeScript type-check) and `npm test` across both GedCode and GedPi.

If working only in GedPi and you need the full GedPi-specific gate (includes Biome lint + pack check):

```bash
npm --prefix packages/gedpi run verify
```

If verification fails:
1. Fix type errors first (`npm run check` output)
2. Fix lint errors (`npm --prefix packages/gedpi run lint`)
3. Fix test failures last
4. Re-run until clean
