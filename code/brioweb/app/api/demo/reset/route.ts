import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/db/auth-dal";
import { resetSyntheticDemoForUser } from "@/db/queries/demo";
import { resetEcpDemoForUser } from "@/db/queries/ecp-demo";
import { DemoScenarioSchema } from "@/lib/contracts";
import { EcpIdSchema } from "@/lib/demo/ecp-fixtures";
import { apiError, readJson, unauthorized } from "@/lib/server/http";

const ResetDemoSchema = z.union([
  z.object({ anchorDate: z.iso.date(), ecpId: EcpIdSchema }).strict(),
  z.object({ anchorDate: z.iso.date(), scenario: DemoScenarioSchema }).strict(),
]);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (process.env.BRIO_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo reset is disabled" }, { status: 404 });
  }
  const allowedEmail = process.env.BRIO_DEMO_ACCOUNT_EMAIL?.trim().toLowerCase();
  if (!allowedEmail || session.user.email?.toLowerCase() !== allowedEmail) {
    return NextResponse.json({ error: "This account is not the configured demo account" }, { status: 403 });
  }

  try {
    const input = ResetDemoSchema.parse(await readJson(request));
    if ("ecpId" in input) {
      const fixture = await resetEcpDemoForUser(session.user.id, input.ecpId, input.anchorDate);
      return NextResponse.json({ fixture }, { headers: { "cache-control": "no-store" } });
    }
    const fixture = await resetSyntheticDemoForUser(session.user.id, input.anchorDate, input.scenario);
    return NextResponse.json({ fixture }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
