import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";

import {
  MINIMUM_NODE_MAJOR,
  GEDOC_SETUP_TARGET,
  buildLauncherEnv,
  compareSemver,
  ensureGedOCConfig,
  getConfigRoot,
  getManagedOpenCodeBinaryPath,
  getManagedOpenCodeInstallArgs,
  getManagedOpenCodeMetadataPath,
  getManagedOpenCodeRoot,
  getNativeLauncherReleaseMetadata,
  getGedOCDataRoot,
  getGedOCSetupTarget,
  getPluginImportSpecifier,
  getXdgConfigHome,
  isSupportedNodeVersion,
  needsManagedOpenCodeUpdate,
  parseNodeMajorVersion,
} from "../src/lib.js";
import { GEDOC_BINARY_VERSION, getRequiredOpenCodeVersion } from "../src/release.js";

async function withTempHome(run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gedoc-launcher-test-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("exit", (code) => resolve({ code, stdout, stderr }));
  });
}

test("config paths are scoped under ~/.config/gedoc", () => {
  const home = "/tmp/example-home";
  assert.equal(getXdgConfigHome(home), "/tmp/example-home/.config/gedoc");
  assert.equal(getConfigRoot(home), "/tmp/example-home/.config/gedoc/opencode");
});

test("buildLauncherEnv sets isolated GedOC env vars", () => {
  const env = buildLauncherEnv(
    { PATH: "/bin" },
    "/tmp/home/.config/gedoc/opencode/opencode.json",
    "/tmp/home/.config/gedoc/opencode",
    "/tmp/home",
  );

  assert.equal(env.PATH, "/bin");
  assert.equal(env.XDG_CONFIG_HOME, "/tmp/home/.config/gedoc");
  assert.equal(env.OPENCODE_CONFIG, "/tmp/home/.config/gedoc/opencode/opencode.json");
  assert.equal(env.OPENCODE_CONFIG_DIR, "/tmp/home/.config/gedoc/opencode");
  assert.equal(env.OPENCODE_CLIENT, "gedoc");
});

test("ensureGedOCConfig writes config and plugin shim", async () => {
  await withTempHome(async (home) => {
    const result = await ensureGedOCConfig({
      homeDir: home,
      pluginEntry: "file:///tmp/fake-plugin.js",
    });

    const config = JSON.parse(await readFile(result.configPath, "utf8"));
    const shim = await readFile(result.pluginShimPath, "utf8");

    assert.equal(result.configRoot, path.join(home, ".config", "gedoc", "opencode"));
    assert.equal(config.default_agent, "gedoc");
    assert.equal(config.share, "manual");
    assert.match(shim, /file:\/\/\/tmp\/fake-plugin\.js/);
  });
});

test("plugin shim import specifiers are ESM-safe for absolute and Windows paths", () => {
  assert.equal(getPluginImportSpecifier("file:///tmp/fake-plugin.js"), "file:///tmp/fake-plugin.js");
  assert.match(getPluginImportSpecifier("/tmp/fake plugin.js", "linux"), /^file:\/\/\/tmp\/fake%20plugin\.js$/u);
  assert.equal(
    getPluginImportSpecifier("C:\\Users\\me\\GedOC\\plugin\\index.js", "win32"),
    "file:///C:/Users/me/GedOC/plugin/index.js",
  );
});

test("launcher --check and --version do not require managed OpenCode runtime", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
  const launcherBin = path.join(repoRoot, "packages", "launcher", "bin", "gedoc.js");

  const check = await runNode([launcherBin, "--check"]);
  assert.equal(check.code, 0, `stderr:\n${check.stderr}\nstdout:\n${check.stdout}`);
  assert.match(check.stdout, /GedOC launcher OK; plugin resolved/);

  const version = await runNode([launcherBin, "--version"]);
  assert.equal(version.code, 0, `stderr:\n${version.stderr}\nstdout:\n${version.stdout}`);
  assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+$/u);
});

test("node version helpers enforce the minimum supported release", () => {
  assert.equal(parseNodeMajorVersion("v22.3.0"), 22);
  assert.equal(parseNodeMajorVersion("24.1.0"), 24);
  assert.equal(parseNodeMajorVersion("not-a-version"), null);
  assert.equal(isSupportedNodeVersion(`v${MINIMUM_NODE_MAJOR}.0.0`), true);
  assert.equal(isSupportedNodeVersion(`v${MINIMUM_NODE_MAJOR - 1}.9.9`), false);
  assert.equal(getGedOCSetupTarget(), GEDOC_SETUP_TARGET);
});

