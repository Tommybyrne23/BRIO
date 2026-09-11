import "server-only";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { healthSamples } from "@/db/schema";

const SLEEP_SAMPLE_TYPE = "HKCategoryTypeIdentifierSleepAnalysis";
const HEART_RATE_SAMPLE_TYPE = "HKQuantityTypeIdentifierHeartRate";
const STEP_COUNT_SAMPLE_TYPE = "HKQuantityTypeIdentifierStepCount";
const ACTIVE_ENERGY_SAMPLE_TYPE = "HKQuantityTypeIdentifierActiveEnergyBurned";

// HKCategoryValueSleepAnalysis: 0 = inBed, 2 = awake — excluded so totals
// reflect time actually asleep, not time in bed.
const AWAKE_OR_IN_BED_VALUES = [0, 2];

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

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

// Groups sleep segments into "nights" (bucketed 12h before midnight, so a
// sleep session starting late evening and ending the next morning counts as
// one night) and sums asleep duration per night. Pre-aggregated server-side
// so a sleep tool doesn't have to hand raw segment rows to the model.
export async function getSleepSummaryForUser(userId: string, days = 14) {
  const nightExpr = sql<string>`date_trunc('day', ${healthSamples.startDate} - interval '12 hours')`;

  return db
    .select({
      night: nightExpr,
      totalAsleepSeconds: sql<number>`sum(extract(epoch from (${healthSamples.endDate} - ${healthSamples.startDate})))`,
      segmentCount: sql<number>`count(*)`,
      sleepStart: sql<string>`min(${healthSamples.startDate})`,
      sleepEnd: sql<string>`max(${healthSamples.endDate})`,
    })
    .from(healthSamples)
    .where(
      and(
        eq(healthSamples.userId, userId),
        eq(healthSamples.sampleType, SLEEP_SAMPLE_TYPE),
        gte(healthSamples.startDate, daysAgo(days)),
        sql`${healthSamples.value} NOT IN (${sql.join(AWAKE_OR_IN_BED_VALUES, sql`, `)})`,
      ),
    )
    .groupBy(nightExpr)
    .orderBy(nightExpr);
}

// Daily min/avg/max heart rate — a proxy for a resting-HR trend, since no
// dedicated resting-heart-rate sample type is synced today.
export async function getHeartRateDailyStatsForUser(userId: string, days = 14) {
  const dayExpr = sql<string>`date_trunc('day', ${healthSamples.startDate})`;

  return db
    .select({
      day: dayExpr,
      minHeartRate: sql<number>`min(${healthSamples.value})`,
      avgHeartRate: sql<number>`avg(${healthSamples.value})`,
      maxHeartRate: sql<number>`max(${healthSamples.value})`,
      sampleCount: sql<number>`count(*)`,
    })
    .from(healthSamples)
    .where(
      and(
        eq(healthSamples.userId, userId),
        eq(healthSamples.sampleType, HEART_RATE_SAMPLE_TYPE),
        gte(healthSamples.startDate, daysAgo(days)),
      ),
    )
    .groupBy(dayExpr)
    .orderBy(dayExpr);
}

// Daily steps + active energy totals, pivoted into one row per day.
export async function getActivityDailyStatsForUser(userId: string, days = 14) {
  const dayExpr = sql<string>`date_trunc('day', ${healthSamples.startDate})`;

  const rows = await db
    .select({
      day: dayExpr,
      sampleType: healthSamples.sampleType,
      total: sql<number>`sum(${healthSamples.value})`,
    })
    .from(healthSamples)
    .where(
      and(
        eq(healthSamples.userId, userId),
        inArray(healthSamples.sampleType, [STEP_COUNT_SAMPLE_TYPE, ACTIVE_ENERGY_SAMPLE_TYPE]),
        gte(healthSamples.startDate, daysAgo(days)),
      ),
    )
    .groupBy(dayExpr, healthSamples.sampleType)
    .orderBy(dayExpr);

  const byDay = new Map<string, { day: string; steps: number; activeEnergyKcal: number }>();
  for (const row of rows) {
    const entry = byDay.get(row.day) ?? { day: row.day, steps: 0, activeEnergyKcal: 0 };
    if (row.sampleType === STEP_COUNT_SAMPLE_TYPE) entry.steps = Number(row.total);
    if (row.sampleType === ACTIVE_ENERGY_SAMPLE_TYPE) entry.activeEnergyKcal = Number(row.total);
    byDay.set(row.day, entry);
  }

  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
}
