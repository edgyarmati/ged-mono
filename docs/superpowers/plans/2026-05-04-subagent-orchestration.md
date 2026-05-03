# Subagent Orchestration for GedPi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring GedCode's mandatory subagent checkpoints (ged-explorer, ged-planner, ged-verifier) to GedPi with both prompt-level and code-level enforcement, gated by a trivial/non-trivial classification.

**Architecture:** The brain's system prompt gains orchestration instructions (matching GedCode's `orchestrationPrompt()` pattern) that tell the brain when and how to dispatch subagents via the `subagent` tool. A new `orchestration.ts` module tracks checkpoint state in `.ged/runtime/checkpoints.json`. The `ged-core` extension's `before_agent_start` hook conditionally injects the orchestration prompt, and a new `turn_end` hook validates that checkpoints were followed before commits.

**Tech Stack:** TypeScript (ESM, Node 22+), Vitest, Biome, Pi extension API (`@mariozechner/pi-coding-agent`)

---

## File Structure

**New files:**
- `packages/gedpi/src/orchestration.ts` — Checkpoint types, read/write checkpoint state, orchestration prompt builder, trivial/non-trivial classification helpers
- `packages/gedpi/tests/orchestration.test.ts` — Tests for all orchestration module exports

**Modified files:**
- `packages/gedpi/src/brain.ts` — New `buildOrchestrationPromptSuffix()` export that conditionally appends orchestration instructions
- `packages/gedpi/src/contracts.ts` — New `TaskClassification` type and `CheckpointState` interface
- `packages/gedpi/extensions/ged-core/index.ts` — Integrate orchestration prompt in `before_agent_start`; add `turn_end` hook for checkpoint validation

---

### Task 1: Add checkpoint types to contracts.ts

**Files:**
- Modify: `packages/gedpi/src/contracts.ts:60-67`
- Test: `packages/gedpi/tests/orchestration.test.ts`

- [ ] **Step 1: Write the failing test**

Create the test file with imports that reference the new types:

```typescript
// packages/gedpi/tests/orchestration.test.ts
import { describe, it, expect } from "vitest";
import type {
  TaskClassification,
  CheckpointRecord,
  CheckpointState,
} from "../src/contracts.js";

describe("checkpoint types", () => {
  it("CheckpointState has expected shape", () => {
    const state: CheckpointState = {
      classification: "non-trivial",
      classificationReason: "Feature implementation spanning multiple files",
      planCheckpoints: {},
      taskCheckpoints: {},
    };
    expect(state.classification).toBe("non-trivial");
    expect(state.planCheckpoints).toEqual({});
  });

  it("trivial classification skips checkpoint tracking", () => {
    const state: CheckpointState = {
      classification: "trivial",
      classificationReason: "README update",
      planCheckpoints: {},
      taskCheckpoints: {},
    };
    expect(state.classification).toBe("trivial");
  });

  it("CheckpointRecord tracks agent execution", () => {
    const record: CheckpointRecord = {
      agent: "ged-verifier",
      timestamp: "2026-05-04T10:00:00Z",
      status: "completed",
      findingCount: 2,
      blocksCommit: false,
    };
    expect(record.agent).toBe("ged-verifier");
    expect(record.status).toBe("completed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix packages/gedpi test -- --run tests/orchestration.test.ts`
Expected: FAIL — `CheckpointState`, `CheckpointRecord`, `TaskClassification` not exported from contracts.ts

- [ ] **Step 3: Add types to contracts.ts**

Append after the `GedState` interface (after line 67):

```typescript
export type TaskClassification = "trivial" | "non-trivial";

export interface CheckpointRecord {
  agent: "ged-explorer" | "ged-planner" | "ged-verifier";
  timestamp: string;
  status: "completed" | "skipped";
  skipReason?: string;
  findingCount?: number;
  blocksCommit?: boolean;
}

export interface CheckpointState {
  classification: TaskClassification;
  classificationReason: string;
  planCheckpoints: Partial<Record<"ged-explorer" | "ged-planner", CheckpointRecord>>;
  taskCheckpoints: Record<string, Partial<Record<"ged-explorer" | "ged-verifier", CheckpointRecord>>>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix packages/gedpi test -- --run tests/orchestration.test.ts`
Expected: PASS

- [ ] **Step 5: Run type-check**

Run: `npm --prefix packages/gedpi run check`
Expected: PASS with no new errors

