import { NextResponse } from "next/server";
import { getSession } from "@/db/auth-dal";
import { getDashboardForUser } from "@/db/queries/dashboard";
import { LocalDateSchema } from "@/lib/contracts";
import { apiError, unauthorized } from "@/lib/server/http";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const date = LocalDateSchema.parse(new URL(request.url).searchParams.get("date") ?? new Date().toISOString().slice(0, 10));
    return NextResponse.json({ dashboard: await getDashboardForUser(session.user.id, date) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
