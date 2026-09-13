"use client";

import { useEffect, useMemo, useState } from "react";
import { DecisionActionSchema, DemoScenarioSchema, type Metric } from "@/lib/contracts";
import {
  createDemoStoreState,
  demoReducer,
  loadDemoState,
  persistDemoState,
  type DemoStoreState,
} from "@/lib/demo/store";
import type { DemoScenario } from "@/lib/demo/fixture";

const scenarioLabels: Record<DemoScenario, string> = {
  normal_evidence: "Normal evidence",
  specialist_disagreement: "Specialist disagreement",
  signal_revoked: "Signal revoked",
  missing_nutrition: "Missing nutrition",
  stale_helper: "Stale helper",
  model_timeout: "Model timeout",
  escalation: "Escalation",
};

export function MetricDetail({ metric, onClose }: { metric: Metric; onClose: () => void }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="metric-title">
      <div className="dialog-head"><div><span className="eyebrow">Evidence detail</span><h2 id="metric-title" className="section-title">{metric.label}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div>
      <div className="stack">
        <div className="split"><strong>{metric.displayValue}</strong><span className={`status-word status-${metric.state}`}>{metric.stateLabel}</span></div>
        <p className="muted">{metric.baselineText}</p>
        <hr className="rule" />
        <dl className="stack-tight small">
          <div className="split"><dt className="muted">Source</dt><dd>{metric.provenance.sourceName ?? "Not available"}</dd></div>
          <div className="split"><dt className="muted">Input mode</dt><dd>{metric.provenance.inputDataMode.replaceAll("_", " ")}</dd></div>
          <div className="split"><dt className="muted">Window</dt><dd>{metric.evidenceWindow}</dd></div>
          <div className="split"><dt className="muted">Observed</dt><dd>{metric.provenance.observedAt ? new Date(metric.provenance.observedAt).toLocaleString("en-IE") : "No observation"}</dd></div>
          <div className="split"><dt className="muted">Coverage</dt><dd>{metric.provenance.coverageStatus}</dd></div>
          <div className="split"><dt className="muted">Freshness</dt><dd>{metric.provenance.freshness}</dd></div>
          <div className="split"><dt className="muted">Quality note</dt><dd>{metric.provenance.qualityReason.replaceAll("_", " ")}</dd></div>
        </dl>
        <button className="button button-secondary" onClick={onClose}>Done</button>
      </div>
    </section>
  </div>;
}

export function MetricCard({ metric, onOpen }: { metric: Metric; onOpen: () => void }) {
  const absent = ["missing", "excluded", "insufficient"].includes(metric.state);
  const fill = absent ? "16%" : metric.state === "stale" ? "35%" : metric.state === "above" ? "90%" : "72%";
  const color = metric.state === "above" ? "var(--bronze)" : metric.state === "stale" || absent ? "var(--slate)" : "var(--sage)";
  return <button className="metric-card" onClick={onOpen} aria-label={`Open ${metric.label} evidence`}>
    <div className="metric-top"><span className="metric-label">{metric.label}</span><span className={`status-word status-${metric.state}`}>{metric.stateLabel}</span></div>
    <div className="metric-ring" style={{ "--ring-fill": fill, "--ring-color": color } as React.CSSProperties}><span className="metric-value">{metric.value === null ? "—" : metric.value}</span></div>
    <p className="metric-baseline">{metric.baselineText}</p>
  </button>;
}

