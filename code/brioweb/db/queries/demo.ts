import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  dailyCheckIns,
  decisionEvents,
  decisions,
  healthSamples,
  manualLogs,
  signalConsents,
  trainingSessions,
  userPreferences,
  workouts,
} from "@/db/schema";
import { createDemoFixture, type DemoScenario } from "@/lib/demo/fixture";

export async function resetSyntheticDemoForUser(userId: string, anchorDate: string, scenario: DemoScenario) {
  const fixture = createDemoFixture(anchorDate, scenario);

  await db.transaction(async (tx) => {
    await tx.delete(decisionEvents).where(eq(decisionEvents.userId, userId));
    await tx.delete(decisions).where(eq(decisions.userId, userId));
    await tx.delete(trainingSessions).where(eq(trainingSessions.userId, userId));
    await tx.delete(dailyCheckIns).where(eq(dailyCheckIns.userId, userId));
    await tx.delete(manualLogs).where(eq(manualLogs.userId, userId));
    await tx.delete(signalConsents).where(eq(signalConsents.userId, userId));
    await tx.delete(workouts).where(eq(workouts.userId, userId));
    await tx.delete(healthSamples).where(eq(healthSamples.userId, userId));

    await tx.insert(userPreferences).values({
      userId,
      timezone: fixture.preferences.timezone,
      goal: fixture.preferences.goal,
      trainingBlock: fixture.preferences.trainingBlock,
      usageMode: fixture.preferences.usageMode,
      restrictionText: fixture.preferences.restrictionText,
      restrictions: fixture.preferences.restrictions,
      onboardingCompleted: true,
      consentVersion: fixture.consent.consentVersion,
      accountStatus: "active",
      revision: 0,
      mutationId: `demo-reset:${fixture.fixtureVersion}:${anchorDate}:${scenario}`,
      updatedAt: new Date(`${anchorDate}T09:00:00.000Z`),
    }).onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        timezone: sql`excluded.timezone`,
        goal: sql`excluded.goal`,
        trainingBlock: sql`excluded.training_block`,
        usageMode: sql`excluded.usage_mode`,
        restrictionText: sql`excluded.restriction_text`,
        restrictions: sql`excluded.restrictions`,
        onboardingCompleted: true,
        consentVersion: sql`excluded.consent_version`,
        accountStatus: "active",
        revision: 0,
        mutationId: sql`excluded.mutation_id`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

    await tx.insert(signalConsents).values(fixture.consent.signals.map((entry) => ({
      userId,
      signal: entry.signal,
      purpose: entry.purpose,
      sourceLabel: entry.sourceLabel,
      enabled: entry.enabled,
      consentVersion: fixture.consent.consentVersion,
      changedAt: new Date(entry.changedAt),
    })));

    const sampleRows = fixture.history.flatMap((day, index) => [
      {
        userId,
        externalId: `demo:${fixture.fixtureVersion}:steps:${day.localDate}`,
        sampleType: "HKQuantityTypeIdentifierStepCount",
        value: day.steps,
        unit: "count",
        startDate: new Date(`${day.localDate}T08:00:00.000Z`),
        endDate: new Date(`${day.localDate}T22:00:00.000Z`),
        sourceName: "Synthetic Apple Health fixture",
        metadata: { synthetic: true, fixtureVersion: fixture.fixtureVersion, dayIndex: index },
      },
      {
        userId,
        externalId: `demo:${fixture.fixtureVersion}:energy:${day.localDate}`,
        sampleType: "HKQuantityTypeIdentifierActiveEnergyBurned",
        value: day.activeEnergyKcal,
        unit: "kcal",
        startDate: new Date(`${day.localDate}T08:00:00.000Z`),
        endDate: new Date(`${day.localDate}T22:00:00.000Z`),
        sourceName: "Synthetic Apple Health fixture",
        metadata: { synthetic: true, fixtureVersion: fixture.fixtureVersion, dayIndex: index },
      },
      {
        userId,
        externalId: `demo:${fixture.fixtureVersion}:hr:${day.localDate}`,
        sampleType: "HKQuantityTypeIdentifierHeartRate",
        value: day.heartRateTrendBpm,
        unit: "count/min",
        startDate: new Date(`${day.localDate}T07:00:00.000Z`),
        endDate: new Date(`${day.localDate}T07:01:00.000Z`),
        sourceName: "Synthetic Apple Health fixture",
        metadata: { synthetic: true, fixtureVersion: fixture.fixtureVersion, ordinaryTrend: true },
      },
      {
        userId,
        externalId: `demo:${fixture.fixtureVersion}:sleep:${day.localDate}`,
        sampleType: "HKCategoryTypeIdentifierSleepAnalysis",
        value: 3,
        unit: null,
        startDate: new Date(`${day.localDate}T00:00:00.000Z`),
        endDate: new Date(new Date(`${day.localDate}T00:00:00.000Z`).getTime() + day.sleepHours * 3_600_000),
        sourceName: "Synthetic Apple Health fixture",
        metadata: { synthetic: true, fixtureVersion: fixture.fixtureVersion },
      },
    ]);
    await tx.insert(healthSamples).values(sampleRows);

    await tx.insert(manualLogs).values({
      userId,
      localDate: fixture.manualLog.localDate,
      payload: fixture.manualLog,
      revision: 0,
      mutationId: fixture.manualLog.mutationId,
      recordedAt: new Date(fixture.manualLog.recordedAt),
    });
    await tx.insert(trainingSessions).values({
      id: fixture.trainingSession.id,
      userId,
      title: fixture.trainingSession.title,
      status: fixture.trainingSession.status,
      inputDataMode: fixture.trainingSession.inputDataMode,
      payload: { schemaVersion: "1.0.0", exercises: fixture.trainingSession.exercises, notes: fixture.trainingSession.notes },
      revision: fixture.trainingSession.revision,
      mutationId: fixture.trainingSession.mutationId,
      startedAt: fixture.trainingSession.startedAt ? new Date(fixture.trainingSession.startedAt) : null,
      endedAt: fixture.trainingSession.endedAt ? new Date(fixture.trainingSession.endedAt) : null,
      createdAt: new Date(fixture.trainingSession.createdAt),
      updatedAt: new Date(fixture.trainingSession.updatedAt),
    });
    const currentDecision = fixture.dashboard.decision;
    if (currentDecision) {
      await tx.insert(decisions).values({
        id: currentDecision.id,
        userId,
        status: currentDecision.status,
        action: currentDecision.action,
        inputDataMode: currentDecision.inputDataMode,
        executionMode: currentDecision.executionMode,
        payload: currentDecision,
        consentVersion: currentDecision.consentVersion,
        generatedAt: new Date(currentDecision.generatedAt),
        staleAt: null,
      });
    }
  });

  return fixture;
}
