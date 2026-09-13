import { Agent, run } from "@openai/agents";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/db/auth-dal";
import { getDashboardForUser } from "@/db/queries/dashboard";
import { saveDecisionForUser } from "@/db/queries/decisions";
import { getPreferencesForUser, isSignalEnabled } from "@/db/queries/product-state";
import { AGENT_MODEL, MODEL_RUN_CONFIG } from "@/agents/model";
import { DecisionActionSchema, DecisionSchema } from "@/lib/contracts";
import { apiError, readJson, unauthorized } from "@/lib/server/http";

const RequestSchema = z.object({ localDate: z.iso.date() }).strict();
const CandidateSchema = z.object({
  action: DecisionActionSchema,
  reason: z.string().trim().min(1).max(500),
  uncertainty: z.array(z.string().trim().min(1).max(200)).min(1).max(4),
  specialistSummary: z.string().trim().min(1).max(350),
}).strict();

function boundedProposal(action: z.infer<typeof DecisionActionSchema>) {
  if (action === "Progress") return { target: "session_load" as const, direction: "increase" as const, amount: 2.5, unit: "percent" as const, lowerBound: 0, upperBound: 5, editable: true as const, text: "Consider up to 2.5% more load on the first working set." };
  if (action === "Reduce") return { target: "session_volume" as const, direction: "decrease" as const, amount: 1, unit: "sets" as const, lowerBound: 0, upperBound: 2, editable: true as const, text: "Consider one fewer working set on the main lift." };
  if (action === "Escalate") return { target: "manual_review" as const, direction: "stop" as const, amount: null, unit: "none" as const, lowerBound: null, upperBound: null, editable: true as const, text: "Do not generate a session; review the evidence and seek appropriate external guidance." };
  return { target: "session_load" as const, direction: action === "Repeat" ? "repeat" as const : "hold" as const, amount: null, unit: "none" as const, lowerBound: null, upperBound: null, editable: true as const, text: action === "Repeat" ? "Repeat the last completed working-set structure." : "Keep the editable plan unchanged." };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!(await isSignalEnabled(session.user.id, "server_ai_processing"))) return NextResponse.json({ error: "AI processing is off in Data controls" }, { status: 403 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Live agent credentials are unavailable" }, { status: 503 });
  try {
    const input = RequestSchema.parse(await readJson(request));
    const [dashboard, preferences] = await Promise.all([getDashboardForUser(session.user.id, input.localDate), getPreferencesForUser(session.user.id)]);
    const allowedMetrics = dashboard.metrics.filter((metric) => metric.value !== null && !["excluded", "missing", "stale", "insufficient"].includes(metric.state)).map((metric) => ({ key: metric.key, value: metric.value, unit: metric.unit, state: metric.state, baselineText: metric.baselineText, source: metric.provenance.sourceName, observedAt: metric.provenance.observedAt }));
    const agent = new Agent({ name: "Brio bounded decision agent", model: AGENT_MODEL, outputType: CandidateSchema, instructions: "Choose exactly one allowed Brio action from the supplied consent-filtered evidence. Be conservative. Do not diagnose, invent missing evidence, claim recovery percentages, mention HRV, praise the user, or exceed the bounded change. Escalate only when a user-entered stop condition requires refusing session generation. Output only the structured schema." });
    const profileContext = preferences.profile.completed ? { ...preferences.profile, approximateAge: preferences.profile.birthYear ? new Date().getUTCFullYear() - preferences.profile.birthYear : null, birthYear: undefined, goal: preferences.goal, trainingBlock: preferences.trainingBlock } : { completed: false };
    const result = await run(agent, JSON.stringify({ date: input.localDate, allowedMetrics, profileContext, allowedActions: DecisionActionSchema.options }), MODEL_RUN_CONFIG);
    const candidate = CandidateSchema.parse(result.finalOutput);
    const generatedAt = new Date().toISOString();
    const inputDataMode = dashboard.metrics.some((metric) => metric.provenance.inputDataMode === "synthetic_input")
      ? "synthetic_input"
      : allowedMetrics.some((metric) => metric.source === "Apple Health helper")
        ? "live"
        : allowedMetrics.length ? "manual" : "unavailable";
    const decision = DecisionSchema.parse({ schemaVersion: "1.0.0", policyVersion: "prototype-1", id: crypto.randomUUID(), status: candidate.action === "Escalate" ? "escalated" : "proposed", action: candidate.action, proposal: boundedProposal(candidate.action), inputDataMode, executionMode: "live_agent", evidence: dashboard.metrics.filter((metric) => metric.value !== null && !["excluded", "missing", "stale", "insufficient"].includes(metric.state)).map((metric) => ({ id: `metric:${metric.key}:${generatedAt}`, metricKey: metric.key, sourceLabel: metric.provenance.sourceName ?? "Unavailable", observedAt: metric.provenance.observedAt, evidenceWindow: metric.evidenceWindow, summary: metric.baselineText })), excludedSignals: dashboard.metrics.filter((metric) => ["excluded", "missing", "stale"].includes(metric.state)).map((metric) => ({ signal: metric.key, reason: metric.state === "excluded" ? "not_consented" : metric.state === "stale" ? "stale" : "missing" })), uncertainty: candidate.uncertainty, specialists: [{ specialist: "prototype_policy", status: "completed", suggestedAction: candidate.action, summary: candidate.specialistSummary }], disagreement: { present: false, summary: null }, policyReason: candidate.reason, consentVersion: dashboard.consentVersion, generatedAt, staleAt: null });
    return NextResponse.json({ decision: await saveDecisionForUser(session.user.id, decision) }, { status: 201 });
  } catch (error) {
    console.error("[live-decision] unavailable", error instanceof Error ? error.message : "unknown error");
    return apiError(error);
  }
}
