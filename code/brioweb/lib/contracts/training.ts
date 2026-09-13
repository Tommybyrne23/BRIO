import { z } from "zod";
import {
  InputDataModeSchema,
  MutationIdSchema,
  NonEmptyIdSchema,
  NonNegativeNumberSchema,
  RevisionSchema,
  UtcTimestampSchema,
} from "./common";

export const SetTypeSchema = z.enum(["warm_up", "working"]);
export const TrainingSessionStatusSchema = z.enum(["draft", "active", "completed", "abandoned"]);

export const TrainingSetSchema = z.object({
  id: NonEmptyIdSchema,
  order: z.number().int().nonnegative(),
  type: SetTypeSchema,
  loadKg: NonNegativeNumberSchema.max(2000).nullable(),
  reps: z.number().int().nonnegative().max(1000).nullable(),
  rpe: z.number().finite().min(1).max(10).nullable(),
  notes: z.string().trim().max(500).default(""),
  completed: z.boolean(),
  completedAt: UtcTimestampSchema.nullable(),
  restStartedAt: UtcTimestampSchema.nullable(),
  restDurationSeconds: z.number().int().positive().max(3600).nullable(),
  restPausedRemainingSeconds: z.number().int().nonnegative().max(3600).nullable().default(null),
}).strict().superRefine((set, ctx) => {
  if (set.completed && (set.loadKg === null || set.reps === null || set.completedAt === null)) {
    ctx.addIssue({ code: "custom", message: "Completed sets require load, reps, and completedAt" });
  }
});

export const ExerciseSchema = z.object({
  id: NonEmptyIdSchema,
  order: z.number().int().nonnegative(),
  name: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(1000).default(""),
  sets: z.array(TrainingSetSchema).min(1).max(100),
}).strict();

const TrainingSessionBaseSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  id: NonEmptyIdSchema,
  title: z.string().trim().min(1).max(160),
  status: TrainingSessionStatusSchema,
  inputDataMode: InputDataModeSchema,
  startedAt: UtcTimestampSchema.nullable(),
  endedAt: UtcTimestampSchema.nullable(),
  exercises: z.array(ExerciseSchema).min(1).max(50),
  notes: z.string().trim().max(2000).default(""),
  revision: RevisionSchema,
  mutationId: MutationIdSchema,
  createdAt: UtcTimestampSchema,
  updatedAt: UtcTimestampSchema,
}).strict();

function validateSession(
  session: Pick<z.infer<typeof TrainingSessionBaseSchema>, "status" | "startedAt" | "endedAt">,
  ctx: z.RefinementCtx,
) {
  if (session.startedAt && session.endedAt && new Date(session.endedAt) < new Date(session.startedAt)) {
    ctx.addIssue({ code: "custom", path: ["endedAt"], message: "endedAt must be on or after startedAt" });
  }
  if (session.status === "completed" && (!session.startedAt || !session.endedAt)) {
    ctx.addIssue({ code: "custom", message: "Completed sessions require start and end timestamps" });
  }
}

export const TrainingSessionSchema = TrainingSessionBaseSchema.superRefine(validateSession);
export const TrainingSessionWriteSchema = TrainingSessionBaseSchema.omit({
  createdAt: true,
  updatedAt: true,
}).superRefine(validateSession);

export const WorkoutProjectionSchema = z.object({
  projectionKey: z.string().trim().min(1).max(255),
  sessionId: NonEmptyIdSchema,
  workoutType: z.literal("strength"),
  startDate: UtcTimestampSchema,
  endDate: UtcTimestampSchema,
  durationSeconds: NonNegativeNumberSchema,
  perceivedExertion: z.number().finite().min(1).max(10).nullable(),
  sourceName: z.literal("Brio session log"),
  metadata: z.object({
    schemaVersion: z.literal("1.0.0"),
    completedSetCount: z.number().int().nonnegative(),
    workingVolumeKg: NonNegativeNumberSchema,
    exerciseNames: z.array(z.string().trim().min(1).max(160)).max(50),
  }).strict(),
}).strict();

export type TrainingSession = z.infer<typeof TrainingSessionSchema>;
export type WorkoutProjection = z.infer<typeof WorkoutProjectionSchema>;
