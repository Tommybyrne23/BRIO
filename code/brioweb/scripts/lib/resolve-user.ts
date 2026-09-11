import { parseArgs } from "node:util";
import { getUserByEmail } from "@/db/queries/users";

export async function resolveUserIdFromArgs() {
  const { values } = parseArgs({
    options: {
      userId: { type: "string" },
      email: { type: "string" },
      days: { type: "string", default: "90" },
    },
  });

  if (values.userId) return { userId: values.userId, days: Number(values.days) };

  if (values.email) {
    const user = await getUserByEmail(values.email);
    if (!user) throw new Error(`No user found with email ${values.email}`);
    return { userId: user.id, days: Number(values.days) };
  }

  throw new Error("Pass --userId <id> or --email <email>");
}
