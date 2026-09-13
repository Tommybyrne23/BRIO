import { notFound } from "next/navigation";
import { requireUser } from "@/db/auth-dal";
import { getComparableExerciseHistoryForUser, getSessionComparisonForUser, getTrainingSessionForUser } from "@/db/queries/training-sessions";
import { getLatestDecisionForUser } from "@/db/queries/decisions";
import { TrainingSessionEditor } from "@/components/training-session-editor";

export default async function TrainingSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [session, history, comparison, decision] = await Promise.all([
    getTrainingSessionForUser(user.id, id),
    getComparableExerciseHistoryForUser(user.id),
    getSessionComparisonForUser(user.id, id),
    getLatestDecisionForUser(user.id),
  ]);
  if (!session) notFound();
  return <TrainingSessionEditor initial={session} history={history} comparison={comparison} decision={decision}/>;
}
