import { NextResponse } from "next/server";
import { getSamplesForUser } from "@/db/queries/health-samples";
import { getSession } from "@/db/auth-dal";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sampleType = searchParams.get("sampleType");
  if (!sampleType) {
    return NextResponse.json({ error: "sampleType is required" }, { status: 400 });
  }

  const samples = await getSamplesForUser(session.user.id, sampleType);
  return NextResponse.json({ samples });
}
