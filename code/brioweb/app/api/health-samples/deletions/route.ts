import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/db/auth-dal";
import { deleteHealthSamplesByExternalIds } from "@/db/queries/health-samples";
import { apiError, readJson, unauthorized } from "@/lib/server/http";

const DeletionsSchema = z.object({ externalIds: z.array(z.string().trim().min(1).max(255)).min(1).max(250) }).strict();

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const input = DeletionsSchema.parse(await readJson(request));
    const deleted = await deleteHealthSamplesByExternalIds(session.user.id, input.externalIds);
    return NextResponse.json({ deletedCount: deleted.length, externalIds: deleted.map((row) => row.externalId) });
  } catch (error) {
    return apiError(error);
  }
}
