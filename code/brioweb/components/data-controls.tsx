"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConsentSnapshot, Decision, DecisionResponse, SourceStatus } from "@/lib/contracts";

export function DataControls({ initialConsent, sources, decisions, events }: { initialConsent: ConsentSnapshot; sources: SourceStatus[]; decisions: Decision[]; events: DecisionResponse[] }) {
  const router = useRouter();
  const [consent, setConsent] = useState(initialConsent);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState("");

  async function toggle(signal: ConsentSnapshot["signals"][number]) {
    setBusy(signal.signal); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/consent", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ schemaVersion: "1.0.0", expectedConsentVersion: consent.consentVersion, mutationId: `data-consent-${crypto.randomUUID()}`, changes: [{ signal: signal.signal, enabled: !signal.enabled }] }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Consent could not be changed");
      setConsent(data.consent);
      setMessage(`${signal.signal.replaceAll("_", " ")} is now ${!signal.enabled ? "allowed" : "off"}. Current decisions were invalidated.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Consent unavailable"); } finally { setBusy(null); }
  }

  async function deleteAccount() {
    if (confirmDelete !== "DELETE") return;
    setBusy("delete"); setError(null);
    try {
      const response = await fetch("/api/account", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation: "DELETE" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Account could not be deleted");
      router.replace("/"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Deletion unavailable"); setBusy(null); }
  }

  return <div className="stack">
    {message && <div className="success-box" role="status">{message}</div>}{error && <div className="error-box" role="alert">{error}</div>}
    <section className="card mist"><span className="eyebrow">Consent version {consent.consentVersion}</span><h2 className="section-title">Signal controls</h2><p className="muted">Turning a signal off excludes it from current reads immediately. It does not silently delete stored source records.</p><div style={{ marginTop: 14 }}>{consent.signals.map((signal) => <div className="toggle-row" key={signal.signal}><div className="toggle-copy"><strong>{signal.signal.replaceAll("_", " ")}</strong><small>{signal.purpose}<br/>Source: {signal.sourceLabel}</small></div><button type="button" className="switch" role="switch" aria-checked={signal.enabled} aria-label={`Allow ${signal.signal.replaceAll("_", " ")}`} disabled={busy !== null} onClick={() => toggle(signal)}><span/></button></div>)}</div></section>
    <section className="card"><h2 className="section-title">Sources</h2><div className="stack" style={{ marginTop: 16 }}>{sources.map((source) => <div className="split" key={source.sourceKey}><div><strong>{source.label}</strong><p className="form-hint">{source.sampleCount} records · latest {source.latestSampleAt ? new Date(source.latestSampleAt).toLocaleString("en-IE") : "not available"}</p>{source.lastAttemptError && <p className="error-box">{source.lastAttemptError}</p>}</div><span className={`badge ${source.state === "unavailable" ? "unavailable" : "live"}`}>{source.state}</span></div>)}</div></section>
    <section className="card"><div className="split"><div><span className="eyebrow">Recommendation audit</span><h2 className="section-title">{decisions.length} decision record{decisions.length === 1 ? "" : "s"}</h2></div><a href="/api/export" className="button button-secondary">Export JSON</a></div><div className="stack" style={{ marginTop: 18 }}>{decisions.length === 0 ? <p className="muted">No decision history yet.</p> : decisions.map((decision) => { const response = events.find((event) => event.decisionId === decision.id); return <article className="card compact" key={decision.id}><div className="split"><div><strong>{decision.action}</strong><p className="form-hint">{new Date(decision.generatedAt).toLocaleString("en-IE")} · {decision.executionMode.replaceAll("_", " ")} · consent v{decision.consentVersion}</p></div><span className="badge live">{decision.status}</span></div><p className="muted small">{decision.policyReason}</p>{response && <p className="small"><strong>User response:</strong> {response.kind} · {response.selectedAction}{response.reason ? ` — ${response.reason}` : ""}</p>}</article>; })}</div></section>
    <section className="card critical"><span className="eyebrow" style={{ color: "var(--rust)" }}>Delete account</span><h2 className="section-title">Remove this account and its stored records.</h2><p className="muted">This is separate from stopping future signal use. The action cannot be undone.</p><div className="form-field" style={{ maxWidth: 380 }}><label htmlFor="delete-confirm">Type DELETE to confirm</label><input id="delete-confirm" className="input" value={confirmDelete} onChange={(event) => setConfirmDelete(event.target.value)}/></div><button className="button button-critical" disabled={confirmDelete !== "DELETE" || busy !== null} onClick={deleteAccount}>{busy === "delete" ? "Deleting…" : "Delete account"}</button></section>
  </div>;
}
