# Data Persistence, Ingest, and Ownership Audit

**Scope.** `code/brioweb` database schema, query layer, Drizzle migrations, health-sample/workout ingestion, and ownership enforcement. This is a code audit only; no application source was modified. `npm run lint` completed successfully on 2026-09-12. The pre-existing untracked repository items `../../Wireframe.md` and `../../output/` were preserved.

## Conclusion

The application has a clear Postgres/Drizzle persistence model, server-only query layer, session-derived user scoping in all inspected request paths, and idempotent ingest for records that carry a stable `external_id`. The primary data-isolation concern is that both health and workout idempotency keys are **globally unique**, rather than unique per owner. A colliding external ID submitted by another authenticated user can update a row owned by the first user because the conflict-update set does not change `user_id`. There is also no database Row Level Security (RLS) in the inspected schema or migration history, so tenant isolation depends on every application caller correctly applying the `user_id` predicate.

## Persistence inventory and evidence

| Concern | Verified implementation | Evidence |
|---|---|---|
| Identity and ownership root | `user.id` is a text primary key. Health samples, workouts, sessions, accounts, and agent insights use a required `user_id` foreign key with `ON DELETE CASCADE`. | `db/schema.ts:14-31, 33-75, 114-163, 165-213, 215-256`; `drizzle/0002_overrated_madelyne_pryor.sql:17-28, 70-75`; `drizzle/0004_fine_lake.sql:14-38` |
| Health persistence | `health_samples` stores UUID id, owner, optional external ID, free-text sample type, required numeric value and interval, optional source/metadata, and created time. Query index is `(user_id, sample_type, start_date)`. | `db/schema.ts:114-163` |
| Workout persistence | `workouts` stores UUID id, owner, free-text type, required interval/duration, optional metrics, source/external ID/metadata, and created time. Read indexes are `(user_id, start_date)` and `(user_id, workout_type, start_date)`. | `db/schema.ts:165-213` |
| Insight persistence | `agent_insights` retains append-only worker output by user/domain/time. It has no natural-key uniqueness constraint. | `db/schema.ts:215-256`; `db/queries/agent-insights.ts:6-30` |
| Schema history | Clean migration history first created and then removed an earlier UUID `users`/health schema (`0000`, `0001`), then established the Better Auth text-user schema and health table (`0002`), added health external ID (`0003`), and added workouts/insights (`0004`). The journal records this order. | `drizzle/0000_careless_mulholland_black.sql:1-23`; `drizzle/0001_free_killer_shrike.sql:1-2`; `drizzle/0002_overrated_madelyne_pryor.sql:1-76`; `drizzle/0003_violet_shocker.sql:1-2`; `drizzle/0004_fine_lake.sql:1-38`; `drizzle/meta/_journal.json:4-40` |
| Migration operation | Drizzle config targets PostgreSQL, `db/schema.ts`, and the `drizzle/` output directory. The production migrator runs `drizzle-kit migrate` before app/worker services start. | `drizzle.config.ts:1-19`; `Dockerfile:19-26`; `docker-compose.dokploy.yml:2-10, 25-28, 43-46` |

## Ingest behavior and uniqueness semantics

The only inspected production health ingest surface is `POST /api/health-samples`. It requires a valid session, parses a single sample, an array, or `{ samples }`, validates basic types/date parseability, **derives** `userId` from `session.user.id`, and does not accept an owner ID from the request. The equivalent `GET` derives that same user ID and queries only the requested sample type for that user. [1]

`insertHealthSamples` and `insertWorkouts` both call `INSERT ... ON CONFLICT DO UPDATE` with `external_id` as the conflict target and return the affected rows. For a conflict, the mutable measurement fields are refreshed; neither function updates `user_id`, `id`, or `created_at`. [2] [3] PostgreSQL unique indexes permit multiple `NULL` values, so rows with `externalId: null` are deliberately append-only rather than deduplicated. This is used by the local synthetic generators. [2] [3] [4] [5]

| Entity | Unique/index rule | Insert behavior | Consequence |
|---|---|---|---|
| `health_samples.external_id` | Global unique index; nullable | Upserts value, unit, dates, source, metadata | Stable external IDs make overlapping sync idempotent; `NULL` inserts duplicate by design. |
| `workouts.external_id` | Global unique index; nullable | Upserts type, timing, metrics, source, metadata | Same null-safe idempotency behavior; no production workout route was found. |
| `agent_insights` | No uniqueness key | Plain insert | Repeated worker runs preserve history and can create multiple same-user/same-domain/day rows. |

## Server-only layering and ownership enforcement

