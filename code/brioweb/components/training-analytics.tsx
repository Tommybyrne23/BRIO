import type { TrainingSession } from "@/lib/contracts";

function seriesFor(sessions: TrainingSession[], kind: "volume" | "effort" | "sets") {
  return sessions.slice(0, 8).reverse().map((session) => {
    const working = session.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.completed && set.type === "working");
    const value = kind === "volume" ? working.reduce((sum, set) => sum + (set.loadKg ?? 0) * (set.reps ?? 0), 0) : kind === "sets" ? working.length : working.some((set) => set.rpe !== null) ? working.reduce((sum, set) => sum + (set.rpe ?? 0), 0) / working.filter((set) => set.rpe !== null).length : 0;
    return { id: session.id, label: session.endedAt?.slice(5, 10) ?? session.updatedAt.slice(5, 10), value: Math.round(value * 10) / 10 };
  }).filter((point) => point.value > 0);
}

export function TrainingAnalytics({ sessions }: { sessions: TrainingSession[] }) {
  const panels = [
    { key: "volume" as const, title: "Working volume", unit: "kg", note: "Warm-up sets excluded." },
    { key: "effort" as const, title: "Mean reported effort", unit: "RPE", note: "Only completed sets with entered RPE." },
    { key: "sets" as const, title: "Completed working sets", unit: "sets", note: "Count, not a performance score." },
  ];
  return <section><span className="eyebrow">Training analytics</span><h2 className="section-title">Recent saved sessions</h2><div className="metric-grid" style={{ marginTop: 16 }}>{panels.map((panel) => { const series = seriesFor(sessions, panel.key); const max = Math.max(...series.map((point) => point.value), 1); return <div className="card compact" key={panel.key}><strong>{panel.title}</strong>{series.length ? <><div className="analytics-bars" aria-label={`${panel.title} over recent sessions`}>{series.map((point) => <div className="analytics-bar-wrap" key={point.id}><div className="analytics-bar" style={{ height: `${Math.max(8, point.value / max * 80)}px` }} title={`${point.label}: ${point.value} ${panel.unit}`}/><small>{point.label}</small></div>)}</div><p className="muted small">Latest: {series.at(-1)?.value} {panel.unit}. {panel.note}</p></> : <div className="empty-state" style={{ marginTop: 14 }}><p className="muted small">Complete a session with relevant set fields to populate this panel.</p></div>}</div>; })}</div></section>;
}
