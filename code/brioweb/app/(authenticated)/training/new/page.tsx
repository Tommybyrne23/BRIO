import { requireUser } from "@/db/auth-dal";
import { getComparableExerciseHistoryForUser } from "@/db/queries/training-sessions";
import { getLatestDecisionForUser } from "@/db/queries/decisions";
import { TrainingSessionEditor } from "@/components/training-session-editor";

export default async function NewTrainingSessionPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const user = await requireUser();
  const [{ mode }, history, decision] = await Promise.all([searchParams, getComparableExerciseHistoryForUser(user.id), getLatestDecisionForUser(user.id)]);
  return <TrainingSessionEditor history={history} decision={decision} historical={mode === "historical"}/>;
}
