import { getSession } from "@/db/auth-dal";
import { exportUserData } from "@/db/queries/governance";
import { apiError, unauthorized } from "@/lib/server/http";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const body = JSON.stringify(await exportUserData(session.user.id), null, 2);
    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="brio-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
