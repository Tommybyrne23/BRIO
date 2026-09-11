import { tool } from "@openai/agents";
import { z } from "zod";
import { getWorkoutStatsForUser, getWorkoutsForUser } from "@/db/queries/workouts";

const WORKOUT_TYPES = ["run", "walk", "cycle", "strength", "swim", "hiit", "yoga"] as const;

export function buildGetRecentWorkoutsTool(userId: string) {
  return tool({
    name: "get_recent_workouts",
    description: "Get recent workouts with full detail (type, duration, distance, heart rate, calories).",
    parameters: z.object({
      days: z.number().int().min(1).max(180).default(30),
      workoutType: z.enum(WORKOUT_TYPES).optional(),
    }),
    async execute({ days, workoutType }) {
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const rows = await getWorkoutsForUser(userId, { start, end: new Date() }, workoutType);
      return rows.map((w) => ({
        workoutType: w.workoutType,
        startDate: w.startDate,
        durationSeconds: w.durationSeconds,
        distanceMeters: w.distanceMeters,
        activeEnergyKcal: w.activeEnergyKcal,
        avgHeartRate: w.avgHeartRate,
        maxHeartRate: w.maxHeartRate,
        perceivedExertion: w.perceivedExertion,
      }));
    },
  });
}

export function buildGetTrainingLoadSummaryTool(userId: string) {
  return tool({
    name: "get_training_load_summary",
    description:
      "Get aggregated training volume/intensity stats (workout count, total duration, total distance, avg heart rate, total calories) over the last N days.",
    parameters: z.object({
      days: z.number().int().min(1).max(180).default(28),
    }),
    async execute({ days }) {
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const stats = await getWorkoutStatsForUser(userId, { start, end: new Date() });
      return {
        workoutCount: Number(stats?.workoutCount ?? 0),
        totalDurationSeconds: Number(stats?.totalDurationSeconds ?? 0),
        totalDistanceMeters: Number(stats?.totalDistanceMeters ?? 0),
        totalActiveEnergyKcal: Number(stats?.totalActiveEnergyKcal ?? 0),
        avgHeartRate: stats?.avgHeartRate ? Math.round(Number(stats.avgHeartRate)) : null,
      };
    },
  });
}
