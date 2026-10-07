export type ReminderView = {
  id: number;
  message: string;
  mode: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  runAt: string | null;
  timeOfDay: string | null;
  daysOfWeek: number[] | null;
  dayOfMonth: number | null;
  monthOfYear: number | null;
  chatId: number;
  chatTitle: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  parseMode: string;
  silent: boolean;
  retryCount: number;
  attachment: { path: string; name: string; kind: string } | null;
};

export type ChatView = {
  id: number;
  telegramChatId: string;
  title: string;
  isActive: boolean;
  linkedAt: string;
};

export type LogView = {
  id: number;
  chatId: string;
  status: "SENT" | "FAILED" | "MISSED";
  detail: string | null;
  sentAt: string;
  reminder: { id: number; message: string; mode: string } | null;
};

type ReminderRow = {
  id: number;
  message: string;
  mode: string;
  runAt: Date | null;
  timeOfDay: string | null;
  daysOfWeek: string | null;
  dayOfMonth: number | null;
  monthOfYear: number | null;
  chatId: number;
  enabled: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  parseMode: string;
  silent: boolean;
  retryCount: number;
  attachmentPath: string | null;
  attachmentName: string | null;
  attachmentKind: string | null;
  chat?: { title: string };
};

type ChatRow = {
  id: number;
  chatId: string;
  title: string;
  isActive: boolean;
  linkedAt: Date;
};

type LogRow = {
  id: number;
  chatId: string;
  status: string;
  detail: string | null;
  sentAt: Date;
  reminder: { id: number; message: string; mode: string } | null;
};

export function toReminderView(row: ReminderRow): ReminderView {
  return {
    id: row.id,
    message: row.message,
    mode: row.mode as ReminderView["mode"],
    runAt: row.runAt?.toISOString() ?? null,
    timeOfDay: row.timeOfDay,
    daysOfWeek: row.daysOfWeek ? row.daysOfWeek.split(",").filter(Boolean).map(Number) : null,
    dayOfMonth: row.dayOfMonth,
    monthOfYear: row.monthOfYear,
    chatId: row.chatId,
    chatTitle: row.chat?.title ?? "",
    enabled: row.enabled,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    parseMode: row.parseMode,
    silent: row.silent,
    retryCount: row.retryCount,
    attachment:
      row.attachmentPath && row.attachmentName && row.attachmentKind
        ? { path: row.attachmentPath, name: row.attachmentName, kind: row.attachmentKind }
        : null,
  };
}

export function toChatView(row: ChatRow): ChatView {
  return {
    id: row.id,
    telegramChatId: row.chatId,
    title: row.title,
    isActive: row.isActive,
    linkedAt: row.linkedAt.toISOString(),
  };
}

export function toLogView(row: LogRow): LogView {
  return {
    id: row.id,
    chatId: row.chatId,
    status: row.status as LogView["status"],
    detail: row.detail,
    sentAt: row.sentAt.toISOString(),
    reminder: row.reminder,
  };
}
