# BRIO test results

## P01 baseline — 2026-09-12

| Check | Command or evidence | Result | Notes |
|---|---|---|---|
| Web dependency install | `cd code/brioweb && npm ci` | Pass | Locked install completed; npm reported four moderate dependency advisories. No forced upgrades were applied. |
| Mobile dependency install | `cd code/briomobile && npm ci` | Pass | Locked install completed; npm reported fourteen moderate dependency advisories. No forced upgrades were applied. |
| Web lint | `npm run lint` | Pass | Exit 0. |
| Web TypeScript before generated route types | `npx tsc --noEmit` | Fail, understood | `app/layout.tsx` could not find generated global `LayoutProps`. |
| Web production build | `npm run build` | Pass | Next.js 16.3.4 compiled, type-checked, and generated all fourteen pages. Initial no-env run emitted Better Auth configuration warnings but still exited 0. |
| Web TypeScript after build | `npx tsc --noEmit` | Pass | Exit 0 after Next generated route types. |
| Mobile lint | `npm run lint` | Pass | Exit 0. |
| Mobile TypeScript | `npx tsc --noEmit` | Pass | Exit 0. |
| PostgreSQL availability | PostgreSQL 16 local service | Pass | Docker was unavailable, so a local service was installed for repository verification. |
| Existing migrations | `npm run db:migrate` | Pass | Drizzle reported all existing migrations applied successfully. |
| Anonymous public pages | `curl` for `/`, `/sign-in`, `/sign-up`, `/forgot-password` | Pass | Each returned 200. |
| Anonymous page protection | `GET /dashboard` | Pass | Returned 307 to `/sign-in`. |
| Anonymous ingest protection | `GET /api/health-samples` | Pass | Returned 401 JSON. |
| Disposable signup | Better Auth email sign-up for two local accounts | Pass | Both returned 200 and issued authenticated cookies. |
| Existing single-object ingest | `POST /api/health-samples` | Pass | Returned 201. |
| Existing raw-array ingest | `POST /api/health-samples` | Pass | Returned 201. |
| Existing `{samples}` ingest | `POST /api/health-samples` | Pass | Returned 201. |
| Owner-scoped read | Authenticated GET by sample type | Pass | Account A read its own records; account B did not read account A's record. |
| Cross-user external-ID isolation | Two accounts POST same `externalId` | **Fail — P0** | Account B's request updated account A's row. Verified one database row remained, owned by A and containing B's value. |
| Secret pattern scan | Tracked files and reachable Git history | Pass | No token/private-key patterns found; values were not printed. Local `.env.local` is ignored and mode 600. |
| Docker image and Compose build | Docker CLI | Unverified | Docker is not installed in the sandbox. |
| Physical iPhone / HealthKit | External device | Unverified | Requires owner device and Xcode. |
| Public HTTPS deployment | Dokploy access | Unverified | Final target credentials/configuration not present in the uploaded repository. |
| Real agent call | External model | Not run in P01 | P01 intentionally made no model call. Deterministic demo remains mandatory. |

## Evidence files

Exact outputs are in `docs/manus/evidence/p01-web-lint.txt`, `p01-web-tsc.txt`, `p01-web-build.txt`, `p01-web-tsc-after-build.txt`, `p01-mobile-lint.txt`, `p01-mobile-tsc.txt`, `p01-db-migrate.txt`, `p01-http-anonymous.txt`, and `p01-auth-ingest-smoke.txt`.

## Interpretation

The imported application is buildable and has working identity and sample-ingest foundations. The cross-account conflict bug blocks safe extension until P03 changes the unique key and upsert target. No external/device test is reported as passed.

## P02 contracts — 2026-09-12

| Check | Result | Notes |
|---|---|---|
| Shared contract load | Pass after one repair | Zod 4 rejected deriving `.omit()` from a refined object. The schema now derives both full and write shapes from a shared base, then applies the same refinement. |
| Existing health payload compatibility | Pass | Single object, raw array, and `{samples}` wrapper all normalize to one validated sample list. |
| Health validation boundaries | Pass | Non-finite values, reversed dates, empty IDs, and batches over 250 are rejected. |
| Consent defaults and completeness | Pass | Eight signal controls are present exactly once and all begin disabled. |
| Decision action boundary | Pass | Exactly Progress, Maintain, Repeat, Reduce, and Escalate are accepted. |
| Missing versus zero | Pass | Missing metric requires null and rejects zero-as-missing. |
| Decision state and proposal invariants | Pass | Escalate/status mismatch and numeric amount with unit `none` are rejected. |
| P02 lint | Pass | `npm run lint` exited 0. |
| P02 TypeScript | Pass | `npx tsc --noEmit` exited 0 after repair. |

