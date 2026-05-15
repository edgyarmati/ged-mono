import { readFile } from "node:fs/promises";
import path from "node:path";

export function branchNameToWorkId(branchName: string): string {
  const slug = branchName
    .trim()
    .replace(/[^A-Za-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
  return slug.length > 0 ? slug : "root";
}

export async function readCurrentGitBranch(projectRoot: string): Promise<string | null> {
  const headPath = path.join(projectRoot, ".git", "HEAD");
  try {
    const head = await readFile(headPath, "utf8");
    const match = /^ref:\s+refs\/heads\/(.+)$/u.exec(head.trim());
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function activeWorkId(projectRoot: string): Promise<string> {
  const branch = await readCurrentGitBranch(projectRoot);
  return branch ? branchNameToWorkId(branch) : "root";
}
