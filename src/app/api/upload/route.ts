import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { MAX_UPLOAD_BYTES, saveUpload } from "@/lib/storage";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return jsonError(400, "Expected multipart form data");

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError(400, "Missing file field");
  if (file.size === 0) return jsonError(400, "Empty file");
  if (file.size > MAX_UPLOAD_BYTES) return jsonError(413, "File exceeds the 50 MB limit");

  const saved = await saveUpload(file);
  return NextResponse.json(saved, { status: 201 });
}
