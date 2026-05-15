# GedCode t3code GedPiDriver Proof Notes

Status: snapshot bridge proof succeeded in t3code scratch checkout.

## Goal

Prove that a t3code-side process can call the new GedPi headless JSONL command and read a structured project snapshot. This is the first concrete step toward a t3code `GedPiDriver`.

## Scratch environment

- t3code checkout: `/tmp/pi-github-repos/pingdotgg/t3code`
- t3code scratch branch: `gedcode-gedpi-driver-spike`
- Ged repo: `/Users/edgy/personal/ged-mono`

No t3code settings were intentionally modified for this proof. The proof script directly invokes the local GedPi binary and prints only a minimal result summary.

## Proof script

Created in scratch checkout only, not imported into this repo:

- `/tmp/pi-github-repos/pingdotgg/t3code/scripts/gedpi-snapshot-proof.ts`

Behavior:

- spawns the local GedPi binary via the current JS runtime: `/Users/edgy/personal/ged-mono/packages/gedpi/bin/gedpi.js --headless-jsonl --project <project>`
- writes JSONL command `{ "id": "snapshot", "type": "snapshot.read" }`
- parses `response.snapshot`
- prints a minimal proof result

Command run:

```bash
cd /tmp/pi-github-repos/pingdotgg/t3code
bun scripts/gedpi-snapshot-proof.ts /Users/edgy/personal/ged-mono
```

Output:

```json
{
  "ok": true,
  "workId": "plan-gedcode-desktop-gui",
  "gedInitialized": true,
  "hasSettings": true
}
```

## What this proves

- t3code's Bun/Node environment can launch GedPi headless mode.
- The JSONL transport works from a t3code-side process.
- GedPi returns enough state for a provider snapshot:
  - work id
  - `.ged` initialization
  - settings summary
  - richer snapshot fields available in the full response

## Minimal GedPiDriver target

Target files in a t3code fork:

- `packages/contracts/src/settings.ts`
  - add `GedPiSettings` using `makeProviderSettingsSchema`
- `apps/server/src/provider/Drivers/GedPiDriver.ts`
  - new `ProviderDriver`
- `apps/server/src/provider/builtInDrivers.ts`
  - register `GedPiDriver`
- `apps/web/src/components/settings/providerDriverMeta.ts`
  - add `gedpi` provider settings definition
- `apps/web/src/components/settings/AddProviderInstanceDialog.tsx`
  - expose GedPi/Pi Agent as an available provider instead of coming soon

Initial config fields:

- `binaryPath`: default `gedpi`
- `projectRoot`: optional override; default to t3code server cwd/project cwd
- `customModels`: hidden array for future model catalog additions
- future Ged settings fields can bridge to `.gedoc/settings.json` once the storage model is decided

Initial snapshot behavior:

1. Spawn `binaryPath --headless-jsonl --project <cwd>`.
2. Send `{ id: "snapshot", type: "snapshot.read" }`.
3. Parse `response.snapshot`.
4. Produce a t3code `ServerProvider` snapshot:
   - installed: true if command starts and responds
   - status: `ready` if `gedInitialized` true, `warning` if project lacks `.ged`
   - version: from `gedpi --version` in a later step
   - message: summarize active work/checkpoint status

Initial adapter behavior:

- `startSession`, `sendTurn`, and `streamEvents` should remain unsupported/no-op until GedPi supports session/prompt JSONL commands.
- This avoids pretending prompt submission is solved and preserves the single-writer boundary.

## Isolation requirement before real app launch

Before running an adapted t3code app as GedCode against real projects, the fork must rename/isolate all runtime identity and storage:

- app name / desktop identity: GedCode
- app data, cache, database, userData: GedCode-owned paths, not `~/.t3`
- env vars: `GEDCODE_*`, not `T3CODE_*`
- release/update channels: GedCode-owned
- no reads/writes/migration of existing t3code settings unless explicitly requested later

This proof only used t3code as a scratch process launcher and did not require launching the t3code app against user data.

## Next implementation step

Create an isolated t3code fork/worktree that first changes identity/storage paths to GedCode-owned paths, then add a snapshot-only `GedPiDriver` using the proof script logic.
