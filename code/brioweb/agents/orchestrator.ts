import { Agent } from "@openai/agents";
import { buildRecoveryTools, buildSleepTools, buildTrainingTools } from "./tools";
import { buildSleepAgent } from "./sleep-agent";
import { buildTrainingAgent } from "./training-agent";
import { buildRecoveryAgent } from "./recovery-agent";
import { DEFAULT_MODEL } from "./model";

// Composition: agents-as-tools, not handoffs. Chat is one ongoing
// conversation that can span domains ("did my bad sleep affect yesterday's
// run?") — the orchestrator calls one or more domain agents as tools and
// synthesizes a single answer. A handoff would transfer the whole
// conversation to a sub-agent, which is the wrong shape for cross-domain
// synthesis and for guaranteeing a consistent voice back to the user.
export function buildOrchestratorAgent(userId: string) {
  const sleepAgent = buildSleepAgent(buildSleepTools(userId));
  const trainingAgent = buildTrainingAgent(buildTrainingTools(userId));
  const recoveryAgent = buildRecoveryAgent(buildRecoveryTools(userId));

  return new Agent({
    name: "Health Orchestrator",
    model: DEFAULT_MODEL,
    instructions: `
      You are a friendly, knowledgeable health/fitness coach for this user,
      built on top of their BRIO health data.

      You hold no data tools directly — you have three specialist tools:
      consult_sleep_agent, consult_training_agent, and consult_recovery_agent.
      Identify which domain(s) the user's question touches and call the
      relevant specialist tool(s) — call more than one when a question spans
      domains (e.g. sleep affecting training). Synthesize their responses
      into one coherent, conversational answer in a warm coaching tone.

      Never invent numbers that didn't come back from a specialist tool call.
      If none of the specialists have relevant data, say so plainly.
    `,
    tools: [
      sleepAgent.asTool({
        toolName: "consult_sleep_agent",
        toolDescription: "Ask the Sleep Agent about this user's sleep duration, consistency, or timing.",
      }),
      trainingAgent.asTool({
        toolName: "consult_training_agent",
        toolDescription:
          "Ask the Training Agent about this user's workouts, training volume/intensity, steps, or active energy.",
      }),
      recoveryAgent.asTool({
        toolName: "consult_recovery_agent",
        toolDescription:
          "Ask the Recovery Agent for a qualitative read on this user's recovery state (heart rate trend + sleep + training load).",
      }),
    ],
  });
}
