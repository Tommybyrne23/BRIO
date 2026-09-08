import { NextResponse } from "next/server";
import { getSamplesForUser } from "@/db/queries/health-samples";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const sampleType = searchParams.get("sampleType");

  if (!userId || !sampleType) {
    return NextResponse.json({ error: "userId and sampleType are required" }, { status: 400 });
  }

  const samples = await getSamplesForUser(userId, sampleType);
  return NextResponse.json({ samples });
}
