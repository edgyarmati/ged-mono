# GedCode t3code Runtime Identity Audit

Status: second runtime identity patch committed in the external t3code scratch checkout.

## Scratch checkout

- Path: `/tmp/pi-github-repos/pingdotgg/t3code`
- Branch: `gedcode-gedpi-driver-spike`
- Commit: `fa46136 chore: replace remaining runtime gedcode identity`

## Scope

This pass focused on launch/runtime/package surfaces that could touch or present as t3code during a GedCode smoke run. It intentionally deferred full package-scope/import renaming (`@t3tools/*`), tests, docs, and the marketing app.

## Identity choices used

- Product name: `GedCode`
- Stage names: `GedCode (Alpha)`, `GedCode (Dev)`, `GedCode (Nightly)`
- App id / AUMID: `com.gedcode.app` and `com.gedcode.app.dev`
- Executable / WM class: `gedcode`
- Home/env prefix: `GEDCODE_*`
- Protocol/channel/sentinel names: GedCode-owned equivalents

## What changed

The scratch commit updates these classes of surfaces:

- desktop launcher names and bundle ids
- dev Electron marker arg `--gedcode-dev-root`
- desktop package `productName`
- electron-builder app id, artifact names, executable name, Linux WM class, staged package metadata, and commit hash metadata key
- visible web/app strings from `T3 Code` to `GedCode`
- runtime `T3CODE_*` env readers/hints to `GEDCODE_*`
- terminal env filtering to block both `GEDCODE_*` and legacy `T3CODE_*`
- Codex/OpenCode provider client identity strings
- git author/checkpoint identity strings
- temporary file prefixes, branch prefixes, VCS config path, hosted channel path, and shell sentinels
- release/mock-update/nightly announcement strings used by runtime/release scripts

## Verification

Command run in scratch checkout:

```bash
cd /tmp/pi-github-repos/pingdotgg/t3code
bun run build:desktop
```

Result: passed.

Static source check for in-scope runtime files found no remaining matches for:

- `T3 Code`
- `t3code:`
- `T3CODE_` except the intentional legacy terminal scrubber that blocks inherited `T3CODE_*` secrets
- `.t3code`
- `__T3CODE`
- `com.t3tools.t3code`
- `--t3code-dev-root`
- `/__t3code`

Known intentional/remaining references still exist in excluded areas or compatibility guards:

- `apps/server/src/terminal/Layers/Manager.ts` intentionally still matches `T3CODE_*` so legacy T3 env/secrets are not inherited by terminals

- tests and browser tests
- docs
- marketing app
- package names, workspace scopes, scripts, and imports under `@t3tools/*`
- CLI/server package name `t3`
- hosted default domain decisions such as `app.t3.codes`

## Next step

Smoke the adapted app only after deciding whether the deferred `@t3tools/*` package-scope rename is required before adoption. For a local smoke, use the isolated GedCode runtime paths and verify the GedPi provider appears and reports the current `.ged` snapshot.
