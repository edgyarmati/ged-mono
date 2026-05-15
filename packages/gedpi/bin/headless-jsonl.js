import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";

import {
  createAgentSession,
  getAgentDir,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
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

async function getOrCreatePiSession(session) {
  if (session.piSession) return session.piSession;

  const { session: piSession } = await createAgentSession({
    cwd: session.cwd,
    sessionManager: SessionManager.inMemory(session.cwd),
    settingsManager: SettingsManager.create(session.cwd, getAgentDir()),
  });
  session.piSession = piSession;
  return piSession;
}

async function handleTurn({
  threadId,
  turnId,
  input,
  projectRoot,
  output,
  session,
}) {
  let piSession;
  try {
    piSession = await getOrCreatePiSession(session);
  } catch (error) {
    writeJsonLine(output, {
      type: "event.content.delta",
      threadId,
      turnId,
      streamKind: "assistant_text",
      delta: `[GedPi] Failed to create agent session: ${error instanceof Error ? error.message : String(error)}`,
    });
    writeJsonLine(output, {
      type: "event.turn.completed",
      threadId,
      turnId,
      state: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  let resolveAgentEnd;
  const agentDone = new Promise((resolve) => {
    resolveAgentEnd = resolve;
  });

  const unsubscribe = piSession.subscribe((event) => {
    if (event.type === "message_update") {
      const sub = event.assistantMessageEvent;
      if (sub.type === "text_delta") {
        writeJsonLine(output, {
          type: "event.content.delta",
          threadId,
          turnId,
          streamKind: "assistant_text",
          delta: sub.delta,
        });
      } else if (sub.type === "thinking_delta") {
        writeJsonLine(output, {
          type: "event.content.delta",
          threadId,
          turnId,
          streamKind: "thinking",
          delta: sub.delta,
        });
      }
    } else if (event.type === "tool_execution_start") {
      writeJsonLine(output, {
        type: "event.item.tool_call.start",
        threadId,
        turnId,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
      });
    } else if (event.type === "tool_execution_end") {
      writeJsonLine(output, {
        type: "event.item.tool_call.end",
        threadId,
        turnId,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result,
        isError: event.isError,
      });
    } else if (event.type === "agent_end") {
      resolveAgentEnd();
    }
  });

  let aborted = false;
  const onAbort = () => {
    aborted = true;
    piSession.abort();
  };
  session.abortController.signal.addEventListener("abort", onAbort, {
    once: true,
  });

  try {
    await piSession.prompt(input);
    await agentDone;
  } finally {
    unsubscribe();
    session.abortController.signal.removeEventListener("abort", onAbort);
  }

  writeJsonLine(output, {
    type: "event.turn.completed",
    threadId,
    turnId,
    state: aborted ? "interrupted" : "completed",
  });
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
  const activeSessions = new Map();
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const command = JSON.parse(line);
      if (!command || typeof command !== "object") {
        writeJsonLine(output, {
          ...(typeof command?.id === "string" ? { id: command.id } : {}),
          type: "response.error",
          code: "GEDPI_HEADLESS_UNSUPPORTED_COMMAND",
          message: `Unsupported command: ${String(command?.type)}`,
        });
        continue;
      }
      switch (command.type) {
        case "snapshot.read": {
          const commandProjectRoot =
            typeof command.projectRoot === "string" && command.projectRoot
              ? command.projectRoot
              : projectRoot;
          writeJsonLine(output, {
            ...(typeof command.id === "string" ? { id: command.id } : {}),
            type: "response.snapshot",
            snapshot: await readHeadlessSnapshot(commandProjectRoot),
          });
          break;
        }

        case "session.start": {
          const threadId = command.threadId;
          if (typeof threadId !== "string" || !threadId) {
            writeJsonLine(output, {
              ...(typeof command.id === "string" ? { id: command.id } : {}),
              type: "response.error",
              code: "GEDPI_HEADLESS_INVALID_PARAMS",
              message: "session.start requires a threadId string",
            });
            break;
          }
          if (activeSessions.has(threadId)) {
            writeJsonLine(output, {
              ...(typeof command.id === "string" ? { id: command.id } : {}),
              type: "response.error",
              code: "GEDPI_HEADLESS_SESSION_EXISTS",
              message: `Session '${threadId}' already exists`,
            });
            break;
          }
          const session = {
            threadId,
            status: "ready",
            runtimeMode: command.runtimeMode ?? "agent",
            cwd: command.cwd ?? projectRoot,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            abortController: new AbortController(),
            pendingRequests: new Map(),
            turns: [],
          };
          activeSessions.set(threadId, session);
          writeJsonLine(output, {
            ...(typeof command.id === "string" ? { id: command.id } : {}),
            type: "event.session.started",
            threadId,
            session,
          });
          break;
        }

        case "turn.send": {
          const threadId = command.threadId;
          if (!activeSessions.has(threadId)) {
            writeJsonLine(output, {
              ...(typeof command.id === "string" ? { id: command.id } : {}),
              type: "response.error",
              code: "GEDPI_HEADLESS_SESSION_NOT_FOUND",
              message: `No active session with threadId '${threadId}'`,
            });
            break;
          }
          const session = activeSessions.get(threadId);
          const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          session.activeTurnId = turnId;
          session.updatedAt = new Date().toISOString();

          writeJsonLine(output, {
            ...(typeof command.id === "string" ? { id: command.id } : {}),
            type: "event.turn.started",
            threadId,
            turnId,
          });

          let turnState = "completed";
          try {
            await handleTurn({
              threadId,
              turnId,
              input: command.input ?? "",
              attachments: command.attachments,
              projectRoot: session.cwd,
              output,
              session,
            });
          } catch (error) {
            turnState = "failed";
            writeJsonLine(output, {
              type: "event.turn.completed",
              threadId,
              turnId,
              state: "failed",
              errorMessage:
                error instanceof Error ? error.message : String(error),
            });
          }

          session.turns.push({
            turnId,
            input: command.input ?? "",
            state: turnState,
            createdAt: new Date().toISOString(),
          });
          session.activeTurnId = undefined;
          break;
        }

        case "session.stop": {
          const threadId = command.threadId;
          if (typeof threadId !== "string" || !threadId) {
            writeJsonLine(output, {
              ...(typeof command.id === "string" ? { id: command.id } : {}),
              type: "response.error",
              code: "GEDPI_HEADLESS_INVALID_PARAMS",
              message: "session.stop requires a threadId string",
            });
            break;
          }
          if (!activeSessions.has(threadId)) {
            writeJsonLine(output, {
              ...(typeof command.id === "string" ? { id: command.id } : {}),
              type: "response.error",
              code: "GEDPI_HEADLESS_SESSION_NOT_FOUND",
              message: `No active session with threadId '${threadId}'`,
            });
            break;
          }
          const sess = activeSessions.get(threadId);
          if (sess?.piSession) {
            sess.piSession.dispose();
          }
          activeSessions.delete(threadId);
          writeJsonLine(output, {
            ...(typeof command.id === "string" ? { id: command.id } : {}),
            type: "event.session.exited",
            threadId,
          });
          break;
        }

        case "request.respond": {
          const threadId = command.threadId;
          const session = activeSessions.get(threadId);
          if (!session) {
            writeJsonLine(output, {
              ...(typeof command.id === "string" ? { id: command.id } : {}),
              type: "response.error",
              code: "GEDPI_HEADLESS_SESSION_NOT_FOUND",
              message: `No active session with threadId '${threadId}'`,
            });
            break;
          }
          const pending = session.pendingRequests?.get(command.requestId);
          if (!pending) {
            writeJsonLine(output, {
              ...(typeof command.id === "string" ? { id: command.id } : {}),
              type: "response.error",
              code: "GEDPI_HEADLESS_REQUEST_NOT_FOUND",
              message: `No pending request '${command.requestId}' in session '${threadId}'`,
            });
            break;
          }
          pending.resolve(command.decision);
          session.pendingRequests.delete(command.requestId);
          writeJsonLine(output, {
            ...(typeof command.id === "string" ? { id: command.id } : {}),
            type: "event.request.resolved",
            threadId,
            requestId: command.requestId,
          });
          break;
        }

        case "user-input.respond": {
          const threadId = command.threadId;
          const session = activeSessions.get(threadId);
          if (!session) {
            writeJsonLine(output, {
              ...(typeof command.id === "string" ? { id: command.id } : {}),
              type: "response.error",
              code: "GEDPI_HEADLESS_SESSION_NOT_FOUND",
              message: `No active session with threadId '${threadId}'`,
            });
            break;
          }
          const pending = session.pendingRequests?.get(command.requestId);
          if (!pending) {
            writeJsonLine(output, {
              ...(typeof command.id === "string" ? { id: command.id } : {}),
              type: "response.error",
              code: "GEDPI_HEADLESS_REQUEST_NOT_FOUND",
              message: `No pending request '${command.requestId}' in session '${threadId}'`,
            });
            break;
          }
          pending.resolve(command.answers);
          session.pendingRequests.delete(command.requestId);
          writeJsonLine(output, {
            ...(typeof command.id === "string" ? { id: command.id } : {}),
            type: "event.request.resolved",
            threadId,
            requestId: command.requestId,
          });
          break;
        }

        case "thread.read": {
          const threadId = command.threadId;
          const session = activeSessions.get(threadId);
          if (!session) {
            writeJsonLine(output, {
              ...(typeof command.id === "string" ? { id: command.id } : {}),
              type: "response.error",
              code: "GEDPI_HEADLESS_SESSION_NOT_FOUND",
              message: `No active session with threadId '${threadId}'`,
            });
            break;
          }
          writeJsonLine(output, {
            ...(typeof command.id === "string" ? { id: command.id } : {}),
            type: "response.thread",
            threadId,
            turns: session.turns,
          });
          break;
        }

        case "turn.interrupt": {
          const threadId = command.threadId;
          if (!activeSessions.has(threadId)) {
            writeJsonLine(output, {
              ...(typeof command.id === "string" ? { id: command.id } : {}),
              type: "response.error",
              code: "GEDPI_HEADLESS_SESSION_NOT_FOUND",
              message: `No active session with threadId '${threadId}'`,
            });
            break;
          }
          const session = activeSessions.get(threadId);
          if (session.abortController) {
            session.abortController.abort();
          }
          break;
        }

        default: {
          writeJsonLine(output, {
            ...(typeof command.id === "string" ? { id: command.id } : {}),
            type: "response.error",
            code: "GEDPI_HEADLESS_UNSUPPORTED_COMMAND",
            message: `Unsupported command: ${String(command.type)}`,
          });
        }
      }
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
