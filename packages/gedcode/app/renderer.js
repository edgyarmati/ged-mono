const state = {
  snapshot: null,
};

const elements = {
  openProject: document.querySelector("#open-project"),
  recentProjects: document.querySelector("#recent-projects"),
  projectPath: document.querySelector("#project-path"),
  workId: document.querySelector("#work-id"),
  status: document.querySelector("#status"),
  checkpoints: document.querySelector("#checkpoints"),
  activeWork: document.querySelector("#active-work"),
  durable: document.querySelector("#durable"),
};

function textPreview(value) {
  if (!value) return "Missing";
  const firstMeaningfulLine = value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstMeaningfulLine ?? "Present";
}

function checkpointSummary(snapshot) {
  const checkpoints = snapshot.runtime.checkpoints;
  if (!checkpoints) {
    return snapshot.runtime.checkpointError
      ? [`Checkpoint error: ${snapshot.runtime.checkpointError}`]
      : ["No checkpoint state found"];
  }
  const plan = checkpoints.planCheckpoints ?? {};
  const task = checkpoints.taskCheckpoints ?? {};
  return [
    `Lifecycle: ${checkpoints.lifecycleStatus}`,
    `Classification: ${checkpoints.classification} — ${checkpoints.classificationReason}`,
    `Explorer: ${plan["ged-explorer"]?.status ?? "missing"}`,
    `Planner: ${plan["ged-planner"]?.status ?? "missing"}`,
    `Task checkpoint groups: ${Object.keys(task).length}`,
  ];
}

function renderList(target, rows) {
  target.replaceChildren(
    ...rows.map((row) => {
      const item = document.createElement("li");
      item.textContent = row;
      return item;
    }),
  );
}

function renderSnapshot(snapshot) {
  state.snapshot = snapshot;
  elements.projectPath.textContent = snapshot.projectRoot;
  elements.workId.textContent = snapshot.workId;
  elements.status.textContent = textPreview(snapshot.runtime.state);
  renderList(elements.checkpoints, checkpointSummary(snapshot));
  renderList(elements.activeWork, [
    `SPEC: ${textPreview(snapshot.activeWork.spec)}`,
    `TASKS: ${textPreview(snapshot.activeWork.tasks)}`,
    `TESTS: ${textPreview(snapshot.activeWork.tests)}`,
    `NOTES: ${textPreview(snapshot.activeWork.notes)}`,
  ]);
  renderList(elements.durable, [
    `PROJECT: ${textPreview(snapshot.durable.project)}`,
    `ARCHITECTURE: ${textPreview(snapshot.durable.architecture)}`,
    `PATTERNS: ${textPreview(snapshot.durable.patterns)}`,
  ]);
}

async function refreshRecentProjects() {
  const recent = await window.gedcode.recentProjects();
  if (recent.length === 0) {
    elements.recentProjects.textContent = "No recent projects yet.";
    return;
  }
  elements.recentProjects.replaceChildren(
    ...recent.map((projectRoot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "recent-project";
      button.textContent = projectRoot;
      button.addEventListener("click", async () => {
        renderSnapshot(await window.gedcode.readProject(projectRoot));
        await refreshRecentProjects();
      });
      return button;
    }),
  );
}

elements.openProject.addEventListener("click", async () => {
  const snapshot = await window.gedcode.openProject();
  if (snapshot) {
    renderSnapshot(snapshot);
    await refreshRecentProjects();
  }
});

await refreshRecentProjects();
