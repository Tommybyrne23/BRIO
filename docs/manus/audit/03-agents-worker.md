# Audit 03 — Agents, Chat Transport, and Autonomous Worker

**Scope.** Static source/configuration audit of `code/brioweb` at Git revision `4ada3b3`. I read `code/brioweb/AGENTS.md` before inspection, made **no model calls**, and did not modify application code. `npx tsc --noEmit` and `npm run lint` both passed. This establishes source/build wiring only; no deployment logs, database state, or live provider availability were inspected.

## Decision-ready conclusion

The repository contains a **real, wired implementation** of authenticated on-demand chat and a separately deployable autonomous worker. Chat uses an OpenAI Agents SDK orchestrator that delegates to three per-user domain agents; the worker iterates users, produces Zod-shaped insight output, and appends it to PostgreSQL. The worker is built and started by the Dokploy Compose configuration.

It is **not yet a bounded-decision system**. It has only broad instruction-level guardrails and an enum severity label. There are no coded thresholds, eligibility/data-freshness gates, escalation or human-review workflow, idempotency/run ledger, bounded request/runtime controls, or UI/API consumer for persisted insights. In source, persisted insights are therefore a generated history rather than a visible or action-driving product capability.

## What is live in source/configuration

| Area | Evidence | Verified behavior |
|---|---|---|
| Authenticated chat entry point | `app/api/chat/route.ts:40-59`; `app/(authenticated)/layout.tsx:1-10` | `POST /api/chat` requires a session and rejects malformed/empty conversations. The authenticated route group calls `requireUser()`; the route independently obtains a session. |
| Per-user data scoping | `agents/orchestrator.ts:30-36`; `agents/tools/index.ts:11-38`; `agents/tools/health-samples.ts:14-17` | Tool factories close over the server-derived user ID (session for chat, user-table iteration for worker); no tool schema accepts a model-supplied user ID. |
| Multi-agent chat composition | `agents/orchestrator.ts:19-24,38-74` | A Health Orchestrator uses Sleep, Training, and Recovery agents as tools rather than handoffs, permitting cross-domain synthesis. It holds no direct data tools. |
| Chat streaming transport | `app/api/chat/route.ts:61-114`; `agents/chat-events.ts:5-11`; `app/(authenticated)/dashboard/chat/chat-panel.tsx:83-134` | Server emits newline-delimited JSON (`application/x-ndjson`) for output deltas, domain-agent start/done, and labeled underlying-tool activity. The client incrementally reads and displays it. The UI’s “agent thinking” trail is tool telemetry/labels, not model chain-of-thought (`agents/tool-labels.ts:1-17`). |
| Agent data access bounds | `agents/tools/health-samples.ts:19-137`; `agents/tools/workouts.ts:7-51` | Zod tool parameters constrain health lookbacks to 1–90 days (raw HR 1–14), workout lookbacks to 1–180 days, and fallback samples to 1–100. |
| Domain instruction constraints | `agents/sleep-agent.ts:4-15`; `agents/training-agent.ts:4-16`; `agents/recovery-agent.ts:4-20`; `agents/orchestrator.ts:41-54` | Agents are instructed to retrieve tools before claims, not invent values, disclose missing data, avoid sleep diagnosis, avoid HRV claims, avoid a numeric recovery score, and have the orchestrator avoid invented numbers. |
| Structured worker output | `agents/types.ts:1-15`; `agents/insight-agent.ts:20-30` | Worker agents use a Zod output schema with `summary`, `flags`, `recommendations`, and enum `severity` (`info`, `watch`, `concern`). Chat agents intentionally remain free-text. |
| One-pass worker | `worker/run-once.ts:14-67`; `package.json:13-16` | `worker:run` enumerates all user IDs and sequentially runs sleep, training, and recovery insights, continuing after a per-user/domain failure. It writes results with a model identifier and a nominal 14-day period. |
| Persistence/migration | `db/schema.ts:215-256`; `db/queries/agent-insights.ts:6-30`; `drizzle/0004_fine_lake.sql:1-12,32-35` | `agent_insights` is migrated with user foreign key and user/time indexes. Writes are plain inserts, preserving history; latest/history query helpers exist. |
| Deployed worker wiring | `Dockerfile:28-36`; `docker-compose.dokploy.yml:30-46` | A distinct no-port worker image copies `db/`, `agents/`, and `worker/`, starts `worker/loop.ts`, waits for migrations, shares only Postgres with the app, and restarts unless stopped. |
| Current default model in executable code | `agents/model.ts:1-4` | All agent builders use one `OPENAI_AGENTS_MODEL` override; absent it, the code default is **`gpt-5-nano`**. |

## Missing or insufficient for bounded decisions

