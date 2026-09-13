import "server-only";

import {
  DashboardSchema,
  type Metric,
  type Provenance,
  type SignalKey,
} from "@/lib/contracts";
import {
  getActivityDailyStatsForUser,
  getHeartRateDailyStatsForUser,
  getSleepSummaryForUser,
} from "./health-samples";
import {
  getCheckInForUser,
  getConsentForUser,
  getManualLogForUser,
} from "./product-state";
import { getCurrentDecisionForUser } from "./decisions";
import { getSourceStatusesForUser } from "./governance";
import { listTrainingSessionsForUser } from "./training-sessions";

function observedProvenance(input: {
  sourceName: string;
  mode: "live" | "manual" | "synthetic_input";
  observedAt: string;
  count?: number;
  freshness?: "fresh" | "stale";
}): Provenance {
  return {
    sourceName: input.sourceName,
    ingestionSource: input.mode === "live" ? "apple_health_helper" : input.mode === "synthetic_input" ? "synthetic_fixture" : "manual_entry",
    inputDataMode: input.mode,
    observedAt: input.observedAt,
    captureTimeZone: "Europe/Dublin",
    sourceRecordCount: input.count ?? 1,
    coverage: 1,
    coverageStatus: "complete",
    freshness: input.freshness ?? "fresh",
    confidence: "normal",
    qualityReason: input.mode === "live" ? "consented_source_observation" : input.mode === "synthetic_input" ? "explicitly_labelled_synthetic_test_input" : "user_entered_value",
  };
}

function absentProvenance(reason: "not_consented" | "no_observation"): Provenance {
  return {
    sourceName: null,
    ingestionSource: "unavailable",
    inputDataMode: "unavailable",
    observedAt: null,
    captureTimeZone: "Europe/Dublin",
    sourceRecordCount: 0,
    coverage: 0,
    coverageStatus: "missing",
    freshness: "unknown",
    confidence: "unknown",
    qualityReason: reason,
  };
}

function absentMetric(key: Metric["key"], label: string, unit: string | null, consented: boolean): Metric {
  const excluded = !consented;
  return {
    key,
    label,
    value: null,
    displayValue: excluded ? "Not being read" : "No reading",
    unit,
    state: excluded ? "excluded" : "missing",
    stateLabel: excluded ? "Not being read" : "Missing",
    baselineText: excluded ? "This signal is off in Data controls." : "No usable observation is available for this date.",
    evidenceWindow: "Today; prior observations excluded from today's value",
    provenance: absentProvenance(excluded ? "not_consented" : "no_observation"),
  };
}

