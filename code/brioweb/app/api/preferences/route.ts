import { NextResponse } from "next/server";
import { getSession } from "@/db/auth-dal";
import { getPreferencesForUser, updatePreferencesForUser } from "@/db/queries/product-state";
import { PreferencePatchSchema } from "@/lib/contracts";
import { apiError, readJson, unauthorized } from "@/lib/server/http";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    return NextResponse.json({ preferences: await getPreferencesForUser(session.user.id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const input = PreferencePatchSchema.parse(await readJson(request));
    const preferences = await updatePreferencesForUser(session.user.id, input);
    return NextResponse.json({ preferences });
  } catch (error) {
    return apiError(error);
  }
}
