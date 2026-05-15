import { contextBridge, ipcRenderer } from "electron";

import type { GedDashboardSnapshot } from "./ged-state.js";

export interface GedCodeApi {
  openProject(): Promise<GedDashboardSnapshot | null>;
  readProject(projectRoot: string): Promise<GedDashboardSnapshot>;
  recentProjects(): Promise<string[]>;
}

const api: GedCodeApi = {
  openProject: () => ipcRenderer.invoke("project:open") as Promise<GedDashboardSnapshot | null>,
  readProject: (projectRoot: string) => ipcRenderer.invoke("project:read", projectRoot) as Promise<GedDashboardSnapshot>,
  recentProjects: () => ipcRenderer.invoke("project:recent") as Promise<string[]>,
};

contextBridge.exposeInMainWorld("gedcode", api);
