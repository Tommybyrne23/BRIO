// Autonomous insight worker: runs sleep/training/recovery insight agents for
// every user and persists structured results into agent_insights. No HTTP
// API, no public surface — connects to Postgres via DATABASE_URL like any
// other server-side code in this repo. Invoked directly (npm run worker:run)
// or wrapped on an interval by worker/loop.ts.
import { run } from "@openai/agents";
import { getAllUserIds } from "@/db/queries/users";
import { insertAgentInsight } from "@/db/queries/agent-insights";
import { buildRecoveryTools, buildSleepTools, buildTrainingTools } from "@/agents/tools";
import { buildInsightAgent } from "@/agents/insight-agent";
import { DEFAULT_MODEL } from "@/agents/model";
import type { InsightDomain } from "@/agents/types";

const INSIGHT_WINDOW_DAYS = 14;

const DOMAIN_TOOL_BUILDERS: Record<InsightDomain, (userId: string) => Parameters<typeof buildInsightAgent>[1]> = {
  sleep: buildSleepTools,
  training: buildTrainingTools,
  recovery: buildRecoveryTools,
};

async function runInsightForUser(userId: string, domain: InsightDomain) {
  const tools = DOMAIN_TOOL_BUILDERS[domain](userId);
  const agent = buildInsightAgent(domain, tools);
  const result = await run(agent, `Produce today's ${domain} insight for this user.`);

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - INSIGHT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  await insertAgentInsight({
    userId,
    agentKey: domain,
    insightType: "daily-summary",
    payload: result.finalOutput,
    summary: result.finalOutput?.summary ?? "(no summary produced)",
    periodStart,
    periodEnd,
    model: DEFAULT_MODEL,
  });
}

export async function runOnce() {
  const userIds = await getAllUserIds();
  console.log(`[worker] starting run for ${userIds.length} user(s)`);

  for (const userId of userIds) {
    for (const domain of ["sleep", "training", "recovery"] as const) {
      try {
        await runInsightForUser(userId, domain);
        console.log(`[worker] ${domain} insight written for user ${userId}`);
      } catch (error) {
        console.error(`[worker] failed ${domain} insight for user ${userId}:`, error);
      }
    }
  }

  console.log("[worker] run complete");
}

if (require.main === module) {
  runOnce()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("[worker] fatal error:", error);
      process.exit(1);
    });
}