- [ ] **Step 6: Commit**

```bash
git add packages/gedpi/src/contracts.ts packages/gedpi/tests/orchestration.test.ts
git commit -m "feat: add checkpoint and classification types to contracts"
```

---

### Task 2: Create orchestration module with checkpoint state management

**Files:**
- Create: `packages/gedpi/src/orchestration.ts`
- Test: `packages/gedpi/tests/orchestration.test.ts`

- [ ] **Step 1: Write the failing tests for checkpoint state read/write**

Append to `packages/gedpi/tests/orchestration.test.ts`:

```typescript
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";
import {
  readCheckpointState,
  writeCheckpointState,
  recordCheckpoint,
  initCheckpointState,
} from "../src/orchestration.js";

describe("checkpoint state management", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "ged-orch-"));
    await mkdir(path.join(tmpDir, ".ged", "runtime"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null when no checkpoint file exists", async () => {
    const state = await readCheckpointState(tmpDir);
    expect(state).toBeNull();
  });

  it("initializes checkpoint state with classification", async () => {
    const state = initCheckpointState("non-trivial", "Multi-file feature");
    expect(state.classification).toBe("non-trivial");
    expect(state.classificationReason).toBe("Multi-file feature");
    expect(state.planCheckpoints).toEqual({});
    expect(state.taskCheckpoints).toEqual({});
  });

  it("round-trips checkpoint state through write and read", async () => {
    const state = initCheckpointState("non-trivial", "Feature work");
    await writeCheckpointState(tmpDir, state);
    const loaded = await readCheckpointState(tmpDir);
    expect(loaded).toEqual(state);
  });

  it("records a plan checkpoint", async () => {
    const state = initCheckpointState("non-trivial", "Feature work");
    await writeCheckpointState(tmpDir, state);

    const updated = recordCheckpoint(state, {
      agent: "ged-planner",
      timestamp: "2026-05-04T10:00:00Z",
      status: "completed",
      findingCount: 3,
    });

    expect(updated.planCheckpoints["ged-planner"]).toEqual({
      agent: "ged-planner",
      timestamp: "2026-05-04T10:00:00Z",
      status: "completed",
      findingCount: 3,
    });
  });

  it("records a task checkpoint", async () => {
    const state = initCheckpointState("non-trivial", "Feature work");
    const updated = recordCheckpoint(state, {
      agent: "ged-verifier",
      timestamp: "2026-05-04T11:00:00Z",
      status: "completed",
      findingCount: 0,
      blocksCommit: false,
    }, "T04");

    expect(updated.taskCheckpoints["T04"]?.["ged-verifier"]).toEqual({
      agent: "ged-verifier",
      timestamp: "2026-05-04T11:00:00Z",
      status: "completed",
      findingCount: 0,
      blocksCommit: false,
    });
  });

  it("records a skipped checkpoint with reason", async () => {
    const state = initCheckpointState("trivial", "README update");
    const updated = recordCheckpoint(state, {
      agent: "ged-planner",
      timestamp: "2026-05-04T10:00:00Z",
      status: "skipped",
      skipReason: "Task classified as trivial",
    });

    expect(updated.planCheckpoints["ged-planner"]?.status).toBe("skipped");
    expect(updated.planCheckpoints["ged-planner"]?.skipReason).toBe(
      "Task classified as trivial",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix packages/gedpi test -- --run tests/orchestration.test.ts`
Expected: FAIL — module `../src/orchestration.js` not found

- [ ] **Step 3: Implement the orchestration module**

Create `packages/gedpi/src/orchestration.ts`:

