import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preflight } from "./preflight.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const children = [];
let shuttingDown = false;

function run(name, args) {
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  child.on("error", (err) => {
    console.error(`[start] failed to launch ${name}: ${err.message}`);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.log(
      `[start] ${name} exited (${signal ? `signal ${signal}` : `code ${code}`}) - stopping the other process`
    );
    shutdown(code ?? 1);
  });
  children.push({ name, child });
  return child;
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  }
  const timer = setTimeout(() => process.exit(code), 5000);
  timer.unref();
  const check = setInterval(() => {
    if (children.every(({ child }) => child.exitCode !== null || child.signalCode !== null)) {
      clearInterval(check);
      process.exit(code);
    }
  }, 100);
  check.unref();
}

function forward(signal) {
  console.log(`\n[start] received ${signal}, shutting down...`);
  shutdown(0);
}

process.on("SIGINT", () => forward("SIGINT"));
process.on("SIGTERM", () => forward("SIGTERM"));

if (!fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
  console.error("[start] Production build not found. Run `npm run build` first.");
  process.exit(1);
}

await preflight();

run("web", [require.resolve("next/dist/bin/next"), "start"]);
run("worker", [require.resolve("tsx/cli"), path.join("src", "server", "worker.ts")]);
