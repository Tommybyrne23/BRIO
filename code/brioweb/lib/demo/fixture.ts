import {
  ConsentSnapshotSchema,
  DashboardSchema,
  DecisionSchema,
  DemoScenarioSchema,
  ManualLogSchema,
  PreferencesSchema,
  TrainingSessionSchema,
  type ConsentSnapshot,
  type Dashboard,
  type Decision,
  type Metric,
  type Preferences,
  type TrainingSession,
} from "@/lib/contracts";

export const DEMO_FIXTURE_VERSION = "brio-demo-v1" as const;
export const DEMO_PERSONA_ID = "synthetic-brio-demo" as const;
export type DemoScenario = (typeof DemoScenarioSchema.options)[number];

export type DemoDay = {
  localDate: string;
  steps: number;
  activeEnergyKcal: number;
  sleepHours: number;
  heartRateTrendBpm: number;
  energyIntakeKcal: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  trainingVolumeKg: number;
  sessionRpe: number;
};

export type DemoFixture = {
  fixtureVersion: typeof DEMO_FIXTURE_VERSION;
  persona: { id: typeof DEMO_PERSONA_ID; name: string; label: string };
  anchorDate: string;
  scenario: DemoScenario;
  history: DemoDay[];
  preferences: Preferences;
  consent: ConsentSnapshot;
  dashboard: Dashboard;
  manualLog: ReturnType<typeof ManualLogSchema.parse>;
  trainingSession: TrainingSession;
};

