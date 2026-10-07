import { NextResponse } from "next/server";
import { db, getTimezone } from "@/lib/db";
import { jsonError, parseJsonBody } from "@/lib/api";
import { computeNextRunAt } from "@/lib/recurrence";
import { reminderInputSchema } from "@/lib/validation";
import type { ReminderSchedule } from "@/lib/recurrence";

export async function GET() {
  const reminders = await db.reminder.findMany({
    include: { chat: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(reminders);
}

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, reminderInputSchema);
  if (!parsed.ok) return parsed.response;

  const data = parsed.data;
  const chat = await db.telegramChat.findUnique({ where: { id: data.chatId } });
  if (!chat) return jsonError(404, "Linked chat not found");
  if (!chat.isActive) return jsonError(400, "Chat is deactivated");

  const tz = await getTimezone();
  const schedule: ReminderSchedule = {
    mode: data.mode,
    runAt: data.runAt ? new Date(data.runAt) : null,
    timeOfDay: data.timeOfDay ?? null,
    daysOfWeek: data.daysOfWeek ? data.daysOfWeek.join(",") : null,
  };
  const enabled = data.enabled ?? true;
  const nextRunAt = enabled ? computeNextRunAt(schedule, tz, new Date()) : null;
  if (enabled && !nextRunAt) return jsonError(400, "Could not compute the next run time");

  const created = await db.reminder.create({
    data: {
      message: data.message,
      mode: data.mode,
      runAt: schedule.runAt,
      timeOfDay: schedule.timeOfDay,
      daysOfWeek: schedule.daysOfWeek,
      chatId: chat.id,
      enabled,
      nextRunAt,
      parseMode: data.parseMode,
      silent: data.silent,
      attachmentPath: data.attachment?.path ?? null,
      attachmentKind: data.attachment?.kind ?? null,
      attachmentName: data.attachment?.name ?? null,
    },
    include: { chat: true },
  });

  return NextResponse.json(created, { status: 201 });
}
