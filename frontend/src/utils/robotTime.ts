const ONLINE_THRESHOLD_MS = 30_000;

/** Normalize assorted robot timestamp formats to Unix epoch milliseconds. */
export function normalizeToEpochMs(ts: number | undefined | null): number {
  if (ts == null || !Number.isFinite(ts)) return Date.now();

  const now = Date.now();

  if (ts >= 1_000_000_000_000 && ts <= now + 120_000) return ts;
  if (ts >= 1_000_000_000 && ts < 1_000_000_000_000) return ts * 1000;

  return Date.now();
}

/** Online if a live pose exists and was refreshed recently. */
export function isRobotOnline(
  hasLivePose: boolean,
  clientLastSeen?: number,
  serverLastSeen?: number,
): boolean {
  if (!hasLivePose) return false;

  const seen = clientLastSeen ?? (serverLastSeen != null ? normalizeToEpochMs(serverLastSeen) : undefined);
  if (seen == null) return true;

  return Date.now() - seen < ONLINE_THRESHOLD_MS;
}

export { ONLINE_THRESHOLD_MS };
