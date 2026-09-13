import { z } from "zod";
import { TrainingSessionWriteSchema } from "@/lib/contracts";

export const DescribeTrainingRequestSchema = z.object({
  description: z.string().trim().min(5).max(4000),
}).strict();

export const DescribeTrainingResultSchema = z.object({
  parser: z.literal("deterministic-pattern-parser-v1"),
  saved: z.literal(false),
  interpretation: TrainingSessionWriteSchema,
  rulesApplied: z.array(z.string().min(1).max(240)).min(1),
  warnings: z.array(z.string().min(1).max(240)).max(20),
}).strict();

const setPattern = /(\d+)\s*(?:x|×|sets?\s+of)\s*(\d+)(?:\s*(?:@|at)?\s*(\d+(?:\.\d+)?)\s*kg)?(?:\s*(?:at\s*)?rpe\s*(\d+(?:\.\d+)?))?(?:\s*(?:with\s*)?(\d+)\s*(s|sec|secs|seconds?|m|min|mins|minutes?)\s*rest)?/i;

function restSeconds(value: string | undefined, unit: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return unit?.toLowerCase().startsWith("m") ? parsed * 60 : parsed;
}

function exerciseFromLine(line: string, order: number, warnings: string[]) {
  const colon = line.indexOf(":");
  const firstMatch = line.match(setPattern);
  const inferredName = colon >= 0 ? line.slice(0, colon) : firstMatch?.index ? line.slice(0, firstMatch.index) : line;
  const name = inferredName.replace(/^[-*\d.)\s]+/, "").trim() || `Exercise ${order + 1}`;
  const prescription = colon >= 0 ? line.slice(colon + 1) : line.slice(firstMatch?.index ?? line.length);
  const segments = prescription.split(/,(?=\s*\d+\s*(?:x|×|sets?\s+of))/i).map((part) => part.trim()).filter(Boolean);
  const sets: Array<{
    id: string; order: number; type: "warm_up" | "working"; loadKg: number | null; reps: number | null;
    rpe: number | null; notes: string; completed: false; completedAt: null; restStartedAt: null;
    restDurationSeconds: number; restPausedRemainingSeconds: null;
  }> = [];

  for (const segment of segments.length ? segments : [prescription]) {
    const match = segment.match(setPattern);
    if (!match) continue;
    const count = Math.min(Number(match[1]), 20);
    const reps = Number(match[2]);
    const loadKg = match[3] ? Number(match[3]) : null;
    const rpe = match[4] ? Number(match[4]) : null;
    const type = /warm[ -]?up/i.test(segment) ? "warm_up" as const : "working" as const;
    const restDurationSeconds = restSeconds(match[5], match[6], type === "warm_up" ? 90 : 120);
    for (let index = 0; index < count; index++) sets.push({
      id: crypto.randomUUID(), order: sets.length, type, loadKg, reps, rpe, notes: "",
      completed: false, completedAt: null, restStartedAt: null, restDurationSeconds,
      restPausedRemainingSeconds: null,
    });
  }

  if (!sets.length) {
    warnings.push(`${name}: no sets × reps pattern was found; one empty working set was added for review.`);
    sets.push({ id: crypto.randomUUID(), order: 0, type: "working", loadKg: null, reps: null, rpe: null, notes: "", completed: false, completedAt: null, restStartedAt: null, restDurationSeconds: 120, restPausedRemainingSeconds: null });
  }
  return { id: crypto.randomUUID(), order, name: name.slice(0, 160), notes: "", sets };
}

export function parseTrainingDescription(description: string) {
  const source = DescribeTrainingRequestSchema.parse({ description }).description;
  const warnings: string[] = [];
  const rawLines = source.split(/[\n;]+/).map((line) => line.trim()).filter(Boolean);
  const titleLine = rawLines.find((line) => /^session\s*:/i.test(line));
  const exerciseLines = rawLines.filter((line) => line !== titleLine);
  const title = titleLine?.replace(/^session\s*:/i, "").trim() || "Described session";
  const exercises = (exerciseLines.length ? exerciseLines : [source]).slice(0, 50).map((line, index) => exerciseFromLine(line, index, warnings));
  const interpretation = TrainingSessionWriteSchema.parse({
    schemaVersion: "1.0.0",
    id: crypto.randomUUID(),
    title: title.slice(0, 160),
    status: "draft",
    inputDataMode: "manual",
    startedAt: null,
    endedAt: null,
    exercises,
    notes: `Unreviewed deterministic interpretation of: ${source}`.slice(0, 2000),
    revision: 0,
    mutationId: `description-${crypto.randomUUID()}`,
  });
  return DescribeTrainingResultSchema.parse({
    parser: "deterministic-pattern-parser-v1",
    saved: false,
    interpretation,
    rulesApplied: [
      "One exercise per line or semicolon; optional 'Session:' line becomes the title.",
      "Patterns such as 3x5, 3 sets of 5, optional kg, RPE, warm-up, and rest durations are recognized.",
      "Anything uncertain stays empty or appears as a warning; this interpretation is never saved until reviewed.",
    ],
    warnings,
  });
}

export type DescribeTrainingResult = z.infer<typeof DescribeTrainingResultSchema>;
