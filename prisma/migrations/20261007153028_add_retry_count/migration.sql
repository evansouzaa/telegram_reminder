-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Reminder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "message" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "runAt" DATETIME,
    "timeOfDay" TEXT,
    "daysOfWeek" TEXT,
    "chatId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" DATETIME,
    "lastRunAt" DATETIME,
    "parseMode" TEXT NOT NULL DEFAULT '',
    "silent" BOOLEAN NOT NULL DEFAULT false,
    "attachmentPath" TEXT,
    "attachmentKind" TEXT,
    "attachmentName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reminder_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "TelegramChat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Reminder" ("attachmentKind", "attachmentName", "attachmentPath", "chatId", "createdAt", "daysOfWeek", "enabled", "id", "lastRunAt", "message", "mode", "nextRunAt", "parseMode", "runAt", "silent", "timeOfDay", "updatedAt") SELECT "attachmentKind", "attachmentName", "attachmentPath", "chatId", "createdAt", "daysOfWeek", "enabled", "id", "lastRunAt", "message", "mode", "nextRunAt", "parseMode", "runAt", "silent", "timeOfDay", "updatedAt" FROM "Reminder";
DROP TABLE "Reminder";
ALTER TABLE "new_Reminder" RENAME TO "Reminder";
CREATE INDEX "Reminder_enabled_nextRunAt_idx" ON "Reminder"("enabled", "nextRunAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
