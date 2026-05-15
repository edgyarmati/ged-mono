import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { writeFile } from "node:fs/promises";

const MAX_RECENT_PROJECTS = 12;

interface RecentProjectsFile {
  projects?: unknown;
}

function normalizeProjectList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export async function readRecentProjects(userDataDir: string): Promise<string[]> {
  try {
    const raw = JSON.parse(await readFile(path.join(userDataDir, "recent-projects.json"), "utf8")) as RecentProjectsFile;
    return normalizeProjectList(raw.projects);
  } catch {
    return [];
  }
}

export async function recordRecentProject(userDataDir: string, projectRoot: string): Promise<string[]> {
  const current = await readRecentProjects(userDataDir);
  const next = [projectRoot, ...current.filter((item) => item !== projectRoot)].slice(0, MAX_RECENT_PROJECTS);
  await mkdir(userDataDir, { recursive: true });
  await writeFile(path.join(userDataDir, "recent-projects.json"), `${JSON.stringify({ projects: next }, null, 2)}\n`, "utf8");
  return next;
}
