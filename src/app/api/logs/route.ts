import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const limitRaw = Number(new URL(req.url).searchParams.get("limit") ?? "100");
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 100;

  const logs = await db.sendLog.findMany({
    include: { reminder: { select: { id: true, message: true, mode: true } } },
    orderBy: { sentAt: "desc" },
    take: limit,
  });
  return NextResponse.json(logs);
}
