import { mkdirSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Theme } from "@mariozechner/pi-coding-agent";

import { writeFileAtomicSync } from "./atomic.js";

// ── Curated presets ──────────────────────────────────────────────

export interface GedPreset {
  readonly label: string;
  readonly brand: string;
  readonly welcome: string;
}

export const PRESETS: Record<string, GedPreset> = {
  lavender: {
    label: "Lavender",
    brand: "#c5bceb",
    welcome: "#4969c9",
  },
  ember: {
    label: "Ember",
    brand: "#e8836b",
    welcome: "#d4a054",
  },
  ocean: {
    label: "Ocean",
    brand: "#5fb3d4",
    welcome: "#4a90b8",
  },
  mint: {
    label: "Mint",
    brand: "#7ecba1",
    welcome: "#52a37a",
  },
  rose: {
    label: "Rose",
    brand: "#e88aaf",
    welcome: "#c76b8f",
  },
  gold: {
    label: "Gold",
    brand: "#d4b96a",
    welcome: "#b89b4a",
  },
  arctic: {
    label: "Arctic",
    brand: "#a0c4e8",
    welcome: "#7ba3cc",
  },
  neon: {
    label: "Neon",
    brand: "#b97aff",
    welcome: "#ff6bde",
  },
  copper: {
    label: "Copper",
    brand: "#d4956a",
    welcome: "#b87a4f",
  },
  slate: {
    label: "Slate",
    brand: "#8fa3b8",
    welcome: "#6b8299",
  },
};

export const DEFAULT_PRESET = "lavender";

// ── JSON theme loading ───────────────────────────────────────────

interface ThemeJson {
  name: string;
  vars?: Record<string, string | number>;
  colors: Record<string, string | number>;
  export?: Record<string, string | number>;
}

const BG_COLOR_KEYS = new Set([
  "selectedBg",
  "userMessageBg",
  "customMessageBg",
  "toolPendingBg",
  "toolSuccessBg",
  "toolErrorBg",
]);

const THEMES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "themes",
);

const presetCache = new Map<string, ThemeJson>();

function resolveVarRefs(
  value: string | number,
  vars: Record<string, string | number>,
  visited = new Set<string>(),
): string | number {
  if (typeof value === "number" || value === "" || value.startsWith("#")) {
    return value;
  }
  if (visited.has(value)) {
    throw new Error(`Circular variable reference detected: ${value}`);
  }
  if (!(value in vars)) {
    throw new Error(`Variable reference not found: ${value}`);
  }
  visited.add(value);
  const next = vars[value];
  if (next === undefined) {
    throw new Error(`Variable reference not found: ${value}`);
  }
  return resolveVarRefs(next, vars, visited);
}

function resolveThemeColors(
  colors: Record<string, string | number>,
  vars: Record<string, string | number> = {},
): Record<string, string | number> {
  const resolved: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(colors)) {
    resolved[key] = resolveVarRefs(value, vars);
  }
  return resolved;
}

function splitThemeColors(resolved: Record<string, string | number>): {
  fg: Record<string, string | number>;
  bg: Record<string, string | number>;
} {
  const fg: Record<string, string | number> = {};
  const bg: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(resolved)) {
    if (BG_COLOR_KEYS.has(key)) {
      bg[key] = value;
    } else {
      fg[key] = value;
    }
  }
  return { fg, bg };
}

export function loadPresetJson(name: string): ThemeJson {
  const cached = presetCache.get(name);
  if (cached) {
    return structuredClone(cached);
  }
  const filePath = path.join(THEMES_DIR, `${name}.json`);
  const content = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(content) as ThemeJson;
  presetCache.set(name, parsed);
  return structuredClone(parsed);
}

function createThemeFromJson(json: ThemeJson): Theme {
  const resolved = resolveThemeColors(json.colors, json.vars);
  const { fg, bg } = splitThemeColors(resolved);
  return new Theme(fg, bg, "truecolor", { name: json.name });
}

// ── Runtime state ────────────────────────────────────────────────

