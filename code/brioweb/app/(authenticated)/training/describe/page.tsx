import { requireUser } from "@/db/auth-dal";
import { getComparableExerciseHistoryForUser } from "@/db/queries/training-sessions";
import { getLatestDecisionForUser } from "@/db/queries/decisions";
import { DescribeTrainingSession } from "@/components/describe-training-session";

export default async function DescribeTrainingPage() {
  const user = await requireUser();
  const [history, decision] = await Promise.all([getComparableExerciseHistoryForUser(user.id), getLatestDecisionForUser(user.id)]);
  return <DescribeTrainingSession history={history} decision={decision}/>;
}
