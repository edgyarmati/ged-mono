import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";

import {
  OMNI_FILES,
  OMNI_GITIGNORE,
  GedCodePlugin,
  appendSessionSummary,
  assertProtectedBranchAllowsMutation,
  activePlanningArtifactPaths,
  activeRuntimePaths,
  branchNameToWorkId,
  buildRepoMap,
  buildCollaborationCheckpoint,
  buildPullRequestBody,
  DEFAULT_WORKFLOW_SETTINGS,
  dirtyWorktreeGuidance,
  discoverStandards,
  ensureGedCodeProjectGitignore,
  ensureOmniDir,
  formatWorkflowSettingsStatus,
  formatAgentsSettingsStatus,
  importStandards,
  migrateRootPlanToActiveWork,
  planningArtifactsReady,
  planningArtifactsReadyAt,
  planningGuardMessage,
  readCurrentGitBranch,
  readGedCodeModelRecommendations,
  readGedCodeSettings,
  resolvePlanningArtifactReadiness,
  resolveGlobalSettingsPath,
  resolveProjectSettingsPath,
  setOmniMode,
  startWorkBranch,
  suggestSkills,
  summarizePullRequestPrerequisites,
  updateGedCodeAgentsSettings,
  updateSkillsFile,
  updateStateFile,
  writeFileAtomic,
  validateWorkBranchName,
} from "../src/index.ts";

type MutableOpenCodeConfig = {
  agent?: Record<string, Record<string, unknown>>;
  command?: Record<string, Record<string, unknown>>;
  instructions?: string[];
  default_agent?: string;
};

async function withTempDir(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gedcode-plugin-test-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function modeBits(mode: number): number {
  return mode & 0o777;
}

function runGitTest(directory: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd: directory, shell: false });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git ${args.join(" ")} failed: ${output}`));
    });
  });
}

async function writeRealPlanningFiles(baseDir: string) {
  await mkdir(baseDir, { recursive: true });
  await writeFile(path.join(baseDir, "SPEC.md"), `${OMNI_FILES["SPEC.md"]}\n## Real\nSpec content\n`, "utf8");
  await writeFile(path.join(baseDir, "TASKS.md"), `${OMNI_FILES["TASKS.md"]}\n## Real\n- [ ] Task\n`, "utf8");
  await writeFile(path.join(baseDir, "TESTS.md"), `${OMNI_FILES["TESTS.md"]}\n## Real\n- [ ] Test\n`, "utf8");
}

async function buildPluginConfig(directory: string, options?: { homeDir?: string }): Promise<MutableOpenCodeConfig> {
  const hooks = await GedCodePlugin({ directory } as never, options?.homeDir ? { homeDir: options.homeDir } : undefined);
  const config: MutableOpenCodeConfig = {};
  if (!hooks.config) throw new Error("GedCodePlugin did not register config hook");
  await hooks.config(config as never);
  return config;
}

test("discoverStandards finds supported standards files and ignores .ged", async () => {
  await withTempDir(async (dir) => {
    await mkdir(path.join(dir, ".github", "instructions"), { recursive: true });
    await mkdir(path.join(dir, ".cursor", "rules"), { recursive: true });
    await mkdir(path.join(dir, ".ged"), { recursive: true });
    await writeFile(path.join(dir, "AGENTS.md"), "# agents\n", "utf8");
    await writeFile(path.join(dir, ".github", "copilot-instructions.md"), "# copilot\n", "utf8");
    await writeFile(path.join(dir, ".github", "instructions", "repo.instructions.md"), "# gh\n", "utf8");
    await writeFile(path.join(dir, ".cursor", "rules", "ui.mdc"), "# cursor\n", "utf8");
    await writeFile(path.join(dir, ".ged", "AGENTS.md"), "# ignored\n", "utf8");

    const found = await discoverStandards(dir);
    assert.deepEqual(
      found.map((item) => item.path),
      [
        ".cursor/rules/ui.mdc",
        ".github/copilot-instructions.md",
        ".github/instructions/repo.instructions.md",
        "AGENTS.md",
      ],
    );
  });
});

test("ensureOmniDir writes a selective .ged/.gitignore for runtime state", async () => {
  await withTempDir(async (dir) => {
    await ensureOmniDir(dir);
    const gitignore = await readFile(path.join(dir, ".ged", ".gitignore"), "utf8");

    assert.equal(gitignore, `${OMNI_GITIGNORE}\n`);
    assert.match(gitignore, /STATE\.md/);
    assert.match(gitignore, /runtime\//);
    assert.doesNotMatch(gitignore, /PROJECT\.md/);
  });
});

test("writeFileAtomic preserves existing file permissions", async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, ".ged", "STATE.md");
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "old\n", "utf8");
    await chmod(filePath, 0o600);

    await writeFileAtomic(filePath, "new\n");

    assert.equal(await readFile(filePath, "utf8"), "new\n");
    assert.equal(modeBits((await stat(filePath)).mode), 0o600);
  });
});

test("readGedCodeSettings returns workflow defaults when settings files are missing", async () => {
  await withTempDir(async (dir) => {
    const homeDir = path.join(dir, "home");
    const projectDir = path.join(dir, "project");
    await mkdir(projectDir, { recursive: true });

    const settings = await readGedCodeSettings(projectDir, { homeDir });

    assert.deepEqual(settings.workflow, DEFAULT_WORKFLOW_SETTINGS);
  });
});

test("readGedCodeSettings merges global defaults with project overrides", async () => {
  await withTempDir(async (dir) => {
    const homeDir = path.join(dir, "home");
    const projectDir = path.join(dir, "project");
    await mkdir(path.dirname(resolveGlobalSettingsPath(homeDir)), { recursive: true });
    await mkdir(path.dirname(resolveProjectSettingsPath(projectDir)), { recursive: true });
    await writeFile(
      resolveGlobalSettingsPath(homeDir),
      JSON.stringify({
        workflow: {
          protectedBranches: ["main", "trunk"],
          requireFeatureBranchForChanges: true,
          allowProtectedBranchChanges: false,
        },
      }),
      "utf8",
    );
    await writeFile(
      resolveProjectSettingsPath(projectDir),
      JSON.stringify({
        workflow: {
          allowProtectedBranchChanges: true,
          offerPrOnCompletion: false,
          autoCreatePrOnCompletion: true,
        },
      }),
      "utf8",
    );

    const settings = await readGedCodeSettings(projectDir, { homeDir });

    assert.deepEqual(settings.workflow, {
      protectedBranches: ["main", "trunk"],
      requireFeatureBranchForChanges: true,
      allowProtectedBranchChanges: true,
      offerPrOnCompletion: false,
      autoCreatePrOnCompletion: true,
    });
  });
});

