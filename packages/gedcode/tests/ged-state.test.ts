import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { readGedDashboardSnapshot } from "../src/ged-state.js";

async function fixtureProject(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "gedcode-state-"));
  await mkdir(path.join(root, ".git"));
  await writeFile(path.join(root, ".git", "HEAD"), "ref: refs/heads/feat/gui\n");
  await mkdir(path.join(root, ".ged", "work", "feat-gui"), { recursive: true });
  await mkdir(path.join(root, ".ged", "runtime", "feat-gui"), { recursive: true });
  return root;
}

describe("readGedDashboardSnapshot", () => {
  it("reads durable, active work, runtime, and checkpoint state", async () => {
    const root = await fixtureProject();
    await writeFile(path.join(root, ".ged", "PROJECT.md"), "# Project\n");
    await writeFile(path.join(root, ".ged", "work", "feat-gui", "SPEC.md"), "# Spec\n");
    await writeFile(path.join(root, ".ged", "runtime", "feat-gui", "STATE.md"), "# State\n");
    await writeFile(
      path.join(root, ".ged", "runtime", "feat-gui", "checkpoints.json"),
      `${JSON.stringify({
        schemaVersion: 3,
        lifecycleStatus: "active",
        classification: "trivial",
        classificationReason: "fixture",
        planCheckpoints: {},
        taskCheckpoints: {},
      })}\n`,
    );

    const snapshot = await readGedDashboardSnapshot(root);

    expect(snapshot.workId).toBe("feat-gui");
    expect(snapshot.durable.project).toContain("# Project");
    expect(snapshot.activeWork.spec).toContain("# Spec");
    expect(snapshot.runtime.state).toContain("# State");
    expect(snapshot.runtime.checkpoints?.classification).toBe("trivial");
  });

  it("reports corrupt checkpoint JSON without throwing", async () => {
    const root = await fixtureProject();
    await writeFile(path.join(root, ".ged", "runtime", "feat-gui", "checkpoints.json"), "not-json");

    const snapshot = await readGedDashboardSnapshot(root);

    expect(snapshot.runtime.checkpoints).toBeUndefined();
    expect(snapshot.runtime.checkpointError).toBeTruthy();
  });
});
