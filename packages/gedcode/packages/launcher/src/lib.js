import { chmod, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  GEDCODE_BINARY_VERSION,
  OPENCODE_VERSION_TARGET,
  getLauncherAssetName,
  getVersionedReleaseAssetUrl,
} from "./release.js";

export const MINIMUM_NODE_MAJOR = 22;
export const GEDCODE_PACKAGE_NAME = "gedcode";
export const GEDCODE_SETUP_TARGET = `${GEDCODE_PACKAGE_NAME}@latest`;

// Restrict GEDCODE_SETUP_TARGET to the gedcode package (with optional
// version specifier). Anything else — paths, tarball URLs, git URLs,
// arbitrary package names — is rejected so a tampered or accidentally
// inherited env var can't redirect `npm install -g` to a different target.
const SAFE_SETUP_TARGET = /^gedcode(?:@[A-Za-z0-9._\-+]{1,128})?$/u;

export function isSafeSetupTarget(value) {
  return typeof value === "string" && SAFE_SETUP_TARGET.test(value);
}

export function parseNodeMajorVersion(version) {
  const match = /^v?(\d+)/u.exec(String(version).trim());
  if (!match) return null;
  const major = Number.parseInt(match[1], 10);
  return Number.isFinite(major) ? major : null;
}

const SEMVER_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/u;

export function parseSemver(version) {
  const match = SEMVER_PATTERN.exec(String(version).trim());
  if (!match) return null;
  const prerelease = match[4] ? match[4].split(".") : [];
  if (prerelease.some((part) => part.length === 0)) return null;
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    prerelease,
  };
}

function comparePrereleaseIdentifier(left, right) {
  const leftNumeric = /^\d+$/u.test(left);
  const rightNumeric = /^\d+$/u.test(right);
  if (leftNumeric && rightNumeric) {
    const leftNumber = Number.parseInt(left, 10);
    const rightNumber = Number.parseInt(right, 10);
    if (leftNumber > rightNumber) return 1;
    if (leftNumber < rightNumber) return -1;
    return 0;
  }
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  return left.localeCompare(right);
}

function comparePrerelease(left, right) {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    const comparison = comparePrereleaseIdentifier(leftPart, rightPart);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

export function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return 0;
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] > b[key]) return 1;
    if (a[key] < b[key]) return -1;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

export function isSupportedNodeVersion(version, minimumMajor = MINIMUM_NODE_MAJOR) {
  const major = parseNodeMajorVersion(version);
  return major !== null && major >= minimumMajor;
}

export function getGedCodeSetupTarget() {
  const fromEnv = process.env.GEDCODE_SETUP_TARGET;
  if (fromEnv && fromEnv.length > 0) {
    if (!isSafeSetupTarget(fromEnv)) {
      throw new Error(
        `GEDCODE_SETUP_TARGET must be of the form "gedcode" or "gedcode@<version>"; refusing to use ${JSON.stringify(fromEnv)}.`,
      );
    }
    return fromEnv;
  }
  return GEDCODE_SETUP_TARGET;
}

export function getXdgConfigHome(homeDir = os.homedir()) {
  return path.join(homeDir, ".config", "gedcode");
}

