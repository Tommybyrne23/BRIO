import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username, admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { expo } from "@better-auth/expo";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      console.log(`[auth] password reset for ${user.email}: ${url}`);
    },
  },
  // "briomobile://" lets the Expo client (see briomobile/src/lib/auth-client.ts) pass its
  // origin-check header for the app's custom scheme instead of a browser Origin.
  trustedOrigins: ["briomobile://*"],
  plugins: [
    username(),
    admin({ defaultRole: "user", adminRoles: "admin" }),
    expo(),
    nextCookies(), // must be last — needs to see the final response state from earlier plugins
  ],
});
