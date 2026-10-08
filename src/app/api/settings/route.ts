import { NextResponse } from "next/server";
import { deleteSetting, getSetting, setSetting } from "@/lib/db";
import { jsonError, parseJsonBody } from "@/lib/api";
import { botTokenSource, getBotToken, getMeWithToken, TelegramApiError } from "@/lib/telegram";
import { settingsSchema } from "@/lib/validation";
import { systemTimeZone } from "@/lib/timezone";

async function payload() {
  const [timezone, botUsername, botConfigured, tokenSource] = await Promise.all([
    getSetting("timezone"),
    getSetting("botUsername"),
    getBotToken(),
    botTokenSource(),
  ]);
  return {
    timezone: timezone ?? systemTimeZone(),
    timezoneIsDefault: !timezone,
    botConfigured: Boolean(botConfigured),
    botTokenSource: tokenSource,
    botUsername: botUsername ?? null,
  };
}

export async function GET() {
  return NextResponse.json(await payload());
}

export async function PUT(req: Request) {
  const parsed = await parseJsonBody(req, settingsSchema);
  if (!parsed.ok) return parsed.response;
  if (parsed.data.timezone !== undefined) {
    await setSetting("timezone", parsed.data.timezone);
  }

  if (parsed.data.botToken !== undefined) {
    const token = parsed.data.botToken.trim();
    if (!token) {
      await deleteSetting("telegram_bot_token");
      await deleteSetting("botUsername");
    } else {
      let me;
      try {
        me = await getMeWithToken(token);
      } catch (err) {
        const detail = err instanceof TelegramApiError ? err.message : "could not reach Telegram";
        return jsonError(400, `Token rejected: ${detail}`);
      }
      await setSetting("telegram_bot_token", token);
      await setSetting("botUsername", me.username ?? me.first_name);
    }
  }

  return NextResponse.json(await payload());
}
