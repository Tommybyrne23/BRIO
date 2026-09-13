import { z } from "zod";
import {
  TrainingProfileSchema,
  TrainingSessionWriteSchema,
  type DecisionAction,
  type TrainingProfile,
  type TrainingSession,
} from "@/lib/contracts";

export const ECP_FIXTURE_VERSION = "brio-ecp-fixture-v1" as const;
export const EcpIdSchema = z.enum([
  "young_male_athlete",
  "returning_professional",
  "endurance_builder",
  "strength_parent",
  "active_older_returner",
]);
export type EcpId = z.infer<typeof EcpIdSchema>;

type Food = {
  id: string;
  name: string;
  energyKcal: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  restrictionTagIds: string[];
};

type EcpDefinition = {
  id: EcpId;
  name: string;
  summary: string;
  defaultAction: DecisionAction;
  profile: TrainingProfile;
  goal: "build_strength" | "maintain" | "return_to_training" | "general_fitness";
  trainingBlock: "base" | "build" | "peak" | "deload" | "unstructured";
  sleepHours: number;
  heartRateBpm: number;
  steps: number;
  activeEnergyKcal: number;
  intakeKcal: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  checkIn: [number, number, number, number, number];
  workoutTypes: Array<"strength" | "run" | "cycle" | "hiit" | "yoga" | "walk">;
  exercises: [string, string];
  baseLoadKg: number;
  sessionRpe: number;
  foods: Array<Omit<Food, "id">>;
};

const food = (name: string, energyKcal: number, proteinGrams: number, carbohydrateGrams: number, fatGrams: number): Omit<Food, "id"> => ({
  name: `[SYNTHETIC DEMO FOOD] ${name}`,
  energyKcal,
  proteinGrams,
  carbohydrateGrams,
  fatGrams,
  restrictionTagIds: [],
});

