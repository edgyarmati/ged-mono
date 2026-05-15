# GedCode t3code Isolation Proof

Status: first isolation patch committed in the external t3code scratch checkout.

## Scratch checkout

- Path: `/tmp/pi-github-repos/pingdotgg/t3code`
- Branch: `gedcode-gedpi-driver-spike`
- Commit: `07fede3 chore: isolate gedcode runtime identity`

## Goal

Before any adapted t3code app is launched as GedCode, it must not touch the user's existing t3code setup. This proof starts that isolation by moving the most important runtime identity/storage surfaces to GedCode-owned names and paths.

## What changed in the scratch commit

Patched core runtime/app surfaces from t3code identity toward GedCode identity:

- `~/.t3` default home → `~/.gedcode`
- `T3CODE_*` env vars in core runtime paths → `GEDCODE_*`
- `T3_SSH_*` askpass secret env → `GEDCODE_SSH_*`
- browser local storage prefixes `t3code:` → `gedcode:`
- hosted channel cookie/path prefixes → `gedcode_*` / `__gedcode`
- desktop protocol scheme `t3://` → `gedcode://`
- desktop runtime environment base name `T3 Code` → `GedCode`
- app user data dir names `t3code*` → `gedcode*`
- Linux desktop-entry and WM-class defaults in runtime environment → GedCode-owned values
- SSH helper temp/path names → GedCode-owned values
- project script env names `T3CODE_PROJECT_ROOT` / `T3CODE_WORKTREE_PATH` → GedCode-owned names

This was a **first isolation pass**, not a complete product/package rebrand.

Important safety fix:

- Removed desktop legacy user-data reuse logic in `DesktopAppIdentity.ts`, so the adapted app does **not** check for and reuse the old `T3 Code (Alpha)` app data directory.

## Verification

Command run in the scratch checkout:

```bash
cd /tmp/pi-github-repos/pingdotgg/t3code
bun run build:desktop
```

Result: build succeeded.

## Remaining isolation work

The first patch is intentionally not a complete rebrand. Remaining t3code references are still present, especially in:

- tests
- marketing app
- release/Discord announcement scripts
- hosted domain defaults such as `app.t3.codes`
- `apps/desktop/package.json` `productName`
- `scripts/build-desktop-artifact.ts` `appId`, `productName`, and `artifactName`
- `apps/desktop/scripts/electron-launcher.mjs` launch/package identity strings
- dev Electron marker arg `--t3code-dev-root`
- some source-control/user-facing messages
- Effect service tag strings like `t3/...`
- package names/scopes such as `@t3tools/*`
- CLI package/binary naming (`t3`)

Before launching or packaging a real GedCode fork, the next pass must either rename or explicitly classify each remaining reference as harmless/non-runtime.

## Next step

Implement a real snapshot-only `GedPiDriver` in the isolated scratch branch now that core runtime storage paths no longer default to t3code-owned locations.
