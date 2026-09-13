# BRIO product contracts

**Contract version:** `1.0.0`  
**Prototype policy version:** `prototype-1`  
**Default timezone:** `Europe/Dublin`

The runtime source of truth is `code/brioweb/lib/contracts/`. Those modules import only Zod and are safe for server and client type use. Route handlers remain responsible for deriving `userId` from the Better Auth session. No product write contract accepts an owner identifier.

## Shared semantics

| Concept | Contract |
|---|---|
| Input data mode | `live`, `manual`, `synthetic_input`, or `unavailable` |
| Decision execution mode | `deterministic_prototype`, `live_agent`, or `simulated_decision` |
| Decision actions | Exactly `Progress`, `Maintain`, `Repeat`, `Reduce`, or `Escalate` |
| Metric state | `above`, `within`, `below`, `missing`, `excluded`, `stale`, or `insufficient` |
| Coverage | `complete`, `partial`, `missing`, or `not_expected`, with nullable 0–1 coverage |
| Freshness | `fresh`, `stale`, or `unknown` |
| Confidence | `normal`, `low`, or `unknown` |
| Time | UTC ISO timestamps at API boundaries; local dates grouped with the saved IANA timezone |
| Idempotency | Stable `mutationId` on product writes; source-stable `externalId` on imported samples |
| Concurrency | Integer `revision`; clients send the revision they read and receive 409 on stale writes |

A missing metric has a null value and is never represented as zero. Synthetic input provenance and simulated decision execution are separate fields so the interface cannot silently imply that a scripted outcome came from a live agent.

## Route map and storage owner

| Interaction | Route | Request contract | Response contract | Storage owner |
|---|---|---|---|---|
| Preferences and onboarding | `GET/PATCH /api/preferences` | `PreferencePatchSchema` | `PreferencesSchema` | `user_preferences.user_id` from session |
| Signal-level consent | `GET/PATCH /api/consent` | `ConsentPatchSchema` | `ConsentSnapshotSchema` | `signal_consents.user_id`; version on preferences/state row |
| Today metrics | `GET /api/dashboard?date=YYYY-MM-DD` | Query local date | `DashboardSchema` | Read-only projection of current user's consented records |
| Five-item daily check-in | `GET/POST /api/check-ins` | `DailyCheckInSchema` | Same schema | `daily_check_ins.user_id`; unique user/day and mutation ID |
| Batched manual log | `GET/POST/PATCH/DELETE /api/manual-logs` | `ManualLogSchema` | Same schema or mutation result | `manual_logs.user_id`; unique mutation ID |
| Training sessions | `GET/POST /api/training/sessions` | `TrainingSessionWriteSchema` | `TrainingSessionSchema` | `training_sessions.user_id` |
| Session edit / completion | `GET/PATCH /api/training/sessions/:id` | Revisioned session write | `TrainingSessionSchema` or 409 | Session owner from session plus ID predicate |
| Current/history decision | `GET/POST /api/decisions` | Generate scenario/mode request | `DecisionSchema` | `decisions.user_id` |
| Accept or override | `POST /api/decisions/:id/respond` | `DecisionResponseSchema` | Decision plus event | `decision_events.user_id`; transaction with decision status |
| Source state | `GET /api/source-status` | None | `SourceStatusSchema[]` | Current user's samples and sync status |
| Data export | `GET /api/export` | None | `ExportEnvelopeSchema` download | Current-user rows only; excludes credentials and sessions |
| Account deletion | `DELETE /api/account` | Explicit confirmation token | Deletion acknowledgement | Auth and owned product rows in a deletion-safe order |
| Existing sample ingest | `GET/POST /api/health-samples` | `HealthSampleRequestSchema` | Existing `{samples}` response retained | Current session user; per-signal consent applied server-side |
| Existing agent chat | `POST /api/chat` | Existing NDJSON request | Existing NDJSON events retained | Current session user; sanitised consented context only |

## Preferences and onboarding

`PreferencesSchema` stores timezone, goal, block, usage mode, restriction source text, user-confirmed restriction tokens, onboarding completion, revision, mutation ID, and timestamp. Goal and block have usable defaults and are not mandatory decisions. Restriction parsing is a deterministic preview; tokens enter storage only after user confirmation.

Visible sign-up remains a presentation concern over Better Auth. The product form will expose email and password only. A server-generated neutral name and collision-resistant username satisfy the existing plugin without hidden user assertions. Social controls render only when a provider is configured and verified.

## Consent

`ConsentSnapshotSchema` contains each signal exactly once. All eight signals begin disabled, including `server_ai_processing`. Every row includes purpose and source text. `ConsentPatchSchema` includes `expectedConsentVersion` and a mutation ID. A successful change increments the version once, records the timestamp, and invalidates current decisions or insights that used changed signals.

