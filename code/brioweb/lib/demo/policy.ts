import { DecisionSchema, type ConsentSnapshot, type Decision, type Metric } from "@/lib/contracts";

export function runPrototypePolicy(input: {
  id: string;
  generatedAt: string;
  consent: ConsentSnapshot;
  metrics: Metric[];
}): Decision {
  const excluded = input.metrics.filter((metric) => metric.state === "excluded" || metric.state === "missing");
  const stale = input.metrics.filter((metric) => metric.state === "stale");
  const sessionEffort = input.metrics.find((metric) => metric.key === "session_effort");

  const action: Decision["action"] = stale.length > 0 || sessionEffort?.state === "above" ? "Reduce" : excluded.length > 2 ? "Maintain" : "Repeat";
  return DecisionSchema.parse({
    schemaVersion: "1.0.0",
    policyVersion: "prototype-1",
    id: input.id,
    status: "proposed",
    action,
    proposal: action === "Reduce"
      ? { target: "session_volume", direction: "decrease", amount: 1, unit: "sets", lowerBound: 0, upperBound: 2, editable: true, text: "Consider one fewer working set on the main lift." }
      : { target: "session_load", direction: action === "Repeat" ? "repeat" : "hold", amount: null, unit: "none", lowerBound: null, upperBound: null, editable: true, text: action === "Repeat" ? "Repeat the last completed working-set structure." : "Keep the editable plan unchanged." },
    inputDataMode: "synthetic_input",
    executionMode: "simulated_decision",
    evidence: input.metrics.filter((metric) => metric.value !== null && metric.state !== "stale").slice(0, 5).map((metric) => ({
      id: `metric:${metric.key}`,
      metricKey: metric.key,
      sourceLabel: metric.provenance.sourceName ?? "Unavailable",
      observedAt: metric.provenance.observedAt,
      evidenceWindow: metric.evidenceWindow,
      summary: metric.baselineText,
    })),
    excludedSignals: excluded.map((metric) => ({ signal: metric.key, reason: metric.state === "excluded" ? "not_consented" : "missing" })),
    uncertainty: ["Prototype policy for demonstration only; it is not a validated health algorithm."],
    specialists: [{ specialist: "prototype_policy", status: "simulated", suggestedAction: action, summary: "The deterministic prototype policy used only the displayed allowed metrics." }],
    disagreement: { present: false, summary: null },
    policyReason: "The deterministic prototype policy selected the bounded action from visible allowed metric states.",
    consentVersion: input.consent.consentVersion,
    generatedAt: input.generatedAt,
    staleAt: null,
  });
}
