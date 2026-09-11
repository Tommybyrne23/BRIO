# BRIO Apple Health Parser

POC Apple Health ingestion parser for BRIO.

## Scope

The parser reads an Apple Health `export.xml` file and extracts:

- Resting Heart Rate
- Heart Rate Variability (SDNN)
- Sleep
- Workouts

The implementation uses streaming XML parsing so that large Apple Health exports can be processed without loading the entire file into memory.

## Parsed Sample Structure

Each supported sample preserves its original source information alongside normalized values.

Examples of retained provenance include:

- original signal type
- original value
- original unit
- source name
- source version
- device information where available
- measurement timestamps
- original timezone offsets
- metadata

Normalized fields are also produced for downstream processing.

## Time Handling

Apple Health timestamps are converted to UTC while preserving their original timezone offsets.

Example:

`2026-09-08 08:58:00 +0100`

becomes:

`2026-09-08T07:58:00+00:00`

with the original offset retained as:

`+0100`

## Source Version

Apple Health provides the field `sourceVersion`.

The parser preserves this as:

`source_version`

This represents the source revision/version provenance required by the BRIO ingestion contract.

## Workout Duration Normalization

Workout durations are normalized to minutes.

Supported conversions include:

- minutes → minutes
- seconds → minutes
- hours → minutes

The original duration value and unit are retained.

## Workout Source Priority and Deduplication

POC workout source priority:

1. WHOOP
2. Apple Watch
3. Other sources

Potential duplicate workouts must:

- have the same workout activity type
- start within 5 minutes of one another
- overlap for at least 50% of the shorter workout

If a WHOOP and Apple Watch workout are identified as duplicates, WHOOP is selected for downstream use.

The original records are still retained by the parser for provenance.

The 5-minute window and 50% overlap threshold are explicit POC configuration values.

The supplied real Apple Health export does not contain overlapping Apple Watch and WHOOP workout periods, so these values are not empirically calibrated from the supplied dataset.

## Large File Validation

The parser was tested against the supplied real Apple Health export.

Results:

- 533,925 Record elements processed
- 311 Workout elements processed
- 392 Resting Heart Rate samples extracted
- 781 HRV SDNN samples extracted
- 5,854 Sleep samples extracted
- 311 Workout samples extracted
- 7,338 supported rows written

Progress is reported every 10,000 Record elements.

## Run Parser


## Readiness Baseline POC

The readiness POC determines whether a current daily signal has meaningfully moved away from the person's own historical baseline or remains within normal day-to-day variation.

### Baseline

- Calculated per person, signal type and device.
- Default baseline window: 14 days.
- At least 7 valid historical samples are required.
- Missing, not-expected and stale historical rows are excluded.
- Today's reading is never included in its own baseline.
- The baseline uses the median rather than a universal signal threshold.
- Historical variability is estimated using median absolute deviation (MAD).

### Movement Detection

A current reading is classified as:

- `wobbled`
- `moved_up`
- `moved_down`
- `insufficient_data`

The POC movement threshold is the larger of:

- 3 × historical MAD
- 10% of the person's baseline

These are configurable POC assumptions pending product review, not clinical thresholds.

### Confidence

Confidence reflects the amount and freshness of available data:

- 12 or more valid historical samples: `high`
- 7–11 valid historical samples: `medium`
- fewer than 7 valid historical samples: `low`
- a stale current reading is always reduced to `low`

### Testing

The readiness tests cover:

- personal baseline calculation
- insufficient historical data
- normal variation (`wobbled`)
- meaningful upward movement
- meaningful downward movement
- high, medium and low confidence
- stale current data reducing confidence
- end-to-end readiness assessment

The full Apple Health parser and readiness test suite currently passes 17/17 tests.

## Consent and User Data Controls POC

This POC enforces consent at the data layer before signal data can influence downstream readiness or recommendation logic.

### Per-Signal Consent

Consent is recorded per:

- person
- signal type
- source

Consent states are:

- `granted`
- `revoked`

The latest consent record determines whether a source is currently allowed.

If no consent record exists, the source is not treated as allowed.

### Revocation

Signal rows pass through a consent filter before downstream readiness processing.

When a source is revoked for a specific signal type:

- matching rows are immediately excluded
- other signal types are unaffected
- the revoked source can no longer influence readiness/recommendation calculations

An automated integration test verifies that previously eligible WHOOP HRV data stops influencing readiness immediately after revocation.

### Provenance for Display

The canonical signal model already retains source and capture-time provenance, including fields such as:

- `source_name`
- `capture_time_utc`
- timezone / offset information

These fields are available for the UI to display the source and capture time for each value.

Actual UI rendering is outside the scope of this data-layer POC.

### User Data Export

Export returns only the requested user's own:

- signal data
- consent records

Data belonging to other users is excluded.

### User Data Deletion

Deletion:

- removes the target user's signal rows
- removes the target user's consent records
- preserves other users' data
- records the deletion action in the audit log

The audit event records the number of deleted signal and consent records.

### Audit Log

Deletion creates a persistent audit event with:

- person ID
- action
- timestamp
- deletion counts

The deletion audit event remains after the user's operational data has been removed.

### Testing

Tests cover:

- granted consent allowing a source
- revoked consent blocking a source
- consent isolation by signal type
- immediate revoke-to-readiness enforcement
- user-specific export
- user-specific deletion
- deletion audit logging

The full Apple Health parser, Readiness, Consent and Data Controls test suite currently passes 24/24 tests.


## User Data-Usage Notice POC

This POC implements the onboarding data-usage acknowledgement required before a user submits personal check-in data.

### Notice

The notice explains that BRIO uses the user's current check-in data to create a non-clinical daily suggestion.

The notice includes a version identifier so acknowledgement can be tied to the exact notice shown to the user.

### Affirmative Acknowledgement

A user must explicitly acknowledge the notice before continuing onboarding.

A successful acknowledgement records:

- person ID
- affirmative acknowledgement
- notice version
- acknowledgement timestamp

A missing or non-affirmative acknowledgement cannot continue onboarding.

### Exit Without Submission

A user can exit onboarding without acknowledging the notice.

When they exit:

- no acknowledgement is recorded
- no personal inputs are submitted

### Scope

This POC implements the data-layer / onboarding state logic.

Actual UI rendering, buttons, persistent database storage and final product/legal wording are outside the scope of this implementation.

### Testing

Tests cover:

- notice wording for current check-in data
- non-clinical daily suggestion purpose
- affirmative acknowledgement
- notice version recording
- acknowledgement timestamp recording
- blocking non-affirmative acknowledgement
- exiting onboarding without submitting personal inputs

The full Apple Health, Readiness, Consent, Data Controls and Data-Usage Notice test suite currently passes 29/29 tests.


Example:

```bash
python3 -c 'from parser import write_rows_jsonl; write_rows_jsonl("export.xml", "P001", "real_parsed_rows.jsonl")'


