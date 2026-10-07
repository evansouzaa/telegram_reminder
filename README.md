# Telegran Reminder

Local reminder scheduler that sends messages to Telegram through a bot you control.

- Next.js (App Router) UI + REST API
- SQLite via Prisma (`prisma/dev.db`)
- Separate worker process: Telegram long polling + reminder scheduler
- One-time, daily, weekly, monthly and yearly reminders, with optional attachment (photo/audio/document)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the environment file:

   ```bash
   copy .env.example .env
   ```

3. Create a bot with [@BotFather](https://t.me/BotFather), copy the token into `.env` as `TELEGRAM_BOT_TOKEN`.

4. Apply the database schema (skip if `prisma/dev.db` already exists):

   ```bash
   npm run db:migrate
   ```

5. Start everything (web + worker):

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

6. In Telegram, open your bot and send `/start` to link the chat. Then create reminders in the UI.

## Commands available in the bot

| Command | Description |
| --- | --- |
| `/start` | Link the chat with the app |
| `/list` | List reminders for this chat |
| `/pause` / `/resume` | Pause/resume reminders for this chat |
| `/test` | Ask the bot for a test reply |
| `/help` | Show command help |

## How scheduling works

The worker (`src/server/worker.ts`) ticks every 30 seconds, claims due reminders with an
optimistic update (so duplicates are never sent), delivers them through the Telegram Bot API
with a throttled queue, and records every attempt in the **Logs** page.

- Reminders missed by more than 6 hours while the app was closed are logged as `MISSED`
  instead of being spammed late.
- Failed sends are retried up to 5 times, one attempt every 5 minutes.
- Times are interpreted in the IANA timezone configured in **Settings**.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Next.js + worker (watch mode) |
| `npm run start` | Production: `next build` first, then this |
| `npm run worker` | Worker only |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create/apply Prisma migrations |

## Notes

- Uploaded attachments are stored in `storage/` (gitignored).
- The bot token is only read from the environment; it is never stored in the database or
  returned by the API.
- Two worker instances will conflict (Telegram returns 409 on long polling); run only one.
