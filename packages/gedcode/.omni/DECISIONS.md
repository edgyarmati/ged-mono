# Decisions

- Commit durable `.ged` files that reflect stable project intent, standards, planning, and configuration.
- Ignore runtime/generated `.ged` files by default: `STATE.md`, `SESSION-SUMMARY.md`, `REPO-MAP.md`, and `REPO-MAP.json`.
- Generate the selective ignore policy as `.ged/.gitignore` during bootstrap so new projects inherit the same behavior.
- Pivot the release strategy away from npm/npx-first bootstrap toward a standalone GedCode launcher binary with platform-native installers.
- GedCode will manage one per-user upstream OpenCode runtime by default, using a pinned tested default version with optional future upgrades.
- GedCode should keep the user's normal global `opencode` installation untouched rather than automatically reusing or mutating it.
- Until release-artifact runtime downloads are wired, the managed runtime acquisition mechanism is `npm install -g opencode-ai@<target> --prefix <gedcode-managed-runtime-dir>`.
- Release operations are standardized via `.github/workflows/release.yml`, `scripts/release/bundle.sh`, and `docs/release-checklist.md`; the current release artifact is the generic JS bundle `gedcode-X.Y.Z.tar.gz` plus installer scripts.
