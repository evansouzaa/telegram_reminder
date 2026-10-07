import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const p = new PrismaClient();
async function main() {
  const settings = await p.setting.findMany();
  console.log(settings.map((s) => `${s.key}=${s.value}`).join("\n"));
  const counts = {
    reminders: await p.reminder.count(),
    chats: await p.telegramChat.count(),
    logs: await p.sendLog.count(),
  };
  console.log(JSON.stringify(counts));
  const journal = await p.$queryRawUnsafe<{ journal_mode: string }[]>("PRAGMA journal_mode");
  console.log("journal_mode=" + JSON.stringify(journal));
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
