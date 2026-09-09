# brioweb

Next.js 16 (App Router) app for BRIO, with PostgreSQL via Drizzle ORM and authentication via Better Auth (username/password, admin/user roles). Deployed to Dokploy.

## Prerequisites

- Node 24 (matches the `node:24-alpine` base image used in `Dockerfile`)
- Docker, for the local Postgres instance

## Local setup

```bash
docker compose up -d db          # local Postgres (docker-compose.yml — dev only, unrelated to Dokploy's DB)
cp .env.example .env.local        # then fill in BETTER_AUTH_SECRET (npx auth secret)
npm install
npm run db:migrate                # apply existing migrations
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up at `/sign-up`, then see [Bootstrapping the first admin](#bootstrapping-the-first-admin) below.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm run start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run db:generate` | `drizzle-kit generate` — turns `db/schema.ts` into a new SQL migration under `drizzle/` |
| `npm run db:migrate` | `drizzle-kit migrate` — applies pending migrations. We never use `drizzle-kit push` or a hand-written migration runner — migrations are always generated files, reviewed before applying. |
| `npm run auth:generate` | Regenerates Better Auth's own tables into a **scratch** file (`db/auth-schema.generated.ts`) when you change plugins/config in `db/auth.ts`. It does not merge into `db/schema.ts` — see [Changing the schema](#changing-the-schema-including-auth-tables) below. |

## Project layout

```
db/
  schema.ts        # drizzle-orm table definitions — source of truth for db:generate
  client.ts          # drizzle client singleton ("server-only")
  auth.ts             # betterAuth() server config ("server-only")
  auth-dal.ts          # getSession()/requireUser()/requireAdmin() — the real authorization boundary
  queries/*.ts          # all DB access lives here; app/ never imports client.ts or schema.ts directly
lib/
  auth-client.ts       # createAuthClient(), for Client Components
app/
  api/auth/[...all]/     # Better Auth's own route handler
  api/health-samples/     # example: session-scoped API route
  sign-in/, sign-up/, forgot-password/, reset-password/
  dashboard/**             # any logged-in user (enforced by dashboard/layout.tsx's requireUser())
  admin/**                  # role === "admin" only (enforced by admin/layout.tsx's requireAdmin())
proxy.ts               # cookie-presence check only, for /dashboard/** and /admin/** — see AGENTS.md
```

## Changing the schema (including auth tables)

1. Edit `db/schema.ts` directly for app tables (e.g. `health_samples`).
2. For Better Auth's own tables (adding/removing a plugin in `db/auth.ts`): temporarily remove the two `import "server-only";` lines from `db/auth.ts` and `db/client.ts` (the CLI can't resolve them), run `npm run auth:generate`, inspect `db/auth-schema.generated.ts`, hand-copy the relevant tables into `db/schema.ts`, delete the scratch file, then restore both `server-only` imports.
3. Run `npm run db:generate`, **read the generated SQL in `drizzle/*.sql`** before applying — if a table is both added and removed in the same change, drizzle-kit may ask an interactive rename question that doesn't work in a non-TTY shell; see AGENTS.md for how to avoid it.
4. Run `npm run db:migrate`.

## Bootstrapping the first admin

There's no admin yet on a fresh database, so the very first promotion has to happen outside the `/admin` UI:

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'you@example.com';
```

Run this via `psql` against whichever Postgres you're targeting (local: `docker exec -it <db container> psql -U brioweb -d brioweb`; Dokploy: from inside the Postgres container's own shell). After that, promote/demote everyone else from `/admin`.

The Better Auth CLI also has an `auth create-admin` command, but it only works locally (see AGENTS.md — the production `app` image doesn't ship the CLI, and `db/auth.ts`'s `server-only` import needs temporarily removing to run any `auth` CLI command at all).

## Deployment (Dokploy)

This app deploys as a **Docker Compose** app in Dokploy (not a plain Dockerfile app), using `docker-compose.dokploy.yml`, which builds two services from the same `Dockerfile`:
- `migrate` — runs `drizzle-kit migrate` once and exits (`depends_on: condition: service_completed_successfully` gates `app` on it).
- `app` — the actual Next.js server.

Required env vars on the Dokploy app: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the app's public URL).

`docker-compose.yml` (repo root) is **local-dev only** — a throwaway Postgres container, unrelated to Dokploy's own Postgres instance.
