# Telegram Reminder

Local reminder scheduler that sends messages to Telegram through a bot you control.

- Next.js (App Router) UI + REST API
- SQLite via Prisma (`prisma/dev.db`)
- Separate worker process: Telegram long polling + reminder scheduler
- One-time, daily, weekly, monthly and yearly reminders, with optional attachment (photo/audio/document)

## Requirements

- Node.js `>= 20.9.0` (npm ships with it) - no other runtime or global tool is required.

## Setup (any computer)

1. Install dependencies (also creates `.env` from `.env.example` and generates the Prisma client):

   ```bash
   npm install
   ```

2. Start in development mode (web + worker):

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

3. Create a bot with [@BotFather](https://t.me/BotFather), then open **Settings** in the app and
   paste the bot token - it is validated against Telegram (`getMe`) before it is saved, and the
   bot username appears right away. Alternatively, set `TELEGRAM_BOT_TOKEN` in `.env` (the
   environment variable always takes precedence over the token saved in the app).

4. Link a chat, using either option:
   - In Telegram, open your bot and send `/start`; or
   - In **Settings → Linked chats**, type the numeric chat id directly (ask
     [@userinfobot](https://t.me/userinfobot) for it - send the bot any message first so it can
     see the chat).

Then create reminders in the UI and use **Send a test message** in Settings to confirm delivery.

## Production: build and start

Everything below works on any machine with Node.js - no global installs needed.

```bash
npm install   # once per machine
npm run build # ensure-env + prisma generate + next build
npm start     # apply pending migrations, then run web + worker together
```

- `npm start` runs `scripts/start.mjs`, a dependency-free launcher that starts `next start` and
  the worker (`tsx src/server/worker.ts`) in one terminal. If either process exits, the other is
  stopped and the launcher exits with its code; `Ctrl+C` shuts both down.
- The database schema is applied automatically (`prisma migrate deploy`), so a fresh clone works
  with just the three commands above. `DATABASE_URL` defaults to `file:./dev.db`
  (`prisma/dev.db`).
- The web server listens on port `3000` by default; override with `PORT`, e.g.
  `PORT=4000 npm start` (Windows: `set PORT=4000 && npm start`).

## Running with PM2

`ecosystem.config.js` defines two managed apps - `telegram-reminder-web` (`next start`) and
`telegram-reminder-worker` - with auto-restart. PM2 is included as a dev dependency, so after
`npm install`:

```bash
npm run build      # build once first
npm run pm2:start  # apply migrations, then start web + worker under PM2
```

| Script | Description |
| --- | --- |
| `npm run pm2:start` | Start both apps (runs the migration preflight first) |
| `npm run pm2:stop` | Stop both apps |
| `npm run pm2:restart` | Restart both apps |
| `npm run pm2:delete` | Remove both apps from PM2 |
| `npm run pm2:logs` | Follow logs (`pm2 logs telegram-reminder-web` for one app) |
| `npm run pm2:save` | Persist the process list so `pm2 resurrect` restores it |

To survive reboots: `npm i -g pm2` (or use the local one via `npx pm2`), then
`pm2 startup` (follow its printed instructions), `npm run pm2:start` and `npm run pm2:save`.
The web app respects the `PORT` env var (`PORT=4000 npm run pm2:start`).

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
| `npm run build` | Production build (works on a fresh clone) |
| `npm run start` | Production: web + worker together, with migration preflight |
| `npm run worker` | Worker only (dev) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create/apply Prisma migrations (dev) |
| `npm run db:deploy` | Apply pending migrations (production-safe) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run pm2:start` / `:stop` / `:restart` / `:delete` / `:logs` / `:save` | Manage web + worker under PM2 |

## Notes

- Uploaded attachments are stored in `storage/` (gitignored).
- The bot token can be saved in the app (**Settings**) or via the `TELEGRAM_BOT_TOKEN`
  environment variable, which takes precedence. The API validates a new token with Telegram
  before saving it and never returns the stored token (only its source).
- Two worker instances will conflict (Telegram returns 409 on long polling); run only one.