const definitions: Record<EcpId, EcpDefinition> = {
  young_male_athlete: {
    id: "young_male_athlete",
    name: "Young male athlete",
    summary: "22-year-old high-activity athlete combining field sport and strength training.",
    defaultAction: "Progress",
    profile: { birthYear: 2004, sex: "male", activityLevel: "very_high", trainingExperience: "five_plus_years", primaryTraining: "mixed", trainingDaysPerWeek: 5, typicalSessionMinutes: 90, recentTrainingSummary: "[SYNTHETIC INPUT] Five mixed strength and field sessions weekly across the last eight weeks.", equipmentAccess: "[SYNTHETIC INPUT] Full gym, field, bike and recovery area.", completed: true },
    goal: "build_strength", trainingBlock: "build", sleepHours: 8.0, heartRateBpm: 56, steps: 11200, activeEnergyKcal: 820, intakeKcal: 3220, proteinGrams: 188, carbohydrateGrams: 405, fatGrams: 88, checkIn: [2, 2, 4, 2, 4], workoutTypes: ["strength", "hiit", "run", "strength", "strength"], exercises: ["Back squat", "Bench press"], baseLoadKg: 105, sessionRpe: 7,
    foods: [food("oats, banana and yogurt bowl", 720, 38, 112, 16), food("chicken rice bowl", 930, 66, 118, 22), food("salmon, potatoes and greens", 880, 56, 82, 34), food("milk and fruit snack", 420, 28, 52, 12)],
  },
  returning_professional: {
    id: "returning_professional",
    name: "Time-constrained returning professional",
    summary: "36-year-old returning to regular exercise with short home sessions.",
    defaultAction: "Maintain",
    profile: { birthYear: 1990, sex: "female", activityLevel: "moderate", trainingExperience: "less_than_1_year", primaryTraining: "general_fitness", trainingDaysPerWeek: 3, typicalSessionMinutes: 35, recentTrainingSummary: "[SYNTHETIC INPUT] Returned after a long break and completed two to three short sessions weekly.", equipmentAccess: "[SYNTHETIC INPUT] Adjustable dumbbells, resistance bands and walking routes.", completed: true },
    goal: "return_to_training", trainingBlock: "base", sleepHours: 6.9, heartRateBpm: 71, steps: 6600, activeEnergyKcal: 390, intakeKcal: 2080, proteinGrams: 108, carbohydrateGrams: 238, fatGrams: 74, checkIn: [3, 2, 3, 4, 3], workoutTypes: ["walk", "strength", "walk", "strength"], exercises: ["Goblet squat", "Dumbbell row"], baseLoadKg: 22, sessionRpe: 6.5,
    foods: [food("overnight oats", 480, 24, 72, 12), food("lentil soup and bread", 620, 30, 94, 14), food("chicken tray bake", 720, 52, 66, 26), food("fruit and yogurt", 260, 18, 34, 6)],
  },
  endurance_builder: {
    id: "endurance_builder",
    name: "Endurance event builder",
    summary: "29-year-old endurance athlete building toward a long-distance event.",
    defaultAction: "Repeat",
    profile: { birthYear: 1997, sex: "prefer_not_to_say", activityLevel: "high", trainingExperience: "three_to_five_years", primaryTraining: "endurance", trainingDaysPerWeek: 5, typicalSessionMinutes: 75, recentTrainingSummary: "[SYNTHETIC INPUT] Four endurance sessions and one strength-support session weekly; latest week matched the planned load.", equipmentAccess: "[SYNTHETIC INPUT] Outdoor routes, indoor trainer and basic gym.", completed: true },
    goal: "maintain", trainingBlock: "build", sleepHours: 7.5, heartRateBpm: 60, steps: 9400, activeEnergyKcal: 760, intakeKcal: 2880, proteinGrams: 136, carbohydrateGrams: 414, fatGrams: 76, checkIn: [3, 2, 4, 2, 4], workoutTypes: ["run", "cycle", "run", "strength", "cycle"], exercises: ["Split squat", "Calf raise"], baseLoadKg: 34, sessionRpe: 7.5,
    foods: [food("porridge with berries", 610, 24, 108, 12), food("rice and tofu bowl", 820, 38, 126, 20), food("pasta with tomato and turkey", 980, 52, 138, 24), food("banana recovery smoothie", 470, 24, 72, 9)],
  },
  strength_parent: {
    id: "strength_parent",
    name: "Strength-focused parent",
    summary: "43-year-old parent balancing three strength sessions with limited recovery time.",
    defaultAction: "Reduce",
    profile: { birthYear: 1983, sex: "male", activityLevel: "moderate", trainingExperience: "one_to_three_years", primaryTraining: "strength", trainingDaysPerWeek: 3, typicalSessionMinutes: 50, recentTrainingSummary: "[SYNTHETIC INPUT] Three weekly strength sessions; recent volume rose while entered effort also increased.", equipmentAccess: "[SYNTHETIC INPUT] Commercial gym during fixed lunchtime windows.", completed: true },
    goal: "build_strength", trainingBlock: "deload", sleepHours: 6.3, heartRateBpm: 70, steps: 7200, activeEnergyKcal: 470, intakeKcal: 2490, proteinGrams: 154, carbohydrateGrams: 278, fatGrams: 84, checkIn: [4, 4, 2, 4, 3], workoutTypes: ["strength", "walk", "strength", "strength"], exercises: ["Deadlift", "Overhead press"], baseLoadKg: 112, sessionRpe: 8.5,
    foods: [food("eggs and toast", 560, 34, 48, 24), food("beef and rice leftovers", 840, 54, 92, 28), food("pasta bake", 790, 46, 96, 24), food("protein yogurt and cereal", 310, 28, 42, 5)],
  },
  active_older_returner: {
    id: "active_older_returner",
    name: "Active older returner",
    summary: "58-year-old returning to structured activity with a user-entered stop condition.",
    defaultAction: "Escalate",
    profile: { birthYear: 1968, sex: "female", activityLevel: "moderate", trainingExperience: "one_to_three_years", primaryTraining: "mobility", trainingDaysPerWeek: 2, typicalSessionMinutes: 40, recentTrainingSummary: "[SYNTHETIC INPUT] User-entered stop condition: felt faint during the latest exertion. Do not generate a prescribed session; request external review without diagnosis.", equipmentAccess: "[SYNTHETIC INPUT] Community gym, light dumbbells and walking routes.", completed: true },
    goal: "return_to_training", trainingBlock: "unstructured", sleepHours: 7.1, heartRateBpm: 68, steps: 7100, activeEnergyKcal: 360, intakeKcal: 2010, proteinGrams: 104, carbohydrateGrams: 224, fatGrams: 78, checkIn: [4, 3, 3, 3, 3], workoutTypes: ["walk", "yoga", "walk", "strength"], exercises: ["Box squat", "Cable row"], baseLoadKg: 28, sessionRpe: 7,
    foods: [food("porridge and pear", 430, 18, 72, 10), food("bean and grain salad", 610, 28, 86, 18), food("white fish, potatoes and vegetables", 690, 48, 70, 22), food("cheese and crackers", 280, 14, 28, 14)],
  },
};

