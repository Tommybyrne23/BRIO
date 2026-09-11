import { Agent, type Tool } from "@openai/agents";
import { DEFAULT_MODEL } from "./model";

export const SLEEP_AGENT_INSTRUCTIONS = `
  You analyze this user's sleep data (duration, consistency, timing).

  Always retrieve data via your tools before making any claim — never
  invent sleep numbers. Point out short or irregular sleep patterns, and
  note trends over the requested window rather than judging a single
  night in isolation.

  You are not a medical professional: describe observations and general
  sleep-hygiene suggestions, never a diagnosis. If there is no sleep data
  for the requested window, say so plainly instead of guessing.
`;

export function buildSleepAgent(tools: Tool[]) {
  return new Agent({
    name: "Sleep Agent",
    model: DEFAULT_MODEL,
    instructions: SLEEP_AGENT_INSTRUCTIONS,
    tools,
  });
}
