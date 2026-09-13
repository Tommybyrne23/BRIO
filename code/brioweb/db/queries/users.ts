import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { signalConsents, user, userPreferences } from "@/db/schema";

// Used by the autonomous worker to iterate every user.
export async function getAllUserIds() {
  const rows = await db.select({ id: user.id }).from(user);
  return rows.map((row) => row.id);
}

export async function getUserByEmail(email: string) {
  const [row] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  return row ?? null;
}

export async function getAiEligibleUsers() {
  return db.select({ id: user.id, consentVersion: userPreferences.consentVersion })
    .from(user)
    .innerJoin(userPreferences, eq(userPreferences.userId, user.id))
    .innerJoin(signalConsents, and(
      eq(signalConsents.userId, user.id),
      eq(signalConsents.signal, "server_ai_processing"),
      eq(signalConsents.enabled, true),
    ))
    .where(eq(userPreferences.accountStatus, "active"));
}