export function getGedCodeDataRoot(homeDir = os.homedir(), platform = process.platform, env = process.env) {
  if (platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", "gedcode");
  }
  if (platform === "win32") {
    return path.join(env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local"), "GedCode");
  }
  return path.join(env.XDG_DATA_HOME || path.join(homeDir, ".local", "share"), "gedcode");
}

export function getManagedOpenCodeRoot(homeDir = os.homedir(), platform = process.platform, env = process.env) {
  return path.join(getGedCodeDataRoot(homeDir, platform, env), "runtimes", "opencode");
}

export function getManagedOpenCodeVersionDir(
  version = OPENCODE_VERSION_TARGET,
  homeDir = os.homedir(),
  platform = process.platform,
  env = process.env,
) {
  return path.join(getManagedOpenCodeRoot(homeDir, platform, env), version);
}

export function getManagedOpenCodeBinaryCandidates(
  version = OPENCODE_VERSION_TARGET,
  homeDir = os.homedir(),
  platform = process.platform,
  env = process.env,
) {
  const prefix = getManagedOpenCodeVersionDir(version, homeDir, platform, env);
  if (platform === "win32") {
    return [
      path.join(prefix, "opencode.cmd"),
      path.join(prefix, "bin", "opencode.cmd"),
      path.join(prefix, "bin", "opencode"),
    ];
  }

  return [path.join(prefix, "bin", "opencode")];
}

export function getManagedOpenCodeBinaryPath(
  version = OPENCODE_VERSION_TARGET,
  homeDir = os.homedir(),
  platform = process.platform,
  env = process.env,
) {
  return getManagedOpenCodeBinaryCandidates(version, homeDir, platform, env)[0];
}

export function getManagedOpenCodeMetadataPath(homeDir = os.homedir(), platform = process.platform, env = process.env) {
  return path.join(getManagedOpenCodeRoot(homeDir, platform, env), "current.json");
}

export function getManagedOpenCodeInstallArgs(
  version = OPENCODE_VERSION_TARGET,
  homeDir = os.homedir(),
  platform = process.platform,
  env = process.env,
) {
  const prefix = getManagedOpenCodeVersionDir(version, homeDir, platform, env);
  return ["install", "-g", `opencode-ai@${version}`, "--prefix", prefix];
}

export function needsManagedOpenCodeUpdate(currentVersion, requiredVersion = OPENCODE_VERSION_TARGET) {
  if (!currentVersion) return true;
  return compareSemver(currentVersion, requiredVersion) < 0;
}

export function getConfigRoot(homeDir = os.homedir()) {
  return path.join(getXdgConfigHome(homeDir), "opencode");
}

export function buildLauncherEnv(baseEnv, configPath, configRoot, homeDir = os.homedir()) {
  return {
    ...baseEnv,
    XDG_CONFIG_HOME: getXdgConfigHome(homeDir),
    OPENCODE_CONFIG: configPath,
    OPENCODE_CONFIG_DIR: configRoot,
    OPENCODE_CLIENT: "gedcode",
  };
}

export function getNativeLauncherReleaseMetadata(platform = process.platform, arch = process.arch) {
  return {
    launcherVersion: GEDCODE_BINARY_VERSION,
    opencodeVersion: OPENCODE_VERSION_TARGET,
    assetName: getLauncherAssetName(platform, arch),
    assetUrl: getVersionedReleaseAssetUrl(platform, arch, GEDCODE_BINARY_VERSION),
  };
}

function windowsPathToFileUrl(value) {
  const normalized = value.replaceAll("\\", "/");
  return `file:///${encodeURI(normalized).replace(/#/g, "%23")}`;
}

export function getPluginImportSpecifier(pluginEntry, platform = process.platform) {
  const value = String(pluginEntry);
  if (value.startsWith("file://")) return value;
  if (platform === "win32" && /^[A-Za-z]:[\\/]/u.test(value)) {
    return windowsPathToFileUrl(value);
  }
  if (path.isAbsolute(value)) {
    return pathToFileURL(value).href;
  }
  return value;
}

// Write `content` to `targetPath` atomically and refuse to follow symlinks.
// Both files we write under ~/.config/gedcode/opencode/ are in a
// user-controlled directory; we don't want a pre-planted symlink there to
// redirect the write, and we don't want a half-written file if the process
// dies mid-write. The flag "wx" creates a fresh temp file (failing if a
// stale temp lingers, which we then clean up). chmod 0o600 keeps the file
// from being world- or group-readable.
async function writeFileSecure(targetPath, content) {
  const dir = path.dirname(targetPath);
  const tmpPath = path.join(dir, `.${path.basename(targetPath)}.${crypto.randomBytes(6).toString("hex")}.tmp`);
  try {
    await writeFile(tmpPath, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
  } catch (err) {
    // If a stale tmp file with our exact name already exists (extremely
    // unlikely with 12 hex chars), clean up and surface the error.
    try {
      await unlink(tmpPath);
    } catch {
      // ignore
    }
    throw err;
  }
  try {
    await chmod(tmpPath, 0o600);
    await rename(tmpPath, targetPath);
  } catch (err) {
    try {
      await unlink(tmpPath);
    } catch {
      // ignore
    }
    throw err;
  }
}

export async function ensureGedCodeConfig({
  homeDir = os.homedir(),
  pluginEntry,
}) {
  const configRoot = getConfigRoot(homeDir);
  const pluginDir = path.join(configRoot, "plugins");
  await mkdir(pluginDir, { recursive: true });

  const pluginShimPath = path.join(pluginDir, "gedcode-plugin.js");
  const configPath = path.join(configRoot, "opencode.json");

  // Validate file:// URLs but keep the generated import as a URL. Absolute
  // filesystem paths, especially Windows drive paths, are not valid ESM module
  // specifiers in generated source.
  if (String(pluginEntry).startsWith("file://")) {
    fileURLToPath(String(pluginEntry));
  }
  const resolvedEntry = getPluginImportSpecifier(pluginEntry);

  const shimSource = `export { GedCodePlugin, default } from ${JSON.stringify(resolvedEntry)};\n`;
  await writeFileSecure(pluginShimPath, shimSource);

  const config = {
    $schema: "https://opencode.ai/config.json",
    default_agent: "gedcode",
    share: "manual",
  };
  await writeFileSecure(configPath, `${JSON.stringify(config, null, 2)}\n`);

  return { configRoot, configPath, pluginShimPath };
}
