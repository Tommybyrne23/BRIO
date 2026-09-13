import { z } from "zod";
import {
  DEFAULT_TIME_ZONE,
  MutationIdSchema,
  RevisionSchema,
  TimeZoneSchema,
  UtcTimestampSchema,
} from "./common";

export const GoalSchema = z.enum(["build_strength", "maintain", "return_to_training", "general_fitness"]);
export const TrainingBlockSchema = z.enum(["base", "build", "peak", "deload", "unstructured"]);
export const UsageModeSchema = z.enum(["quiet", "guided", "coach"]);
export const SexSchema = z.enum(["female", "male", "intersex", "prefer_not_to_say"]);
export const ActivityLevelSchema = z.enum(["low", "moderate", "high", "very_high"]);
export const TrainingExperienceSchema = z.enum(["new", "less_than_1_year", "one_to_three_years", "three_to_five_years", "five_plus_years"]);
export const PrimaryTrainingSchema = z.enum(["strength", "endurance", "mixed", "team_sport", "mobility", "general_fitness"]);

const currentYear = new Date().getUTCFullYear();

export const TrainingProfileSchema = z.object({
  birthYear: z.number().int().min(currentYear - 100).max(currentYear - 16).nullable().default(null),
  sex: SexSchema.nullable().default(null),
  activityLevel: ActivityLevelSchema.nullable().default(null),
  trainingExperience: TrainingExperienceSchema.nullable().default(null),
  primaryTraining: PrimaryTrainingSchema.nullable().default(null),
  trainingDaysPerWeek: z.number().int().min(0).max(7).nullable().default(null),
  typicalSessionMinutes: z.number().int().min(10).max(300).nullable().default(null),
  recentTrainingSummary: z.string().trim().max(1000).default(""),
  equipmentAccess: z.string().trim().max(500).default(""),
  completed: z.boolean().default(false),
}).strict().superRefine((profile, ctx) => {
  if (!profile.completed) return;
  const required = ["birthYear", "activityLevel", "trainingExperience", "primaryTraining", "trainingDaysPerWeek", "typicalSessionMinutes"] as const;
  for (const key of required) if (profile[key] === null) ctx.addIssue({ code: "custom", path: [key], message: "Required to complete the training profile" });
  if (profile.recentTrainingSummary.length < 10) ctx.addIssue({ code: "custom", path: ["recentTrainingSummary"], message: "Describe recent training in at least 10 characters" });
});

export const RestrictionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  confirmed: z.boolean(),
}).strict();

export const PreferencesSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  timezone: TimeZoneSchema.default(DEFAULT_TIME_ZONE),
  goal: GoalSchema.default("build_strength"),
  trainingBlock: TrainingBlockSchema.default("base"),
  usageMode: UsageModeSchema.default("guided"),
  restrictionText: z.string().trim().max(1000).default(""),
  restrictions: z.array(RestrictionSchema).max(20).default([]),
  profile: TrainingProfileSchema.default({
    birthYear: null, sex: null, activityLevel: null, trainingExperience: null,
    primaryTraining: null, trainingDaysPerWeek: null, typicalSessionMinutes: null,
    recentTrainingSummary: "", equipmentAccess: "", completed: false,
  }),
  onboardingCompleted: z.boolean().default(false),
  revision: RevisionSchema,
  mutationId: MutationIdSchema,
  updatedAt: UtcTimestampSchema,
}).strict();

export const PreferencePatchSchema = PreferencesSchema.omit({ updatedAt: true }).partial({
  timezone: true,
  goal: true,
  trainingBlock: true,
  usageMode: true,
  restrictionText: true,
  restrictions: true,
  profile: true,
  onboardingCompleted: true,
}).required({ schemaVersion: true, revision: true, mutationId: true });

export const SignalKeySchema = z.enum([
  "health_steps",
  "health_active_energy",
  "health_heart_rate",
  "health_sleep",
  "manual_training",
  "manual_nutrition",
  "daily_check_in",
  "server_ai_processing",
]);

export const SignalConsentSchema = z.object({
  signal: SignalKeySchema,
  purpose: z.string().trim().min(1).max(240),
  sourceLabel: z.string().trim().min(1).max(120),
  enabled: z.boolean().default(false),
  changedAt: UtcTimestampSchema,
}).strict();

export const ConsentSnapshotSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  consentVersion: z.number().int().positive(),
  signals: z.array(SignalConsentSchema).length(SignalKeySchema.options.length).superRefine((signals, ctx) => {
    const keys = signals.map((signal) => signal.signal);
    if (new Set(keys).size !== SignalKeySchema.options.length) {
      ctx.addIssue({ code: "custom", message: "Consent snapshot must include each signal exactly once" });
    }
    for (const expected of SignalKeySchema.options) {
      if (!keys.includes(expected)) {
        ctx.addIssue({ code: "custom", message: `Missing consent signal: ${expected}` });
      }
    }
  }),
  updatedAt: UtcTimestampSchema,
}).strict();

export const ConsentPatchSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  expectedConsentVersion: z.number().int().positive(),
  mutationId: MutationIdSchema,
  changes: z.array(z.object({
    signal: SignalKeySchema,
    enabled: z.boolean(),
  }).strict()).min(1).max(SignalKeySchema.options.length),
}).strict();

export function createDefaultConsentSnapshot(timestamp: string): z.infer<typeof ConsentSnapshotSchema> {
  const purposes: Record<z.infer<typeof SignalKeySchema>, [string, string]> = {
    health_steps: ["Compare movement with your own recent pattern", "Apple Health helper"],
    health_active_energy: ["Show active energy separately from food intake", "Apple Health helper"],
    health_heart_rate: ["Show an ordinary heart-rate trend", "Apple Health helper"],
    health_sleep: ["Compare sleep duration with your own recent pattern", "Apple Health helper"],
    manual_training: ["Use sessions you choose to log in training decisions", "Manual entry"],
    manual_nutrition: ["Use nutrition totals you choose to enter", "Manual entry"],
    daily_check_in: ["Use your self-reported readiness context", "Manual check-in"],
    server_ai_processing: ["Allow selected evidence to be processed by the configured agent", "Brio server"],
  };

  return ConsentSnapshotSchema.parse({
    schemaVersion: "1.0.0",
    consentVersion: 1,
    signals: SignalKeySchema.options.map((signal) => ({
      signal,
      purpose: purposes[signal][0],
      sourceLabel: purposes[signal][1],
      enabled: false,
      changedAt: timestamp,
    })),
    updatedAt: timestamp,
  });
}

export const SourceStatusSchema = z.object({
  sourceKey: z.enum(["apple_health_helper", "manual_entry", "synthetic_fixture"]),
  label: z.string().trim().min(1).max(120),
  state: z.enum(["connected", "available", "stale", "unavailable", "simulated"]),
  observedSampleTypes: z.array(z.string().trim().min(1).max(255)).max(64),
  sampleCount: z.number().int().nonnegative(),
  lastSuccessfulIngestAt: UtcTimestampSchema.nullable(),
  latestSampleAt: UtcTimestampSchema.nullable(),
  lastAttemptError: z.string().trim().min(1).max(240).nullable(),
}).strict();

export type Preferences = z.infer<typeof PreferencesSchema>;
export type TrainingProfile = z.infer<typeof TrainingProfileSchema>;
export type ConsentSnapshot = z.infer<typeof ConsentSnapshotSchema>;
export type SignalKey = z.infer<typeof SignalKeySchema>;
export type SourceStatus = z.infer<typeof SourceStatusSchema>;