```typescript
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { writeFileAtomic } from "./atomic.js";
import type {
  CheckpointRecord,
  CheckpointState,
  TaskClassification,
} from "./contracts.js";

const CHECKPOINT_FILE = ".ged/runtime/checkpoints.json";

export function initCheckpointState(
  classification: TaskClassification,
  classificationReason: string,
): CheckpointState {
  return {
    classification,
    classificationReason,
    planCheckpoints: {},
    taskCheckpoints: {},
  };
}

export async function readCheckpointState(
  rootDir: string,
): Promise<CheckpointState | null> {
  try {
    const raw = await readFile(
      path.join(rootDir, CHECKPOINT_FILE),
      "utf8",
    );
    return JSON.parse(raw) as CheckpointState;
  } catch {
    return null;
  }
}

export async function writeCheckpointState(
  rootDir: string,
  state: CheckpointState,
): Promise<void> {
  const filePath = path.join(rootDir, CHECKPOINT_FILE);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFileAtomic(filePath, `${JSON.stringify(state, null, 2)}\n`);
}

type PlanAgent = "ged-explorer" | "ged-planner";
type TaskAgent = "ged-explorer" | "ged-verifier";

export function recordCheckpoint(
  state: CheckpointState,
  record: CheckpointRecord,
  taskId?: string,
): CheckpointState {
  if (taskId) {
    const agent = record.agent as TaskAgent;
    return {
      ...state,
      taskCheckpoints: {
        ...state.taskCheckpoints,
        [taskId]: {
          ...state.taskCheckpoints[taskId],
          [agent]: record,
        },
      },
    };
  }
  const agent = record.agent as PlanAgent;
  return {
    ...state,
    planCheckpoints: {
      ...state.planCheckpoints,
      [agent]: record,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix packages/gedpi test -- --run tests/orchestration.test.ts`
Expected: PASS (all 7 tests)

- [ ] **Step 5: Run type-check**

Run: `npm --prefix packages/gedpi run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/gedpi/src/orchestration.ts packages/gedpi/tests/orchestration.test.ts
git commit -m "feat: add orchestration module with checkpoint state management"
```

---

### Task 3: Add checkpoint validation helpers

**Files:**
- Modify: `packages/gedpi/src/orchestration.ts`
- Test: `packages/gedpi/tests/orchestration.test.ts`

- [ ] **Step 1: Write failing tests for validation functions**

Append to `packages/gedpi/tests/orchestration.test.ts`:

```typescript
import {
  validatePlanCheckpoints,
  validateCommitCheckpoints,
} from "../src/orchestration.js";

describe("checkpoint validation", () => {
  it("plan validation passes when ged-planner completed", () => {
    const state = initCheckpointState("non-trivial", "Feature work");
    const withPlanner = recordCheckpoint(state, {
      agent: "ged-planner",
      timestamp: "2026-05-04T10:00:00Z",
      status: "completed",
      findingCount: 1,
    });
    const result = validatePlanCheckpoints(withPlanner);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("plan validation fails when ged-planner missing for non-trivial", () => {
    const state = initCheckpointState("non-trivial", "Feature work");
    const result = validatePlanCheckpoints(state);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("ged-planner");
  });

  it("plan validation passes for trivial classification", () => {
    const state = initCheckpointState("trivial", "README update");
    const result = validatePlanCheckpoints(state);
    expect(result.valid).toBe(true);
  });

  it("commit validation passes when ged-verifier completed", () => {
    const state = initCheckpointState("non-trivial", "Feature work");
    const withVerifier = recordCheckpoint(state, {
      agent: "ged-verifier",
      timestamp: "2026-05-04T11:00:00Z",
      status: "completed",
      findingCount: 0,
      blocksCommit: false,
    }, "T04");
    const result = validateCommitCheckpoints(withVerifier, "T04");
    expect(result.valid).toBe(true);
  });

  it("commit validation fails when ged-verifier missing for non-trivial", () => {
    const state = initCheckpointState("non-trivial", "Feature work");
    const result = validateCommitCheckpoints(state, "T04");
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("ged-verifier");
  });

  it("commit validation passes for trivial classification", () => {
    const state = initCheckpointState("trivial", "Config change");
    const result = validateCommitCheckpoints(state, "T01");
    expect(result.valid).toBe(true);
  });

  it("commit validation passes when checkpoint was skipped with reason", () => {
    const state = initCheckpointState("non-trivial", "Feature work");
    const withSkip = recordCheckpoint(state, {
      agent: "ged-verifier",
      timestamp: "2026-05-04T11:00:00Z",
      status: "skipped",
      skipReason: "User asked to skip",
    }, "T04");
    const result = validateCommitCheckpoints(withSkip, "T04");
    expect(result.valid).toBe(true);
  });

  it("validation returns null state message when no checkpoint file", () => {
    const result = validatePlanCheckpoints(null);
    expect(result.valid).toBe(true);
    expect(result.warning).toBe("No checkpoint state found — subagents may not be enabled");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix packages/gedpi test -- --run tests/orchestration.test.ts`
Expected: FAIL — `validatePlanCheckpoints` and `validateCommitCheckpoints` not found

- [ ] **Step 3: Add validation functions to orchestration.ts**