Exact output: `docs/manus/evidence/p02-contract-tests-final.txt`, `p02-lint-final.txt`, and `p02-tsc-final.txt`.

## P03 persistence and consent — 2026-09-12

| Check | Result | Notes |
|---|---|---|
| Drizzle generation | Pass | Generated `0005_slippery_black_tom.sql` and `0006_loving_rick_jones.sql` through `npm run db:generate`. |
| SQL review | Pass | Migration adds owned product tables, composite owner/external-ID indexes, and consent-versioned worker insight fields. No destructive table rewrite. |
| Local migration | Pass | Both generated migrations applied through `npm run db:migrate`. |
| Cross-account health external ID | Pass | Two accounts retain independent values under the same external ID. |
| Same-owner stable health ID | Pass | Repeat writes update one owner-scoped row. |
| Null health external IDs | Pass | Two requests create two rows, preserving PostgreSQL null uniqueness semantics. |
| Invalid health interval | Pass | Reversed dates return 400. |
| Disabled health signal | Pass | Request returns 201 for compatibility with accepted count 0 and skipped count 1. |
| AI consent off | Pass | Authenticated chat returns 403 before model execution. |
| Manual-log idempotency | Pass | Duplicate mutation ID returns the same row; a valid revision updates; stale revision returns 409. |
| Daily check-in idempotency | Pass | Duplicate mutation ID does not duplicate the daily row. |
| Session idempotency and projection | Pass | Repeated completion results in exactly one `workouts` projection. |
| Consent invalidation | Pass | Consent version increments and a current proposed decision becomes stale. |
| Export boundary | Pass | Export belongs to the authenticated account and excludes auth/session credential fields. |
| Account deletion | Pass | Disposable user row is removed and its prior cookie receives 401. |
| Worker with AI consent off | Pass after environment correction | First invocation lacked exported `DATABASE_URL`; with the ignored local environment loaded, worker reported zero eligible users and completed without a model call. |
| P03 lint | Pass | Exit 0. |
| P03 TypeScript | Pass | Exit 0. |
| P03 production build | Pass | Next 16.3.4 built 23 routes successfully. |

Exact integration evidence: `docs/manus/evidence/p03-product-integration.txt`, `p03-delete-smoke.txt`, `p03-worker-consent-off-with-env.txt`, `p03-db-generate.txt`, `p03-db-generate-insights.txt`, `p03-db-migrate.txt`, `p03-db-migrate-insights.txt`, and `p03-build.txt`.

## P04 deterministic demo — 2026-09-12

| Check | Result | Notes |
|---|---|---|
| Fixture determinism | Pass | Every scenario is byte-equivalent for the same anchor date. |
| Five action reachability | Pass | Scenario set reaches exactly Progress, Maintain, Repeat, Reduce, and Escalate. |
| Disagreement inspection | Pass | Simulated specialists expose Maintain versus Repeat; final action is Repeat. |
| Consent revocation | Pass | Revoking sleep excludes it immediately and stales the current decision. |
| Interactive local reducer | Pass | Override audit and completed-set mutations preserve structured state. |
| Backend reset guard | Pass | Authenticated request returns 404 while `BRIO_DEMO_MODE` is not true. |
| P04 contract tests | Pass | Six contract tests remain green. |
| P04 demo tests | Pass | Five deterministic demo tests pass. |
| P04 lint / TypeScript / build | Pass | Production build generated 24 routes. |

Evidence: `p04-demo-tests-final.txt`, `p04-contract-tests.txt`, `p04-demo-reset-guard.txt`, `p04-lint.txt`, `p04-tsc.txt`, and `p04-build.txt`.

## P05–P17 release verification — 2026-09-12

