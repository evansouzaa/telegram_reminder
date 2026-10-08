"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChatView } from "@/lib/dto";

function SendPlaneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

export default function SettingsClient({
  timezone,
  botConfigured,
  botTokenSource,
  botUsername,
  workerActive,
  chats,
}: {
  timezone: string;
  botConfigured: boolean;
  botTokenSource: "env" | "database" | null;
  botUsername: string | null;
  workerActive: boolean;
  chats: ChatView[];
}) {
  const router = useRouter();
  const [tz, setTz] = useState(timezone);
  const [tzError, setTzError] = useState<string | null>(null);
  const [tzSaved, setTzSaved] = useState(false);
  const [token, setToken] = useState("");
  const [tokenState, setTokenState] = useState<{ ok: boolean; message: string } | null>(null);
  const [linkChatId, setLinkChatId] = useState("");
  const [linkState, setLinkState] = useState<{ ok: boolean; message: string } | null>(null);
  const [testChatId, setTestChatId] = useState<number | "">(chats[0]?.id ?? "");
  const [testState, setTestState] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveTimezone(event: React.FormEvent) {
    event.preventDefault();
    setTzError(null);
    setTzSaved(false);
    setBusy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: tz.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setTzError(body?.error ?? "Save failed");
        return;
      }
      setTz(body.timezone);
      setTzSaved(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveToken(event: React.FormEvent) {
    event.preventDefault();
    setTokenState(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: token.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setTokenState({ ok: false, message: body?.error ?? "Save failed" });
        return;
      }
      setToken("");
      setTokenState({
        ok: true,
        message: body.botUsername ? `Token saved - connected as @${body.botUsername}` : "Token saved",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function clearToken() {
    setTokenState(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: "" }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setTokenState({ ok: false, message: body?.error ?? "Remove failed" });
        return;
      }
      setTokenState({ ok: true, message: "Saved token removed" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function linkChat(event: React.FormEvent) {
    event.preventDefault();
    setLinkState(null);
    setBusy(true);
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramChatId: linkChatId.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setLinkState({ ok: false, message: body?.error ?? "Link failed" });
        return;
      }
      setLinkChatId("");
      setLinkState({ ok: true, message: `Chat "${body.chat.title}" linked` });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setTestState(null);
    setBusy(true);
    try {
      const res = await fetch("/api/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testChatId === "" ? {} : { chatId: testChatId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setTestState({ ok: false, message: body?.error ?? "Send failed" });
        return;
      }
      setTestState({ ok: true, message: "Test message sent" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Bot connection, timezone and chats</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Telegram bot</h2>
          <dl>
            <div className="kv">
              <dt>Status</dt>
              <dd>
                {botConfigured ? (
                  <span className="badge badge-on">token configured</span>
                ) : (
                  <span className="badge badge-failed">no token</span>
                )}
              </dd>
            </div>
            <div className="kv">
              <dt>Token source</dt>
              <dd>
                {botTokenSource === "env"
                  ? "environment (.env)"
                  : botTokenSource === "database"
                    ? "saved in app"
                    : "none"}
              </dd>
            </div>
            <div className="kv">
              <dt>Bot</dt>
              <dd>{botUsername ? `@${botUsername}` : "unknown yet"}</dd>
            </div>
            <div className="kv">
              <dt>Worker</dt>
              <dd>
                {workerActive ? (
                  <span className="badge badge-on">running</span>
                ) : (
                  <span className="badge badge-failed">offline</span>
                )}
              </dd>
            </div>
            <div className="kv">
              <dt>Linked chats</dt>
              <dd>{chats.length}</dd>
            </div>
          </dl>
          {botTokenSource === "env" ? (
            <p className="hint" style={{ marginTop: 12 }}>
              TELEGRAM_BOT_TOKEN is set in the environment and takes precedence over the token saved
              below. Remove it from .env to manage the token here.
            </p>
          ) : (
            <form onSubmit={saveToken} style={{ marginTop: 12 }}>
              <div className="field">
                <label htmlFor="botToken">Bot token</label>
                <input
                  id="botToken"
                  className="input mono"
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="123456789:ABCdef..."
                />
                <span className="hint">
                  From @BotFather. The token is validated against Telegram before it is saved.
                </span>
              </div>
              {tokenState && (
                <div className={`alert ${tokenState.ok ? "alert-success" : "alert-error"}`}>
                  {tokenState.message}
                </div>
              )}
              <div className="form-row">
                <button className="btn btn-primary" type="submit" disabled={busy || !token.trim()}>
                  {busy ? "Saving..." : "Save token"}
                </button>
                {botTokenSource === "database" && (
                  <button className="btn" type="button" onClick={clearToken} disabled={busy}>
                    Remove saved token
                  </button>
                )}
              </div>
            </form>
          )}
          {!botConfigured && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>
              Create a bot with @BotFather, then paste its token above.
            </div>
          )}
        </div>

        <div className="card">
          <h2>Timezone</h2>
          <form onSubmit={saveTimezone}>
            <div className="field">
              <label htmlFor="tz">IANA timezone</label>
              <input
                id="tz"
                className="input"
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                placeholder="America/Sao_Paulo"
              />
              <span className="hint">Used to interpret reminder times, e.g. America/Sao_Paulo.</span>
            </div>
            {tzError && <div className="alert alert-error">{tzError}</div>}
            {tzSaved && <div className="alert alert-success">Saved</div>}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save timezone"}
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Send a test message</h2>
        <div className="composer">
          <select
            id="testChat"
            className="select"
            aria-label="Chat"
            value={testChatId}
            onChange={(e) => setTestChatId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">Latest linked chat</option>
            {chats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <button
            className="btn-send"
            type="button"
            onClick={sendTest}
            disabled={busy || !botConfigured}
            aria-label="Send test message"
            title="Send test message"
          >
            <SendPlaneIcon />
          </button>
        </div>
        {testState && (
          <div className={`alert ${testState.ok ? "alert-success" : "alert-error"}`}>{testState.message}</div>
        )}
        {!chats.length && (
          <p className="empty">No chats linked yet - link one below or send /start to the bot in Telegram.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Linked chats</h2>
        <form onSubmit={linkChat}>
          <div className="form-row">
            <div className="field">
              <label htmlFor="linkChatId">Telegram chat id</label>
              <input
                id="linkChatId"
                className="input mono"
                inputMode="numeric"
                value={linkChatId}
                onChange={(e) => setLinkChatId(e.target.value)}
                placeholder="123456789"
                disabled={!botConfigured}
              />
              <span className="hint">
                Your numeric chat id (ask @userinfobot). The bot must have seen this chat at least
                once - send it any message first.
              </span>
            </div>
            <div className="field" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-primary" type="submit" disabled={busy || !botConfigured || !linkChatId.trim()}>
                {busy ? "Linking..." : "Link chat"}
              </button>
            </div>
          </div>
          {linkState && (
            <div className={`alert ${linkState.ok ? "alert-success" : "alert-error"}`}>{linkState.message}</div>
          )}
        </form>
        {chats.length === 0 ? (
          <p className="empty">No chats yet.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Telegram chat id</th>
                  <th>State</th>
                  <th>Linked at</th>
                </tr>
              </thead>
              <tbody>
                {chats.map((c) => (
                  <tr key={c.id}>
                    <td>{c.title}</td>
                    <td className="mono">{c.telegramChatId}</td>
                    <td>
                      <span className={`badge ${c.isActive ? "badge-on" : "badge-off"}`}>
                        {c.isActive ? "active" : "inactive"}
                      </span>
                    </td>
                    <td className="muted">{new Date(c.linkedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
