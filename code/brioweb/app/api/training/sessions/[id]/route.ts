import { NextResponse } from "next/server";
import { getSession } from "@/db/auth-dal";
import { getSessionComparisonForUser, getTrainingSessionForUser, saveTrainingSessionForUser } from "@/db/queries/training-sessions";
import { TrainingSessionWriteSchema } from "@/lib/contracts";
import { apiError, readJson, unauthorized } from "@/lib/server/http";

export async function GET(_request: Request, context: RouteContext<"/api/training/sessions/[id]">) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const { id } = await context.params;
    const [result, comparison] = await Promise.all([getTrainingSessionForUser(session.user.id, id), getSessionComparisonForUser(session.user.id, id)]);
    if (!result) return NextResponse.json({ error: "Training session not found" }, { status: 404 });
    return NextResponse.json({ session: result, comparison });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/training/sessions/[id]">) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const { id } = await context.params;
    const input = TrainingSessionWriteSchema.parse(await readJson(request));
    if (input.id !== id) return NextResponse.json({ error: "Session ID does not match route" }, { status: 400 });
    const existing = await getTrainingSessionForUser(session.user.id, id);
    if (!existing) return NextResponse.json({ error: "Training session not found" }, { status: 404 });
    return NextResponse.json({ session: await saveTrainingSessionForUser(session.user.id, input) });
  } catch (error) {
    return apiError(error);
  }
}
