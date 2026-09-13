export function remainingRestSeconds(input: {
  startedAt: string | null;
  durationSeconds: number | null;
  pausedRemainingSeconds: number | null;
  nowMs: number;
}) {
  if (input.pausedRemainingSeconds !== null) return Math.max(0, input.pausedRemainingSeconds);
  if (!input.startedAt) return 0;
  const startedAtMs = new Date(input.startedAt).getTime();
  if (!Number.isFinite(startedAtMs)) return 0;
  return Math.max(0, (input.durationSeconds ?? 120) - Math.floor((input.nowMs - startedAtMs) / 1000));
}
