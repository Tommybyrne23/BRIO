# Brio wireframes — build notes

Freeze: Thu 11 Sep 18:00. Regionals: Mon 14 Sep.

## Onboarding

### First visit — value before signup
- Status: Build
- Owner: Thomas
- No email wall. The recommendation is readable before any account exists.
- Both buttons same width. 'Look around' is not visually demoted.

### Sign up
- Status: Build
- Owner: Thomas
- Two fields only. No confirm-password, no phone, no marketing checkbox.
- Social sign-on above the fold — it converts far better than email.

### Permission priming
- Status: Build
- Owner: Marcos
- Fires BEFORE the OS prompt. Protects the single iOS permission ask.
- Copy for the three panels is Marcos's, not placeholder.

### Signal-level consent
- Status: Build
- Owner: Marcos
- Every toggle defaults OFF. No 'accept all' shortcut that hides granularity.
- Each row carries purpose text and source attribution.
- Turning one off later must remove it from the decision inputs immediately — wire this, it is the demo beat.

### Connect sources
- Status: Build
- Owner: José
- CHANGED 8 Sep: nutrition now comes from Apple Health, not CSV. Two sources, not three.
- Real win — one fewer connector, consent row, import UI and parser before the freeze.
- DECIDE: export.xml upload, or live HealthKit via the iOS bridge? The bridge needs an Apple developer account, which the delivery plan flagged as a day-one question. If that is still open on 8 Sep, export.xml is the only safe route to Thursday.
- Skip must produce a working app in manual mode, not a dead end.
- Label the connector 'simulated' on stage so an API cannot break the demo.

### Goal & block
- Status: Build
- Owner: Greg
- Goal is what makes the same recovery reading produce a different action. Say so on screen.
- Prefilled defaults; nothing here is a required decision.

### Dietary restrictions
- Status: Build
- Owner: Marcos
- Agent may tag foods. It may NOT infer a diagnosis, carb/insulin guidance, or say a food is safe.
- Parse preview is the trust mechanism — the user corrects the reading before it is stored.
- DEPENDS ON w17: this screen collects restrictions so foods can be tagged. If Apple Health gives totals with no food names, there is nothing to tag and this screen collects data the product cannot act on yet. Keep it (it is onboarding signal and it demos well) but do not claim the flagging works until w17 is settled.
- OPEN: does the free-text parse run on-device or server-side? Affects the consent copy.

### How you use Brio (final question)
- Status: Build
- Owner: Greg
- Each card shows notifications / opens-on / phrasing so the choice is legible.
- Coach mode raises assertiveness and frequency, never authority. Hold this line in review.
- Changeable any time under Data. No upsell to coach.

## Core

### Dashboard — 3×3 rings
- Status: Build
- Owner: Thomas
- Nine rings is dense. All arcs use ONE colour — state is carried by glyph (▲ ≈ ▼) plus the word.
- Why: Sage is 2.85:1 on Bone, under the 3:1 floor for graphical objects, and colour rule 3 forbids hue carrying state.
- Each ring taps through to a detail sheet with the metric, its baseline sentence and its source.
- FALLBACK if it reads cluttered on stage: collapse nutrition to one ring, promote the decision card.

### Log today (batched manual input)
- Status: Build
- Owner: Thomas
- One sheet, grouped Overall / Training / Nutrition / Recovery / Supplements.
- Segmented controls, not keyboards — target is 8–10 taps for the whole sheet.
- Keeps the dashboard from turning into a form. Everything skippable.

### Decision surface & explain card
- Status: Build
- Owner: José
- THE most important screen. Everything else supports it.
- Agent dissent is published, not hidden. Readiness said Maintain, policy said Repeat, orchestrator took the conservative one and recorded why.
- Override control is the same visual weight as accept. No nudge toward accepting.
- Switched-off signals appear greyed with 'not being read' — proves consent is live.

### End-of-day check-in
- Status: Build
- Owner: jiwei
- Five items from the athlete wellness literature, 5-point, anchored both ends.
- About 30 seconds. Once daily. Skip is first-class and breaks no run.
- Physical items first, psychological second. Do not reorder without reason.

## Training

### Training hub
- Status: Build
- Owner: Thomas
- Three entry paths, as briefed. Plan-browser is a stub for the demo — P2.
- 'Describe it' opens a free-text sheet; the draft is fully editable before saving.

### Session logging
- Status: Build
- Owner: Thomas
- Unchanged set = ONE tap on the tick. Ghost value pre-fills from last session.
- Ghost sets are PARITY with Hevy. Build it, never pitch it as new.
- Tick and keypad in the lower thumb zone. Numeric inputmode on every cell.
- Tick starts the rest timer. Tap the set number to switch warm-up/working.

### Session summary
- Status: Build
- Owner: Thomas
- This is the evidential reinforcement moment. Observation, never praise.
- No streak counter, no badge, no 'well done'. The comparison is the reward.
- Carries the next bounded action forward so the loop closes.

### Training analytics
- Status: Open question
- Owner: jiwei
- Secondary to logging. Each chart answers exactly one question, named in the heading.
- No comparison against other users. No vanity metrics.
- OPEN: which three ship for the demo? Four charts is probably one too many for the 3-minute run.

## Hubs

### Nutrition
- Status: Open question
- Owner: Marcos
- OPEN, RAISED 8 Sep: Apple Health may hand over daily or per-meal TOTALS rather than named food rows. If it does, the diary below has nothing to list and the flagged-food feature has nothing to attach to.
- Test before building: export your own Health data, open export.xml, look for dietary records and check whether a food name comes through. One afternoon, and it decides this screen.
- If totals only: this screen becomes the three panels plus a manual add. Drop the diary rows. Say so on the board rather than discovering it Wednesday night.
- Cronometer's swipeable top panels — Greg asked for these specifically. These survive either way.
- Dietary flags are neutral information, never a warning colour alone and never advice.
- No 'good food / bad food' framing anywhere.
- Food search is a stub for the demo — P2.

### Recovery
- Status: Build
- Owner: jiwei
- Band visualisation, not a score. The band IS the argument.
- Justification on screen: wrist and chest devices disagree by a margin that makes a fixed threshold misleading.
- Never 'you are 62% recovered'. Banned phrase.

## Governance

### Data, consent & audit
- Status: Build
- Owner: Marcos
- Export and delete both reachable in two taps. No retention gauntlet on delete.
- Recommendation log shows evidence + what the user did, including overrides with reasons.
- This screen is the governance story. Do not let it get cut for time — it is a judging criterion.

### Empty · error · escalation · offline
- Status: Build
- Owner: Marcos
- Escalation refuses to produce a session and says why. It never diagnoses.
- Offline banner is the demo safety net for the 14th and the 24th.
- Errors name the cause. No apology, no vagueness.

### Coach / reviewer view
- Status: Cut
- Owner: Greg
- Explicitly out of scope before the freeze. In the deck as the B2B2C wedge only.
- Do not let this creep in. It needs multi-user accounts, which are also cut.