| Check | Result | Notes |
|---|---|---|
| Web TypeScript and ESLint | Pass | `npx tsc --noEmit` and `npm run lint` exit 0 after all routes and components. |
| Mobile TypeScript and Expo ESLint | Pass | Account-scoped consent/deletion-aware HealthKit sync compiles and lints. |
| Contract tests | Pass, 6/6 | Payload compatibility, validation, default-off consent, five actions, missing-vs-zero, and proposal/state invariants. |
| Deterministic demo tests | Pass, 5/5 | Determinism, five actions, disagreement, consent revocation, and mutation persistence. |
| P03 persistence regression | Pass | All prior ownership, consent, idempotency, revision, projection, export, and AI-off checks remain green. |
| Release integration | Pass | Onboarding preference write, default-off consent, per-signal enable, owner-scoped HealthKit deletion, manual log, check-in, nine metrics, deterministic decision, immutable response, AI-off live route, export, manifest, service worker, offline page, and demo. |
| HealthKit deleted sample ownership | Pass | Account A deleting a shared UUID removes only A's row; account B's same UUID/value remains. |
| Deterministic decision without model | Pass | Authenticated `/api/decisions` returns 201; `/api/decisions/live` returns 403 while AI consent is off, before a model call. |
| Production build | Pass | Next.js 16.3.4 compiled, type-checked, and generated 41 pages/routes. |
| Docker-style standalone runtime layout | Pass | `.next/standalone`, `.next/static`, and `public` were assembled exactly like the Docker runner; root, demo, logo, CSS, manifest, and public HTTPS each returned 200. |
| Production HTTP | Pass | Local root/demo/manifest and public HTTPS root/demo return 200. |
| Production two-field signup | Pass after configuration repair | Initial `Invalid origin` exposed local `BETTER_AUTH_URL`; exact public HTTPS origin fixed it. Fresh browser signup redirected to onboarding. |
| Browser onboarding | Pass | Default-off signals rendered; one toggle changed independently; consent save advanced; source/setup/usage screens rendered; completion redirected to authenticated Today. |
| Authenticated Today visual | Pass | 3×3 grid distinguishes missing from not-being-read, offers deterministic/live paths separately, and exposes logging/check-in. |
| Lighthouse guest demo | Pass | Accessibility score 1.0 and best-practices score 1.0. A non-impacting `label-content-name-mismatch` audit returned score 0 without item details while the category remained 1.0. |
| Forbidden-claim scan | Pass with expected negations | Hits are only explicit statements such as “not HRV” and “without a recovery percentage,” plus agent prohibitions. |
| Secret scan | Pass | No token/private-key assignments found in tracked code/docs; values are absent from handoff files. |
| Physical iPhone/HealthKit | **Blocked externally** | Requires owner device, Apple provisioning, and Xcode; no success is claimed. |
| Docker/Dokploy deployment | **Blocked externally** | Docker is unavailable in sandbox and Dokploy access was not supplied. Production sandbox build/HTTPS preview is verified. |
| Real model execution | Not run by design | Live route is structured and consent-gated. Reliable demo and deterministic policy require no model. |

Primary evidence: `release-web-static-tests.txt`, `mobile-final.txt`, `release-p03-regression.txt`, `release-integration.txt`, `release-production-build.txt`, `release-production-http.txt`, `lighthouse-demo-summary.json`, and the `release-browser-*.md` files under `docs/manus/evidence/`.

## Five-ECP live-agent demo — 2026-09-13

| Check | Result | Notes |
|---|---|---|
| ECP fixture unit tests | Pass, 3/3 | Exactly five profiles cover all five BRIO actions as design intent; each creates deterministic labelled 14-day cross-domain history; owner scope prevents training ID collisions. |
| Five authenticated resets | Pass | Young male athlete, returning professional, endurance builder, strength parent, and active older returner each loaded through the guarded account endpoint. |
| Per-profile data completeness | Pass | Each reset produced 14 nutrition days, 56 labelled demo foods, 14 check-ins, 84 synthetic health samples, four structured completed sessions, and five additional workouts. |
| Synthetic health separation | Pass | All 84 health rows use `metadata.synthetic=true` and a source label ending `not Apple Health`; Apple Health status does not claim them. |
| Synthetic food labelling | Pass | All 56 food entries per profile begin `[SYNTHETIC DEMO FOOD]`; mutation IDs and log notes retain synthetic provenance. |
| Reset repeatability | Pass | Loading young athlete twice retained the expected row counts and exactly nine synthetic workout rows after session projection. |
| Fourth specialist | Pass | The nutrition specialist retrieved entered energy/macronutrient/named-food history and explicitly disclosed 14/14 synthetic days. |
| Live Agents SDK transport | Pass after two focused repairs | Compatible proxy needed Chat Completions rather than streamed Responses, then nested specialists needed the same concrete model and non-streamed callback path. Both failure modes returned honest no-data responses and did not alter records. |
| Live four-specialist review | Pass | Training, Nutrition, Sleep, and Recovery were all consulted over the young-athlete fixture. The final response began `Synthetic demo review`, included concrete observations and uncertainty, and ended with one bounded action. |
| Unsupported-claim guard | Pass | Final judging smoke rejected specialist failure text, unsupported helper workout/nutrition sync, scheduled follow-up claims, and the prohibited biomarker term. |

Primary evidence: `ecp-fixtures-tests.txt`, `ecp-live-agents-integration.txt`, `ecp-live-agent-smoke-judging.txt`, and `ecp-final-release-gates.txt` under `docs/manus/evidence/`.
