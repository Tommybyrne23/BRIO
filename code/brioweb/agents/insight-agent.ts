import { Agent, type Tool } from "@openai/agents";
import { DEFAULT_MODEL } from "./model";
import { InsightOutputSchema, type InsightDomain } from "./types";
import { SLEEP_AGENT_INSTRUCTIONS } from "./sleep-agent";
import { TRAINING_AGENT_INSTRUCTIONS } from "./training-agent";
import { RECOVERY_AGENT_INSTRUCTIONS } from "./recovery-agent";

const INSTRUCTIONS_BY_DOMAIN: Record<InsightDomain, string> = {
  sleep: SLEEP_AGENT_INSTRUCTIONS,
  training: TRAINING_AGENT_INSTRUCTIONS,
  recovery: RECOVERY_AGENT_INSTRUCTIONS,
};

const NAME_BY_DOMAIN: Record<InsightDomain, string> = {
  sleep: "Sleep Insight Agent",
  training: "Training Insight Agent",
  recovery: "Recovery Insight Agent",
};

// Worker-only: same instructions/tools as the chat-facing domain agent for
// this domain, but with a fixed Zod outputType so the worker gets validated
// structured JSON to persist into agent_insights, instead of free text.
export function buildInsightAgent(domain: InsightDomain, tools: Tool[]) {
  return new Agent({
    name: NAME_BY_DOMAIN[domain],
    model: DEFAULT_MODEL,
    instructions: `${INSTRUCTIONS_BY_DOMAIN[domain]}\n\nProduce today's ${domain} insight for this user based on their recent data.`,
    tools,
    outputType: InsightOutputSchema,
  });
}
