import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/db/auth-dal";
import { getCurrentDecisionForUser, listDecisionsForUser, saveDecisionForUser } from "@/db/queries/decisions";
import { getDashboardForUser } from "@/db/queries/dashboard";
import { createPrototypeDecision } from "@/lib/decision/prototype-policy";
import { apiError, readJson, unauthorized } from "@/lib/server/http";

const GenerateDecisionSchema = z.object({ localDate: z.iso.date() }).strict();

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const [current, history] = await Promise.all([
      getCurrentDecisionForUser(session.user.id),
      listDecisionsForUser(session.user.id),
    ]);
    return NextResponse.json({ current, history });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const input = GenerateDecisionSchema.parse(await readJson(request));
    const dashboard = await getDashboardForUser(session.user.id, input.localDate);
    const available = dashboard.metrics.filter((metric) => metric.value !== null && !["excluded", "missing", "stale", "insufficient"].includes(metric.state));
    const decision = createPrototypeDecision({
      id: crypto.randomUUID(),
      generatedAt: new Date().toISOString(),
      consentVersion: dashboard.consentVersion,
      inputDataMode: available.some((metric) => metric.provenance.inputDataMode === "live") ? "live" : available.length ? "manual" : "unavailable",
      metrics: dashboard.metrics,
    });
    return NextResponse.json({ decision: await saveDecisionForUser(session.user.id, decision) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