Append to `packages/gedpi/src/orchestration.ts`:

```typescript
export interface CheckpointValidation {
  valid: boolean;
  missing: string[];
  warning?: string;
}

export function validatePlanCheckpoints(
  state: CheckpointState | null,
): CheckpointValidation {
  if (!state) {
    return { valid: true, missing: [], warning: "No checkpoint state found — subagents may not be enabled" };
  }
  if (state.classification === "trivial") {
    return { valid: true, missing: [] };
  }
  const missing: string[] = [];
  const planner = state.planCheckpoints["ged-planner"];
  if (!planner) {
    missing.push("ged-planner");
  }
  return { valid: missing.length === 0, missing };
}

export function validateCommitCheckpoints(
  state: CheckpointState | null,
  taskId: string,
): CheckpointValidation {
  if (!state) {
    return { valid: true, missing: [], warning: "No checkpoint state found — subagents may not be enabled" };
  }
  if (state.classification === "trivial") {
    return { valid: true, missing: [] };
  }
  const missing: string[] = [];
  const verifier = state.taskCheckpoints[taskId]?.["ged-verifier"];
  if (!verifier) {
    missing.push("ged-verifier");
  }
  return { valid: missing.length === 0, missing };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix packages/gedpi test -- --run tests/orchestration.test.ts`
Expected: PASS (all 15 tests)

- [ ] **Step 5: Run type-check**

Run: `npm --prefix packages/gedpi run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/gedpi/src/orchestration.ts packages/gedpi/tests/orchestration.test.ts
git commit -m "feat: add checkpoint validation helpers for plan and commit gates"
```

---

### Task 4: Build the orchestration prompt

**Files:**
- Modify: `packages/gedpi/src/orchestration.ts`
- Test: `packages/gedpi/tests/orchestration.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/gedpi/tests/orchestration.test.ts`:

```typescript
import { buildOrchestrationPrompt } from "../src/orchestration.js";

describe("orchestration prompt", () => {
  it("returns empty string when agents disabled", () => {
    const result = buildOrchestrationPrompt(false);
    expect(result).toBe("");
  });

  it("includes single-writer invariant when enabled", () => {
    const result = buildOrchestrationPrompt(true);
    expect(result).toContain("Single-writer invariant");
  });

  it("includes task classification instructions", () => {
    const result = buildOrchestrationPrompt(true);
    expect(result).toContain("TRIVIAL");
    expect(result).toContain("NON-TRIVIAL");
  });

  it("names all three mandatory checkpoints", () => {
    const result = buildOrchestrationPrompt(true);
    expect(result).toContain("ged-explorer");
    expect(result).toContain("ged-planner");
    expect(result).toContain("ged-verifier");
  });

  it("includes skip policy", () => {
    const result = buildOrchestrationPrompt(true);
    expect(result).toContain("skip reason");
  });

  it("includes clean-context review instructions", () => {
    const result = buildOrchestrationPrompt(true);
    expect(result).toContain("clean-context review");
    expect(result).toContain("adjudicate");
  });

  it("references subagent tool for dispatch", () => {
    const result = buildOrchestrationPrompt(true);
    expect(result).toContain("subagent");
  });

  it("references checkpoint state file", () => {
    const result = buildOrchestrationPrompt(true);
    expect(result).toContain("checkpoints.json");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix packages/gedpi test -- --run tests/orchestration.test.ts`
Expected: FAIL — `buildOrchestrationPrompt` not found

- [ ] **Step 3: Implement the orchestration prompt builder**

Append to `packages/gedpi/src/orchestration.ts`:

```typescript
export function buildOrchestrationPrompt(agentsEnabled: boolean): string {
  if (!agentsEnabled) {
    return "";
  }

  return `## Subagent orchestration (mandatory for non-trivial work)

Single-writer invariant: you are the sole active-worktree writer, synthesizer, and decision owner. Subagents inject read-only intelligence; they do not own product decisions, commits, PR decisions, or final verification judgments.

### Task classification (FIRST STEP for every new request)

Before any planning or implementation, classify the incoming request:

- **TRIVIAL**: Questions, documentation-only changes, README edits, config tweaks, single-line formatting fixes, adding comments. Skip the subagent workflow entirely.
- **NON-TRIVIAL**: Feature implementation, bug fixes, refactoring, multi-file changes, architectural work. Mandatory subagent checkpoints apply below.

