import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const p = new PrismaClient();

async function main() {
  const mode = process.argv[2] ?? "seed";
  if (mode === "seed") {
    const chat = await p.telegramChat.upsert({
      where: { chatId: "-1001234567890" },
      create: { chatId: "-1001234567890", title: "Test Chat" },
      update: { title: "Test Chat", isActive: true },
    });
    console.log("chat id=" + chat.id);
  } else if (mode === "clean") {
    await p.sendLog.deleteMany();
    await p.reminder.deleteMany();
    await p.telegramChat.deleteMany();
    await p.setting.deleteMany({ where: { key: { in: ["botUsername"] } } });
    console.log("cleaned");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
