import { z } from "zod";
import { isValidTimeZone } from "./timezone";

export const TIME_OF_DAY_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const attachmentSchema = z.object({
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  kind: z.enum(["DOCUMENT", "PHOTO", "AUDIO"]),
});

export type AttachmentInput = z.infer<typeof attachmentSchema>;

export const reminderInputSchema = z
  .object({
    message: z.string().min(1).max(4096),
    mode: z.enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
    runAt: z.string().min(1).nullable().optional(),
    timeOfDay: z.string().regex(TIME_OF_DAY_RE, "Use HH:MM format").nullable().optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).nullable().optional(),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    monthOfYear: z.number().int().min(1).max(12).nullable().optional(),
    chatId: z.number().int().positive(),
    parseMode: z.enum(["", "HTML", "MarkdownV2"]),
    silent: z.boolean(),
    enabled: z.boolean().optional(),
    attachment: attachmentSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "ONCE") {
      if (!value.runAt) {
        ctx.addIssue({ code: "custom", path: ["runAt"], message: "runAt is required for one-time reminders" });
      } else {
        const ts = Date.parse(value.runAt);
        if (Number.isNaN(ts)) {
          ctx.addIssue({ code: "custom", path: ["runAt"], message: "runAt must be a valid date" });
        } else if (ts <= Date.now()) {
          ctx.addIssue({ code: "custom", path: ["runAt"], message: "runAt must be in the future" });
        }
      }
    } else {
      if (!value.timeOfDay) {
        ctx.addIssue({ code: "custom", path: ["timeOfDay"], message: "timeOfDay is required for recurring reminders" });
      }
      if (value.mode === "WEEKLY" && (!value.daysOfWeek || value.daysOfWeek.length === 0)) {
        ctx.addIssue({ code: "custom", path: ["daysOfWeek"], message: "Pick at least one weekday" });
      }
      if (value.mode === "MONTHLY" && !value.dayOfMonth) {
        ctx.addIssue({ code: "custom", path: ["dayOfMonth"], message: "dayOfMonth is required for monthly reminders" });
      }
      if (value.mode === "YEARLY") {
        if (!value.dayOfMonth) {
          ctx.addIssue({ code: "custom", path: ["dayOfMonth"], message: "dayOfMonth is required for yearly reminders" });
        }
        if (!value.monthOfYear) {
          ctx.addIssue({ code: "custom", path: ["monthOfYear"], message: "monthOfYear is required for yearly reminders" });
        }
      }
    }
  });

export const toggleSchema = z.object({
  enabled: z.boolean(),
});

export const settingsSchema = z.object({
  timezone: z.string().min(1).refine(isValidTimeZone, "Unknown IANA timezone"),
});

export const testSendSchema = z.object({
  chatId: z.number().int().positive().optional(),
});

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
}
