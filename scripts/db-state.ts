import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const p = new PrismaClient();
async function main() {
  const reminders = await p.reminder.findMany({ include: { chat: true } });
  console.log(
    JSON.stringify(
      reminders.map((r) => ({
        id: r.id,
        mode: r.mode,
        enabled: r.enabled,
        nextRunAt: r.nextRunAt,
        retryCount: r.retryCount,
        message: r.message,
        chat: r.chat.title,
      })),
      null,
      1,
    ),
  );
  const logs = await p.sendLog.findMany({ orderBy: { sentAt: "desc" }, take: 10 });
  console.log("logs=" + JSON.stringify(logs));
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
