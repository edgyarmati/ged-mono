import { execFile } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

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

function isValidCheckpointState(value: unknown): value is CheckpointState {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    (obj.classification === "trivial" ||
      obj.classification === "non-trivial") &&
    typeof obj.classificationReason === "string" &&
    typeof obj.planCheckpoints === "object" &&
    obj.planCheckpoints !== null &&
    typeof obj.taskCheckpoints === "object" &&
    obj.taskCheckpoints !== null
  );
}

export async function readCheckpointState(
  rootDir: string,
): Promise<CheckpointState | null> {
  try {
    const raw = await readFile(path.join(rootDir, CHECKPOINT_FILE), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return isValidCheckpointState(parsed) ? parsed : null;
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

export function recordCheckpoint(
  state: CheckpointState,
  record: CheckpointRecord,
  taskId?: string,
): CheckpointState {
  if (taskId) {
    return {
      ...state,
      taskCheckpoints: {
        ...state.taskCheckpoints,
        [taskId]: {
          ...state.taskCheckpoints[taskId],
          [record.agent]: record,
        },
      },
    };
  }
  return {
    ...state,
    planCheckpoints: {
      ...state.planCheckpoints,
      [record.agent]: record,
    },
  };
}

export interface CheckpointValidation {
  valid: boolean;
  missing: string[];
  warning?: string;
}

export function validatePlanCheckpoints(
  state: CheckpointState | null,
): CheckpointValidation {
  if (!state) {
    return {
      valid: true,
      missing: [],
      warning: "No checkpoint state found — subagents may not be enabled",
    };
  }
  if (state.classification === "trivial") {
    return { valid: true, missing: [] };
  }
  const missing: string[] = [];
  if (!state.planCheckpoints["ged-planner"]) {
    missing.push("ged-planner");
  }
  return { valid: missing.length === 0, missing };
}

export function validateCommitCheckpoints(
  state: CheckpointState | null,
  taskId: string,
): CheckpointValidation {
  if (!state) {
    return {
      valid: true,
      missing: [],
      warning: "No checkpoint state found — subagents may not be enabled",
    };
  }
  if (state.classification === "trivial") {
    return { valid: true, missing: [] };
  }
  const missing: string[] = [];
  if (!state.taskCheckpoints[taskId]?.["ged-verifier"]) {
    missing.push("ged-verifier");
  }
  return { valid: missing.length === 0, missing };
}

export function buildOrchestrationPrompt(agentsEnabled: boolean): string {
  if (!agentsEnabled) {
    return "";
  }

  return `## Subagent orchestration — MANDATORY

You MUST use the subagent tool to dispatch ged-explorer, ged-planner, and ged-verifier as described here. This is not optional. "I can handle it myself" is not a valid reason to skip.

Single-writer invariant: you are the sole active-worktree writer, synthesizer, and decision owner. Subagents inject read-only intelligence — they do not own product decisions, commits, or final judgments.

### Step 2: Task classification — REQUIRED FIRST ACTION

Your very first action after understanding the user's request MUST be writing a classification to .ged/runtime/checkpoints.json. Do this BEFORE reading code, before planning, before anything else.

**TRIVIAL** (subagent dispatch not required):
- Answering a question about the codebase
- Fixing a typo or changing a config value
- Editing a README or comment

**NON-TRIVIAL** (subagent dispatch REQUIRED — no exceptions):
- Creating any new file (HTML, JS, CSS, anything)
- Implementing any feature, even a "simple" one
- Bug fixes
- Refactoring
- Multi-file changes
- Anything involving design decisions

When in doubt, classify as NON-TRIVIAL.

Write to .ged/runtime/checkpoints.json:
\`\`\`json
{"classification": "non-trivial", "classificationReason": "Creating new HTML page with design decisions", "planCheckpoints": {}, "taskCheckpoints": {}}
\`\`\`

### Steps 3, 6, 8: Subagent dispatch — exact tool calls

**Step 3 — ged-explorer** (before planning):
\`\`\`
Use the subagent tool with: { "agent": "ged-explorer", "task": "Investigate <what you need to know about the codebase>" }
\`\`\`

**Step 6 — ged-planner** (before finalizing plan):
\`\`\`
Use the subagent tool with: { "agent": "ged-planner", "task": "Critique this plan: <your plan summary>. Look for missing edge cases, test gaps, and risks." }
\`\`\`

**Step 8 — ged-verifier** (clean-context review before committing):
\`\`\`
Use the subagent tool with: { "agent": "ged-verifier", "task": "Clean-context review: check the current diff for logic bugs, security issues, and test gaps." }
\`\`\`

After ged-verifier completes, adjudicate each finding: accept (fix before commit), reject (record reason), or needs-user (ask the user). Then record the result:
\`\`\`json
{"agent": "ged-verifier", "timestamp": "2026-05-04T10:00:00Z", "status": "completed", "findingCount": 2, "blocksCommit": false}
\`\`\`

### Skip policy — ONLY for these specific reasons

A subagent checkpoint may ONLY be skipped when:
- The task was classified as TRIVIAL
- The user explicitly said "skip subagents" or "don't delegate"
- The subagent tool call failed (retry once first)

"The task seemed simple" or "I could handle it myself" are NOT valid skip reasons.

When skipping, you MUST record it:
\`\`\`json
{"agent": "ged-planner", "timestamp": "...", "status": "skipped", "skipReason": "User explicitly asked to skip"}
\`\`\`

### Intercom usage

Use pi-intercom only for child-to-parent clarification when a subagent is blocked on a scope or product decision.

There is no writer subagent role. Do not delegate source edits, planning-file ownership, scope decisions, verification adjudication, commits, pushes, or PR decisions to subagents.`;
}

const execFileAsync = promisify(execFile);

export async function detectRecentCommits(
  rootDir: string,
  withinSeconds: number,
): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      [
        "log",
        `--since=${withinSeconds} seconds ago`,
        "--format=%H",
        "--no-merges",
      ],
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
