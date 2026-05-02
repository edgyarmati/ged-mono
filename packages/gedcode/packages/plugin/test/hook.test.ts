import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";

import type { PluginInput } from "@opencode-ai/plugin";

import { GedCodePlugin, ensureOmniDir, setOmniMode } from "../src/index.ts";

type ToolExecuteBefore = (
  input: { tool: string },
  output: { args: Record<string, unknown> },
) => Promise<void>;

async function withTempDir(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gedcode-hook-test-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function buildHook(directory: string): Promise<ToolExecuteBefore> {
  const hooks = await GedCodePlugin(
    { directory } as unknown as PluginInput,
  );
  const hook = hooks["tool.execute.before"];
  if (!hook) throw new Error("GedCodePlugin did not register tool.execute.before");
  return hook as unknown as ToolExecuteBefore;
}

async function writeRealPlanning(directory: string) {
  const omniDir = path.join(directory, ".ged");
  await writeFile(
    path.join(omniDir, "SPEC.md"),
    [
      "# Spec",
      "",
      "## Problem",
      "",
      "The tool.execute.before hook must reject mutating tool calls when the durable planning artifacts are still placeholder bootstrap content. Writing source files before there is a real spec, task list, and test list defeats GedCode's plan-before-edit discipline.",
      "",
      "## Requested Behavior",
      "",
      "The hook returns without throwing when SPEC.md, TASKS.md, and TESTS.md all hold concrete project-specific content that differs in both shape and length from the bundled placeholders, and the active tool is write or edit on a path outside .ged/.",
      "",
      "## Constraints",
      "",
      "Tests must remain deterministic across hosts and must not depend on which CLI tools happen to be installed on PATH.",
      "",
      "## Success Criteria",
      "",
      "Every code path inside tool.execute.before is exercised: read passthrough, .ged allowlist, placeholder rejection, real-planning acceptance, and Omni-mode-off bypass.",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(omniDir, "TASKS.md"),
    [
      "# Tasks",
      "",
      "## Planned slices",
      "",
      "- [ ] Slice 1: cover the read tool passthrough so non-mutating tools are never blocked",
      "- [ ] Slice 2: cover the .ged allowlist for both absolute and relative target paths",
      "- [ ] Slice 3: cover placeholder rejection for write and edit",
      "- [ ] Slice 4: cover real-planning acceptance for write and edit",
      "- [ ] Slice 5: cover the Omni-mode-off bypass",
      "",
      "## Notes",
      "",
      "Each slice is verified by a dedicated test in packages/plugin/test/hook.test.ts.",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(omniDir, "TESTS.md"),
    [
      "# Tests",
      "",
      "## Checks",
      "",
      "- [ ] Hook returns without throwing for the read tool even with placeholder planning artifacts",
      "- [ ] Hook rejects write and edit when SPEC, TASKS, or TESTS are still bootstrap content",
      "- [ ] Hook accepts write and edit once SPEC, TASKS, and TESTS contain concrete project content",
      "- [ ] Hook always allows writes targeting paths inside .ged/",
      "- [ ] Hook is a no-op when Omni mode is off, regardless of planning state",
      "",
      "## Expected outcomes",
      "",
      "All five hook tests pass under npm test in the plugin workspace and in CI.",
      "",
    ].join("\n"),
    "utf8",
  );
}

async function writeGitBranch(directory: string, branch: string) {
  await mkdir(path.join(directory, ".git"), { recursive: true });
  await writeFile(path.join(directory, ".git", "HEAD"), `ref: refs/heads/${branch}\n`, "utf8");
}

test("tool.execute.before allows non-mutating tools regardless of planning state", async () => {
  await withTempDir(async (dir) => {
    await ensureOmniDir(dir);
    await setOmniMode(dir, "on");
    const hook = await buildHook(dir);

    await hook(
      { tool: "read" },
      { args: { filePath: path.join(dir, "src", "example.ts") } },
    );
  });
});

test("tool.execute.before rejects write/edit when planning artifacts are placeholders", async () => {
  await withTempDir(async (dir) => {
    await ensureOmniDir(dir);
    await setOmniMode(dir, "on");
    const hook = await buildHook(dir);

    await assert.rejects(
      () => hook(
        { tool: "write" },
        { args: { filePath: path.join(dir, "src", "example.ts") } },
      ),
      /GedCode guard: before editing source files/,
    );
    await assert.rejects(
      () => hook(
        { tool: "edit" },
        { args: { filePath: path.join(dir, "src", "example.ts") } },
      ),
      /GedCode guard: before editing source files/,
    );
  });
});

test("tool.execute.before names active work planning path when branch planning is missing", async () => {
  await withTempDir(async (dir) => {
    await ensureOmniDir(dir);
    await setOmniMode(dir, "on");
    await writeGitBranch(dir, "feature/collab-memory");
    const hook = await buildHook(dir);

    await assert.rejects(
      () => hook(
        { tool: "write" },
        { args: { filePath: path.join(dir, "src", "example.ts") } },
      ),
      /\.ged\/work\/feature-collab-memory/,
    );
  });
});

test("tool.execute.before rejects mutating bash commands when planning artifacts are placeholders", async () => {
  await withTempDir(async (dir) => {
    await ensureOmniDir(dir);
    await setOmniMode(dir, "on");
    const hook = await buildHook(dir);

    await assert.rejects(
      () => hook(
        { tool: "bash" },
        { args: { command: "printf 'changed' > src/example.ts" } },
      ),
      /GedCode guard: before editing source files or running mutating shell commands/,
    );
    await assert.rejects(
      () => hook(
        { tool: "bash" },
        { args: { command: "rm src/example.ts" } },
      ),
      /GedCode guard: before editing source files or running mutating shell commands/,
    );
  });
});

test("tool.execute.before allows non-mutating bash commands before planning", async () => {
  await withTempDir(async (dir) => {
    await ensureOmniDir(dir);
    await setOmniMode(dir, "on");
    const hook = await buildHook(dir);

    await hook(
      { tool: "bash" },
      { args: { command: "git status --short" } },
    );
  });
});

test("tool.execute.before allows write/edit once SPEC, TASKS, and TESTS hold real content", async () => {
  await withTempDir(async (dir) => {
    await ensureOmniDir(dir);
    await setOmniMode(dir, "on");
    await writeRealPlanning(dir);
    const hook = await buildHook(dir);

    await hook(
      { tool: "write" },
      { args: { filePath: path.join(dir, "src", "example.ts") } },
    );
    await hook(
      { tool: "edit" },
      { args: { filePath: path.join(dir, "src", "example.ts") } },
    );
  });
});

test("tool.execute.before rejects source mutation on protected branches", async () => {
  await withTempDir(async (dir) => {
    await ensureOmniDir(dir);
    await setOmniMode(dir, "on");
    await writeRealPlanning(dir);
    await writeGitBranch(dir, "main");
    const hook = await buildHook(dir);

    await assert.rejects(
      () => hook(
        { tool: "write" },
        { args: { filePath: path.join(dir, "src", "example.ts") } },
      ),
      /change requests should run on a feature branch, not main/,
    );
  });
});

test("tool.execute.before allows protected branch mutation with project settings override", async () => {
  await withTempDir(async (dir) => {
    await ensureOmniDir(dir);
    await setOmniMode(dir, "on");
    await writeRealPlanning(dir);
    await writeGitBranch(dir, "main");
    await mkdir(path.join(dir, ".gedcode"), { recursive: true });
    await writeFile(
      path.join(dir, ".gedcode", "settings.json"),
      JSON.stringify({ workflow: { allowProtectedBranchChanges: true } }),
      "utf8",
    );
    const hook = await buildHook(dir);

    await hook(
      { tool: "write" },
      { args: { filePath: path.join(dir, "src", "example.ts") } },
    );
  });
});

test("tool.execute.before always allows writes inside .ged/ even with placeholder planning", async () => {
  await withTempDir(async (dir) => {
    await ensureOmniDir(dir);
    await setOmniMode(dir, "on");
    const hook = await buildHook(dir);

    await hook(
      { tool: "write" },
      { args: { filePath: path.join(dir, ".ged", "SPEC.md") } },
    );
    await hook(
      { tool: "edit" },
      { args: { filePath: ".ged/TASKS.md" } },
    );
  });
});

test("tool.execute.before rejects paths that escape the project .ged directory", async () => {
  await withTempDir(async (dir) => {
    await ensureOmniDir(dir);
    await setOmniMode(dir, "on");
    const hook = await buildHook(dir);

    await assert.rejects(
      () => hook(
        { tool: "write" },
        { args: { filePath: path.join(dir, ".ged", "..", "src", "example.ts") } },
      ),
      /GedCode guard: before editing source files/,
    );
  });
});

test("tool.execute.before is a no-op when Omni mode is off", async () => {
  await withTempDir(async (dir) => {
    await ensureOmniDir(dir);
    await setOmniMode(dir, "off");
    const hook = await buildHook(dir);

    await hook(
      { tool: "write" },
      { args: { filePath: path.join(dir, "src", "example.ts") } },
    );
  });
});
