import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseCheckpointState, type CheckpointState } from "@ged/shared-checkpoints";

import { activeWorkId } from "./work-id.js";

export interface GedDashboardSnapshot {
  projectRoot: string;
  workId: string;
  durable: {
    project?: string;
    architecture?: string;
    patterns?: string;
  };
  activeWork: {
    spec?: string;
    tasks?: string;
    tests?: string;
    notes?: string;
  };
  runtime: {
    state?: string;
    sessionSummary?: string;
    checkpoints?: CheckpointState;
    checkpointError?: string;
  };
}

async function readOptionalText(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

async function readCheckpoints(filePath: string): Promise<{
  checkpoints?: CheckpointState;
  checkpointError?: string;
}> {
  const raw = await readOptionalText(filePath);
  if (!raw) return {};
  const parsed = parseCheckpointState(raw);
  if (!parsed) {
    return { checkpointError: "Invalid checkpoint state" };
  }
  return { checkpoints: parsed };
}

export async function readGedDashboardSnapshot(projectRoot: string): Promise<GedDashboardSnapshot> {
  const workId = await activeWorkId(projectRoot);
  const gedRoot = path.join(projectRoot, ".ged");
  const workRoot = path.join(gedRoot, "work", workId);
  const runtimeRoot = path.join(gedRoot, "runtime", workId);
  const checkpointResult = await readCheckpoints(path.join(runtimeRoot, "checkpoints.json"));

  return {
    projectRoot,
    workId,
    durable: {
      project: await readOptionalText(path.join(gedRoot, "PROJECT.md")),
      architecture: await readOptionalText(path.join(gedRoot, "ARCHITECTURE.md")),
      patterns: await readOptionalText(path.join(gedRoot, "PATTERNS.md")),
    },
    activeWork: {
      spec: await readOptionalText(path.join(workRoot, "SPEC.md")),
      tasks: await readOptionalText(path.join(workRoot, "TASKS.md")),
      tests: await readOptionalText(path.join(workRoot, "TESTS.md")),
      notes: await readOptionalText(path.join(workRoot, "NOTES.md")),
    },
    runtime: {
      state: await readOptionalText(path.join(runtimeRoot, "STATE.md")),
      sessionSummary: await readOptionalText(path.join(runtimeRoot, "SESSION-SUMMARY.md")),
      ...checkpointResult,
    },
  };
}
