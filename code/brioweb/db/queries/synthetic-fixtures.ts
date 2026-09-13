import "server-only";

import { and, count, eq, ne, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { healthSamples, manualLogs, trainingSessions, workouts } from "@/db/schema";

export async function getSyntheticFixtureSafetyForUser(userId: string) {
  const [[health], [sessions], [workoutRows], [manual]] = await Promise.all([
    db.select({ count: count() }).from(healthSamples).where(and(eq(healthSamples.userId, userId), or(sql`${healthSamples.metadata}->>'synthetic' IS DISTINCT FROM 'true'`, sql`${healthSamples.metadata} IS NULL`))),
    db.select({ count: count() }).from(trainingSessions).where(and(eq(trainingSessions.userId, userId), ne(trainingSessions.inputDataMode, "synthetic_input"))),
    db.select({ count: count() }).from(workouts).where(and(eq(workouts.userId, userId), or(ne(workouts.sourceName, "BRIO synthetic test generator"), sql`${workouts.sourceName} IS NULL`))),
    db.select({ count: count() }).from(manualLogs).where(and(eq(manualLogs.userId, userId), sql`coalesce(${manualLogs.payload}->'overall'->>'note', '') NOT LIKE '[SYNTHETIC INPUT]%'`)),
  ]);
  const realRecordCount = Number(health.count) + Number(sessions.count) + Number(workoutRows.count) + Number(manual.count);
  return { realRecordCount, safe: realRecordCount === 0 };
}
