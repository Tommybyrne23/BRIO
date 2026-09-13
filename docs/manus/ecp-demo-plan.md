# BRIO five-ECP demo readiness plan

**Author:** Manus AI  
**Prepared:** 13 September 2026  
**Submission cutoff:** 13 September 2026, 12:00 +01:00  
**Planning window at preparation:** approximately 2 hours 53 minutes

## Executive recommendation

BRIO does **not** need another broad product build. The current repository already contains the difficult foundations: authentication, owner-scoped persistence, consent enforcement, the decision contract, the Today workspace, editable training logs, a deterministic guest demo, an installable PWA, and the foreground iPhone HealthKit helper. The remaining demo problem is presentation and repeatability, not infrastructure.

The fastest credible proof of concept is a **hybrid demonstration**:

1. Expand `/demo` from one generic synthetic persona into **five selectable early-customer profiles (ECPs)**. Each profile has a deterministic 14-day fixture, a clearly labelled simulated decision, and one primary story. This path works without login, database, network, or a model call.
2. Keep **one dedicated backend demo account** for persistence proof: profile onboarding, editable training session, audit/export, and—if the owner can verify it—one real foreground HealthKit sync from the iOS helper.
3. Do not create five fully operational accounts, five agent conversations, or complete native background behavior. Those add failure modes without improving the three-minute proof.

This follows the playbook’s central rule: preserve consent enforcement, durable writes, bounded decisions, and an honest deterministic demo; simplify breadth first.[1]

## Current baseline

| Capability | Current status | Plan treatment |
|---|---|---|
| Next.js PWA and Better Auth | Built and production-build verified | Preserve; no framework or auth changes. |
| Product persistence | Built with owner-derived queries, revisions, mutation IDs, export, deletion, and audit | Use one backend demo account as proof. |
| Decision contract | Built with exactly Progress, Maintain, Repeat, Reduce, and Escalate | Give one ECP to each action. |
| Guest synthetic demo | Built with one persona, 14-day fixture, seven technical scenarios, browser persistence, and reset | Extend to five ECPs; retain technical failure scenarios under a secondary “Demo lab” control. |
| Full-app synthetic generator | Present in the working tree as `generate:fake-app`; guarded, labelled, and idempotent | Add a `--persona` option only if backend seeding is chosen. |
| Training proof | Editable draft, ghost sets, rest timer, persisted session and comparison are implemented | Reuse one short interaction in the judging story. |
| PWA installability | Manifest, icons, service worker, offline fallback, and install guidance are implemented | Recheck on final HTTPS host; do not redesign. |
| iOS helper code | Same-account sign-in, server consent checks, foreground sync, account-scoped anchors, and deletion reconciliation are implemented | Owner performs the physical-device acceptance check. No background-sync claim. |
| Physical iPhone proof | Unverified | Parallel owner task; retain simulated connector fallback. |
| Public durable deployment | Not yet verified on the owner’s final host | Deploy the existing standalone/Compose architecture or retain a clearly temporary preview. |
| Live model | Wired but intentionally optional | Do not put it on the critical demo path. |

The current P10 refinement is still an **uncommitted working-tree change**. It must be closed out before the final release artifact is generated.

## Delivery options

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---:|---:|
| **Five browser-local ECPs** | Most reliable and works offline. It proves product reasoning and interaction but not database persistence for every persona. | No model cost; minimal runtime cost | Low |
| **Five dedicated backend accounts** | Strong persistence proof for every ECP, but requires account management, deployment-safe seeding, reset rules, and more rehearsal time. | No model cost; database/runtime only | High |
| **Hybrid: five local ECPs plus one backend proof account** | Best balance. The judged story is deterministic, while one account proves real saves, audit/export, and optional helper ingestion. | No model cost by default | Medium |

The recommended sequence is the **hybrid** approach, subject to owner agreement. It keeps the app credible when the network, model, or phone path is unavailable and still demonstrates that the product is more than static screens.

## Five ECP fixtures

All values below are synthetic. Each screen must show **Synthetic inputs** separately from **Simulated decision**. Demographic fields are explicit fixture inputs, not inferences. The decision text remains non-diagnostic and editable.

