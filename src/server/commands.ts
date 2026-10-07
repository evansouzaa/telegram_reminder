import { db } from "../lib/db";
import { formatDaysOfWeek } from "../lib/recurrence";
import { chatDisplayName, getUpdates, sendMessage, TelegramApiError, type TelegramUpdate } from "../lib/telegram";

const HELP_TEXT = [
  "Commands:",
  "/start - link this chat with the app",
  "/list - show your active reminders",
  "/pause - pause all reminders for this chat",
  "/resume - resume paused reminders",
  "/test - send a test message",
  "/help - show this help",
].join("\n");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scheduleLabel(r: {
  mode: string;
  runAt: Date | null;
  timeOfDay: string | null;
  daysOfWeek: string | null;
  dayOfMonth: number | null;
  monthOfYear: number | null;
}): string {
  if (r.mode === "ONCE") return r.runAt ? r.runAt.toLocaleString() : "-";
  if (r.mode === "WEEKLY") return `${r.timeOfDay ?? "-"} (${formatDaysOfWeek(r.daysOfWeek)})`;
  if (r.mode === "MONTHLY") return `${r.timeOfDay ?? "-"} (day ${r.dayOfMonth ?? "?"} each month)`;
  if (r.mode === "YEARLY") {
    const month = r.monthOfYear ? String(r.monthOfYear).padStart(2, "0") : "?";
    return `${r.timeOfDay ?? "-"} (${month}/${r.dayOfMonth ?? "?"})`;
  }
  return r.timeOfDay ?? "-";
}

export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const msg = update.message;
  if (!msg?.text) return;

  const text = msg.text.trim();
  if (!text.startsWith("/")) return;

  const command = text.split(/\s+/)[0].split("@")[0].toLowerCase();
  const chatId = String(msg.chat.id);
  const title = chatDisplayName(msg.chat);

  switch (command) {
    case "/start": {
      const chat = await db.telegramChat.upsert({
        where: { chatId },
        create: { chatId, title },
        update: { title, isActive: true },
      });
      await sendMessage({
        chatId,
        text: `Linked "${title}" to Telegran Reminder (id ${chat.id}).\n\n${HELP_TEXT}`,
      });
      return;
    }
    case "/help": {
      await sendMessage({ chatId, text: HELP_TEXT });
      return;
    }
    case "/test": {
      await sendMessage({ chatId, text: "Test message from Telegran Reminder. This chat is linked." });
      return;
    }
    case "/list": {
      const chat = await db.telegramChat.findUnique({ where: { chatId } });
      if (!chat) {
        await sendMessage({ chatId, text: "This chat is not linked yet. Send /start first." });
        return;
      }
      const reminders = await db.reminder.findMany({
        where: { chatId: chat.id },
        orderBy: { nextRunAt: "asc" },
        take: 20,
      });
      if (reminders.length === 0) {
        await sendMessage({ chatId, text: "No reminders for this chat." });
        return;
      }
      const lines = reminders.map((r, i) => {
        const state = r.enabled ? "on" : "paused";
        const preview = r.message.length > 40 ? `${r.message.slice(0, 40)}...` : r.message;
        const next = r.enabled && r.nextRunAt ? `next ${r.nextRunAt.toLocaleString()}` : "no next run";
        return `${i + 1}. [${state}] ${scheduleLabel(r)} - ${next} - ${preview}`;
      });
      await sendMessage({ chatId, text: lines.join("\n") });
      return;
    }
    case "/pause":
    case "/resume": {
      const chat = await db.telegramChat.findUnique({ where: { chatId } });
      if (!chat) {
        await sendMessage({ chatId, text: "This chat is not linked yet. Send /start first." });
        return;
      }
      const enabled = command === "/resume";
      const res = await db.reminder.updateMany({
        where: { chatId: chat.id, enabled: !enabled },
        data: { enabled, retryCount: 0 },
      });
      await sendMessage({ chatId, text: `${enabled ? "Resumed" : "Paused"} ${res.count} reminder(s).` });
      return;
    }
    default:
      return;
  }
}

export async function runCommandLoop(isStopped: () => boolean): Promise<void> {
  let offset = 0;
  let conflictWarned = false;

  while (!isStopped()) {
    try {
      const updates = await getUpdates(offset, 30);
      conflictWarned = false;
      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);
        try {
          await handleUpdate(update);
        } catch (err) {
          console.error(`[worker] failed to handle update ${update.update_id}:`, err);
        }
      }
    } catch (err) {
      const te = err instanceof TelegramApiError ? err : null;
      if (te?.code === 409) {
        if (!conflictWarned) {
          console.log("[worker] polling conflict (409): another instance is already polling this bot");
          conflictWarned = true;
        }
      } else {
        console.error("[worker] polling error:", err instanceof Error ? err.message : err);
      }
      await sleep(5000);
    }
  }
}
