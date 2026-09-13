import assert from "node:assert/strict";
import test from "node:test";
import {
  ConsentSnapshotSchema,
  DecisionActionSchema,
  DecisionSchema,
  HealthSampleRequestSchema,
  MAX_INGEST_BATCH_SIZE,
  MetricSchema,
  createDefaultConsentSnapshot,
  normalizeHealthSampleRequest,
} from "./index";

const now = "2026-09-12T20:00:00.000Z";
const sample = {
  sampleType: "HKQuantityTypeIdentifierStepCount",
  value: 1200,
  unit: "count",
  startDate: "2026-09-12T08:00:00.000Z",
  endDate: "2026-09-12T09:00:00.000Z",
  sourceName: "Apple Watch",
  externalId: "sample-1",
};

test("health ingest preserves all three existing payload shapes", () => {
  for (const input of [sample, [sample], { samples: [sample] }]) {
    const parsed = HealthSampleRequestSchema.parse(input);
    assert.equal(normalizeHealthSampleRequest(parsed).length, 1);
  }
});

test("health ingest rejects non-finite values, reversed dates, empty ids, and oversized batches", () => {
  assert.equal(HealthSampleRequestSchema.safeParse({ ...sample, value: Number.POSITIVE_INFINITY }).success, false);
  assert.equal(HealthSampleRequestSchema.safeParse({ ...sample, startDate: sample.endDate, endDate: sample.startDate }).success, false);
  assert.equal(HealthSampleRequestSchema.safeParse({ ...sample, externalId: "" }).success, false);
  assert.equal(HealthSampleRequestSchema.safeParse(Array.from({ length: MAX_INGEST_BATCH_SIZE + 1 }, () => sample)).success, false);
});

test("all optional consent begins off and every signal appears exactly once", () => {
  const snapshot = createDefaultConsentSnapshot(now);
  assert.equal(snapshot.signals.every((signal) => signal.enabled === false), true);
  assert.equal(ConsentSnapshotSchema.safeParse(snapshot).success, true);
  assert.equal(ConsentSnapshotSchema.safeParse({ ...snapshot, signals: snapshot.signals.slice(1) }).success, false);
});

test("decision action enum contains exactly the five bounded actions", () => {
  assert.deepEqual(DecisionActionSchema.options, ["Progress", "Maintain", "Repeat", "Reduce", "Escalate"]);
  assert.equal(DecisionActionSchema.safeParse("Recover").success, false);
});

test("missing metric is different from zero", () => {
  const base = {
    key: "steps" as const,
    label: "Steps",
    displayValue: "No reading",
    unit: "count",
    state: "missing" as const,
    stateLabel: "Missing",
    baselineText: "No baseline is available.",
    evidenceWindow: "Today",
    provenance: {
      sourceName: null,
      ingestionSource: "unavailable" as const,
      inputDataMode: "unavailable" as const,
      observedAt: null,
      captureTimeZone: null,
      sourceRecordCount: 0,
      coverage: 0,
      coverageStatus: "missing" as const,
      freshness: "unknown" as const,
      confidence: "unknown" as const,
      qualityReason: "no_observation",
    },
  };
  assert.equal(MetricSchema.safeParse({ ...base, value: null }).success, true);
  assert.equal(MetricSchema.safeParse({ ...base, value: 0 }).success, false);
});

test("decision rejects invalid status transitions and incompatible proposal units", () => {
  const decision = {
    schemaVersion: "1.0.0",
    policyVersion: "prototype-1",
    id: "decision-1",
    status: "proposed",
    action: "Maintain",
    proposal: {
      target: "session_load",
      direction: "hold",
      amount: null,
      unit: "none",
      lowerBound: null,
      upperBound: null,
      editable: true,
      text: "Keep the planned load unchanged.",
    },
    inputDataMode: "manual",
    executionMode: "deterministic_prototype",
    evidence: [],
    excludedSignals: [],
    uncertainty: ["Only manual entries are available."],
    specialists: [],
    disagreement: { present: false, summary: null },
    policyReason: "Prototype policy found no supported reason to change the session.",
    consentVersion: 1,
    generatedAt: now,
    staleAt: null,
  };
  assert.equal(DecisionSchema.safeParse(decision).success, true);
  assert.equal(DecisionSchema.safeParse({ ...decision, action: "Escalate" }).success, false);
  assert.equal(DecisionSchema.safeParse({ ...decision, proposal: { ...decision.proposal, amount: 5 } }).success, false);
});
