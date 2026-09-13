import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { trainingSessions, workouts } from "@/db/schema";
import { TrainingSessionSchema, type TrainingSession } from "@/lib/contracts";
import { ConflictError, NotFoundError } from "./errors";

function iso(value: Date | string) {
  return new Date(value).toISOString();
}

function fromRow(row: typeof trainingSessions.$inferSelect): TrainingSession {
  return TrainingSessionSchema.parse({
    ...(row.payload as object),
    id: row.id,
    title: row.title,
    status: row.status,
    inputDataMode: row.inputDataMode,
    revision: row.revision,
    mutationId: row.mutationId,
    startedAt: row.startedAt ? iso(row.startedAt) : null,
    endedAt: row.endedAt ? iso(row.endedAt) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  });
}

export async function listTrainingSessionsForUser(userId: string, limit = 50) {
  const rows = await db.select().from(trainingSessions).where(eq(trainingSessions.userId, userId))
    .orderBy(desc(trainingSessions.updatedAt)).limit(limit);
  return rows.map(fromRow);
}

export async function getTrainingSessionForUser(userId: string, id: string) {
  const [row] = await db.select().from(trainingSessions)
    .where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.id, id))).limit(1);
  return row ? fromRow(row) : null;
}

function comparableName(name: string) {
  return name.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export type ComparableExerciseHistory = {
  sessionId: string;
  sessionTitle: string;
  endedAt: string;
  exerciseName: string;
  sets: Array<Pick<TrainingSession["exercises"][number]["sets"][number], "type" | "loadKg" | "reps" | "rpe" | "restDurationSeconds" | "notes">>;
};

export async function getComparableExerciseHistoryForUser(userId: string, limit = 100) {
  const rows = await db.select().from(trainingSessions).where(and(
    eq(trainingSessions.userId, userId),
    eq(trainingSessions.status, "completed"),
  )).orderBy(desc(trainingSessions.endedAt)).limit(limit);
  const history: Record<string, ComparableExerciseHistory> = {};
  for (const row of rows) {
    const session = fromRow(row);
    for (const exercise of session.exercises) {
      const key = comparableName(exercise.name);
      if (!key || history[key]) continue;
      history[key] = {
        sessionId: session.id,
        sessionTitle: session.title,
        endedAt: session.endedAt ?? session.updatedAt,
        exerciseName: exercise.name,
        sets: exercise.sets.filter((set) => set.completed).map((set) => ({
          type: set.type,
          loadKg: set.loadKg,
          reps: set.reps,
          rpe: set.rpe,
          restDurationSeconds: set.restDurationSeconds,
          notes: set.notes,
        })),
      };
    }
  }
  return history;
}

export type SessionTotals = {
  workingVolumeKg: number;
  completedSetCount: number;
  reportedEffort: number | null;
};

function totalsFor(session: TrainingSession): SessionTotals {
  const completed = session.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.completed);
  const working = completed.filter((set) => set.type === "working");
  const rpes = working.flatMap((set) => set.rpe === null ? [] : [set.rpe]);
  return {
    workingVolumeKg: working.reduce((sum, set) => sum + (set.loadKg ?? 0) * (set.reps ?? 0), 0),
    completedSetCount: completed.length,
    reportedEffort: rpes.length ? Math.round((rpes.reduce((sum, value) => sum + value, 0) / rpes.length) * 10) / 10 : null,
  };
}

export async function getSessionComparisonForUser(userId: string, sessionId: string) {
  const current = await getTrainingSessionForUser(userId, sessionId);
  if (!current) return null;
  const names = new Set(current.exercises.map((exercise) => comparableName(exercise.name)).filter(Boolean));
  const currentCutoff = new Date(current.endedAt ?? current.createdAt).getTime();
  const candidates = await listTrainingSessionsForUser(userId, 100);
  const prior = candidates.find((candidate) => candidate.id !== sessionId && candidate.status === "completed" && new Date(candidate.endedAt ?? candidate.updatedAt).getTime() < currentCutoff && candidate.exercises.some((exercise) => names.has(comparableName(exercise.name))));
  return {
    current: totalsFor(current),
    prior: prior ? { sessionId: prior.id, title: prior.title, endedAt: prior.endedAt ?? prior.updatedAt, totals: totalsFor(prior) } : null,
  };
}

