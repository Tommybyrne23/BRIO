import { tool } from "@openai/agents";
import { z } from "zod";
import { getPreferencesForUser } from "@/db/queries/product-state";

export function buildGetTrainingProfileTool(userId: string) {
  return tool({
    name: "get_training_profile",
    description: "Get this user's explicit, editable planning context: age band, activity level, training history, primary training, schedule, equipment, goal and block. It is self-reported context, not current evidence or a diagnosis.",
    parameters: z.object({}),
    async execute() {
      const preferences = await getPreferencesForUser(userId);
      const birthYear = preferences.profile.birthYear;
      return {
        profileCompleted: preferences.profile.completed,
        approximateAge: birthYear ? new Date().getUTCFullYear() - birthYear : null,
        sex: preferences.profile.sex,
        activityLevel: preferences.profile.activityLevel,
        trainingExperience: preferences.profile.trainingExperience,
        primaryTraining: preferences.profile.primaryTraining,
        trainingDaysPerWeek: preferences.profile.trainingDaysPerWeek,
        typicalSessionMinutes: preferences.profile.typicalSessionMinutes,
        recentTrainingSummary: preferences.profile.recentTrainingSummary || null,
        equipmentAccess: preferences.profile.equipmentAccess || null,
        goal: preferences.goal,
        trainingBlock: preferences.trainingBlock,
        confirmedRestrictionLabels: preferences.restrictions.filter((item) => item.confirmed).map((item) => item.label),
        caution: "Self-reported planning context; do not treat it as live evidence, a diagnosis, or permission to exceed the five-action policy.",
      };
    },
  });
}