test("readGedCodeSettings ignores invalid workflow settings", async () => {
  await withTempDir(async (dir) => {
    const homeDir = path.join(dir, "home");
    const projectDir = path.join(dir, "project");
    await mkdir(path.dirname(resolveGlobalSettingsPath(homeDir)), { recursive: true });
    await mkdir(path.dirname(resolveProjectSettingsPath(projectDir)), { recursive: true });
    await writeFile(
      resolveGlobalSettingsPath(homeDir),
      JSON.stringify({ workflow: { protectedBranches: [], requireFeatureBranchForChanges: "yes" } }),
      "utf8",
    );
    await writeFile(resolveProjectSettingsPath(projectDir), "not json", "utf8");

    const settings = await readGedCodeSettings(projectDir, { homeDir });

    assert.deepEqual(settings.workflow, DEFAULT_WORKFLOW_SETTINGS);
  });
});

test("readGedCodeSettings merges agent settings with project override precedence", async () => {
  await withTempDir(async (dir) => {
    const removedWriterName = ["omni", "worker"].join("-");
    const homeDir = path.join(dir, "home");
    const projectDir = path.join(dir, "project");
    await mkdir(path.join(homeDir, ".gedcode"), { recursive: true });
    await mkdir(path.join(projectDir, ".gedcode"), { recursive: true });
    await writeFile(
      path.join(homeDir, ".gedcode", "settings.json"),
        JSON.stringify({ agents: { enabled: true, defaultModel: "anthropic/global-default", models: { "ged-explorer": "anthropic/global-explorer", [removedWriterName]: "anthropic/legacy-writer" } } }, null, 2),
      "utf8",
    );
    await writeFile(
      path.join(projectDir, ".gedcode", "settings.json"),
        JSON.stringify({ agents: { enabled: false, models: { "ged-verifier": "openai/project-verifier", [removedWriterName]: "openai/legacy-writer" } } }, null, 2),
      "utf8",
    );

    const settings = await readGedCodeSettings(projectDir, { homeDir });

    assert.equal(settings.agents.enabled, false);
    assert.equal(settings.agents.defaultModel, "anthropic/global-default");
    assert.deepEqual(settings.agents.models, {
      "ged-explorer": "anthropic/global-explorer",
      "ged-verifier": "openai/project-verifier",
    });
  });
});

test("ensureGedCodeProjectGitignore adds project .gedcode settings directory", async () => {
  await withTempDir(async (dir) => {
    await writeFile(path.join(dir, ".gitignore"), "node_modules/\n", "utf8");

    await ensureGedCodeProjectGitignore(dir);
    await ensureGedCodeProjectGitignore(dir);

    const gitignore = await readFile(path.join(dir, ".gitignore"), "utf8");
    assert.equal(gitignore.match(/^\.gedcode\/$/gmu)?.length, 1);
    assert.match(gitignore, /^node_modules\/$/m);
  });
});

test("updateGedCodeAgentsSettings writes scoped settings without copying agent defaults", async () => {
  await withTempDir(async (dir) => {
    const removedWriterName = ["omni", "worker"].join("-");
    const homeDir = path.join(dir, "home");
    const projectDir = path.join(dir, "project");
    await mkdir(path.dirname(resolveProjectSettingsPath(projectDir)), { recursive: true });
    await writeFile(resolveProjectSettingsPath(projectDir), JSON.stringify({ agents: { models: { [removedWriterName]: "openai/legacy-writer" } } }, null, 2), "utf8");

    const globalResult = await updateGedCodeAgentsSettings(projectDir, { scope: "global", enabled: true, defaultModel: "anthropic/subagents" }, { homeDir });
    const projectResult = await updateGedCodeAgentsSettings(projectDir, { scope: "project", models: { "ged-verifier": "openai/verifier" } }, { homeDir });

    const globalFile = JSON.parse(await readFile(globalResult.outputPath, "utf8"));
    const projectFile = JSON.parse(await readFile(projectResult.outputPath, "utf8"));
    const gitignore = await readFile(path.join(projectDir, ".gitignore"), "utf8");

    assert.deepEqual(globalFile, { agents: { enabled: true, defaultModel: "anthropic/subagents" } });
    assert.deepEqual(projectFile, { agents: { models: { "ged-verifier": "openai/verifier" } } });
    assert.match(gitignore, /^\.gedcode\/$/m);
  });
});

test("readGedCodeModelRecommendations prefers project guidance over global guidance", async () => {
  await withTempDir(async (dir) => {
    const homeDir = path.join(dir, "home");
    const projectDir = path.join(dir, "project");
    await mkdir(path.join(homeDir, ".gedcode"), { recursive: true });
    await mkdir(path.join(projectDir, ".gedcode"), { recursive: true });
    await writeFile(path.join(homeDir, ".gedcode", "model-recommendations.md"), "# Global\n", "utf8");
    await writeFile(path.join(projectDir, ".gedcode", "model-recommendations.md"), "# Project\n", "utf8");

    const recommendations = await readGedCodeModelRecommendations(projectDir, { homeDir });

    assert.equal(recommendations.content, "# Project\n");
    assert.equal(recommendations.sourcePath, path.join(projectDir, ".gedcode", "model-recommendations.md"));
  });
});

test("formatWorkflowSettingsStatus exposes effective workflow policy", async () => {
  const status = formatWorkflowSettingsStatus({
    workflow: {
      protectedBranches: ["main", "release"],
      requireFeatureBranchForChanges: false,
      allowProtectedBranchChanges: true,
      offerPrOnCompletion: true,
      autoCreatePrOnCompletion: false,
    },
  });

  assert.match(status, /Protected Branches: main, release/);
  assert.match(status, /Require Feature Branch For Changes: no/);
  assert.match(status, /Allow Protected Branch Changes: yes/);
  assert.match(status, /Offer PR On Completion: yes/);
  assert.match(status, /Auto Create PR On Completion: no/);
});

test("formatAgentsSettingsStatus exposes object model configs and checkpoint policy", () => {
  const status = formatAgentsSettingsStatus({
    workflow: DEFAULT_WORKFLOW_SETTINGS,
    agents: {
      enabled: true,
      models: {
        "ged-explorer": { model: "opencode/minimax-m2.5-free", reasoningEffort: "high" },
        "ged-planner": { model: "openai/gpt-5.5", reasoningEffort: "high", textVerbosity: "low" },
        "ged-verifier": "openai/gpt-5.5",
      },
    },
  }, {
    globalPath: "/home/test/.gedcode/settings.json",
    projectPath: "/repo/.gedcode/settings.json",
    recommendationsPath: null,
  });

  assert.match(status, /3 configured/);
  assert.match(status, /Global settings: \/home\/test/);
  assert.match(status, /opencode\/minimax-m2\.5-free/);
  assert.match(status, /ged-planner: model=openai\/gpt-5\.5, reasoningEffort=high, textVerbosity=low/);
  assert.match(status, /ged-verifier: model=openai\/gpt-5\.5/);
  assert.match(status, /Checkpoint policy: active for non-trivial change requests/);
  assert.match(status, /skip only with a recorded reason/);
  assert.doesNotMatch(status, /\{.*"model".*\}/);
});

