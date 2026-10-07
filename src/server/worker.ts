import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { db, ensureWal, getTimezone, setSetting } from "../lib/db";
import { computeNextRunAt, MISSED_THRESHOLD_MS } from "../lib/recurrence";
import {
  getBotToken,
  getMe,
  sendAttachment,
  sendMessage,
} from "../lib/telegram";
import type { Reminder, TelegramChat } from "../generated/prisma/client";
import { runCommandLoop } from "./commands";

const TICK_MS = 30_000;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const MAX_RETRIES = 5;

let stopped = false;

function log(message: string): void {
  console.log(`[worker ${new Date().toISOString()}] ${message}`);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function deliver(reminder: Reminder, chat: TelegramChat): Promise<void> {
  const parseMode = reminder.parseMode || undefined;
  if (reminder.attachmentPath && reminder.attachmentKind && reminder.attachmentName) {
    const abs = path.resolve(process.cwd(), reminder.attachmentPath);
    if (!fs.existsSync(abs)) {
      throw new Error(`attachment file not found: ${reminder.attachmentPath}`);
    }
    const buffer = fs.readFileSync(abs);
    await sendAttachment({
      chatId: chat.chatId,
      kind: reminder.attachmentKind as "DOCUMENT" | "PHOTO" | "AUDIO",
      filename: reminder.attachmentName,
      buffer,
      caption: reminder.message,
      parseMode,
      silent: reminder.silent,
    });
    return;
  }
  await sendMessage({
    chatId: chat.chatId,
    text: reminder.message,
    parseMode,
    silent: reminder.silent,
  });
}

async function logSend(reminder: Reminder, chat: TelegramChat, status: "SENT" | "FAILED" | "MISSED", detail: string | null): Promise<void> {
  await db.sendLog.create({
    data: { reminderId: reminder.id, chatId: chat.chatId, status, detail },
  });
}

async function handleDueReminder(reminder: Reminder, chat: TelegramChat, now: Date): Promise<void> {
  const lagMs = now.getTime() - (reminder.nextRunAt?.getTime() ?? now.getTime());

  if (lagMs > MISSED_THRESHOLD_MS) {
    await logSend(reminder, chat, "MISSED", `missed by ${Math.round(lagMs / 3_600_000)}h while app was closed`);
    return;
  }

  if (!getBotToken()) {
    await logSend(reminder, chat, "FAILED", "TELEGRAM_BOT_TOKEN is not configured");
    return;
  }

  try {
    await deliver(reminder, chat);
    await logSend(reminder, chat, "SENT", null);
    if (reminder.retryCount !== 0) {
      await db.reminder.update({ where: { id: reminder.id }, data: { retryCount: 0 } });
    }
    log(`sent reminder ${reminder.id} to ${chat.title}`);
  } catch (err) {
    const retries = reminder.retryCount + 1;
    const detail = errorMessage(err);
    await logSend(reminder, chat, "FAILED", detail);
    log(`failed to send reminder ${reminder.id}: ${detail}`);

    if (retries < MAX_RETRIES) {
      await db.reminder.update({
        where: { id: reminder.id },
        data: {
          enabled: true,
          retryCount: retries,
          nextRunAt: new Date(now.getTime() + RETRY_DELAY_MS),
        },
      });
    } else {
      log(`reminder ${reminder.id} disabled after ${retries} failed attempts`);
    }
  }
}

async function schedulerTick(): Promise<void> {
  try {
    const now = new Date();
    await setSetting("workerHeartbeat", now.toISOString());

    const tz = await getTimezone();
    const due = await db.reminder.findMany({
      where: { enabled: true, nextRunAt: { not: null, lte: now } },
      include: { chat: true },
      orderBy: { nextRunAt: "asc" },
    });

    for (const reminder of due) {
      if (!getBotToken()) break;
      const claimed = await db.reminder.updateMany({
        where: { id: reminder.id, enabled: true, nextRunAt: reminder.nextRunAt },
        data: {
          nextRunAt: computeNextRunAt(reminder, tz, now),
          lastRunAt: now,
          ...(reminder.mode === "ONCE" ? { enabled: false } : {}),
        },
      });
      if (claimed.count === 0) continue;
      await handleDueReminder(reminder, reminder.chat, now);
    }
  } catch (err) {
    log(`scheduler error: ${errorMessage(err)}`);
  }
}

async function initializeBot(): Promise<void> {
  if (!getBotToken()) {
    log("TELEGRAM_BOT_TOKEN is not set - polling and sending are disabled. Add it to .env and restart.");
    return;
  }
  try {
    const me = await getMe();
    await setSetting("botUsername", me.username ?? me.first_name);
    log(`connected as @${me.username ?? me.first_name}`);
  } catch (err) {
    log(`getMe failed: ${errorMessage(err)}`);
  }
}

async function main(): Promise<void> {
  await ensureWal();
  log("worker started");
  await initializeBot();

  let ticking = false;
  const timer = setInterval(() => {
    if (ticking) return;
    ticking = true;
    void schedulerTick().finally(() => {
      ticking = false;
    });
  }, TICK_MS);

  void schedulerTick();

  const shutdown = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    log("worker stopping");
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  if (getBotToken()) {
    await runCommandLoop(() => stopped);
  } else {
    await new Promise(() => undefined);
  }
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
