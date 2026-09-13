import assert from "node:assert/strict";
import test from "node:test";
import { DecisionActionSchema } from "@/lib/contracts";
import { createEcpFixture, EcpIdSchema, listEcpDefinitions } from "./ecp-fixtures";

const anchorDate = "2026-09-13";

test("five ECPs cover exactly the five bounded actions", () => {
  const profiles = listEcpDefinitions();
  assert.equal(profiles.length, 5);
  assert.deepEqual(
    new Set(profiles.map((profile) => profile.defaultAction)),
    new Set(DecisionActionSchema.options),
  );
});

test("each ECP has deterministic labelled 14-day cross-domain history", () => {
  for (const ecpId of EcpIdSchema.options) {
    const first = createEcpFixture(ecpId, anchorDate, "owner-a");
    const second = createEcpFixture(ecpId, anchorDate, "owner-a");
    assert.deepEqual(first, second);
    assert.equal(first.days.length, 14);
    assert.equal(first.sessions.length, 4);
    assert.ok(first.workouts.length >= 4);
    assert.equal(first.definition.profile.completed, true);
    for (const day of first.days) {
      assert.equal(day.nutrition.foods.length, 4);
      assert.ok(day.sleepHours > 0);
      assert.ok(day.steps > 0);
      assert.ok(day.nutrition.energyIntakeKcal > 0);
      assert.ok(day.nutrition.foods.every((food) => food.name.startsWith("[SYNTHETIC DEMO FOOD]")));
    }
    assert.ok(first.sessions.every((session) => session.inputDataMode === "synthetic_input"));
    assert.match(first.reviewPrompt, /synthetic demo data/i);
  }
});

test("owner scope prevents stable training IDs colliding across demo accounts", () => {
  const a = createEcpFixture("young_male_athlete", anchorDate, "owner-a");
  const b = createEcpFixture("young_male_athlete", anchorDate, "owner-b");
  assert.notEqual(a.sessions[0].id, b.sessions[0].id);
});
