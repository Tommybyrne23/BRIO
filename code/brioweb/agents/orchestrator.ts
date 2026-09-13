import { Agent, type RunStreamEvent } from "@openai/agents";
import { buildNutritionTools, buildRecoveryTools, buildSleepTools, buildTrainingTools } from "./tools";
import { buildSleepAgent } from "./sleep-agent";
import { buildTrainingAgent } from "./training-agent";
import { buildRecoveryAgent } from "./recovery-agent";
import { buildNutritionAgent } from "./nutrition-agent";
import { AGENT_MODEL } from "./model";
import type { AgentKey } from "./chat-events";

// Tool name (as the orchestrator's model sees it) -> which domain agent it
// consults. Exported so app/api/chat/route.ts can map top-level tool_called/
// tool_output events to an AgentKey without hardcoding a second copy of
// these strings.
export const CONSULT_TOOL_TO_AGENT: Record<string, AgentKey> = {
  consult_sleep_agent: "sleep",
  consult_training_agent: "training",
  consult_nutrition_agent: "nutrition",
  consult_recovery_agent: "recovery",
};

// Composition: agents-as-tools, not handoffs. Chat is one ongoing
// conversation that can span domains ("did my bad sleep affect yesterday's
// run?") — the orchestrator calls one or more domain agents as tools and
// synthesizes a single answer. A handoff would transfer the whole
// conversation to a sub-agent, which is the wrong shape for cross-domain
// synthesis and for guaranteeing a consistent voice back to the user.
//
// `onSubAgentEvent`, if given, receives every streaming event from inside a
// domain agent's own nested run (its own tool calls, its own message output)
// — this is what powers the chat UI's tool-level "agent thinking" detail
// trail. It's optional and has no effect on the run itself.
export function buildOrchestratorAgent(
  userId: string,
  onSubAgentEvent?: (agent: AgentKey, event: RunStreamEvent) => void,
) {
  const sleepAgent = buildSleepAgent(buildSleepTools(userId));
  const trainingAgent = buildTrainingAgent(buildTrainingTools(userId));
  const nutritionAgent = buildNutritionAgent(buildNutritionTools(userId));
  const recoveryAgent = buildRecoveryAgent(buildRecoveryTools(userId));

  return new Agent({
    name: "Health Orchestrator",
    model: AGENT_MODEL,
    instructions: `
      You are Brio's neutral training, nutrition, and recovery assistant.

      You hold no data tools directly — you have four specialist tools:
      consult_sleep_agent, consult_training_agent, consult_nutrition_agent,
      and consult_recovery_agent.
      Identify which domain(s) the user's question touches and call the
      relevant specialist tool(s) — call more than one when a question spans
      domains (e.g. sleep affecting training). Synthesize their responses
      into one coherent, inspectable answer. The training specialist can read
      the user's explicit editable profile as planning context. It never
      replaces current evidence.

      Never invent numbers that didn't come back from a specialist tool call.
      If none of the specialists have relevant data, say so plainly.
      For a review spanning the last 14 days, consult all four specialists and
      separate observations for training, nutrition, sleep, and recovery before
      synthesizing interactions. If any tool reports synthetic inputs, begin the
      answer with "Synthetic demo review" and never describe those inputs as live.
      Do not diagnose, praise, award badges, claim recovery percentages or HRV,
      or exceed Progress, Maintain, Repeat, Reduce, and Escalate. If the current
      action is Escalate, do not generate a prescribed session.

      Never use the term HRV, even to say it is missing. Do not offer to schedule
      a future review or imply you can change data, consent, a plan, or a session.
      The iPhone helper currently imports only steps, active energy, ordinary
      heart rate, and sleep; never suggest it can sync workouts or nutrition.
      End with exactly one bounded action as an editable proposal based on the
      evidence already reviewed, then stop. Do not offer to execute it.
    `,
    tools: [
      sleepAgent.asTool({
        toolName: "consult_sleep_agent",
        toolDescription: "Ask the Sleep Agent about this user's sleep duration, consistency, or timing.",
        onStream: onSubAgentEvent ? (evt) => onSubAgentEvent("sleep", evt.event) : undefined,
      }),
      trainingAgent.asTool({
        toolName: "consult_training_agent",
        toolDescription:
          "Ask the Training Agent about this user's workouts, training volume/intensity, steps, or active energy.",
        onStream: onSubAgentEvent ? (evt) => onSubAgentEvent("training", evt.event) : undefined,
      }),
      nutritionAgent.asTool({
        toolName: "consult_nutrition_agent",
        toolDescription:
          "Ask the Nutrition Agent about this user's entered energy, macronutrient, and named-food history.",
        onStream: onSubAgentEvent ? (evt) => onSubAgentEvent("nutrition", evt.event) : undefined,
      }),
      recoveryAgent.asTool({
        toolName: "consult_recovery_agent",
        toolDescription:
          "Ask the Recovery Agent for a qualitative read on this user's recovery state (heart rate trend + sleep + training load).",
        onStream: onSubAgentEvent ? (evt) => onSubAgentEvent("recovery", evt.event) : undefined,
      }),
    ],
  });
}
