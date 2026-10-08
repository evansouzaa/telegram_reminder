import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function ensureEnv() {
  const envPath = path.join(ROOT, ".env");
  const examplePath = path.join(ROOT, ".env.example");

  if (fs.existsSync(envPath)) return false;
  if (!fs.existsSync(examplePath)) {
    console.error(
      `[setup] .env not found and .env.example is missing. Create a .env with DATABASE_URL and TELEGRAM_BOT_TOKEN.`
    );
    process.exit(1);
  }

  fs.copyFileSync(examplePath, envPath);
  console.log(`[setup] Created .env from .env.example`);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  ensureEnv();
}
