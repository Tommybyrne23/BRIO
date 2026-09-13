import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agentInsights, signalConsents, userPreferences } from "@/db/schema";
import { ConflictError } from "./errors";

// Plain insert retained for explicitly historical/imported rows. Autonomous
// current insights use insertAgentInsightIfConsentCurrent below.
export async function insertAgentInsight(row: typeof agentInsights.$inferInsert) {
  const [inserted] = await db.insert(agentInsights).values(row).returning();
  return inserted;
}

export async function insertAgentInsightIfConsentCurrent(
  row: typeof agentInsights.$inferInsert,
  expectedConsentVersion: number,
) {
  return db.transaction(async (tx) => {
    const [eligibility] = await tx.select({
      consentVersion: userPreferences.consentVersion,
      accountStatus: userPreferences.accountStatus,
      aiEnabled: signalConsents.enabled,
    }).from(userPreferences).innerJoin(signalConsents, and(
      eq(signalConsents.userId, userPreferences.userId),
      eq(signalConsents.signal, "server_ai_processing"),
    )).where(eq(userPreferences.userId, row.userId)).limit(1);

    if (
      !eligibility ||
      eligibility.accountStatus !== "active" ||
      !eligibility.aiEnabled ||
      eligibility.consentVersion !== expectedConsentVersion
    ) {
      throw new ConflictError("Consent changed before the insight was saved");
    }

    await tx.update(agentInsights).set({ isCurrent: false }).where(and(
      eq(agentInsights.userId, row.userId),
      eq(agentInsights.agentKey, row.agentKey),
      eq(agentInsights.isCurrent, true),
    ));
    const [inserted] = await tx.insert(agentInsights).values({
      ...row,
      consentVersion: expectedConsentVersion,
      isCurrent: true,
    }).returning();
    return inserted;
  });
}

export async function getLatestInsightForUser(userId: string, agentKey: string) {
  const [row] = await db
    .select()
    .from(agentInsights)
    .where(and(
      eq(agentInsights.userId, userId),
      eq(agentInsights.agentKey, agentKey),
      eq(agentInsights.isCurrent, true),
    ))
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
