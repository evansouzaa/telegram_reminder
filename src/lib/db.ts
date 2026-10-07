import "dotenv/config";
import path from "node:path";
import { PrismaClient } from "../generated/prisma/client";

function absoluteDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return undefined;
  const match = /^file:(.+)$/.exec(raw);
  if (!match) return raw;
  const target = match[1];
  if (path.isAbsolute(target)) return raw;
  return `file:${path.resolve(process.cwd(), "prisma", target)}`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: absoluteDatabaseUrl() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

let walPromise: Promise<void> | null = null;

export function ensureWal(): Promise<void> {
  walPromise ??= db.$executeRawUnsafe("PRAGMA journal_mode=WAL;")
    .then(() => undefined)
    .catch(() => undefined);
  return walPromise;
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export async function getTimezone(): Promise<string> {
  const saved = await getSetting("timezone");
  if (saved) return saved;
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
