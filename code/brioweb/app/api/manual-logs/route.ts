import { NextResponse } from "next/server";
import { getSession } from "@/db/auth-dal";
import {
  getManualLogForUser,
  listManualLogsForUser,
  saveManualLogForUser,
} from "@/db/queries/product-state";
import { LocalDateSchema, ManualLogSchema } from "@/lib/contracts";
import { apiError, readJson, unauthorized } from "@/lib/server/http";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const date = new URL(request.url).searchParams.get("date");
    if (date) {
      return NextResponse.json({ manualLog: await getManualLogForUser(session.user.id, LocalDateSchema.parse(date)) });
    }
    return NextResponse.json({ manualLogs: await listManualLogsForUser(session.user.id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const input = ManualLogSchema.parse(await readJson(request));
    return NextResponse.json({ manualLog: await saveManualLogForUser(session.user.id, input) });
  } catch (error) {
    return apiError(error);
  }
}
