// Friendly text per underlying data tool, for the chat UI's tool-level
// "agent thinking" detail trail. Purely cosmetic — falls back to the raw
// tool name for anything not listed here (e.g. a tool added later).
export const TOOL_LABELS: Record<string, string> = {
  get_sleep_summary: "Checking your sleep summary",
  get_sleep_sessions: "Reviewing raw sleep sessions",
  get_resting_heart_rate_trend: "Checking your heart rate trend",
  get_recent_heart_rate_samples: "Reviewing recent heart rate readings",
  get_daily_activity_summary: "Checking your daily activity",
  get_recent_workouts: "Reviewing recent workouts",
  get_training_load_summary: "Checking your training load",
  get_recent_health_samples: "Reviewing your recent health data",
};

export function labelForTool(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}
