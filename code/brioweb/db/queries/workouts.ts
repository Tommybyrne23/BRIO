import "server-only";
import { and, count, desc, eq, gte, lte, sql, sum, avg } from "drizzle-orm";
import { db } from "@/db/client";
import { workouts } from "@/db/schema";

export async function getRecentWorkoutsForUser(userId: string, limit = 20) {
  return db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.startDate))
    .limit(limit);
}

export async function getWorkoutsForUser(
  userId: string,
  range?: { start: Date; end: Date },
  workoutType?: string,
) {
  const conditions = [eq(workouts.userId, userId)];

  if (range) {
    conditions.push(gte(workouts.startDate, range.start), lte(workouts.endDate, range.end));
  }
  if (workoutType) {
    conditions.push(eq(workouts.workoutType, workoutType));
  }

  return db
    .select()
    .from(workouts)
    .where(and(...conditions))
    .orderBy(desc(workouts.startDate));
}

// Single-row aggregate so tools can summarize training load without pulling
// every workout row into the model's context.
export async function getWorkoutStatsForUser(userId: string, range: { start: Date; end: Date }) {
  const [row] = await db
    .select({
      workoutCount: count(),
      totalDurationSeconds: sum(workouts.durationSeconds),
      totalDistanceMeters: sum(workouts.distanceMeters),
      totalActiveEnergyKcal: sum(workouts.activeEnergyKcal),
      avgHeartRate: avg(workouts.avgHeartRate),
    })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.startDate, range.start),
        lte(workouts.endDate, range.end),
      ),
    );

  return row;
}

// Upserts on `externalId`, same idempotency pattern as insertHealthSamples.
export async function insertWorkouts(rows: (typeof workouts.$inferInsert)[]) {
  if (rows.length === 0) return [];
  return db
    .insert(workouts)
    .values(rows)
    .onConflictDoUpdate({
      target: workouts.externalId,
      set: {
        workoutType: sql`excluded.workout_type`,
        startDate: sql`excluded.start_date`,
        endDate: sql`excluded.end_date`,
        durationSeconds: sql`excluded.duration_seconds`,
        distanceMeters: sql`excluded.distance_meters`,
        activeEnergyKcal: sql`excluded.active_energy_kcal`,
        avgHeartRate: sql`excluded.avg_heart_rate`,
        maxHeartRate: sql`excluded.max_heart_rate`,
        perceivedExertion: sql`excluded.perceived_exertion`,
        sourceName: sql`excluded.source_name`,
        metadata: sql`excluded.metadata`,
      },
    })
    .returning();
}
