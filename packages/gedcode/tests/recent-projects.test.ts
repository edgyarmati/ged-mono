import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { readRecentProjects, recordRecentProject } from "../src/recent-projects.js";

describe("recent projects", () => {
  it("records newest project first and deduplicates", async () => {
    const userData = await mkdtemp(path.join(os.tmpdir(), "gedcode-recent-"));

    await recordRecentProject(userData, "/tmp/one");
    await recordRecentProject(userData, "/tmp/two");
    await recordRecentProject(userData, "/tmp/one");

    await expect(readRecentProjects(userData)).resolves.toEqual(["/tmp/one", "/tmp/two"]);
  });
});
