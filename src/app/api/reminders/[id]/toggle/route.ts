import { NextResponse } from "next/server";
import { db, getTimezone } from "@/lib/db";
import { jsonError, parseJsonBody } from "@/lib/api";
import { computeNextRunAt, type ReminderSchedule } from "@/lib/recurrence";
import { toggleSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const reminderId = Number(id);
  if (!Number.isInteger(reminderId)) return jsonError(400, "Invalid reminder id");

  const parsed = await parseJsonBody(req, toggleSchema);
  if (!parsed.ok) return parsed.response;

  const existing = await db.reminder.findUnique({ where: { id: reminderId } });
  if (!existing) return jsonError(404, "Reminder not found");

  const enabled = parsed.data.enabled;
  let nextRunAt = existing.nextRunAt;

  if (enabled) {
    const now = new Date();
    const schedule: ReminderSchedule = {
      mode: existing.mode,
      runAt: existing.runAt,
      timeOfDay: existing.timeOfDay,
      daysOfWeek: existing.daysOfWeek,
    };
    if (schedule.mode === "ONCE") {
      if (!schedule.runAt || schedule.runAt.getTime() <= now.getTime()) {
        return jsonError(400, "This one-time reminder is in the past and cannot be re-enabled");
      }
      nextRunAt = schedule.runAt;
    } else {
      nextRunAt = computeNextRunAt(schedule, await getTimezone(), now);
      if (!nextRunAt) return jsonError(400, "Could not compute the next run time");
    }
  }

  const updated = await db.reminder.update({
    where: { id: reminderId },
    data: { enabled, nextRunAt, retryCount: 0 },
    include: { chat: true },
  });

  return NextResponse.json(updated);
}
