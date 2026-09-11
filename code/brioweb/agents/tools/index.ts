import {
  buildGetDailyActivitySummaryTool,
  buildGetRecentHealthSamplesTool,
  buildGetRecentHeartRateSamplesTool,
  buildGetRestingHeartRateTrendTool,
  buildGetSleepSessionsTool,
  buildGetSleepSummaryTool,
} from "./health-samples";
import { buildGetRecentWorkoutsTool, buildGetTrainingLoadSummaryTool } from "./workouts";

// Grouped by domain agent. `userId` must come from the server (session or
// worker user-table iteration) — never from client/model input.

export function buildSleepTools(userId: string) {
  return [
    buildGetSleepSummaryTool(userId),
    buildGetSleepSessionsTool(userId),
    buildGetRecentHealthSamplesTool(userId),
  ];
}

export function buildTrainingTools(userId: string) {
  return [
    buildGetDailyActivitySummaryTool(userId),
    buildGetRecentWorkoutsTool(userId),
    buildGetTrainingLoadSummaryTool(userId),
    buildGetRecentHealthSamplesTool(userId),
  ];
}

export function buildRecoveryTools(userId: string) {
  return [
    buildGetRestingHeartRateTrendTool(userId),
    buildGetRecentHeartRateSamplesTool(userId),
    buildGetTrainingLoadSummaryTool(userId),
    buildGetSleepSummaryTool(userId),
    buildGetRecentHealthSamplesTool(userId),
  ];
}
