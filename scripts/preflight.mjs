import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ensureEnv } from "./ensure-env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

export async function preflight() {
  ensureEnv();

  const prismaBin = require.resolve("prisma/build/index.js");
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [prismaBin, "migrate", "deploy"], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`prisma migrate deploy was killed by ${signal}`));
      else if (code !== 0) {
        console.error(`[setup] prisma migrate deploy failed (exit code ${code})`);
        process.exit(code ?? 1);
      } else resolve();
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await preflight();
}