| Gap/risk | Evidence | Consequence |
|---|---|---|
| No operational decision policy | `agents/types.ts:6-11`; search found no thresholds, triage, escalation, consent, review, or approval code in `agents/`, `worker/`, `app/`, or `db/` | `severity` is an LLM-selected enum with no defined criteria, deterministic threshold mapping, required evidence, escalation path, or human approval. Recommendations can be generated but not governed as bounded decisions. |
| No formal medical-risk handling | Sleep’s only medical disclaimer is `agents/sleep-agent.ts:12-14`; recovery is qualitative only at `agents/recovery-agent.ts:14-19` | There is no cross-agent urgent-symptom/emergency routing, “do not act” policy, clinician review, or safety policy enforcing what recommendations are allowed. Instruction text is not a decision-control mechanism. |
| Worker window metadata does not constrain tool retrieval | `worker/run-once.ts:14,25-38`; tool defaults in `agents/tools/health-samples.ts:24-26,68-70` and `agents/tools/workouts.ts:37-39` | `INSIGHT_WINDOW_DAYS = 14` is used to stamp `periodStart/periodEnd`, but is neither included in the prompt nor passed to tools. The model may choose permitted windows; notably training-load defaults to 28 days. Stored period metadata can therefore disagree with actual evidence queried. |
| Weak recovery signal validity | `agents/tools/health-samples.ts:63-81`; `db/queries/health-samples.ts:95-118` | The “resting heart rate trend” is explicitly derived from daily minimum/average/maximum generic heart-rate samples, not a dedicated resting-HR measurement. It should not be treated as a validated recovery signal. |
| No data eligibility/freshness/quality gate | `worker/run-once.ts:42-55`; `db/queries/users.ts:6-10` | Every user is processed regardless of data presence, recency, account status, sample provenance, or measurement completeness. This can incur provider work for empty data and produce low-evidence insights. |
| Worker is non-idempotent and can overlap | `worker/run-once.ts:30-39`; `db/queries/agent-insights.ts:6-10`; `db/schema.ts:248-255`; `worker/loop.ts:11-21` | Each successful run appends a row; no unique key/run ledger prevents duplicates. `setInterval` does not await completion before scheduling another tick, so a slow pass can overlap a new pass. Restart causes an immediate extra pass. |
| No catch-up, retry discipline, dead-letter state, or observability | `worker/loop.ts:11-21`; `worker/run-once.ts:46-57` | Per-domain errors are console-logged and skipped until a future pass; a fatal enumeration error is only logged by the loop. There is no retry policy, backoff, error persistence, metrics, alerting, run status, or reconciliation mechanism. |
| Worker cadence is unvalidated | `worker/loop.ts:8-9` | `WORKER_INTERVAL_MINUTES` is simply coerced with `Number`; no finite, positive, integer, or minimum validation guards malformed/zero/negative values. |
| Scalability/cost limit absent | `worker/run-once.ts:42-55` | User/domain runs are serial and unbounded in count. There is no pagination, batching, concurrency policy, quota, timeout, or provider budget control. |
| Chat request and conversation are unbounded | `app/api/chat/route.ts:9-38,40-114`; `app/(authenticated)/dashboard/chat/chat-panel.tsx:76-87` | The route accepts an arbitrary number/length of client-supplied prior messages and forwards them as model input. No size cap, turn limit, timeout, cancellation propagation, rate limit, or abuse quota is present. Client-held prior assistant text is also reintroduced as model input. |
| Stream failure behavior may expose internals and loses partial answer | `app/api/chat/route.ts:82-108`; `app/(authenticated)/dashboard/chat/chat-panel.tsx:124-132` | The server forwards `Error.message` into the stream, potentially disclosing provider/database detail. On any client error, the UI resets to `nextMessages`, discarding the in-progress assistant message/telemetry. NDJSON parsing is an unchecked `JSON.parse` cast rather than runtime event validation. |
| Chat is not persisted | `app/api/chat/route.ts:25-38`; `app/(authenticated)/dashboard/chat/chat-panel.tsx:56-87` | Conversation history exists only in browser state and is sent each turn; it is not auditable/recoverable server-side. This is explicitly documented as a v1 simplification. |
| Persisted insights have no app consumer | `db/queries/agent-insights.ts:13-30`; repository search found no `app/`, `components/`, or `lib/` reference to these functions/table | The database write/query layer exists, but no dashboard/API currently reads or displays insight rows. This contradicts the README’s broad statement that the app reads the table (`README.md:88`) and means insights are not product-visible in current source. |
| Model configuration/documentation drift | Code: `agents/model.ts:4`; documentation: `.env.example:8-13`, `README.md:123`; production Compose: `docker-compose.dokploy.yml:12-21,33-40` | Executable default is `gpt-5-nano`, while `.env.example` and README say `gpt-5-mini`. Further, production Compose does not pass `OPENAI_AGENTS_MODEL` into either app or worker, so a deployment-level override will not reach the code. |
| No automated tests found | Search excluding dependencies found no project `*test.*`/`*spec.*` files; static checks passed | There is no demonstrated test coverage for tool scoping, event protocol, structured-output rejection, worker deduplication, schedule safety, error handling, or decision policy. |

