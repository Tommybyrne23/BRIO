"use client";

import { useState } from "react";
import type { Decision, TrainingSession } from "@/lib/contracts";
import type { DescribeTrainingResult } from "@/lib/training/description-parser";
import { TrainingSessionEditor } from "@/components/training-session-editor";

type Draft = Omit<TrainingSession, "createdAt" | "updatedAt">;
type History = Record<string, { sessionId: string; sessionTitle: string; endedAt: string; exerciseName: string; sets: Array<Pick<Draft["exercises"][number]["sets"][number], "type" | "loadKg" | "reps" | "rpe" | "restDurationSeconds" | "notes">> }>;

export function DescribeTrainingSession({ history, decision }: { history: History; decision: Decision | null }) {
  const [description, setDescription] = useState("Session: Lower body\nBack squat: 2x5 warm-up at 40kg, 3x5 at 80kg RPE 7 with 2 min rest\nRomanian deadlift: 3x8 at 60kg RPE 7");
  const [result, setResult] = useState<DescribeTrainingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function parse() {
    setBusy(true); setError(null); setResult(null);
    try {
      const response = await fetch("/api/training/describe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ description }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Description could not be interpreted");
      setResult(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Description could not be interpreted"); }
    finally { setBusy(false); }
  }

  if (result) return <><section className="page-shell narrow" style={{ paddingBottom: 0 }}><div className="card mist"><span className="eyebrow">Transparent parser</span><h1 className="section-title">Editable interpretation</h1><p className="muted">Parser: <code>{result.parser}</code>. Saved: <strong>No</strong>. No model was called. Review and explicitly confirm below before persistent saves begin.</p><details><summary>Rules and warnings</summary><ul>{result.rulesApplied.map((rule) => <li key={rule}>{rule}</li>)}{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details><button className="button button-secondary" type="button" onClick={() => setResult(null)}>Change description</button></div></section><TrainingSessionEditor draft={result.interpretation} reviewRequired history={history} decision={decision}/></>;

  return <div className="page-shell narrow"><div className="page-head"><div><span className="eyebrow">Describe it</span><h1 className="page-title">Turn plain language into an editable draft.</h1><p className="page-subtitle">This uses a transparent deterministic parser. It does not call a model and never autosaves the interpretation.</p></div></div><section className="card"><div className="form-field"><label htmlFor="session-description">Session description</label><textarea id="session-description" className="textarea description-input" value={description} onChange={(event) => setDescription(event.target.value)} aria-describedby="description-help"/><p id="description-help" className="form-hint">Use one exercise per line. Examples: “3x5 at 80kg RPE 7”, “2x8 warm-up”, and “90 seconds rest”.</p></div>{decision?.action === "Escalate" && <div className="error-box" style={{ marginTop: 16 }}>The current action is Escalate. This parser can structure a user-entered record, but Brio will not generate or present it as a prescribed session.</div>}{error && <div className="error-box" role="alert" style={{ marginTop: 16 }}>{error}</div>}<button className="button" type="button" disabled={busy} onClick={parse} style={{ marginTop: 18 }}>{busy ? "Interpreting…" : "Create editable draft"}</button></section></div>;
}
