// Thin interval wrapper around run-once.ts. Default scheduling strategy
// given no confirmed Dokploy-native cron/scheduled-job support for Compose
// apps at time of writing — check current Dokploy docs/dashboard; if a
// native scheduled-job feature exists, swap to invoking run-once.ts directly
// on that schedule instead (one Compose service change, not a code change).
import { runOnce } from "./run-once";

const intervalMinutes = Number(process.env.WORKER_INTERVAL_MINUTES || "1440");
const intervalMs = intervalMinutes * 60 * 1000;

async function tick() {
  try {
    await runOnce();
  } catch (error) {
    console.error("[worker] run failed, will retry next interval:", error);
  }
}

console.log(`[worker] starting loop, interval = ${intervalMinutes} minute(s)`);
tick();
setInterval(tick, intervalMs);
