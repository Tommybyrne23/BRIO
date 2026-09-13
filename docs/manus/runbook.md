# BRIO release runbook

## Release identity

The application remains the existing **Next.js 16.3.4 + Better Auth + PostgreSQL/Drizzle** repository. `code/brioweb` is the PWA and API. `code/briomobile` remains the Expo 57 iPhone Apple Health helper. The production container retains the existing one-shot migrator, standalone Next runner, and separate worker architecture.

## Required configuration

Create `code/brioweb/.env.local` for local development or configure these values in the deployment platform. Do not commit values.

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | PostgreSQL connection used by migrations, app, and worker. |
| `BETTER_AUTH_SECRET` | Yes | Generate with `npx auth secret`. |
| `BETTER_AUTH_URL` | Yes | **Exact public origin**, including `https://` and no path. A wrong value causes browser `Invalid origin`. Use `http://localhost:3000` only for local browser development. |
| `OPENAI_API_KEY` | Optional for deterministic release | Enables the consent-gated live chat, live decision, and worker paths. The reliable demo does not need it. |
| `OPENAI_AGENTS_MODEL` | Optional | Agents SDK model; defaults to repository configuration. |
| `OPENAI_BASE_URL` | Optional | OpenAI-compatible proxy base. Leave unset for the official OpenAI API; when set, BRIO uses the Agents SDK Chat Completions adapter. |
| `WORKER_INTERVAL_MINUTES` | Optional | Restart-relative worker interval; default 1440. |
| `BRIO_DEMO_MODE` | Optional | Keep `false` unless an isolated backend demo account is intentionally configured. |
| `BRIO_DEMO_ACCOUNT_EMAIL` | Optional | Exact allowed account for guarded backend reset. |

For the iPhone helper, set `EXPO_PUBLIC_API_URL` to the deployed HTTPS web origin. Never place server secrets in Expo variables.

## Local setup

```bash
cd code/brioweb
npm ci
cp .env.example .env.local
# Fill DATABASE_URL, BETTER_AUTH_SECRET, and BETTER_AUTH_URL.
npm run db:migrate
npm run dev
```

If Docker is available, `docker compose up -d db` starts the repository's disposable local database. The sandbox used a local PostgreSQL 16 service because Docker was unavailable.

## Database change policy

For future schema changes:

```bash
# 1. Edit db/schema.ts
npm run db:generate
# 2. Read every generated drizzle/*.sql statement
npm run db:migrate
```

Never replace this sequence with `drizzle-kit push`. Migrations `0005_slippery_black_tom.sql` and `0006_loving_rick_jones.sql` are the reviewed BRIO product/consent migrations included in this release.

## Verification commands

```bash
cd code/brioweb
npm run lint
npx tsc --noEmit
npm run test:contracts
npm run test:demo
npm run build

cd ../briomobile
npm run lint
npx tsc --noEmit
```

With PostgreSQL configured and the web server running:

```bash
cd ../..
./docs/manus/evidence/p03-product-integration.sh
./docs/manus/evidence/release-integration.sh
```

Both scripts create disposable accounts and synthetic test records. They do not use personal health data or call a model.

## Production process smoke test

```bash
cd code/brioweb
npm run build
rm -rf .runtime && mkdir -p .runtime/.next
cp -a .next/standalone/. .runtime/
cp -a .next/static .runtime/.next/static
cp -a public .runtime/public
set -a && source .env.local && set +a
cd .runtime
PORT=3000 HOSTNAME=0.0.0.0 \
  BETTER_AUTH_URL=https://your-exact-host.example node server.js
```

This mirrors the Docker runner filesystem. Do not use `next start` with this repository's `output: "standalone"` build.

Check `/`, `/demo`, `/manifest.webmanifest`, `/offline`, and anonymous `/dashboard` redirection. Then perform a disposable two-field signup and verify that it reaches onboarding. An HTTP 200 alone is not sufficient auth evidence because Better Auth checks browser Origin.

## Dokploy Compose deployment

Deploy `code/brioweb/docker-compose.dokploy.yml` as the existing Compose application. Configure the required variables above in Dokploy. The service order is:

1. `migrate` applies checked-in Drizzle migrations and exits.
2. `app` starts only after migration success.
3. `worker` starts only after migration success and has no public port.

