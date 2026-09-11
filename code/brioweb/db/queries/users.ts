import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { user } from "@/db/schema";

// Used by the autonomous worker to iterate every user.
export async function getAllUserIds() {
  const rows = await db.select({ id: user.id }).from(user);
  return rows.map((row) => row.id);
}

export async function getUserByEmail(email: string) {
  const [row] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  return row ?? null;
}