| ECP | Synthetic planning profile | 14-day evidence pattern | Default bounded action | Demonstration purpose |
|---|---|---|---|---|
| **1. Young male athlete** | Age 22; male; very high activity; five-plus years of training; mixed strength/team-sport focus; five sessions/week; full gym access | Consistent completed sessions, ordinary sleep duration near his own baseline, stable check-ins, and recent loads within his established fixture range | **Progress** | Shows a small, bounded editable progression supported by complete evidence. No claim of “optimal” performance or recovery. |
| **2. Time-constrained returning professional** | Age 36; female; moderate activity; returning after a long break; general fitness; three short sessions/week; home dumbbells | Sparse but usable training history, manual nutrition totals, normal check-in, and no imported sleep for today | **Maintain** | Shows useful behavior with partial data. Missing sleep stays missing and is not converted into a score. |
| **3. Endurance event builder** | Age 29; prefer not to disclose sex; high activity; three-to-five years; endurance focus; five days/week | Recent training is consistent, while synthetic readiness and prototype policy disagree on whether to change the next session | **Repeat** | Shows inspectable disagreement and the conservative deterministic policy outcome. |
| **4. Strength-focused parent** | Age 43; male; moderate activity; one-to-three years; strength focus; three sessions/week; limited session time | Recent working volume is higher than the personal fixture range, self-reported effort is higher, and helper evidence is intentionally stale | **Reduce** | Shows uncertainty, stale provenance, and a bounded reduction of one working set without a recovery percentage. |
| **5. Active older returner** | Age 58; female; moderate activity; returning to training; mobility/general-fitness focus; two sessions/week | User-entered stop condition appears in the check-in; no diagnosis is inferred | **Escalate** | Shows that BRIO refuses to generate a prescribed session and suggests external review. Manual historical logging remains available. |

### Fixture design rules

Each ECP receives a stable ID, version, anchor date, profile, consent snapshot, 14 days of history, Today metrics, nutrition totals, check-in, comparable training sessions, current session draft, source status, decision, and expected audit response. Reset must reproduce byte-equivalent starting data.

The existing seven technical scenarios—signal revoked, missing nutrition, stale helper, model timeout, escalation, disagreement, and normal evidence—should remain available under a secondary **Demo lab** control. ECP selection answers “who is this for?”; scenario selection answers “how does the product behave when conditions change?” Mixing both concepts in one dropdown would make the narrative harder to understand.

## Proposed demo experience

### `/demo`

Add a compact **Choose a synthetic profile** control above Today. Each card shows only the ECP name, training context, data completeness, and expected bounded action. Selecting a profile resets only that ECP’s browser-local fixture and changes the storage key to include the fixture version and ECP ID.

The header should read:

> **Synthetic ECP: Young male athlete**  
> Inputs are generated for demonstration. The decision is simulated locally and no model call is required.

Today then uses the same metric, decision, consent, logging, and explanation components already present. Do not build separate pages per persona.

### Training demonstration

Each ECP should include one completed comparable session and one active draft. The judge path needs only:

1. open Training;
2. show the account-specific prior session;
3. tick one ghost set;
4. show the timestamp-based rest timer;
5. open the neutral comparison summary.

Only the young athlete requires a polished training detail for the primary story. The other profiles need structurally valid fixture histories, not individually authored programmes.

### Data and audit demonstration

The demo adapter should support sleep consent off, decision override, audit history, and JSON export using local fixture state. The existing server enforcement evidence remains the proof that this is not a visual-only control. The demo must never imply that local simulated changes executed a live specialist or changed a real account.

## iOS helper proof

The helper remains a narrow foreground bridge for steps, active energy, ordinary heart rate, and sleep. Background HealthKit delivery, workouts, dietary import, and push are explicitly outside the proof of concept.[1]

The owner device check is:

1. Set `EXPO_PUBLIC_API_URL` to the same final HTTPS backend used by the PWA and restart Metro.
2. Open the existing iOS project with the current plugin-generated native configuration, select the physical iPhone, Personal Team, and automatic signing.
3. Sign into the **same dedicated backend demo account** in the helper and PWA.
4. Enable one supported health signal in BRIO Data, then request native HealthKit access.
5. Tap **Sync now** and record accepted, skipped, and failed counts.
6. Refresh the PWA and compare source, value, and timestamp.
7. Repeat sync and confirm no duplicate source record.
8. Turn the signal off in Data and confirm it becomes **Not being read**.
9. Reopen the helper away from the development machine. If it depends on Metro or fails, use the simulated connector story and state that physical integration is unverified.