function sessionPayload(input: Omit<TrainingSession, "createdAt" | "updatedAt">) {
  return { schemaVersion: input.schemaVersion, exercises: input.exercises, notes: input.notes };
}

export async function saveTrainingSessionForUser(
  userId: string,
  input: Omit<TrainingSession, "createdAt" | "updatedAt">,
) {
  return db.transaction(async (tx) => {
    const [existingRow] = await tx.select().from(trainingSessions)
      .where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.id, input.id))).limit(1);
    if (existingRow?.mutationId === input.mutationId) return fromRow(existingRow);
    if (existingRow && existingRow.revision !== input.revision) {
      throw new ConflictError("Training session changed on another client");
    }

    let saved: typeof trainingSessions.$inferSelect | undefined;
    if (existingRow) {
      [saved] = await tx.update(trainingSessions).set({
        title: input.title,
        status: input.status,
        inputDataMode: input.inputDataMode,
        payload: sessionPayload(input),
        mutationId: input.mutationId,
        revision: sql`${trainingSessions.revision} + 1`,
        startedAt: input.startedAt ? new Date(input.startedAt) : null,
        endedAt: input.endedAt ? new Date(input.endedAt) : null,
        updatedAt: new Date(),
      }).where(and(
        eq(trainingSessions.userId, userId),
        eq(trainingSessions.id, input.id),
        eq(trainingSessions.revision, input.revision),
      )).returning();
    } else {
      [saved] = await tx.insert(trainingSessions).values({
        id: input.id,
        userId,
        title: input.title,
        status: input.status,
        inputDataMode: input.inputDataMode,
        payload: sessionPayload(input),
        mutationId: input.mutationId,
        revision: input.revision,
        startedAt: input.startedAt ? new Date(input.startedAt) : null,
        endedAt: input.endedAt ? new Date(input.endedAt) : null,
      }).returning();
    }

    if (!saved) throw new ConflictError("Training session was not saved");

    if (input.status === "completed" && input.startedAt && input.endedAt) {
      const workingSets = input.exercises.flatMap((exercise) => exercise.sets)
        .filter((set) => set.completed && set.type === "working");
      const volume = workingSets.reduce((sum, set) => sum + (set.loadKg ?? 0) * (set.reps ?? 0), 0);
      const rpes = workingSets.flatMap((set) => set.rpe === null ? [] : [set.rpe]);
      const avgRpe = rpes.length ? rpes.reduce((sum, value) => sum + value, 0) / rpes.length : null;
      const durationSeconds = Math.max(0, (new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime()) / 1000);

      await tx.insert(workouts).values({
        userId,
        workoutType: "strength",
        startDate: new Date(input.startedAt),
        endDate: new Date(input.endedAt),
        durationSeconds,
        perceivedExertion: avgRpe,
        sourceName: input.inputDataMode === "synthetic_input" ? "BRIO synthetic test generator" : "Brio session log",
        externalId: `brio-session:${input.id}`,
        metadata: {
          schemaVersion: "1.0.0",
          completedSetCount: workingSets.length,
          workingVolumeKg: volume,
          exerciseNames: input.exercises.map((exercise) => exercise.name),
          inputDataMode: input.inputDataMode,
        },
      }).onConflictDoUpdate({
        target: [workouts.userId, workouts.externalId],
        set: {
          startDate: sql`excluded.start_date`,
          endDate: sql`excluded.end_date`,
          durationSeconds: sql`excluded.duration_seconds`,
          perceivedExertion: sql`excluded.perceived_exertion`,
          sourceName: sql`excluded.source_name`,
          metadata: sql`excluded.metadata`,
        },
      });
    }

    return fromRow(saved);
  });
}

export async function requireTrainingSessionForUser(userId: string, id: string) {
  const session = await getTrainingSessionForUser(userId, id);
  if (!session) throw new NotFoundError("Training session not found");
  return session;
}