test("managed OpenCode runtime helpers resolve user-scoped paths and version checks", () => {
  const linuxHome = "/tmp/example-home";
  const linuxEnv = { XDG_DATA_HOME: "/tmp/example-data" };
  assert.equal(getGedOCDataRoot(linuxHome, "linux", linuxEnv), "/tmp/example-data/gedoc");
  assert.equal(getManagedOpenCodeRoot(linuxHome, "linux", linuxEnv), "/tmp/example-data/gedoc/runtimes/opencode");
  assert.equal(
    getManagedOpenCodeBinaryPath("1.2.3", linuxHome, "linux", linuxEnv),
    "/tmp/example-data/gedoc/runtimes/opencode/1.2.3/bin/opencode",
  );
  assert.equal(
    getManagedOpenCodeMetadataPath(linuxHome, "linux", linuxEnv),
    "/tmp/example-data/gedoc/runtimes/opencode/current.json",
  );

  const windowsHome = "C:\\Users\\me";
  const windowsEnv = { LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local" };
  assert.match(getGedOCDataRoot(windowsHome, "win32", windowsEnv), /GedOC$/);
  assert.match(getManagedOpenCodeBinaryPath("1.2.3", windowsHome, "win32", windowsEnv), /opencode\.cmd$/);

  assert.deepEqual(
    getManagedOpenCodeInstallArgs("1.2.3", linuxHome, "linux", linuxEnv),
    [
      "install",
      "-g",
      "opencode-ai@1.2.3",
      "--prefix",
      "/tmp/example-data/gedoc/runtimes/opencode/1.2.3",
    ],
  );

  assert.equal(compareSemver("1.2.3", "1.2.3"), 0);
  assert.equal(compareSemver("1.2.4", "1.2.3"), 1);
  assert.equal(compareSemver("1.2.3", "1.3.0"), -1);
  assert.equal(compareSemver("1.2.3", "1.2.3-beta.1"), 1);
  assert.equal(compareSemver("1.2.3-beta.1", "1.2.3"), -1);
  assert.equal(compareSemver("1.2.3-beta.2", "1.2.3-beta.10"), -1);
  assert.equal(compareSemver("1.2.3-beta.10", "1.2.3-beta.2"), 1);
  assert.equal(compareSemver("1.2.3-alpha.1", "1.2.3-alpha.beta"), -1);
  assert.equal(compareSemver("1.2.3+build.2", "1.2.3+build.1"), 0);
  assert.equal(needsManagedOpenCodeUpdate(null, "1.0.0"), true);
  assert.equal(needsManagedOpenCodeUpdate("1.0.0", "1.0.1"), true);
  assert.equal(needsManagedOpenCodeUpdate("1.0.1", "1.0.1"), false);
});

test("release metadata matches the generic JS bundle artifact", () => {
  const metadata = getNativeLauncherReleaseMetadata("darwin", "arm64");
  const v = GEDOC_BINARY_VERSION;
  const escaped = v.replace(/\./g, "\\.");
  assert.equal(metadata.launcherVersion, v);
  assert.match(metadata.opencodeVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(metadata.assetName, `gedoc-${v}.tar.gz`);
  assert.match(metadata.assetUrl, new RegExp(`releases/download/gedoc-v${escaped}/gedoc-${escaped}\\.tar\\.gz$`));
});

test("managed OpenCode target uses the latest tested version", () => {
  assert.equal(getRequiredOpenCodeVersion(), "1.14.30");
});

test("native installer assets and launcher package metadata are present", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
  const launcherPackage = JSON.parse(
    await readFile(path.join(repoRoot, "packages", "launcher", "package.json"), "utf8"),
  );
  const posixInstaller = await readFile(path.join(repoRoot, "install.sh"), "utf8");
  const windowsInstaller = await readFile(path.join(repoRoot, "install.ps1"), "utf8");
  const releaseWorkflow = await readFile(path.join(repoRoot, "..", "..", ".github", "workflows", "release-gedoc.yml"), "utf8");
  const bundleScript = await readFile(path.join(repoRoot, "scripts", "release", "bundle.sh"), "utf8");
  const launcherBin = await readFile(path.join(repoRoot, "packages", "launcher", "bin", "gedoc.js"), "utf8");

  assert.equal(launcherPackage.name, "@gedoc/launcher");
  assert.equal(launcherPackage.bin.gedoc, "./bin/gedoc.js");
  assert.deepEqual(launcherPackage.files, ["bin", "src"]);
  assert.match(posixInstaller, /releases\/download/);
  assert.match(windowsInstaller, /releases\/download/);
  assert.match(launcherBin, /getManagedOpenCodeBinaryCandidates/);
  assert.match(launcherBin, /getNativeLauncherReleaseMetadata/);
  assert.match(releaseWorkflow, /name: Release GedOC/);
  assert.match(releaseWorkflow, /softprops\/action-gh-release/);
  assert.match(releaseWorkflow, /packages\/gedoc\/dist\/install\.sh/);
  assert.match(releaseWorkflow, /packages\/gedoc\/dist\/install\.ps1/);
  assert.match(bundleScript, /gedoc-.*\.tar\.gz/);
  assert.match(bundleScript, /plugin/);

  await access(path.join(repoRoot, "scripts", "setup"));
  await access(path.join(repoRoot, "scripts", "release", "bundle.sh"));
  await access(path.join(repoRoot, "install.sh"));
  await access(path.join(repoRoot, "install.ps1"));
  await access(path.join(repoRoot, "docs", "release-checklist.md"));
});
