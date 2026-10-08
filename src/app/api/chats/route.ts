import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toChatView } from "@/lib/dto";
import { jsonError, parseJsonBody } from "@/lib/api";
import { chatDisplayName, getBotToken, getChatWithToken, TelegramApiError } from "@/lib/telegram";
import { linkChatSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const token = await getBotToken();
  if (!token) return jsonError(400, "Configure the bot token first");

  const parsed = await parseJsonBody(req, linkChatSchema);
  if (!parsed.ok) return parsed.response;

  const chatId = parsed.data.telegramChatId;
  let title: string;
  try {
    const info = await getChatWithToken(token, chatId);
    title = chatDisplayName(info);
  } catch (err) {
    const detail = err instanceof TelegramApiError ? err.message : "could not reach Telegram";
    return jsonError(400, `Chat not found: ${detail}`);
  }

  const chat = await db.telegramChat.upsert({
    where: { chatId },
    create: { chatId, title },
    update: { title, isActive: true },
  });
  return NextResponse.json({ chat: toChatView(chat) });
}