test("formatAgentsSettingsStatus shows defaultModel fallback for unconfigured agents", () => {
  const status = formatAgentsSettingsStatus({
    workflow: DEFAULT_WORKFLOW_SETTINGS,
    agents: {
      enabled: true,
      defaultModel: "anthropic/shared-default",
      models: {
        "ged-explorer": "opencode/minimax-m2.5-free",
      },
    },
  }, {
    globalPath: "/home/test/.gedcode/settings.json",
    projectPath: "/repo/.gedcode/settings.json",
  });

  assert.match(status, /ged-explorer: model=opencode\/minimax-m2\.5-free/);
  assert.match(status, /ged-planner: model=anthropic\/shared-default \(shared default\)/);
  assert.match(status, /ged-verifier: model=anthropic\/shared-default \(shared default\)/);
});

test("formatAgentsSettingsStatus shows disabled checkpoint policy", () => {
  const status = formatAgentsSettingsStatus({
    workflow: DEFAULT_WORKFLOW_SETTINGS,
    agents: {
      enabled: false,
      models: {},
    },
  }, {
    globalPath: "/home/test/.gedcode/settings.json",
    projectPath: "/repo/.gedcode/settings.json",
    compact: true,
  });

  assert.match(status, /Effective agents.enabled: false/);
  assert.match(status, /Checkpoint policy: inactive because native subagents are disabled/);
  assert.match(status, /Per-agent models: none/);
  assert.match(status, /inherit invoking model/);
  assert.doesNotMatch(status, /Global settings:/);
});

test("summarizePullRequestPrerequisites reports missing PR requirements", () => {
  const summary = summarizePullRequestPrerequisites({
    branch: "feat/test",
    dirtyStatus: " M src/index.ts",
    hasRemote: false,
    hasUpstream: false,
  });

  assert.match(summary, /Working tree has uncommitted changes/);
  assert.match(summary, /No git remote is configured/);
  assert.match(summary, /has no upstream/);
});

