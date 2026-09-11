# brioweb

Next.js 16 (App Router) app for BRIO, with PostgreSQL via Drizzle ORM and authentication via Better Auth (username/password, admin/user roles). Deployed to Dokploy.

Companion app: **briomobile** (Expo/React Native, sibling directory) signs in against this app's Better Auth instance and pushes health data (Apple HealthKit, or manual fake samples) into `health_samples` via the API below.

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

| Script                                                                | What it does                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                                         | Next.js dev server                                                                                                                                                                                                                                                |
| `npm run build` / `npm run start`                                     | Production build / server                                                                                                                                                                                                                                         |
| `npm run lint`                                                        | ESLint                                                                                                                                                                                                                                                            |
| `npm run db:generate`                                                 | `drizzle-kit generate` — turns `db/schema.ts` into a new SQL migration under `drizzle/`                                                                                                                                                                           |
| `npm run db:migrate`                                                  | `drizzle-kit migrate` — applies pending migrations. We never use `drizzle-kit push` or a hand-written migration runner — migrations are always generated files, reviewed before applying.                                                                         |
| `npm run auth:generate`                                               | Regenerates Better Auth's own tables into a **scratch** file (`db/auth-schema.generated.ts`) when you change plugins/config in `db/auth.ts`. It does not merge into `db/schema.ts` — see [Changing the schema](#changing-the-schema-including-auth-tables) below. |
| `npm run generate:fake-workouts -- --email you@example.com --days 90` | Fabricates synthetic workout history into `workouts` for one user. Dev-only — never wired into briomobile or run in production.                                                                                                                                   |
| `npm run generate:fake-sleep -- --email you@example.com --days 90`    | Fabricates synthetic sleep + heart rate samples into `health_samples` (same `sampleType`s briomobile's HealthKit sync uses), for one user. Real synced data lands alongside these with no conflict.                                                               |
| `npm run worker:run`                                                  | Runs the autonomous insight worker once (sleep/training/recovery insights for every user, written to `agent_insights`). Requires `OPENAI_API_KEY`.                                                                                                                |
| `npm run worker:loop`                                                 | Same, on a loop — `WORKER_INTERVAL_MINUTES` apart (default 1440/daily). What the `worker` Compose service runs in production.                                                                                                                                     |

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
  api/health-samples/     # GET (by sampleType) + POST (bulk ingest, upserts on externalId) — session-scoped
  api/chat/                # POST — session-scoped, streams the orchestrator agent's reply
  sign-in/, sign-up/, forgot-password/, reset-password/
  dashboard/**             # any logged-in user (enforced by dashboard/layout.tsx's requireUser())
  dashboard/chat/**          # chat UI backed by api/chat
  admin/**                  # role === "admin" only (enforced by admin/layout.tsx's requireAdmin())
agents/
  tools/*.ts             # per-user tool factories (buildXTools(userId)) wrapping db/queries/*
  sleep-agent.ts, training-agent.ts, recovery-agent.ts  # domain agents, free-text output
  orchestrator.ts          # the agent app/api/chat/route.ts talks to — domain agents as tools, not handoffs
  insight-agent.ts          # worker-only: same domain agents, fixed Zod outputType instead of free text
  types.ts, model.ts
worker/
  run-once.ts             # iterate every user, run sleep/training/recovery insight agents, write agent_insights
  loop.ts                   # thin interval wrapper — what the `worker` Compose service runs
scripts/
  generate-fake-workouts.ts, generate-fake-sleep-and-hr.ts  # synthetic data generators, dev-only
proxy.ts               # cookie-presence check only, for /dashboard/** and /admin/** — see AGENTS.md
```

## Mobile client (briomobile)

`db/auth.ts` includes the `expo()` plugin (from `@better-auth/expo`) and `trustedOrigins: ["briomobile://*"]` so briomobile's Expo-based auth client can sign in/out and maintain a session against this same Better Auth instance — cross-origin, no cookies-in-a-browser involved (the Expo client persists the session token in SecureStore and replays it as a `Cookie` header on each request). No CORS setup was needed for `/api/health-samples` itself since React Native's `fetch` doesn't enforce browser CORS.

`POST /api/health-samples` accepts `{ samples: [...] }` (or a bare array/single object), each row requiring `sampleType`, `value`, `startDate`, `endDate`, with optional `unit`, `sourceName`, `metadata`, and `externalId`. `externalId` (e.g. HealthKit's per-sample UUID) is what makes repeated/overlapping syncs idempotent — see `db/queries/health-samples.ts` and `AGENTS.md`.

## Agents

Uses the OpenAI Agents SDK for TypeScript (`@openai/agents`). Two entry points share the same `agents/` code, never duplicated:

- **Chat** (`app/dashboard/chat`, backed by `app/api/chat/route.ts`) — on-demand, inside brioweb. The user talks to a single **Health Orchestrator** agent, which holds no data tools directly and instead calls three domain agents (Sleep, Training, Recovery) as tools (`.asTool()`, not handoffs — a question can span domains, e.g. "did my bad sleep affect yesterday's run?", so the orchestrator synthesizes one answer rather than transferring the whole conversation to a sub-agent). Requires `OPENAI_API_KEY`; chat history is held client-side only (v1 — no server-side persistence yet).
- **Autonomous worker** (`worker/`) — a **standalone container** (the `worker` Compose service, built from the `worker` Dockerfile target — a separate process/image from `app`, not something running inside the Next.js server). No HTTP API, no exposed port, no public surface at all; the only thing it shares with `app` is the database. It iterates every user and runs a sleep/training/recovery **insight agent** per user (same instructions/tools as the chat agents, but with a fixed Zod `outputType` for structured output), writing one row per (user, domain) into `agent_insights`. `app/` reads that table like any other — no API call between the two containers.

  It does **not need to be invoked** — `worker/loop.ts` (the container's `CMD`) runs one full pass immediately on process start, then repeats every `WORKER_INTERVAL_MINUTES` (default 1440/daily) via an in-process `setInterval`, for as long as the container stays up (`restart: unless-stopped` keeps it running). Two consequences of that self-scheduling model worth knowing: it's "every ~24h since the container last started," **not** a fixed wall-clock time — a redeploy/restart resets the timer and triggers an extra immediate run; and there's **no catch-up** — if the container is down for a stretch, no insights are generated for that gap, it just resumes ticking once it's back up. This was chosen because there's no confirmed native Dokploy scheduled-job feature for Compose apps as of writing — if one exists, invoking `worker/run-once.ts` directly on that schedule (dropping `loop.ts`) would give a real fixed schedule instead.

Every tool is built by a factory `buildXTools(userId)` whose `execute` closures capture `userId` from the server (session for chat, user-table iteration for the worker) — `userId` is never a model-supplied tool parameter, so the model can't override whose data it queries.

Real data today: steps, active energy, and heart rate/sleep once briomobile's HealthKit sync produces them (see `generate:fake-sleep` above if it hasn't yet) — plus workouts via `generate:fake-workouts` until a real source exists. The Recovery agent's instructions explicitly say no HRV data is available; it reasons from heart-rate trend + sleep + training load only.

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

This app deploys as a **Docker Compose** app in Dokploy (not a plain Dockerfile app), using `docker-compose.dokploy.yml`, which builds three services from the same `Dockerfile`:

- `migrate` — runs `drizzle-kit migrate` once and exits (`depends_on: condition: service_completed_successfully` gates `app` and `worker` on it).
- `app` — the actual Next.js server.
- `worker` — the autonomous insight worker (`worker/loop.ts`), no exposed port, no public surface.

Required env vars on the Dokploy app: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the app's public URL), `OPENAI_API_KEY`. Optional: `OPENAI_AGENTS_MODEL` (defaults to `gpt-5-mini`), `WORKER_INTERVAL_MINUTES` (defaults to `1440`, i.e. daily — the `worker` service only). There's no confirmed evidence of a native Dokploy scheduled-job feature for Compose apps as of writing; `worker`'s own interval loop is the default scheduling strategy — check current Dokploy docs if you'd rather use a native scheduler instead.

The synthetic data generators (`generate:fake-workouts`, `generate:fake-sleep`) are **not available in any deployed container** — the `app` image is a pruned `.next/standalone` build with no `scripts/`/dev deps, and the `worker` image's Dockerfile stage doesn't copy `scripts/` either. To seed fake data into the actual Dokploy deployment (rather than local dev), either point `DATABASE_URL` at Dokploy's Postgres and run the generator from your own machine (needs that Postgres to be network-reachable — by default it's only reachable inside Dokploy's own Docker network, so this likely needs a tunnel or an exposed port), or add `scripts/` to the `worker` Dockerfile stage and trigger it as a one-off command against a running container.

`docker-compose.yml` (repo root) is **local-dev only** — a throwaway Postgres container, unrelated to Dokploy's own Postgres instance.

No mobile-specific deploy step is needed on this side — `db/auth.ts`'s `trustedOrigins: ["briomobile://*"]` is static, not environment-driven, so it's already in effect on every deployment. To point **briomobile** at a Dokploy deployment instead of local, see briomobile's README ("Pointing at a deployed backend").
