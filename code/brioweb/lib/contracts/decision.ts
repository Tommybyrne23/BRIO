import { z } from "zod";
import {
  DecisionExecutionModeSchema,
  InputDataModeSchema,
  MutationIdSchema,
  NonEmptyIdSchema,
  POLICY_VERSION,
  SCHEMA_VERSION,
  UtcTimestampSchema,
} from "./common";
import { MetricSchema } from "./daily";
import { ConsentSnapshotSchema, PreferencesSchema, SourceStatusSchema } from "./preferences";
import { TrainingSessionSchema } from "./training";

export const DecisionActionSchema = z.enum([
  "Progress",
  "Maintain",
  "Repeat",
  "Reduce",
  "Escalate",
]);
export const DecisionStatusSchema = z.enum([
  "proposed",
  "accepted",
  "overridden",
  "stale",
  "escalated",
  "unavailable",
]);

export const BoundedProposalSchema = z.object({
  target: z.enum(["session_load", "session_volume", "session_effort", "rest", "manual_review"]),
  direction: z.enum(["increase", "hold", "repeat", "decrease", "stop"]),
  amount: z.number().finite().nonnegative().nullable(),
  unit: z.enum(["percent", "kilograms", "sets", "repetitions", "minutes", "none"]),
  lowerBound: z.number().finite().nullable(),
  upperBound: z.number().finite().nullable(),
  editable: z.literal(true),
  text: z.string().trim().min(1).max(240),
}).strict().superRefine((proposal, ctx) => {
  if (proposal.lowerBound !== null && proposal.upperBound !== null && proposal.lowerBound > proposal.upperBound) {
    ctx.addIssue({ code: "custom", message: "Proposal lowerBound cannot exceed upperBound" });
  }
  if (proposal.unit === "none" && proposal.amount !== null) {
    ctx.addIssue({ code: "custom", message: "Unit none requires a null amount" });
  }
});

export const EvidenceReferenceSchema = z.object({
  id: NonEmptyIdSchema,
  metricKey: MetricSchema.shape.key,
  sourceLabel: z.string().trim().min(1).max(160),
  observedAt: UtcTimestampSchema.nullable(),
  evidenceWindow: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(240),
}).strict();

export const SpecialistSummarySchema = z.object({
  specialist: z.enum(["readiness", "training", "recovery", "nutrition", "prototype_policy"]),
  status: z.enum(["completed", "unavailable", "excluded", "simulated"]),
  suggestedAction: DecisionActionSchema.nullable(),
  summary: z.string().trim().min(1).max(400),
}).strict();

export const DecisionSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  policyVersion: z.literal(POLICY_VERSION),
  id: NonEmptyIdSchema,
  status: DecisionStatusSchema,
  action: DecisionActionSchema,
  proposal: BoundedProposalSchema,
  inputDataMode: InputDataModeSchema,
  executionMode: DecisionExecutionModeSchema,
  evidence: z.array(EvidenceReferenceSchema).max(30),
  excludedSignals: z.array(z.object({
    signal: z.string().trim().min(1).max(80),
    reason: z.enum(["not_consented", "missing", "stale", "unavailable"]),
  }).strict()).max(30),
  uncertainty: z.array(z.string().trim().min(1).max(240)).min(1).max(10),
  specialists: z.array(SpecialistSummarySchema).max(10),
  disagreement: z.object({
    present: z.boolean(),
    summary: z.string().trim().min(1).max(400).nullable(),
  }).strict(),
  policyReason: z.string().trim().min(1).max(600),
  consentVersion: z.number().int().positive(),
  generatedAt: UtcTimestampSchema,
  staleAt: UtcTimestampSchema.nullable(),
}).strict().superRefine((decision, ctx) => {
  if (decision.action === "Escalate" && decision.status !== "escalated") {
    ctx.addIssue({ code: "custom", path: ["status"], message: "Escalate decisions must have escalated status" });
  }
  if (decision.status === "escalated" && decision.action !== "Escalate") {
    ctx.addIssue({ code: "custom", path: ["action"], message: "Escalated status requires Escalate action" });
  }
  if (decision.disagreement.present && !decision.disagreement.summary) {
    ctx.addIssue({ code: "custom", path: ["disagreement", "summary"], message: "Disagreement requires a summary" });
  }
});

export const DecisionResponseSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  decisionId: NonEmptyIdSchema,
  kind: z.enum(["accepted", "overridden"]),
  selectedAction: DecisionActionSchema,
  proposal: BoundedProposalSchema,
  reason: z.string().trim().max(1000).nullable(),
  mutationId: MutationIdSchema,
  consentVersion: z.number().int().positive(),
  respondedAt: UtcTimestampSchema,
}).strict().superRefine((event, ctx) => {
  if (event.kind === "overridden" && !event.reason) {
    ctx.addIssue({ code: "custom", path: ["reason"], message: "An override reason is required" });
  }
});

export const DashboardSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  localDate: z.iso.date(),
  metrics: z.array(MetricSchema).length(9),
  decision: DecisionSchema.nullable(),
  consentVersion: z.number().int().positive(),
  dataGeneratedAt: UtcTimestampSchema,
  sourceStatuses: z.array(SourceStatusSchema),
}).strict();

export const ExportEnvelopeSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  exportedAt: UtcTimestampSchema,
  accountId: NonEmptyIdSchema,
  preferences: PreferencesSchema.nullable(),
  consent: ConsentSnapshotSchema,
  healthSamples: z.array(z.record(z.string(), z.unknown())),
  manualLogs: z.array(z.record(z.string(), z.unknown())),
  checkIns: z.array(z.record(z.string(), z.unknown())),
  trainingSessions: z.array(TrainingSessionSchema),
  decisions: z.array(DecisionSchema),
  decisionEvents: z.array(DecisionResponseSchema),
}).strict();

export const DemoScenarioSchema = z.enum([
  "normal_evidence",
  "specialist_disagreement",
  "signal_revoked",
  "missing_nutrition",
  "stale_helper",
  "model_timeout",
  "escalation",
]);

export const DemoStateSchema = z.object({
  fixtureVersion: z.literal("brio-demo-v1"),
  personaId: z.literal("synthetic-brio-demo"),
  anchorDate: z.iso.date(),
  scenario: DemoScenarioSchema,
  inputDataMode: z.literal("synthetic_input"),
  decisionExecutionMode: z.enum(["simulated_decision", "live_agent"]),
  lastResetAt: UtcTimestampSchema,
}).strict();

export type Decision = z.infer<typeof DecisionSchema>;
export type DecisionResponse = z.infer<typeof DecisionResponseSchema>;
export type DecisionAction = z.infer<typeof DecisionActionSchema>;
export type Dashboard = z.infer<typeof DashboardSchema>;