Apple does not reveal whether read access was denied, so an empty result must remain “no samples returned,” not “permission granted.”[1]

## Time-boxed action plan

| Phase | Time box | Implementation | Acceptance gate |
|---|---:|---|---|
| **A. Freeze the demo contract** | 10 min | Confirm five ECP names, profile inputs, default actions, and the hybrid route. Freeze deferred features. | One approved fixture table; no new product scope. |
| **B. Implement ECP fixtures** | 35 min | Add `DemoPersonaSchema`, five deterministic fixture definitions, stable ECP IDs, profile-aware history generation, and per-ECP expected assertions. Keep current technical scenarios. | Two resets are identical; five ECPs reach exactly the five actions; all provenance is synthetic. |
| **C. Add the ECP selector** | 25 min | Add profile cards/dropdown and ECP-specific local-storage keys to `/demo`. Reuse existing Today components. | Switching ECP cannot retain another ECP’s edits; reset affects only the selected fixture. |
| **D. Extend backend seeding only if needed** | 20 min | Add `--persona` to `generate:fake-app`; use stable persona-prefixed IDs. Seed one dedicated backend account for the primary story. | Rerun is idempotent; mixed real records are refused; source status remains synthetic. |
| **E. Rehearse the proof path** | 25 min | Validate Today → Explain → consent off → Adjust → Training ghost set → audit/export. Run once online and once offline. | Both runs finish under three minutes with no model dependency. |
| **F. Owner iPhone track, in parallel** | 30–45 min | Run the physical helper checklist against the backend proof account. | One deduplicated sample is visible in PWA, or helper is explicitly marked unverified. |
| **G. Release closeout** | 25 min | Rerun focused tests, production build, public smoke, update state/coverage/tests, commit, and regenerate patch/archive. | Release status matches actual evidence; no uncommitted required files. |

## Tests that matter for this proof of concept

| Test | Why it is required |
|---|---|
| Fixture determinism for all five ECPs | Prevents demo drift between judges. |
| Exactly five bounded default actions | Demonstrates the complete decision vocabulary without hidden actions. |
| ECP state isolation and reset | Prevents one persona’s override/log from leaking into another. |
| Synthetic provenance on every metric, session, export, and source status | Prevents fabricated live-data claims. |
| Escalation refusal | Ensures the app does not generate a session after a stop condition. |
| One backend-account save and export | Proves persistence beyond browser-local state. |
| Production build and HTTPS PWA assets | Confirms installable candidate integrity. |
| Offline `/demo` after one online visit | Confirms the deterministic fallback. |
| Physical helper sync, if available | Converts the iOS helper from implemented code to verified integration. |

A screenshot is useful only for visual evidence. It is not sufficient proof of persistence, consent enforcement, fixture isolation, or sync deduplication.[1]

## Explicit non-goals before submission

Do not add plan browsing, food search, coach access, social login, native nutrition/workout import, background HealthKit delivery, push alerts, diagnostic thresholds, HRV, a recovery percentage, badges, praise, or a new model workflow. Do not create five independent app implementations. Do not put the live agent on the critical judging path.

## Checkpoint before implementation

The next implementation pass should begin only after confirming the preferred route:

- **Local-only:** five ECPs in `/demo`, no backend persona seed changes.
- **Backend-heavy:** five dedicated accounts and a deployment seed/reset process.
- **Hybrid:** five local ECPs plus one dedicated backend proof account. This is the recommended hackathon balance.

After that choice, Phase A freezes the ECP contract and Phase B implements the fixtures. No additional strategy stage is needed.

## References

[1]: ../../../../upload/BRIO-Manus-PWA-Playbook.pdf "BRIO PWA build plan and Manus prompt playbook"
[2]: state.md "BRIO Manus implementation state"
[3]: coverage.md "BRIO wireframe coverage"
[4]: known-gaps.md "BRIO known gaps and external blocks"
[5]: ../../code/brioweb/lib/demo/fixture.ts "Current deterministic guest fixture"
[6]: ../../code/brioweb/scripts/generate-fake-app-data.ts "Current guarded full-app synthetic generator"
[7]: ../../code/briomobile/src/app/index.tsx "Current iPhone helper status and sync surface"
