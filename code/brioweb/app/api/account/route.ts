import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/db/auth-dal";
import { deleteUserAccount } from "@/db/queries/governance";
import { apiError, readJson, unauthorized } from "@/lib/server/http";

const DeleteAccountSchema = z.object({ confirmation: z.literal("DELETE") }).strict();

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    DeleteAccountSchema.parse(await readJson(request));
    await deleteUserAccount(session.user.id);
    return NextResponse.json({ deleted: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
