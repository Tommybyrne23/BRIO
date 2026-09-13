import { NextResponse } from "next/server";
import { getSession } from "@/db/auth-dal";
import { respondToDecisionForUser } from "@/db/queries/decisions";
import { DecisionResponseSchema } from "@/lib/contracts";
import { apiError, readJson, unauthorized } from "@/lib/server/http";

export async function POST(request: Request, context: RouteContext<"/api/decisions/[id]/respond">) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const { id } = await context.params;
    const input = DecisionResponseSchema.parse(await readJson(request));
    if (input.decisionId !== id) return NextResponse.json({ error: "Decision ID does not match route" }, { status: 400 });
    return NextResponse.json({ event: await respondToDecisionForUser(session.user.id, input) });
  } catch (error) {
    return apiError(error);
  }
}
