import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { activeWorkId, branchNameToWorkId } from "../src/work-id.js";

describe("branchNameToWorkId", () => {
  it("keeps simple branch names readable", () => {
    expect(branchNameToWorkId("feat/gedcode desktop gui")).toBe("feat-gedcode-desktop-gui");
  });

  it("falls back to root for empty slugs", () => {
    expect(branchNameToWorkId("///")).toBe("root");
  });
});

describe("activeWorkId", () => {
  it("reads the active branch from .git/HEAD", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gedcode-work-id-"));
    await mkdir(path.join(root, ".git"));
    await writeFile(path.join(root, ".git", "HEAD"), "ref: refs/heads/feat/gui\n");
    await expect(activeWorkId(root)).resolves.toBe("feat-gui");
  });

  it("uses root for detached or missing HEAD", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gedcode-work-id-"));
    await mkdir(path.join(root, ".git"));
    await writeFile(path.join(root, ".git", "HEAD"), "abc123\n");
    await expect(activeWorkId(root)).resolves.toBe("root");
  });
});
