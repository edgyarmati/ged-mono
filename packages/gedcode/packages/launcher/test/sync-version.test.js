import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

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

test("sync-version --check reports no drift between root package.json and downstream targets", async () => {
  const script = path.join(repoRoot, "scripts", "sync-version.mjs");
  const result = await runNode([script, "--check"]);
  assert.equal(
    result.code,
    0,
    `sync-version --check failed (exit ${result.code}).\nstderr:\n${result.stderr}\nstdout:\n${result.stdout}`,
  );
});
