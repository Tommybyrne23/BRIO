import assert from "node:assert/strict";
import test from "node:test";
import { parseTrainingDescription } from "./description-parser";
import { remainingRestSeconds } from "./rest-timer";

test("description parser creates an unsaved editable ledger with warm-up and working sets", () => {
  const result = parseTrainingDescription("Session: Lower\nBack squat: 2x5 warm-up at 40kg, 3x5 at 80kg RPE 7 with 2 min rest");
  assert.equal(result.saved, false);
  assert.equal(result.parser, "deterministic-pattern-parser-v1");
  assert.equal(result.interpretation.title, "Lower");
  assert.equal(result.interpretation.exercises[0].sets.length, 5);
  assert.deepEqual(result.interpretation.exercises[0].sets.map((set) => set.type), ["warm_up", "warm_up", "working", "working", "working"]);
  assert.equal(result.interpretation.exercises[0].sets[2].restDurationSeconds, 120);
  assert.equal(result.interpretation.status, "draft");
});

test("parser leaves uncertain sets empty and visibly warns", () => {
  const result = parseTrainingDescription("Mobility flow");
  assert.equal(result.interpretation.exercises[0].sets[0].loadKg, null);
  assert.equal(result.interpretation.exercises[0].sets[0].reps, null);
  assert.equal(result.warnings.length, 1);
});

test("rest remaining is derived from timestamps after an app switch", () => {
  const startedAt = "2026-09-12T20:00:00.000Z";
  assert.equal(remainingRestSeconds({ startedAt, durationSeconds: 120, pausedRemainingSeconds: null, nowMs: Date.parse("2026-09-12T20:00:35.900Z") }), 85);
  assert.equal(remainingRestSeconds({ startedAt, durationSeconds: 120, pausedRemainingSeconds: null, nowMs: Date.parse("2026-09-12T20:03:00.000Z") }), 0);
  assert.equal(remainingRestSeconds({ startedAt: null, durationSeconds: 120, pausedRemainingSeconds: 42, nowMs: Date.parse("2026-09-12T21:00:00.000Z") }), 42);
});
