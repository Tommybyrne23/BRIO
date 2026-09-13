import { NextResponse } from "next/server";
import { getSession } from "@/db/auth-dal";
import { getConsentForUser, updateConsentForUser } from "@/db/queries/product-state";
import { ConsentPatchSchema } from "@/lib/contracts";
import { apiError, readJson, unauthorized } from "@/lib/server/http";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    return NextResponse.json({ consent: await getConsentForUser(session.user.id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const input = ConsentPatchSchema.parse(await readJson(request));
    const consent = await updateConsentForUser(session.user.id, input);
    return NextResponse.json({ consent });
  } catch (error) {
    return apiError(error);
  }
}
