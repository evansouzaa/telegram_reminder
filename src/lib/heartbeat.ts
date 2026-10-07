export const HEARTBEAT_STALE_MS = 90_000;

export function isWorkerActive(heartbeat: string | null): boolean {
  if (!heartbeat) return false;
  const ts = Date.parse(heartbeat);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < HEARTBEAT_STALE_MS;
}
