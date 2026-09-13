import { z } from "zod";
import {
  LocalDateSchema,
  MutationIdSchema,
  NonNegativeNumberSchema,
  ProvenanceSchema,
  RevisionSchema,
  UtcTimestampSchema,
} from "./common";

export const MetricKeySchema = z.enum([
  "session_volume",
  "session_effort",
  "steps",
  "energy_intake",
  "protein",
  "carbohydrate",
  "sleep_duration",
  "heart_rate_trend",
  "subjective_readiness",
]);

export const MetricStateSchema = z.enum([
  "above",
  "within",
  "below",
  "missing",
  "excluded",
  "stale",
  "insufficient",
]);

export const MetricSchema = z.object({
  key: MetricKeySchema,
  label: z.string().trim().min(1).max(80),
  value: z.number().finite().nullable(),
  displayValue: z.string().trim().min(1).max(80),
  unit: z.string().trim().min(1).max(40).nullable(),
  state: MetricStateSchema,
  stateLabel: z.string().trim().min(1).max(80),
  baselineText: z.string().trim().min(1).max(240),
  evidenceWindow: z.string().trim().min(1).max(120),
  provenance: ProvenanceSchema,
}).strict().superRefine((metric, ctx) => {
  const absent = ["missing", "excluded", "insufficient"].includes(metric.state);
  if (absent && metric.value !== null) {
    ctx.addIssue({ code: "custom", path: ["value"], message: `${metric.state} metrics must have a null value` });
  }
  if (!absent && metric.value === null) {
    ctx.addIssue({ code: "custom", path: ["value"], message: `${metric.state} metrics require a value` });
  }
});

export const CheckInItemKeySchema = z.enum([
  "fatigue",
  "muscle_soreness",
  "sleep_quality",
  "stress",
  "mood",
]);

const rating = z.number().int().min(1).max(5);
const checkInResponse = <T extends z.infer<typeof CheckInItemKeySchema>>(key: T) => z.object({
  key: z.literal(key),
  rating,
}).strict();

export const DailyCheckInSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  localDate: LocalDateSchema,
  responses: z.tuple([
    checkInResponse("fatigue"),
    checkInResponse("muscle_soreness"),
    checkInResponse("sleep_quality"),
    checkInResponse("stress"),
    checkInResponse("mood"),
  ]),
  mutationId: MutationIdSchema,
  revision: RevisionSchema,
  recordedAt: UtcTimestampSchema,
}).strict();

const NamedFoodSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  energyKcal: NonNegativeNumberSchema.nullable().default(null),
  proteinGrams: NonNegativeNumberSchema.nullable().default(null),
  carbohydrateGrams: NonNegativeNumberSchema.nullable().default(null),
  fatGrams: NonNegativeNumberSchema.nullable().default(null),
  restrictionTagIds: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
}).strict();

export const ManualLogSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  localDate: LocalDateSchema,
  overall: z.object({
    bodyWeightKg: NonNegativeNumberSchema.max(500).optional(),
    note: z.string().trim().max(1000).optional(),
  }).strict().optional(),
  training: z.object({
    trained: z.boolean().optional(),
    effort: z.number().int().min(1).max(10).optional(),
    durationMinutes: NonNegativeNumberSchema.max(1440).optional(),
  }).strict().optional(),
  nutrition: z.object({
    energyIntakeKcal: NonNegativeNumberSchema.max(20000).optional(),
    proteinGrams: NonNegativeNumberSchema.max(2000).optional(),
    carbohydrateGrams: NonNegativeNumberSchema.max(3000).optional(),
    fatGrams: NonNegativeNumberSchema.max(2000).optional(),
    foods: z.array(NamedFoodSchema).max(50).optional(),
  }).strict().optional(),
  recovery: z.object({
    sleepHours: NonNegativeNumberSchema.max(24).optional(),
    readiness: z.number().int().min(1).max(5).optional(),
  }).strict().optional(),
  supplements: z.object({
    names: z.array(z.string().trim().min(1).max(120)).max(30),
  }).strict().optional(),
  mutationId: MutationIdSchema,
  revision: RevisionSchema,
  recordedAt: UtcTimestampSchema,
}).strict().refine((value) => Boolean(
  value.overall || value.training || value.nutrition || value.recovery || value.supplements,
), { message: "Enter at least one manual log field" });

export type Metric = z.infer<typeof MetricSchema>;
export type DailyCheckIn = z.infer<typeof DailyCheckInSchema>;
export type ManualLog = z.infer<typeof ManualLogSchema>;
