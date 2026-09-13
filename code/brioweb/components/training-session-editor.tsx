"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Decision, TrainingSession } from "@/lib/contracts";
import { remainingRestSeconds } from "@/lib/training/rest-timer";

type SessionDraft = Omit<TrainingSession, "createdAt" | "updatedAt">;
type ComparableExerciseHistory = { sessionId: string; sessionTitle: string; endedAt: string; exerciseName: string; sets: Array<Pick<SessionDraft["exercises"][number]["sets"][number], "type" | "loadKg" | "reps" | "rpe" | "restDurationSeconds" | "notes">> };
type SessionTotals = { workingVolumeKg: number; completedSetCount: number; reportedEffort: number | null };
type Comparison = { current: SessionTotals; prior: { sessionId: string; title: string; endedAt: string; totals: SessionTotals } | null } | null;
type SaveState = "saved" | "unsaved" | "saving" | "error";

function newSet(order: number, type: "warm_up" | "working" = "working"): SessionDraft["exercises"][number]["sets"][number] {
  return { id: crypto.randomUUID(), order, type, loadKg: null, reps: null, rpe: null, notes: "", completed: false, completedAt: null, restStartedAt: null, restDurationSeconds: type === "warm_up" ? 90 : 120, restPausedRemainingSeconds: null };
}

function newExercise(order: number): SessionDraft["exercises"][number] {
  return { id: crypto.randomUUID(), order, name: `Exercise ${order + 1}`, notes: "", sets: [newSet(0)] };
}

function blankSession(historical = false): SessionDraft {
  return { schemaVersion: "1.0.0", id: crypto.randomUUID(), title: historical ? "Historical session" : "Training session", status: "draft", inputDataMode: "manual", startedAt: null, endedAt: null, exercises: [newExercise(0)], notes: historical ? "Manual historical log." : "", revision: 0, mutationId: `session-new-${crypto.randomUUID()}` };
}

function fromSaved(value: TrainingSession): SessionDraft {
  return { schemaVersion: value.schemaVersion, id: value.id, title: value.title, status: value.status, inputDataMode: value.inputDataMode, startedAt: value.startedAt, endedAt: value.endedAt, exercises: value.exercises, notes: value.notes, revision: value.revision, mutationId: `session-edit-${crypto.randomUUID()}` };
}

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function reorder<T extends { order: number }>(items: T[]) {
  return items.map((item, order) => ({ ...item, order }));
}

function delta(current: number | null, prior: number | null, unit: string) {
  if (current === null || prior === null) return "No comparable value";
  const difference = Math.round((current - prior) * 10) / 10;
  if (difference === 0) return `No change (${current} ${unit})`;
  return `${difference > 0 ? "+" : ""}${difference} ${unit} (${current} vs ${prior})`;
}

