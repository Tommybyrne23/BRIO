import assert from "node:assert/strict";
import test from "node:test";
import { DemoScenarioSchema, DecisionActionSchema } from "@/lib/contracts";
import { createDemoFixture } from "./fixture";
import { createDemoStoreState, demoReducer } from "./store";

const anchor = "2026-09-13";

test("fixture generation is byte-deterministic for every scenario", () => {
  for (const scenario of DemoScenarioSchema.options) {
    assert.equal(JSON.stringify(createDemoFixture(anchor, scenario)), JSON.stringify(createDemoFixture(anchor, scenario)));
  }
});

test("the scenario set reaches exactly the five decision actions", () => {
  const actions = new Set(DemoScenarioSchema.options.map((scenario) => createDemoFixture(anchor, scenario).dashboard.decision?.action));
  assert.deepEqual([...actions].sort(), [...DecisionActionSchema.options].sort());
});

test("disagreement is explicit and separately labelled as simulated", () => {
  const fixture = createDemoFixture(anchor, "specialist_disagreement");
  assert.equal(fixture.dashboard.decision?.disagreement.present, true);
  assert.equal(fixture.dashboard.decision?.action, "Repeat");
  assert.equal(fixture.dashboard.decision?.executionMode, "simulated_decision");
  assert.deepEqual(fixture.dashboard.decision?.specialists.map((item) => item.suggestedAction), ["Maintain", "Repeat"]);
});

test("revoking sleep excludes the metric and stales the current decision", () => {
  const original = createDemoStoreState(anchor, "specialist_disagreement");
  const changed = demoReducer(original, { type: "toggle_signal", signal: "health_sleep", enabled: false });
  const sleep = changed.dashboard.metrics.find((metric) => metric.key === "sleep_duration");
  assert.equal(sleep?.state, "excluded");
  assert.equal(sleep?.displayValue, "Not being read");
  assert.equal(changed.dashboard.decision?.status, "stale");
  assert.equal(changed.consent.consentVersion, original.consent.consentVersion + 1);
});

test("fixture interaction mutations persist structured responses and completed sets", () => {
  let state = createDemoStoreState(anchor);
  state = demoReducer(state, { type: "respond", kind: "overridden", action: "Reduce", reason: "Schedule changed." });
  assert.equal(state.decisionResponse?.selectedAction, "Reduce");
  state = demoReducer(state, { type: "complete_set", setId: "demo-set-1" });
  assert.equal(state.trainingSession.exercises[0].sets[0].completed, true);
});
