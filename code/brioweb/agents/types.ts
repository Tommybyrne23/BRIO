import { z } from "zod";

// Structured output for the worker's insight-agent wrappers (see
// insight-agent.ts). The chat-facing domain agents stay free-text and do NOT
// use these — they're for natural conversation, not persisted structured rows.
export const InsightOutputSchema = z.object({
  summary: z.string().describe("2-4 sentence plain-language summary of the finding."),
  flags: z.array(z.string()).describe("Notable patterns worth the user's attention, positive or concerning."),
  recommendations: z.array(z.string()).describe("Concrete, actionable suggestions."),
  severity: z.enum(["info", "watch", "concern"]).describe("How urgent this insight is."),
});

export type InsightOutput = z.infer<typeof InsightOutputSchema>;

export type InsightDomain = "sleep" | "training" | "recovery";
