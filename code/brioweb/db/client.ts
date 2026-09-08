import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

// `next build` imports route modules to collect page data, which would
// otherwise crash here since DATABASE_URL isn't available in the build
// environment (only injected at container runtime). Skip the check during
// that phase; the postgres client itself connects lazily on first query.
if (!process.env.DATABASE_URL && process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
  throw new Error("DATABASE_URL is not set");
}

export const db = drizzle(postgres(process.env.DATABASE_URL ?? ""));
