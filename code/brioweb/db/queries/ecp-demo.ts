import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  agentInsights,
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
import { createDefaultConsentSnapshot } from "@/lib/contracts";
import { createEcpFixture, type EcpId } from "@/lib/demo/ecp-fixtures";
import { saveTrainingSessionForUser } from "./training-sessions";

export async function resetEcpDemoForUser(userId: string, ecpId: EcpId, anchorDate: string) {
  const fixture = createEcpFixture(ecpId, anchorDate, userId);
  const changedAt = `${anchorDate}T08:00:00.000Z`;
  const consent = createDefaultConsentSnapshot(changedAt);
  const enabledConsent = {
    ...consent,
    consentVersion: 2,
    signals: consent.signals.map((signal) => ({ ...signal, enabled: true, changedAt })),
    updatedAt: changedAt,
  };

  await db.transaction(async (tx) => {
    await tx.delete(agentInsights).where(eq(agentInsights.userId, userId));
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
      timezone: "Europe/Dublin",
      goal: fixture.definition.goal,
      trainingBlock: fixture.definition.trainingBlock,
      usageMode: "coach",
      restrictionText: "",
      restrictions: [],
      profile: fixture.definition.profile,
      onboardingCompleted: true,
      consentVersion: enabledConsent.consentVersion,
      accountStatus: "active",
      revision: 0,
      mutationId: `ecp-reset:${fixture.fixtureVersion}:${ecpId}:${anchorDate}`,
      updatedAt: new Date(changedAt),
    }).onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        timezone: sql`excluded.timezone`,
        goal: sql`excluded.goal`,
        trainingBlock: sql`excluded.training_block`,
        usageMode: sql`excluded.usage_mode`,
        restrictionText: sql`excluded.restriction_text`,
        restrictions: sql`excluded.restrictions`,
        profile: sql`excluded.profile`,
        onboardingCompleted: true,
        consentVersion: sql`excluded.consent_version`,
        accountStatus: "active",
        revision: 0,
        mutationId: sql`excluded.mutation_id`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

    await tx.insert(signalConsents).values(enabledConsent.signals.map((entry) => ({
      userId,
      signal: entry.signal,
      purpose: entry.purpose,
      sourceLabel: entry.sourceLabel,
      enabled: true,
      consentVersion: enabledConsent.consentVersion,
      changedAt: new Date(entry.changedAt),
    })));

    const healthRows = fixture.days.flatMap((day) => {
      const bedtime = new Date(`${day.localDate}T00:00:00.000Z`);
      return [
        {
          userId,
          externalId: `${fixture.fixtureVersion}:${ecpId}:${day.localDate}:sleep`,
          sampleType: "HKCategoryTypeIdentifierSleepAnalysis",
          value: 3,
          unit: null,
          startDate: bedtime,
          endDate: new Date(bedtime.getTime() + day.sleepHours * 3_600_000),
          sourceName: "BRIO synthetic ECP generator (not Apple Health)",
          metadata: { synthetic: true, fixtureVersion: fixture.fixtureVersion, ecpId, inputDataMode: "synthetic_input" },
        },
        {
          userId,
          externalId: `${fixture.fixtureVersion}:${ecpId}:${day.localDate}:steps`,
          sampleType: "HKQuantityTypeIdentifierStepCount",
          value: day.steps,
          unit: "count",
          startDate: new Date(`${day.localDate}T08:00:00.000Z`),
          endDate: new Date(`${day.localDate}T21:00:00.000Z`),
          sourceName: "BRIO synthetic ECP generator (not Apple Health)",
          metadata: { synthetic: true, fixtureVersion: fixture.fixtureVersion, ecpId, inputDataMode: "synthetic_input" },
        },
        {
          userId,
          externalId: `${fixture.fixtureVersion}:${ecpId}:${day.localDate}:energy`,
          sampleType: "HKQuantityTypeIdentifierActiveEnergyBurned",
          value: day.activeEnergyKcal,
          unit: "kcal",
          startDate: new Date(`${day.localDate}T08:00:00.000Z`),
          endDate: new Date(`${day.localDate}T21:00:00.000Z`),
          sourceName: "BRIO synthetic ECP generator (not Apple Health)",
          metadata: { synthetic: true, fixtureVersion: fixture.fixtureVersion, ecpId, inputDataMode: "synthetic_input" },
        },
        ...[7, 12, 18].map((hour) => ({
          userId,
          externalId: `${fixture.fixtureVersion}:${ecpId}:${day.localDate}:heart-rate:${hour}`,
          sampleType: "HKQuantityTypeIdentifierHeartRate",
          value: day.heartRateBpm + (hour === 12 ? 4 : hour === 18 ? 8 : 0),
          unit: "count/min",
          startDate: new Date(`${day.localDate}T${String(hour).padStart(2, "0")}:00:00.000Z`),
          endDate: new Date(`${day.localDate}T${String(hour).padStart(2, "0")}:01:00.000Z`),
          sourceName: "BRIO synthetic ECP generator (not Apple Health)",
          metadata: { synthetic: true, fixtureVersion: fixture.fixtureVersion, ecpId, inputDataMode: "synthetic_input" },
        })),
      ];
    });
    await tx.insert(healthSamples).values(healthRows);

    await tx.insert(manualLogs).values(fixture.days.map((day) => ({
      userId,
      localDate: day.localDate,
      payload: {
        schemaVersion: "1.0.0",
        localDate: day.localDate,
        overall: { note: `[SYNTHETIC INPUT] ${fixture.fixtureVersion}; ${fixture.definition.name}; all foods are demo-only.` },
        nutrition: day.nutrition,
        mutationId: `synthetic-${fixture.fixtureVersion}:${ecpId}:nutrition:${day.localDate}`,
        revision: 0,
        recordedAt: `${day.localDate}T20:30:00.000Z`,
      },
      revision: 0,
      mutationId: `synthetic-${fixture.fixtureVersion}:${ecpId}:nutrition:${day.localDate}`,
      recordedAt: new Date(`${day.localDate}T20:30:00.000Z`),
    })));

    const keys = ["fatigue", "muscle_soreness", "sleep_quality", "stress", "mood"] as const;
    await tx.insert(dailyCheckIns).values(fixture.days.map((day) => ({
      userId,
      localDate: day.localDate,
      responses: keys.map((key, index) => ({ key, rating: day.checkIn[index] })),
      revision: 0,
      mutationId: `synthetic-${fixture.fixtureVersion}:${ecpId}:check-in:${day.localDate}`,
      recordedAt: new Date(`${day.localDate}T21:00:00.000Z`),
    })));

    await tx.insert(workouts).values(fixture.workouts.map((workout) => ({
      userId,
      workoutType: workout.workoutType,
      startDate: new Date(workout.startDate),
      endDate: new Date(workout.endDate),
      durationSeconds: workout.durationSeconds,
      distanceMeters: workout.distanceMeters,
      activeEnergyKcal: workout.activeEnergyKcal,
      avgHeartRate: workout.avgHeartRate,
      maxHeartRate: workout.maxHeartRate,
      perceivedExertion: workout.perceivedExertion,
      sourceName: "BRIO synthetic ECP generator",
      externalId: workout.externalId,
      metadata: { synthetic: true, fixtureVersion: fixture.fixtureVersion, ecpId, inputDataMode: "synthetic_input" },
    })));
  });

  for (const session of fixture.sessions) {
    await saveTrainingSessionForUser(userId, session);
  }

  return {
    fixtureVersion: fixture.fixtureVersion,
    ecp: {
      id: fixture.definition.id,
      name: fixture.definition.name,
      summary: fixture.definition.summary,
      defaultAction: fixture.definition.defaultAction,
    },
    anchorDate: fixture.anchorDate,
    counts: {
      days: fixture.days.length,
      namedFoods: fixture.days.reduce((sum, day) => sum + day.nutrition.foods.length, 0),
      healthSamples: fixture.days.length * 6,
      trainingSessions: fixture.sessions.length,
      additionalWorkouts: fixture.workouts.length,
      checkIns: fixture.days.length,
    },
    reviewPrompt: fixture.reviewPrompt,
  };
}
