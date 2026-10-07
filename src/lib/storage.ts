import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AttachmentInput } from "./validation";

export const STORAGE_DIR = "storage";
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function attachmentKind(name: string, mime: string): AttachmentInput["kind"] {
  if (mime.startsWith("image/")) return "PHOTO";
  if (mime.startsWith("audio/")) return "AUDIO";
  return "DOCUMENT";
}

export async function saveUpload(file: File): Promise<AttachmentInput> {
  const kind = attachmentKind(file.name, file.type);
  const raw = path.basename(file.name).replace(/[^\w.\- ]+/g, "_").trim();
  const safeName = (raw || "file").slice(0, 120);
  const storedName = `${crypto.randomUUID()}-${safeName}`;
  const relative = `${STORAGE_DIR}/${storedName}`;
  await fs.mkdir(path.join(process.cwd(), STORAGE_DIR), { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(process.cwd(), STORAGE_DIR, storedName), bytes);
  return { path: relative, name: safeName, kind };
}

export function absolutePath(relative: string): string {
  const storedName = relative.slice(STORAGE_DIR.length + 1);
  return path.join(process.cwd(), STORAGE_DIR, storedName);
}

export async function removeStoredFile(relative: string | null): Promise<void> {
  if (!relative || !relative.startsWith(`${STORAGE_DIR}/`)) return;
  try {
    await fs.unlink(absolutePath(relative));
  } catch {
    // file may already be gone
  }
}
