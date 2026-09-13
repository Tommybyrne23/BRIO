import { NextResponse } from "next/server";
import { getSession } from "@/db/auth-dal";
import { listTrainingSessionsForUser, saveTrainingSessionForUser } from "@/db/queries/training-sessions";
import { TrainingSessionWriteSchema } from "@/lib/contracts";
import { apiError, readJson, unauthorized } from "@/lib/server/http";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    return NextResponse.json({ sessions: await listTrainingSessionsForUser(session.user.id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const input = TrainingSessionWriteSchema.parse(await readJson(request));
    return NextResponse.json({ session: await saveTrainingSessionForUser(session.user.id, input) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
