import { db, getSetting } from "@/lib/db";
import { getBotToken } from "@/lib/telegram";
import { toLogView, toReminderView } from "@/lib/dto";
import { isWorkerActive } from "@/lib/heartbeat";



function formatWhen(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

export const instant = false;

export default async function DashboardPage() {
  const [total, active, chatCount, upcomingRows, recentRows, heartbeat, botUsername] = await Promise.all([
    db.reminder.count(),
    db.reminder.count({ where: { enabled: true } }),
    db.telegramChat.count({ where: { isActive: true } }),
    db.reminder.findMany({
      where: { enabled: true, nextRunAt: { not: null } },
      include: { chat: true },
      orderBy: { nextRunAt: "asc" },
      take: 6,
    }),
    db.sendLog.findMany({
      include: { reminder: { select: { id: true, message: true, mode: true } } },
      orderBy: { sentAt: "desc" },
      take: 6,
    }),
    getSetting("workerHeartbeat"),
    getSetting("botUsername"),
  ]);

  const workerActive = isWorkerActive(heartbeat);
  const upcoming = upcomingRows.map(toReminderView);
  const recent = recentRows.map(toLogView);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Local Telegram reminder scheduler</p>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="card">
          <div className="stat-label">Reminders</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="card">
          <div className="stat-label">Active</div>
          <div className="stat-value">{active}</div>
        </div>
        <div className="card">
          <div className="stat-label">Linked chats</div>
          <div className="stat-value">{chatCount}</div>
        </div>
        <div className="card">
          <div className="stat-label">Bot</div>
          <div className="stat-value" style={{ fontSize: 18, marginTop: 8 }}>
            {!getBotToken() ? (
              <span className="badge badge-failed">no token</span>
            ) : botUsername ? (
              <span className="badge badge-on">@{botUsername}</span>
            ) : (
              <span className="badge">connecting</span>
            )}
            <div className="stat-label" style={{ marginTop: 8 }}>
              Worker:{" "}
              {workerActive ? (
                <span className="badge badge-on">running</span>
              ) : (
                <span className="badge badge-failed">offline</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Upcoming reminders</h2>
          {upcoming.length === 0 ? (
            <p className="empty">No scheduled reminders. Create one in Reminders.</p>
          ) : (
            <table className="table">
              <tbody>
                {upcoming.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.message.slice(0, 48)}</strong>
                      {r.message.length > 48 ? "..." : ""}
                      <div className="muted" style={{ fontSize: 13 }}>
                        {r.chatTitle}
                      </div>
                    </td>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>
                      {formatWhen(r.nextRunAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Recent sends</h2>
          {recent.length === 0 ? (
            <p className="empty">Nothing sent yet.</p>
          ) : (
            <table className="table">
              <tbody>
                {recent.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className={`badge badge-${log.status.toLowerCase()}`}>{log.status}</span>
                    </td>
                    <td>
                      {log.reminder ? log.reminder.message.slice(0, 44) : "(deleted reminder)"}
                      {log.detail ? <div className="muted" style={{ fontSize: 13 }}>{log.detail}</div> : null}
                    </td>
                    <td className="muted" style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                      {formatWhen(log.sentAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