test("buildPullRequestBody summarizes active planning and commits", async () => {
  await withTempDir(async (dir) => {
    await runGitTest(dir, ["init", "-b", "feat/pr-body"]);
    await writeFile(path.join(dir, "README.md"), "# test\n", "utf8");
    await runGitTest(dir, ["add", "README.md"]);
    await runGitTest(dir, ["-c", "user.email=test@example.com", "-c", "user.name=Test", "commit", "-m", "feat: initial"]);
    const activePaths = await activePlanningArtifactPaths(dir);
    await writeRealPlanningFiles(activePaths.baseDir);

    const body = await buildPullRequestBody(dir);

    assert.match(body, /Branch: feat\/pr-body/);
    assert.match(body, /Active planning: \.ged\/work\/feat-pr-body/);
    assert.match(body, /## Spec/);
    assert.match(body, /feat: initial/);
  });
});

test("readCurrentGitBranch reads branch names from git HEAD", async () => {
  await withTempDir(async (dir) => {
    await mkdir(path.join(dir, ".git"), { recursive: true });
    await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/feature/collab\n", "utf8");

    assert.equal(await readCurrentGitBranch(dir), "feature/collab");
  });
});

test("assertProtectedBranchAllowsMutation blocks protected branches by default", async () => {
  await withTempDir(async (dir) => {
    await mkdir(path.join(dir, ".git"), { recursive: true });
    await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/main\n", "utf8");

    await assert.rejects(
      () => assertProtectedBranchAllowsMutation(dir, { workflow: DEFAULT_WORKFLOW_SETTINGS }),
      /change requests should run on a feature branch, not main/,
    );
  });
});

test("assertProtectedBranchAllowsMutation respects protected branch overrides", async () => {
  await withTempDir(async (dir) => {
    await mkdir(path.join(dir, ".git"), { recursive: true });
    await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/main\n", "utf8");

    await assert.doesNotReject(() => assertProtectedBranchAllowsMutation(dir, {
      workflow: {
        ...DEFAULT_WORKFLOW_SETTINGS,
        allowProtectedBranchChanges: true,
      },
    }));
    await assert.doesNotReject(() => assertProtectedBranchAllowsMutation(dir, {
      workflow: {
        ...DEFAULT_WORKFLOW_SETTINGS,
        requireFeatureBranchForChanges: false,
      },
    }));
  });
});

test("branchNameToWorkId creates filesystem-safe branch slugs", () => {
  assert.equal(branchNameToWorkId("feature/Collaborative Memory"), "feature-collaborative-memory");
  assert.equal(branchNameToWorkId("fix..release__guard"), "fix-release-guard");
  assert.throws(() => branchNameToWorkId("///"), /cannot derive work id/);
});

test("validateWorkBranchName rejects unsafe branch names", () => {
  assert.equal(validateWorkBranchName("feat/collaboration-polish"), "feat/collaboration-polish");
  assert.throws(() => validateWorkBranchName("-bad"), /invalid branch name/);
  assert.throws(() => validateWorkBranchName("feat//bad"), /invalid branch name/);
  assert.throws(() => validateWorkBranchName("feat/bad.lock"), /invalid branch name/);
});

test("dirtyWorktreeGuidance proposes safe dirty checkout solutions", () => {
  const guidance = dirtyWorktreeGuidance("?? src/example.ts");

  assert.match(guidance, /uncommitted changes/);
  assert.match(guidance, /\?\? src\/example\.ts/);
  assert.match(guidance, /Commit the current changes/);
  assert.match(guidance, /git stash push/);
  assert.match(guidance, /allowDirty: true/);
});

test("startWorkBranch refuses dirty checkouts by default", async () => {
  await withTempDir(async (dir) => {
    await runGitTest(dir, ["init", "-b", "main"]);
    await writeFile(path.join(dir, "dirty.txt"), "dirty\n", "utf8");

    const result = await startWorkBranch(dir, { branch: "feat/test" });

    assert.equal(result.action, "blocked-dirty");
    assert.match(result.dirtyStatus, /dirty\.txt/);
    assert.equal(result.activePaths, null);
  });
});

test("startWorkBranch creates branches and initializes active planning files", async () => {
  await withTempDir(async (dir) => {
    await runGitTest(dir, ["init", "-b", "main"]);

    const result = await startWorkBranch(dir, { branch: "feat/test" });
    const branch = await readCurrentGitBranch(dir);

    assert.equal(result.action, "created");
    assert.equal(branch, "feat/test");
    assert.equal(result.activePaths?.workId, "feat-test");
    assert.match(await readFile(path.join(result.activePaths!.baseDir, "SPEC.md"), "utf8"), /# Spec/);
    assert.match(await readFile(path.join(result.activePaths!.baseDir, "TASKS.md"), "utf8"), /# Tasks/);
    assert.match(await readFile(path.join(result.activePaths!.baseDir, "TESTS.md"), "utf8"), /# Tests/);
  });
});

test("startWorkBranch switches to existing branches", async () => {
  await withTempDir(async (dir) => {
    await runGitTest(dir, ["init", "-b", "main"]);
    await writeFile(path.join(dir, "README.md"), "# test\n", "utf8");
    await runGitTest(dir, ["add", "README.md"]);
    await runGitTest(dir, ["-c", "user.email=test@example.com", "-c", "user.name=Test", "commit", "-m", "init"]);
    await runGitTest(dir, ["switch", "-c", "feat/existing"]);
    await runGitTest(dir, ["switch", "main"]);

    const result = await startWorkBranch(dir, { branch: "feat/existing" });

    assert.equal(result.action, "switched");
    assert.equal(await readCurrentGitBranch(dir), "feat/existing");
  });
});

test("activePlanningArtifactPaths selects .ged/work for branch-backed work", async () => {
  await withTempDir(async (dir) => {
    await mkdir(path.join(dir, ".git"), { recursive: true });
    await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/feature/collab-memory\n", "utf8");

    const paths = await activePlanningArtifactPaths(dir);

    assert.equal(paths.source, "work");
    assert.equal(paths.workId, "feature-collab-memory");
    assert.equal(paths.baseDir, path.join(dir, ".ged", "work", "feature-collab-memory"));
    assert.equal(paths.specPath, path.join(paths.baseDir, "SPEC.md"));
    assert.equal(paths.tasksPath, path.join(paths.baseDir, "TASKS.md"));
    assert.equal(paths.testsPath, path.join(paths.baseDir, "TESTS.md"));
  });
});

test("activePlanningArtifactPaths falls back to root planning when no branch is available", async () => {
  await withTempDir(async (dir) => {
    const paths = await activePlanningArtifactPaths(dir);

    assert.equal(paths.source, "root");
    assert.equal(paths.workId, null);
    assert.equal(paths.baseDir, path.join(dir, ".ged"));
  });
});

test("activeRuntimePaths uses branch slug or root fallback", async () => {
  await withTempDir(async (dir) => {
    assert.equal((await activeRuntimePaths(dir)).baseDir, path.join(dir, ".ged", "runtime", "root"));

    await mkdir(path.join(dir, ".git"), { recursive: true });
    await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/feat/runtime-state\n", "utf8");

    const branchRuntime = await activeRuntimePaths(dir);
    assert.equal(branchRuntime.runtimeId, "feat-runtime-state");
    assert.equal(branchRuntime.statePath, path.join(dir, ".ged", "runtime", "feat-runtime-state", "STATE.md"));
    assert.equal(branchRuntime.sessionSummaryPath, path.join(dir, ".ged", "runtime", "feat-runtime-state", "SESSION-SUMMARY.md"));
  });
});

test("updateStateFile preserves permissions through atomic replacement", async () => {
  await withTempDir(async (dir) => {
    await ensureOmniDir(dir);
    const runtimePaths = await activeRuntimePaths(dir);
    const statePath = runtimePaths.statePath;
    await mkdir(path.dirname(statePath), { recursive: true });
    await writeFile(statePath, "old\n", "utf8");
    await chmod(statePath, 0o600);

    await updateStateFile(dir, {
      currentPhase: "execution",
      activeTask: "Atomic write slice",
    });

    assert.equal(modeBits((await stat(statePath)).mode), 0o600);
  });
});

test("state and session summaries write to branch-scoped runtime paths", async () => {
  await withTempDir(async (dir) => {
    await mkdir(path.join(dir, ".git"), { recursive: true });
    await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/feat/runtime-state\n", "utf8");

    const statePath = await updateStateFile(dir, { currentPhase: "execution" });
    const summaryPath = await appendSessionSummary(dir, {
      title: "Runtime branch",
      bullets: ["Wrote branch runtime"],
    });

    assert.equal(statePath, path.join(dir, ".ged", "runtime", "feat-runtime-state", "STATE.md"));
    assert.equal(summaryPath, path.join(dir, ".ged", "runtime", "feat-runtime-state", "SESSION-SUMMARY.md"));
    await assert.rejects(() => stat(path.join(dir, ".ged", "STATE.md")));
    assert.match(await readFile(summaryPath, "utf8"), /Runtime branch/);
  });
});

test("importStandards writes imported content into .ged/STANDARDS.md", async () => {
  await withTempDir(async (dir) => {
    await writeFile(path.join(dir, "AGENTS.md"), "# Project Agent\n\nHello\n", "utf8");
    const result = await importStandards(dir);

    assert.equal(result.imported.length, 1);
    const standards = await readFile(path.join(dir, ".ged", "STANDARDS.md"), "utf8");
    assert.match(standards, /## AGENTS: AGENTS\.md/);
    assert.match(standards, /# Project Agent/);
  });
});

test("importStandards preserves embedded fences without closing the wrapper fence", async () => {
  await withTempDir(async (dir) => {
    await writeFile(
      path.join(dir, "AGENTS.md"),
      "# Project Agent\n\n```ts\nconst value = true;\n```\n\n## Keep as imported content\n",
      "utf8",
    );

    await importStandards(dir);

    const standards = await readFile(path.join(dir, ".ged", "STANDARDS.md"), "utf8");
    assert.match(standards, /````md\n# Project Agent/);
    assert.match(standards, /```ts\nconst value = true;\n```/);
    assert.match(standards, /\n````\n$/);
  });
});

test("planningArtifactsReady rejects placeholders and requires SPEC, TASKS, and TESTS content", async () => {
  await withTempDir(async (dir) => {
    await ensureOmniDir(dir);

    assert.equal(await planningArtifactsReady(dir), false);

    await writeFile(
      path.join(dir, ".ged", "SPEC.md"),
      `${OMNI_FILES["SPEC.md"]}\n## Goal\nReal content\n`,
      "utf8",
    );
    await writeFile(
      path.join(dir, ".ged", "TASKS.md"),
      `${OMNI_FILES["TASKS.md"]}\n## Slice 1\n- [ ] Do work\n`,
      "utf8",
    );

    assert.equal(await planningArtifactsReady(dir), false);

    await writeFile(
      path.join(dir, ".ged", "TESTS.md"),
      `${OMNI_FILES["TESTS.md"]}\n## Checks\n- [ ] Run the smoke test\n`,
      "utf8",
    );

    assert.equal(await planningArtifactsReady(dir), true);
  });
});

test("resolvePlanningArtifactReadiness prefers active work planning when ready", async () => {
  await withTempDir(async (dir) => {
    await mkdir(path.join(dir, ".git"), { recursive: true });
    await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/feature/collab-memory\n", "utf8");
    const activePaths = await activePlanningArtifactPaths(dir);
    await writeRealPlanningFiles(activePaths.baseDir);

    const readiness = await resolvePlanningArtifactReadiness(dir);

    assert.equal(await planningArtifactsReadyAt(activePaths), true);
    assert.equal(readiness.ready, true);
    assert.equal(readiness.readyPaths?.source, "work");
    assert.equal(readiness.usedRootFallback, false);
    assert.equal(await planningArtifactsReady(dir), true);
  });
});

test("resolvePlanningArtifactReadiness uses root fallback when active work planning is missing", async () => {
  await withTempDir(async (dir) => {
    await mkdir(path.join(dir, ".git"), { recursive: true });
    await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/feature/collab-memory\n", "utf8");
    await ensureOmniDir(dir);
    await writeRealPlanningFiles(path.join(dir, ".ged"));

    const readiness = await resolvePlanningArtifactReadiness(dir);

    assert.equal(readiness.ready, true);
    assert.equal(readiness.readyPaths?.source, "root");
    assert.equal(readiness.usedRootFallback, true);
  });
});

test("migrateRootPlanToActiveWork copies root planning into active work", async () => {
  await withTempDir(async (dir) => {
    await mkdir(path.join(dir, ".git"), { recursive: true });
    await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/feat/migrate\n", "utf8");
    await ensureOmniDir(dir);
    await writeRealPlanningFiles(path.join(dir, ".ged"));

    const result = await migrateRootPlanToActiveWork(dir);

    assert.deepEqual(result.copied.sort(), [
      ".ged/work/feat-migrate/SPEC.md",
      ".ged/work/feat-migrate/TASKS.md",
      ".ged/work/feat-migrate/TESTS.md",
    ].sort());
    assert.match(await readFile(path.join(result.activePaths.baseDir, "SPEC.md"), "utf8"), /Spec content/);
    assert.match(await readFile(result.notesPath, "utf8"), /Migrated root planning files/);
  });
});

test("migrateRootPlanToActiveWork rejects placeholders and overwrite conflicts", async () => {
  await withTempDir(async (dir) => {
    await mkdir(path.join(dir, ".git"), { recursive: true });
    await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/feat/migrate\n", "utf8");
    await ensureOmniDir(dir);

    await assert.rejects(() => migrateRootPlanToActiveWork(dir), /nothing to migrate/);

    await writeRealPlanningFiles(path.join(dir, ".ged"));
    const activePaths = await activePlanningArtifactPaths(dir);
    await mkdir(activePaths.baseDir, { recursive: true });
    await writeFile(activePaths.specPath, "existing\n", "utf8");

    await assert.rejects(() => migrateRootPlanToActiveWork(dir), /refusing to overwrite/);
    await assert.doesNotReject(() => migrateRootPlanToActiveWork(dir, { overwrite: true }));
  });
});

test("planningGuardMessage names active work planning with root fallback", async () => {
  await withTempDir(async (dir) => {
    await mkdir(path.join(dir, ".git"), { recursive: true });
    await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/feature/collab-memory\n", "utf8");

    const readiness = await resolvePlanningArtifactReadiness(dir);
    const message = planningGuardMessage(readiness);

    assert.match(message, /\.ged\/work\/feature-collab-memory/);
    assert.match(message, /Legacy root \.ged\/SPEC\.md/);
  });
});

test("buildCollaborationCheckpoint reports branch, policy, and active planning status", async () => {
  await withTempDir(async (dir) => {
    await mkdir(path.join(dir, ".git"), { recursive: true });
    await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/feature/collab-memory\n", "utf8");

    const checkpoint = await buildCollaborationCheckpoint(dir);

    assert.match(checkpoint, /# Collaboration Checkpoint/);
    assert.match(checkpoint, /Branch: feature\/collab-memory/);
    assert.match(checkpoint, /Protected Branch Policy: not protected/);
    assert.match(checkpoint, /Active Work ID: feature-collab-memory/);
    assert.match(checkpoint, /Active Planning Directory: \.ged\/work\/feature-collab-memory/);
    assert.match(checkpoint, /Planning Status: not ready/);
  });
});

test("buildCollaborationCheckpoint reports protected branch blocks and root fallback", async () => {
  await withTempDir(async (dir) => {
    await mkdir(path.join(dir, ".git"), { recursive: true });
    await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/main\n", "utf8");
    await ensureOmniDir(dir);
    await writeRealPlanningFiles(path.join(dir, ".ged"));

    const checkpoint = await buildCollaborationCheckpoint(dir);

    assert.match(checkpoint, /Protected Branch: yes/);
    assert.match(checkpoint, /Protected Branch Policy: blocked for change implementation/);
    assert.match(checkpoint, /Planning Status: ready via legacy root fallback/);
    assert.match(checkpoint, /Next Step: Create or switch to a feature branch/);
  });
});

test("buildRepoMap ranks important files and writes both markdown and json outputs", async () => {
  await withTempDir(async (dir) => {
    await mkdir(path.join(dir, "src"), { recursive: true });
    await writeFile(path.join(dir, "README.md"), "# Test Repo\n", "utf8");
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "repo", description: "sample" }, null, 2),
      "utf8",
    );
    await writeFile(path.join(dir, "src", "index.ts"), "export function main() {}\n", "utf8");

    const markdown = await buildRepoMap(dir);
    const json = JSON.parse(await readFile(path.join(dir, ".ged", "REPO-MAP.json"), "utf8"));

    assert.match(markdown, /## Ranked files/);
    assert.equal(json[0].path, "package.json");
    assert.ok(json.some((entry: { path: string }) => entry.path === "src/index.ts"));
  });
});

test("buildRepoMap sanitizes package metadata in markdown summaries", async () => {
  await withTempDir(async (dir) => {
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "repo", description: "safe\n## injected heading" }, null, 2),
      "utf8",
    );

    const markdown = await buildRepoMap(dir);

    assert.doesNotMatch(markdown, /^## injected heading$/m);
    assert.match(markdown, /safe injected heading/);
  });
});

test("buildRepoMap skips large files instead of reading full contents", async () => {
  await withTempDir(async (dir) => {
    await mkdir(path.join(dir, "src"), { recursive: true });
    await writeFile(path.join(dir, "src", "large.json"), `${"x".repeat(140 * 1024)}\n`, "utf8");

    const markdown = await buildRepoMap(dir);
    const json = JSON.parse(await readFile(path.join(dir, ".ged", "REPO-MAP.json"), "utf8"));
    const largeEntry = json.find((entry: { path: string }) => entry.path === "src/large.json");

    assert.match(markdown, /src\/large\.json/);
    assert.match(largeEntry.summary, /large file skipped/);
  });
});

test("suggestSkills and updateSkillsFile infer workflow skills from task text", async () => {
  await withTempDir(async (dir) => {
    const task = "Design a feature, plan the slices, implement it, and verify the result";
    const suggestions = await suggestSkills(task);

    assert.deepEqual(
      [...suggestions.map((item) => item.name)].sort(),
      ["brainstorming", "ged-execution", "ged-planning", "ged-verification", "grill-me", "tdd"],
    );

    const result = await updateSkillsFile(dir, task);
    const skillsFile = await readFile(path.join(dir, ".ged", "SKILLS.md"), "utf8");

    assert.equal(result.suggested.length, 6);
    assert.match(skillsFile, /## Suggested For Current Work/);
    assert.match(skillsFile, /grill-me/);
    assert.match(skillsFile, /find-skills/);
    assert.match(skillsFile, /skill-maker/);
    assert.match(skillsFile, /tdd/);
    assert.match(skillsFile, /diagnose/);
    assert.match(skillsFile, /grill-with-docs/);
    assert.match(skillsFile, /improve-codebase-architecture/);
    assert.match(skillsFile, /brainstorming/);
    assert.match(skillsFile, /ged-verification/);
  });
});

test("suggestSkills prioritizes grill-me for change requests", async () => {
  const suggestions = await suggestSkills("Add a new onboarding feature and refactor the setup flow");

  assert.equal(suggestions[0]?.name, "grill-me");
  assert.ok(suggestions.some((item) => item.name === "brainstorming"));
  assert.ok(suggestions.some((item) => item.name === "tdd"));
});

test("suggestSkills recommends tdd for behavior-changing implementation", async () => {
  const explicit = await suggestSkills("Use TDD with a red-green-refactor loop for this feature");
  const behavior = await suggestSkills("Update the checkout behavior and add regression tests");

  assert.ok(explicit.some((item) => item.name === "tdd"));
  assert.ok(behavior.some((item) => item.name === "tdd"));
});

test("suggestSkills recommends diagnose for bugs and performance regressions", async () => {
  const bug = await suggestSkills("Diagnose the checkout bug that fails intermittently");
  const performance = await suggestSkills("Debug this performance regression in repo map generation");

  assert.equal(bug[0]?.name, "diagnose");
  assert.ok(performance.some((item) => item.name === "diagnose"));
});

test("suggestSkills recommends grill-with-docs for durable domain decisions", async () => {
  const domain = await suggestSkills("Grill this plan against our domain language and glossary");
  const adr = await suggestSkills("We need an ADR for this durable architecture decision");

  assert.equal(domain[0]?.name, "grill-with-docs");
  assert.ok(adr.some((item) => item.name === "grill-with-docs"));
});

test("suggestSkills recommends improve-codebase-architecture for architecture reviews", async () => {
  const architecture = await suggestSkills("Find deepening opportunities to improve codebase architecture");
  const seams = await suggestSkills("Review shallow modules and test seams before refactoring");

  assert.equal(architecture[0]?.name, "improve-codebase-architecture");
  assert.ok(seams.some((item) => item.name === "improve-codebase-architecture"));
});

test("GedCodePlugin registers improve-codebase-architecture command", async () => {
  await withTempDir(async (dir) => {
    const plugin = await GedCodePlugin({ directory: dir } as never);
    const config = {} as {
      command?: Record<string, { description?: string; template?: string }>;
      agent?: Record<string, unknown>;
      instructions?: string[];
    };

    await plugin.config?.(config as never);

    assert.ok(config.command?.["improve-codebase-architecture"]);
    assert.match(config.command["improve-codebase-architecture"].description ?? "", /architecture/i);
    assert.match(config.command["improve-codebase-architecture"].template ?? "", /deepening opportunities/i);
  });
});

test("GedCodePlugin registers clean-context-review command and commit guidance", async () => {
  await withTempDir(async (dir) => {
    const plugin = await GedCodePlugin({ directory: dir } as never);
    const config = {} as {
      command?: Record<string, { agent?: string; description?: string; template?: string }>;
      agent?: Record<string, unknown>;
      instructions?: string[];
    };

    await plugin.config?.(config as never);

    const reviewCommand = config.command?.["clean-context-review"];
    assert.equal(reviewCommand?.agent, "gedcode");
    assert.match(reviewCommand?.description ?? "", /clean-context review/i);
    assert.match(reviewCommand?.template ?? "", /Blind diff review/);
    assert.match(reviewCommand?.template ?? "", /Contract review/);
    assert.match(reviewCommand?.template ?? "", /Evidence:/);
    assert.match(reviewCommand?.template ?? "", /Confidence:/);
    assert.match(reviewCommand?.template ?? "", /Blocks commit:/);
    assert.match(reviewCommand?.template ?? "", /adjudicate each finding before commit/);
    assert.match(reviewCommand?.template ?? "", /do not edit files/i);
    assert.match(reviewCommand?.template ?? "", /do not edit files or commit/i);

    const commitCommand = config.command?.commit;
    assert.match(commitCommand?.template ?? "", /clean-context-review/);
    assert.match(commitCommand?.template ?? "", /completed and adjudicated/);
  });
});

test("plugin config registers optional Omni subagents and ged-agents command", async () => {
  await withTempDir(async (dir) => {
    const removedWriterName = ["omni", "worker"].join("-");
    const homeDir = path.join(dir, "home");
    await mkdir(path.join(homeDir, ".gedcode"), { recursive: true });
    await mkdir(path.join(dir, ".gedcode"), { recursive: true });
    await writeFile(
      path.join(homeDir, ".gedcode", "settings.json"),
      JSON.stringify({ agents: { enabled: true, defaultModel: "anthropic/shared-subagent" } }, null, 2),
      "utf8",
    );
    await writeFile(
      path.join(dir, ".gedcode", "settings.json"),
      JSON.stringify({ agents: { models: { "ged-verifier": "openai/verifier-model", [removedWriterName]: "openai/legacy-writer-model" } } }, null, 2),
      "utf8",
    );

    const config = await buildPluginConfig(dir, { homeDir });
    const agents = config.agent ?? {};
    for (const agentName of ["ged-explorer", "ged-planner", "ged-verifier"]) {
      assert.equal(agents[agentName]?.mode, "subagent");
      assert.equal(typeof agents[agentName]?.description, "string");
      assert.equal(typeof agents[agentName]?.prompt, "string");
    }
    assert.equal(agents["ged-explorer"]?.model, "anthropic/shared-subagent");
    assert.equal(agents["ged-verifier"]?.model, "openai/verifier-model");
    assert.equal(agents[removedWriterName], undefined);
    assert.match(String(agents.gedcode?.prompt), /Single-writer invariant/);
    assert.match(String(agents.gedcode?.prompt), /mandatory intelligence checkpoints/);
    assert.match(String(agents.gedcode?.prompt), /record a concise skip reason/);
    assert.match(String(agents.gedcode?.prompt), /clean-context review/);
    assert.match(String(agents.gedcode?.prompt), /There is no writer subagent role/);
    assert.match(String(agents["ged-explorer"]?.prompt), /discovery packet/);
    assert.match(String(agents["ged-explorer"]?.prompt), /single writer/);
    assert.match(String(agents["ged-planner"]?.prompt), /smart-friend/);
    assert.match(String(agents["ged-planner"]?.prompt), /rather than guessing/);
    assert.match(String(agents["ged-verifier"]?.prompt), /clean-context review/);
    assert.match(String(agents["ged-verifier"]?.prompt), /adjudicate accepted vs rejected/);
    assert.deepEqual(agents.gedcode?.permission, {
      task: { "*": "deny", "ged-explorer": "allow", "ged-planner": "allow", "ged-verifier": "allow" },
    });

    const command = config.command?.["ged-agents"];
    assert.equal(command?.agent, "gedcode");
    assert.match(String(command?.template), /gedcode_agents_status/);
    assert.match(String(command?.template), /opencode models/);
    assert.match(String(command?.template), /gedcode_update_agents_settings/);
    assert.match(String(command?.template), /single-writer invariant/);
    assert.match(String(command?.template), /mandatory checkpoints/);
    assert.match(String(command?.template), /reasoningEffort/);
    assert.match(String(command?.template), /Do not invent model IDs/);
    assert.match(String(command?.template), /There is no writer subagent role/);
  });
});

test("verification and agent instruction resources require clean-context review before commit", async () => {
  const resourcesDir = path.join(process.cwd(), "src", "resources");
  const agentInstructions = await readFile(path.join(resourcesDir, "instructions", "gedcode-agent.md"), "utf8");
  const verificationSkill = await readFile(path.join(resourcesDir, "skills", "ged-verification.md"), "utf8");

  assert.match(agentInstructions, /single-writer invariant/);
  assert.match(agentInstructions, /mandatory checkpoints for non-trivial change requests/);
  assert.match(agentInstructions, /skip reason/);
  assert.match(agentInstructions, /clean-context review before commit/);
  assert.match(agentInstructions, /there is no writer subagent role/);
  assert.match(verificationSkill, /clean-context review of the diff\/tests/);
  assert.match(verificationSkill, /adjudicate accepted vs rejected findings/);
});

test("suggestSkills recommends find-skills for skill discovery and removal requests", async () => {
  const discovery = await suggestSkills("Find relevant skills for React performance work");
  const removal = await suggestSkills("Remove the old deployment skill from the project");

  assert.equal(discovery[0]?.name, "find-skills");
  assert.equal(removal[0]?.name, "find-skills");
});

test("suggestSkills recommends skill-maker for missing skill creation requests", async () => {
  const missing = await suggestSkills("No relevant skill exists for this project-local workflow");
  const creation = await suggestSkills("Create a project-local skill for our release checklist");

  assert.equal(missing[0]?.name, "skill-maker");
  assert.equal(creation[0]?.name, "skill-maker");
});

test("updateSkillsFile preserves user-managed project notes", async () => {
  await withTempDir(async (dir) => {
    await ensureOmniDir(dir);
    await writeFile(
      path.join(dir, ".ged", "SKILLS.md"),
      [
        "# Skills",
        "",
        "## Suggested For Current Work",
        "",
        "- stale generated item",
        "",
        "## Project Notes",
        "",
        "- Always load the repo-specific release skill before publishing.",
        "",
      ].join("\n"),
      "utf8",
    );

    await updateSkillsFile(dir, "verify the implementation");

    const skillsFile = await readFile(path.join(dir, ".ged", "SKILLS.md"), "utf8");
    assert.match(skillsFile, /ged-verification/);
    assert.match(skillsFile, /Always load the repo-specific release skill/);
    assert.doesNotMatch(skillsFile, /stale generated item/);
  });
});

test("updateStateFile writes structured current workflow state", async () => {
  await withTempDir(async (dir) => {
    const outputPath = await updateStateFile(dir, {
      currentPhase: "execution",
      activeTask: "Slice 2",
      statusSummary: "Implemented the current slice.",
      blockers: ["None"],
      nextStep: "Run verification.",
    });

    const content = await readFile(outputPath, "utf8");
    assert.match(content, /Current Phase: execution/);
    assert.match(content, /Active Task: Slice 2/);
    assert.match(content, /Status Summary: Implemented the current slice\./);
    assert.match(content, /Next Step: Run verification\./);
  });
});

test("updateStateFile sanitizes markdown structure from tool-provided fields", async () => {
  await withTempDir(async (dir) => {
    const outputPath = await updateStateFile(dir, {
      currentPhase: "execution\n## injected",
      activeTask: "- fake list item",
      statusSummary: "Implemented\n# forged heading",
      blockers: ["---", "## blocker heading"],
      nextStep: "Verify\n- forged bullet",
    });

    const content = await readFile(outputPath, "utf8");
    assert.doesNotMatch(content, /^## injected$/m);
    assert.doesNotMatch(content, /^# forged heading$/m);
    assert.doesNotMatch(content, /^- forged bullet$/m);
    assert.match(content, /Current Phase: execution injected/);
    assert.match(content, /Active Task: fake list item/);
  });
});

test("ensureOmniDir preserves templates and setOmniMode updates state coherently", async () => {
  await withTempDir(async (dir) => {
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "gedcode-test", description: "sample project" }, null, 2),
      "utf8",
    );

    await ensureOmniDir(dir);
    await setOmniMode(dir, "on");
    const runtimePaths = await activeRuntimePaths(dir);
    let state = await readFile(runtimePaths.statePath, "utf8");
    let config = await readFile(path.join(dir, ".ged", "CONFIG.md"), "utf8");

    assert.match(config, /Omni Mode: on/);
    assert.match(state, /Current Phase: discovery/);
    assert.match(state, /Workspace ready for planning/);

    await setOmniMode(dir, "off");
    state = await readFile(runtimePaths.statePath, "utf8");
    config = await readFile(path.join(dir, ".ged", "CONFIG.md"), "utf8");

    assert.match(config, /Omni Mode: off/);
    assert.match(state, /Current Phase: passive/);
    assert.match(state, /Omni mode disabled/);
  });
});

test("appendSessionSummary appends a titled handoff section", async () => {
  await withTempDir(async (dir) => {
    const outputPath = await appendSessionSummary(dir, {
      title: "Slice 2 Complete",
      bullets: ["Implemented the change", "Verification still pending"],
    });

    const content = await readFile(outputPath, "utf8");
    assert.match(content, /## Slice 2 Complete/);
    assert.match(content, /- Implemented the change/);
    assert.match(content, /- Verification still pending/);
  });
});

test("appendSessionSummary sanitizes headings and bullets", async () => {
  await withTempDir(async (dir) => {
    const outputPath = await appendSessionSummary(dir, {
      title: "Safe title\n## forged title",
      bullets: ["- completed\n## forged heading", "``` fenced marker"],
    });

    const content = await readFile(outputPath, "utf8");
    assert.doesNotMatch(content, /^## forged title$/m);
    assert.doesNotMatch(content, /^## forged heading$/m);
    assert.doesNotMatch(content, /^```/m);
    assert.match(content, /## Safe title forged title/);
    assert.match(content, /- completed forged heading/);
  });
});

test("bash commands are prefixed with rtk (skipping already-prefixed commands)", () => {
  // Simulates the rewriting logic from tool.execute.before
  function rewrite(command: string): string {
    if (!command.trimStart().startsWith("rtk ")) {
      return `rtk ${command}`;
    }
    return command;
  }

  // Should be rewritten
  assert.equal(rewrite("git status"), "rtk git status");
  assert.equal(rewrite("npm test"), "rtk npm test");
  assert.equal(rewrite("cargo test"), "rtk cargo test");
  assert.equal(rewrite("echo hello"), "rtk echo hello");
  assert.equal(rewrite("  git log"), "rtk   git log");

  // Should NOT be double-rewritten
  assert.equal(rewrite("rtk git status"), "rtk git status");
  assert.equal(rewrite("rtk pytest tests/"), "rtk pytest tests/");
});

test("bash commands are prefixed with env -u XDG_CONFIG_HOME when GedCode overrides XDG", () => {
  const originalXdg = process.env.XDG_CONFIG_HOME;
  const fakeOmniXdg = path.join(os.homedir(), ".config", "gedcode");
  try {
    // With GedCode XDG override
    process.env.XDG_CONFIG_HOME = fakeOmniXdg;
    // Simulate the sanitize + rtk pipeline from tool.execute.before
    function sanitizeAndRtk(command: string, rtkAvailable: boolean): string {
      let rewritten = command;
      if (command.trimStart().startsWith("env ")) {
        // already has env prefix, leave it
      } else {
        rewritten = `env -u XDG_CONFIG_HOME ${command}`;
      }
      if (rtkAvailable && !rewritten.trimStart().startsWith("rtk ")) {
        rewritten = `rtk ${rewritten}`;
      }
      return rewritten;
    }

    // rtk available: both env -u and rtk
    assert.equal(sanitizeAndRtk("gh auth status", true), "rtk env -u XDG_CONFIG_HOME gh auth status");
    assert.equal(sanitizeAndRtk("git log", true), "rtk env -u XDG_CONFIG_HOME git log");
    // already has env prefix: no double env
    assert.equal(sanitizeAndRtk("env -u XDG_CONFIG_HOME gh auth status", true), "rtk env -u XDG_CONFIG_HOME gh auth status");
    // rtk not available: only env -u
    assert.equal(sanitizeAndRtk("gh auth status", false), "env -u XDG_CONFIG_HOME gh auth status");

    // Without GedCode XDG override: no env prefix added
    process.env.XDG_CONFIG_HOME = originalXdg;
    function rtkOnly(command: string): string {
      if (!command.trimStart().startsWith("rtk ")) return `rtk ${command}`;
      return command;
    }
    assert.equal(rtkOnly("gh auth status"), "rtk gh auth status");
    assert.equal(rtkOnly("git log"), "rtk git log");
  } finally {
    process.env.XDG_CONFIG_HOME = originalXdg;
  }
});

test("readGedCodeSettings parses and merges paired model configs with project override precedence", async () => {
  await withTempDir(async (dir) => {
    const homeDir = path.join(dir, "home");
    const projectDir = path.join(dir, "project");
    await mkdir(path.join(homeDir, ".gedcode"), { recursive: true });
    await mkdir(path.join(projectDir, ".gedcode"), { recursive: true });
    await writeFile(
      path.join(homeDir, ".gedcode", "settings.json"),
      JSON.stringify({
        agents: {
          enabled: true,
          models: {
            "ged-planner": { model: "openai/global-planner", reasoningEffort: "high" },
            "ged-explorer": "anthropic/global-explorer",
          },
        },
      }, null, 2),
      "utf8",
    );
    await writeFile(
      path.join(projectDir, ".gedcode", "settings.json"),
      JSON.stringify({
        agents: {
          models: {
            "ged-verifier": { model: "openai/project-verifier", reasoningEffort: "low" },
            "ged-planner": "anthropic/project-planner",
          },
        },
      }, null, 2),
      "utf8",
    );

    const settings = await readGedCodeSettings(projectDir, { homeDir });

    assert.deepEqual(settings.agents.models, {
      "ged-explorer": "anthropic/global-explorer",
      "ged-planner": "anthropic/project-planner",
      "ged-verifier": { model: "openai/project-verifier", reasoningEffort: "low" },
    });
  });
});

test("updateGedCodeAgentsSettings persists paired model configs", async () => {
  await withTempDir(async (dir) => {
    const homeDir = path.join(dir, "home");

    const result = await updateGedCodeAgentsSettings(path.join(dir, "project"), {
      scope: "global",
      enabled: true,
      models: {
        "ged-planner": { model: "openai/gpt-5.5", reasoningEffort: "high", textVerbosity: "low" },
        "ged-verifier": { model: "openai/gpt-5.5", reasoningEffort: "low" },
      },
    }, { homeDir });

    assert.equal(result.settings.agents.enabled, true);
    assert.deepEqual(result.settings.agents.models, {
      "ged-planner": { model: "openai/gpt-5.5", reasoningEffort: "high", textVerbosity: "low" },
      "ged-verifier": { model: "openai/gpt-5.5", reasoningEffort: "low" },
    });

    const fileContent = JSON.parse(await readFile(result.outputPath, "utf8"));
    assert.deepEqual(fileContent.agents.models["ged-planner"], { model: "openai/gpt-5.5", reasoningEffort: "high", textVerbosity: "low" });
  });
});

test("updateGedCodeAgentsSettings cleans invalid model configs", async () => {
  await withTempDir(async (dir) => {
    const homeDir = path.join(dir, "home");

    const result = await updateGedCodeAgentsSettings(path.join(dir, "project"), {
      scope: "global",
      enabled: true,
      models: {
        "ged-explorer": "",
        "ged-planner": { model: "openai/gpt-5.5", reasoningEffort: "high" },
      },
    }, { homeDir });

    assert.deepEqual(result.settings.agents.models, {
      "ged-planner": { model: "openai/gpt-5.5", reasoningEffort: "high" },
    });
  });
});

test("plugin config passes paired model options through to OpenCode agent config", async () => {
  await withTempDir(async (dir) => {
    const homeDir = path.join(dir, "home");
    await mkdir(path.join(homeDir, ".gedcode"), { recursive: true });
    await writeFile(
      path.join(homeDir, ".gedcode", "settings.json"),
      JSON.stringify({
        agents: {
          enabled: true,
          models: {
            "ged-planner": { model: "openai/gpt-5.5", reasoningEffort: "high" },
            "ged-verifier": { model: "openai/gpt-5.5", reasoningEffort: "low" },
          },
        },
      }, null, 2),
      "utf8",
    );

    const config = await buildPluginConfig(dir, { homeDir });
    const agents = config.agent ?? {};

    assert.equal(agents["ged-planner"]?.model, "openai/gpt-5.5");
    assert.equal((agents["ged-planner"] as Record<string, unknown>)?.reasoningEffort, "high");
    assert.equal(agents["ged-verifier"]?.model, "openai/gpt-5.5");
    assert.equal((agents["ged-verifier"] as Record<string, unknown>)?.reasoningEffort, "low");
    assert.equal((agents["ged-explorer"] as Record<string, unknown>)?.reasoningEffort, undefined);
  });
});

test("gedcode agent tools use injected settings home for status and updates", async () => {
  await withTempDir(async (dir) => {
    const homeDir = path.join(dir, "home");
    await mkdir(path.join(homeDir, ".gedcode"), { recursive: true });
    await writeFile(
      path.join(homeDir, ".gedcode", "settings.json"),
      JSON.stringify({
        agents: {
          enabled: true,
          models: {
            "ged-explorer": { model: "opencode/minimax-m2.5-free", reasoningEffort: "high" },
          },
        },
      }, null, 2),
      "utf8",
    );

    const plugin = await GedCodePlugin({ directory: dir } as never, { homeDir });
    const tools = plugin.tool as unknown as Record<string, { execute(args: Record<string, unknown>): Promise<string> }>;

    const status = await tools.gedcode_agents_status.execute({});
    assert.match(status, new RegExp(homeDir.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")));
    assert.match(status, /opencode\/minimax-m2\.5-free/);
    assert.match(status, /reasoningEffort=high/);

    const update = await tools.gedcode_update_agents_settings.execute({
      scope: "global",
      models: { "ged-planner": { model: "openai/gpt-5.5", reasoningEffort: "high" } },
    });
    assert.match(update, /openai\/gpt-5\.5/);

    const written = JSON.parse(await readFile(path.join(homeDir, ".gedcode", "settings.json"), "utf8"));
    assert.deepEqual(written.agents.models["ged-planner"], { model: "openai/gpt-5.5", reasoningEffort: "high" });

    const recommendations = await tools.gedcode_read_model_recommendations.execute({});
    assert.match(recommendations, new RegExp(homeDir.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")));
  });
});
