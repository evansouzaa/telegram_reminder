import { NextResponse } from "next/server";
import { db, getTimezone } from "@/lib/db";
import { jsonError, parseJsonBody } from "@/lib/api";
import { computeNextRunAt, type ReminderSchedule } from "@/lib/recurrence";
import { removeStoredFile } from "@/lib/storage";
import { reminderInputSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const reminderId = Number(id);
  if (!Number.isInteger(reminderId)) return jsonError(400, "Invalid reminder id");

  const existing = await db.reminder.findUnique({ where: { id: reminderId } });
  if (!existing) return jsonError(404, "Reminder not found");

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

  const attachmentPath = data.attachment === undefined ? existing.attachmentPath : data.attachment?.path ?? null;
  const attachmentKind = data.attachment === undefined ? existing.attachmentKind : data.attachment?.kind ?? null;
  const attachmentName = data.attachment === undefined ? existing.attachmentName : data.attachment?.name ?? null;
  const replacedAttachment = existing.attachmentPath && existing.attachmentPath !== attachmentPath;

  const updated = await db.reminder.update({
    where: { id: reminderId },
    data: {
      message: data.message,
      mode: data.mode,
      runAt: schedule.runAt,
      timeOfDay: schedule.timeOfDay,
      daysOfWeek: schedule.daysOfWeek,
      chatId: chat.id,
      enabled,
      nextRunAt,
      retryCount: 0,
      parseMode: data.parseMode,
      silent: data.silent,
      attachmentPath,
      attachmentKind,
      attachmentName,
    },
    include: { chat: true },
  });

  if (replacedAttachment) {
    const stillUsed = await db.reminder.count({ where: { attachmentPath: existing.attachmentPath } });
    if (stillUsed === 0) await removeStoredFile(existing.attachmentPath);
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const reminderId = Number(id);
  if (!Number.isInteger(reminderId)) return jsonError(400, "Invalid reminder id");

  const existing = await db.reminder.findUnique({ where: { id: reminderId } });
  if (!existing) return jsonError(404, "Reminder not found");

  await db.reminder.delete({ where: { id: reminderId } });

  if (existing.attachmentPath) {
    const stillUsed = await db.reminder.count({ where: { attachmentPath: existing.attachmentPath } });
    if (stillUsed === 0) await removeStoredFile(existing.attachmentPath);
  }

  return NextResponse.json({ ok: true });
}