export function TrainingSessionEditor({
  initial,
  draft,
  reviewRequired = false,
  history = {},
  comparison = null,
  decision = null,
  historical = false,
}: {
  initial?: TrainingSession;
  draft?: SessionDraft;
  reviewRequired?: boolean;
  history?: Record<string, ComparableExerciseHistory>;
  comparison?: Comparison;
  decision?: Decision | null;
  historical?: boolean;
}) {
  const router = useRouter();
  const [session, setSession] = useState<SessionDraft>(() => initial ? fromSaved(initial) : draft ?? blankSession(historical));
  const [persisted, setPersisted] = useState(Boolean(initial));
  const [reviewed, setReviewed] = useState(!reviewRequired);
  const [saveState, setSaveState] = useState<SaveState>(initial ? "saved" : reviewRequired ? "saved" : "unsaved");
  const [message, setMessage] = useState<string | null>(reviewRequired ? "Review every interpreted field. Nothing has been saved." : null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const editVersion = useRef(0);
  const pendingMutation = useRef<string | null>(null);
  const completionMutation = useRef(`session-complete-${session.id}`);

  const markEdited = useCallback((updater: (current: SessionDraft) => SessionDraft) => {
    editVersion.current += 1;
    pendingMutation.current = null;
    setMessage(null);
    setError(null);
    setSaveState("unsaved");
    setSession((current) => ({ ...updater(current), mutationId: `session-edit-${crypto.randomUUID()}` }));
  }, []);

  const patchSet = useCallback((exerciseId: string, setId: string, patch: Partial<SessionDraft["exercises"][number]["sets"][number]>) => markEdited((current) => ({ ...current, exercises: current.exercises.map((exercise) => exercise.id === exerciseId ? { ...exercise, sets: exercise.sets.map((set) => set.id === setId ? { ...set, ...patch } : set) } : exercise) })), [markEdited]);

  const activeRest = useMemo(() => {
    const rows = session.exercises.flatMap((exercise) => exercise.sets.map((set) => ({ exerciseId: exercise.id, set })));
    return rows.filter((row) => row.set.restStartedAt || row.set.restPausedRemainingSeconds !== null).sort((a, b) => new Date(b.set.restStartedAt ?? 0).getTime() - new Date(a.set.restStartedAt ?? 0).getTime())[0] ?? null;
  }, [session.exercises]);
  const restClock = activeRest?.set.restStartedAt ? (now || new Date(activeRest.set.restStartedAt).getTime()) : now;
  const restRemaining = activeRest ? remainingRestSeconds({ startedAt: activeRest.set.restStartedAt, durationSeconds: activeRest.set.restDurationSeconds, pausedRemainingSeconds: activeRest.set.restPausedRemainingSeconds, nowMs: restClock }) : 0;

  useEffect(() => {
    if (!activeRest?.set.restStartedAt) return;
    const exerciseId = activeRest.exerciseId;
    const setId = activeRest.set.id;
    const expiresAt = new Date(activeRest.set.restStartedAt).getTime() + (activeRest.set.restDurationSeconds ?? 120) * 1000;
    const refresh = () => {
      const timestamp = Date.now();
      setNow(timestamp);
      if (timestamp >= expiresAt) patchSet(exerciseId, setId, { restStartedAt: null, restPausedRemainingSeconds: null });
    };
    const frame = window.requestAnimationFrame(refresh);
    const interval = window.setInterval(refresh, 500);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, [activeRest?.exerciseId, activeRest?.set.id, activeRest?.set.restDurationSeconds, activeRest?.set.restStartedAt, patchSet]);

  const persist = useCallback(async (nextStatus: SessionDraft["status"] = session.status, mutationOverride?: string) => {
    if (!reviewed) return;
    const capturedEdit = editVersion.current;
    const mutationId = mutationOverride ?? pendingMutation.current ?? `session-save-${crypto.randomUUID()}`;
    pendingMutation.current = mutationId;
    const timestamp = new Date().toISOString();
    const body: SessionDraft = { ...session, status: nextStatus, startedAt: session.startedAt ?? (nextStatus === "draft" ? null : timestamp), endedAt: nextStatus === "completed" ? timestamp : session.endedAt, mutationId };
    setSaveState("saving"); setError(null);
    try {
      const response = await fetch(persisted ? `/api/training/sessions/${session.id}` : "/api/training/sessions", { method: persisted ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Session could not be saved");
      const saved = fromSaved(data.session);
      setPersisted(true);
      if (editVersion.current === capturedEdit) {
        setSession(saved); pendingMutation.current = null; setSaveState("saved");
      } else {
        setSession((current) => ({ ...current, revision: saved.revision })); pendingMutation.current = null; setSaveState("unsaved");
      }
      setMessage(nextStatus === "completed" ? "Session ledger saved and projected once into workout history." : "Draft saved.");
      if (!persisted) router.replace(`/training/${saved.id}`);
      if (nextStatus === "completed") router.refresh();
      return saved;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Session unavailable");
      setSaveState("error");
      return null;
    }
  }, [persisted, reviewed, router, session]);

  useEffect(() => {
    if (!reviewed || saveState !== "unsaved" || session.status === "completed") return;
    const timeout = window.setTimeout(() => { void persist(session.status); }, 700);
    return () => window.clearTimeout(timeout);
  }, [persist, reviewed, saveState, session.status]);

  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (["unsaved", "saving", "error"].includes(saveState)) event.preventDefault(); };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [saveState]);

  const completed = useMemo(() => session.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.completed), [session.exercises]);
  const working = completed.filter((set) => set.type === "working");
  const volume = working.reduce((sum, set) => sum + (set.loadKg ?? 0) * (set.reps ?? 0), 0);
  const effortValues = working.flatMap((set) => set.rpe === null ? [] : [set.rpe]);
  const effort = effortValues.length ? Math.round((effortValues.reduce((sum, value) => sum + value, 0) / effortValues.length) * 10) / 10 : null;

  function ghostFor(exerciseName: string, setIndex: number, type: "warm_up" | "working") {
    const source = history[normalizeName(exerciseName)];
    if (!source) return null;
    return source.sets.find((set, index) => index === setIndex && set.type === type) ?? source.sets.find((set) => set.type === type) ?? null;
  }

  function addExercise() {
    markEdited((current) => ({ ...current, exercises: [...current.exercises, newExercise(current.exercises.length)] }));
  }

  function removeExercise(exerciseId: string) {
    markEdited((current) => ({ ...current, exercises: reorder(current.exercises.filter((exercise) => exercise.id !== exerciseId)) }));
  }

  function moveExercise(index: number, direction: -1 | 1) {
    markEdited((current) => { const items = [...current.exercises]; const target = index + direction; if (target < 0 || target >= items.length) return current; [items[index], items[target]] = [items[target], items[index]]; return { ...current, exercises: reorder(items) }; });
  }

  function addSet(exerciseId: string, type: "warm_up" | "working") {
    markEdited((current) => ({ ...current, exercises: current.exercises.map((exercise) => exercise.id === exerciseId ? { ...exercise, sets: [...exercise.sets, newSet(exercise.sets.length, type)] } : exercise) }));
  }

  function removeSet(exerciseId: string, setId: string) {
    markEdited((current) => ({ ...current, exercises: current.exercises.map((exercise) => exercise.id === exerciseId ? { ...exercise, sets: reorder(exercise.sets.filter((set) => set.id !== setId)) } : exercise) }));
  }

  function moveSet(exerciseId: string, index: number, direction: -1 | 1) {
    markEdited((current) => ({ ...current, exercises: current.exercises.map((exercise) => { if (exercise.id !== exerciseId) return exercise; const items = [...exercise.sets]; const target = index + direction; if (target < 0 || target >= items.length) return exercise; [items[index], items[target]] = [items[target], items[index]]; return { ...exercise, sets: reorder(items) }; }) }));
  }

  function completeSet(exerciseId: string, exerciseName: string, set: SessionDraft["exercises"][number]["sets"][number], index: number) {
    if (set.completed) { patchSet(exerciseId, set.id, { completed: false, completedAt: null, restStartedAt: null, restPausedRemainingSeconds: null }); return; }
    const ghost = ghostFor(exerciseName, index, set.type);
    const loadKg = set.loadKg ?? ghost?.loadKg ?? null;
    const reps = set.reps ?? ghost?.reps ?? null;
    if (loadKg === null || reps === null) { setError("Enter load and reps, or use a comparable ghost value, before confirming the set."); return; }
    const startedAt = new Date().toISOString();
    patchSet(exerciseId, set.id, { loadKg, reps, rpe: set.rpe ?? ghost?.rpe ?? null, notes: set.notes || ghost?.notes || "", completed: true, completedAt: startedAt, restStartedAt: startedAt, restDurationSeconds: set.restDurationSeconds ?? ghost?.restDurationSeconds ?? (set.type === "warm_up" ? 90 : 120), restPausedRemainingSeconds: null });
    if (!session.startedAt) markEdited((current) => ({ ...current, status: "active", startedAt }));
  }

  function pauseRest() {
    if (!activeRest?.set.restStartedAt) return;
    patchSet(activeRest.exerciseId, activeRest.set.id, { restStartedAt: null, restPausedRemainingSeconds: restRemaining });
  }

  function resumeRest() {
    if (!activeRest || activeRest.set.restPausedRemainingSeconds === null) return;
    patchSet(activeRest.exerciseId, activeRest.set.id, { restStartedAt: new Date().toISOString(), restDurationSeconds: Math.max(1, activeRest.set.restPausedRemainingSeconds), restPausedRemainingSeconds: null });
  }

  function resetRest() {
    if (activeRest) patchSet(activeRest.exerciseId, activeRest.set.id, { restStartedAt: null, restPausedRemainingSeconds: null });
  }

  async function completeSession() {
    const saved = await persist("completed", completionMutation.current);
    if (saved) setMessage("Session completed. The ledger is durable and the workout projection remains one row on repeated completion.");
  }

  const prior = comparison?.prior?.totals ?? null;
  return <div className="page-shell training-editor-shell"><div className="page-head"><div><span className="eyebrow">{historical ? "Manual historical log" : reviewRequired && !reviewed ? "Unreviewed described draft" : "Training session"}</span><h1 className="page-title">{session.title}</h1><p className="page-subtitle">Each exercise and set is editable. Ghost values come from this account’s latest completed comparable exercise and are copied only when you confirm the set.</p></div><div className="stack-tight" style={{ justifyItems: "end" }}><span className={`badge ${session.inputDataMode === "synthetic_input" ? "synthetic" : "live"}`}>{session.inputDataMode.replaceAll("_", " ")}</span><span className={`save-indicator ${saveState}`} role="status">{!reviewed ? "Not saved · review required" : saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed · input retained" : "Unsaved changes"}</span></div></div>
    {message && <div className="success-box" style={{ marginBottom: 16 }}>{message}</div>}{error && <div className="error-box" role="alert" style={{ marginBottom: 16 }}>{error} {saveState === "error" && <button className="text-link" type="button" onClick={() => void persist(session.status)}>Retry same save</button>}</div>}
    {reviewRequired && !reviewed && <section className="card critical" style={{ marginBottom: 20 }}><span className="eyebrow">No automatic save</span><h2 className="section-title">Review this interpretation first.</h2><p className="muted">The deterministic parser did not call a model and has not written this draft. Edit any field, then explicitly allow persistent saves.</p><button className="button" type="button" onClick={() => { setReviewed(true); setSaveState("unsaved"); setMessage("Review confirmed. Persistent draft saves are now enabled."); }}>I reviewed it — save this draft</button></section>}
    {historical && <section className="card mist" style={{ marginBottom: 20 }}><strong>Historical entry is separate from advice.</strong><p className="muted small">This records what happened. It does not generate or accept a recommendation.</p><div className="form-field" style={{ marginTop: 12 }}><label htmlFor="historical-start">Session start</label><input id="historical-start" className="input" type="datetime-local" value={session.startedAt ? session.startedAt.slice(0, 16) : ""} onChange={(event) => markEdited((current) => ({ ...current, startedAt: event.target.value ? new Date(event.target.value).toISOString() : null }))}/></div></section>}
    <section className="card" style={{ marginBottom: 20 }}><div className="form-field"><label htmlFor="session-title">Session title</label><input id="session-title" className="input" value={session.title} onChange={(event) => markEdited((current) => ({ ...current, title: event.target.value }))}/></div><div className="form-field" style={{ marginTop: 14 }}><label htmlFor="session-notes">Session notes</label><textarea id="session-notes" className="textarea" value={session.notes} onChange={(event) => markEdited((current) => ({ ...current, notes: event.target.value }))}/></div></section>
    <div className="stack">{session.exercises.map((exercise, exerciseIndex) => <section className="card exercise-card" key={exercise.id}><div className="exercise-head"><div className="form-field exercise-name"><label htmlFor={`exercise-${exercise.id}`}>Exercise {exerciseIndex + 1}</label><input id={`exercise-${exercise.id}`} className="input" value={exercise.name} onChange={(event) => markEdited((current) => ({ ...current, exercises: current.exercises.map((item) => item.id === exercise.id ? { ...item, name: event.target.value } : item) }))}/>{history[normalizeName(exercise.name)] && <p className="form-hint">Ghost source: {history[normalizeName(exercise.name)].sessionTitle}, {new Date(history[normalizeName(exercise.name)].endedAt).toLocaleDateString("en-IE")}.</p>}</div><div className="cluster"><button className="icon-button" type="button" aria-label={`Move ${exercise.name} up`} disabled={exerciseIndex === 0} onClick={() => moveExercise(exerciseIndex, -1)}>↑</button><button className="icon-button" type="button" aria-label={`Move ${exercise.name} down`} disabled={exerciseIndex === session.exercises.length - 1} onClick={() => moveExercise(exerciseIndex, 1)}>↓</button><button className="button button-quiet button-small" type="button" disabled={session.exercises.length === 1} onClick={() => removeExercise(exercise.id)}>Remove</button></div></div><div className="form-field" style={{ marginTop: 12 }}><label htmlFor={`exercise-notes-${exercise.id}`}>Exercise notes</label><input id={`exercise-notes-${exercise.id}`} className="input" value={exercise.notes} onChange={(event) => markEdited((current) => ({ ...current, exercises: current.exercises.map((item) => item.id === exercise.id ? { ...item, notes: event.target.value } : item) }))}/></div><div className="set-list">{exercise.sets.map((set, setIndex) => { const ghost = ghostFor(exercise.name, setIndex, set.type); return <article className={`set-card ${set.completed ? "completed" : ""}`} key={set.id}><div className="set-card-head"><strong>Set {setIndex + 1}</strong><div className="cluster"><button className="icon-button compact" type="button" aria-label={`Move set ${setIndex + 1} up`} disabled={setIndex === 0} onClick={() => moveSet(exercise.id, setIndex, -1)}>↑</button><button className="icon-button compact" type="button" aria-label={`Move set ${setIndex + 1} down`} disabled={setIndex === exercise.sets.length - 1} onClick={() => moveSet(exercise.id, setIndex, 1)}>↓</button><button className="button button-quiet button-small" type="button" disabled={exercise.sets.length === 1} onClick={() => removeSet(exercise.id, set.id)}>Remove</button></div></div><div className="set-input-grid"><div className="form-field"><label htmlFor={`type-${set.id}`}>Set type</label><select id={`type-${set.id}`} className="select" value={set.type} onChange={(event) => patchSet(exercise.id, set.id, { type: event.target.value as "warm_up" | "working" })}><option value="warm_up">Warm-up</option><option value="working">Working</option></select></div><div className="form-field"><label htmlFor={`load-${set.id}`}>Load (kg)</label><input id={`load-${set.id}`} className="input" type="number" inputMode="decimal" min="0" step="0.5" value={set.loadKg ?? ""} placeholder={ghost?.loadKg?.toString() ?? "—"} onChange={(event) => patchSet(exercise.id, set.id, { loadKg: event.target.value === "" ? null : Number(event.target.value) })}/></div><div className="form-field"><label htmlFor={`reps-${set.id}`}>Repetitions</label><input id={`reps-${set.id}`} className="input" type="number" inputMode="numeric" min="0" step="1" value={set.reps ?? ""} placeholder={ghost?.reps?.toString() ?? "—"} onChange={(event) => patchSet(exercise.id, set.id, { reps: event.target.value === "" ? null : Number(event.target.value) })}/></div><div className="form-field"><label htmlFor={`rpe-${set.id}`}>RPE (optional)</label><input id={`rpe-${set.id}`} className="input" type="number" inputMode="decimal" min="1" max="10" step="0.5" value={set.rpe ?? ""} placeholder={ghost?.rpe?.toString() ?? "—"} onChange={(event) => patchSet(exercise.id, set.id, { rpe: event.target.value === "" ? null : Number(event.target.value) })}/></div><div className="form-field"><label htmlFor={`rest-${set.id}`}>Rest seconds</label><input id={`rest-${set.id}`} className="input" type="number" inputMode="numeric" min="1" max="3600" value={set.restDurationSeconds ?? ""} placeholder={ghost?.restDurationSeconds?.toString() ?? "120"} onChange={(event) => patchSet(exercise.id, set.id, { restDurationSeconds: event.target.value ? Number(event.target.value) : null })}/></div><div className="form-field set-notes"><label htmlFor={`notes-${set.id}`}>Set notes</label><input id={`notes-${set.id}`} className="input" value={set.notes} placeholder={ghost?.notes || "Optional"} onChange={(event) => patchSet(exercise.id, set.id, { notes: event.target.value })}/></div></div>{ghost && !set.completed && <p className="ghost-note">Ghost values are placeholders from the latest comparable completed exercise. The tick copies unchanged values; editing replaces them.</p>}<div className="set-thumb-actions"><button className={`set-tick ${set.completed ? "checked" : ""}`} type="button" aria-pressed={set.completed} aria-label={`${set.completed ? "Unconfirm" : "Confirm"} ${exercise.name} set ${setIndex + 1}`} onClick={() => completeSet(exercise.id, exercise.name, set, setIndex)}><span aria-hidden="true">✓</span>{set.completed ? "Confirmed" : "Confirm set"}</button></div></article>; })}</div><div className="cluster" style={{ marginTop: 16 }}><button className="button button-secondary button-small" type="button" onClick={() => addSet(exercise.id, "warm_up")}>Add warm-up</button><button className="button button-small" type="button" onClick={() => addSet(exercise.id, "working")}>Add working set</button></div></section>)}</div>
    <button className="button button-secondary" type="button" onClick={addExercise} style={{ marginTop: 16 }}>Add exercise</button>
    {activeRest && <aside className="rest-dock" aria-live="polite"><div><span className="eyebrow">Rest timer</span><strong>{Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, "0")}</strong><small>Calculated from a saved timestamp. No background alert is promised.</small></div><div className="cluster"><label className="rest-adjust">Seconds<input type="number" inputMode="numeric" min="1" max="3600" value={activeRest.set.restDurationSeconds ?? 120} onChange={(event) => patchSet(activeRest.exerciseId, activeRest.set.id, { restDurationSeconds: Number(event.target.value) })}/></label>{activeRest.set.restStartedAt ? <button className="button button-secondary button-small" type="button" onClick={pauseRest}>Pause</button> : <button className="button button-secondary button-small" type="button" onClick={resumeRest}>Resume</button>}<button className="button button-quiet button-small" type="button" onClick={resetRest}>Reset</button></div></aside>}
    <section className="card mist session-summary" style={{ marginTop: 20 }}><div><span className="eyebrow">Session summary</span><h2 className="section-title">{completed.length} completed sets · {volume} kg working volume</h2><p className="muted">Reported effort: {effort === null ? "Not entered" : `${effort} RPE`}. Warm-ups remain separate from working volume.</p></div>{comparison?.prior ? <div className="comparison-grid"><div><span>Working volume</span><strong>{delta(volume, prior!.workingVolumeKg, "kg")}</strong></div><div><span>Completed sets</span><strong>{delta(completed.length, prior!.completedSetCount, "sets")}</strong></div><div><span>Reported effort</span><strong>{delta(effort, prior!.reportedEffort, "RPE")}</strong></div><p className="form-hint profile-span">Compared with {comparison.prior.title} on {new Date(comparison.prior.endedAt).toLocaleDateString("en-IE")}.</p></div> : <div className="empty-state compact"><strong>First comparable session</strong><p className="muted small">No prior completed session shares an exercise. Current values are shown without a performance judgment.</p></div>}{decision && <div className={`proposal-carry ${decision.action === "Escalate" ? "critical" : ""}`}><span className="eyebrow">Next bounded proposed action · not applied</span><strong>{decision.action}</strong><p>{decision.proposal.text}</p>{decision.action === "Escalate" && <p className="status-escalate">No prescribed session can be generated from this recommendation.</p>}</div>}<div className="session-footer-actions"><button className="button button-secondary" type="button" onClick={() => void persist(session.status)} disabled={!reviewed || saveState === "saving"}>{saveState === "saving" ? "Saving…" : saveState === "error" ? "Retry save" : "Save now"}</button><button className="button" type="button" onClick={() => void completeSession()} disabled={!reviewed || saveState === "saving" || completed.length === 0 || session.status === "completed"}>{session.status === "completed" ? "Completed" : "Complete session"}</button></div></section>
  </div>;
}