The application service must receive the exact deployed `BETTER_AUTH_URL`. Route the public HTTPS domain to app port 3000. Keep PostgreSQL private to the Dokploy network. The worker requires `OPENAI_API_KEY` only if agent execution is intended; accounts without explicit AI processing consent are skipped.

After deployment, run the production browser smoke path again. This sandbox did not have Docker or Dokploy access, so container execution and publication remain owner verification steps.

## Deterministic demo

Open `/demo`. It uses a fixed 14-day synthetic fixture in browser-local storage and requires no account, database write, or model. The header labels **Synthetic inputs** and **Simulated decision** separately. Use the scenario selector to show normal evidence, specialist disagreement, revoked signal, missing nutrition, stale helper, model timeout, and Escalate. Reset restores the known state.

The backend `/api/demo/reset` remains unavailable unless both `BRIO_DEMO_MODE=true` and the authenticated email equals `BRIO_DEMO_ACCOUNT_EMAIL`.

## Live agent path

The authenticated Today page exposes **Try live agent** separately from **Generate bounded decision**. The live route:

1. requires an authenticated account;
2. checks `server_ai_processing` consent before any call;
3. requires server-side credentials;
4. sends only usable consent-filtered metric summaries;
5. requires strict structured output;
6. revalidates and persists only Progress, Maintain, Repeat, Reduce, or Escalate.

There is no silent deterministic fallback labelled as live execution. A live four-specialist review was executed successfully against the configured compatible API and is recorded in `docs/manus/evidence/ecp-live-agent-smoke-judging.txt`.

## Five-ECP live-agent demo

Configure one disposable demo account only:

```bash
BRIO_DEMO_MODE=true
BRIO_DEMO_ACCOUNT_EMAIL=the-exact-demo-account@example.com
OPENAI_API_KEY=...
OPENAI_AGENTS_MODEL=gpt-5-mini
# Set only for an OpenAI-compatible proxy; omit for the official API.
OPENAI_BASE_URL=...
```

Sign in as that exact account and open `/dashboard/chat`. Select an ECP and press **Load synthetic profile**. This replaces product rows only for that account, enables the account's prepared signal and AI consents, and inserts 14 days of clearly labelled synthetic nutrition, training, sleep, activity, ordinary heart-rate, and check-in history. It does not call a model. The prepared prompt is placed in the chat field; press **Send** to invoke the live orchestrator and its Training, Nutrition, Sleep, and Recovery specialists.

```bash
cd code/brioweb
npm run test:ecp
../../docs/manus/evidence/ecp-live-agents-integration.sh
../../docs/manus/evidence/ecp-live-agent-smoke.sh
```

The integration harness uses a disposable local `.example.test` account. Do not run it against a shared production database.

## iPhone helper

```bash
cd code/briomobile
npm ci
cp .env.example .env
# Set EXPO_PUBLIC_API_URL to the exact deployed HTTPS origin.
npx expo prebuild --clean
npx expo run:ios --device
```

Generated `ios/` files are disposable. On the device, sign into the same Brio account, enable desired health signals in web **Data** controls, then request Apple Health access and sync. The helper checks server consent, scopes anchors by environment/user/type, reconciles deleted UUIDs, and advances anchors only after acknowledgements. Apple does not reveal per-type read denial; an empty result must not be described as a granted permission.

## PWA behavior

The manifest supplies 192px and 512px icons. On iPhone/iPad, use Safari Share → Add to Home Screen. Supported browsers may show the Install button under Data. The service worker caches only the public demo and static brand assets. It deliberately excludes API and authenticated routes, so account data and writes require connectivity.

## Rollback

Application rollback is a normal image/revision rollback. Database migrations in this release are additive except the reviewed owner-scoped index correction; do not delete migrations from a deployed history. If an application rollback predates the new schema, keep the newer database schema and redeploy the prior compatible app image. Export a test account before destructive troubleshooting.

## Operator handoff checks

- Confirm public `BETTER_AUTH_URL` matches the browser Origin exactly.
- Confirm migrations complete before app/worker start.
- Confirm anonymous protected routes redirect or return 401.
- Confirm new consent starts entirely off.
- Confirm deterministic `/demo` works with the model unavailable.
- Confirm AI-off live decision/chat return 403.
- Confirm export excludes credentials.
- Confirm typed account deletion uses a disposable account before production use.
- Complete the physical iPhone test and record actual accepted/skipped/error counts.
