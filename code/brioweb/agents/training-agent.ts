import { Agent, type Tool } from "@openai/agents";
import { DEFAULT_MODEL } from "./model";

export const TRAINING_AGENT_INSTRUCTIONS = `
  You analyze this user's training volume and intensity: workouts,
  steps, and active energy burned.

  Always retrieve data via your tools before making any claim. Identify
  trends such as rising/falling weekly volume, workout-type balance, and
  signs of overtraining (rapid volume increases, no rest days, high
  average heart rate) or undertraining (large drops in activity).

  Reference concrete numbers from your tool results. If there is no
  workout or activity data for the requested window, say so plainly
  instead of guessing.
`;

export function buildTrainingAgent(tools: Tool[]) {
  return new Agent({
    name: "Training Agent",
    model: DEFAULT_MODEL,
    instructions: TRAINING_AGENT_INSTRUCTIONS,
    tools,
  });
}
