import { addCalendarDays, daysInMonth, nextMonth, wallClockInZone, zonedTimeToUtc } from "./timezone";

export type ReminderSchedule = {
  mode: string;
  runAt: Date | null;
  timeOfDay: string | null;
  daysOfWeek: string | null;
  dayOfMonth: number | null;
  monthOfYear: number | null;
};

export const MISSED_THRESHOLD_MS = 6 * 60 * 60 * 1000;

const MAX_MONTHLY_STEPS = 24;
const MAX_YEARLY_STEPS = 5;

export function parseTimeOfDay(value: string): { hour: number; minute: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

export function parseDaysOfWeek(value: string): number[] | null {
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  const days: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 6) return null;
    if (!days.includes(n)) days.push(n);
  }
  return days.length > 0 ? days : null;
}

export function formatDaysOfWeek(value: string | null): string {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = value ? parseDaysOfWeek(value) : null;
  if (!days) return "";
  return days.sort((a, b) => a - b).map((d) => names[d]).join(", ");
}

function isValidDayOfMonth(value: number | null): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 31;
}

function isValidMonth(value: number | null): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12;
}

function computeMonthly(reminder: ReminderSchedule, tz: string, after: Date, hour: number, minute: number): Date | null {
  const dayOfMonth = reminder.dayOfMonth;
  if (!isValidDayOfMonth(dayOfMonth)) return null;
  const now = wallClockInZone(tz, after);
  let year = now.year;
  let month = now.month;
  for (let i = 0; i < MAX_MONTHLY_STEPS; i++) {
    const day = Math.min(dayOfMonth, daysInMonth(year, month));
    const candidate = zonedTimeToUtc(tz, year, month, day, hour, minute);
    if (candidate.getTime() > after.getTime()) return candidate;
    ({ year, month } = nextMonth(year, month));
  }
  return null;
}

function computeYearly(reminder: ReminderSchedule, tz: string, after: Date, hour: number, minute: number): Date | null {
  const dayOfMonth = reminder.dayOfMonth;
  const monthOfYear = reminder.monthOfYear;
  if (!isValidDayOfMonth(dayOfMonth) || !isValidMonth(monthOfYear)) return null;
  const now = wallClockInZone(tz, after);
  let year = now.year;
  for (let i = 0; i < MAX_YEARLY_STEPS; i++) {
    const day = Math.min(dayOfMonth, daysInMonth(year, monthOfYear));
    const candidate = zonedTimeToUtc(tz, year, monthOfYear, day, hour, minute);
    if (candidate.getTime() > after.getTime()) return candidate;
    year++;
  }
  return null;
}

export function computeNextRunAt(reminder: ReminderSchedule, tz: string, after: Date): Date | null {
  if (reminder.mode === "ONCE") {
    return reminder.runAt;
  }
  const time = reminder.timeOfDay ? parseTimeOfDay(reminder.timeOfDay) : null;
  if (!time) return null;

  if (reminder.mode === "MONTHLY") {
    return computeMonthly(reminder, tz, after, time.hour, time.minute);
  }
  if (reminder.mode === "YEARLY") {
    return computeYearly(reminder, tz, after, time.hour, time.minute);
  }

  let allowed: Set<number> | null = null;
  if (reminder.mode === "WEEKLY") {
    const days = reminder.daysOfWeek ? parseDaysOfWeek(reminder.daysOfWeek) : null;
    if (!days) return null;
    allowed = new Set(days);
  } else if (reminder.mode !== "DAILY") {
    return null;
  }

  const now = wallClockInZone(tz, after);
  for (let i = 0; i < 8; i++) {
    const day = addCalendarDays(now.year, now.month, now.day, i);
    if (allowed && !allowed.has(day.weekday)) continue;
    const candidate = zonedTimeToUtc(tz, day.year, day.month, day.day, time.hour, time.minute);
    if (candidate.getTime() > after.getTime()) return candidate;
  }
  return null;
}
