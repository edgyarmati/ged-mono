import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readGedDashboardSnapshot } from "./ged-state.js";
import { readRecentProjects, recordRecentProject } from "./recent-projects.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..", "..");
const authorizedProjectRoots = new Set<string>();

function normalizeProjectRoot(projectRoot: string): string {
  return path.resolve(projectRoot);
}

async function authorizeRecentProjects(): Promise<void> {
  for (const projectRoot of await readRecentProjects(app.getPath("userData"))) {
    authorizedProjectRoots.add(normalizeProjectRoot(projectRoot));
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle("project:recent", async () => readRecentProjects(app.getPath("userData")));

  ipcMain.handle("project:read", async (_event, projectRoot: string) => {
    if (typeof projectRoot !== "string" || projectRoot.length === 0) {
      throw new Error("projectRoot is required");
    }
    const normalizedRoot = normalizeProjectRoot(projectRoot);
    if (!authorizedProjectRoots.has(normalizedRoot)) {
      throw new Error("Project root has not been authorized by the main process");
    }
    await recordRecentProject(app.getPath("userData"), normalizedRoot);
    return readGedDashboardSnapshot(normalizedRoot);
  });

  ipcMain.handle("project:open", async () => {
    const result = await dialog.showOpenDialog({
      title: "Open project",
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const projectRoot = normalizeProjectRoot(result.filePaths[0]);
    authorizedProjectRoots.add(projectRoot);
    await recordRecentProject(app.getPath("userData"), projectRoot);
    return readGedDashboardSnapshot(projectRoot);
  });
}

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "GedCode",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  await window.loadFile(path.join(packageRoot, "app", "index.html"));
}

registerIpcHandlers();
void authorizeRecentProjects();

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
