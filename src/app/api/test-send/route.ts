import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, parseJsonBody } from "@/lib/api";
import { getBotToken, sendMessage } from "@/lib/telegram";
import { testSendSchema } from "@/lib/validation";

export async function POST(req: Request) {
  if (!(await getBotToken())) return jsonError(400, "Telegram bot token is not configured - add it in Settings");

  const parsed = await parseJsonBody(req, testSendSchema);
  if (!parsed.ok) return parsed.response;

  let chat = null;
  if (parsed.data.chatId !== undefined) {
    chat = await db.telegramChat.findUnique({ where: { id: parsed.data.chatId } });
    if (!chat) return jsonError(404, "Linked chat not found");
  } else {
    chat = await db.telegramChat.findFirst({ where: { isActive: true }, orderBy: { linkedAt: "desc" } });
    if (!chat) return jsonError(404, "No linked chat yet - link one in Settings or send /start to the bot");
  }

  await sendMessage({ chatId: chat.chatId, text: "Test message from Telegram Reminder." });
  return NextResponse.json({ ok: true, chatId: chat.id });
}
