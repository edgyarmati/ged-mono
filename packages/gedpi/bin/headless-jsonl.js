import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";

import { parseCheckpointState } from "../src/vendor/shared-checkpoints.js";

const execFileAsync = promisify(execFile);

function branchNameToWorkId(branch) {
  return (
    branch
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/gu, "-")
      .replace(/[-_.]{2,}/gu, "-")
      .replace(/^[-_.]+|[-_.]+$/gu, "") || "root"
  );
}

async function currentWorkId(rootDir) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", rootDir, "branch", "--show-current"],
      { timeout: 2000 },
    );
    return branchNameToWorkId(stdout.trim());
  } catch {
    return "root";
  }
}

function pathsFor(rootDir, workId) {
  const workDir = path.join(rootDir, ".ged", "work", workId);
  const runtimeDir = path.join(rootDir, ".ged", "runtime", workId);
  return {
    specPath: path.join(workDir, "SPEC.md"),
    tasksPath: path.join(workDir, "TASKS.md"),
    testsPath: path.join(workDir, "TESTS.md"),
    notesPath: path.join(workDir, "NOTES.md"),
    statePath: path.join(runtimeDir, "STATE.md"),
    sessionSummaryPath: path.join(runtimeDir, "SESSION-SUMMARY.md"),
    checkpointsPath: path.join(runtimeDir, "checkpoints.json"),
  };
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonObject(filePath) {
  const raw = await readOptional(filePath);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function readCheckpoint(filePath) {
  const raw = await readOptional(filePath);
  if (!raw) return {};
  const parsed = parseCheckpointState(raw);
  return parsed
    ? { checkpoints: parsed }
    : { checkpointError: "Invalid checkpoint state" };
}

function cleanRoleModels(value) {
  if (!isRecord(value)) return {};
  const result = {};
  for (const role of ["ged-explorer", "ged-planner", "ged-verifier"]) {
    const model = value[role];
    if (typeof model === "string" || isRecord(model)) result[role] = model;
  }
  return result;
}

async function readSettingsSummary(projectRoot) {
  const globalPath = path.join(os.homedir(), ".gedoc", "settings.json");
  const projectPath = path.join(projectRoot, ".gedoc", "settings.json");
  const globalSettings = await readJsonObject(globalPath);
  const projectSettings = await readJsonObject(projectPath);
  const globalAgents = isRecord(globalSettings.agents)
    ? globalSettings.agents
    : {};
  const projectAgents = isRecord(projectSettings.agents)
    ? projectSettings.agents
    : {};
  const globalPrefs = isRecord(globalSettings.preferences)
    ? globalSettings.preferences
    : {};
  const projectPrefs = isRecord(projectSettings.preferences)
    ? projectSettings.preferences
    : {};
  return {
    globalPath,
    projectPath,
    agentsEnabled: projectAgents.enabled ?? globalAgents.enabled ?? false,
    defaultModel: projectAgents.defaultModel ?? globalAgents.defaultModel,
    models: {
      ...cleanRoleModels(globalAgents.models),
      ...cleanRoleModels(projectAgents.models),
    },
    allowCheckpointBypass:
      projectAgents.allowCheckpointBypass ??
      globalAgents.allowCheckpointBypass ??
      false,
    planReview:
      projectPrefs.reviewPlanBeforePlannerHandoff ??
      globalPrefs.reviewPlanBeforePlannerHandoff ??
      "plannotator",
    autoCommit:
      projectPrefs.autoCommitVerifiedWork ??
      globalPrefs.autoCommitVerifiedWork ??
      "ask",
  };
}

export async function readHeadlessSnapshot(projectRoot) {
  const workId = await currentWorkId(projectRoot);
  const paths = pathsFor(projectRoot, workId);
  const gedRoot = path.join(projectRoot, ".ged");
  return {
    projectRoot,
    workId,
    gedInitialized: Boolean(await readOptional(path.join(gedRoot, "VERSION"))),
    durable: {
      project: await readOptional(path.join(gedRoot, "PROJECT.md")),
      architecture: await readOptional(path.join(gedRoot, "ARCHITECTURE.md")),
      patterns: await readOptional(path.join(gedRoot, "PATTERNS.md")),
    },
    activeWork: {
      spec: await readOptional(paths.specPath),
      tasks: await readOptional(paths.tasksPath),
      tests: await readOptional(paths.testsPath),
      notes: await readOptional(paths.notesPath),
    },
    runtime: {
      state: await readOptional(paths.statePath),
      sessionSummary: await readOptional(paths.sessionSummaryPath),
      ...(await readCheckpoint(paths.checkpointsPath)),
    },
    settings: await readSettingsSummary(projectRoot),
  };
}

function writeJsonLine(output, value) {
  output.write(`${JSON.stringify(value)}\n`);
}

export async function runHeadlessJsonl({
  projectRoot,
  input = process.stdin,
  output = process.stdout,
}) {
  const rl = createInterface({ input });
  writeJsonLine(output, {
    type: "session.ready",
    projectRoot,
    ts: new Date().toISOString(),
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const command = JSON.parse(line);
      if (
        !command ||
        typeof command !== "object" ||
        command.type !== "snapshot.read"
      ) {
        writeJsonLine(output, {
          ...(typeof command?.id === "string" ? { id: command.id } : {}),
          type: "response.error",
          code: "GEDPI_HEADLESS_UNSUPPORTED_COMMAND",
          message: `Unsupported command: ${String(command?.type)}`,
        });
        continue;
      }
      const commandProjectRoot =
        typeof command.projectRoot === "string" && command.projectRoot
          ? command.projectRoot
          : projectRoot;
      writeJsonLine(output, {
        ...(typeof command.id === "string" ? { id: command.id } : {}),
        type: "response.snapshot",
        snapshot: await readHeadlessSnapshot(commandProjectRoot),
      });
    } catch (error) {
      writeJsonLine(output, {
        type: "response.error",
        code:
          error instanceof SyntaxError
            ? "GEDPI_HEADLESS_INVALID_JSON"
            : "GEDPI_HEADLESS_INTERNAL_ERROR",
        message:
          error instanceof SyntaxError
            ? "Input line is not valid JSON."
            : error instanceof Error
              ? error.message
              : String(error),
      });
    }
  }
}
