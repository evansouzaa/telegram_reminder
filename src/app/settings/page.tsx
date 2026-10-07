import { getSetting, getTimezone } from "@/lib/db";
import { getBotToken } from "@/lib/telegram";
import { toChatView } from "@/lib/dto";
import { db } from "@/lib/db";
import { isWorkerActive } from "@/lib/heartbeat";
import SettingsClient from "@/components/SettingsClient";



export const instant = false;

export default async function SettingsPage() {
  const [botUsername, heartbeat, chatRows] = await Promise.all([
    getSetting("botUsername"),
    getSetting("workerHeartbeat"),
    db.telegramChat.findMany({ orderBy: { linkedAt: "desc" } }),
  ]);

  return (
    <SettingsClient
      timezone={await getTimezone()}
      botConfigured={Boolean(getBotToken())}
      botUsername={botUsername}
      workerActive={isWorkerActive(heartbeat)}
      chats={chatRows.map(toChatView)}
    />
  );
}
