import "server-only";

import { and, count, desc, eq, max, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  account,
  agentInsights,
  dailyCheckIns,
  decisionEvents,
  decisions,
  healthSamples,
  manualLogs,
  session,
  signalConsents,
  trainingSessions,
  user,
  userPreferences,
  workouts,
} from "@/db/schema";
import { ExportEnvelopeSchema, SourceStatusSchema } from "@/lib/contracts";
import { getConsentForUser, getPreferencesForUser } from "./product-state";
import { listTrainingSessionsForUser } from "./training-sessions";
import { listDecisionsForUser, listDecisionEventsForUser } from "./decisions";

export async function getSourceStatusesForUser(userId: string) {
  const [{ sampleCount, latestSampleAt }] = await db.select({
    sampleCount: count(),
    latestSampleAt: max(healthSamples.endDate),
  }).from(healthSamples).where(and(eq(healthSamples.userId, userId), sql`${healthSamples.metadata}->>'synthetic' IS DISTINCT FROM 'true'`));
  const types = await db.selectDistinct({ sampleType: healthSamples.sampleType })
    .from(healthSamples).where(and(eq(healthSamples.userId, userId), sql`${healthSamples.metadata}->>'synthetic' IS DISTINCT FROM 'true'`));
  const latestManual = await db.select({ recordedAt: manualLogs.recordedAt })
    .from(manualLogs).where(and(eq(manualLogs.userId, userId), sql`${manualLogs.mutationId} NOT LIKE 'synthetic-%'`)).orderBy(desc(manualLogs.recordedAt)).limit(1);
  const [[syntheticHealth], [syntheticSessions], [syntheticManual], syntheticTypes] = await Promise.all([
    db.select({ count: count(), latest: max(healthSamples.endDate) }).from(healthSamples).where(and(eq(healthSamples.userId, userId), sql`${healthSamples.metadata}->>'synthetic' = 'true'`)),
    db.select({ count: count(), latest: max(trainingSessions.updatedAt) }).from(trainingSessions).where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.inputDataMode, "synthetic_input"))),
    db.select({ count: count(), latest: max(manualLogs.recordedAt) }).from(manualLogs).where(and(eq(manualLogs.userId, userId), sql`${manualLogs.mutationId} LIKE 'synthetic-%'`)),
    db.selectDistinct({ sampleType: healthSamples.sampleType }).from(healthSamples).where(and(eq(healthSamples.userId, userId), sql`${healthSamples.metadata}->>'synthetic' = 'true'`)),
  ]);
  const syntheticCount = Number(syntheticHealth.count) + Number(syntheticSessions.count) + Number(syntheticManual.count);
  const syntheticLatest = [syntheticHealth.latest, syntheticSessions.latest, syntheticManual.latest].flatMap((value) => value ? [new Date(value)] : []).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return [
    SourceStatusSchema.parse({
      sourceKey: "apple_health_helper",
      label: "Apple Health helper",
      state: Number(sampleCount) === 0 ? "available" : "connected",
      observedSampleTypes: types.map((row) => row.sampleType),
      sampleCount: Number(sampleCount),
      lastSuccessfulIngestAt: latestSampleAt ? new Date(latestSampleAt).toISOString() : null,
      latestSampleAt: latestSampleAt ? new Date(latestSampleAt).toISOString() : null,
      lastAttemptError: null,
    }),
    SourceStatusSchema.parse({
      sourceKey: "manual_entry",
      label: "Manual entry",
      state: "available",
      observedSampleTypes: latestManual.length ? ["manual_log"] : [],
      sampleCount: latestManual.length,
      lastSuccessfulIngestAt: latestManual[0]?.recordedAt.toISOString() ?? null,
      latestSampleAt: latestManual[0]?.recordedAt.toISOString() ?? null,
      lastAttemptError: null,
    }),
    SourceStatusSchema.parse({
      sourceKey: "synthetic_fixture",
      label: "Synthetic test fixture",
      state: syntheticCount ? "simulated" : "available",
      observedSampleTypes: syntheticTypes.map((row) => row.sampleType),
      sampleCount: syntheticCount,
      lastSuccessfulIngestAt: syntheticLatest?.toISOString() ?? null,
      latestSampleAt: syntheticLatest?.toISOString() ?? null,
      lastAttemptError: null,
    }),
  ];
}

export async function exportUserData(userId: string) {
  const [preferences, consent, health, manual, checkIns, sessions, userDecisions, events] = await Promise.all([
    getPreferencesForUser(userId),
    getConsentForUser(userId),
    db.select().from(healthSamples).where(eq(healthSamples.userId, userId)),
    db.select().from(manualLogs).where(eq(manualLogs.userId, userId)),
    db.select().from(dailyCheckIns).where(eq(dailyCheckIns.userId, userId)),
    listTrainingSessionsForUser(userId, 1000),
    listDecisionsForUser(userId, 1000),
    listDecisionEventsForUser(userId, 1000),
  ]);

  return ExportEnvelopeSchema.parse({
    schemaVersion: "1.0.0",
    exportedAt: new Date().toISOString(),
    accountId: userId,
    preferences,
    consent,
    healthSamples: health,
    manualLogs: manual,
    checkIns,
    trainingSessions: sessions,
    decisions: userDecisions,
    decisionEvents: events,
  });
}

export async function deleteUserAccount(userId: string) {
  await db.transaction(async (tx) => {
    await tx.update(userPreferences).set({ accountStatus: "deleting", updatedAt: new Date() })
      .where(eq(userPreferences.userId, userId));
    await tx.delete(decisionEvents).where(eq(decisionEvents.userId, userId));
    await tx.delete(decisions).where(eq(decisions.userId, userId));
    await tx.delete(trainingSessions).where(eq(trainingSessions.userId, userId));
    await tx.delete(dailyCheckIns).where(eq(dailyCheckIns.userId, userId));
    await tx.delete(manualLogs).where(eq(manualLogs.userId, userId));
    await tx.delete(signalConsents).where(eq(signalConsents.userId, userId));
    await tx.delete(agentInsights).where(eq(agentInsights.userId, userId));
    await tx.delete(healthSamples).where(eq(healthSamples.userId, userId));
    await tx.delete(workouts).where(eq(workouts.userId, userId));
    await tx.delete(session).where(eq(session.userId, userId));
    await tx.delete(account).where(eq(account.userId, userId));
    await tx.delete(userPreferences).where(eq(userPreferences.userId, userId));
    await tx.delete(user).where(eq(user.id, userId));
  });
}
