import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";
import { parseJsonBody } from "@/lib/api";
import { getBotToken } from "@/lib/telegram";
import { settingsSchema } from "@/lib/validation";
import { systemTimeZone } from "@/lib/timezone";

async function payload() {
  const [timezone, botUsername] = await Promise.all([
    getSetting("timezone"),
    getSetting("botUsername"),
  ]);
  return {
    timezone: timezone ?? systemTimeZone(),
    timezoneIsDefault: !timezone,
    botConfigured: Boolean(getBotToken()),
    botUsername: botUsername ?? null,
  };
}

export async function GET() {
  return NextResponse.json(await payload());
}

export async function PUT(req: Request) {
  const parsed = await parseJsonBody(req, settingsSchema);
  if (!parsed.ok) return parsed.response;
  await setSetting("timezone", parsed.data.timezone);
  return NextResponse.json(await payload());
}
