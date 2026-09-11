import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agentInsights } from "@/db/schema";

// Plain insert — each worker run appends a new row rather than upserting, so
// insight history over time is preserved; callers show the latest per key.
export async function insertAgentInsight(row: typeof agentInsights.$inferInsert) {
  const [inserted] = await db.insert(agentInsights).values(row).returning();
  return inserted;
}

export async function getLatestInsightForUser(userId: string, agentKey: string) {
  const [row] = await db
    .select()
    .from(agentInsights)
    .where(and(eq(agentInsights.userId, userId), eq(agentInsights.agentKey, agentKey)))
    .orderBy(desc(agentInsights.createdAt))
    .limit(1);

  return row ?? null;
}

export async function getInsightHistoryForUser(userId: string, agentKey: string, limit = 10) {
  return db
    .select()
    .from(agentInsights)
    .where(and(eq(agentInsights.userId, userId), eq(agentInsights.agentKey, agentKey)))
    .orderBy(desc(agentInsights.createdAt))
    .limit(limit);
}
