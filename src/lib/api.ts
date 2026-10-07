import { NextResponse } from "next/server";
import { z } from "zod";
import { formatZodError } from "./validation";

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function parseJsonBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<{ ok: true; data: z.output<S> } | { ok: false; response: NextResponse }> {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: jsonError(400, formatZodError(parsed.error)) };
  }
  return { ok: true, data: parsed.data };
}
