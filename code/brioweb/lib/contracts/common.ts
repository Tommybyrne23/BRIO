import { z } from "zod";

export const SCHEMA_VERSION = "1.0.0" as const;
export const POLICY_VERSION = "prototype-1" as const;
export const DEFAULT_TIME_ZONE = "Europe/Dublin" as const;
export const MAX_INGEST_BATCH_SIZE = 250;

export const NonEmptyIdSchema = z.string().trim().min(1).max(160);
export const MutationIdSchema = z.string().trim().min(8).max(160);
export const RevisionSchema = z.number().int().nonnegative();
export const FiniteNumberSchema = z.number().finite();
export const NonNegativeNumberSchema = FiniteNumberSchema.nonnegative();
export const PositiveNumberSchema = FiniteNumberSchema.positive();
export const LocalDateSchema = z.iso.date();
export const UtcTimestampSchema = z.iso.datetime({ offset: true });

export const TimeZoneSchema = z.string().trim().min(1).max(128).refine(
  (value) => {
    try {
      new Intl.DateTimeFormat("en-IE", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  },
  { message: "Use a valid IANA timezone" },
);

export const DataModeSchema = z.enum([
  "live",
  "manual",
  "synthetic_input",
  "simulated_decision",
  "unavailable",
]);
export type DataMode = z.infer<typeof DataModeSchema>;

export const InputDataModeSchema = z.enum(["live", "manual", "synthetic_input", "unavailable"]);
export const DecisionExecutionModeSchema = z.enum([
  "deterministic_prototype",
  "live_agent",
  "simulated_decision",
]);

export const CoverageStatusSchema = z.enum(["complete", "partial", "missing", "not_expected"]);
export const FreshnessStatusSchema = z.enum(["fresh", "stale", "unknown"]);
export const ConfidenceStatusSchema = z.enum(["normal", "low", "unknown"]);

export const ProvenanceSchema = z.object({
  sourceName: z.string().trim().min(1).max(160).nullable(),
  ingestionSource: z.enum([
    "apple_health_helper",
    "manual_entry",
    "synthetic_fixture",
    "derived",
    "unavailable",
  ]),
  inputDataMode: InputDataModeSchema,
  observedAt: UtcTimestampSchema.nullable(),
  captureTimeZone: TimeZoneSchema.nullable().default(null),
  sourceRecordCount: z.number().int().nonnegative(),
  coverage: z.number().finite().min(0).max(1).nullable(),
  coverageStatus: CoverageStatusSchema,
  freshness: FreshnessStatusSchema,
  confidence: ConfidenceStatusSchema,
  qualityReason: z.string().trim().min(1).max(240),
}).strict().superRefine((value, ctx) => {
  const hasObservation = value.coverageStatus === "complete" || value.coverageStatus === "partial";
  if (hasObservation && (value.observedAt === null || value.sourceName === null || value.sourceRecordCount < 1)) {
    ctx.addIssue({ code: "custom", message: "Observed provenance requires source, timestamp, and records" });
  }
  if (!hasObservation && value.sourceRecordCount !== 0) {
    ctx.addIssue({ code: "custom", message: "Missing provenance cannot report contributing records" });
  }
});

export const HealthSampleSchema = z.object({
  sampleType: z.string().trim().min(1).max(255),
  value: FiniteNumberSchema,
  unit: z.string().trim().min(1).max(64).nullable().optional(),
  startDate: UtcTimestampSchema,
  endDate: UtcTimestampSchema,
  sourceName: z.string().trim().min(1).max(255).nullable().optional(),
  externalId: z.string().trim().min(1).max(255).nullable().optional(),
  metadata: z.unknown().optional(),
}).strict().superRefine((value, ctx) => {
  if (new Date(value.endDate).getTime() < new Date(value.startDate).getTime()) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "endDate must be on or after startDate" });
  }
});

export const HealthSampleBatchSchema = z.array(HealthSampleSchema).min(1).max(MAX_INGEST_BATCH_SIZE);
export const HealthSampleRequestSchema = z.union([
  HealthSampleSchema,
  HealthSampleBatchSchema,
  z.object({ samples: HealthSampleBatchSchema }).strict(),
]);

export function normalizeHealthSampleRequest(input: z.infer<typeof HealthSampleRequestSchema>) {
  if (Array.isArray(input)) return input;
  if ("samples" in input) return input.samples;
  return [input];
}

export type Provenance = z.infer<typeof ProvenanceSchema>;
export type HealthSampleInput = z.infer<typeof HealthSampleSchema>;
