"use client";

import { useState } from "react";
import {
  DecisionActionSchema,
  type Dashboard,
  type Decision,
  type Metric,
} from "@/lib/contracts";
import { MetricCard, MetricDetail } from "@/components/today-workspace";

async function jsonRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "The request could not be completed");
  return data;
}

export function LiveTodayWorkspace({ initialDashboard }: { initialDashboard: Dashboard }) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [metric, setMetric] = useState<Metric | null>(null);
  const [dialog, setDialog] = useState<"adjust" | "log" | "checkin" | null>(null);
  const [adjustAction, setAdjustAction] = useState<Decision["action"]>(initialDashboard.decision?.action ?? "Maintain");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const decision = dashboard.decision;

  async function refresh() {
    const data = await jsonRequest(`/api/dashboard?date=${dashboard.localDate}`);
    setDashboard(data.dashboard);
  }

  async function generate() {
    setBusy(true); setError(null);
    try {
      const data = await jsonRequest("/api/decisions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ localDate: dashboard.localDate }) });
      setDashboard((current) => ({ ...current, decision: data.decision }));
      setMessage("A deterministic prototype decision was generated from current consented evidence. No model call was used.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Decision unavailable"); } finally { setBusy(false); }
  }

  async function generateLive() {
    setBusy(true); setError(null); setMessage(null);
    try {
      const data = await jsonRequest("/api/decisions/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ localDate: dashboard.localDate }) });
      setDashboard((current) => ({ ...current, decision: data.decision }));
      setMessage("Live structured agent decision generated from current consented evidence.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Live agent unavailable"); } finally { setBusy(false); }
  }

  async function respond(kind: "accepted" | "overridden", action: Decision["action"], responseReason: string | null) {
    if (!decision) return;
    setBusy(true); setError(null);
    try {
      await jsonRequest(`/api/decisions/${decision.id}/respond`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ schemaVersion: "1.0.0", decisionId: decision.id, kind, selectedAction: action, proposal: decision.proposal, reason: responseReason, mutationId: `decision-response-${crypto.randomUUID()}`, consentVersion: decision.consentVersion, respondedAt: new Date().toISOString() }) });
      setDashboard((current) => ({ ...current, decision: current.decision ? { ...current.decision, status: kind } : null }));
      setMessage(kind === "accepted" ? "Decision recorded." : "Adjustment recorded separately from the original decision.");
      setDialog(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Response unavailable"); } finally { setBusy(false); }
  }

  async function saveLog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const existing = await jsonRequest(`/api/manual-logs?date=${dashboard.localDate}`);
      const form = new FormData(event.currentTarget);
      await jsonRequest("/api/manual-logs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ schemaVersion: "1.0.0", localDate: dashboard.localDate, nutrition: { energyIntakeKcal: Number(form.get("energy")), proteinGrams: Number(form.get("protein")), carbohydrateGrams: Number(form.get("carbs")) }, mutationId: `manual-${crypto.randomUUID()}`, revision: existing.manualLog?.revision ?? 0, recordedAt: new Date().toISOString() }) });
      await refresh(); setDialog(null); setMessage("Manual nutrition saved and reloaded from the server.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Manual log unavailable"); } finally { setBusy(false); }
  }

  async function saveCheckIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const existing = await jsonRequest(`/api/check-ins?date=${dashboard.localDate}`);
      const form = new FormData(event.currentTarget);
      const keys = ["fatigue", "muscle_soreness", "sleep_quality", "stress", "mood"] as const;
      await jsonRequest("/api/check-ins", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ schemaVersion: "1.0.0", localDate: dashboard.localDate, responses: keys.map((key) => ({ key, rating: Number(form.get(key)) })), mutationId: `checkin-${crypto.randomUUID()}`, revision: existing.checkIn?.revision ?? 0, recordedAt: new Date().toISOString() }) });
      await refresh(); setDialog(null); setMessage("Check-in saved and reloaded from the server.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Check-in unavailable"); } finally { setBusy(false); }
  }

  return <div className="page-shell">
    <div className="page-head"><div><span className="eyebrow">{dashboard.localDate}</span><h1 className="page-title">Today</h1><p className="page-subtitle">Current, consented evidence. Missing data stays missing and every recommendation remains editable.</p></div><span className="badge live">Account data</span></div>
    {message && <div className="success-box" role="status" style={{ marginBottom: 16 }}>{message}</div>}{error && <div className="error-box" role="alert" style={{ marginBottom: 16 }}>{error}</div>}
    <section className="stack"><div className="split"><div><span className="eyebrow">Training · nutrition · recovery</span><h2 className="section-title">Signals in context</h2></div><button className="button button-secondary button-small" onClick={() => setDialog("log")}>Log today</button></div><div className="metric-grid">{dashboard.metrics.map((item) => <MetricCard key={item.key} metric={item} onOpen={() => setMetric(item)}/>)}</div></section>
    <section style={{ marginTop: 24 }}>{decision ? <div className={`decision-card ${decision.action === "Escalate" ? "critical" : ""}`}><div className="decision-main"><div><span className="eyebrow">Current bounded action</span><h2 className={`decision-action decision-${decision.action.toLowerCase()}`}>{decision.action}</h2><p className="decision-proposal">{decision.proposal.text}</p><div className="cluster" style={{ marginTop: 20 }}><button className="button" disabled={busy || decision.status !== "proposed" || decision.action === "Escalate"} onClick={() => respond("accepted", decision.action, null)}>{decision.status === "accepted" ? "Recorded" : "Accept"}</button><button className="button button-secondary" disabled={busy || decision.status !== "proposed"} onClick={() => { setAdjustAction(decision.action); setDialog("adjust"); }}>Adjust</button></div></div><div className="decision-meta"><span className={`badge ${decision.executionMode === "live_agent" ? "live" : "simulated"}`}>{decision.executionMode.replaceAll("_", " ")}</span><div><span className="field-label">Evidence used</span><p className="muted small">{decision.evidence.length} references · {decision.excludedSignals.length} excluded</p></div><div><span className="field-label">Policy reason</span><p className="muted small">{decision.policyReason}</p></div><div><span className="field-label">Uncertainty</span>{decision.uncertainty.map((item) => <p className="muted small" key={item}>{item}</p>)}</div></div></div></div> : <div className="empty-state"><span className="eyebrow">No current decision</span><h2 className="section-title">Generate from available evidence</h2><p className="muted">The reliable prototype path is deterministic and requires no model call. The live path requires separate AI consent and credentials.</p><div className="cluster"><button className="button" onClick={generate} disabled={busy}>{busy ? "Generating…" : "Generate bounded decision"}</button><button className="button button-secondary" onClick={generateLive} disabled={busy}>Try live agent</button></div></div>}</section>
    <section className="card" style={{ marginTop: 24 }}><div className="split"><div><span className="eyebrow">End of day</span><h2 className="section-title">Five-item check-in</h2><p className="muted">Self-report only; not a diagnostic instrument.</p></div><button className="button button-secondary" onClick={() => setDialog("checkin")}>Check in</button></div></section>
    {metric && <MetricDetail metric={metric} onClose={() => setMetric(null)}/>} 
    {dialog === "adjust" && decision && <div className="dialog-backdrop"><form className="dialog" onSubmit={(event) => { event.preventDefault(); respond("overridden", adjustAction, reason); }}><div className="dialog-head"><div><span className="eyebrow">Immutable audit</span><h2 className="section-title">Adjust action</h2></div><button className="icon-button" type="button" onClick={() => setDialog(null)}>×</button></div><div className="stack"><div className="form-field"><label htmlFor="adjust-action">Action</label><select id="adjust-action" className="select" value={adjustAction} onChange={(event) => setAdjustAction(DecisionActionSchema.parse(event.target.value))}>{DecisionActionSchema.options.map((action) => <option key={action}>{action}</option>)}</select></div><div className="form-field"><label htmlFor="reason">Reason</label><textarea id="reason" className="textarea" required value={reason} onChange={(event) => setReason(event.target.value)}/></div><button className="button" disabled={busy}>Record adjustment</button></div></form></div>}
    {dialog === "log" && <div className="dialog-backdrop"><form className="dialog" onSubmit={saveLog}><div className="dialog-head"><div><span className="eyebrow">Manual entry</span><h2 className="section-title">Log nutrition</h2></div><button className="icon-button" type="button" onClick={() => setDialog(null)}>×</button></div><div className="stack"><p className="form-hint">Intake remains separate from active energy.</p>{[["energy","Energy intake","kcal"],["protein","Protein","g"],["carbs","Carbohydrate","g"]].map(([name,label,unit]) => <div className="form-field" key={name}><label htmlFor={name}>{label} ({unit})</label><input id={name} name={name} className="input" type="number" min="0" required/></div>)}<button className="button" disabled={busy}>Save</button></div></form></div>}
    {dialog === "checkin" && <div className="dialog-backdrop"><form className="dialog" onSubmit={saveCheckIn}><div className="dialog-head"><div><span className="eyebrow">Self-report</span><h2 className="section-title">Daily check-in</h2></div><button className="icon-button" type="button" onClick={() => setDialog(null)}>×</button></div><div className="stack">{[["fatigue","Fatigue"],["muscle_soreness","Muscle soreness"],["sleep_quality","Sleep quality"],["stress","Stress"],["mood","Mood"]].map(([key,label]) => <div className="form-field" key={key}><label htmlFor={key}>{label} · 1 to 5</label><input id={key} name={key} className="input" type="range" min="1" max="5" defaultValue="3"/></div>)}<button className="button" disabled={busy}>Save check-in</button></div></form></div>}
  </div>;
}
