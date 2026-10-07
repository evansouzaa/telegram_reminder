-- CreateTable
CREATE TABLE "TelegramChat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chatId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "message" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "runAt" DATETIME,
    "timeOfDay" TEXT,
    "daysOfWeek" TEXT,
    "chatId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
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

-- CreateTable
CREATE TABLE "SendLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reminderId" INTEGER,
    "chatId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SendLog_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramChat_chatId_key" ON "TelegramChat"("chatId");

-- CreateIndex
CREATE INDEX "Reminder_enabled_nextRunAt_idx" ON "Reminder"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "SendLog_sentAt_idx" ON "SendLog"("sentAt");