const dateAtOffset = (anchorDate: string, offset: number) => {
  const date = new Date(`${anchorDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

const at = (date: string, time = "08:00:00.000Z") => `${date}T${time}`;

function history(anchorDate: string): DemoDay[] {
  return Array.from({ length: 14 }, (_, index) => {
    const dayOffset = index - 13;
    const wave = [0, 350, -220, 180, 440, -130, 260][index % 7];
    return {
      localDate: dateAtOffset(anchorDate, dayOffset),
      steps: 7200 + wave,
      activeEnergyKcal: 470 + (index % 5) * 18,
      sleepHours: Number((7.1 + ((index % 4) - 1.5) * 0.18).toFixed(2)),
      heartRateTrendBpm: 64 + (index % 3) - 1,
      energyIntakeKcal: 2380 + (index % 4) * 70,
      proteinGrams: 152 + (index % 5) * 3,
      carbohydrateGrams: 255 + (index % 4) * 12,
      trainingVolumeKg: index % 3 === 0 ? 10350 + index * 45 : 0,
      sessionRpe: index % 3 === 0 ? 7 + (index % 2) * 0.5 : 0,
    };
  });
}

function provenance(
  anchorDate: string,
  sourceName: string,
  ingestionSource: "apple_health_helper" | "manual_entry" | "synthetic_fixture" | "unavailable",
  freshness: "fresh" | "stale" | "unknown" = "fresh",
) {
  const unavailable = ingestionSource === "unavailable";
  return {
    sourceName: unavailable ? null : sourceName,
    ingestionSource,
    inputDataMode: unavailable ? "unavailable" as const : "synthetic_input" as const,
    observedAt: unavailable ? null : at(anchorDate),
    captureTimeZone: "Europe/Dublin",
    sourceRecordCount: unavailable ? 0 : 1,
    coverage: unavailable ? 0 : 1,
    coverageStatus: unavailable ? "missing" as const : "complete" as const,
    freshness: unavailable ? "unknown" as const : freshness,
    confidence: unavailable ? "unknown" as const : "normal" as const,
    qualityReason: unavailable ? "no_synthetic_observation" : "synthetic_demo_fixture",
  };
}

function metric(
  anchorDate: string,
  key: Metric["key"],
  label: string,
  value: number | null,
  unit: string | null,
  state: Metric["state"],
  stateLabel: string,
  baselineText: string,
  source: string,
  sourceKind: "apple_health_helper" | "manual_entry" | "synthetic_fixture" | "unavailable" = "synthetic_fixture",
  freshness: "fresh" | "stale" | "unknown" = "fresh",
): Metric {
  return {
    key,
    label,
    value,
    displayValue: value === null ? (state === "excluded" ? "Not being read" : "No reading") : `${value}${unit ? ` ${unit}` : ""}`,
    unit,
    state,
    stateLabel,
    baselineText,
    evidenceWindow: "Today compared with the prior 7 available days",
    provenance: provenance(anchorDate, source, sourceKind, freshness),
  };
}

function consent(anchorDate: string, scenario: DemoScenario): ConsentSnapshot {
  const timestamp = at(anchorDate);
  const labels = {
    health_steps: ["Compare movement with your recent pattern", "Apple Health helper"],
    health_active_energy: ["Show active energy separately from intake", "Apple Health helper"],
    health_heart_rate: ["Show an ordinary heart-rate trend", "Apple Health helper"],
    health_sleep: ["Compare sleep duration with your recent pattern", "Apple Health helper"],
    manual_training: ["Use sessions you choose to log", "Manual entry"],
    manual_nutrition: ["Use nutrition totals you choose to enter", "Manual entry"],
    daily_check_in: ["Use your self-reported context", "Manual check-in"],
    server_ai_processing: ["Allow selected evidence to reach the configured agent", "Brio server"],
  } as const;
  return ConsentSnapshotSchema.parse({
    schemaVersion: "1.0.0",
    consentVersion: scenario === "signal_revoked" ? 3 : 2,
    signals: Object.entries(labels).map(([signal, [purpose, sourceLabel]]) => ({
      signal,
      purpose,
      sourceLabel,
      enabled: signal === "server_ai_processing" ? false : !(scenario === "signal_revoked" && signal === "health_sleep"),
      changedAt: timestamp,
    })),
    updatedAt: timestamp,
  });
}

function decision(anchorDate: string, scenario: DemoScenario): Decision {
  const setup: Record<DemoScenario, { action: Decision["action"]; status: Decision["status"]; reason: string; uncertainty: string[] }> = {
    normal_evidence: { action: "Progress", status: "proposed", reason: "Prototype policy found consistent synthetic training and recovery evidence; the displayed increase stays within its demo bound.", uncertainty: ["This is a rehearsed prototype policy over synthetic inputs."] },
    specialist_disagreement: { action: "Repeat", status: "proposed", reason: "Simulated readiness suggested Maintain while the prototype policy suggested Repeat. Repeat is retained because the policy does not support an increase from this evidence window.", uncertainty: ["The specialist summaries and disagreement are scripted for the demonstration."] },
    signal_revoked: { action: "Maintain", status: "proposed", reason: "Sleep is excluded immediately after consent was withdrawn, so the prototype policy holds the editable plan unchanged.", uncertainty: ["Sleep is not being read; the remaining evidence is limited."] },
    missing_nutrition: { action: "Maintain", status: "proposed", reason: "Nutrition is missing. The prototype policy does not infer an intake pattern from absent records.", uncertainty: ["No nutrition total was entered for the synthetic day."] },
    stale_helper: { action: "Reduce", status: "proposed", reason: "The helper evidence is stale and the latest self-report indicates higher effort. The bounded demo proposal reduces volume rather than asserting recovery.", uncertainty: ["Helper samples are synthetic and intentionally stale in this scenario."] },
    model_timeout: { action: "Maintain", status: "unavailable", reason: "The live-agent path timed out. No simulated answer replaced it; the last editable manual plan remains visible.", uncertainty: ["Agent output is unavailable. No model result was applied."] },
    escalation: { action: "Escalate", status: "escalated", reason: "The synthetic scenario contains a user-entered stop condition. Brio refuses to generate a session and suggests external review without making a diagnosis.", uncertainty: ["This is a scripted refusal path, not a diagnostic conclusion."] },
  };
  const current = setup[scenario];
  const specialists = scenario === "specialist_disagreement"
    ? [
      { specialist: "readiness" as const, status: "simulated" as const, suggestedAction: "Maintain" as const, summary: "Synthetic sleep and check-in context support holding the planned load." },
      { specialist: "prototype_policy" as const, status: "simulated" as const, suggestedAction: "Repeat" as const, summary: "The prototype rule finds no supported basis for progression and keeps the last completed structure." },
    ]
    : [{ specialist: "prototype_policy" as const, status: "simulated" as const, suggestedAction: current.action, summary: current.reason }];

  return DecisionSchema.parse({
    schemaVersion: "1.0.0",
    policyVersion: "prototype-1",
    id: `demo-decision-${scenario}`,
    status: current.status,
    action: current.action,
    proposal: current.action === "Escalate"
      ? { target: "manual_review", direction: "stop", amount: null, unit: "none", lowerBound: null, upperBound: null, editable: true, text: "Do not generate a session; review the stop condition." }
      : current.action === "Progress"
        ? { target: "session_load", direction: "increase", amount: 2.5, unit: "percent", lowerBound: 0, upperBound: 5, editable: true, text: "Consider up to 2.5% more load on the first working set." }
        : current.action === "Reduce"
          ? { target: "session_volume", direction: "decrease", amount: 1, unit: "sets", lowerBound: 0, upperBound: 2, editable: true, text: "Consider one fewer working set on the main lift." }
          : { target: "session_load", direction: current.action === "Repeat" ? "repeat" : "hold", amount: null, unit: "none", lowerBound: null, upperBound: null, editable: true, text: current.action === "Repeat" ? "Repeat the last completed working-set structure." : "Keep the planned load unchanged." },
    inputDataMode: "synthetic_input",
    executionMode: "simulated_decision",
    evidence: scenario === "model_timeout" ? [] : [
      { id: "demo-evidence-training", metricKey: "session_volume", sourceLabel: "Synthetic fixture", observedAt: at(anchorDate), evidenceWindow: "Prior 14 synthetic days", summary: "Working-set volume is within the fixture's recent band." },
      ...(scenario === "signal_revoked" ? [] : [{ id: "demo-evidence-sleep", metricKey: "sleep_duration" as const, sourceLabel: "Synthetic fixture", observedAt: at(anchorDate), evidenceWindow: "Prior 7 synthetic nights", summary: "Sleep duration is close to the fixture baseline." }]),
    ],
    excludedSignals: [
      ...(scenario === "signal_revoked" ? [{ signal: "health_sleep", reason: "not_consented" as const }] : []),
      ...(scenario === "missing_nutrition" ? [{ signal: "manual_nutrition", reason: "missing" as const }] : []),
    ],
    uncertainty: current.uncertainty,
    specialists,
    disagreement: { present: scenario === "specialist_disagreement", summary: scenario === "specialist_disagreement" ? "Readiness: Maintain. Prototype policy: Repeat. Final: Repeat." : null },
    policyReason: current.reason,
    consentVersion: scenario === "signal_revoked" ? 3 : 2,
    generatedAt: at(anchorDate, "09:00:00.000Z"),
    staleAt: null,
  });
}

export function createDemoFixture(anchorDate: string, scenario: DemoScenario = "specialist_disagreement"): DemoFixture {
  DemoScenarioSchema.parse(scenario);
  const days = history(anchorDate);
  const today = days.at(-1)!;
  const currentConsent = consent(anchorDate, scenario);
  const sleepExcluded = scenario === "signal_revoked";
  const nutritionMissing = scenario === "missing_nutrition";
  const helperStale = scenario === "stale_helper";

  const metrics = [
    metric(anchorDate, "session_volume", "Session volume", 10850, "kg", "within", "Within", "Within 4% of the prior synthetic session baseline.", "Synthetic session log"),
    metric(anchorDate, "session_effort", "Session effort", 7.5, "RPE", helperStale ? "above" : "within", helperStale ? "Above" : "Within", "Compared with the prior four synthetic sessions.", "Synthetic session log"),
    metric(anchorDate, "steps", "Steps", today.steps, "steps", helperStale ? "stale" : "within", helperStale ? "Stale" : "Within", "Close to the prior seven-day synthetic baseline.", "Simulated Apple Health", "synthetic_fixture", helperStale ? "stale" : "fresh"),
    metric(anchorDate, "energy_intake", "Energy intake", nutritionMissing ? null : today.energyIntakeKcal, "kcal", nutritionMissing ? "missing" : "within", nutritionMissing ? "Missing" : "Within", nutritionMissing ? "No synthetic nutrition total is present." : "Within the prior seven-day synthetic intake range.", nutritionMissing ? "Unavailable" : "Synthetic manual nutrition", nutritionMissing ? "unavailable" : "synthetic_fixture"),
    metric(anchorDate, "protein", "Protein", nutritionMissing ? null : today.proteinGrams, "g", nutritionMissing ? "missing" : "within", nutritionMissing ? "Missing" : "Within", nutritionMissing ? "No synthetic protein total is present." : "Close to the prior seven-day synthetic baseline.", nutritionMissing ? "Unavailable" : "Synthetic manual nutrition", nutritionMissing ? "unavailable" : "synthetic_fixture"),
    metric(anchorDate, "carbohydrate", "Carbohydrate", nutritionMissing ? null : today.carbohydrateGrams, "g", nutritionMissing ? "missing" : "within", nutritionMissing ? "Missing" : "Within", nutritionMissing ? "No synthetic carbohydrate total is present." : "Close to the prior seven-day synthetic baseline.", nutritionMissing ? "Unavailable" : "Synthetic manual nutrition", nutritionMissing ? "unavailable" : "synthetic_fixture"),
    metric(anchorDate, "sleep_duration", "Sleep duration", sleepExcluded ? null : today.sleepHours, "h", sleepExcluded ? "excluded" : "within", sleepExcluded ? "Not being read" : "Within", sleepExcluded ? "Sleep consent is off; stored values are not used." : "Close to the prior seven synthetic nights.", sleepExcluded ? "Consent control" : "Simulated Apple Health", sleepExcluded ? "unavailable" : "synthetic_fixture"),
    metric(anchorDate, "heart_rate_trend", "Heart-rate trend", today.heartRateTrendBpm, "bpm", helperStale ? "stale" : "within", helperStale ? "Stale" : "Within", "Ordinary heart-rate observations, not HRV or measured resting heart rate.", "Simulated Apple Health", "synthetic_fixture", helperStale ? "stale" : "fresh"),
    metric(anchorDate, "subjective_readiness", "Subjective readiness", 3, "/ 5", "within", "Within", "Self-report compared with the prior seven synthetic check-ins.", "Synthetic check-in"),
  ];

  const dashboard = DashboardSchema.parse({
    schemaVersion: "1.0.0",
    localDate: anchorDate,
    metrics,
    decision: decision(anchorDate, scenario),
    consentVersion: currentConsent.consentVersion,
    dataGeneratedAt: at(anchorDate, "09:00:00.000Z"),
    sourceStatuses: [
      { sourceKey: "synthetic_fixture", label: "Synthetic fixture", state: "simulated", observedSampleTypes: ["training", "nutrition", "sleep", "heart_rate", "steps"], sampleCount: 14, lastSuccessfulIngestAt: at(anchorDate), latestSampleAt: at(anchorDate), lastAttemptError: null },
      { sourceKey: "manual_entry", label: "Manual entry", state: "available", observedSampleTypes: ["nutrition", "check_in", "training"], sampleCount: 3, lastSuccessfulIngestAt: at(anchorDate), latestSampleAt: at(anchorDate), lastAttemptError: null },
    ],
  });

  const preferences = PreferencesSchema.parse({
    schemaVersion: "1.0.0", timezone: "Europe/Dublin", goal: "build_strength", trainingBlock: "build", usageMode: "guided", restrictionText: "Lactose", restrictions: [{ id: "lactose", label: "Lactose", confirmed: true }], onboardingCompleted: true, revision: 0, mutationId: "demo-preferences-v1", updatedAt: at(anchorDate),
  });

  const manualLog = ManualLogSchema.parse({
    schemaVersion: "1.0.0", localDate: anchorDate, nutrition: { energyIntakeKcal: today.energyIntakeKcal, proteinGrams: today.proteinGrams, carbohydrateGrams: today.carbohydrateGrams }, recovery: { sleepHours: today.sleepHours, readiness: 3 }, mutationId: "demo-manual-log-v1", revision: 0, recordedAt: at(anchorDate),
  });

  const trainingSession = TrainingSessionSchema.parse({
    schemaVersion: "1.0.0", id: "demo-session-001", title: "Lower strength", status: "active", inputDataMode: "synthetic_input", startedAt: at(anchorDate, "18:00:00.000Z"), endedAt: null, exercises: [{ id: "demo-exercise-squat", order: 0, name: "Back squat", notes: "", sets: [{ id: "demo-set-1", order: 0, type: "working", loadKg: 100, reps: 5, rpe: 7, completed: false, completedAt: null, restStartedAt: null, restDurationSeconds: 120 }, { id: "demo-set-2", order: 1, type: "working", loadKg: 100, reps: 5, rpe: 7.5, completed: false, completedAt: null, restStartedAt: null, restDurationSeconds: 120 }] }], notes: "Synthetic session for rehearsal", revision: 0, mutationId: "demo-session-v1", createdAt: at(anchorDate, "17:50:00.000Z"), updatedAt: at(anchorDate, "18:00:00.000Z"),
  });

  return { fixtureVersion: DEMO_FIXTURE_VERSION, persona: { id: DEMO_PERSONA_ID, name: "Alex", label: "Synthetic demonstration persona" }, anchorDate, scenario, history: days, preferences, consent: currentConsent, dashboard, manualLog, trainingSession };
}
