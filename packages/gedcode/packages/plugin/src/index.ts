import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, readdir, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";

type OmniMode = "on" | "off";

type CommandFrontmatter = {
  description?: string;
  agent?: string;
  model?: string;
  subtask?: boolean;
};

type ParsedCommand = {
  name: string;
  frontmatter: CommandFrontmatter;
  template: string;
};

type SkillInfo = {
  name: string;
  description: string;
  path: string;
};

export type SuggestedSkill = {
  name: string;
  reason: string;
  score: number;
};

export type RepoMapEntry = {
  path: string;
  score: number;
  summary: string;
};

export type StandardCandidate = {
  path: string;
  kind: string;
};

export type PlanningArtifactPaths = {
  baseDir: string;
  specPath: string;
  tasksPath: string;
  testsPath: string;
  workId: string | null;
  source: "work" | "root";
};

export type PlanningArtifactReadiness = {
  ready: boolean;
  activePaths: PlanningArtifactPaths;
  readyPaths: PlanningArtifactPaths | null;
  usedRootFallback: boolean;
};

export type StartWorkResult = {
  action: "created" | "switched" | "already-current" | "blocked-dirty";
  branch: string;
  dirtyStatus: string;
  activePaths: PlanningArtifactPaths | null;
  message: string;
};

export type MigrateRootPlanResult = {
  copied: string[];
  activePaths: PlanningArtifactPaths;
  notesPath: string;
  message: string;
};

export type RuntimePaths = {
  runtimeId: string;
  baseDir: string;
  statePath: string;
  sessionSummaryPath: string;
};

export type OmniSubagentName = "ged-explorer" | "ged-planner" | "ged-verifier";

export type WorkflowSettings = {
  protectedBranches: string[];
  requireFeatureBranchForChanges: boolean;
  allowProtectedBranchChanges: boolean;
  offerPrOnCompletion: boolean;
  autoCreatePrOnCompletion: boolean;
};

export type AgentModelConfig = string | { model: string; [key: string]: unknown };

export type GedCodeSettings = {
  workflow: WorkflowSettings;
  agents: {
    enabled: boolean;
    defaultModel?: string;
    models: Partial<Record<OmniSubagentName, AgentModelConfig>>;
  };
};

export type GedCodeSettingsScope = "global" | "project";

export type GedCodeAgentsSettingsPatch = {
  scope?: GedCodeSettingsScope;
  enabled?: boolean;
  defaultModel?: string;
  models?: Partial<Record<OmniSubagentName, AgentModelConfig>>;
};

export type GedCodeModelRecommendations = {
  sourcePath?: string;
  content: string;
};

type RawGedCodeSettings = {
  workflow?: unknown;
  agents?: {
    enabled?: unknown;
    defaultModel?: unknown;
    models?: unknown;
  };
};

const OMNI_VERSION = "1";
export const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
  protectedBranches: ["main", "master"],
  requireFeatureBranchForChanges: true,
  allowProtectedBranchChanges: false,
  offerPrOnCompletion: true,
  autoCreatePrOnCompletion: false,
};
const RESOURCE_ROOT_CANDIDATES = [
  path.join(import.meta.dirname, "resources"),
  path.join(import.meta.dirname, "..", "src", "resources"),
];

const GEDCODE_SETTINGS_DIR = ".gedcode";
const GEDCODE_SETTINGS_FILE = "settings.json";
const GEDCODE_MODEL_RECOMMENDATIONS_FILE = "model-recommendations.md";
const GEDCODE_PROJECT_GITIGNORE_ENTRY = `${GEDCODE_SETTINGS_DIR}/`;
const OMNI_SUBAGENT_NAMES: OmniSubagentName[] = [
  "ged-explorer",
  "ged-planner",
  "ged-verifier",
];

type OmniAgentConfig = {
  description: string;
  mode: "primary" | "subagent";
  prompt: string;
  model?: string;
  permission?: Record<string, unknown>;
};

const OMNI_SUBAGENT_DEFAULTS: Record<OmniSubagentName, OmniAgentConfig> = {
  "ged-explorer": {
    description: "Read-only scout that returns evidence-backed discovery packets to the single-writer GedCode orchestrator.",
    mode: "subagent",
    prompt: [
      "You are ged-explorer, a read-only discovery subagent for GedCode.",
      "Find files, inspect code, search for relevant patterns, and report a discovery packet with Findings, Evidence, Risks / edge cases, Open questions, and Suggested next inspection.",
      "Do not edit files, run mutating shell commands, commit, or continue into implementation. The primary gedcode orchestrator is the single writer and decision owner.",
    ].join("\n\n"),
    permission: { read: "allow", glob: "allow", grep: "allow", list: "allow", edit: "deny", bash: "deny", task: "deny", todowrite: "deny" },
  },
  "ged-planner": {
    description: "Read-only planning/smart-friend subagent that critiques specs, slices, tests, edge cases, and non-goals for the orchestrator.",
    mode: "subagent",
    prompt: [
      "You are ged-planner, a planning subagent for GedCode.",
      "Help the orchestrator turn clarified requirements into a concrete spec, bounded task slices, test strategy, edge cases, and success criteria. Act as a smart-friend critic for risky or ambiguous plans, and identify missing context or files the orchestrator should inspect before proceeding.",
      "Do not edit files or implement source changes; report recommended planning updates back to the orchestrator. If context is missing, say what to inspect and ask to be consulted again rather than guessing.",
    ].join("\n\n"),
    permission: { read: "allow", glob: "allow", grep: "allow", list: "allow", edit: "deny", bash: "deny", task: "deny", todowrite: "deny" },
  },
  "ged-verifier": {
    description: "Verification and clean-context review subagent that checks results and reports blockers without editing source.",
    mode: "subagent",
    prompt: [
      "You are ged-verifier, a verification subagent for GedCode.",
      "Run the checks requested by the orchestrator, inspect failures, and report exact pass/fail status plus the first actionable failure. When asked for clean-context review, inspect the diff/tests with minimal prior assumptions and report bugs, edge cases, security risks, and test gaps by severity.",
      "Do not edit source files, relax tests, commit, or decide scope; report findings back so the orchestrator can adjudicate accepted vs rejected findings.",
    ].join("\n\n"),
    permission: { read: "allow", glob: "allow", grep: "allow", list: "allow", bash: "allow", edit: "deny", task: "deny", todowrite: "deny" },
  },
};

const STANDARD_RULES: Array<{ kind: string; match(relativePath: string, basename: string): boolean }> = [
  {
    kind: "AGENTS",
    match: (_relativePath, basename) => basename === "AGENTS.md",
  },
  {
    kind: "CLAUDE",
    match: (_relativePath, basename) => basename === "CLAUDE.md",
  },
  {
    kind: "GEMINI",
    match: (_relativePath, basename) => basename === "GEMINI.md",
  },
  {
    kind: "Copilot",
    match: (relativePath) => relativePath === ".github/copilot-instructions.md",
  },
  {
    kind: "GitHub Instructions",
    match: (relativePath, basename) =>
      relativePath.startsWith(".github/instructions/") && basename.endsWith(".instructions.md"),
  },
  {
    kind: "Cursor Rules",
    match: (relativePath, basename) =>
      basename === ".cursorrules" ||
      (relativePath.startsWith(".cursor/rules/") && basename.endsWith(".mdc")),
  },
  {
    kind: "Windsurf Rules",
    match: (relativePath) => relativePath.startsWith(".windsurf/rules/"),
  },
  {
    kind: "Continue Rules",
    match: (relativePath) => relativePath.startsWith(".continue/rules/"),
  },
];

export const REPO_MAP_IGNORE = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  ".pi",
  ".ged",
  ".gedcode",
  ".turbo",
  "coverage",
]);

