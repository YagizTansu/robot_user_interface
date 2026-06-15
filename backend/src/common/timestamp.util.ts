/** Normalize assorted robot timestamp formats to Unix epoch milliseconds. */
export function normalizeToEpochMs(ts: number | undefined | null): number {
  if (ts == null || !Number.isFinite(ts)) return Date.now();

  const now = Date.now();

  // Unix epoch milliseconds (roughly 2001–2100)
  if (ts >= 1_000_000_000_000 && ts <= now + 120_000) return ts;

  // Unix epoch seconds
  if (ts >= 1_000_000_000 && ts < 1_000_000_000_000) return ts * 1000;

  // ROS / sim time or unknown unit — not usable as wall clock
  return Date.now();
}
