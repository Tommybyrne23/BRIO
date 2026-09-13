import { NextResponse } from "next/server";
import { getSession } from "@/db/auth-dal";
import { parseTrainingDescription } from "@/lib/training/description-parser";
import { apiError, readJson, unauthorized } from "@/lib/server/http";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const body = await readJson(request);
    const description = typeof body === "object" && body !== null && "description" in body ? (body as { description: unknown }).description : undefined;
    return NextResponse.json(parseTrainingDescription(String(description ?? "")));
  } catch (error) {
    return apiError(error);
  }
}
