#!/usr/bin/env node
// Sync the GedCode version from the root package.json into every
// downstream place that hardcodes it (workspace package.jsons, the
// release.js launcher constant, and the installers' default version).
//
// Default mode rewrites drifted files. `--check` exits non-zero on
// drift without writing — used by `npm run check` so a missed bump
// fails CI instead of shipping a release whose installer points at
// a version that doesn't exist yet.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

async function loadRootVersion() {
  const rootPkg = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  if (typeof rootPkg.version !== "string" || !/^\d+\.\d+\.\d+$/.test(rootPkg.version)) {
    throw new Error(`sync-version: root package.json must hold a semver triple, got ${JSON.stringify(rootPkg.version)}`);
  }
  return rootPkg.version;
}

const TARGETS = [
  {
    file: "packages/launcher/package.json",
    transforms: [
      { pattern: /"version"\s*:\s*"([^"]+)"/u, label: "package.json version" },
    ],
  },
  {
    file: "packages/plugin/package.json",
    transforms: [
      { pattern: /"version"\s*:\s*"([^"]+)"/u, label: "package.json version" },
    ],
  },
  {
    file: "packages/launcher/src/release.js",
    transforms: [
      { pattern: /GEDCODE_BINARY_VERSION\s*=\s*"([^"]+)"/u, label: "GEDCODE_BINARY_VERSION" },
    ],
  },
  {
    file: "install.sh",
    transforms: [
      { pattern: /GEDCODE_VERSION=(\d+\.\d+\.\d+)\s+curl/u, label: "doc-comment example" },
      { pattern: /VERSION="\$\{GEDCODE_VERSION:-(\d+\.\d+\.\d+)\}"/u, label: "VERSION default" },
    ],
  },
  {
    file: "install.ps1",
    transforms: [
      { pattern: /\$env:GEDCODE_VERSION\s*=\s*'(\d+\.\d+\.\d+)'/u, label: "doc-comment example" },
      { pattern: /\}\s*else\s*\{\s*'(\d+\.\d+\.\d+)'\s*\}/u, label: "Version default" },
    ],
  },
];

function applyTransform(text, pattern, expected, label) {
  const match = pattern.exec(text);
  if (!match) {
    throw new Error(`sync-version: pattern not found for ${label}`);
  }
  const current = match[1];
  if (current === expected) {
    return { changed: false, text };
  }
  const replaced = match[0].replace(current, expected);
  return { changed: true, text: text.replace(match[0], replaced), before: current };
}

async function run() {
  const version = await loadRootVersion();
  const drifts = [];

  for (const target of TARGETS) {
    const filePath = path.join(repoRoot, target.file);
    let text = await readFile(filePath, "utf8");
    let fileChanged = false;

    for (const transform of target.transforms) {
      const result = applyTransform(text, transform.pattern, version, `${target.file}: ${transform.label}`);
      if (result.changed) {
        fileChanged = true;
        text = result.text;
        drifts.push({ file: target.file, label: transform.label, from: result.before, to: version });
      }
    }

    if (fileChanged && !checkOnly) {
      await writeFile(filePath, text, "utf8");
    }
  }

  if (drifts.length === 0) {
    if (!checkOnly) {
      process.stdout.write(`sync-version: all targets already at ${version}\n`);
    }
    return 0;
  }

  if (checkOnly) {
    process.stderr.write(`sync-version: drift detected (root package.json is at ${version})\n`);
    for (const d of drifts) {
      process.stderr.write(`  - ${d.file}: ${d.label}: ${d.from} -> ${version}\n`);
    }
    process.stderr.write("Fix: node scripts/sync-version.mjs\n");
    return 1;
  }

  process.stdout.write(`sync-version: updated to ${version}\n`);
  for (const d of drifts) {
    process.stdout.write(`  - ${d.file}: ${d.label}: ${d.from} -> ${version}\n`);
  }
  return 0;
}

process.exit(await run());
