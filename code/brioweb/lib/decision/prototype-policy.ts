import {
  DecisionSchema,
  type Decision,
  type InputDataModeSchema,
  type Metric,
} from "@/lib/contracts";
import type { z } from "zod";

export function createPrototypeDecision(input: {
  id: string;
  generatedAt: string;
  consentVersion: number;
  inputDataMode: z.infer<typeof InputDataModeSchema>;
  metrics: Metric[];
}): Decision {
  const available = input.metrics.filter((metric) => metric.value !== null && !["excluded", "missing", "insufficient", "stale"].includes(metric.state));
  const excluded = input.metrics.filter((metric) => metric.state === "excluded" || metric.state === "missing" || metric.state === "stale");
  const effort = input.metrics.find((metric) => metric.key === "session_effort");
  const action: Decision["action"] = input.metrics.some((metric) => metric.state === "stale") || effort?.state === "above"
    ? "Reduce"
    : available.length < 3
      ? "Maintain"
      : available.some((metric) => metric.state === "below")
        ? "Repeat"
        : "Progress";
  const proposal = action === "Reduce"
    ? { target: "session_volume" as const, direction: "decrease" as const, amount: 1, unit: "sets" as const, lowerBound: 0, upperBound: 2, editable: true as const, text: "Consider one fewer working set on the main lift." }
    : action === "Progress"
      ? { target: "session_load" as const, direction: "increase" as const, amount: 2.5, unit: "percent" as const, lowerBound: 0, upperBound: 5, editable: true as const, text: "Consider up to 2.5% more load on the first working set." }
      : { target: "session_load" as const, direction: action === "Repeat" ? "repeat" as const : "hold" as const, amount: null, unit: "none" as const, lowerBound: null, upperBound: null, editable: true as const, text: action === "Repeat" ? "Repeat the last completed working-set structure." : "Keep the editable plan unchanged." };

  return DecisionSchema.parse({
    schemaVersion: "1.0.0",
    policyVersion: "prototype-1",
    id: input.id,
    status: "proposed",
    action,
    proposal,
    inputDataMode: input.inputDataMode,
    executionMode: "deterministic_prototype",
    evidence: available.slice(0, 6).map((metric) => ({ id: `metric:${metric.key}:${input.generatedAt}`, metricKey: metric.key, sourceLabel: metric.provenance.sourceName ?? "Unavailable", observedAt: metric.provenance.observedAt, evidenceWindow: metric.evidenceWindow, summary: metric.baselineText })),
    excludedSignals: excluded.map((metric) => ({ signal: metric.key, reason: metric.state === "excluded" ? "not_consented" : metric.state === "stale" ? "stale" : "missing" })),
    uncertainty: [available.length < 3 ? "Fewer than three current metrics are available; the policy will not recommend progression." : "This is a bounded prototype policy, not a validated health algorithm."],
    specialists: [{ specialist: "prototype_policy", status: "completed", suggestedAction: action, summary: `The deterministic prototype policy used ${available.length} current, consented metrics.` }],
    disagreement: { present: false, summary: null },
    policyReason: available.length < 3 ? "Too little current evidence is available to support progression, so the editable plan is maintained." : `The prototype policy selected ${action} from visible metric states and bounded the proposed change.`,
    consentVersion: input.consentVersion,
    generatedAt: input.generatedAt,
    staleAt: null,
  });
}