| Signal | Inputs controlled |
|---|---|
| `health_steps` | Apple Health step samples |
| `health_active_energy` | Apple Health active-energy samples |
| `health_heart_rate` | Ordinary heart-rate samples; never presented as HRV or measured resting heart rate |
| `health_sleep` | Apple Health sleep segments |
| `manual_training` | Manual training sessions and projections |
| `manual_nutrition` | Manual intake totals and named foods |
| `daily_check_in` | Five-item subjective check-in |
| `server_ai_processing` | Any transfer of selected evidence to the configured model provider |

Turning a signal off suppresses it from current dashboard and decision reads immediately. Historical audit keeps the original evidence list but marks the decision stale and never reuses it as current context. Turning consent off does not delete stored source rows; deletion is a separate action.

## Daily metrics and aggregation

The nine metric keys are session volume, session effort, steps, energy intake, protein, carbohydrate, sleep duration, heart-rate trend, and subjective readiness. Every metric returns a value or null, display value, unit, state word, baseline sentence, evidence window, and `ProvenanceSchema`.

Health samples remain the existing raw normalized ingest store. The supplied DailySignal v1.1 design provides the coverage, freshness, confidence, quality-reason, capture-context, and source-selection vocabulary. The deadline implementation derives metric DTOs from health samples/manual records instead of introducing a second canonical raw-record system.

Sleep combines only asleep categories and must explicitly handle overlapping source segments. Today's observation is excluded from prior-baseline calculation where a prior baseline is claimed. Ordinary heart-rate trend is named as such. Active energy and energy intake are separate values and are never subtracted into an asserted energy balance.

## Daily check-in and manual log

The daily check-in has exactly five 1–5 items in this order: fatigue, muscle soreness, sleep quality, stress, mood. This is product wording, not a claim of a validated diagnostic instrument. One row exists per account/local date and may be corrected by revisioned update.

A manual log stores only submitted groups and fields. All numeric quantities must be finite and non-negative, with defensive upper bounds. Nutrition may include manually named foods and user-corrected neutral restriction tags. No food safety claim or diagnosis is encoded.

## Training sessions

A training session contains stable IDs, ordered exercises, ordered sets, warm-up/working type, nullable load/reps/RPE, completion state, completion/rest timestamps, notes, mutation ID, and revision. Completed sets require load, reps, and completion time. Completed sessions require start and end time.

Completion projects exactly once into existing `workouts` with external projection key `brio-session:<session-id>`, type `strength`, source `Brio session log`, completed set count, working-set volume, and exercise names in metadata. The projection transaction updates the session and workout together. The P03 migration changes workout uniqueness to `(user_id, external_id)` before this path is enabled.

## Decisions and audit events

A decision stores schema/policy versions, action, bounded editable proposal, input and execution modes, evidence references, excluded signals, uncertainty, concise specialist summaries, disagreement summary, policy reason, consent version, generation/stale times, and status. `Escalate` and `escalated` must occur together and block generated session controls.

A response event is immutable and separate from the original decision. Accept preserves the displayed action/proposal. Override records the edited action/proposal and requires a concise reason. Mutation IDs prevent duplicate events. Only a current proposed decision with matching consent version may be accepted or overridden; duplicate or stale events return a conflict.

The live agent path must emit a structured payload validated by `DecisionSchema`, then pass deterministic evidence-reference and bounds checks. A missing key, timeout, malformed payload, or partial specialist failure becomes unavailable or partial—not an automatic simulated result. The fixture engine uses the same contracts and labels `simulated_decision` explicitly.

## Export and deletion

The JSON export contains schema version, export time, account ID, preferences, current consent snapshot, health samples, manual logs, check-ins, sessions, decisions, and response events. It excludes password hashes, sessions, provider tokens, server secrets, and every other account.

Deletion removes the disposable or authenticated account's owned product/auth rows, revokes sessions, and prevents worker writes while deletion is active. The UI must distinguish stopping future use from deleting stored data.

## Validation rejection examples

| Invalid input | Expected rejection |
|---|---|
| `value: Infinity` or `NaN` | Non-finite numeric value |
| `endDate < startDate` | Reversed interval |
| Empty `externalId` when present | Empty stable ID |
| More than 250 samples | Bounded batch exceeded |
| Decision action `Recover` | Unsupported action; only the five exact actions are allowed |
| Missing metric with value `0` | Missing must use null; zero is an observation |
| `unit: none` with numeric proposal amount | Incompatible proposal shape |
| Escalate action with proposed status | Invalid decision state transition |
| Duplicate or incomplete consent keys | Every signal must appear exactly once |
| Stale preference/session revision | HTTP 409 revision conflict |

## Compatibility constraints

The existing health endpoint continues to accept a single sample, a raw array, or `{samples}`. Null external IDs continue to append. Stable external IDs deduplicate only within one owner after P03. `proxy.ts` stays cookie-only, while each route calls the authenticated DAL. Standalone scripts and the worker continue using `tsx --conditions=react-server`. Existing `/api/chat` NDJSON event names remain unchanged.

## Sources

[1]: ../../Wireframe.md "BRIO wireframes — build notes"
[2]: ../../brand.md "Brio — brand foundations"
[3]: ../../output/pdf/BRIO-Manus-PWA-Playbook.md "BRIO PWA build plan and Manus prompt playbook"
