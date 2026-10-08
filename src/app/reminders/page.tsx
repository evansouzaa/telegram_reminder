import { db } from "@/lib/db";
import { toChatView, toReminderView } from "@/lib/dto";
import RemindersClient from "@/components/RemindersClient";

export const instant = false;

export default async function RemindersPage() {
  const [rows, chatRows] = await Promise.all([
    db.reminder.findMany({ include: { chat: true }, orderBy: { createdAt: "desc" } }),
    db.telegramChat.findMany({ orderBy: { linkedAt: "desc" } }),
  ]);

  return (
    <RemindersClient
      initialReminders={rows.map(toReminderView)}
      chats={chatRows.map(toChatView)}
    />
  );
}