function stateAgainstBaseline(value: number, baseline: number | null): { state: "above" | "within" | "below"; text: string } {
  if (baseline === null || baseline === 0) return { state: "within", text: "No prior baseline is available; showing the observation without comparison." };
  const difference = (value - baseline) / Math.abs(baseline);
  if (difference > 0.15) return { state: "above", text: `Above the mean of ${Math.round(baseline * 10) / 10} from prior available days.` };
  if (difference < -0.15) return { state: "below", text: `Below the mean of ${Math.round(baseline * 10) / 10} from prior available days.` };
  return { state: "within", text: `Within 15% of the mean ${Math.round(baseline * 10) / 10} from prior available days.` };
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export async function getDashboardForUser(userId: string, localDate: string) {
  const [consent, activity, sleep, heart, manual, checkIn, sessions, decision, sources] = await Promise.all([
    getConsentForUser(userId),
    getActivityDailyStatsForUser(userId, 15),
    getSleepSummaryForUser(userId, 15),
    getHeartRateDailyStatsForUser(userId, 15),
    getManualLogForUser(userId, localDate),
    getCheckInForUser(userId, localDate),
    listTrainingSessionsForUser(userId, 40),
    getCurrentDecisionForUser(userId),
    getSourceStatusesForUser(userId),
  ]);
  const enabled = (signal: SignalKey) => consent.signals.some((entry) => entry.signal === signal && entry.enabled);
  const todayActivity = activity.find((row) => String(row.day).slice(0, 10) === localDate);
  const priorActivity = activity.filter((row) => String(row.day).slice(0, 10) !== localDate);
  const todaySleep = sleep.find((row) => String(row.night).slice(0, 10) === localDate);
  const priorSleep = sleep.filter((row) => String(row.night).slice(0, 10) !== localDate);
  const todayHeart = heart.find((row) => String(row.day).slice(0, 10) === localDate);
  const priorHeart = heart.filter((row) => String(row.day).slice(0, 10) !== localDate);
  const todaySessions = sessions.filter((session) => session.startedAt ? session.startedAt.slice(0, 10) === localDate : session.status !== "completed" && session.updatedAt.slice(0, 10) === localDate);
  const completedSets = todaySessions.flatMap((session) => session.exercises.flatMap((exercise) => exercise.sets)).filter((set) => set.completed && set.type === "working");
  const trainingVolume = completedSets.reduce((sum, set) => sum + (set.loadKg ?? 0) * (set.reps ?? 0), 0);
  const effortValues = completedSets.flatMap((set) => set.rpe === null ? [] : [set.rpe]);
  const effort = average(effortValues);
  const generatedAt = new Date().toISOString();

  function liveMetric(args: { key: Metric["key"]; label: string; value: number; unit: string; baseline: number | null; source: string; observedAt: string; count?: number; synthetic?: boolean }): Metric {
    const comparison = stateAgainstBaseline(args.value, args.baseline);
    return { key: args.key, label: args.label, value: Math.round(args.value * 100) / 100, displayValue: `${Math.round(args.value * 100) / 100} ${args.unit}`, unit: args.unit, state: comparison.state, stateLabel: comparison.state[0].toUpperCase() + comparison.state.slice(1), baselineText: comparison.text, evidenceWindow: "Today compared with prior available days; today is excluded from the baseline", provenance: observedProvenance({ sourceName: args.synthetic ? "BRIO synthetic test generator" : args.source, mode: args.synthetic ? "synthetic_input" : "live", observedAt: args.observedAt, count: args.count }) };
  }

  function manualMetric(args: { key: Metric["key"]; label: string; value: number; unit: string; source?: string; synthetic?: boolean }): Metric {
    return { key: args.key, label: args.label, value: args.value, displayValue: `${args.value} ${args.unit}`, unit: args.unit, state: "within", stateLabel: args.synthetic ? "Synthetic input" : "Entered", baselineText: args.synthetic ? "Explicitly labelled synthetic test input; not a live observation." : "Manual observation shown without an inferred target.", evidenceWindow: "Current manual entry", provenance: observedProvenance({ sourceName: args.synthetic ? "BRIO synthetic test generator" : args.source ?? "Manual entry", mode: args.synthetic ? "synthetic_input" : "manual", observedAt: manual?.recordedAt ?? generatedAt }) };
  }

  const trainingAllowed = enabled("manual_training");
  const nutritionAllowed = enabled("manual_nutrition");
  const checkInAllowed = enabled("daily_check_in");
  const trainingSynthetic = todaySessions.some((session) => session.inputDataMode === "synthetic_input");
  const manualSynthetic = Boolean(manual?.mutationId.startsWith("synthetic-") || manual?.overall?.note?.startsWith("[SYNTHETIC INPUT]"));
  const checkInSynthetic = Boolean(checkIn?.mutationId.startsWith("synthetic-"));
  const metrics: Metric[] = [
    trainingAllowed && completedSets.length ? manualMetric({ key: "session_volume", label: "Session volume", value: trainingVolume, unit: "kg", source: "Brio session log", synthetic: trainingSynthetic }) : absentMetric("session_volume", "Session volume", "kg", trainingAllowed),
    trainingAllowed && effort !== null ? manualMetric({ key: "session_effort", label: "Session effort", value: Math.round(effort * 10) / 10, unit: "RPE", source: "Brio session log", synthetic: trainingSynthetic }) : absentMetric("session_effort", "Session effort", "RPE", trainingAllowed),
    enabled("health_steps") && todayActivity ? liveMetric({ key: "steps", label: "Steps", value: todayActivity.steps, unit: "steps", baseline: average(priorActivity.map((row) => row.steps)), source: "Apple Health helper", observedAt: `${localDate}T23:59:00.000Z`, synthetic: todayActivity.stepsSynthetic }) : absentMetric("steps", "Steps", "steps", enabled("health_steps")),
    nutritionAllowed && manual?.nutrition?.energyIntakeKcal !== undefined ? manualMetric({ key: "energy_intake", label: "Energy intake", value: manual.nutrition.energyIntakeKcal, unit: "kcal", synthetic: manualSynthetic }) : absentMetric("energy_intake", "Energy intake", "kcal", nutritionAllowed),
    nutritionAllowed && manual?.nutrition?.proteinGrams !== undefined ? manualMetric({ key: "protein", label: "Protein", value: manual.nutrition.proteinGrams, unit: "g", synthetic: manualSynthetic }) : absentMetric("protein", "Protein", "g", nutritionAllowed),
    nutritionAllowed && manual?.nutrition?.carbohydrateGrams !== undefined ? manualMetric({ key: "carbohydrate", label: "Carbohydrate", value: manual.nutrition.carbohydrateGrams, unit: "g", synthetic: manualSynthetic }) : absentMetric("carbohydrate", "Carbohydrate", "g", nutritionAllowed),
    enabled("health_sleep") && todaySleep ? liveMetric({ key: "sleep_duration", label: "Sleep duration", value: Number(todaySleep.totalAsleepSeconds) / 3600, unit: "h", baseline: average(priorSleep.map((row) => Number(row.totalAsleepSeconds) / 3600)), source: "Apple Health helper", observedAt: new Date(todaySleep.sleepEnd).toISOString(), count: Number(todaySleep.segmentCount), synthetic: Number(todaySleep.syntheticCount) > 0 }) : absentMetric("sleep_duration", "Sleep duration", "h", enabled("health_sleep")),
    enabled("health_heart_rate") && todayHeart ? liveMetric({ key: "heart_rate_trend", label: "Heart-rate trend", value: Number(todayHeart.avgHeartRate), unit: "bpm", baseline: average(priorHeart.map((row) => Number(row.avgHeartRate))), source: "Apple Health helper", observedAt: `${localDate}T23:59:00.000Z`, count: Number(todayHeart.sampleCount), synthetic: Number(todayHeart.syntheticCount) > 0 }) : absentMetric("heart_rate_trend", "Heart-rate trend", "bpm", enabled("health_heart_rate")),
    checkInAllowed && checkIn ? manualMetric({ key: "subjective_readiness", label: "Subjective readiness", value: Math.round(average(checkIn.responses.map((item) => item.rating))! * 10) / 10, unit: "/ 5", source: "Daily check-in", synthetic: checkInSynthetic }) : absentMetric("subjective_readiness", "Subjective readiness", "/ 5", checkInAllowed),
  ];

  return DashboardSchema.parse({ schemaVersion: "1.0.0", localDate, metrics, decision, consentVersion: consent.consentVersion, dataGeneratedAt: generatedAt, sourceStatuses: sources });
}
