import { db } from "@/lib/db";
import { toLogView } from "@/lib/dto";



export const instant = false;

export default async function LogsPage() {
  const rows = await db.sendLog.findMany({
    include: { reminder: { select: { id: true, message: true, mode: true } } },
    orderBy: { sentAt: "desc" },
    take: 200,
  });
  const logs = rows.map(toLogView);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Logs</h1>
          <p>Last {logs.length} send attempts</p>
        </div>
      </div>

      <div className="card">
        {logs.length === 0 ? (
          <p className="empty">No send attempts yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Reminder</th>
                  <th>Chat</th>
                  <th>Detail</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className={`badge badge-${log.status.toLowerCase()}`}>{log.status}</span>
                    </td>
                    <td>
                      {log.reminder ? log.reminder.message.slice(0, 60) : "(deleted reminder)"}
                      {log.reminder && log.reminder.message.length > 60 ? "..." : ""}
                    </td>
                    <td className="mono">{log.chatId}</td>
                    <td className="muted">{log.detail ?? "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(log.sentAt).toLocaleString()}</td>
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