## Persistence and data-boundary observations

`agent_insights.payload` is required JSONB and `summary` is required text (`db/schema.ts:230-246`), while application-level types expect the Zod schema. PostgreSQL does not independently enforce the JSON shape, enum value, source-tool evidence, or period/tool-window consistency. The migration provides history-oriented indexes, not a uniqueness constraint for a user/domain/period/run (`drizzle/0004_fine_lake.sql:34-35`).

The health/workout query layer correctly scopes reads by `userId` (`db/queries/health-samples.ts:19-43`, `db/queries/workouts.ts:15-34`) and uses stable external IDs for ingest upserts (`db/queries/health-samples.ts:45-64`, `db/queries/workouts.ts:59-81`). However, the agent tool outputs send selected health/workout fields to the model provider. No explicit source evidence of consent recording, minimization policy, external-processing disclosure, retention controls, or provider-data handling policy was found in the audited paths.

## Compatibility and configuration requirements

| Requirement | Evidence |
|---|---|
| Node 24 / Docker multi-target build | `Dockerfile:3,28-60`; README `:7-10` |
| OpenAI Agents SDK and Zod output contract | `package.json:18-28`; `agents/types.ts:6-15` |
| Worker/scripts must use React Server condition when importing DB queries | `AGENTS.md:37-39`; `package.json:13-16`; `Dockerfile:36` |
| PostgreSQL schema must include migration `0004_fine_lake.sql` before worker writes | `drizzle/0004_fine_lake.sql:1-38`; Compose migration gate `docker-compose.dokploy.yml:2-10,25-27,43-45` |
| Authenticated chat requires Better Auth session and database availability | `db/auth-dal.ts:7-15`; `app/api/chat/route.ts:40-44`; `db/client.ts:6-14` |
| Model selection must be consistent across executable default, docs, and both Compose services | `agents/model.ts:4`; `.env.example:10-11`; `README.md:123`; `docker-compose.dokploy.yml:16-21,37-40` |

## Recommended baseline checks before treating outputs as decisions

1. **Define an explicit policy contract**: deterministic criteria/evidence requirements per `severity`, allowed recommendation classes, no-action states, missing-data behavior, thresholds, human review/escalation, and audit fields. Enforce it in code/schema rather than prompts alone.
2. **Bind evidence to each insight**: pass a fixed window to every tool; store tool retrieval window, data freshness/completeness, source provenance, and schema/policy version. Do not label a 14-day period unless every decision input is bounded to it.
3. **Make worker execution durable**: add a run ledger and unique/idempotency key, distributed overlap lock, eligible-user/data-freshness query, retry/backoff/dead-letter state, metrics/alerts, bounded batching/concurrency, and validated positive cadence.
4. **Harden chat transport**: validate request and NDJSON event schemas at runtime; cap message count/content/context; add timeouts, disconnect cancellation, rate/budget limits, sanitized public errors, and intentional partial-output handling. Persist audit-safe conversation/run metadata if auditability is required.
5. **Close the product path**: add an authenticated, user-scoped read surface/API for insights only after policy validation; otherwise disable or clearly quarantine the worker output as experimental/internal.
6. **Resolve configuration drift**: choose and document one default model; forward `OPENAI_AGENTS_MODEL` to both production app and worker services; validate all runtime environment names at startup without logging values.
7. **Add non-provider tests**: mock model/tool calls to test user isolation, no-data behavior, data-window agreement, schema failure, duplicate prevention, overlap locking, error redaction, stream protocol parsing, and decision-policy boundary cases. Keep `npx tsc --noEmit` and `npm run lint` as baseline gates (both pass in this audit).
8. **Establish privacy and clinical governance** before external model processing or user-facing recommendations: consent/disclosure, data minimization/retention, provider handling review, and a clinically reviewed escalation/non-diagnostic policy.

## Environment variable names observed

`DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_AGENTS_MODEL`, `WORKER_INTERVAL_MINUTES`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and the build-phase variable `NEXT_PHASE`. No values are recorded in this report.

## Audit limitations

This report does not attest that a Dokploy deployment, database migration, credentials, provider account, mobile ingestion, or worker container is currently running. It deliberately did not execute `worker:run`, `worker:loop`, chat calls, migrations, or any operation that could invoke a model or process personal health data.