Write your classification and reason to .ged/runtime/checkpoints.json using:
\`\`\`json
{"classification": "trivial|non-trivial", "classificationReason": "...", "planCheckpoints": {}, "taskCheckpoints": {}}
\`\`\`

### Mandatory checkpoints for non-trivial work

When subagents are enabled and the task is non-trivial, use mandatory intelligence checkpoints:

1. **ged-explorer** — Dispatch via the subagent tool for evidence-backed codebase discovery when relevant code context is not already known. Use before planning to understand existing patterns, dependencies, and risks.

2. **ged-planner** — Dispatch via the subagent tool before finalizing or materially changing .ged/SPEC.md, .ged/TASKS.md, or .ged/TESTS.md. The planner critiques your plan and identifies missing context, edge cases, and test seams. You adjudicate the findings and write the final planning files.

3. **ged-verifier** — Dispatch via the subagent tool for clean-context review before committing meaningful implementation changes. The verifier reviews your diff and tests with minimal prior assumptions. You adjudicate each finding (accept, reject, needs-user), fix accepted issues, and rerun verification.

After each subagent completes, record the checkpoint in .ged/runtime/checkpoints.json:
\`\`\`json
{"agent": "ged-verifier", "timestamp": "...", "status": "completed", "findingCount": 2, "blocksCommit": false}
\`\`\`

### Skip policy

If a checkpoint is skipped because the task is trivial, subagents are disabled or unavailable, the call fails, or the user explicitly asks not to delegate, record a checkpoint with status "skipped" and a skipReason. Example:
\`\`\`json
{"agent": "ged-planner", "timestamp": "...", "status": "skipped", "skipReason": "User asked to skip planning critique"}
\`\`\`

### Clean-context review flow (before every meaningful commit)

1. Run all planned checks from .ged/TESTS.md
2. Dispatch ged-verifier for clean-context review of the diff and tests
3. Adjudicate each finding: accept (fix before commit), reject (record reason), or needs-user (ask)
4. Fix accepted issues and rerun verification
5. Record the checkpoint, then commit

### Intercom usage

Use pi-intercom only for child-to-parent clarification when a subagent is blocked on a scope or product decision. Child agents must ask instead of guessing.

There is no writer subagent role. Do not delegate source edits, planning-file ownership, scope decisions, verification adjudication, commits, pushes, or PR decisions to subagents.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix packages/gedpi test -- --run tests/orchestration.test.ts`
Expected: PASS (all 23 tests)

- [ ] **Step 5: Run type-check and lint**

Run: `npm --prefix packages/gedpi run check && npm --prefix packages/gedpi run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/gedpi/src/orchestration.ts packages/gedpi/tests/orchestration.test.ts
git commit -m "feat: add orchestration prompt builder for subagent checkpoints"
```

---

### Task 5: Integrate orchestration prompt into brain.ts

**Files:**
- Modify: `packages/gedpi/src/brain.ts:164-185`
- Test: `packages/gedpi/tests/orchestration.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/gedpi/tests/orchestration.test.ts`:

```typescript
import { buildWorkflowPromptSuffix } from "../src/brain.js";
import { writeFileAtomic } from "../src/atomic.js";
import {
  writeGedAgentsSettings,
  globalGedSettingsPath,
} from "../src/agent-settings.js";

describe("brain orchestration integration", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "ged-brain-orch-"));
    await mkdir(path.join(tmpDir, ".ged"), { recursive: true });
    await writeFileAtomic(
      path.join(tmpDir, ".ged", "STATE.md"),
      "Current phase: plan\nActive task: T01\nStatus summary: planning\nBlockers: None\nNext step: implement\n",
    );
    await writeFileAtomic(
      path.join(tmpDir, ".ged", "TASKS.md"),
      "| ID | Title |\n|---|---|\n| T01 | Test |\n",
    );
    await writeFileAtomic(
      path.join(tmpDir, ".ged", "TESTS.md"),
      "## Checks\n- npm test\n",
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("includes orchestration prompt when agents enabled", async () => {
    await mkdir(path.join(tmpDir, ".gedcode"), { recursive: true });
    await writeFileAtomic(
      path.join(tmpDir, ".gedcode", "settings.json"),
      JSON.stringify({ agents: { enabled: true } }),
    );
    const suffix = await buildWorkflowPromptSuffix(tmpDir);
    expect(suffix).toContain("Subagent orchestration");
    expect(suffix).toContain("Single-writer invariant");
  });

  it("omits orchestration prompt when agents disabled", async () => {
    await mkdir(path.join(tmpDir, ".gedcode"), { recursive: true });
    await writeFileAtomic(
      path.join(tmpDir, ".gedcode", "settings.json"),
      JSON.stringify({ agents: { enabled: false } }),
    );
    const suffix = await buildWorkflowPromptSuffix(tmpDir);
    expect(suffix).not.toContain("Subagent orchestration");
  });

  it("omits orchestration prompt when no settings file", async () => {
    const suffix = await buildWorkflowPromptSuffix(tmpDir);
    expect(suffix).not.toContain("Subagent orchestration");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix packages/gedpi test -- --run tests/orchestration.test.ts`