export function TodayWorkspace({ anchorDate = "2026-09-13", guest = false }: { anchorDate?: string; guest?: boolean }) {
  const [state, setState] = useState<DemoStoreState>(() => createDemoStoreState(anchorDate));
  const [hydrated, setHydrated] = useState(false);
  const [metric, setMetric] = useState<Metric | null>(null);
  const [explain, setExplain] = useState(true);
  const [dialog, setDialog] = useState<"adjust" | "log" | "checkin" | null>(null);
  const [adjustAction, setAdjustAction] = useState("Repeat");
  const [adjustReason, setAdjustReason] = useState("");
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setState(loadDemoState(anchorDate));
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [anchorDate]);
  useEffect(() => { if (hydrated) persistDemoState(state); }, [state, hydrated]);

  const decision = state.dashboard.decision;
  const formattedDate = useMemo(() => new Intl.DateTimeFormat("en-IE", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${state.anchorDate}T12:00:00Z`)), [state.anchorDate]);
  const dispatch = (action: Parameters<typeof demoReducer>[1]) => setState((current) => demoReducer(current, action));

  function acceptDecision() {
    if (!decision) return;
    dispatch({ type: "respond", kind: "accepted", action: decision.action });
    setSavedMessage("Decision recorded in this synthetic workspace.");
  }

  function saveAdjustment(event: React.FormEvent) {
    event.preventDefault();
    dispatch({ type: "respond", kind: "overridden", action: DecisionActionSchema.parse(adjustAction), reason: adjustReason || "Edited in the demonstration workspace." });
    setDialog(null);
    setSavedMessage("Your edited action was recorded separately from the original recommendation.");
  }

  return <div className="page-shell">
    <div className="page-head">
      <div><span className="eyebrow">{formattedDate}</span><h1 className="page-title">Today</h1><p className="page-subtitle">One bounded decision, with the evidence and uncertainty kept visible.</p></div>
      <div className="stack-tight" style={{ justifyItems: "end" }}>
        <div className="cluster"><span className="badge synthetic">Synthetic inputs</span><span className="badge simulated">Simulated decision</span></div>
        {guest && <div className="cluster"><label className="small" htmlFor="scenario">Scenario</label><select id="scenario" className="select" value={state.scenario} onChange={(e) => dispatch({ type: "scenario", scenario: DemoScenarioSchema.parse(e.target.value) })}>{DemoScenarioSchema.options.map((scenario) => <option key={scenario} value={scenario}>{scenarioLabels[scenario]}</option>)}</select><button className="button button-quiet button-small" onClick={() => dispatch({ type: "reset" })}>Reset</button></div>}
      </div>
    </div>

    {guest && <div className="card mist compact" style={{ marginBottom: 18 }}><div className="split"><div><strong>Synthetic demonstration</strong><p className="form-hint">These values do not come from your health records. Outcomes are rehearsed locally and no model call is required.</p></div><span className="badge synthetic">Demo only</span></div></div>}
    {savedMessage && <div className="success-box" role="status" style={{ marginBottom: 16 }}>{savedMessage}</div>}

    <section aria-labelledby="signals-title" className="stack">
      <div className="split"><div><span className="eyebrow">Training · nutrition · recovery</span><h2 id="signals-title" className="section-title">Signals in context</h2></div><button className="button button-secondary button-small" onClick={() => setDialog("log")}>Log today</button></div>
      <div className="metric-grid">{state.dashboard.metrics.map((item) => <MetricCard key={item.key} metric={item} onOpen={() => setMetric(item)} />)}</div>
    </section>

    <section aria-labelledby="decision-title" style={{ marginTop: 24 }}>
      {decision ? <div className={`decision-card ${decision.action === "Escalate" ? "critical" : ""}`}>
        <div className="decision-main"><div><span className="eyebrow">Today’s bounded action</span><h2 id="decision-title" className={`decision-action decision-${decision.action.toLowerCase()}`}>{decision.action}</h2><p className="decision-proposal">{decision.proposal.text}</p><div className="cluster" style={{ marginTop: 20 }}><button className="button" onClick={acceptDecision} disabled={decision.status !== "proposed" || decision.action === "Escalate"}>{decision.status === "accepted" ? "Recorded" : decision.action === "Escalate" ? "Session generation blocked" : "Accept"}</button><button className="button button-secondary" onClick={() => { setAdjustAction(decision.action); setDialog("adjust"); }} disabled={decision.status !== "proposed"}>Adjust</button><button className="button button-quiet" onClick={() => setExplain((value) => !value)} aria-expanded={explain}>{explain ? "Hide explanation" : "Explain"}</button></div></div>
          <div className="decision-meta"><span className={`badge ${decision.executionMode === "simulated_decision" ? "simulated" : "live"}`}>{decision.executionMode.replaceAll("_", " ")}</span><div><span className="field-label">Evidence used</span><p className="muted small">{decision.evidence.length} references · {decision.excludedSignals.length} excluded</p></div><div><span className="field-label">Consent version</span><p className="muted small">v{decision.consentVersion}</p></div><div><span className="field-label">Generated</span><p className="muted small">{new Date(decision.generatedAt).toLocaleString("en-IE")}</p></div></div></div>
        {explain && <div className="decision-explain"><div className="stack"><div><span className="field-label">Why this action</span><p className="muted">{decision.policyReason}</p></div>{decision.disagreement.present && <div className="disagreement"><span className="field-label">Visible disagreement</span><p className="muted">{decision.disagreement.summary}</p></div>}<div><span className="field-label">Uncertainty</span><ul>{decision.uncertainty.map((item) => <li key={item} className="muted small">{item}</li>)}</ul></div>{decision.excludedSignals.length > 0 && <div><span className="field-label">Not used</span><ul>{decision.excludedSignals.map((item) => <li key={item.signal} className="muted small">{item.signal.replaceAll("_", " ")} — {item.reason.replaceAll("_", " ")}</li>)}</ul></div>}<div><span className="field-label">Specialist summaries</span>{decision.specialists.map((item) => <p key={item.specialist} className="muted small"><strong>{item.specialist.replaceAll("_", " ")}:</strong> {item.summary}</p>)}</div></div></div>}
      </div> : <div className="empty-state"><span className="eyebrow">No current decision</span><h2 className="section-title">Keep logging or review consent</h2><p className="muted">Brio does not infer a recommendation from missing evidence.</p></div>}
    </section>

    <section className="card" style={{ marginTop: 24 }}><div className="split"><div><span className="eyebrow">End of day</span><h2 className="section-title">Five-item check-in</h2><p className="muted">Fatigue, soreness, sleep quality, stress and mood. Self-report only.</p></div><button className="button button-secondary" onClick={() => setDialog("checkin")}>Check in</button></div></section>

    {metric && <MetricDetail metric={metric} onClose={() => setMetric(null)} />}
    {dialog === "adjust" && decision && <div className="dialog-backdrop"><form className="dialog" role="dialog" aria-modal="true" aria-labelledby="adjust-title" onSubmit={saveAdjustment}><div className="dialog-head"><div><span className="eyebrow">Edit, don’t overwrite</span><h2 id="adjust-title" className="section-title">Adjust action</h2></div><button type="button" className="icon-button" onClick={() => setDialog(null)} aria-label="Close">×</button></div><div className="stack"><div className="form-field"><label htmlFor="adjust-action">Action</label><select id="adjust-action" className="select" value={adjustAction} onChange={(e) => setAdjustAction(e.target.value)}>{DecisionActionSchema.options.map((action) => <option key={action}>{action}</option>)}</select></div><div className="form-field"><label htmlFor="adjust-reason">Reason</label><textarea id="adjust-reason" className="textarea" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="What changed?" required /></div><p className="form-hint">The original recommendation remains in the audit record.</p><button className="button" type="submit">Record adjustment</button></div></form></div>}
    {dialog === "log" && <div className="dialog-backdrop"><form className="dialog" role="dialog" aria-modal="true" aria-labelledby="log-title" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); dispatch({ type: "save_nutrition", energyIntakeKcal: Number(form.get("energy")), proteinGrams: Number(form.get("protein")), carbohydrateGrams: Number(form.get("carbs")) }); setDialog(null); setSavedMessage("Synthetic manual nutrition saved in this browser."); }}><div className="dialog-head"><div><span className="eyebrow">Manual input</span><h2 id="log-title" className="section-title">Log today</h2></div><button type="button" className="icon-button" onClick={() => setDialog(null)} aria-label="Close">×</button></div><div className="stack"><p className="form-hint">Energy intake is kept separate from active energy. Only entered fields are saved.</p>{[["energy","Energy intake","kcal"],["protein","Protein","g"],["carbs","Carbohydrate","g"]].map(([name,label,unit]) => <div className="form-field" key={name}><label htmlFor={name}>{label} ({unit})</label><input className="input" id={name} name={name} type="number" min="0" step="1" required /></div>)}<button className="button" type="submit">Save manual log</button></div></form></div>}
    {dialog === "checkin" && <div className="dialog-backdrop"><form className="dialog" role="dialog" aria-modal="true" aria-labelledby="checkin-title" onSubmit={(event) => { event.preventDefault(); setDialog(null); setSavedMessage("Synthetic check-in saved in this browser."); }}><div className="dialog-head"><div><span className="eyebrow">Self-report</span><h2 id="checkin-title" className="section-title">End-of-day check-in</h2></div><button type="button" className="icon-button" onClick={() => setDialog(null)} aria-label="Close">×</button></div><div className="stack">{["Fatigue","Muscle soreness","Sleep quality","Stress","Mood"].map((label) => <div className="form-field" key={label}><label>{label} · 1 to 5</label><input className="input" type="range" min="1" max="5" defaultValue="3" aria-label={label} /></div>)}<p className="form-hint">This is not a diagnostic instrument.</p><button className="button" type="submit">Save check-in</button></div></form></div>}
  </div>;
}
