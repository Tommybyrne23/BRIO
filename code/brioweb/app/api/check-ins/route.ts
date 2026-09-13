import { NextResponse } from "next/server";
import { getSession } from "@/db/auth-dal";
import { getCheckInForUser, saveCheckInForUser } from "@/db/queries/product-state";
import { DailyCheckInSchema, LocalDateSchema } from "@/lib/contracts";
import { apiError, readJson, unauthorized } from "@/lib/server/http";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const localDate = LocalDateSchema.parse(new URL(request.url).searchParams.get("date"));
    return NextResponse.json({ checkIn: await getCheckInForUser(session.user.id, localDate) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const input = DailyCheckInSchema.parse(await readJson(request));
    return NextResponse.json({ checkIn: await saveCheckInForUser(session.user.id, input) });
  } catch (error) {
    return apiError(error);
  }
}