Expected: FAIL — `buildWorkflowPromptSuffix` does not yet include orchestration prompt

- [ ] **Step 3: Modify brain.ts to integrate orchestration prompt**

In `packages/gedpi/src/brain.ts`, add the import at the top (after line 2):

```typescript
import { readEffectiveGedAgentsSettings } from "./agent-settings.js";
import { buildOrchestrationPrompt } from "./orchestration.js";
```

Then modify `buildWorkflowPromptSuffix` (lines 164-185) to include the orchestration prompt:

Replace the existing function body:

```typescript
export async function buildWorkflowPromptSuffix(cwd: string): Promise<string> {
  const state = await readGedStatus(cwd).catch(() => null);
  const [tasks, tests] = await Promise.all([
    readOptional(path.join(cwd, ".ged", "TASKS.md")),
    readOptional(path.join(cwd, ".ged", "TESTS.md")),
  ]);

  const agentSettings = await readEffectiveGedAgentsSettings(cwd).catch(
    () => null,
  );
  const orchestrationPrompt = buildOrchestrationPrompt(
    agentSettings?.enabled ?? false,
  );

  return [
    BRAIN_SYSTEM_APPEND,
    orchestrationPrompt,
    `## Current Durable Task State

${renderStateSummary(state)}

## Current Ged Workflow Files

### .ged/TASKS.md
${clipSection(tasks, 1600)}

