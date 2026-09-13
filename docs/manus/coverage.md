# BRIO wireframe coverage

This matrix tracks every named screen in `Wireframe.md`. **Built** means the release route and its primary interaction exist with server or browser evidence. **Partial** means the screen exists but a material external dependency or review remains. **Deferred by wireframe** is intentionally excluded. No item is silently omitted.

| Area | Screen | Status | Release evidence and boundary |
|---|---|---|---|
| Onboarding | First visit — value before signup | **Built** | `/` presents the bounded Repeat example, visible disagreement, synthetic/simulated labels, demo, account, and sign-in choices before registration. Production visual evidence is in `evidence/p05-visual-initial.md`. |
| Onboarding | Sign up | **Built** | `/sign-up` has exactly Email and Password. A production browser signup redirected to onboarding after the public `BETTER_AUTH_URL` was corrected. No social provider is rendered. |
| Onboarding | Permission priming | **Partial** | Built as onboarding step 1 with what/why/source explanation and manual-mode assurance. It remains explicitly labelled **copy pending review** because no approved permission copy was supplied. |
| Onboarding | Signal-level consent | **Built** | Eight independent controls are default-off. Browser evidence shows manual training toggled without changing the others; API tests prove versioned persistence and processing enforcement. |
| Onboarding | Connect sources | **Built** | Apple Health helper, manual mode, and staged other providers are distinct. The screen does not claim physical-device verification. |
| Onboarding | Goal & block | **Built** | Usable defaults and persisted selectors are in Setup. |
| Onboarding | Dietary restrictions | **Built** | Comma/newline deterministic parse preview requires explicit checkbox confirmation and states it is not medical/allergy advice. Named-food provider search remains deferred. |
| Onboarding | How you use Brio | **Built** | Quiet, Guided, and Coach modes persist; Coach copy is conditional on AI consent. |
| Core | Dashboard — 3×3 rings | **Built** | Authenticated `/dashboard` uses a server-owned nine-metric DTO with source, freshness, window, quality reason, consent exclusions, missing states, and no zero-as-missing. Guest `/demo` supplies the rehearsed grid. |
| Core | Log today | **Built** | Grouped nutrition entry validates, persists through `/api/manual-logs`, reloads the server projection, and exposes revision conflicts. |
| Core | Decision surface & explain card | **Built** | Deterministic no-model policy and optional consent-gated structured live agent both produce only the five actions. Accept/override writes immutable response events; rationale, evidence, exclusions, uncertainty, mode, and disagreement remain inspectable. |
| Core | Ask Brio / cross-domain review | **Built** | `/dashboard/chat` runs one consent-gated orchestrator over Training, Nutrition, Sleep, and Recovery specialists. The guarded demo account can load any of five complete 14-day ECPs; a verified live response disclosed synthetic provenance, uncertainty, interactions, and one bounded action. |
| Core | End-of-day check-in | **Built** | Ordered five-item 1–5 self-report persists through `/api/check-ins`, reloads into Today, and is labelled non-diagnostic. |
| Training | Training hub | **Built** | The three paths are saved sessions, transparent describe-to-edit, and the visibly P2-deferred plan browser. Manual historical logging remains distinct. |
| Training | Session logging | **Built** | Durable stable-ID ledger supports exercise/set add, remove and reorder; warm-up/working type; load, reps, optional RPE and notes; account ghosts; one-tap tick; lower-thumb timer controls; timestamp reconstruction; pause/reset/duration; retries, revisions and reload. |
| Training | Session summary | **Built** | Completed sets, working volume and reported effort compare with the user's actual prior comparable session when present; first-session state is neutral. Completion transactionally projects exactly one workout. |
| Training | Training analytics | **Built** | Three actual-session panels cover working volume, entered effort, and completed working sets with truthful empty states. Warm-ups are excluded from volume. |
| Hubs | Nutrition | **Built** | Today totals and revision-safe manual add are complete. Intake remains separate from active energy. Food search is visibly deferred. |
| Hubs | Recovery | **Built** | Qualitative sleep and ordinary heart-rate availability bands are shown; no readiness score, recovery percentage, diagnosis, or HRV claim is made. |
| Governance | Data, consent & audit | **Built** | Editable signal controls, source status, install guidance, immutable decision/response audit, JSON export, and typed-confirmation account deletion are available at `/data`. |
| Governance | Empty · error · escalation · offline | **Built** | Empty and excluded metrics, inline API failures/retries, deterministic Escalate demo, model-unavailable handling, and an authenticated-data-safe offline page are present. Service worker caching excludes APIs and account routes. |
| Governance | Coach / reviewer view | **Deferred by wireframe** | Excluded from navigation and implementation. No multi-user coaching is implied. |

## Explicit deferrals and external blocks

| Item | Classification | Release treatment |
|---|---|---|
| Coach/reviewer and multi-user coaching | Deferred by wireframe | Not implemented or linked. |
| Plan browser | Deferred by wireframe (P2) | Honest deferred state; manual session creation is functional. |
| Food catalogue search | Deferred by wireframe (P2) | Honest deferred state; no fake catalogue. |
| Social login | Conditional | Hidden because no provider is configured. |
| Permission priming final copy approval | Blocked on owner/legal review | Working copy is visible and labelled pending review. |
| Physical iPhone HealthKit proof | Blocked on owner device/Xcode | Code is consent-gated, account-scoped, deletion-aware, and anchor-safe; no device success is claimed. |
| Dokploy public deployment | Blocked on external deployment access | Docker artifacts and runbook are complete; sandbox HTTPS production preview is verified, not represented as Dokploy. |
| Real model execution | Built, credential-dependent | Live four-specialist review was executed successfully over the labelled young-athlete ECP. AI-off tests still prove calls are blocked before execution; deterministic demo remains the fallback if credentials are unavailable. |
