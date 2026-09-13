# Deployment, Container, and Configuration Audit

**Scope.** This audit covers `code/brioweb` Dockerfiles, Compose files, README, environment template, Next/Drizzle configuration, scripts, worker packaging, and deployment assumptions. No application source was modified. The pre-existing untracked repository items `Wireframe.md`, `output/`, and pre-existing `docs/` contents were preserved. Secret checks report only paths, categories, and variable names; they do **not** reproduce values. No personal health data is included.

## Conclusion

The implemented production route is a **Dokploy Docker Compose application**, using `code/brioweb/docker-compose.dokploy.yml`, not a plain-Dockerfile deployment. It builds three targets from one Dockerfile: a one-shot Drizzle migrator, the standalone Next.js app, and a separately packaged self-scheduling worker. App and worker startup are gated on successful migration completion. The build context is the `code/brioweb` directory (`context: .` relative to the Dokploy Compose file).

The configuration is generally coherent: Next emits standalone output, runtime secrets are injected through Compose rather than copied into the image, and `.env*` is excluded from both Git (except the template) and Docker context. The main deployment risks are an unvalidated worker interval (an invalid non-empty setting can reduce the timer to Node's minimum), a committed literal password in the **local-development-only** PostgreSQL Compose file, no checked-in CI/deploy automation, and a documentation/source mismatch for the default OpenAI model.

## Deploy route, service topology, and build context

| Area | Verified implementation | Evidence |
|---|---|---|
| Production route | README explicitly identifies Dokploy Compose deployment and names the Compose file. No CI workflow or alternate production manifest was found under `code/brioweb`. | [README.md:115-123](file:///home/ubuntu/work/BRIO/code/brioweb/README.md); deployment-reference search found only README, Dokploy Compose, environment template, AGENTS, and worker loop; `.github/` file count: 0. |
| Build context and targets | All three Dokploy services set `build.context: .`; targets are `migrator`, `runner`, and `worker`. Thus the context is `/home/ubuntu/work/BRIO/code/brioweb` when the named Compose file is selected. | [docker-compose.dokploy.yml:2-5, 12-15, 33-36](file:///home/ubuntu/work/BRIO/code/brioweb/docker-compose.dokploy.yml) |
| Image build | `deps` runs deterministic `npm ci` from `package.json`/`package-lock.json`; `builder` copies the context and executes `npm run build`. The lockfile is present (lockfile version 3). | [Dockerfile:3-17](file:///home/ubuntu/work/BRIO/code/brioweb/Dockerfile); [package.json:5-16](file:///home/ubuntu/work/BRIO/code/brioweb/package.json) |
| Next production image | `next.config.ts` selects `output: "standalone"`. The runner copies only `public`, `.next/standalone`, and `.next/static`, runs as non-root `nextjs`, exposes 3000, and binds the Next standalone server to all interfaces. | [next.config.ts:1-7](file:///home/ubuntu/work/BRIO/code/brioweb/next.config.ts); [Dockerfile:38-60](file:///home/ubuntu/work/BRIO/code/brioweb/Dockerfile) |
| Network/public surface | `app` exposes (not host-publishes) port 3000 on the external `dokploy-network`; `worker` has no port. Dokploy is therefore assumed to provide routing/proxy attachment and the pre-existing external network. | [docker-compose.dokploy.yml:12-24, 30-50](file:///home/ubuntu/work/BRIO/code/brioweb/docker-compose.dokploy.yml) |
| Local-only database | The root local Compose file supplies a PostgreSQL 17 container with a host port and named volume; README says it is unrelated to Dokploy’s database. | [docker-compose.yml:1-20](file:///home/ubuntu/work/BRIO/code/brioweb/docker-compose.yml); [README.md:12-20, 127](file:///home/ubuntu/work/BRIO/code/brioweb/README.md) |

## Database migration flow

The prescribed schema path is `npm run db:generate` → review generated SQL under `drizzle/` → `npm run db:migrate`; project guidance expressly prohibits `drizzle-kit push` and custom programmatic migration runners. [AGENTS.md:17-21](file:///home/ubuntu/work/BRIO/code/brioweb/AGENTS.md); [README.md:31-33, 96-101](file:///home/ubuntu/work/BRIO/code/brioweb/README.md)

At deployment time, the `migrate` Compose service builds the Dockerfile's `migrator` stage, which copies the Drizzle config, database schema, migrations, and full dependency tree, then runs `npx drizzle-kit migrate`. Both `app` and `worker` declare `depends_on.migrate.condition: service_completed_successfully`; migration failure should prevent their startup **provided Dokploy honors this Compose condition**. [Dockerfile:19-26](file:///home/ubuntu/work/BRIO/code/brioweb/Dockerfile); [docker-compose.dokploy.yml:2-10, 25-28, 43-46](file:///home/ubuntu/work/BRIO/code/brioweb/docker-compose.dokploy.yml)

`drizzle.config.ts` loads the project environment and throws when `DATABASE_URL` is absent, uses PostgreSQL, reads `db/schema.ts`, and writes/uses the `drizzle/` migration directory. Five SQL migration files and a Drizzle journal are present. [drizzle.config.ts:1-19](file:///home/ubuntu/work/BRIO/code/brioweb/drizzle.config.ts)

## Worker packaging and scheduling

The worker is an independent Docker target and Compose service, not a process in the Next server. Its image copies `node_modules`, `package.json`, `tsconfig.json`, `db/`, `agents/`, and `worker/`, then starts `tsx --conditions=react-server worker/loop.ts`. This preserves the project-required `server-only` resolution mode for direct query-layer imports. It intentionally does **not** copy `scripts/`; synthetic generators are unavailable in deployed app and worker containers. [Dockerfile:28-36](file:///home/ubuntu/work/BRIO/code/brioweb/Dockerfile); [AGENTS.md:37-47](file:///home/ubuntu/work/BRIO/code/brioweb/AGENTS.md); [README.md:125](file:///home/ubuntu/work/BRIO/code/brioweb/README.md)

On startup, `loop.ts` runs one pass immediately and then schedules `runOnce()` every `WORKER_INTERVAL_MINUTES`, falling back only when the variable is empty/missing. Each pass iterates every user and invokes sleep, training, and recovery agents sequentially, persisting insights to the database; per-user/domain failures are caught and logged. The resulting cadence is restart-relative rather than wall-clock and has no catch-up behavior. [worker/loop.ts:1-21](file:///home/ubuntu/work/BRIO/code/brioweb/worker/loop.ts); [worker/run-once.ts:1-67](file:///home/ubuntu/work/BRIO/code/brioweb/worker/run-once.ts); [README.md:83-94](file:///home/ubuntu/work/BRIO/code/brioweb/README.md)

## Environment variables and configuration handling

| Variable | Deployment role | Evidence |
|---|---|---|
| `DATABASE_URL` | Required by migrator, app, and worker; database client also fails at runtime if absent (except during the Next production-build phase). | [docker-compose.dokploy.yml:6-8, 16-20, 37-40](file:///home/ubuntu/work/BRIO/code/brioweb/docker-compose.dokploy.yml); [db/client.ts:6-14](file:///home/ubuntu/work/BRIO/code/brioweb/db/client.ts); [drizzle.config.ts:4-16](file:///home/ubuntu/work/BRIO/code/brioweb/drizzle.config.ts) |
| `BETTER_AUTH_SECRET` | Required deployment input for the app's Better Auth runtime. | [docker-compose.dokploy.yml:16-20](file:///home/ubuntu/work/BRIO/code/brioweb/docker-compose.dokploy.yml); [README.md:115-123](file:///home/ubuntu/work/BRIO/code/brioweb/README.md) |
| `BETTER_AUTH_URL` | Required app public URL/auth-origin deployment input. | [docker-compose.dokploy.yml:16-20](file:///home/ubuntu/work/BRIO/code/brioweb/docker-compose.dokploy.yml); [README.md:115-123](file:///home/ubuntu/work/BRIO/code/brioweb/README.md) |
| `OPENAI_API_KEY` | Required by app chat and worker agent work; injected into both services, not migrator. | [docker-compose.dokploy.yml:16-20, 37-40](file:///home/ubuntu/work/BRIO/code/brioweb/docker-compose.dokploy.yml); [README.md:83-90, 115-123](file:///home/ubuntu/work/BRIO/code/brioweb/README.md) |
| `OPENAI_AGENTS_MODEL` | Optional model override read by agent code; README documents an optional override. | [agents/model.ts:1-4](file:///home/ubuntu/work/BRIO/code/brioweb/agents/model.ts); [README.md:123](file:///home/ubuntu/work/BRIO/code/brioweb/README.md) |
| `WORKER_INTERVAL_MINUTES` | Optional worker-only self-scheduling interval. | [docker-compose.dokploy.yml:37-40](file:///home/ubuntu/work/BRIO/code/brioweb/docker-compose.dokploy.yml); [worker/loop.ts:8-21](file:///home/ubuntu/work/BRIO/code/brioweb/worker/loop.ts) |

The tracked environment template declares the same six operator-facing names. `.gitignore` excludes `.env*` while retaining `.env.example`, and `.dockerignore` excludes `.env*` from the build context. [`.env.example:2-13`](file:///home/ubuntu/work/BRIO/code/brioweb/.env.example); [.gitignore:33-35](file:///home/ubuntu/work/BRIO/code/brioweb/.gitignore); [.dockerignore:1-9](file:///home/ubuntu/work/BRIO/code/brioweb/.dockerignore)

## Secret exposure review

A non-disclosing scan covered current tracked files and 32 reachable Git commits (133 unique `code/brioweb` blobs), using secret-like names plus private-key, GitHub-token, OpenAI-token, Slack-token, AWS-access-key, and JWT patterns. **No token/key-format match was found**, and no secret-like environment/key/certificate path was found in reachable history. `.env.example` is the only tracked brioweb environment file.

One committed **literal password configuration** exists in the local-development PostgreSQL Compose file. It is a known local default, not evidence of a production credential, but it should not be reused beyond disposable development and should be considered a low-severity secret-hygiene risk. [docker-compose.yml:2-17](file:///home/ubuntu/work/BRIO/code/brioweb/docker-compose.yml) Other name-based scan hits were schema/auth field names rather than credential material and were not treated as secrets.

## Risks, gaps, and deploy assumptions

| Priority | Risk, gap, or assumption | Evidence and impact |
|---|---|---|
| Medium | **Worker interval is not validated.** | A non-empty non-numeric or non-positive `WORKER_INTERVAL_MINUTES` passes `Number()` without a fallback. Node timers can coerce invalid/very small delays to a minimum, causing unexpectedly frequent executions/API usage. Validate a finite positive interval before calling `setInterval`. [worker/loop.ts:8-21](file:///home/ubuntu/work/BRIO/code/brioweb/worker/loop.ts) |
| Medium | **Documentation/source default-model mismatch.** | README states one default model, while executable code selects a different default. Operational cost/capability expectations can drift. Treat `agents/model.ts` as runtime truth and align the documentation/template. [README.md:123](file:///home/ubuntu/work/BRIO/code/brioweb/README.md); [agents/model.ts:1-4](file:///home/ubuntu/work/BRIO/code/brioweb/agents/model.ts) |
| Medium | **Migration gate relies on Dokploy Compose support.** | The topology depends on `service_completed_successfully`; verify the selected Dokploy Compose deployment mode preserves this semantic and reports a failed one-shot migration rather than starting downstream services. [docker-compose.dokploy.yml:25-28, 43-46](file:///home/ubuntu/work/BRIO/code/brioweb/docker-compose.dokploy.yml) |
| Medium | **No repository CI/deploy workflow.** | No checked-in `.github/` workflow/deployment files were found. Build, migration, Compose selection, public routing, and rollback are Dokploy-console/operator responsibilities rather than auditable repo automation. |
| Low | **Local Compose embeds a password.** | It is in the dev-only PostgreSQL service, not passed to Dokploy, but is committed and has a published default. Use only for local disposable data; consider runtime substitution for shared/dev environments. [docker-compose.yml:2-17](file:///home/ubuntu/work/BRIO/code/brioweb/docker-compose.yml) |
| Low | **Worker cadence is restart-relative and non-durable.** | Each redeploy/restart triggers an immediate run; downtime has no backfill. This is documented, but operators should decide whether a native scheduled one-shot job is required. [AGENTS.md:41-43](file:///home/ubuntu/work/BRIO/code/brioweb/AGENTS.md); [README.md:88-90](file:///home/ubuntu/work/BRIO/code/brioweb/README.md) |
| Verification limit | Docker and Docker Compose CLIs are unavailable in this audit sandbox. | The Compose file was inspected as text, but `docker compose config` and an image build/start test could not be executed here. No deployment was attempted. |

## Compatibility requirements

1. Retain the **Docker Compose/Dokploy** route and select `docker-compose.dokploy.yml`; build from `code/brioweb` so all `context: .` paths resolve correctly.
2. Retain the one-shot `migrator` before `app` and `worker`; migrations must continue through `drizzle-kit migrate`, never `push` or a custom runner.
3. Provide a reachable PostgreSQL instance on `dokploy-network` and set `DATABASE_URL` in all three applicable services before deployment.
4. Set `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` to the actual public application URL, and `OPENAI_API_KEY` in Dokploy; set a valid positive `WORKER_INTERVAL_MINUTES` if overriding its documented default.
5. Use a Node 24-compatible build environment/image (the Dockerfile pins `node:24-alpine`), with the committed npm lockfile and `npm ci`; do not rely on the sandbox's Node version for parity.
6. Preserve `output: "standalone"`, the runner’s port 3000/all-interface bind, and Dokploy proxy/routing attachment; do not expose the worker.
7. Preserve `tsx --conditions=react-server` for worker and any script that imports `db/queries/*`; it is necessary for the project’s `server-only` import behavior. [AGENTS.md:37-39](file:///home/ubuntu/work/BRIO/code/brioweb/AGENTS.md)

## Recommended baseline checks

1. In a staging Dokploy project, run a fresh Compose deployment and confirm the migrator exits successfully before app/worker start; deliberately test a failed migration to verify the gate.
2. Run `docker compose -f docker-compose.dokploy.yml config` in the deployment-capable environment with only variable **names/status** inspected, then build each target from the exact brioweb context.
3. Smoke-test public proxy routing to the app on port 3000, database connectivity, Better Auth sign-in, a chat request, and a worker pass; confirm worker remains unreachable from outside the Docker network.
4. Add startup validation for a finite positive worker interval and test missing, blank, non-numeric, zero, and negative inputs.
5. Align README and `.env.example` commentary with `agents/model.ts` and document a concrete rollback/backup procedure for failed migrations.
6. Run a maintained secret scanner in CI across the full Git history and current tree. Keep `.env*`, private keys, and production Compose overrides out of Git/Docker context; rotate any production credential if an external scan ever identifies material rather than a name-only match.
7. Do not use the committed local PostgreSQL password outside disposable local development; set an environment-provided non-default value for shared environments.

## Environment variable names observed

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `OPENAI_API_KEY`, `OPENAI_AGENTS_MODEL`, `WORKER_INTERVAL_MINUTES`.

Framework/runtime names also observed in code are `NODE_ENV` and `NEXT_PHASE`; they are not documented as Dokploy operator inputs. No values are included in this report.
