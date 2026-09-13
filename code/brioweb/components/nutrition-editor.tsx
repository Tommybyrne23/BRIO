"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ManualLog } from "@/lib/contracts";

export function NutritionEditor({ localDate, initial }: { localDate: string; initial: ManualLog | null }) {
  const router = useRouter();
  const [energy, setEnergy] = useState(initial?.nutrition?.energyIntakeKcal?.toString() ?? "");
  const [protein, setProtein] = useState(initial?.nutrition?.proteinGrams?.toString() ?? "");
  const [carbs, setCarbs] = useState(initial?.nutrition?.carbohydrateGrams?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/manual-logs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ schemaVersion: "1.0.0", localDate, nutrition: { ...(energy === "" ? {} : { energyIntakeKcal: Number(energy) }), ...(protein === "" ? {} : { proteinGrams: Number(protein) }), ...(carbs === "" ? {} : { carbohydrateGrams: Number(carbs) }) }, mutationId: `nutrition-${crypto.randomUUID()}`, revision: initial?.revision ?? 0, recordedAt: new Date().toISOString() }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Nutrition could not be saved");
      setMessage("Nutrition saved to the server."); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Nutrition unavailable"); } finally { setBusy(false); }
  }

  return <form className="card" onSubmit={save}><span className="eyebrow">Manual totals · {localDate}</span><h2 className="section-title">Add or correct today</h2><p className="muted">Only entered fields are stored. Intake is never presented as active energy or an asserted energy balance.</p>{message && <div className="success-box">{message}</div>}{error && <div className="error-box">{error}</div>}<div className="metric-grid" style={{ marginTop: 18 }}>{[["energy","Energy intake","kcal",energy,setEnergy],["protein","Protein","g",protein,setProtein],["carbs","Carbohydrate","g",carbs,setCarbs]].map(([id,label,unit,value,setValue]) => <div className="form-field" key={String(id)}><label htmlFor={String(id)}>{String(label)} ({String(unit)})</label><input id={String(id)} className="input" type="number" min="0" value={String(value)} onChange={(event) => (setValue as (value:string)=>void)(event.target.value)}/></div>)}</div><button className="button" style={{ marginTop: 18 }} disabled={busy || [energy,protein,carbs].every((value)=>value==="")}>{busy ? "Saving…" : "Save nutrition"}</button></form>;
}
