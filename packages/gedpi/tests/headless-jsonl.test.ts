import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

import {
  readHeadlessSnapshot,
  runHeadlessJsonl,
} from "../bin/headless-jsonl.js";

const execFileAsync = promisify(execFile);

async function fixtureProject(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "gedpi-headless-"));
  await execFileAsync("git", ["init", "-b", "feat/headless"], { cwd: root });
  await mkdir(path.join(root, ".ged", "work", "feat-headless"), {
    recursive: true,
  });
  await mkdir(path.join(root, ".ged", "runtime", "feat-headless"), {
    recursive: true,
  });
  await writeFile(path.join(root, ".ged", "VERSION"), "1\n");
  await writeFile(path.join(root, ".ged", "PROJECT.md"), "# Project\n");
  await writeFile(
    path.join(root, ".ged", "work", "feat-headless", "SPEC.md"),
    "# Spec\n",
  );
  await writeFile(
    path.join(root, ".ged", "runtime", "feat-headless", "STATE.md"),
    "# State\n",
  );
  await writeFile(
    path.join(root, ".ged", "runtime", "feat-headless", "checkpoints.json"),
    `${JSON.stringify({
      schemaVersion: 3,
      lifecycleStatus: "active",
      classification: "trivial",
      classificationReason: "fixture",
      planCheckpoints: {},
      taskCheckpoints: {},
    })}\n`,
  );
  return root;
}

function runJsonlOnce(
  projectRoot: string,
  command: unknown,
): Promise<unknown[]> {
  const input = new PassThrough();
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  output.on("data", (chunk: Buffer) => chunks.push(chunk));
  const run = runHeadlessJsonl({ projectRoot, input, output });
  input.write(`${JSON.stringify(command)}\n`);
  input.end();
  return run.then(() =>
    Buffer.concat(chunks)
      .toString("utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown),
  );
}

describe("readHeadlessSnapshot", () => {
  it("reads Ged project, active work, runtime, checkpoints, and settings summary", async () => {
    const root = await fixtureProject();

    const snapshot = await readHeadlessSnapshot(root);

    expect(snapshot.workId).toBe("feat-headless");
    expect(snapshot.gedInitialized).toBe(true);
    expect((snapshot.durable as { project?: string }).project).toContain(
      "# Project",
    );
    expect((snapshot.activeWork as { spec?: string }).spec).toContain("# Spec");
    expect((snapshot.runtime as { state?: string }).state).toContain("# State");
    expect(
      (snapshot.runtime as { checkpoints?: { classification?: string } })
        .checkpoints?.classification,
    ).toBe("trivial");
    expect(
      (snapshot.settings as { projectPath?: string }).projectPath,
    ).toContain(".gedoc/settings.json");
  });
});

describe("runHeadlessJsonl", () => {
  it("responds to snapshot.read commands", async () => {
    const root = await fixtureProject();

    const messages = await runJsonlOnce(root, {
      id: "1",
      type: "snapshot.read",
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      type: "session.ready",
      projectRoot: root,
    });
    expect(messages[1]).toMatchObject({ id: "1", type: "response.snapshot" });
    expect(
      (messages[1] as { snapshot: { workId: string } }).snapshot.workId,
    ).toBe("feat-headless");
  });

  it("returns structured errors for invalid json", async () => {
    const root = await fixtureProject();
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk));

    const run = runHeadlessJsonl({ projectRoot: root, input, output });
    input.write("not-json\n");
    input.end();
    await run;

    const messages = Buffer.concat(chunks)
      .toString("utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { type: string; code?: string });
    expect(messages[1]).toMatchObject({
      type: "response.error",
      code: "GEDPI_HEADLESS_INVALID_JSON",
    });
  });
});
