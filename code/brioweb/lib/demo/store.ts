import { DecisionActionSchema, DecisionResponseSchema, type DecisionAction } from "@/lib/contracts";
import { createDemoFixture, DEMO_FIXTURE_VERSION, type DemoFixture, type DemoScenario } from "./fixture";

export const DEMO_STORAGE_KEY = `brio:${DEMO_FIXTURE_VERSION}:state`;

export type DemoStoreState = DemoFixture & {
  decisionResponse: ReturnType<typeof DecisionResponseSchema.parse> | null;
  unsaved: boolean;
};

export type DemoAction =
  | { type: "scenario"; scenario: DemoScenario }
  | { type: "toggle_signal"; signal: string; enabled: boolean }
  | { type: "respond"; kind: "accepted" | "overridden"; action: DecisionAction; reason?: string }
  | { type: "complete_set"; setId: string }
  | { type: "save_nutrition"; energyIntakeKcal: number; proteinGrams: number; carbohydrateGrams: number }
  | { type: "reset" };

export function createDemoStoreState(anchorDate: string, scenario: DemoScenario = "specialist_disagreement"): DemoStoreState {
  return { ...createDemoFixture(anchorDate, scenario), decisionResponse: null, unsaved: false };
}

export function demoReducer(state: DemoStoreState, action: DemoAction): DemoStoreState {
  if (action.type === "reset") return createDemoStoreState(state.anchorDate);
  if (action.type === "scenario") return createDemoStoreState(state.anchorDate, action.scenario);
  if (action.type === "toggle_signal") {
    const changedAt = `${state.anchorDate}T10:00:00.000Z`;
    const signals = state.consent.signals.map((signal) => signal.signal === action.signal ? { ...signal, enabled: action.enabled, changedAt } : signal);
    const consent = { ...state.consent, consentVersion: state.consent.consentVersion + 1, signals, updatedAt: changedAt };
    const metrics = state.dashboard.metrics.map((metric) => action.signal === "health_sleep" && metric.key === "sleep_duration" && !action.enabled
      ? { ...metric, value: null, displayValue: "Not being read", state: "excluded" as const, stateLabel: "Not being read", baselineText: "Sleep consent is off; stored values are not used." }
      : metric);
    return { ...state, consent, dashboard: { ...state.dashboard, consentVersion: consent.consentVersion, metrics, decision: state.dashboard.decision ? { ...state.dashboard.decision, status: "stale", staleAt: changedAt } : null }, unsaved: false };
  }
  if (action.type === "respond") {
    const current = state.dashboard.decision;
    if (!current) return state;
    const selectedAction = DecisionActionSchema.parse(action.action);
    const event = DecisionResponseSchema.parse({ schemaVersion: "1.0.0", decisionId: current.id, kind: action.kind, selectedAction, proposal: current.proposal, reason: action.kind === "overridden" ? action.reason || "User chose a different bounded action." : null, mutationId: `demo-response-${current.id}-${action.kind}`, consentVersion: state.consent.consentVersion, respondedAt: `${state.anchorDate}T10:05:00.000Z` });
    return { ...state, decisionResponse: event, dashboard: { ...state.dashboard, decision: { ...current, status: action.kind } }, unsaved: false };
  }
  if (action.type === "complete_set") {
    const completedAt = `${state.anchorDate}T18:10:00.000Z`;
    return { ...state, trainingSession: { ...state.trainingSession, exercises: state.trainingSession.exercises.map((exercise) => ({ ...exercise, sets: exercise.sets.map((set) => set.id === action.setId ? { ...set, completed: true, completedAt, restStartedAt: completedAt } : set) })), revision: state.trainingSession.revision + 1, updatedAt: completedAt }, unsaved: false };
  }
  return { ...state, manualLog: { ...state.manualLog, nutrition: { energyIntakeKcal: action.energyIntakeKcal, proteinGrams: action.proteinGrams, carbohydrateGrams: action.carbohydrateGrams }, revision: state.manualLog.revision + 1 }, unsaved: false };
}

export function loadDemoState(anchorDate: string): DemoStoreState {
  if (typeof window === "undefined") return createDemoStoreState(anchorDate);
  const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
  if (!raw) return createDemoStoreState(anchorDate);
  try {
    const parsed = JSON.parse(raw) as DemoStoreState;
    return parsed.fixtureVersion === DEMO_FIXTURE_VERSION ? parsed : createDemoStoreState(anchorDate);
  } catch {
    return createDemoStoreState(anchorDate);
  }
}

export function persistDemoState(state: DemoStoreState) {
  if (typeof window !== "undefined") window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
}
