"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChatView, ReminderView } from "@/lib/dto";

type FormState = {
  message: string;
  mode: "ONCE" | "DAILY" | "WEEKLY";
  runAt: string;
  timeOfDay: string;
  days: number[];
  chatId: number;
  parseMode: "" | "HTML" | "MarkdownV2";
  silent: boolean;
  enabled: boolean;
};

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function emptyForm(chatId: number): FormState {
  return {
    message: "",
    mode: "ONCE",
    runAt: "",
    timeOfDay: "09:00",
    days: [1],
    chatId,
    parseMode: "",
    silent: false,
    enabled: true,
  };
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

function scheduleLabel(r: ReminderView): string {
  if (r.mode === "ONCE") return r.runAt ? new Date(r.runAt).toLocaleString() : "-";
  if (r.mode === "WEEKLY") {
    const names = WEEKDAYS.filter((w) => r.daysOfWeek?.includes(w.value)).map((w) => w.label);
    return `${r.timeOfDay} (${names.join(", ")})`;
  }
  return `daily at ${r.timeOfDay}`;
}

export default function RemindersClient({
  initialReminders: reminders,
  chats,
}: {
  initialReminders: ReminderView[];
  chats: ChatView[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(chats[0]?.id ?? 0));
  const [file, setFile] = useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<ReminderView["attachment"]>(null);
  const [clearAttachment, setClearAttachment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm(chats[0]?.id ?? 0));
    setFile(null);
    setExistingAttachment(null);
    setClearAttachment(false);
    setError(null);
    setOpen(true);
  }

  function openEdit(r: ReminderView) {
    setEditingId(r.id);
    setForm({
      message: r.message,
      mode: r.mode,
      runAt: toLocalInput(r.runAt),
      timeOfDay: r.timeOfDay ?? "09:00",
      days: r.daysOfWeek ?? [1],
      chatId: r.chatId,
      parseMode: r.parseMode as FormState["parseMode"],
      silent: r.silent,
      enabled: r.enabled,
    });
    setFile(null);
    setExistingAttachment(r.attachment);
    setClearAttachment(false);
    setError(null);
    setOpen(true);
  }

  function closeForm() {
    setOpen(false);
    setEditingId(null);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!form.message.trim()) {
      setError("Message is required");
      return;
    }
    if (!form.chatId) {
      setError("Link a chat first: open the bot in Telegram and send /start");
      return;
    }
    if (form.mode === "ONCE" && !form.runAt) {
      setError("Pick a date and time");
      return;
    }
    if (form.mode === "WEEKLY" && form.days.length === 0) {
      setError("Pick at least one weekday");
      return;
    }

    setBusy(true);
    try {
      let attachment: { path: string; name: string; kind: string } | null = null;
      if (file) {
        const data = new FormData();
        data.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: data });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(body?.error ?? "Upload failed");
          return;
        }
        attachment = body;
      }

      const payload = {
        message: form.message.trim(),
        mode: form.mode,
        runAt: form.mode === "ONCE" ? new Date(form.runAt).toISOString() : null,
        timeOfDay: form.mode === "ONCE" ? null : form.timeOfDay,
        daysOfWeek: form.mode === "WEEKLY" ? form.days : null,
        chatId: form.chatId,
        parseMode: form.parseMode,
        silent: form.silent,
        enabled: form.enabled,
        attachment: file ? attachment : editingId !== null && (clearAttachment || existingAttachment) ? (clearAttachment ? null : existingAttachment) : null,
      };

      const res = await fetch(editingId !== null ? `/api/reminders/${editingId}` : "/api/reminders", {
        method: editingId !== null ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Save failed");
        return;
      }

      closeForm();
      setFile(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(r: ReminderView) {
    setError(null);
    const res = await fetch(`/api/reminders/${r.id}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !r.enabled }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error ?? "Toggle failed");
      return;
    }
    router.refresh();
  }

  async function remove(r: ReminderView) {
    if (!confirm(`Delete reminder "${r.message.slice(0, 60)}"?`)) return;
    setError(null);
    const res = await fetch(`/api/reminders/${r.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Delete failed");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reminders</h1>
          <p>{reminders.length} total - {reminders.filter((r) => r.enabled).length} active</p>
        </div>
        <button className="btn btn-primary" onClick={openNew} type="button">
          New reminder
        </button>
      </div>

      {error && !open ? <div className="alert alert-error">{error}</div> : null}

      {open && (
        <form className="card" onSubmit={submit}>
          <h2>{editingId !== null ? `Edit reminder #${editingId}` : "New reminder"}</h2>
          {error ? <div className="alert alert-error">{error}</div> : null}

          <div className="field">
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              className="textarea"
              value={form.message}
              onChange={(e) => set("message", e.target.value)}
              placeholder="What should the bot send?"
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="chat">Chat</label>
              <select
                id="chat"
                className="select"
                value={form.chatId || ""}
                onChange={(e) => set("chatId", Number(e.target.value))}
              >
                {chats.length === 0 && <option value="">No linked chat yet</option>}
                {chats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} {c.isActive ? "" : "(inactive)"}
                  </option>
                ))}
              </select>
              <span className="hint">Open the bot in Telegram and send /start to link a chat.</span>
            </div>

            <div className="field">
              <label htmlFor="mode">Schedule type</label>
              <select
                id="mode"
                className="select"
                value={form.mode}
                onChange={(e) => set("mode", e.target.value as FormState["mode"])}
              >
                <option value="ONCE">One time</option>
                <option value="DAILY">Every day</option>
                <option value="WEEKLY">Certain weekdays</option>
              </select>
            </div>
          </div>

          {form.mode === "ONCE" && (
            <div className="field">
              <label htmlFor="runAt">Date and time</label>
              <input
                id="runAt"
                className="input"
                type="datetime-local"
                value={form.runAt}
                onChange={(e) => set("runAt", e.target.value)}
              />
            </div>
          )}

          {form.mode !== "ONCE" && (
            <div className="form-row">
              <div className="field">
                <label htmlFor="timeOfDay">Time</label>
                <input
                  id="timeOfDay"
                  className="input"
                  type="time"
                  value={form.timeOfDay}
                  onChange={(e) => set("timeOfDay", e.target.value)}
                />
              </div>
              {form.mode === "WEEKLY" && (
                <div className="field">
                  <label>Weekdays</label>
                  <div className="check-grid">
                    {WEEKDAYS.map((w) => (
                      <label className="check" key={w.value}>
                        <input
                          type="checkbox"
                          checked={form.days.includes(w.value)}
                          onChange={(e) =>
                            set(
                              "days",
                              e.target.checked
                                ? [...form.days, w.value].sort((a, b) => a - b)
                                : form.days.filter((d) => d !== w.value),
                            )
                          }
                        />
                        {w.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="form-row">
            <div className="field">
              <label htmlFor="parseMode">Formatting</label>
              <select
                id="parseMode"
                className="select"
                value={form.parseMode}
                onChange={(e) => set("parseMode", e.target.value as FormState["parseMode"])}
              >
                <option value="">Plain text</option>
                <option value="HTML">HTML</option>
                <option value="MarkdownV2">MarkdownV2</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="attachment">Attachment (optional)</label>
              <input
                id="attachment"
                className="input"
                type="file"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setClearAttachment(false);
                }}
              />
              {editingId !== null && existingAttachment && !file && (
                <span className="hint">
                  Current: {existingAttachment.name} ({existingAttachment.kind.toLowerCase()}){" "}
                  <button
                    className="btn btn-sm"
                    type="button"
                    onClick={() => setClearAttachment(true)}
                    style={{ marginLeft: 6 }}
                  >
                    {clearAttachment ? "Will be removed" : "Remove"}
                  </button>
                </span>
              )}
            </div>
          </div>

          <div className="check-grid" style={{ marginBottom: 14 }}>
            <label className="check">
              <input type="checkbox" checked={form.silent} onChange={(e) => set("silent", e.target.checked)} />
              Send silently
            </label>
            <label className="check">
              <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} />
              Enabled
            </label>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Saving..." : editingId !== null ? "Save changes" : "Create reminder"}
            </button>
            <button className="btn" type="button" onClick={closeForm} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>State</th>
                <th>Message</th>
                <th>Schedule</th>
                <th>Next run</th>
                <th>Chat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reminders.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No reminders yet.
                  </td>
                </tr>
              )}
              {reminders.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className={`badge ${r.enabled ? "badge-on" : "badge-off"}`}>
                      {r.enabled ? "active" : "paused"}
                    </span>
                    {r.retryCount > 0 && (
                      <span className="badge badge-failed" style={{ marginLeft: 6 }}>
                        retry {r.retryCount}
                      </span>
                    )}
                  </td>
                  <td>
                    {r.message.slice(0, 70)}
                    {r.message.length > 70 ? "..." : ""}
                    {r.attachment ? (
                      <div className="muted" style={{ fontSize: 13 }}>
                        + {r.attachment.kind.toLowerCase()} {r.attachment.name}
                      </div>
                    ) : null}
                  </td>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>
                    {scheduleLabel(r)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatWhen(r.nextRunAt)}</td>
                  <td className="muted">{r.chatTitle}</td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-sm" type="button" onClick={() => openEdit(r)}>
                        Edit
                      </button>
                      <button className="btn btn-sm" type="button" onClick={() => toggle(r)}>
                        {r.enabled ? "Pause" : "Resume"}
                      </button>
                      <button className="btn btn-sm btn-danger" type="button" onClick={() => remove(r)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