The database client, Better Auth configuration, auth DAL, and every inspected `db/queries/*` module start with `import "server-only"`. The client fails outside the Next production-build phase without `DATABASE_URL`; it creates a lazy `postgres`/Drizzle client. [6] The query layer consistently takes an explicit `userId` and applies it in all health/workout/insight reads inspected. [2] [3] [7]

Authenticated UI pages obtain `user` with `requireUser()` and pass `user.id` to data queries. The health endpoint and chat endpoint separately obtain a session and derive the owner server-side. Agent tool factories close over that server-supplied owner and intentionally omit `userId` from their model-callable parameter schemas. The autonomous worker intentionally iterates all user IDs and runs tools/persists insights one user at a time. [1] [8] [9] [10] [11]

`proxy.ts` is cookie-only routing assistance, not an authorization boundary. The authoritative user and admin checks occur in `db/auth-dal.ts`. [12] [13] The direct `@/db/auth` import in `app/api/auth/[...all]/route.ts` is needed to bind Better Auth handlers but is a literal exception to the written guidance that says `app/` must import `db/auth` only through `db/auth-dal.ts`; this should remain an explicit documented exception or the guidance should be narrowed. [14] [15]

## Risks and gaps

| Priority | Risk or gap | Evidence and impact |
|---|---|---|
| High | **Cross-tenant external-ID collision.** `external_id` uniqueness is global, while `ON CONFLICT` does not constrain/update the existing row by `user_id`. | A same-ID write from a different authenticated user hits the first owner’s row and refreshes its health/workout payload, instead of creating a second owner-scoped row or failing. The health POST response can return that existing row. See `db/schema.ts:155-162, 204-212`; `db/queries/health-samples.ts:48-64`; `db/queries/workouts.ts:59-81`; `app/api/health-samples/route.ts:90-103`. |
| High | **No database-enforced tenant policy.** | No `ENABLE ROW LEVEL SECURITY`, policy, or equivalent was found in `db/`, `drizzle/`, `app/`, `worker/`, or `scripts/`. A new query missing `eq(table.userId, userId)` or a direct privileged connection can access cross-user rows. |
| Medium | No real workout ingest endpoint was found. | `insertWorkouts` is invoked only by `scripts/generate-fake-workouts.ts`; the inspected API routes are auth, chat, and health samples. See `scripts/generate-fake-workouts.ts:1-71`; route inventory in `app/api/`. |
| Medium | Health input validation is syntactic rather than domain-complete. | It checks types and date parseability but does not enforce `endDate >= startDate`, reasonable numeric bounds, allowed sample types/units, metadata shape/size, or an explicit maximum batch count. See `app/api/health-samples/route.ts:21-100`. |
| Medium | External IDs have no source namespace and the upsert update list does not update `sample_type`/owner for health records. | Stable IDs must be globally collision-free across every user/source under the current index. A duplicate preserves its original owner and health sample type while overwriting values/times/source/metadata. `db/queries/health-samples.ts:53-62`. |
| Medium | Synthetic data is intentionally non-idempotent. | Both generators use `externalId: null`; each execution inserts fresh rows. They are local/manual only and excluded from deployed runner/worker images. `scripts/generate-fake-sleep-and-hr.ts:1-9, 41-74`; `scripts/generate-fake-workouts.ts:1-6, 53-70`; `AGENTS.md:45-47`. |
| Low | Worker insight writes are history-preserving but are not deduplicated/singleton scheduled. | The loop runs immediately at start then interval-based; a restart produces another immediate append. `worker/loop.ts:1-21`; `worker/run-once.ts:22-57`; `db/queries/agent-insights.ts:6-10`. |

## Exact compatibility requirements

1. **Retain HealthKit re-sync idempotency.** `health_samples` writes must remain an upsert for a stable external sample identifier; a bare insert will duplicate overlapping mobile sync windows. `externalId: null` must continue to permit repeated manual/synthetic inserts if that behavior is retained. [2] [15]
2. **Preserve current owner derivation.** HTTP health ingest must continue to set `userId` exclusively from `session.user.id`; never take it from client input. Health reads, dashboard reads, chat/agent queries, and worker writes must remain owner-scoped. [1] [8] [9] [10]
3. **If fixing global-ID isolation, migrate both database and conflict target together.** Change the health/workout unique constraint from `(external_id)` to an owner-scoped key such as `(user_id, external_id)` only via a new Drizzle migration, and change `.onConflictDoUpdate({ target: ... })` to that same composite target. Preserve nullable-key behavior explicitly: PostgreSQL treats normal `NULL` composite-index entries as non-conflicting, which matches current manual/synthetic behavior. Do not rewrite existing migration files.
4. **Do not change query-layer server boundaries.** Keep `import "server-only"` at the top of `db/client.ts`, `db/auth.ts`, `db/auth-dal.ts`, and every query file. Any script/worker importing a query file must execute with `tsx --conditions=react-server`. [6] [15]
5. **Use the prescribed migration path.** Schema evolution must be `npm run db:generate` then SQL review in `drizzle/*.sql`, then `npm run db:migrate`; do not use `drizzle-kit push` or a custom programmatic migration runner. [15]
6. **Keep the schema’s query-supporting indexes or substitute equivalent plans.** Health reads rely on `(user_id, sample_type, start_date)` and workout reads rely on `(user_id, start_date)` plus `(user_id, workout_type, start_date)`. [2] [3]
7. **Keep deployed-service boundaries.** Migrations run in a one-shot migrator; app and worker start only after success. The worker has database/API credentials but no public port. [16]

