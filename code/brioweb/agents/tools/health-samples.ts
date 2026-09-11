import { tool } from "@openai/agents";
import { z } from "zod";
import {
  getActivityDailyStatsForUser,
  getHeartRateDailyStatsForUser,
  getRecentSamplesForUser,
  getSamplesForUser,
  getSleepSummaryForUser,
} from "@/db/queries/health-samples";

const HEART_RATE_SAMPLE_TYPE = "HKQuantityTypeIdentifierHeartRate";
const SLEEP_SAMPLE_TYPE = "HKCategoryTypeIdentifierSleepAnalysis";

// Every tool factory below closes over `userId`, sourced server-side from the
// authenticated session (chat route) or a user-table iteration (worker).
// `userId` is deliberately never part of a tool's Zod `parameters` — the
// model can never supply or override it.

export function buildGetSleepSummaryTool(userId: string) {
  return tool({
    name: "get_sleep_summary",
    description:
      "Get nightly sleep duration totals (minutes actually asleep, excluding awake/in-bed time) for the last N days.",
    parameters: z.object({
      days: z.number().int().min(1).max(90).default(14),
    }),
    async execute({ days }) {
      const nights = await getSleepSummaryForUser(userId, days);
      return nights.map((n) => ({
        night: n.night,
        asleepMinutes: Math.round(Number(n.totalAsleepSeconds) / 60),
        segmentCount: Number(n.segmentCount),
        sleepStart: n.sleepStart,
        sleepEnd: n.sleepEnd,
      }));
    },
  });
}

export function buildGetSleepSessionsTool(userId: string) {
  return tool({
    name: "get_sleep_sessions",
    description: "Get raw sleep sample segments (asleep/awake/in-bed) for the last N days.",
    parameters: z.object({
      days: z.number().int().min(1).max(90).default(14),
    }),
    async execute({ days }) {
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const samples = await getSamplesForUser(userId, SLEEP_SAMPLE_TYPE, {
        start,
        end: new Date(),
      });
      return samples.map((s) => ({
        startDate: s.startDate,
        endDate: s.endDate,
        value: s.value,
        sourceName: s.sourceName,
      }));
    },
  });
}

export function buildGetRestingHeartRateTrendTool(userId: string) {
  return tool({
    name: "get_resting_heart_rate_trend",
    description:
      "Get daily min/avg/max heart rate for the last N days, as a proxy for a resting heart rate trend. No HRV data is available — do not reference HRV.",
    parameters: z.object({
      days: z.number().int().min(1).max(90).default(14),
    }),
    async execute({ days }) {
      const rows = await getHeartRateDailyStatsForUser(userId, days);
      return rows.map((r) => ({
        day: r.day,
        minHeartRate: Number(r.minHeartRate),
        avgHeartRate: Math.round(Number(r.avgHeartRate)),
        maxHeartRate: Number(r.maxHeartRate),
        sampleCount: Number(r.sampleCount),
      }));
    },
  });
}

export function buildGetRecentHeartRateSamplesTool(userId: string) {
  return tool({
    name: "get_recent_heart_rate_samples",
    description: "Get raw recent heart rate samples for fine-grained questions about a specific window.",
    parameters: z.object({
      days: z.number().int().min(1).max(14).default(3),
    }),
    async execute({ days }) {
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const samples = await getSamplesForUser(userId, HEART_RATE_SAMPLE_TYPE, {
        start,
        end: new Date(),
      });
      return samples.map((s) => ({
        startDate: s.startDate,
        value: s.value,
        unit: s.unit,
        sourceName: s.sourceName,
      }));
    },
  });
}

export function buildGetDailyActivitySummaryTool(userId: string) {
  return tool({
    name: "get_daily_activity_summary",
    description: "Get daily step count and active energy burned totals for the last N days.",
    parameters: z.object({
      days: z.number().int().min(1).max(90).default(14),
    }),
    async execute({ days }) {
      return getActivityDailyStatsForUser(userId, days);
    },
  });
}

export function buildGetRecentHealthSamplesTool(userId: string) {
  return tool({
    name: "get_recent_health_samples",
    description:
      "Fallback: get the most recent health samples of any type for this user, most recent first.",
    parameters: z.object({
      limit: z.number().int().min(1).max(100).default(50),
    }),
    async execute({ limit }) {
      const samples = await getRecentSamplesForUser(userId, limit);
      return samples.map((s) => ({
        sampleType: s.sampleType,
        value: s.value,
        unit: s.unit,
        startDate: s.startDate,
      }));
    },
  });
}
