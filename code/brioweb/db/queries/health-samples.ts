import "server-only";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { healthSamples } from "@/db/schema";

export async function getRecentSamplesForUser(userId: string, limit = 50) {
  return db
    .select()
    .from(healthSamples)
    .where(eq(healthSamples.userId, userId))
    .orderBy(desc(healthSamples.startDate))
    .limit(limit);
}

export async function getSamplesForUser(
  userId: string,
  sampleType: string,
  range?: { start: Date; end: Date },
) {
  const conditions = [eq(healthSamples.userId, userId), eq(healthSamples.sampleType, sampleType)];

  if (range) {
    conditions.push(gte(healthSamples.startDate, range.start), lte(healthSamples.endDate, range.end));
  }

  return db
    .select()
    .from(healthSamples)
    .where(and(...conditions));
}

// Upserts on `externalId` (e.g. HealthKit's per-sample uuid) so re-syncing an
// overlapping window is idempotent. Rows with no `externalId` (e.g. fake/manual
// samples) always insert as new — a unique index never treats two NULLs as a conflict.
export async function insertHealthSamples(rows: (typeof healthSamples.$inferInsert)[]) {
  if (rows.length === 0) return [];
  return db
    .insert(healthSamples)
    .values(rows)
    .onConflictDoUpdate({
      target: healthSamples.externalId,
      set: {
        value: sql`excluded.value`,
        unit: sql`excluded.unit`,
        startDate: sql`excluded.start_date`,
        endDate: sql`excluded.end_date`,
        sourceName: sql`excluded.source_name`,
        metadata: sql`excluded.metadata`,
      },
    })
    .returning();
}