## Recommended baseline checks

1. Run `npm run lint` before and after data-layer changes; it passed for this audit.
2. Run `npm run db:generate`, inspect generated SQL and Drizzle snapshot/journal changes, then apply only with `npm run db:migrate` against a disposable PostgreSQL database.
3. Add integration coverage for health POST: unauthenticated `401`; client-provided owner is ignored; same owner + stable external ID updates one row; `externalId: null` creates distinct rows; a two-user duplicate external ID is rejected or remains independently owner-scoped after remediation.
4. Add equivalent workout repository tests before exposing a production workout endpoint, including two-user external-ID collision coverage.
5. Assert every user-facing read/write query has a `user_id` predicate or derives owner from an authenticated server context; include chat-agent tool factories and worker paths in the review.
6. Validate domain constraints at the boundary: finite numeric values, interval ordering, accepted metadata shape/size, and a bounded batch size. Decide whether free-text sample/workout type remains the intended forward-compatibility policy.
7. If RLS is adopted, test it with the actual application role and verify migrations/worker operations retain needed access; do not treat RLS as a substitute for application-layer session authorization.

## Environment variable names observed

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `OPENAI_API_KEY`, `OPENAI_AGENTS_MODEL`, and `WORKER_INTERVAL_MINUTES`. Values are intentionally omitted. [6] [16] [17]

## References

[1]: file:///home/ubuntu/work/BRIO/code/brioweb/app/api/health-samples/route.ts "Authenticated health sample read and ingest route"
[2]: file:///home/ubuntu/work/BRIO/code/brioweb/db/queries/health-samples.ts "Health sample query and upsert layer"
[3]: file:///home/ubuntu/work/BRIO/code/brioweb/db/queries/workouts.ts "Workout query and upsert layer"
[4]: file:///home/ubuntu/work/BRIO/code/brioweb/scripts/generate-fake-sleep-and-hr.ts "Manual synthetic health sample generator"
[5]: file:///home/ubuntu/work/BRIO/code/brioweb/scripts/generate-fake-workouts.ts "Manual synthetic workout generator"
[6]: file:///home/ubuntu/work/BRIO/code/brioweb/db/client.ts "Server-only Drizzle database client"
[7]: file:///home/ubuntu/work/BRIO/code/brioweb/db/queries/agent-insights.ts "Agent insight persistence queries"
[8]: file:///home/ubuntu/work/BRIO/code/brioweb/app/%28authenticated%29/dashboard/page.tsx "Authenticated dashboard health query"
[9]: file:///home/ubuntu/work/BRIO/code/brioweb/app/api/chat/route.ts "Session-scoped chat route"
[10]: file:///home/ubuntu/work/BRIO/code/brioweb/agents/tools/health-samples.ts "Server-bound health agent tool factories"
[11]: file:///home/ubuntu/work/BRIO/code/brioweb/worker/run-once.ts "Per-user autonomous insight worker"
[12]: file:///home/ubuntu/work/BRIO/code/brioweb/proxy.ts "Cookie-only route proxy"
[13]: file:///home/ubuntu/work/BRIO/code/brioweb/db/auth-dal.ts "Authoritative user and admin access DAL"
[14]: file:///home/ubuntu/work/BRIO/code/brioweb/app/api/auth/%5B...all%5D/route.ts "Better Auth route binding"
[15]: file:///home/ubuntu/work/BRIO/code/brioweb/AGENTS.md "Project database, migration, ingest, and server-only constraints"
[16]: file:///home/ubuntu/work/BRIO/code/brioweb/docker-compose.dokploy.yml "Production migrator, app, and worker service topology"
[17]: file:///home/ubuntu/work/BRIO/code/brioweb/.env.example "Named environment-variable template"