### .ged/TESTS.md
${clipSection(tests, 1200)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix packages/gedpi test -- --run tests/orchestration.test.ts`
Expected: PASS

- [ ] **Step 5: Run full verify**

Run: `npm --prefix packages/gedpi run verify`
Expected: PASS — no regressions in existing tests

- [ ] **Step 6: Commit**

```bash
git add packages/gedpi/src/brain.ts packages/gedpi/tests/orchestration.test.ts
git commit -m "feat: inject orchestration prompt into brain when subagents enabled"
```

---

### Task 6: Add turn_end checkpoint validation to ged-core extension

**Files:**
- Modify: `packages/gedpi/extensions/ged-core/index.ts`
- Modify: `packages/gedpi/src/orchestration.ts` (add git commit detection helper)
- Test: `packages/gedpi/tests/orchestration.test.ts`

- [ ] **Step 1: Write the failing test for commit detection**

Append to `packages/gedpi/tests/orchestration.test.ts`:

```typescript
import { detectRecentCommits } from "../src/orchestration.js";

describe("commit detection", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "ged-git-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array in non-git directory", async () => {
    const commits = await detectRecentCommits(tmpDir, 60);
    expect(commits).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix packages/gedpi test -- --run tests/orchestration.test.ts`
Expected: FAIL — `detectRecentCommits` not found

- [ ] **Step 3: Add commit detection to orchestration.ts**

Append to `packages/gedpi/src/orchestration.ts`:

```typescript
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function detectRecentCommits(
  rootDir: string,
  withinSeconds: number,
): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", `--since=${withinSeconds} seconds ago`, "--format=%H", "--no-merges"],
      { cwd: rootDir, timeout: 5000 },
    );
    return stdout
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix packages/gedpi test -- --run tests/orchestration.test.ts`
Expected: PASS

- [ ] **Step 5: Add the turn_end hook to ged-core extension**

In `packages/gedpi/extensions/ged-core/index.ts`, add imports at the top:

```typescript
import {
  detectRecentCommits,
  readCheckpointState,
  validateCommitCheckpoints,
  validatePlanCheckpoints,
} from "../../src/orchestration.js";
import { readEffectiveGedAgentsSettings } from "../../src/agent-settings.js";
import { readGedMode } from "../../src/theme.js";
```

Note: `readGedMode` and `readEffectiveGedAgentsSettings` are already imported — adjust the import to avoid duplicates.

Then add the `turn_end` hook at the end of the `gedCoreExtension` function (before the closing `}`):

```typescript
  api.on("turn_end", async (_event, ctx) => {
    const gedMode = readGedMode(ctx.cwd);
    if (!gedMode) return;

    const agentSettings = await readEffectiveGedAgentsSettings(ctx.cwd).catch(
      () => null,
    );
    if (!agentSettings?.enabled) return;

    const recentCommits = await detectRecentCommits(ctx.cwd, 120);
    if (recentCommits.length === 0) return;

    const checkpointState = await readCheckpointState(ctx.cwd);
    if (!checkpointState || checkpointState.classification === "trivial") return;

    const activeTask = checkpointState.taskCheckpoints
      ? Object.keys(checkpointState.taskCheckpoints).pop()
      : undefined;

    const commitValidation = validateCommitCheckpoints(
      checkpointState,
      activeTask ?? "unknown",
    );

    if (!commitValidation.valid) {
      api.sendMessage({
        customType: "ged-checkpoint-warning",
        content: `⚠️ Checkpoint warning: You committed without completing required checkpoints: ${commitValidation.missing.join(", ")}. For non-trivial work, dispatch ged-verifier for clean-context review before committing. If intentionally skipped, record a skip reason in .ged/runtime/checkpoints.json.`,
        display: true,
        details: { title: "checkpoint-gate", missing: commitValidation.missing },
      });
    }
  });
```

- [ ] **Step 6: Run type-check and lint**

Run: `npm --prefix packages/gedpi run check && npm --prefix packages/gedpi run lint`
Expected: PASS

- [ ] **Step 7: Run full verify**

Run: `npm --prefix packages/gedpi run verify`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/gedpi/extensions/ged-core/index.ts packages/gedpi/src/orchestration.ts packages/gedpi/tests/orchestration.test.ts
git commit -m "feat: add turn_end checkpoint validation for commit gate enforcement"
```

---

### Task 7: Remove redundant subagent lines from brain.ts BRAIN_SYSTEM_APPEND

**Files:**
- Modify: `packages/gedpi/src/brain.ts:43-48`

- [ ] **Step 1: Verify the orchestration prompt covers the old content**

Read both sections and confirm the orchestration prompt (from `buildOrchestrationPrompt`) fully supersedes the static lines 43-48 of `BRAIN_SYSTEM_APPEND`. The orchestration prompt covers:
- Single-writer invariant ✓
- Subagent delegation rules ✓
- pi-intercom usage ✓
- No writer roles ✓

- [ ] **Step 2: Replace the static subagent section with a conditional pointer**

In `packages/gedpi/src/brain.ts`, replace lines 43-48 (the "Optional subagent intelligence:" block) with:

```typescript
When optional Ged subagents are enabled, follow the orchestration instructions appended below. When disabled, you are the sole intelligence — no delegation needed.
```

This replaces the 6-line static block with a 1-line pointer that defers to the dynamic orchestration prompt (which is conditionally appended by `buildWorkflowPromptSuffix`).

- [ ] **Step 3: Run full verify**

Run: `npm --prefix packages/gedpi run verify`
Expected: PASS — no regressions

- [ ] **Step 4: Commit**

```bash
git add packages/gedpi/src/brain.ts
git commit -m "refactor: replace static subagent lines with pointer to dynamic orchestration prompt"
```

---

### Task 8: Update the single-writer orchestration design doc

**Files:**
- Modify: `packages/gedpi/docs/single-writer-intelligence-orchestration.md`

- [ ] **Step 1: Add implementation status section**

Append to the end of the design doc:

```markdown
## Implementation Status (2026-05-04)

### Implemented
- Orchestration prompt injected into brain system prompt when `agents.enabled: true`
- Task classification gate: trivial tasks skip subagent workflow, non-trivial get mandatory checkpoints
- Checkpoint state tracking in `.ged/runtime/checkpoints.json`
- Turn-end validation: warns if commits happen without ged-verifier checkpoint for non-trivial work
- Skip-with-reason recording for intentionally skipped checkpoints
- Prompt instructs brain to dispatch subagents via the `subagent` tool at three mandatory checkpoints

### How enforcement works
1. **Prompt enforcement**: The orchestration prompt tells the brain exactly when to dispatch each subagent and how to record checkpoints
2. **Code enforcement**: The `turn_end` hook detects recent commits and validates that ged-verifier was run (or explicitly skipped) for non-trivial tasks
3. **Classification gate**: The brain classifies each request as trivial or non-trivial at the start. Trivial tasks bypass all subagent checkpoints.

### Files involved
- `src/orchestration.ts` — checkpoint state management, validation, orchestration prompt
- `src/brain.ts` — conditional orchestration prompt injection
- `src/contracts.ts` — checkpoint and classification types
- `extensions/ged-core/index.ts` — turn_end checkpoint validation hook
```

- [ ] **Step 2: Commit**

```bash
git add packages/gedpi/docs/single-writer-intelligence-orchestration.md
git commit -m "docs: update orchestration design doc with implementation status"
```

---

### Task 9: End-to-end integration test

**Files:**
- Test: `packages/gedpi/tests/orchestration.test.ts`

- [ ] **Step 1: Write an integration test for the full orchestration flow**

Append to `packages/gedpi/tests/orchestration.test.ts`:

```typescript
describe("orchestration integration", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "ged-orch-int-"));
    await mkdir(path.join(tmpDir, ".ged", "runtime"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("full non-trivial workflow: init → plan checkpoint → task checkpoint → validate", async () => {
    let state = initCheckpointState("non-trivial", "Add user authentication");
    await writeCheckpointState(tmpDir, state);

    const planCheck = validatePlanCheckpoints(state);
    expect(planCheck.valid).toBe(false);
    expect(planCheck.missing).toContain("ged-planner");

    state = recordCheckpoint(state, {
      agent: "ged-planner",
      timestamp: new Date().toISOString(),
      status: "completed",
      findingCount: 2,
    });
    await writeCheckpointState(tmpDir, state);

    const planCheck2 = validatePlanCheckpoints(state);
    expect(planCheck2.valid).toBe(true);

    const commitCheck = validateCommitCheckpoints(state, "T01");
    expect(commitCheck.valid).toBe(false);
    expect(commitCheck.missing).toContain("ged-verifier");

    state = recordCheckpoint(state, {
      agent: "ged-verifier",
      timestamp: new Date().toISOString(),
      status: "completed",
      findingCount: 0,
      blocksCommit: false,
    }, "T01");
    await writeCheckpointState(tmpDir, state);

    const commitCheck2 = validateCommitCheckpoints(state, "T01");
    expect(commitCheck2.valid).toBe(true);

    const persisted = await readCheckpointState(tmpDir);
    expect(persisted?.classification).toBe("non-trivial");
    expect(persisted?.planCheckpoints["ged-planner"]?.status).toBe("completed");
    expect(persisted?.taskCheckpoints["T01"]?.["ged-verifier"]?.status).toBe("completed");
  });

  it("full trivial workflow: init → all validations pass without checkpoints", async () => {
    const state = initCheckpointState("trivial", "Fix typo in README");
    await writeCheckpointState(tmpDir, state);

    expect(validatePlanCheckpoints(state).valid).toBe(true);
    expect(validateCommitCheckpoints(state, "T01").valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm --prefix packages/gedpi test -- --run tests/orchestration.test.ts`
Expected: PASS (all tests including integration)

- [ ] **Step 3: Run full verify**

Run: `npm --prefix packages/gedpi run verify`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/gedpi/tests/orchestration.test.ts
git commit -m "test: add end-to-end integration tests for orchestration workflow"
```

---

### Task 10: Ensure .ged/runtime/ is gitignored

**Files:**
- Modify: `packages/gedpi/src/workflow.ts` (or wherever the .ged/.gitignore is written)

- [ ] **Step 1: Check if .ged/.gitignore already covers runtime/**

Run: `cat packages/gedpi/.gitignore` and search for existing .ged gitignore patterns. Also check if the `.ged/.gitignore` template in the codebase already ignores `runtime/`.

- [ ] **Step 2: If not already covered, add runtime/ to the .ged gitignore template**

Find where the `.ged/.gitignore` is generated (likely in the initialization flow in workflow.ts) and ensure it includes:
```
runtime/
```

The checkpoint state file lives at `.ged/runtime/checkpoints.json` — this is ephemeral session state, not durable project memory, so it must be gitignored.

- [ ] **Step 3: Run full verify**

Run: `npm --prefix packages/gedpi run verify`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: ensure .ged/runtime/ is gitignored for checkpoint state"
```
