import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { healthSamples } from "@/db/schema";

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

export async function insertHealthSamples(rows: (typeof healthSamples.$inferInsert)[]) {
  if (rows.length === 0) return [];
  return db.insert(healthSamples).values(rows).returning();
}