const SKILL_RULES: Array<{ name: string; patterns: RegExp[]; reason: string; score: number }> = [
  {
    name: "find-skills",
    patterns: [
      /\b(find|search|discover|install|add|remove|delete)\b[^.!?\n]{0,80}\bskills?\b/iu,
      /\b(skills?|capabilit(?:y|ies))\b[^.!?\n]{0,80}\b(missing|insufficient|not covered|need|available|relevant)\b/iu,
      /\b(is there|do we have|are there)\b[^.!?\n]{0,80}\bskills?\b/iu,
    ],
    reason: "use during the skill-fit checkpoint to find or remove relevant skills",
    score: 5,
  },
  {
    name: "skill-maker",
    patterns: [
      /\b(create|write|build|make|generate)\b[^.!?\n]{0,80}\b(?:a\s+)?skills?\b/iu,
      /\b(?:no|none|missing|insufficient|inadequate|not covered|can't find|cannot find)\b[^.!?\n]{0,100}\b(?:relevant\s+)?skills?\b/iu,
      /\bskills?\b[^.!?\n]{0,100}\b(?:no|none|missing|insufficient|inadequate|not covered|can't find|cannot find)\b/iu,
      /\bproject[- ]local\b[^.!?\n]{0,80}\bskills?\b/iu,
    ],
    reason: "use after find-skills when no adequate skill exists to create a project-local skill",
    score: 5,
  },
  {
    name: "grill-me",
    patterns: [
      /\b(grill me|stress[- ]test|poke holes|challenge (?:this|my)|what am i missing)\b/iu,
      /\b(add|build|create|change|modify|update|fix|refactor|implement|feature|bug|behavior change)\b/iu,
    ],
    reason: "use automatically before change requests to reach shared understanding",
    score: 5,
  },
  {
    name: "tdd",
    patterns: [
      /\b(tdd|test[- ]driven|red[- ]green[- ]refactor|test[- ]first)\b/iu,
      /\b(add|build|create|change|modify|update|fix|refactor|implement)\b[^.!?\n]{0,100}\b(feature|behavior|flow|logic|bug|regression|test)\b/iu,
      /\b(feature|behavior|flow|logic|bug|regression|test)\b[^.!?\n]{0,100}\b(add|build|create|change|modify|update|fix|refactor|implement)\b/iu,
    ],
    reason: "use a red-green-refactor loop for behavior-changing implementation slices",
    score: 4,
  },
  {
    name: "diagnose",
    patterns: [
      /\b(diagnose|debug|reproduce|repro|triage)\b/iu,
      /\b(bug|failure|failing|fails|failed|broken|crash|throws?|error|flaky|intermittent)\b/iu,
      /\bperformance\b[^.!?\n]{0,80}\b(regression|slow|slower|latency|timeout|profile)\b/iu,
      /\b(regression|slow|slower|latency|timeout|profile)\b[^.!?\n]{0,80}\bperformance\b/iu,
    ],
    reason: "use a disciplined reproduce-minimize-hypothesize-instrument-fix loop for bugs and regressions",
    score: 5,
  },
  {
    name: "grill-with-docs",
    patterns: [
      /\bgrill\b[^.!?\n]{0,100}\b(docs?|documentation|domain|glossary|adr|decision|context|terminology|language)\b/iu,
      /\b(domain|glossary|terminology|ubiquitous language|project context)\b/iu,
      /\b(adr|architecture decision record|decision record|durable decision|hard to reverse|trade[- ]off)\b/iu,
      /\b(update|capture|record|document)\b[^.!?\n]{0,100}\b(context|domain|glossary|adr|decision|terminology)\b/iu,
    ],
    reason: "use the grill-me interview plus durable domain/context/ADR updates when decisions should be documented",
    score: 6,
  },
  {
    name: "improve-codebase-architecture",
    patterns: [
      /\b(improve|review|audit|assess|analyze|analyse|find)\b[^.!?\n]{0,120}\b(architecture|codebase architecture|module|modules|seams?|testability|refactor(?:ing)? opportunities|deepening opportunities)\b/iu,
      /\b(architecture|codebase architecture|module|modules|seams?|testability|refactor(?:ing)? opportunities|deepening opportunities)\b[^.!?\n]{0,120}\b(improve|review|audit|assess|analyze|analyse|find)\b/iu,
      /\b(shallow modules?|deep modules?|deepening|locality|leverage|deletion test)\b/iu,
    ],
    reason: "use a review-only workflow to find architecture deepening opportunities before any refactor",
    score: 6,
  },
  {
    name: "brainstorming",
    patterns: [
      /\b(brainstorm|design|approach|option|trade-?off|migration|feature|behavior change|refactor)\b/iu,
      /\b(create|build|add|modify|change)\b/iu,
    ],
    reason: "use before creative work, migrations, or behavior changes",
    score: 3,
  },
  {
    name: "ged-planning",
    patterns: [/\b(plan|spec|task|slice|break down|roadmap|implementation plan)\b/iu],
    reason: "use before implementation to refine spec, tasks, and tests",
    score: 4,
  },
  {
    name: "ged-execution",
    patterns: [/\b(implement|execute|code|fix|do the task|build it|make it work)\b/iu],
    reason: "use when implementing a planned slice",
    score: 4,
  },
  {
    name: "ged-verification",
    patterns: [/\b(test|verify|check|validate|did it work|smoke test|regression)\b/iu],
    reason: "use after implementation to verify and summarize pass/fail",
    score: 4,
  },
];

const REPO_MAP_MAX_SUMMARY_BYTES = 128 * 1024;
const SKILLS_PROJECT_NOTES_HEADING = "## Project Notes";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function taskPermissionForOmniSubagents(): Record<string, "allow" | "deny"> {
  return { "*": "deny", "ged-explorer": "allow", "ged-planner": "allow", "ged-verifier": "allow" };
}

function modelIdFromConfig(config: AgentModelConfig | undefined): string | undefined {
  if (typeof config === "string") return config;
  if (isRecord(config) && typeof config.model === "string" && config.model.trim().length > 0) return config.model.trim();
  return undefined;
}

function buildSubagentConfig(settings: GedCodeSettings, agentName: OmniSubagentName): OmniAgentConfig {
  const agentModelConfig = settings.agents.models[agentName];
  const fallbackModel = settings.agents.defaultModel;
  if (typeof agentModelConfig === "string") {
    const model = agentModelConfig || fallbackModel;
    return { ...OMNI_SUBAGENT_DEFAULTS[agentName], ...(model ? { model } : {}) };
  }
  if (isRecord(agentModelConfig)) {
    const { model: rawModel, ...passthrough } = agentModelConfig as { model?: string; [key: string]: unknown };
    const model = (typeof rawModel === "string" && rawModel.trim().length > 0 ? rawModel.trim() : undefined) ?? fallbackModel;
    const extras = Object.keys(passthrough).length > 0 ? passthrough : {};
    return { ...OMNI_SUBAGENT_DEFAULTS[agentName], ...(model ? { model } : {}), ...extras };
  }
  return { ...OMNI_SUBAGENT_DEFAULTS[agentName], ...(fallbackModel ? { model: fallbackModel } : {}) };
}

function formatAgentModelConfig(config: AgentModelConfig | undefined, fallbackModel: string | undefined): string {
  if (typeof config === "string") return `model=${config}`;
  if (isRecord(config)) {
    const model = typeof config.model === "string" && config.model.trim().length > 0 ? config.model.trim() : fallbackModel;
    const extras = Object.entries(config)
      .filter(([key]) => key !== "model")
      .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`);
    return [`model=${model ?? "inherit invoking model"}`, ...extras].join(", ");
  }
  return fallbackModel ? `model=${fallbackModel} (shared default)` : "model=inherit invoking model";
}

export function formatAgentsSettingsStatus(settings: GedCodeSettings, paths: { globalPath: string; projectPath: string; recommendationsPath?: string | null; compact?: boolean }): string {
  const checkpointState = settings.agents.enabled
    ? "active for non-trivial change requests; skip only with a recorded reason when trivial, unavailable, or user-disabled"
    : "inactive because native subagents are disabled";
  const headerLines = paths.compact
    ? [] as string[]
    : [
        `Global settings: ${paths.globalPath}`,
        `Project override: ${paths.projectPath}`,
      ];
  return [
    `Effective agents.enabled: ${settings.agents.enabled}`,
    ...headerLines,
    `Default model: ${settings.agents.defaultModel ?? "inherit invoking model"}`,
    `Per-agent models: ${Object.keys(settings.agents.models).length > 0 ? `${Object.keys(settings.agents.models).length} configured` : "none"}`,
    "Resolved subagent configs:",
    ...OMNI_SUBAGENT_NAMES.map((agentName) => `- ${agentName}: ${formatAgentModelConfig(settings.agents.models[agentName], settings.agents.defaultModel)}`),
    `Checkpoint policy: ${checkpointState}`,
    `Model recommendations: ${paths.recommendationsPath ?? "none found"}`,
  ].join("\n");
}

function orchestrationPrompt(basePrompt: string): string {
  return [
    basePrompt,
    "## Optional native sub-agent orchestration",
    "Single-writer invariant: the primary gedcode agent is the writer, synthesizer, and decision owner in the active worktree by default. Subagents inject intelligence; they do not own product decisions, commits, PR decisions, or final verification judgments.",
    "When native subagents are enabled, use mandatory intelligence checkpoints for non-trivial change requests: ged-explorer for codebase discovery when relevant context is not already known, ged-planner before finalizing or materially changing SPEC/TASKS/TESTS, and ged-verifier for checks or clean-context review before committing meaningful implementation changes.",
    "If a checkpoint is skipped because the task is trivial, subagents are disabled or unavailable, or the user asked not to delegate, record a concise skip reason in the response and active planning or verification notes. Require subagent reports with evidence, uncertainty, risks, and recommended next inspection.",
    "Before committing meaningful implementation slices, run planned checks, request clean-context review of the diff/tests, adjudicate accepted vs rejected findings, fix accepted issues, and rerun verification.",
    "There is no writer subagent role. Do not delegate source edits or implementation ownership to subagents; the primary gedcode agent remains the only active-worktree writer.",
  ].join("\n\n");
}

function normalizeAgentModels(value: unknown): Partial<Record<OmniSubagentName, AgentModelConfig>> {
  if (!isRecord(value)) return {};
  const models: Partial<Record<OmniSubagentName, AgentModelConfig>> = {};
  for (const agentName of OMNI_SUBAGENT_NAMES) {
    const entry = value[agentName];
    if (typeof entry === "string" && entry.trim().length > 0) {
      models[agentName] = entry.trim();
    } else if (isRecord(entry) && typeof entry.model === "string" && entry.model.trim().length > 0) {
      models[agentName] = entry as Record<string, unknown> & { model: string };
    }
  }
  return models;
}

function defaultAgentsSettings(): GedCodeSettings["agents"] {
  return { enabled: false, models: {} };
}

function parseAgentsSettings(value: unknown): Partial<GedCodeSettings["agents"]> {
  if (!isRecord(value)) return {};
  const parsed: Partial<GedCodeSettings["agents"]> = {};
  if (typeof value.enabled === "boolean") parsed.enabled = value.enabled;
  if (typeof value.defaultModel === "string" && value.defaultModel.trim().length > 0) parsed.defaultModel = value.defaultModel.trim();
  parsed.models = normalizeAgentModels(value.models);
  return parsed;
}

function normalizeProtectedBranches(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const branches = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return branches.length > 0 ? [...new Set(branches)] : undefined;
}

function parseWorkflowSettings(value: unknown): Partial<WorkflowSettings> {
  if (!isRecord(value)) return {};
  const parsed: Partial<WorkflowSettings> = {};
  const protectedBranches = normalizeProtectedBranches(value.protectedBranches);
  if (protectedBranches) parsed.protectedBranches = protectedBranches;
  if (typeof value.requireFeatureBranchForChanges === "boolean") {
    parsed.requireFeatureBranchForChanges = value.requireFeatureBranchForChanges;
  }
  if (typeof value.allowProtectedBranchChanges === "boolean") {
    parsed.allowProtectedBranchChanges = value.allowProtectedBranchChanges;
  }
  if (typeof value.offerPrOnCompletion === "boolean") {
    parsed.offerPrOnCompletion = value.offerPrOnCompletion;
  }
  if (typeof value.autoCreatePrOnCompletion === "boolean") {
    parsed.autoCreatePrOnCompletion = value.autoCreatePrOnCompletion;
  }
  return parsed;
}

async function readSettingsFile(filePath: string): Promise<Partial<GedCodeSettings>> {
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    if (!isRecord(parsed)) return {};
    const raw = parsed as RawGedCodeSettings;
    return {
      workflow: parseWorkflowSettings(raw.workflow) as WorkflowSettings,
      agents: parseAgentsSettings(raw.agents) as GedCodeSettings["agents"],
    };
  } catch {
    return {};
  }
}

export function resolveGlobalSettingsPath(homeDir = os.homedir()): string {
  return path.join(homeDir, GEDCODE_SETTINGS_DIR, GEDCODE_SETTINGS_FILE);
}

export function resolveProjectSettingsPath(directory: string): string {
  return path.join(directory, GEDCODE_SETTINGS_DIR, GEDCODE_SETTINGS_FILE);
}

export const globalGedCodeSettingsPath = resolveGlobalSettingsPath;
export const projectGedCodeSettingsPath = resolveProjectSettingsPath;

export function globalGedCodeModelRecommendationsPath(homeDir = os.homedir()): string {
  return path.join(homeDir, GEDCODE_SETTINGS_DIR, GEDCODE_MODEL_RECOMMENDATIONS_FILE);
}

export function projectGedCodeModelRecommendationsPath(directory: string): string {
  return path.join(directory, GEDCODE_SETTINGS_DIR, GEDCODE_MODEL_RECOMMENDATIONS_FILE);
}

export async function readGedCodeSettings(
  directory: string,
  options: { homeDir?: string } = {},
): Promise<GedCodeSettings> {
  const globalSettings = await readSettingsFile(resolveGlobalSettingsPath(options.homeDir));
  const projectSettings = await readSettingsFile(resolveProjectSettingsPath(directory));
  return {
    workflow: {
      ...DEFAULT_WORKFLOW_SETTINGS,
      ...(globalSettings.workflow ?? {}),
      ...(projectSettings.workflow ?? {}),
    },
    agents: {
      ...defaultAgentsSettings(),
      ...(globalSettings.agents ?? {}),
      ...(projectSettings.agents ?? {}),
      models: cleanModelPatch({
        ...(globalSettings.agents?.models as Partial<Record<OmniSubagentName, AgentModelConfig>> | undefined ?? {}),
        ...(projectSettings.agents?.models as Partial<Record<OmniSubagentName, AgentModelConfig>> | undefined ?? {}),
      }),
    },
  };
}

export function formatWorkflowSettingsStatus(settings: GedCodeSettings): string {
  return [
    "## GedCode Workflow Settings",
    "",
    `Protected Branches: ${settings.workflow.protectedBranches.join(", ")}`,
    `Require Feature Branch For Changes: ${settings.workflow.requireFeatureBranchForChanges ? "yes" : "no"}`,
    `Allow Protected Branch Changes: ${settings.workflow.allowProtectedBranchChanges ? "yes" : "no"}`,
    `Offer PR On Completion: ${settings.workflow.offerPrOnCompletion ? "yes" : "no"}`,
    `Auto Create PR On Completion: ${settings.workflow.autoCreatePrOnCompletion ? "yes" : "no"}`,
    `Agents Enabled: ${settings.agents?.enabled ? "yes" : "no"}`,
  ].join("\n");
}

async function readJsonObjectFile(filePath: string): Promise<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function settingsPathForScope(directory: string, scope: GedCodeSettingsScope, homeDir = os.homedir()): string {
  return scope === "project" ? resolveProjectSettingsPath(directory) : resolveGlobalSettingsPath(homeDir);
}

function cleanModelPatch(models: Partial<Record<OmniSubagentName, AgentModelConfig>> | undefined): Partial<Record<OmniSubagentName, AgentModelConfig>> {
  const cleaned: Partial<Record<OmniSubagentName, AgentModelConfig>> = {};
  for (const agentName of OMNI_SUBAGENT_NAMES) {
    const entry = models?.[agentName];
    if (typeof entry === "string" && entry.trim().length > 0) {
      cleaned[agentName] = entry.trim();
    } else if (isRecord(entry) && typeof entry.model === "string" && entry.model.trim().length > 0) {
      cleaned[agentName] = entry as Record<string, unknown> & { model: string };
    }
  }
  return cleaned;
}

export async function ensureGedCodeProjectGitignore(directory: string): Promise<string> {
  const gitignorePath = path.join(directory, ".gitignore");
  let existing = "";
  try { existing = await readFile(gitignorePath, "utf8"); } catch { existing = ""; }
  const lines = existing.split(/\r?\n/u).map((line) => line.trim());
  if (lines.includes(GEDCODE_PROJECT_GITIGNORE_ENTRY)) return gitignorePath;
  const prefix = existing.length === 0 || existing.endsWith("\n") ? existing : `${existing}\n`;
  await writeFileAtomic(gitignorePath, `${prefix}${GEDCODE_PROJECT_GITIGNORE_ENTRY}\n`);
  return gitignorePath;
}

export async function updateGedCodeAgentsSettings(directory: string, patch: GedCodeAgentsSettingsPatch, options: { homeDir?: string } = {}): Promise<{ scope: GedCodeSettingsScope; outputPath: string; settings: GedCodeSettings }> {
  const scope = patch.scope ?? "global";
  const outputPath = settingsPathForScope(directory, scope, options.homeDir);
  const rawSettings = await readJsonObjectFile(outputPath);
  const rawAgents = isRecord(rawSettings.agents) ? rawSettings.agents : {};
  const nextAgents: Record<string, unknown> = { ...rawAgents };
  if (typeof patch.enabled === "boolean") nextAgents.enabled = patch.enabled;
  if (typeof patch.defaultModel === "string" && patch.defaultModel.trim().length > 0) nextAgents.defaultModel = patch.defaultModel.trim();
  const modelPatch = cleanModelPatch(patch.models);
  const cleanedModels = { ...cleanModelPatch(rawAgents.models as Partial<Record<OmniSubagentName, AgentModelConfig>> | undefined), ...modelPatch };
  if (isRecord(rawAgents.models) || Object.keys(modelPatch).length > 0) {
    if (Object.keys(cleanedModels).length > 0) nextAgents.models = cleanedModels;
    else delete nextAgents.models;
  }
  await writeFileAtomic(outputPath, `${JSON.stringify({ ...rawSettings, agents: nextAgents }, null, 2)}\n`);
  if (scope === "project") await ensureGedCodeProjectGitignore(directory);
  return { scope, outputPath, settings: await readGedCodeSettings(directory, options) };
}

export async function readGedCodeModelRecommendations(directory: string, options: { homeDir?: string } = {}): Promise<GedCodeModelRecommendations> {
  const candidates = [projectGedCodeModelRecommendationsPath(directory), globalGedCodeModelRecommendationsPath(options.homeDir)];
  for (const candidate of candidates) {
    try { return { sourcePath: candidate, content: await readFile(candidate, "utf8") }; } catch { /* try next */ }
  }
  return { content: "" };
}

async function resolveGitDir(directory: string): Promise<string | null> {
  const dotGitPath = path.join(directory, ".git");
  try {
    const dotGitStat = await stat(dotGitPath);
    if (dotGitStat.isDirectory()) return dotGitPath;
    const dotGitContent = await readFile(dotGitPath, "utf8");
    const match = dotGitContent.match(/^gitdir:\s*(.+)$/imu);
    if (!match) return null;
    return path.resolve(directory, match[1].trim());
  } catch {
    return null;
  }
}

export async function readCurrentGitBranch(directory: string): Promise<string | null> {
  const gitDir = await resolveGitDir(directory);
  if (!gitDir) return null;
  try {
    const head = (await readFile(path.join(gitDir, "HEAD"), "utf8")).trim();
    const match = head.match(/^ref:\s+refs\/heads\/(.+)$/u);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function isProtectedBranch(branch: string | null, settings: GedCodeSettings): boolean {
  if (!branch) return false;
  return settings.workflow.protectedBranches.includes(branch);
}

export function protectedBranchGuardMessage(branch: string): string {
  return [
    `GedCode guard: change requests should run on a feature branch, not ${branch}.`,
    "Create or switch to a branch, or set workflow.allowProtectedBranchChanges=true in GedCode settings if this project intentionally allows direct protected-branch work.",
  ].join(" ");
}

export async function assertProtectedBranchAllowsMutation(
  directory: string,
  settings: GedCodeSettings,
): Promise<void> {
  if (!settings.workflow.requireFeatureBranchForChanges) return;
  if (settings.workflow.allowProtectedBranchChanges) return;
  const branch = await readCurrentGitBranch(directory);
  if (branch && isProtectedBranch(branch, settings)) {
    throw new Error(protectedBranchGuardMessage(branch));
  }
}

export function branchNameToWorkId(branch: string): string {
  const slug = branch
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/[-_.]{2,}/gu, "-")
    .replace(/^[-_.]+|[-_.]+$/gu, "");
  if (slug.length === 0) {
    throw new Error(`GedCode: cannot derive work id from branch name: ${branch}`);
  }
  return slug;
}

export function validateWorkBranchName(branch: string): string {
  const trimmed = branch.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/u.test(trimmed)) {
    throw new Error(`GedCode: invalid branch name: ${branch}`);
  }
  if (
    trimmed.includes("..") ||
    trimmed.includes("//") ||
    trimmed.includes("@{") ||
    trimmed.endsWith("/") ||
    trimmed.endsWith(".lock") ||
    trimmed.split("/").some((segment) => segment.length === 0 || segment.startsWith("."))
  ) {
    throw new Error(`GedCode: invalid branch name: ${branch}`);
  }
  return trimmed;
}

function planningArtifactPaths(baseDir: string, workId: string | null, source: "work" | "root"): PlanningArtifactPaths {
  return {
    baseDir,
    specPath: path.join(baseDir, "SPEC.md"),
    tasksPath: path.join(baseDir, "TASKS.md"),
    testsPath: path.join(baseDir, "TESTS.md"),
    workId,
    source,
  };
}

export async function activePlanningArtifactPaths(directory: string): Promise<PlanningArtifactPaths> {
  const branch = await readCurrentGitBranch(directory);
  if (!branch) {
    return planningArtifactPaths(path.join(directory, ".ged"), null, "root");
  }
  const workId = branchNameToWorkId(branch);
  return planningArtifactPaths(path.join(directory, ".ged", "work", workId), workId, "work");
}

export async function activeRuntimePaths(directory: string): Promise<RuntimePaths> {
  const branch = await readCurrentGitBranch(directory);
  const runtimeId = branch ? branchNameToWorkId(branch) : "root";
  const baseDir = path.join(directory, ".ged", "runtime", runtimeId);
  return {
    runtimeId,
    baseDir,
    statePath: path.join(baseDir, "STATE.md"),
    sessionSummaryPath: path.join(baseDir, "SESSION-SUMMARY.md"),
  };
}

async function writePlanningTemplateIfMissing(paths: PlanningArtifactPaths): Promise<void> {
  await mkdir(paths.baseDir, { recursive: true });
  const templates: Array<[string, string]> = [
    [paths.specPath, OMNI_FILES["SPEC.md"]],
    [paths.tasksPath, OMNI_FILES["TASKS.md"]],
    [paths.testsPath, OMNI_FILES["TESTS.md"]],
  ];
  for (const [filePath, content] of templates) {
    try {
      await stat(filePath);
    } catch {
      await writeFileAtomic(filePath, content);
    }
  }
}

function runGit(directory: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd: directory, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

async function runGitOrThrow(directory: string, args: string[]): Promise<string> {
  const result = await runGit(directory, args);
  if (result.code !== 0) {
    throw new Error(`GedCode: git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout;
}

async function gitBranchExists(directory: string, branch: string): Promise<boolean> {
  const result = await runGit(directory, ["rev-parse", "--verify", `refs/heads/${branch}`]);
  return result.code === 0;
}

export function dirtyWorktreeGuidance(status: string): string {
  return [
    "GedCode start-work blocked because the working tree has uncommitted changes:",
    "",
    status.trimEnd(),
    "",
    "Proposed solutions:",
    "- Commit the current changes, then start work again.",
    "- Stash the current changes with git stash push, then start work again.",
    "- If these changes intentionally belong on the new branch, rerun with allowDirty: true.",
  ].join("\n");
}

export async function startWorkBranch(
  directory: string,
  options: { branch: string; base?: string; allowDirty?: boolean },
): Promise<StartWorkResult> {
  const branch = validateWorkBranchName(options.branch);
  const status = (await runGitOrThrow(directory, ["status", "--short"])).trimEnd();
  if (status.length > 0 && !options.allowDirty) {
    return {
      action: "blocked-dirty",
      branch,
      dirtyStatus: status,
      activePaths: null,
      message: dirtyWorktreeGuidance(status),
    };
  }

  const currentBranch = await readCurrentGitBranch(directory);
  let action: StartWorkResult["action"];
  if (currentBranch === branch) {
    action = "already-current";
  } else if (await gitBranchExists(directory, branch)) {
    await runGitOrThrow(directory, ["switch", branch]);
    action = "switched";
  } else {
    const args = ["switch", "-c", branch];
    if (options.base) args.push(options.base);
    await runGitOrThrow(directory, args);
    action = "created";
  }

  const activePaths = await activePlanningArtifactPaths(directory);
  await writePlanningTemplateIfMissing(activePaths);
  return {
    action,
    branch,
    dirtyStatus: status,
    activePaths,
    message: [
      `GedCode start-work ${action} branch ${branch}.`,
      `Active planning directory: ${path.relative(directory, activePaths.baseDir).split(path.sep).join("/")}`,
    ].join("\n"),
  };
}

export type PullRequestPrerequisites = {
  branch: string | null;
  dirtyStatus: string;
  hasRemote: boolean;
  hasUpstream: boolean;
};

export function summarizePullRequestPrerequisites(prerequisites: PullRequestPrerequisites): string {
  const issues: string[] = [];
  if (!prerequisites.branch) issues.push("No current branch detected.");
  if (prerequisites.dirtyStatus.trim().length > 0) issues.push("Working tree has uncommitted changes.");
  if (!prerequisites.hasRemote) issues.push("No git remote is configured.");
  if (!prerequisites.hasUpstream) issues.push("Current branch has no upstream; push is required before creating a PR.");
  if (issues.length === 0) return "PR prerequisites satisfied.";
  return ["PR prerequisites need attention:", ...issues.map((issue) => `- ${issue}`)].join("\n");
}

async function collectPullRequestPrerequisites(directory: string): Promise<PullRequestPrerequisites> {
  const [branch, dirtyStatusResult, remoteResult, upstreamResult] = await Promise.all([
    readCurrentGitBranch(directory),
    runGit(directory, ["status", "--short"]),
    runGit(directory, ["remote"]),
    runGit(directory, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]),
  ]);
  return {
    branch,
    dirtyStatus: dirtyStatusResult.stdout.trimEnd(),
    hasRemote: remoteResult.code === 0 && remoteResult.stdout.trim().length > 0,
    hasUpstream: upstreamResult.code === 0 && upstreamResult.stdout.trim().length > 0,
  };
}

async function readOptionalSnippet(filePath: string, heading: string): Promise<string> {
  try {
    const content = await readFile(filePath, "utf8");
    return [`## ${heading}`, "", content.trim().slice(0, 1800)].join("\n");
  } catch {
    return [`## ${heading}`, "", "Not available."].join("\n");
  }
}

export async function buildPullRequestBody(directory: string): Promise<string> {
  const paths = await activePlanningArtifactPaths(directory);
  const log = await runGit(directory, ["log", "--oneline", "--max-count=10"]);
  const commits = log.code === 0 && log.stdout.trim().length > 0 ? log.stdout.trim() : "Not available.";
  return [
    "## Summary",
    "",
    `- Branch: ${(await readCurrentGitBranch(directory)) ?? "unknown"}`,
    `- Active planning: ${relativeDisplayPath(directory, paths.baseDir)}`,
    "",
    await readOptionalSnippet(paths.specPath, "Spec"),
    "",
    await readOptionalSnippet(paths.tasksPath, "Tasks"),
    "",
    "## Recent commits",
    "",
    commits,
  ].join("\n");
}

export async function createPullRequest(
  directory: string,
  options: { title?: string; body?: string; base?: string; draft?: boolean; push?: boolean } = {},
): Promise<string> {
  const prerequisites = await collectPullRequestPrerequisites(directory);
  if (prerequisites.dirtyStatus.trim().length > 0) {
    throw new Error(summarizePullRequestPrerequisites(prerequisites));
  }
  if (!prerequisites.branch) {
    throw new Error(summarizePullRequestPrerequisites(prerequisites));
  }
  if (!prerequisites.hasRemote) {
    throw new Error(summarizePullRequestPrerequisites(prerequisites));
  }
  if (!prerequisites.hasUpstream) {
    if (options.push === false) throw new Error(summarizePullRequestPrerequisites(prerequisites));
    await runGitOrThrow(directory, ["push", "-u", "origin", prerequisites.branch]);
  }

  const title = options.title ?? prerequisites.branch.replace(/[\/_-]+/gu, " ").trim();
  const body = options.body ?? (await buildPullRequestBody(directory));
  const args = ["pr", "create", "--title", title, "--body", body];
  if (options.base) args.push("--base", options.base);
  if (options.draft) args.push("--draft");
  const result = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const child = spawn("gh", args, { cwd: directory, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
  if (result.code !== 0) {
    throw new Error(`GedCode: gh pr create failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function migrateRootPlanToActiveWork(
  directory: string,
  options: { overwrite?: boolean } = {},
): Promise<MigrateRootPlanResult> {
  const activePaths = await activePlanningArtifactPaths(directory);
  if (activePaths.source !== "work") {
    throw new Error("GedCode: root planning migration requires a branch-backed active work directory.");
  }
  const rootPaths = rootPlanningArtifactPaths(directory);
  if (!(await planningArtifactsReadyAt(rootPaths))) {
    throw new Error("GedCode: root planning artifacts are missing or still placeholders; nothing to migrate.");
  }
  const targets = [activePaths.specPath, activePaths.tasksPath, activePaths.testsPath];
  const existingTargets = [];
  for (const target of targets) {
    if (await pathExists(target)) existingTargets.push(relativeDisplayPath(directory, target));
  }
  if (existingTargets.length > 0 && !options.overwrite) {
    throw new Error(
      [
        "GedCode: active work planning files already exist; refusing to overwrite.",
        ...existingTargets.map((target) => `- ${target}`),
        "Rerun with overwrite: true to replace them.",
      ].join("\n"),
    );
  }

  await mkdir(activePaths.baseDir, { recursive: true });
  const copies: Array<[string, string]> = [
    [rootPaths.specPath, activePaths.specPath],
    [rootPaths.tasksPath, activePaths.tasksPath],
    [rootPaths.testsPath, activePaths.testsPath],
  ];
  const copied: string[] = [];
  for (const [source, target] of copies) {
    await writeFileAtomic(target, await readFile(source, "utf8"));
    copied.push(relativeDisplayPath(directory, target));
  }
  const notesPath = path.join(activePaths.baseDir, "NOTES.md");
  const note = [
    "# Notes",
    "",
    `- Migrated root planning files from .ged/ into ${relativeDisplayPath(directory, activePaths.baseDir)} on ${new Date().toISOString()}.`,
    "- Root planning files were left intact for compatibility.",
    "",
  ].join("\n");
  await writeFileAtomic(notesPath, note);
  return {
    copied,
    activePaths,
    notesPath,
    message: [
      `Migrated root planning into ${relativeDisplayPath(directory, activePaths.baseDir)}.`,
      ...copied.map((filePath) => `- ${filePath}`),
      `Notes: ${relativeDisplayPath(directory, notesPath)}`,
    ].join("\n"),
  };
}

function rootPlanningArtifactPaths(directory: string): PlanningArtifactPaths {
  return planningArtifactPaths(path.join(directory, ".ged"), null, "root");
}

function tempPathFor(filePath: string): string {
  return `${filePath}.${randomBytes(6).toString("hex")}.tmp`;
}

async function existingMode(filePath: string): Promise<number | undefined> {
  try {
    return (await stat(filePath)).mode & 0o777;
  } catch {
    return undefined;
  }
}

export async function writeFileAtomic(filePath: string, content: string | Uint8Array): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = tempPathFor(filePath);
  const mode = await existingMode(filePath);

  try {
    await writeFile(tempPath, content, { encoding: "utf8", flag: "wx" });
    if (mode !== undefined) {
      await chmod(tempPath, mode);
    }
    await rename(tempPath, filePath);
  } catch (error) {
    try {
      await unlink(tempPath);
    } catch {
      // Best-effort cleanup only.
    }
    throw error;
  }
}

function sanitizeMarkdownInline(value: string, maxLen = 240): string {
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/`/gu, "'")
    .replace(/(^|\s)#{1,6}\s+/gu, "$1")
    .replace(/(^|\s)[-+*]\s+/gu, "$1")
    .replace(/(^|\s)---(?:\s|$)/gu, "$1")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLen)
    .trim();
  return cleaned.length > 0 ? cleaned : "None";
}

function markdownFenceFor(content: string): string {
  const runs = content.match(/`{3,}/gu) ?? [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 3);
  return "`".repeat(longest + 1);
}

export const OMNI_RUNTIME_FILES = [
  "STATE.md",
  "SESSION-SUMMARY.md",
  "REPO-MAP.md",
  "REPO-MAP.json",
] as const;

const STATE_TEMPLATE = "# State\n\nCurrent Phase: discovery\nActive Task: bootstrap\nStatus Summary: GedCode workspace bootstrapped and ready for planning.\nBlockers: None\nNext Step: Clarify scope, write spec, define tests, and break work into tasks before implementation.\n";

const SESSION_SUMMARY_TEMPLATE = "# Session Summary\n\n## Progress Made\n\n- Bootstrapped GedCode durable memory for this project.\n\n## Remaining Work\n\n- Clarify the request and write the first real spec, tasks, and tests.\n\n## Notes\n\nUse this file for concise cross-session handoff notes.\n";

export const OMNI_DURABLE_FILES = [
  "PROJECT.md",
  "SPEC.md",
  "TASKS.md",
  "TESTS.md",
  "DECISIONS.md",
  "STANDARDS.md",
  "SKILLS.md",
  "CONFIG.md",
  "VERSION",
] as const;

export const OMNI_GITIGNORE = [
  "# Runtime GedCode state: keep out of git by default.",
  "STATE.md",
  "SESSION-SUMMARY.md",
  "REPO-MAP.md",
  "REPO-MAP.json",
  "runtime/",
  "",
  "# Durable GedCode memory may be committed when it reflects real project intent.",
].join("\n");

export const OMNI_FILES: Record<string, string> = {
  "PROJECT.md": "# Project\n\n## Goal\n\nDescribe what this project is trying to achieve.\n\n## Users\n\nDescribe the primary users or stakeholders.\n\n## Constraints\n\nList important product, technical, or workflow constraints.\n\n## Success Criteria\n\nList the observable outcomes that mean the work is successful.\n",
  "SPEC.md": "# Spec\n\n## Problem\n\nDescribe the specific problem to solve.\n\n## Requested Behavior\n\nList the expected behavior clearly before implementation.\n\n## Constraints\n\nList any implementation constraints or non-goals.\n\n## Success Criteria\n\nList concrete checks that make this request complete.\n",
  "TASKS.md": "# Tasks\n\n## Planned slices\n\n- [ ] Slice 1: define the first bounded implementation step\n\n## Notes\n\nBreak work into bounded, verifiable slices before editing source files.\n",
  "TESTS.md": "# Tests\n\n## Checks\n\n- [ ] define the checks to run after each implementation slice\n\n## Expected outcomes\n\nDescribe what passing looks like.\n",
  "DECISIONS.md": "# Decisions\n\nRecord important choices and why they were made.\n",
  "STANDARDS.md": "# Imported Standards\n\nRecord imported standards from AGENTS.md, CLAUDE.md, Cursor rules, and similar files.\n",
  "SKILLS.md": "# Skills\n\n## Bundled\n\n- grill-me\n- grill-with-docs\n- find-skills\n- skill-maker\n- tdd\n- diagnose\n- improve-codebase-architecture\n- brainstorming\n- ged-planning\n- ged-execution\n- ged-verification\n\n## Suggested For Current Work\n\n- None inferred from the current task yet.\n\n## Project Notes\n\nRecord required and project-specific skills here.\n",
  "CONFIG.md": "# Omni Configuration\n\nOmni Mode: on\n",
  VERSION: `${OMNI_VERSION}\n`,
};

function parseFrontmatter(content: string): {
  frontmatter: CommandFrontmatter;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/u);
  if (!match) {
    return { frontmatter: {}, body: content.trim() };
  }

  const [, yamlContent, body] = match;
  const frontmatter: CommandFrontmatter = {};
  for (const line of yamlContent.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    if (key === "description") frontmatter.description = value;
    if (key === "agent") frontmatter.agent = value;
    if (key === "model") frontmatter.model = value;
    if (key === "subtask") frontmatter.subtask = value === "true";
  }
  return { frontmatter, body: body.trim() };
}

async function resolveResourcePath(...parts: string[]): Promise<string> {
  for (const candidateRoot of RESOURCE_ROOT_CANDIDATES) {
    const candidate = path.join(candidateRoot, ...parts);
    try {
      await stat(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }

  throw new Error(
    `GedCode resources not found for ${parts.join("/")}. Checked: ${RESOURCE_ROOT_CANDIDATES.join(", ")}`,
  );
}

async function loadCommands(): Promise<ParsedCommand[]> {
  const commandDir = await resolveResourcePath("commands");
  const entries = await readdir(commandDir, { withFileTypes: true });
  const commands: ParsedCommand[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const filePath = path.join(commandDir, entry.name);
    const content = await readFile(filePath, "utf8");
    const { frontmatter, body } = parseFrontmatter(content);
    commands.push({
      name: entry.name.replace(/\.md$/u, ""),
      frontmatter,
      template: body,
    });
  }

  return commands.sort((a, b) => a.name.localeCompare(b.name));
}

export async function ensureOmniDir(directory: string): Promise<string> {
  const omniDir = path.join(directory, ".ged");
  await mkdir(omniDir, { recursive: true });
  for (const [fileName, content] of Object.entries(OMNI_FILES)) {
    const filePath = path.join(omniDir, fileName);
    try {
      await stat(filePath);
    } catch {
      await writeFileAtomic(filePath, content);
    }
  }

  const gitignorePath = path.join(omniDir, ".gitignore");
  try {
    await stat(gitignorePath);
  } catch {
    await writeFileAtomic(gitignorePath, `${OMNI_GITIGNORE}\n`);
  }

  return omniDir;
}

async function readOmniConfig(directory: string): Promise<string> {
  try {
    return await readFile(path.join(directory, ".ged", "CONFIG.md"), "utf8");
  } catch {
    return "";
  }
}

async function readOmniMode(directory: string): Promise<OmniMode> {
  const config = await readOmniConfig(directory);
  return /Omni Mode:\s*off/iu.test(config) ? "off" : "on";
}

async function inferProjectGoal(directory: string): Promise<string> {
  try {
    const packageJson = JSON.parse(
      await readFile(path.join(directory, "package.json"), "utf8"),
    ) as { name?: string; description?: string };
    const pieces = [packageJson.name, packageJson.description].filter(Boolean);
    if (pieces.length > 0) {
      return pieces.join(" — ");
    }
  } catch {
    // ignore missing/invalid package.json
  }

  return "Describe what this project is trying to achieve.";
}

async function initializeProjectFile(directory: string): Promise<void> {
  const omniDir = await ensureOmniDir(directory);
  const projectPath = path.join(omniDir, "PROJECT.md");
  const current = await readFile(projectPath, "utf8").catch(() => OMNI_FILES["PROJECT.md"]);
  if (current.trim() !== OMNI_FILES["PROJECT.md"].trim()) {
    return;
  }

  const inferredGoal = await inferProjectGoal(directory);
  const content = [
    "# Project",
    "",
    "## Goal",
    "",
    inferredGoal,
    "",
    "## Users",
    "",
    "Describe the primary users or stakeholders.",
    "",
    "## Constraints",
    "",
    "List important product, technical, or workflow constraints.",
    "",
    "## Success Criteria",
    "",
    "List the observable outcomes that mean the work is successful.",
    "",
  ].join("\n");
  await writeFileAtomic(projectPath, content);
}

export async function setOmniMode(directory: string, mode: OmniMode): Promise<void> {
  const omniDir = await ensureOmniDir(directory);
  await writeFileAtomic(
    path.join(omniDir, "CONFIG.md"),
    `# Omni Configuration\n\nOmni Mode: ${mode}\n`,
  );

  if (mode === "on") {
    await updateStateFile(directory, {
      currentPhase: "discovery",
      activeTask: "bootstrap",
      statusSummary: "Omni mode enabled. Workspace ready for planning.",
      blockers: [],
      nextStep: "Clarify scope, write spec, define tests, and break work into tasks before implementation.",
    });
    return;
  }

  await updateStateFile(directory, {
    currentPhase: "passive",
    activeTask: "",
    statusSummary: "Omni mode disabled. Durable .ged context remains available as passive guidance.",
    blockers: [],
    nextStep: "Re-enable Omni mode when you want the full planning and verification workflow.",
  });
}

async function readStateSummary(directory: string): Promise<string> {
  const runtimePaths = await activeRuntimePaths(directory);
  try {
    return await readFile(runtimePaths.statePath, "utf8");
  } catch {
    try {
      return await readFile(path.join(directory, ".ged", "STATE.md"), "utf8");
    } catch {
      return `No ${relativeDisplayPath(directory, runtimePaths.statePath)} found.`;
    }
  }
}

async function readSessionSummary(directory: string): Promise<string> {
  const runtimePaths = await activeRuntimePaths(directory);
  try {
    return await readFile(runtimePaths.sessionSummaryPath, "utf8");
  } catch {
    try {
      return await readFile(path.join(directory, ".ged", "SESSION-SUMMARY.md"), "utf8");
    } catch {
      return SESSION_SUMMARY_TEMPLATE;
    }
  }
}

function normalizeListItems(items: string[]): string {
  const cleaned = items.map((item) => sanitizeMarkdownInline(item)).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join("; ") : "None";
}

export async function updateStateFile(
  directory: string,
  updates: {
    currentPhase?: string;
    activeTask?: string;
    statusSummary?: string;
    blockers?: string[];
    nextStep?: string;
  },
): Promise<string> {
  await ensureOmniDir(directory);
  const runtimePaths = await activeRuntimePaths(directory);
  const nextState = {
    currentPhase: sanitizeMarkdownInline(updates.currentPhase ?? "discovery", 80),
    activeTask: updates.activeTask ? sanitizeMarkdownInline(updates.activeTask, 160) : "",
    statusSummary: updates.statusSummary
      ? sanitizeMarkdownInline(updates.statusSummary, 300)
      : "GedCode workspace bootstrapped and ready for planning.",
    blockers: normalizeListItems(updates.blockers ?? []),
    nextStep: updates.nextStep
      ? sanitizeMarkdownInline(updates.nextStep, 300)
      : "Clarify scope, write spec, define tests, and break work into tasks before implementation.",
  };

  const content = [
    "# State",
    "",
    `Current Phase: ${nextState.currentPhase}`,
    `Active Task: ${nextState.activeTask}`,
    `Status Summary: ${nextState.statusSummary}`,
    `Blockers: ${nextState.blockers}`,
    `Next Step: ${nextState.nextStep}`,
    "",
  ].join("\n");

  await writeFileAtomic(runtimePaths.statePath, content);
  return runtimePaths.statePath;
}

export async function appendSessionSummary(
  directory: string,
  entry: {
    title: string;
    bullets: string[];
  },
): Promise<string> {
  await ensureOmniDir(directory);
  const runtimePaths = await activeRuntimePaths(directory);
  const summaryPath = runtimePaths.sessionSummaryPath;
  const current = await readSessionSummary(directory);
  const title = sanitizeMarkdownInline(entry.title || "Update", 120);
  const bullets = entry.bullets.map((bullet) => sanitizeMarkdownInline(bullet, 240));
  const section = [
    "",
    `## ${title}`,
    "",
    ...bullets.map((bullet) => `- ${bullet}`),
    "",
  ].join("\n");
  const next = `${current.trimEnd()}${section}`;
  await writeFileAtomic(summaryPath, `${next}\n`);
  return summaryPath;
}

async function listSkills(): Promise<SkillInfo[]> {
  const skillDir = await resolveResourcePath("skills");
  const entries = await readdir(skillDir, { withFileTypes: true });
  const skills: SkillInfo[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const filePath = path.join(skillDir, entry.name);
    const content = await readFile(filePath, "utf8");
    const lines = content.split("\n");
    const title = lines[0]?.replace(/^#\s*/u, "").trim() || entry.name;
    const description = lines.find((line) => line.trim().length > 0 && !line.startsWith("#"))?.trim() || "";
    skills.push({
      name: entry.name.replace(/\.md$/u, ""),
      description: description || title,
      path: filePath,
    });
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

// Skill names are user-controllable through the gedcode_read_skill tool, and
// the resolved path is read from disk. Restrict to a safe character set so
// `..` / slashes / null bytes can't escape the bundled skills directory.
const SAFE_SKILL_NAME = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/u;

async function readSkill(name: string): Promise<string> {
  if (!SAFE_SKILL_NAME.test(name)) {
    throw new Error(`GedCode: refusing to read skill with unsafe name: ${name}`);
  }
  const filePath = await resolveResourcePath("skills", `${name}.md`);
  return readFile(filePath, "utf8");
}

function isRepoMapFile(name: string): boolean {
  return /\.(ts|tsx|js|jsx|json|md|sh|yml|yaml)$/u.test(name);
}

function scoreRepoMapPath(relativePath: string): number {
  let score = 0;
  const depth = relativePath.split("/").length - 1;
  const basename = path.posix.basename(relativePath);

  if (basename === "package.json") score += 15;
  if (basename === "README.md") score += 12;
  if (basename === "AGENTS.md") score += 11;
  if (basename === "tsconfig.json") score += 8;
  if (basename === "opencode.json") score += 8;
  if (relativePath.startsWith("src/")) score += 8;
  if (relativePath.startsWith("packages/")) score += 7;
  if (relativePath.startsWith("docs/")) score += 5;
  if (relativePath.includes("index.")) score += 4;
  if (/\b(test|spec)\b/u.test(relativePath)) score += 2;
  score += Math.max(0, 5 - depth);

  return score;
}

async function summarizeRepoMapFile(directory: string, relativePath: string): Promise<string> {
  const fullPath = path.join(directory, relativePath);
  const fileStat = await stat(fullPath);
  if (fileStat.size > REPO_MAP_MAX_SUMMARY_BYTES) {
    return `large file skipped (${fileStat.size} bytes)`;
  }
  const content = await readFile(fullPath, "utf8");
  const basename = path.posix.basename(relativePath);

  if (basename === "package.json") {
    try {
      const parsed = JSON.parse(content) as { name?: string; description?: string };
      return sanitizeMarkdownInline(
        [parsed.name, parsed.description].filter(Boolean).join(" — ") || "package manifest",
      );
    } catch {
      return "package manifest";
    }
  }

  if (basename.endsWith(".md")) {
    const heading = content.match(/^#\s+(.+)$/mu)?.[1]?.trim();
    return heading ? `markdown: ${sanitizeMarkdownInline(heading)}` : "markdown document";
  }

  const exportMatch = content.match(/export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/u);
  if (exportMatch) {
    return `exports ${sanitizeMarkdownInline(exportMatch[1], 80)}`;
  }

  const importCount = (content.match(/^import\s/gu) ?? []).length;
  if (importCount > 0) {
    return `${importCount} imports`;
  }

  return "source/config file";
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function collectRepoMapEntries(directory: string): Promise<RepoMapEntry[]> {
  const filePaths: string[] = [];

  async function walk(currentDir: string, depth: number): Promise<void> {
    if (depth > 4) return;
    const dirEntries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of dirEntries) {
      if (REPO_MAP_IGNORE.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(directory, fullPath).split(path.sep).join("/");

      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1);
        continue;
      }

      if (!isRepoMapFile(entry.name)) continue;
      filePaths.push(relativePath);
    }
  }

  await walk(directory, 0);
  const entries = await mapWithConcurrency(filePaths, 16, async (relativePath) => ({
    path: relativePath,
    score: scoreRepoMapPath(relativePath),
    summary: await summarizeRepoMapFile(directory, relativePath),
  }));
  return entries.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

export async function buildRepoMap(directory: string): Promise<string> {
  const omniDir = await ensureOmniDir(directory);
  const entries = await collectRepoMapEntries(directory);
  const topEntries = entries.slice(0, 60);
  const summary = [
    "# Repo Map",
    "",
    `Root: ${directory}`,
    `Indexed files: ${entries.length}`,
    "",
    "## Ranked files",
    "",
    ...topEntries.map(
      (entry) =>
        `- [${entry.score}] ${sanitizeMarkdownInline(entry.path, 180)} — ${sanitizeMarkdownInline(entry.summary)}`,
    ),
  ].join("\n");

  await writeFileAtomic(path.join(omniDir, "REPO-MAP.md"), `${summary}\n`);
  await writeFileAtomic(path.join(omniDir, "REPO-MAP.json"), `${JSON.stringify(topEntries, null, 2)}\n`);
  return summary;
}

export async function suggestSkills(task: string): Promise<SuggestedSkill[]> {
  const normalized = task.trim();
  const results = new Map<string, SuggestedSkill>();

  for (const rule of SKILL_RULES) {
    const matches = rule.patterns.filter((pattern) => pattern.test(normalized)).length;
    if (matches === 0) continue;
    results.set(rule.name, {
      name: rule.name,
      reason: rule.reason,
      score: rule.score + matches - 1,
    });
  }

  return [...results.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export async function updateSkillsFile(
  directory: string,
  task: string,
): Promise<{ suggested: SuggestedSkill[]; outputPath: string }> {
  const omniDir = await ensureOmniDir(directory);
  const outputPath = path.join(omniDir, "SKILLS.md");
  const existing = await readFile(outputPath, "utf8").catch(() => "");
  const existingProjectNotes = existing.includes(SKILLS_PROJECT_NOTES_HEADING)
    ? existing.slice(existing.indexOf(SKILLS_PROJECT_NOTES_HEADING) + SKILLS_PROJECT_NOTES_HEADING.length).trim()
    : "Record required and project-specific skills here.";
  const suggested = await suggestSkills(task);
  const sections = [
    "# Skills",
    "",
    "## Bundled",
    "",
    "- grill-me",
    "- grill-with-docs",
    "- find-skills",
    "- skill-maker",
    "- tdd",
    "- diagnose",
    "- improve-codebase-architecture",
    "- brainstorming",
    "- ged-planning",
    "- ged-execution",
    "- ged-verification",
    "",
    "## Suggested For Current Work",
    "",
  ];

  if (suggested.length === 0) {
    sections.push("- None inferred from the current task yet.");
  } else {
    sections.push(...suggested.map((skill) => `- ${skill.name}: ${skill.reason}`));
  }

  sections.push("", SKILLS_PROJECT_NOTES_HEADING, "", existingProjectNotes);
  await writeFileAtomic(outputPath, `${sections.join("\n")}\n`);
  return { suggested, outputPath };
}

export async function discoverStandards(directory: string): Promise<StandardCandidate[]> {
  const ignore = new Set([
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    ".pi",
    ".ged",
    ".turbo",
    "coverage",
  ]);
  const found = new Map<string, StandardCandidate>();

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (ignore.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(directory, fullPath).split(path.sep).join("/");

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      for (const rule of STANDARD_RULES) {
        if (rule.match(relativePath, entry.name)) {
          found.set(relativePath, {
            path: relativePath,
            kind: rule.kind,
          });
          break;
        }
      }
    }
  }

  await walk(directory);
  return [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export async function importStandards(
  directory: string,
  selectedPaths?: string[],
): Promise<{ imported: StandardCandidate[]; outputPath: string }> {
  const omniDir = await ensureOmniDir(directory);
  const candidates = await discoverStandards(directory);
  const normalizedSelected = new Set((selectedPaths ?? []).map((item) => item.replaceAll("\\", "/")));
  const imported =
    normalizedSelected.size > 0
      ? candidates.filter((candidate) => normalizedSelected.has(candidate.path))
      : candidates;

  // Resolve the project root once so we can verify each imported file lives
  // under it. discoverStandards uses path.relative on entries it walked, but
  // the walker doesn't refuse symlinks — without this check, a symlinked
  // standards file pointing outside the repo would still be read.
  const resolvedRoot = await realpath(directory);

  const sections: string[] = ["# Imported Standards", ""];

  if (imported.length === 0) {
    sections.push("No external standards were discovered.");
  } else {
    sections.push(
      "These standards were discovered from common agent-instruction locations and imported into GedCode durable memory.",
      "",
    );

    for (const candidate of imported) {
      const fullPath = path.resolve(directory, candidate.path);
      const realFullPath = await realpath(fullPath);
      if (realFullPath !== resolvedRoot && !realFullPath.startsWith(resolvedRoot + path.sep)) {
        throw new Error(
          `GedCode: refusing to import standards file outside project root: ${candidate.path}`,
        );
      }
      const content = await readFile(realFullPath, "utf8");
      const fence = markdownFenceFor(content);
      sections.push(
        `## ${sanitizeMarkdownInline(candidate.kind, 80)}: ${sanitizeMarkdownInline(candidate.path, 180)}`,
        "",
        `${fence}md`,
        content.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, ""),
        fence,
        "",
      );
    }
  }

  const outputPath = path.join(omniDir, "STANDARDS.md");
  await writeFileAtomic(outputPath, `${sections.join("\n").trimEnd()}\n`);
  return { imported, outputPath };
}

async function readInstructionPrompt(): Promise<string> {
  const instructionFile = await resolveResourcePath(
    "instructions",
    "gedcode-agent.md",
  );
  return readFile(instructionFile, "utf8");
}

async function checkRtkAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd = process.platform === "win32" ? "where" : "which";
    const probe = spawn(cmd, ["rtk"], { stdio: "ignore", shell: false });
    probe.on("exit", (code) => resolve(code === 0));
    probe.on("error", () => resolve(false));
  });
}

export async function planningArtifactsReadyAt(paths: PlanningArtifactPaths): Promise<boolean> {
  try {
    const [specContent, tasksContent, testsContent] = await Promise.all([
      readFile(paths.specPath, "utf8"),
      readFile(paths.tasksPath, "utf8"),
      readFile(paths.testsPath, "utf8"),
    ]);

    const normalizedSpec = specContent.trim();
    const normalizedTasks = tasksContent.trim();
    const normalizedTests = testsContent.trim();
    const defaultSpec = OMNI_FILES["SPEC.md"].trim();
    const defaultTasks = OMNI_FILES["TASKS.md"].trim();
    const defaultTests = OMNI_FILES["TESTS.md"].trim();

    return (
      normalizedSpec.length > defaultSpec.length &&
      normalizedTasks.length > defaultTasks.length &&
      normalizedTests.length > defaultTests.length &&
      normalizedSpec !== defaultSpec &&
      normalizedTasks !== defaultTasks &&
      normalizedTests !== defaultTests
    );
  } catch {
    return false;
  }
}

export async function resolvePlanningArtifactReadiness(directory: string): Promise<PlanningArtifactReadiness> {
  const activePaths = await activePlanningArtifactPaths(directory);
  if (await planningArtifactsReadyAt(activePaths)) {
    return { ready: true, activePaths, readyPaths: activePaths, usedRootFallback: false };
  }

  if (activePaths.source === "work") {
    const rootPaths = rootPlanningArtifactPaths(directory);
    if (await planningArtifactsReadyAt(rootPaths)) {
      return { ready: true, activePaths, readyPaths: rootPaths, usedRootFallback: true };
    }
  }

  return { ready: false, activePaths, readyPaths: null, usedRootFallback: false };
}

export async function planningArtifactsReady(directory: string): Promise<boolean> {
  return (await resolvePlanningArtifactReadiness(directory)).ready;
}

export function planningGuardMessage(readiness: PlanningArtifactReadiness): string {
  if (readiness.activePaths.source === "work") {
    return `GedCode guard: before editing source files or running mutating shell commands, write real planning content into ${readiness.activePaths.baseDir}/SPEC.md, TASKS.md, and TESTS.md. Legacy root .ged/SPEC.md, .ged/TASKS.md, and .ged/TESTS.md can still satisfy this guard during migration.`;
  }
  return "GedCode guard: before editing source files or running mutating shell commands, write real planning content into .ged/SPEC.md, .ged/TASKS.md, and .ged/TESTS.md (placeholder bootstrap files are not enough).";
}

function relativeDisplayPath(directory: string, filePath: string): string {
  return path.relative(directory, filePath).split(path.sep).join("/") || ".";
}

export async function buildCollaborationCheckpoint(directory: string): Promise<string> {
  const [settings, branch, readiness] = await Promise.all([
    readGedCodeSettings(directory),
    readCurrentGitBranch(directory),
    resolvePlanningArtifactReadiness(directory),
  ]);
  const protectedBranch = isProtectedBranch(branch, settings);
  const protectedBranchStatus = !branch
    ? "not in a branch-backed git checkout"
    : protectedBranch && settings.workflow.requireFeatureBranchForChanges && !settings.workflow.allowProtectedBranchChanges
      ? "blocked for change implementation"
      : protectedBranch
        ? "allowed by settings"
        : "not protected";
  const planningStatus = readiness.ready
    ? readiness.usedRootFallback
      ? `ready via legacy root fallback (${relativeDisplayPath(directory, readiness.readyPaths?.baseDir ?? readiness.activePaths.baseDir)})`
      : `ready (${relativeDisplayPath(directory, readiness.readyPaths?.baseDir ?? readiness.activePaths.baseDir)})`
    : `not ready (${relativeDisplayPath(directory, readiness.activePaths.baseDir)})`;
  const nextStep = readiness.ready
    ? protectedBranchStatus === "blocked for change implementation"
      ? "Create or switch to a feature branch, or explicitly allow protected branch changes in GedCode settings."
      : "Proceed with the planned slice and verify before committing."
    : `Write real SPEC.md, TASKS.md, and TESTS.md in ${relativeDisplayPath(directory, readiness.activePaths.baseDir)}.`;

  return [
    "# Collaboration Checkpoint",
    "",
    `Branch: ${branch ?? "none detected"}`,
    `Protected Branch: ${protectedBranch ? "yes" : "no"}`,
    `Protected Branch Policy: ${protectedBranchStatus}`,
    `Active Work ID: ${readiness.activePaths.workId ?? "root"}`,
    `Active Planning Directory: ${relativeDisplayPath(directory, readiness.activePaths.baseDir)}`,
    `Planning Status: ${planningStatus}`,
    `Root Fallback Used: ${readiness.usedRootFallback ? "yes" : "no"}`,
    `Next Step: ${nextStep}`,
  ].join("\n");
}

function extractFilePath(args: Record<string, unknown>): string | null {
  const candidateKeys = ["filePath", "path", "target", "filename"];
  for (const key of candidateKeys) {
    const value = args[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

async function isInsideProjectOmniDir(directory: string, targetPath: string): Promise<boolean> {
  const absoluteTarget = path.resolve(directory, targetPath);
  const omniDir = path.resolve(directory, ".ged");
  const relative = path.relative(omniDir, absoluteTarget);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isGedCodeXdgOverride(): boolean {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (!xdg) return false;
  // GedCode launcher sets XDG_CONFIG_HOME to ~/.config/gedcode.
  // Detect this pattern so we can strip it from child tool shells.
  return xdg.endsWith(path.join(".config", "gedcode"));
}

function sanitizeBashEnv(command: string): string {
  // When GedCode's launcher overrides XDG_CONFIG_HOME, child bash shells
  // inherit the isolated path and user CLIs like `gh` lose their normal config.
  // Prefix with `env -u XDG_CONFIG_HOME` so user tools see the default config.
  if (!isGedCodeXdgOverride()) return command;
  if (command.trimStart().startsWith("env ")) return command;
  return `env -u XDG_CONFIG_HOME ${command}`;
}

function isPotentiallyMutatingBashCommand(command: string): boolean {
  const normalized = command.replace(/\\\n/gu, " ");
  return (
    /(^|[;&|()]\s*)(?:sudo\s+)?(?:rm|mv|cp|touch|mkdir|rmdir|ln|chmod|chown|install|tee|truncate|python(?:3)?|node|perl|ruby|sh|bash|zsh)\b/u.test(normalized) ||
    /(^|[^<>])>\s*[^&\s]/u.test(normalized) ||
    />>\s*\S/u.test(normalized) ||
    /\b(?:sed|perl)\b[^\n;|&]*\s-i(?:\s|$)/u.test(normalized)
  );
}

export const GedCodePlugin: Plugin = async ({ directory }, options) => {
  const settingsHomeDir = options?.homeDir as string | undefined;
  const commands = await loadCommands();
  const instructionPrompt = await readInstructionPrompt();
  const rtkAvailable = await checkRtkAvailable();

  return {
    async config(config) {
      const settings = await readGedCodeSettings(directory, { homeDir: settingsHomeDir });
      config.agent = config.agent ?? {};
      config.command = config.command ?? {};
      config.instructions = Array.isArray(config.instructions)
        ? config.instructions
        : [];

      const gedcodeAgentConfig: OmniAgentConfig = {
        description:
          "GedCode workflow agent: clarify, spec, task, implement in bounded slices, then verify.",
        mode: "primary",
        prompt: settings.agents.enabled ? orchestrationPrompt(instructionPrompt) : instructionPrompt,
        ...(settings.agents.enabled
          ? { permission: { task: taskPermissionForOmniSubagents() } }
          : {}),
      };
      config.agent.gedcode = gedcodeAgentConfig as unknown as typeof config.agent.gedcode;

      if (settings.agents.enabled) {
        for (const agentName of OMNI_SUBAGENT_NAMES) {
          config.agent[agentName] = buildSubagentConfig(settings, agentName) as unknown as typeof config.agent.gedcode;
        }
      }

      const mutableConfig = config as Record<string, unknown>;
      if (typeof mutableConfig.default_agent !== "string") {
        mutableConfig.default_agent = "gedcode";
      }

      for (const command of commands) {
        config.command[command.name] = {
          template: command.template,
          description: command.frontmatter.description,
          agent: command.frontmatter.agent ?? "gedcode",
          model: command.frontmatter.model,
          subtask: command.frontmatter.subtask,
        };
      }
    },

    event: async ({ event }) => {
      if (event.type === "session.created") {
        await ensureOmniDir(directory);
        await initializeProjectFile(directory);
        await setOmniMode(directory, "on");
      }
    },

    "experimental.session.compacting": async (_input, output) => {
      output.context.push(
        [
          "## GedCode Durable State",
          await readStateSummary(directory),
        ].join("\n\n"),
      );
    },

    "tool.execute.before": async (input, output) => {
      // RTK integration: rewrite bash commands through RTK for token savings.
      // RTK handles passthrough for commands it doesn't recognize, so we
      // prefix all bash commands and let RTK decide what to compress.
      const args = (output.args ?? {}) as Record<string, unknown>;
      const commandKey = Object.keys(args).find(
        (k) => typeof args[k] === "string" && (k === "command" || k === "cmd"),
      );
      const originalBashCommand = input.tool === "bash" && commandKey ? String(args[commandKey]) : null;

      const activeMode = await readOmniMode(directory);
      if (activeMode === "off") return;

      const fileMutatingTool = input.tool === "write" || input.tool === "edit";
      const potentiallyMutatingBash = originalBashCommand ? isPotentiallyMutatingBashCommand(originalBashCommand) : false;
      if (fileMutatingTool) {
        const targetPath = extractFilePath(args);
        if (!targetPath) return;
        if (await isInsideProjectOmniDir(directory, targetPath)) {
          return;
        }
      }

      if (!fileMutatingTool && !potentiallyMutatingBash) {
        if (input.tool === "bash" && commandKey && typeof args[commandKey] === "string") {
          const originalCommand = args[commandKey] as string;
          let rewritten = sanitizeBashEnv(originalCommand);
          if (rtkAvailable && !rewritten.trimStart().startsWith("rtk ")) {
            rewritten = `rtk ${rewritten}`;
          }
          if (rewritten !== originalCommand) {
            args[commandKey] = rewritten;
          }
        }
        return;
      }

      const planningReadiness = await resolvePlanningArtifactReadiness(directory);
      if (!planningReadiness.ready) {
        throw new Error(planningGuardMessage(planningReadiness));
      }

      const settings = await readGedCodeSettings(directory, { homeDir: settingsHomeDir });
      await assertProtectedBranchAllowsMutation(directory, settings);

      if (input.tool === "bash" && commandKey && typeof args[commandKey] === "string") {
        const originalCommand = args[commandKey] as string;
        let rewritten = sanitizeBashEnv(originalCommand);
        if (rtkAvailable && !rewritten.trimStart().startsWith("rtk ")) {
          rewritten = `rtk ${rewritten}`;
        }
        if (rewritten !== originalCommand) {
          args[commandKey] = rewritten;
        }
      }
    },

    tool: {
      gedcode_bootstrap: tool({
        description:
          "Create the .ged durable-memory folder and default GedCode workflow files in the current project.",
        args: {
          mode: tool.schema.enum(["on", "off"]).optional().describe("Initial Omni mode; defaults to on."),
        },
        async execute(args) {
          await ensureOmniDir(directory);
          await initializeProjectFile(directory);
          await setOmniMode(directory, (args.mode as OmniMode | undefined) ?? "on");
          await appendSessionSummary(directory, {
            title: "Bootstrap",
            bullets: [
              "Initialized .ged durable memory for the project.",
              `Set Omni mode to ${(args.mode as OmniMode | undefined) ?? "on"}.`,
            ],
          });
          return `Bootstrapped ${path.join(directory, ".ged")}`;
        },
      }),

      gedcode_set_mode: tool({
        description: "Turn Omni mode on or off for the current project.",
        args: {
          mode: tool.schema.enum(["on", "off"]).describe("Desired Omni mode."),
        },
        async execute(args) {
          await setOmniMode(directory, args.mode as OmniMode);
          return `Omni mode set to ${args.mode}.`;
        },
      }),

      gedcode_agents_status: tool({
        description: "Read effective GedCode sub-agent settings from global and project settings files.",
        args: {},
        async execute() {
          const settings = await readGedCodeSettings(directory, { homeDir: settingsHomeDir });
          const recommendations = await readGedCodeModelRecommendations(directory, { homeDir: settingsHomeDir });
          return formatAgentsSettingsStatus(settings, {
            globalPath: resolveGlobalSettingsPath(settingsHomeDir),
            projectPath: resolveProjectSettingsPath(directory),
            recommendationsPath: recommendations.sourcePath,
          });
        },
      }),

      gedcode_update_agents_settings: tool({
        description: "Update GedCode sub-agent settings globally or for the current project override.",
        args: {
          scope: tool.schema.enum(["global", "project"]).optional().describe("Where to write settings; defaults to global."),
          enabled: tool.schema.boolean().optional().describe("Enable or disable GedCode native subagents."),
          defaultModel: tool.schema.string().optional().describe("Optional shared model for GedCode subagents."),
          models: tool.schema
            .object({
              "ged-explorer": tool.schema.unknown().optional(),
              "ged-planner": tool.schema.unknown().optional(),
              "ged-verifier": tool.schema.unknown().optional(),
            })
            .optional()
            .describe("Per-subagent model config. Each agent accepts a model ID string or an object with 'model' plus provider options (e.g. {\"model\": \"openai/gpt-5.5\", \"reasoningEffort\": \"high\"})."),
        },
        async execute(args) {
          const result = await updateGedCodeAgentsSettings(directory, {
            scope: args.scope as GedCodeSettingsScope | undefined,
            enabled: args.enabled,
            defaultModel: args.defaultModel,
            models: args.models as Partial<Record<OmniSubagentName, AgentModelConfig>> | undefined,
          }, { homeDir: settingsHomeDir });
          const recommendations = await readGedCodeModelRecommendations(directory, { homeDir: settingsHomeDir });
          return [
            `Updated ${result.scope} GedCode agent settings: ${result.outputPath}`,
            formatAgentsSettingsStatus(result.settings, {
              globalPath: resolveGlobalSettingsPath(settingsHomeDir),
              projectPath: resolveProjectSettingsPath(directory),
              recommendationsPath: recommendations.sourcePath,
              compact: true,
            }),
          ].join("\n");
        },
      }),

      gedcode_read_model_recommendations: tool({
        description: "Read optional GedCode model recommendation markdown for guided sub-agent setup.",
        args: {},
        async execute() {
          const recommendations = await readGedCodeModelRecommendations(directory, { homeDir: settingsHomeDir });
          if (!recommendations.sourcePath) {
            return [
              "No GedCode model recommendation markdown found.",
              `Create ${globalGedCodeModelRecommendationsPath(settingsHomeDir)} for global guidance or ${projectGedCodeModelRecommendationsPath(directory)} for this project.`,
            ].join("\n");
          }
          return [`Source: ${recommendations.sourcePath}`, "", recommendations.content].join("\n");
        },
      }),

      gedcode_state: tool({
        description: "Read the current GedCode runtime state summary from the active .ged/runtime directory.",
        args: {},
        async execute() {
          await ensureOmniDir(directory);
          const [stateSummary, settings] = await Promise.all([
            readStateSummary(directory),
            readGedCodeSettings(directory, { homeDir: settingsHomeDir }),
          ]);
          return `${stateSummary.trimEnd()}\n\n${formatWorkflowSettingsStatus(settings)}`;
        },
      }),

      gedcode_collaboration_status: tool({
        description:
          "Report current branch, protected-branch policy, active Omni work-memory path, and planning readiness.",
        args: {},
        async execute() {
          await ensureOmniDir(directory);
          return buildCollaborationCheckpoint(directory);
        },
      }),

      gedcode_start_work: tool({
        description:
          "Explicitly create or switch to a feature branch and initialize the active .ged/work planning directory.",
        args: {
          branch: tool.schema.string().describe("Feature branch name to create or switch to."),
          base: tool.schema.string().optional().describe("Optional base ref for creating a new branch."),
          allowDirty: tool.schema.boolean().optional().describe("Allow carrying a dirty working tree into the branch."),
        },
        async execute(args) {
          const result = await startWorkBranch(directory, {
            branch: args.branch,
            base: args.base,
            allowDirty: args.allowDirty,
          });
          return result.message;
        },
      }),

      gedcode_create_pr: tool({
        description:
          "Create a GitHub pull request for the current branch when the user requests it or PR auto-creation is enabled.",
        args: {
          title: tool.schema.string().optional().describe("Optional PR title. Defaults to a title derived from the branch."),
          body: tool.schema.string().optional().describe("Optional PR body. Defaults to GedCode planning summary."),
          base: tool.schema.string().optional().describe("Optional base branch for the PR."),
          draft: tool.schema.boolean().optional().describe("Create the PR as a draft."),
          push: tool.schema.boolean().optional().describe("Push the branch if it has no upstream. Defaults to true."),
        },
        async execute(args) {
          return createPullRequest(directory, {
            title: args.title,
            body: args.body,
            base: args.base,
            draft: args.draft,
            push: args.push,
          });
        },
      }),

      gedcode_migrate_root_plan: tool({
        description:
          "Copy non-placeholder root .ged planning files into the active branch-scoped .ged/work directory.",
        args: {
          overwrite: tool.schema.boolean().optional().describe("Overwrite existing active work planning files."),
        },
        async execute(args) {
          const result = await migrateRootPlanToActiveWork(directory, { overwrite: args.overwrite });
          return result.message;
        },
      }),

      gedcode_update_state: tool({
        description: "Update the active branch-scoped .ged/runtime STATE.md with the current phase, active task, blockers, and next step.",
        args: {
          currentPhase: tool.schema.string().optional().describe("Current workflow phase."),
          activeTask: tool.schema.string().optional().describe("Current active task."),
          statusSummary: tool.schema.string().optional().describe("One-line status summary."),
          blockers: tool.schema.array(tool.schema.string()).optional().describe("Current blockers, if any."),
          nextStep: tool.schema.string().optional().describe("Most likely next step."),
        },
        async execute(args) {
          const outputPath = await updateStateFile(directory, args);
          return `Updated ${outputPath}`;
        },
      }),

      gedcode_append_session_summary: tool({
        description: "Append a concise titled update to the active branch-scoped .ged/runtime SESSION-SUMMARY.md.",
        args: {
          title: tool.schema.string().describe("Short heading for the update."),
          bullets: tool.schema.array(tool.schema.string()).describe("Concise bullet points to append."),
        },
        async execute(args) {
          const outputPath = await appendSessionSummary(directory, args);
          return `Updated ${outputPath}`;
        },
      }),

      gedcode_repo_map: tool({
        description:
          "Generate a lightweight repo map for the current project and save it to .ged/REPO-MAP.md.",
        args: {},
        async execute() {
          return buildRepoMap(directory);
        },
      }),

      gedcode_discover_standards: tool({
        description:
          "Discover external instruction files such as AGENTS.md, CLAUDE.md, Cursor rules, and similar standards files in the current project.",
        args: {},
        async execute() {
          const candidates = await discoverStandards(directory);
          if (candidates.length === 0) {
            return "No external standards files found.";
          }
          return candidates
            .map((candidate) => `- ${candidate.path} (${candidate.kind})`)
            .join("\n");
        },
      }),

      gedcode_import_standards: tool({
        description:
          "Import discovered external standards into .ged/STANDARDS.md. Optionally limit the import to selected relative paths.",
        args: {
          paths: tool.schema
            .array(tool.schema.string())
            .optional()
            .describe("Optional list of relative file paths to import. When omitted, import all discovered standards."),
        },
        async execute(args) {
          const result = await importStandards(directory, args.paths);
          if (result.imported.length === 0) {
            return `No standards imported. Wrote ${result.outputPath}.`;
          }
          return [
            `Imported ${result.imported.length} standards into ${result.outputPath}:`,
            ...result.imported.map((candidate) => `- ${candidate.path} (${candidate.kind})`),
          ].join("\n");
        },
      }),

      gedcode_suggest_skills: tool({
        description:
          "Suggest bundled GedCode skills based on the current task or request text.",
        args: {
          task: tool.schema.string().describe("Task, request, or work summary to analyze."),
        },
        async execute(args) {
          const suggestions = await suggestSkills(args.task);
          if (suggestions.length === 0) {
            return "No specific bundled skills inferred from the task.";
          }
          return suggestions
            .map((skill) => `- ${skill.name} [${skill.score}]: ${skill.reason}`)
            .join("\n");
        },
      }),

      gedcode_update_skills: tool({
        description:
          "Update .ged/SKILLS.md with bundled skills and suggestions for the current work.",
        args: {
          task: tool.schema.string().describe("Task, request, or work summary to analyze."),
        },
        async execute(args) {
          const result = await updateSkillsFile(directory, args.task);
          if (result.suggested.length === 0) {
            return `Updated ${result.outputPath} with no additional suggested skills.`;
          }
          return [
            `Updated ${result.outputPath} with suggested skills:`,
            ...result.suggested.map((skill) => `- ${skill.name} [${skill.score}]: ${skill.reason}`),
          ].join("\n");
        },
      }),

      gedcode_list_skills: tool({
        description: "List bundled GedCode workflow skills available to the agent.",
        args: {},
        async execute() {
          const skills = await listSkills();
          return skills
            .map((skill) => `- ${skill.name}: ${skill.description}`)
            .join("\n");
        },
      }),

      gedcode_read_skill: tool({
        description: "Read a bundled GedCode skill by name.",
        args: {
          name: tool.schema.string().describe("Skill name without .md extension."),
        },
        async execute(args) {
          return readSkill(args.name);
        },
      }),
    },
  };
};

export default GedCodePlugin;
