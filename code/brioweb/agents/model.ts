import { OpenAIChatCompletionsModel, type RunConfig } from "@openai/agents";
import OpenAI from "openai";

// Shared model id for every specialist, orchestrator, and worker.
export const DEFAULT_MODEL = process.env.OPENAI_AGENTS_MODEL || "gpt-5-nano";

const compatibleBaseUrl = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE;
export const USES_CHAT_COMPLETIONS_COMPAT = Boolean(compatibleBaseUrl);

// A concrete model object is required here: agents invoked as tools start their
// own nested run and do not inherit the outer run's provider configuration.
export const AGENT_MODEL = compatibleBaseUrl
  ? new OpenAIChatCompletionsModel(new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: compatibleBaseUrl,
    }), DEFAULT_MODEL)
  : DEFAULT_MODEL;

export const MODEL_RUN_CONFIG: Partial<RunConfig> = { tracingDisabled: true };