function dayAt(anchorDate: string, daysAgo: number) {
  const date = new Date(`${anchorDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function at(localDate: string, hour: number, minute = 0) {
  return `${localDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
}

function wave(index: number, spread: number) {
  return Math.sin(index * 1.41) * spread + Math.cos(index * 0.67) * spread * 0.35;
}

export function listEcpDefinitions() {
  return EcpIdSchema.options.map((id) => ({
    id,
    name: definitions[id].name,
    summary: definitions[id].summary,
    defaultAction: definitions[id].defaultAction,
  }));
}

export function createEcpFixture(ecpId: EcpId, anchorDate: string, ownerScope = "demo") {
  const definition = definitions[EcpIdSchema.parse(ecpId)];
  const scope = ownerScope.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48);
  const profile = TrainingProfileSchema.parse(definition.profile);
  const days = Array.from({ length: 14 }, (_, chronologicalIndex) => {
    const daysAgo = 13 - chronologicalIndex;
    const localDate = dayAt(anchorDate, daysAgo);
    const foodRotation = definition.foods.map((item, foodIndex): Food => ({
      ...item,
      id: `${ECP_FIXTURE_VERSION}:${ecpId}:${localDate}:food:${foodIndex}`,
      energyKcal: Math.max(0, Math.round(item.energyKcal + wave(chronologicalIndex + foodIndex, 18))),
    }));
    const totals = foodRotation.reduce((sum, item) => ({
      energyKcal: sum.energyKcal + item.energyKcal,
      proteinGrams: sum.proteinGrams + item.proteinGrams,
      carbohydrateGrams: sum.carbohydrateGrams + item.carbohydrateGrams,
      fatGrams: sum.fatGrams + item.fatGrams,
    }), { energyKcal: 0, proteinGrams: 0, carbohydrateGrams: 0, fatGrams: 0 });
    return {
      localDate,
      daysAgo,
      sleepHours: Math.round((definition.sleepHours + wave(chronologicalIndex, 0.35)) * 10) / 10,
      heartRateBpm: Math.round(definition.heartRateBpm + wave(chronologicalIndex + 3, 2.4)),
      steps: Math.max(1500, Math.round(definition.steps + wave(chronologicalIndex, 900))),
      activeEnergyKcal: Math.max(100, Math.round(definition.activeEnergyKcal + wave(chronologicalIndex + 1, 70))),
      nutrition: {
        energyIntakeKcal: Math.round((definition.intakeKcal + totals.energyKcal) / 2),
        proteinGrams: Math.round((definition.proteinGrams + totals.proteinGrams) / 2),
        carbohydrateGrams: Math.round((definition.carbohydrateGrams + totals.carbohydrateGrams) / 2),
        fatGrams: Math.round((definition.fatGrams + totals.fatGrams) / 2),
        foods: foodRotation,
      },
      checkIn: definition.checkIn.map((value, index) => Math.max(1, Math.min(5, value + (((chronologicalIndex + index) % 5 === 0) ? 1 : 0)))) as [number, number, number, number, number],
    };
  });

  const sessionDaysAgo = [12, 9, 6, 3];
  const sessions = sessionDaysAgo.map((daysAgo, sessionIndex): Omit<TrainingSession, "createdAt" | "updatedAt"> => {
    const localDate = dayAt(anchorDate, daysAgo);
    const start = at(localDate, 17);
    const end = at(localDate, 18);
    const sessionId = `${ECP_FIXTURE_VERSION}:${scope}:${ecpId}:session:${sessionIndex}`;
    const exercises = definition.exercises.map((exerciseName, exerciseIndex) => ({
      id: `${sessionId}:exercise:${exerciseIndex}`,
      order: exerciseIndex,
      name: exerciseName,
      notes: "[SYNTHETIC INPUT] Generated exercise history for the ECP demonstration.",
      sets: [0, 1, 2].map((setIndex) => {
        const working = setIndex > 0;
        const load = Math.max(1, Math.round((definition.baseLoadKg * (exerciseIndex ? 0.58 : 1) + sessionIndex * 1.5) * 2) / 2);
        return {
          id: `${sessionId}:exercise:${exerciseIndex}:set:${setIndex}`,
          order: setIndex,
          type: working ? "working" as const : "warm_up" as const,
          loadKg: working ? load : Math.round(load * 0.55),
          reps: exerciseIndex ? 8 : 5,
          rpe: working ? Math.min(10, definition.sessionRpe + sessionIndex * 0.15) : null,
          notes: "[SYNTHETIC INPUT] Demo set; not a real training record.",
          completed: true,
          completedAt: at(localDate, 17, 10 + exerciseIndex * 20 + setIndex * 4),
          restStartedAt: null,
          restDurationSeconds: working ? 120 : 75,
          restPausedRemainingSeconds: null,
        };
      }),
    }));
    return TrainingSessionWriteSchema.parse({
      schemaVersion: "1.0.0",
      id: sessionId,
      title: `[SYNTHETIC INPUT] ${definition.name} session ${sessionIndex + 1}`,
      status: "completed",
      inputDataMode: "synthetic_input",
      startedAt: start,
      endedAt: end,
      exercises,
      notes: `[SYNTHETIC INPUT] ${ECP_FIXTURE_VERSION}; not a real session.`,
      revision: 0,
      mutationId: `${sessionId}:mutation:1`,
    });
  });

  const workouts = days
    .filter((_, index) => index % 3 === 1)
    .map((day, index) => {
      const workoutType = definition.workoutTypes[index % definition.workoutTypes.length];
      const startDate = at(day.localDate, index % 2 ? 7 : 18);
      const durationMinutes = Math.max(25, definition.profile.typicalSessionMinutes! + Math.round(wave(index, 8)));
      return {
        externalId: `${ECP_FIXTURE_VERSION}:${scope}:${ecpId}:workout:${index}`,
        workoutType,
        startDate,
        endDate: new Date(new Date(startDate).getTime() + durationMinutes * 60_000).toISOString(),
        durationSeconds: durationMinutes * 60,
        distanceMeters: workoutType === "run" ? 7_000 + index * 400 : workoutType === "cycle" ? 24_000 + index * 1200 : null,
        activeEnergyKcal: Math.round(definition.activeEnergyKcal * 0.62 + index * 12),
        avgHeartRate: ["run", "cycle", "hiit"].includes(workoutType) ? definition.heartRateBpm + 76 : null,
        maxHeartRate: ["run", "cycle", "hiit"].includes(workoutType) ? definition.heartRateBpm + 108 : null,
        perceivedExertion: Math.min(10, definition.sessionRpe + (index % 3) * 0.25),
      };
    });

  return {
    fixtureVersion: ECP_FIXTURE_VERSION,
    definition: { ...definition, profile },
    anchorDate,
    days,
    sessions,
    workouts,
    reviewPrompt: "Review my last 14 days across training, entered nutrition, sleep and recovery. Separate observations, uncertainty and cross-domain interactions. State that the inputs are synthetic demo data, then propose exactly one bounded Brio action.",
  };
}

export type EcpFixture = ReturnType<typeof createEcpFixture>;
