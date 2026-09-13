# BRIO agent orchestration

## Purpose

BRIO uses a **manager-and-specialists** pattern. The user speaks to one orchestrator, but evidence retrieval and domain interpretation are delegated to four narrow specialists: **Training, Nutrition, Sleep, and Recovery**. This keeps the conversation coherent without giving one general-purpose prompt unrestricted access to every table.

The live conversation is a decision-support review, not a diagnostic service. It does not silently change a plan, training session, consent setting, or health record. It ends with exactly one editable action from **Progress, Maintain, Repeat, Reduce, or Escalate**.

## Request path

| Stage | Component | Responsibility |
|---|---|---|
| 1 | `POST /api/chat` | Verifies the Better Auth session, validates bounded message history, and checks `server_ai_processing` consent before any model call. |
| 2 | Orchestrator | Decides which specialists are relevant. A 14-day cross-domain review is explicitly instructed to consult all four. The orchestrator has no direct database tools. |
| 3 | Specialist agent-as-tool | Runs a domain-specific prompt with only that specialist's server-bound tools. The user ID is captured from the authenticated server session, never accepted from the browser. |
| 4 | Server-only query layer | Reads only rows owned by that user and honors signal-level consent. Missing or disabled evidence is returned explicitly rather than fabricated. |
| 5 | Orchestrator synthesis | Separates domain observations, uncertainty, and cross-domain interactions, preserves synthetic provenance, and returns one bounded action. |
| 6 | Chat UI | Shows specialist/tool activity and streamed or buffered response text. It does not expose private chain-of-thought. |

## Specialist responsibilities

| Specialist | Tools and evidence | Explicit boundary |
|---|---|---|
| Training | User-entered training profile, projected workouts, completed structured session ledgers, steps, and active energy | Does not diagnose or treat a profile as measured physiology. Synthetic workout counts and source names are returned explicitly. |
| Nutrition | Fourteen-day manual nutrition logs, energy intake, macronutrients, and named foods | Intake is never confused with active energy burned. Missing meals, micronutrients, allergies, and food quality are not inferred. |
| Sleep | Consented sleep segments and nightly duration summaries | Reports duration and timing only; it does not invent sleep stages or diagnostic interpretations. |
| Recovery | Consented ordinary heart-rate observations, sleep, activity, and training load | Produces a qualitative, uncertainty-aware integration. It does not output recovery percentages or use unsupported biomarkers. |

The recovery specialist may use outputs that overlap with training and sleep, but it is asked to integrate rather than repeat them. The orchestrator remains responsible for resolving overlap and disagreement in the final answer.

## Consent and ownership

The route rejects the request before model execution when server AI processing is disabled. Each data tool then performs its own signal consent check, so enabling model processing alone does not grant access to sleep, nutrition, training, or heart-rate records. Database queries are server-only and derive ownership from the authenticated session.

The prepared ECP loader is separately guarded by both `BRIO_DEMO_MODE=true` and an exact `BRIO_DEMO_ACCOUNT_EMAIL`. It deletes and replaces product records only for that authenticated demo account. It also turns on all eight consent controls for that account so the prepared live review can run. Ordinary accounts cannot call the loader.

## Synthetic provenance

The five ECP histories are **synthetic inputs**, while the conversation response is a **live agent result**. Those are separate facts:

- Food names begin with `[SYNTHETIC DEMO FOOD]`.
- Manual log notes and mutation IDs identify synthetic fixture rows.
- Health rows include `metadata.synthetic=true` and use the source label `BRIO synthetic ECP generator (not Apple Health)`.
- Training sessions use `inputDataMode: synthetic_input`; their projected workout rows retain synthetic source metadata.
- Every specialist receives these provenance fields, and the orchestrator is instructed to begin a cross-domain result with **Synthetic demo review**.

A synthetic fixture is therefore never presented as an Apple Health import or as a live specialist action.

## Health parsing talk track

The iOS helper is intentionally narrow. It reads **steps, active energy, ordinary heart rate, and sleep** through anchored HealthKit queries. Its cursor is scoped by API environment, authenticated user, and sample type. Deleted HealthKit UUIDs are reconciled before new samples are uploaded; the anchor advances only after both operations succeed. The backend validates accepted payload forms, applies owner-scoped external-ID deduplication, and filters downstream reads by the current consent snapshot.

For the hackathon demonstration, the same backend query and aggregation path reads clearly labelled synthetic rows. This proves the downstream contract without claiming that a physical iPhone supplied the demo history. Nutrition remains manual-entry data, and the helper does not claim to import meals or workouts.

## Model execution

With an official OpenAI endpoint, the Agents SDK uses its Responses API path. When `OPENAI_BASE_URL` or `OPENAI_API_BASE` is configured for a compatible proxy, BRIO uses the SDK's Chat Completions model adapter. The concrete model object is shared by the orchestrator and nested specialists; this matters because an agent invoked as a tool starts its own model run.

The proxy-compatible path buffers the outer synthesis and then emits the same NDJSON chat contract. The official path retains nested streaming activity. Neither path falls back to a simulated answer when a live call fails.

## Five prepared ECPs

| ID | Profile | Distinguishing 14-day evidence | Expected demonstration emphasis |
|---|---|---|---|
| `young_male_athlete` | 22-year-old high-activity mixed athlete | High training/activity, consistent intake, approximately eight hours of synthetic sleep | Progress or Maintain, subject to live synthesis |
| `returning_professional` | 36-year-old returning professional | Short home sessions, moderate activity, lower sleep consistency | Maintain |
| `endurance_builder` | 29-year-old endurance event builder | Run/cycle emphasis and high carbohydrate intake | Repeat |
| `strength_parent` | 43-year-old strength-focused parent | Rising effort with constrained sleep/recovery | Reduce |
| `active_older_returner` | 58-year-old active returner | User-entered stop condition in profile context | Escalate; no prescribed session |

Each profile contains 14 nutrition days with four named demo foods per day, 14 daily check-ins, 84 health samples, four completed structured sessions, and five additional synthetic workouts. The fixture covers all five BRIO actions as profile design intent; the model must still derive its live answer from retrieved evidence rather than being forced to repeat a hidden label.

## Judging sequence

1. Sign in to the exact configured demo account and open **Ask Brio**.
2. Load one ECP. The UI reports record counts and places the prepared review prompt in the input; it does not call the model automatically.
3. Press **Send**. Confirm the visible specialist trail includes Training, Nutrition, Sleep, and Recovery.
4. In the answer, point out the **Synthetic demo review** heading, concrete fourteen-day observations, uncertainty, cross-domain interactions, and the single bounded action.
5. Return to Today, Training, Nutrition, or Data to show that the underlying records are durable and still marked synthetic.

## Known boundary

Chat messages are not persisted as a durable conversation transcript in this proof of concept. The underlying health, nutrition, training, consent, profile, and decision records are persisted. The reliable deterministic decision path remains available separately from live conversational review.
