// Shared default model id for every agent (domain agents, orchestrator, and
// the worker's insight-agent wrappers) so it's one env var to change, not a
// hunt through multiple files. Also recorded into agent_insights.model.
export const DEFAULT_MODEL = process.env.OPENAI_AGENTS_MODEL || "gpt-5-nano";
