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

Example:

```bash
python3 -c 'from parser import write_rows_jsonl; write_rows_jsonl("export.xml", "P001", "real_parsed_rows.jsonl")'