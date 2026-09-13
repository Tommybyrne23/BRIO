import { tool } from "@openai/agents";
import { z } from "zod";
import { isSignalEnabled, listManualLogsForUser } from "@/db/queries/product-state";

function dateKeyDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - Math.max(0, days - 1));
  return date.toISOString().slice(0, 10);
}

export function buildGetNutritionHistoryTool(userId: string) {
  return tool({
    name: "get_nutrition_history",
    description:
      "Get this user's manually entered daily nutrition totals and named foods for the requested window. Returns explicit synthetic-demo provenance when present.",
    parameters: z.object({
      days: z.number().int().min(1).max(60).default(14),
    }),
    async execute({ days }) {
      if (!(await isSignalEnabled(userId, "manual_nutrition"))) {
        return {
          status: "excluded",
          reason: "manual_nutrition is not consented and was not read",
          daysRequested: days,
          daysRecorded: 0,
          entries: [],
        };
      }

      const cutoff = dateKeyDaysAgo(days);
      const logs = (await listManualLogsForUser(userId, Math.min(60, days + 7)))
        .filter((log) => log.localDate >= cutoff && log.nutrition);
      const entries = logs.map((log) => {
        const synthetic = log.mutationId.startsWith("synthetic-")
          || log.overall?.note?.startsWith("[SYNTHETIC INPUT]") === true
          || log.nutrition?.foods?.some((food) => food.name.startsWith("[SYNTHETIC DEMO FOOD]")) === true;
        return {
          localDate: log.localDate,
          energyIntakeKcal: log.nutrition?.energyIntakeKcal ?? null,
          proteinGrams: log.nutrition?.proteinGrams ?? null,
          carbohydrateGrams: log.nutrition?.carbohydrateGrams ?? null,
          fatGrams: log.nutrition?.fatGrams ?? null,
          foods: (log.nutrition?.foods ?? []).map((food) => ({
            name: food.name,
            energyKcal: food.energyKcal,
            proteinGrams: food.proteinGrams,
            carbohydrateGrams: food.carbohydrateGrams,
            fatGrams: food.fatGrams,
          })),
          syntheticInput: synthetic,
        };
      });

      const totals = entries.reduce((sum, entry) => ({
        energyIntakeKcal: sum.energyIntakeKcal + (entry.energyIntakeKcal ?? 0),
        proteinGrams: sum.proteinGrams + (entry.proteinGrams ?? 0),
        carbohydrateGrams: sum.carbohydrateGrams + (entry.carbohydrateGrams ?? 0),
        fatGrams: sum.fatGrams + (entry.fatGrams ?? 0),
      }), { energyIntakeKcal: 0, proteinGrams: 0, carbohydrateGrams: 0, fatGrams: 0 });
      const denominator = Math.max(1, entries.length);
      const syntheticDays = entries.filter((entry) => entry.syntheticInput).length;

      return {
        status: entries.length ? "available" : "missing",
        daysRequested: days,
        daysRecorded: entries.length,
        averagePerRecordedDay: entries.length ? {
          energyIntakeKcal: Math.round(totals.energyIntakeKcal / denominator),
          proteinGrams: Math.round(totals.proteinGrams / denominator),
          carbohydrateGrams: Math.round(totals.carbohydrateGrams / denominator),
          fatGrams: Math.round(totals.fatGrams / denominator),
        } : null,
        syntheticDays,
        provenanceWarning: syntheticDays > 0
          ? `${syntheticDays} of ${entries.length} recorded days are explicitly labelled synthetic demo inputs.`
          : null,
        entries,
      };
    },
  });
}
