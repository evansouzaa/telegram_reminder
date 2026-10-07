"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChatView } from "@/lib/dto";

export default function SettingsClient({
  timezone,
  botConfigured,
  botUsername,
  workerActive,
  chats,
}: {
  timezone: string;
  botConfigured: boolean;
  botUsername: string | null;
  workerActive: boolean;
  chats: ChatView[];
}) {
  const router = useRouter();
  const [tz, setTz] = useState(timezone);
  const [tzError, setTzError] = useState<string | null>(null);
  const [tzSaved, setTzSaved] = useState(false);
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
          {!botConfigured && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>
              Create a bot with @BotFather, then set TELEGRAM_BOT_TOKEN in .env and restart the worker.
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
        <div className="form-row">
          <div className="field">
            <label htmlFor="testChat">Chat</label>
            <select
              id="testChat"
              className="select"
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
          </div>
          <div className="field" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary" type="button" onClick={sendTest} disabled={busy || !botConfigured}>
              Send test
            </button>
          </div>
        </div>
        {testState && (
          <div className={`alert ${testState.ok ? "alert-success" : "alert-error"}`}>{testState.message}</div>
        )}
        {!chats.length && (
          <p className="empty">No chats linked yet - open the bot in Telegram and send /start.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Linked chats</h2>
        {chats.length === 0 ? (
          <p className="empty">No chats yet.</p>
        ) : (
          <div className="table-wrap">
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
