# BRIO implementation decisions

## D-001 — Deadline authority

The authoritative cutoff is **2026-09-13 12:00 +01:00**, supplied by the owner on 2026-09-12. Historic dates in `Wireframe.md` are context only.

## D-002 — Architecture preservation

BRIO will remain an existing Next.js and Better Auth application backed by Postgres and Drizzle, with its standalone worker and Expo Apple Health helper. No replacement framework, auth provider, or generic template will be introduced.

## D-003 — Release priority

The release order is consent enforcement and ownership isolation, durable writes, bounded decision and audit loop, deterministic labelled demo, complete Build-screen navigation, PWA safety, then optional visual refinement. Wireframe-deferred features remain deferred.

## D-004 — Daily signal schema integration

The supplied DailySignal v1.1 model contributes the canonical vocabulary for coverage, freshness, confidence, quality reason, capture context, and source selection. BRIO will not duplicate all existing `health_samples` into a second raw/canonical subsystem before the hackathon. The dashboard service derives versioned metric DTOs from consented source rows and product records while preserving provenance.

## D-005 — Demo provenance separation

Inputs and decision execution are separate dimensions. `synthetic_input` means the evidence is synthetic. `simulated_decision` means the outcome was scripted. A live agent over synthetic evidence is labelled through the combination `inputDataMode: synthetic_input` and `executionMode: live_agent`.

## D-006 — Write safety

Product writes use client mutation IDs for idempotency and integer revisions for optimistic concurrency. Every owner is derived from the server session; public request schemas never accept `userId`.

## D-007 — Owner-scoped import identity

Health and workout external IDs are unique only within one owner. The conflict targets are `(user_id, external_id)`. Multiple null external IDs continue to append, matching PostgreSQL unique-index behavior and preserving manual/synthetic imports without source IDs.

## D-008 — Backward-compatible helper ingestion

Before a user has opened Brio's consent controls, the existing helper may store supported samples to preserve the established ingest contract, but no product read or model tool may use them. Once explicit consent rows exist, disabled types are acknowledged as skipped with accepted/skipped counts. This separates ingestion compatibility from processing permission.

## D-009 — Worker eligibility

The autonomous worker requires an active product account and explicit `server_ai_processing` consent. It captures the consent version before an agent run and rechecks it transactionally before saving a current insight. Consent changes invalidate current insights and decisions.

## D-010 — Reliable decision path first

The judged demo and default authenticated decision generation use a deterministic bounded policy. The live Agents SDK route is a separate action, requires explicit server-AI consent and credentials, and has no simulated fallback. Both routes persist the same validated five-action contract, so an unavailable model never masquerades as specialist execution.

## D-011 — Consent-filtered model context

The live decision route sends only current metrics that are both allowed and usable. Excluded, missing, stale, and insufficient values are represented only as exclusion reasons in the persisted explanation and are not included as model evidence. Ownership remains server-derived.

## D-012 — HealthKit deletion and anchor order

Mobile anchors are scoped by API environment, authenticated user ID, and sample type. Deleted HealthKit UUIDs are reconciled through an owner-scoped endpoint before sample upload, and an anchor advances only after both operations are acknowledged. This prevents one user from inheriting another user's cursor and prevents silent deletion loss.

## D-013 — Authenticated data is never service-worker cached

The PWA caches only public demo and brand assets. API calls and authenticated workspace routes bypass the service worker. Offline account screens explain that records and saves require a connection instead of presenting stale health data as current.

## D-014 — Public auth origin is exact configuration

`BETTER_AUTH_URL` must equal the exact public HTTPS origin in every deployment. Browser testing caught and repaired a sandbox process that inherited the local URL. BRIO does not trust arbitrary request origins dynamically; this preserves Better Auth's origin check rather than weakening it for convenience.

## D-015 — External evidence remains external

Physical HealthKit execution, Apple provisioning, Docker image execution, and Dokploy publication require owner-controlled systems and are never inferred from source code or screenshots. They remain explicit known gaps even though their code paths and runbooks are complete.

## D-016 — Four narrow specialists behind one orchestrator

The conversational surface uses Training, Nutrition, Sleep, and Recovery specialists as tools behind one orchestrator. The orchestrator has no direct database tools. Every specialist receives an owner-bound server tool set and must preserve consent, missing-data, uncertainty, and synthetic provenance. The visible tool trail reports activity rather than private chain-of-thought.

## D-017 — One guarded account can rehearse five ECPs

The five ECPs are deterministic replacement fixtures for one exact demo account, not fake identities blended into ordinary accounts. The reset route requires both `BRIO_DEMO_MODE=true` and exact email equality, deletes only that account's product rows, then loads one complete 14-day history. The loader does not call a model; the user must press Send separately.

## D-018 — Synthetic nutrition is explicit at record and response layers

Every prepared food name begins with `[SYNTHETIC DEMO FOOD]`; nutrition log mutation IDs and notes also identify synthetic input. Health and workout rows carry synthetic metadata and non-Apple source labels. Agent tools expose those fields, and the orchestrator begins the cross-domain result with `Synthetic demo review`.

## D-019 — Compatible proxies use the Agents SDK Chat Completions adapter

Official OpenAI credentials retain the Agents SDK Responses path. If an explicit API base is configured, BRIO binds every agent—including nested agent-as-tool specialists—to one concrete Chat Completions model. This avoids claiming live execution when a proxy accepts ordinary Responses calls but does not implement the streamed Responses event contract expected by the SDK.
