import { NextResponse } from "next/server";
import { getSession } from "@/db/auth-dal";
import { getSourceStatusesForUser } from "@/db/queries/governance";
import { apiError, unauthorized } from "@/lib/server/http";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    return NextResponse.json({ sources: await getSourceStatusesForUser(session.user.id) });
  } catch (error) {
    return apiError(error);
  }
}
