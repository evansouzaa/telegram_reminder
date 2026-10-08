import { getSetting } from "./db";

const API_BASE = "https://api.telegram.org/bot";
const MIN_SEND_GAP_MS = 400;
const MAX_ATTEMPTS = 3;

export type TelegramChatInfo = {
  id: number;
  type: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
};

export type TelegramMessage = {
  message_id: number;
  chat: TelegramChatInfo;
  from?: TelegramUser;
  date: number;
  text?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

export type SendOptions = {
  chatId: string;
  text: string;
  parseMode?: string;
  silent?: boolean;
};

export type AttachmentPayload = {
  chatId: string;
  kind: "DOCUMENT" | "PHOTO" | "AUDIO";
  filename: string;
  buffer: Buffer;
  caption?: string;
  parseMode?: string;
  silent?: boolean;
};

export class TelegramApiError extends Error {
  readonly code: number;
  readonly retryAfterSec?: number;

  constructor(message: string, code: number, retryAfterSec?: number) {
    super(message);
    this.name = "TelegramApiError";
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

export type BotTokenSource = "env" | "database" | null;

export async function getBotToken(): Promise<string | null> {
  const fromEnv = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const fromDb = (await getSetting("telegram_bot_token"))?.trim();
  return fromDb ? fromDb : null;
}

export async function botTokenSource(): Promise<BotTokenSource> {
  if (process.env.TELEGRAM_BOT_TOKEN?.trim()) return "env";
  const fromDb = (await getSetting("telegram_bot_token"))?.trim();
  return fromDb ? "database" : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastSendAt = 0;
let chain: Promise<unknown> = Promise.resolve();

function throttle(): Promise<void> {
  const wait = Math.max(0, lastSendAt + MIN_SEND_GAP_MS - Date.now());
  lastSendAt = Date.now() + wait;
  return sleep(wait);
}

export function enqueueSend<T>(fn: () => Promise<T>): Promise<T> {
  const task = chain.then(async () => {
    await throttle();
    return fn();
  });
  chain = task.catch(() => undefined);
  return task;
}

async function readResult(res: Response): Promise<unknown> {
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.ok !== true) {
    const description = body?.description ?? `HTTP ${res.status}`;
    const code = body?.error_code ?? res.status;
    const retryAfter = body?.parameters?.retry_after;
    throw new TelegramApiError(String(description), Number(code), typeof retryAfter === "number" ? retryAfter : undefined);
  }
  return body.result;
}

async function callApiWithToken(token: string, method: string, payload: Record<string, unknown>): Promise<unknown> {
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      const res = await fetch(`${API_BASE}${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(40_000),
      });
      return await readResult(res);
    } catch (err) {
      const te = err instanceof TelegramApiError ? err : null;
      const retryable = te ? te.code === 429 || te.code >= 500 : true;
      if (attempt >= MAX_ATTEMPTS || !retryable) throw err;
      const delayMs = te?.retryAfterSec ? te.retryAfterSec * 1000 : 1000 * 2 ** (attempt - 1);
      await sleep(delayMs);
    }
  }
}

async function callApi(method: string, payload: Record<string, unknown>): Promise<unknown> {
  const token = await getBotToken();
  if (!token) throw new TelegramApiError("Telegram bot token is not configured", 0);
  return callApiWithToken(token, method, payload);
}

async function callMultipart(method: string, payload: Record<string, unknown>, fileField: string, attachment: AttachmentPayload): Promise<unknown> {
  const token = await getBotToken();
  if (!token) throw new TelegramApiError("Telegram bot token is not configured", 0);

  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      const form = new FormData();
      for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined && value !== null) form.append(key, String(value));
      }
      const blobPart = new Blob([new Uint8Array(attachment.buffer)]);
      form.append(fileField, blobPart, attachment.filename);
      const res = await fetch(`${API_BASE}${token}/${method}`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
      return await readResult(res);
    } catch (err) {
      const te = err instanceof TelegramApiError ? err : null;
      const retryable = te ? te.code === 429 || te.code >= 500 : true;
      if (attempt >= MAX_ATTEMPTS || !retryable) throw err;
      const delayMs = te?.retryAfterSec ? te.retryAfterSec * 1000 : 1000 * 2 ** (attempt - 1);
      await sleep(delayMs);
    }
  }
}

export async function getMe(): Promise<TelegramUser> {
  return (await callApi("getMe", {})) as TelegramUser;
}

export async function getMeWithToken(token: string): Promise<TelegramUser> {
  return (await callApiWithToken(token, "getMe", {})) as TelegramUser;
}

export async function getChatWithToken(token: string, chatId: string): Promise<TelegramChatInfo> {
  return (await callApiWithToken(token, "getChat", { chat_id: chatId })) as TelegramChatInfo;
}

export async function getUpdates(offset: number, timeoutSec: number): Promise<TelegramUpdate[]> {
  const token = await getBotToken();
  if (!token) throw new TelegramApiError("Telegram bot token is not configured", 0);
  const res = await fetch(
    `${API_BASE}${token}/getUpdates?offset=${offset}&timeout=${timeoutSec}&allowed_updates=${encodeURIComponent('["message"]')}`,
    { signal: AbortSignal.timeout((timeoutSec + 10) * 1000) },
  );
  return (await readResult(res)) as TelegramUpdate[];
}

export async function sendMessage(options: SendOptions): Promise<TelegramMessage> {
  const payload: Record<string, unknown> = {
    chat_id: options.chatId,
    text: options.text,
    disable_web_page_preview: true,
  };
  if (options.parseMode) payload.parse_mode = options.parseMode;
  if (options.silent) payload.disable_notification = true;
  return (await enqueueSend(() => callApi("sendMessage", payload))) as TelegramMessage;
}

export async function sendAttachment(options: AttachmentPayload): Promise<TelegramMessage> {
  const payload: Record<string, unknown> = {
    chat_id: options.chatId,
  };
  if (options.caption) payload.caption = options.caption;
  if (options.parseMode) payload.parse_mode = options.parseMode;
  if (options.silent) payload.disable_notification = true;

  const method =
    options.kind === "PHOTO" ? "sendPhoto" : options.kind === "AUDIO" ? "sendAudio" : "sendDocument";
  const field = options.kind === "PHOTO" ? "photo" : options.kind === "AUDIO" ? "audio" : "document";
  return (await enqueueSend(() => callMultipart(method, payload, field, options))) as TelegramMessage;
}

export function chatDisplayName(chat: TelegramChatInfo): string {
  if (chat.title) return chat.title;
  const name = [chat.first_name, chat.last_name].filter(Boolean).join(" ");
  if (name) return name;
  return chat.username ? `@${chat.username}` : String(chat.id);
}
