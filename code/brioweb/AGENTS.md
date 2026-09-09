<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project-specific rules (brioweb)

## DB access layering

`app/` (pages, layouts, route handlers) must only import from `db/queries/*.ts` — never `db/client.ts` or `db/schema.ts` directly, and never `db/auth.ts` directly outside `db/auth-dal.ts`. `db/client.ts`, `db/auth.ts`, and every file in `db/queries/` start with `import "server-only";` so an accidental client-component import fails the build instead of leaking a DB connection or secret into the browser bundle.

## Migrations: drizzle-kit only, no push, no custom runner scripts

Schema changes always go through `npm run db:generate` (drizzle-kit generate) → review the SQL in `drizzle/*.sql` → `npm run db:migrate`. Never use `drizzle-kit push`, and never hand-write a migration-runner script that calls drizzle-orm's `migrate()` programmatically — the CLI is the only thing that touches migrations, both locally and in the Dokploy `migrate` Compose service.

**If a schema change both adds and removes a table in the same edit** (e.g. renaming/replacing a table), `drizzle-kit generate` will try to prompt interactively ("did you rename X to Y?"), which fails outright in a non-TTY shell. Avoid it by splitting into two generate passes: first edit `db/schema.ts` to only remove the old table(s) and run `db:generate` (pure removal, no prompt), then restore/add the new table(s) and run `db:generate` again (pure addition, no prompt). Two migration files land in `drizzle/`, which is fine — that's the actual DB history.

## Better Auth's own schema: `auth:generate` overwrites, it doesn't merge

`npm run auth:generate` (the `auth` CLI) writes a **fresh** file at its `--output` path — it does not merge into an existing schema.ts. Never point it at the real `db/schema.ts`. Always generate into the scratch `db/auth-schema.generated.ts`, hand-copy the tables you need into `db/schema.ts`, then delete the scratch file. The CLI also can't resolve `import "server-only"` in `db/auth.ts`/`db/client.ts` — remove those two import lines temporarily before running any `auth` CLI command, and restore them immediately after.

The `auth create-admin` CLI command only works against a local checkout with a live `DATABASE_URL` — it is not available in production. The `app` (runner) Docker image never installs the `auth` CLI package (a devDependency); only the `migrate` service's image has full `node_modules`, and that container exits immediately after running `drizzle-kit migrate`. To promote the first production admin, update the `role` column directly via SQL against the production Postgres instance instead.

## `health_samples` ingest: upsert on `external_id`, never a plain insert

`insertHealthSamples` (`db/queries/health-samples.ts`) uses `.onConflictDoUpdate({ target: healthSamples.externalId, ... })`, not a bare `.insert()`. Reason: briomobile's HealthKit sync re-fetches overlapping windows on every anchor reset/reinstall, so re-POSTing a sample already stored needs to update it in place, not duplicate it — `externalId` carries HealthKit's own per-sample UUID for exactly this. Rows with no stable external id (e.g. the manual "fake sample" flow) pass `externalId: null`, which is safe: Postgres unique indexes never treat two `NULL`s as a conflict, so those always insert as new rows. If you add another data source, give it a similarly stable id in `externalId` rather than skipping it — omitting it silently disables dedup for that source.

## `proxy.ts` (formerly middleware): cookie checks only, never a DB call

Next.js's own docs explicitly warn against database-backed checks in `proxy.ts` — it runs on every matched request, including prefetches, and "should not be your only line of defense." `proxy.ts` here only calls `getSessionCookie()` (from `better-auth/cookies`) to optimistically redirect anonymous users away from `/dashboard/**` and `/admin/**`. The real, authoritative check — including the `role === "admin"` check — happens in `db/auth-dal.ts`'s `requireUser()`/`requireAdmin()`, called from layouts/route handlers, which do hit the database. Do not move role checks into `proxy.ts`, and do not import `db/auth.ts` (or anything that transitively imports `db/client.ts`) into `proxy.ts`.