let activeBrand = PRESETS[DEFAULT_PRESET].brand;
let activeWelcome = PRESETS[DEFAULT_PRESET].welcome;
let activePresetName: string | null = DEFAULT_PRESET;

export function getBrandHex(): string {
  return activeBrand;
}

export function getWelcomeHex(): string {
  return activeWelcome;
}

export function getActivePresetName(): string | null {
  return activePresetName;
}

export function applyPreset(name: string): void {
  const preset = PRESETS[name];
  if (!preset) return;
  activeBrand = preset.brand;
  activeWelcome = preset.welcome;
  activePresetName = name;
}

// ── Persistence (.pi/settings.json) ─────────────────────────────

export type RtkMode = "off" | "auto";

interface PiSettings {
  quietStartup?: boolean;
  gedTheme?: string;
  theme?: string;
  rtkMode?: RtkMode;
  [key: string]: unknown;
}

function settingsPath(cwd: string): string {
  return path.join(cwd, ".pi", "settings.json");
}

function readSettings(cwd: string): PiSettings {
  try {
    return JSON.parse(readFileSync(settingsPath(cwd), "utf8")) as PiSettings;
  } catch {
    return {};
  }
}

export function readPiSettings(cwd: string): PiSettings {
  return readSettings(cwd);
}

function writeSettings(cwd: string, settings: PiSettings): void {
  mkdirSync(path.join(cwd, ".pi"), { recursive: true });
  writeFileAtomicSync(
    settingsPath(cwd),
    `${JSON.stringify(settings, null, 2)}\n`,
  );
}

export async function ensurePiSettings(cwd: string): Promise<void> {
  const existing = readSettings(cwd);
  let modified = false;

  // Preserve original first-run defaults
  if (existing.quietStartup === undefined) {
    existing.quietStartup = true;
    modified = true;
  }

  // Ensure theme fallback exists for export/share (Pi core can't resolve
  // the in-memory theme we set via setThemeInstance()).
  if (!existing.theme) {
    existing.theme = "dark";
    modified = true;
  }

  if (modified) {
    await mkdir(path.join(cwd, ".pi"), { recursive: true });
    writeSettings(cwd, existing);
  }
}

export function readRtkMode(cwd: string): RtkMode {
  const saved = readSettings(cwd).rtkMode;
  return saved === "off" ? "off" : "auto";
}

export function saveRtkMode(cwd: string, mode: RtkMode): void {
  const settings = readSettings(cwd);
  writeSettings(cwd, { ...settings, rtkMode: mode });
}

/** Load the saved theme from .pi/settings.json, or fall back to default. */
export function loadSavedTheme(cwd: string): void {
  const settings = readSettings(cwd);
  const name = settings.gedTheme;
  if (typeof name === "string" && name in PRESETS) {
    applyPreset(name);
  } else {
    applyPreset(DEFAULT_PRESET);
  }
}

/** Persist the chosen preset to .pi/settings.json. */
export function saveThemeChoice(cwd: string, presetName: string): void {
  const settings = readSettings(cwd);
  writeSettings(cwd, { ...settings, gedTheme: presetName });
}

// ── ANSI helpers ─────────────────────────────────────────────────

const ANSI_RESET = "\x1b[0m";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function ansiColor(hex: string, text: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m${text}${ANSI_RESET}`;
}

export function formatGedStatus(): string {
  return ansiColor(activeBrand, "GedPi");
}

/** Wrap text in true-color ANSI foreground using the active brand color. */
export function brand(text: string): string {
  return ansiColor(activeBrand, text);
}

/** Wrap text in true-color ANSI foreground using the active welcome color. */
export function welcome(text: string): string {
  return ansiColor(activeWelcome, text);
}

// ── Theme constructor ────────────────────────────────────────────

/**
 * GedPi theme — dark base with brand accent.
 * Loads the active preset from JSON so `/theme` changes propagate.
 */
export function createGedTheme(): Theme {
  const name = activePresetName ?? DEFAULT_PRESET;
  const json = loadPresetJson(name);
  return createThemeFromJson(json);
}
